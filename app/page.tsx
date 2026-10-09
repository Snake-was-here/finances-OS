"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Bucket = { id: string; name: string; percent: number; color: string; target: number };
type Entry = { id: string; date: string; amount: number; note: string };
type Expense = { id: string; date: string; category: string; amount: number };
type Payout = { id: string; period: string; date: string; amount: number; deposited?: boolean };
type HourLog = { id: string; date: string; hours: number };
type Data = { salary: number; dailyPay: number; hoursPerDay: number; workDays: number; startDate: string; bank: number; buckets: Bucket[]; entries: Entry[]; expenses: Expense[]; payouts: Payout[]; hourLogs: HourLog[] };

const STORAGE = "finances-os-v1";
const plan: Bucket[] = [
  { id: "food", name: "Maistas", percent: 15, color: "#3dfff2", target: 1000 },
  { id: "debt", name: "Skolos", percent: 20, color: "#ff5d8f", target: 2000 },
  { id: "car", name: "Automobilis", percent: 30, color: "#ffe14a", target: 2500 },
  { id: "adventure", name: "Nuotykiai", percent: 5, color: "#ff7a3d", target: 500 },
  { id: "health", name: "Sveikata", percent: 5, color: "#7cff6b", target: 500 },
  { id: "subs", name: "Prenumeratos", percent: 5, color: "#8eb6ff", target: 200 },
  { id: "hygiene", name: "Higiena", percent: 2, color: "#ff8ad8", target: 100 },
  { id: "save", name: "Taupymas", percent: 13, color: "#c084fc", target: 0 },
  { id: "crypto", name: "Crypto", percent: 5, color: "#d6ff4a", target: 0 }
];
const categories = ["Maistas", "Skolos", "Automobilis", "Nuotykiai", "Sveikata", "Prenumeratos", "Higiena", "Kita"];
const initial: Data = { salary: 2300, dailyPay: 100, hoursPerDay: 8, workDays: 5, startDate: "", bank: 0, buckets: plan, entries: [], expenses: [], payouts: [], hourLogs: [] };

const euros = (n: number) => new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const localISO = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const isoToday = () => localISO();
const months = ["sau.", "vas.", "kov.", "bal.", "geg.", "bir.", "lie.", "rgp.", "rugs.", "spa.", "lap.", "gru."];
const shortDate = (s: string) => { const [, m, d] = s.split("-"); return `${Number(d)} ${months[Number(m) - 1] || ""}`; };
const asDate = (value: string) => new Date(`${value}T12:00:00`);
function isWorkday(value: Date, workDays: number) { return (value.getDay() || 7) <= Math.max(1, Math.min(7, workDays)); }
function weekdaysBetween(from: string, to: string, workDays: number) {
  if (!from || from > to) return 0;
  const cursor = asDate(from); const end = asDate(to); let count = 0;
  while (cursor <= end) { if (isWorkday(cursor, workDays)) count += 1; cursor.setDate(cursor.getDate() + 1); }
  return count;
}
function loadData(): Data {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (!saved) return initial;
    const buckets = Array.isArray(saved.buckets) ? saved.buckets.map((b: Bucket) => ({ ...b, target: b.target || 0 })) : plan;
    const hasPlan = buckets.some((b: Bucket) => b.id === "crypto");
    return { ...initial, ...saved, bank: Number(saved.bank) || 0, hourLogs: saved.hourLogs || [], buckets: hasPlan ? buckets : plan };
  } catch { return initial; }
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [data, setData] = useState<Data>(initial);
  const [view, setView] = useState<"overview" | "chart" | "goals">("overview");
  const [editing, setEditing] = useState(false);
  const [bonus, setBonus] = useState("25");
  const [bonusNote, setBonusNote] = useState("Papildomos valandos");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Maistas");
  const [moveTo, setMoveTo] = useState("save");
  const [moveAmount, setMoveAmount] = useState("5");
  const [hourInput, setHourInput] = useState("1");

  useEffect(() => {
    setData(loadData());
    fetch("/api/session").then(response => setLocked(!response.ok)).catch(() => setLocked(true));
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE, JSON.stringify(data)); }, [data, ready]);

  const today = isoToday(); const monthPrefix = today.slice(0, 7); const monthStart = `${monthPrefix}-01`;
  const effectiveStart = data.startDate && data.startDate > monthStart ? data.startDate : monthStart;
  const monthWorkdays = data.startDate ? weekdaysBetween(effectiveStart, today, data.workDays) : 0;
  const totalWorkdays = weekdaysBetween(data.startDate, today, data.workDays);
  const baseEarned = monthWorkdays * data.dailyPay;
  const monthEntries = data.entries.filter(x => x.date.startsWith(monthPrefix));
  const monthExpenses = data.expenses.filter(x => x.date.startsWith(monthPrefix));
  const extras = monthEntries.reduce((sum, x) => sum + x.amount, 0);
  const lifetimeExtras = data.entries.reduce((sum, x) => sum + x.amount, 0);
  const earned = baseEarned + extras;
  const lifetime = totalWorkdays * data.dailyPay + lifetimeExtras;
  const spent = monthExpenses.reduce((sum, x) => sum + x.amount, 0);
  const net = earned - spent;
  const allocation = data.buckets.reduce((sum, x) => sum + x.percent, 0);
  const paid = data.payouts.find(x => x.period === monthPrefix);
  const monthHours = monthWorkdays * data.hoursPerDay + data.hourLogs.filter(x => x.date.startsWith(monthPrefix)).reduce((sum, x) => sum + x.hours, 0);
  const days = useMemo(() => {
    let running = 0;
    return Array.from({ length: 14 }, (_, i) => {
      const date = new Date(); date.setDate(date.getDate() - 13 + i); const key = localISO(date);
      const extra = data.entries.filter(x => x.date === key).reduce((sum, x) => sum + x.amount, 0);
      const automatic = Boolean(data.startDate && key >= data.startDate && key <= today && isWorkday(date, data.workDays));
      const amount = (automatic ? data.dailyPay : 0) + extra;
      running += amount;
      return { key, label: new Intl.DateTimeFormat("lt-LT", { weekday: "short" }).format(date).replace(".", ""), amount, total: running, worked: automatic };
    });
  }, [data.dailyPay, data.entries, data.startDate, data.workDays, today]);
  const maxTotal = Math.max(1, ...days.map(x => x.total));
  const points = days.map((day, i) => ({ ...day, x: 36 + i * (568 / 13), y: 168 - (day.total / maxTotal) * 132 }));
  const line = points.map(p => `${p.x},${p.y}`).join(" ");
  const area = `36,168 ${line} 604,168`;

  async function unlock(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    if (response.ok) { setLocked(false); setPasswordError(false); setPassword(""); } else { setPasswordError(true); setPassword(""); }
  }
  function addBonus(event: FormEvent) { event.preventDefault(); const amount = Number(bonus); if (!Number.isFinite(amount) || amount <= 0) return; setData(d => ({ ...d, entries: [...d.entries, { id: crypto.randomUUID(), date: today, amount, note: bonusNote || "Papildomai" }] })); }
  function addExpense(event: FormEvent) {
    event.preventDefault();
    const amount = Number(expenseAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setData(d => ({ ...d, bank: d.bank - amount, expenses: [...d.expenses, { id: crypto.randomUUID(), date: today, category: expenseCategory, amount }] }));
    setExpenseAmount("");
  }
  function removeExpense(id: string) { setData(d => { const item = d.expenses.find(x => x.id === id); return { ...d, bank: d.bank + (item?.amount || 0), expenses: d.expenses.filter(x => x.id !== id) }; }); }
  function removeEntry(id: string) { setData(d => ({ ...d, entries: d.entries.filter(x => x.id !== id) })); }
  function undoPayout() { setData(d => ({ ...d, bank: d.bank - (paid?.deposited ? paid.amount : 0), payouts: d.payouts.filter(x => x.period !== monthPrefix) })); }
  function depositPayout() { if (paid && !paid.deposited) setData(d => ({ ...d, bank: d.bank + paid.amount, payouts: d.payouts.map(x => x.period === monthPrefix ? { ...x, deposited: true } : x) })); }
  function addHours(event: FormEvent) { event.preventDefault(); const hours = Number(hourInput); if (!Number.isFinite(hours) || hours <= 0) return; setData(d => ({ ...d, hourLogs: [...d.hourLogs, { id: crypto.randomUUID(), date: today, hours }] })); }
  function setNumber(key: "salary" | "dailyPay" | "hoursPerDay" | "workDays", value: string) { setData(d => ({ ...d, [key]: Math.max(0, Number(value) || 0) })); }
  function updateBucket(id: string, key: "name" | "percent" | "target", value: string) { setData(d => ({ ...d, buckets: d.buckets.map(b => b.id === id ? { ...b, [key]: key === "name" ? value : Math.max(0, Number(value) || 0) } : b) })); }
  function movePercent(fromId: string) {
    const amount = Number(moveAmount);
    if (!Number.isFinite(amount) || amount <= 0 || moveTo === fromId) return;
    setData(d => {
      const from = d.buckets.find(b => b.id === fromId);
      if (!from) return d;
      const shift = Math.min(from.percent, amount);
      return { ...d, buckets: d.buckets.map(b => b.id === fromId ? { ...b, percent: Math.round((b.percent - shift) * 10) / 10 } : b.id === moveTo ? { ...b, percent: Math.round((b.percent + shift) * 10) / 10 } : b) };
    });
  }
  function markPaid() { if (!paid && earned > 0) setData(d => ({ ...d, payouts: [...d.payouts, { id: crypto.randomUUID(), period: monthPrefix, date: today, amount: earned }] })); }
  function exportData() { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `finansai-${today}.json`; a.click(); URL.revokeObjectURL(url); }
  function importData(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { setData(loadDataFrom(String(reader.result))); } catch { alert("Nepavyko perskaityti failo."); } }; reader.readAsText(file); }
  function loadDataFrom(raw: string): Data { const saved = JSON.parse(raw); const buckets = Array.isArray(saved.buckets) ? saved.buckets.map((b: Bucket) => ({ ...b, target: b.target || 0 })) : plan; return { ...initial, ...saved, bank: Number(saved.bank) || 0, hourLogs: saved.hourLogs || [], buckets }; }

  if (!ready) return null;
  if (locked) return <main className="lock-screen"><div className="lock-card"><p className="eyebrow">FINANSŲ OS / SIGNALAS</p><h1>Pinigai,<br/><i>kurie juda.</i></h1><p>Apskaičiuota suma ir gauta alga čia nesimaišo.</p><form onSubmit={unlock}><input aria-label="Slaptažodis" autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Slaptažodis"/><button>Atrakinti <span>→</span></button></form>{passwordError && <small>Neteisingas slaptažodis.</small>}</div></main>;

  return <main className="app-shell">
    <header><a className="logo" href="#top">FINANSŲ<span>OS</span></a><div className="header-actions"><span className="date">{new Intl.DateTimeFormat("lt-LT", { month: "long", year: "numeric" }).format(new Date())}</span><button className="icon-button" onClick={() => setEditing(!editing)} aria-label="Atidaryti redagavimą">{editing ? "×" : "⚙"}</button></div></header>
    <section className="hero" id="top"><div><p className="eyebrow">APSKAIČIUOTA, DAR NE IŠMOKA</p><h1>{euros(net)}</h1><p className="subcopy">{data.startDate ? `${euros(baseEarned)} automatiškai · ${euros(extras)} papildomai · ${euros(spent)} išleista` : "Nustatyk darbo pradžios datą per ⚙ ir progresas pradės judėti pats."}</p></div><div className="pulse"><b>{data.startDate && data.salary ? Math.round((earned / data.salary) * 100) : 0}%</b><span>mėnesio plano</span></div></section>
    <nav className="view-switcher"><button className={view === "overview" ? "selected" : ""} onClick={() => setView("overview")}>Apžvalga</button><button className={view === "chart" ? "selected" : ""} onClick={() => setView("chart")}>Kaupimasis</button><button className={view === "goals" ? "selected" : ""} onClick={() => setView("goals")}>Dėžutės</button></nav>
    {editing && <aside className="editor"><div><p className="eyebrow">DARBO NUSTATYMAI</p><h2>Darbas</h2></div><label>Pradėjau dirbti<input type="date" value={data.startDate} onInput={e => { const startDate = e.currentTarget.value; setData(d => ({ ...d, startDate })); }} onChange={e => setData(d => ({ ...d, startDate: e.target.value }))}/></label><label>Uždarbis už dieną<input type="number" value={data.dailyPay} onChange={e => setNumber("dailyPay", e.target.value)}/></label><label>Valandos per dieną<input type="number" value={data.hoursPerDay} onChange={e => setNumber("hoursPerDay", e.target.value)}/></label><label>Darbo dienos per savaitę<input type="number" min="1" max="7" value={data.workDays} onChange={e => setNumber("workDays", e.target.value)}/></label><label>Mėnesio planas<input type="number" value={data.salary} onChange={e => setNumber("salary", e.target.value)}/></label><form onSubmit={addBonus} className="entry-form"><label>Papildomai šiandien<input inputMode="decimal" value={bonus} onChange={e => setBonus(e.target.value)} /></label><label>Pastaba<input value={bonusNote} onChange={e => setBonusNote(e.target.value)} /></label><button className="primary">Pridėti +</button></form>{monthEntries.length > 0 && <div className="ledger"><p>Papildomi įrašai</p>{[...monthEntries].reverse().map(x => <div key={x.id}><span>{shortDate(x.date)}</span><span>{x.note}</span><b>{euros(x.amount)}</b><button type="button" onClick={() => removeEntry(x.id)}>Išimti</button></div>)}</div>}<form onSubmit={addExpense} className="entry-form"><label>Išlaida<input inputMode="decimal" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="0" /></label><label>Kategorija<select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>{categories.map(x => <option key={x}>{x}</option>)}</select></label><button className="secondary">Pridėti išlaidą</button></form><details className="backup"><summary>Atsarginė kopija</summary><button onClick={exportData}>Eksportuoti duomenis</button><label>Importuoti<input type="file" accept="application/json" onChange={importData} /></label><button onClick={() => setData(d => ({ ...d, buckets: plan }))}>Atstatyti dėžutes</button></details></aside>}
    {view === "overview" && <section className="overview-grid"><article className="metric-card"><p>Standartinė diena</p><strong>{euros(data.dailyPay)}</strong><small>{data.hoursPerDay} val. · {data.workDays} d. savaitė</small></article><article className="metric-card"><p>Šį mėnesį</p><strong>{monthHours} val.</strong><small>{monthWorkdays} darbo dienos · {data.hoursPerDay} val. standartas</small></article><article className="metric-card"><p>Nuo pradžios</p><strong>{totalWorkdays} d.</strong><small>{totalWorkdays * data.hoursPerDay} val. pagal ritmą</small></article><section className="quick-work"><div><p className="eyebrow">DARBO PROGRESAS</p><h2>{data.startDate ? <>Dirbi <i>{totalWorkdays}</i> d.<br/>Pelnas kyla pats.</> : <>Nustatyk darbo<br/><i>pradžios datą.</i></>}</h2></div>{data.startDate && <><div className="auto-number"><b>{euros(baseEarned)}</b><span>suskaičiuota, dar negauta</span></div><p className="hint">Nuo {shortDate(data.startDate)}, tik {data.workDays} darbo dienos per savaitę. Savaitgaliais suma nejuda.</p></>}</section><section className="recent"><div className="section-heading"><div><p className="eyebrow">MĖNESIO IŠMOKA</p><h2>{paid ? "Išmokėta" : "Dar neišmokėta"}</h2></div><b>{paid ? euros(paid.amount) : euros(earned)}</b></div><p className="hint">{paid ? `${shortDate(paid.date)} pažymėjai, kad alga gauta.` : "Mėnesio gale paspausk tik tada, kai pinigai realiai įkris."}</p><button className="payout-button" disabled={!paid && !earned} onClick={paid ? undoPayout : markPaid}>{paid ? "Atšaukti išmoką" : "Pažymėti: pinigai išmokėti"}</button>{paid && !paid.deposited && <button className="primary" onClick={depositPayout}>Pridėti {euros(paid.amount)} į sąskaitą</button>}{paid?.deposited && <p className="hint">Ši išmoka jau įskaityta į sąskaitą.</p>}</section><section className="bank-box"><div className="section-heading"><div><p className="eyebrow">SĄSKAITA</p><h2>Pinigai banke</h2></div><strong>{euros(data.bank)}</strong></div><label>Dabartinis likutis<input type="number" value={data.bank} onChange={e => setData(d => ({ ...d, bank: Number(e.target.value) || 0 }))} /></label><form onSubmit={addExpense} className="entry-form"><label>Išlaida<input inputMode="decimal" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="20" /></label><label>Kam<select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>{categories.map(x => <option key={x}>{x}</option>)}</select></label><button className="secondary">{expenseAmount ? `Nurašyti ${euros(Number(expenseAmount) || 0)} · ${expenseCategory}` : "Nurašyti išlaidą"}</button></form>{monthExpenses.length > 0 && <div className="ledger">{[...monthExpenses].reverse().slice(0, 4).map(x => <div key={x.id}><span>{shortDate(x.date)}</span><span>{x.category}</span><b className="negative">−{euros(x.amount)}</b><button type="button" onClick={() => removeExpense(x.id)}>Grąžinti</button></div>)}</div>}</section><section className="recent"><div className="section-heading"><div><p className="eyebrow">VALANDOS</p><h2>Šį mėnesį</h2></div><b>{monthHours} val.</b></div><form onSubmit={addHours} className="entry-form"><label>Papildomos valandos šiandien<input type="number" min="0.5" step="0.5" value={hourInput} onChange={e => setHourInput(e.target.value)} /></label><button className="secondary">Pridėti valandas</button></form>{data.hourLogs.filter(x => x.date.startsWith(monthPrefix)).length > 0 && <div className="ledger">{data.hourLogs.filter(x => x.date.startsWith(monthPrefix)).slice().reverse().map(x => <div key={x.id}><span>{shortDate(x.date)}</span><span>papildomai</span><b>{x.hours} val.</b><button type="button" onClick={() => setData(d => ({ ...d, hourLogs: d.hourLogs.filter(h => h.id !== x.id) }))}>Išimti</button></div>)}</div>}</section>{monthEntries.length > 0 && <section className="recent ledger"><p className="eyebrow">PAPILDOMI ĮRAŠAI</p>{[...monthEntries].reverse().map(x => <div key={x.id}><span>{shortDate(x.date)}</span><span>{x.note}</span><b>{euros(x.amount)}</b><button type="button" onClick={() => removeEntry(x.id)}>Išimti</button></div>)}</section>}</section>}
    {view === "chart" && <section className="chart-view"><div className="section-heading"><div><p className="eyebrow">14 DIENŲ SUMA</p><h2>Kaupiasi</h2></div><b>{euros(days.at(-1)?.total || 0)}</b></div><svg className="pulse-chart" viewBox="0 0 640 210" role="img" aria-label="Kaupiama suma per 14 dienų"><line x1="36" y1="168" x2="604" y2="168" /><polygon points={area} /><polyline points={line} />{points.map(p => <g key={p.key}><circle cx={p.x} cy={p.y} r={p.worked ? 4.5 : 3} className={p.worked ? "on" : "off"} />{p.total > 0 && <text x={p.x} y={p.y - 10}>{Math.round(p.total)}</text>}<text className="axis" x={p.x} y="198">{p.label}</text></g>)}</svg><div className="chart-legend"><span><i></i> Darbo diena prideda dienpinigius</span><span>Poilsio diena kreivę sustabdo</span></div><section className="spending"><div className="section-heading"><div><p className="eyebrow">IŠLAIDOS</p><h2>Kur išėjo pinigai</h2></div><b>{euros(spent)}</b></div>{monthExpenses.length ? <div className="entry-list">{[...monthExpenses].reverse().map(x => <div key={x.id}><span>{shortDate(x.date)}</span><span>{x.category}</span><b className="negative">−{euros(x.amount)}</b><button type="button" onClick={() => removeExpense(x.id)}>Išimti</button></div>)}</div> : <p className="empty">Išlaidų dar nėra.</p>}</section></section>}
    {view === "goals" && <section className="goals-view"><div className="section-heading"><div><p className="eyebrow">KUR KELIAUJA UŽDARBIS</p><h2>Dėžutės nuo 2300 €</h2></div><p>{allocation}% paskirstyta</p></div><p className="intro">Kiekviena dėžutė ima savo dalį. Kreivė rodo, kaip ta dalis auga: 100, tada 200, tada 300. Kai tikslas pilnas, būsimą procentą perkelk kitur.</p><div className="bucket-grid">{data.buckets.map(bucket => { const monthSlice = data.salary * bucket.percent / 100; const saved = lifetime * bucket.percent / 100; const reached = bucket.target > 0 && saved >= bucket.target; const fill = bucket.target ? Math.min(100, saved / bucket.target * 100) : Math.min(100, bucket.percent); const monthsLeft = bucket.target && monthSlice ? bucket.target / monthSlice : 0; const spark = days.map(day => day.total * bucket.percent / 100); const sparkMax = Math.max(1, ...spark); const sparkLine = spark.map((value, i) => `${(i / 13) * 148},${34 - (value / sparkMax) * 26}`).join(" "); return <article className={reached ? "bucket reached" : "bucket"} key={bucket.id} style={{ "--bucket": bucket.color } as React.CSSProperties}><div className="bucket-top"><span>{bucket.percent}%</span><b>{reached ? "Tikslas pasiektas" : bucket.target ? `~${monthsLeft.toFixed(1)} mėn.` : "be lubų"}</b></div><h3>{bucket.name}</h3><svg className="spark" viewBox="0 0 148 38" aria-hidden="true"><polyline points={sparkLine} /></svg><div className="track"><i style={{ width: `${fill}%` }} /></div><strong>{euros(monthSlice)}</strong><p>{bucket.target ? `${euros(saved)} iš ${euros(bucket.target)}` : `${euros(saved)} sukaupta`}</p>{reached && <div className="reallocate"><label>Perkelti %<input type="number" min="0" max={bucket.percent} value={moveAmount} onChange={e => setMoveAmount(e.target.value)} /></label><select value={moveTo} onChange={e => setMoveTo(e.target.value)}>{data.buckets.filter(x => x.id !== bucket.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select><button onClick={() => movePercent(bucket.id)}>Perkelti</button></div>}{editing && <div className="bucket-edit"><input value={bucket.name} onChange={e => updateBucket(bucket.id, "name", e.target.value)} /><input type="number" value={bucket.percent} onChange={e => updateBucket(bucket.id, "percent", e.target.value)} /><span>%</span><input type="number" value={bucket.target} onChange={e => updateBucket(bucket.id, "target", e.target.value)} /><span>tikslas</span></div>}</article>; })}</div>{allocation !== 100 && <p className="allocation-note">Nepaskirstyta: {Math.round((100 - allocation) * 10) / 10}% · {euros(earned * (100 - allocation) / 100)} šį mėnesį</p>}</section>}
    <footer><span>Apskaičiuota nėra tas pats, kas gauta.</span><button onClick={async () => { await fetch("/api/logout", { method: "POST" }); setLocked(true); }}>Užrakinti</button></footer>
  </main>;
}
