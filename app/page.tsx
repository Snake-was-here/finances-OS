"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Bucket = { id: string; name: string; percent: number; color: string };
type Entry = { id: string; date: string; amount: number; note: string };
type Expense = { id: string; date: string; category: string; amount: number };
type Payout = { id: string; period: string; date: string; amount: number };
type Data = { salary: number; dailyPay: number; hoursPerDay: number; workDays: number; startDate: string; buckets: Bucket[]; entries: Entry[]; expenses: Expense[]; payouts: Payout[] };

const STORAGE = "finances-os-v1";
const initial: Data = {
  salary: 2300, dailyPay: 100, hoursPerDay: 8, workDays: 5, startDate: "",
  buckets: [
    { id: "car", name: "Mašina", percent: 20, color: "#ff5277" },
    { id: "save", name: "Taupymas", percent: 30, color: "#8067ff" },
    { id: "debt", name: "Skolos", percent: 25, color: "#ffbc4a" },
    { id: "food", name: "Maistas", percent: 15, color: "#00d5b0" }
  ],
  entries: [], expenses: [], payouts: []
};

const euros = (n: number) => new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const isoToday = () => new Date().toISOString().slice(0, 10);
const shortDate = (s: string) => new Intl.DateTimeFormat("lt-LT", { day: "numeric", month: "short" }).format(new Date(`${s}T12:00:00`));
const asDate = (value: string) => new Date(`${value}T12:00:00`);
function isWorkday(value: Date, workDays: number) { const weekday = value.getDay() || 7; return weekday <= Math.max(1, Math.min(7, workDays)); }
function weekdaysBetween(from: string, to: string, workDays: number) {
  if (!from || from > to) return 0;
  const cursor = asDate(from); const end = asDate(to); let count = 0;
  while (cursor <= end) { if (isWorkday(cursor, workDays)) count += 1; cursor.setDate(cursor.getDate() + 1); }
  return count;
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

  useEffect(() => {
    try { const saved = localStorage.getItem(STORAGE); if (saved) setData({ ...initial, ...JSON.parse(saved) }); } catch { /* use defaults */ }
    fetch("/api/session").then(response => setLocked(!response.ok)).catch(() => setLocked(true)); setReady(true);
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
  const earned = baseEarned + extras; const spent = monthExpenses.reduce((sum, x) => sum + x.amount, 0); const net = earned - spent;
  const allocation = data.buckets.reduce((sum, x) => sum + x.percent, 0);
  const paid = data.payouts.find(x => x.period === monthPrefix);
  const workedHours = totalWorkdays * data.hoursPerDay;
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const date = new Date(); date.setDate(date.getDate() - 13 + i); const key = date.toISOString().slice(0, 10);
    const extra = data.entries.filter(x => x.date === key).reduce((sum, x) => sum + x.amount, 0);
    const automatic = Boolean(data.startDate && key >= data.startDate && key <= today && isWorkday(date, data.workDays));
    return { key, label: new Intl.DateTimeFormat("lt-LT", { weekday: "short" }).format(date).replace(".", ""), amount: (automatic ? data.dailyPay : 0) + extra, worked: automatic };
  }), [data.dailyPay, data.entries, data.startDate, data.workDays, today]);
  const maxDay = Math.max(data.dailyPay, 100, ...days.map(x => x.amount));

  async function unlock(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    if (response.ok) { setLocked(false); setPasswordError(false); setPassword(""); } else { setPasswordError(true); setPassword(""); }
  }
  function addBonus(event: FormEvent) { event.preventDefault(); const amount = Number(bonus); if (!Number.isFinite(amount) || amount <= 0) return; setData(d => ({ ...d, entries: [...d.entries, { id: crypto.randomUUID(), date: today, amount, note: bonusNote || "Papildomai" }] })); }
  function addExpense(event: FormEvent) { event.preventDefault(); const amount = Number(expenseAmount); if (!Number.isFinite(amount) || amount <= 0) return; setData(d => ({ ...d, expenses: [...d.expenses, { id: crypto.randomUUID(), date: today, category: expenseCategory, amount }] })); setExpenseAmount(""); }
  function setNumber(key: "salary" | "dailyPay" | "hoursPerDay" | "workDays", value: string) { setData(d => ({ ...d, [key]: Math.max(0, Number(value) || 0) })); }
  function updateBucket(id: string, key: "name" | "percent", value: string) { setData(d => ({ ...d, buckets: d.buckets.map(b => b.id === id ? { ...b, [key]: key === "percent" ? Math.max(0, Number(value) || 0) : value } : b) })); }
  function addBucket() { setData(d => ({ ...d, buckets: [...d.buckets, { id: crypto.randomUUID(), name: "Nauja dėžutė", percent: 0, color: "#5ee8ff" }] })); }
  function markPaid() { if (!paid && earned > 0) setData(d => ({ ...d, payouts: [...d.payouts, { id: crypto.randomUUID(), period: monthPrefix, date: today, amount: earned }] })); }
  function exportData() { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `finansai-${today}.json`; a.click(); URL.revokeObjectURL(url); }
  function importData(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { setData({ ...initial, ...JSON.parse(String(reader.result)) }); } catch { alert("Nepavyko perskaityti failo."); } }; reader.readAsText(file); }

  if (!ready) return null;
  if (locked) return <main className="lock-screen"><div className="lock-card"><p className="eyebrow">FINANSŲ OS / PRIVATE</p><h1>Tavo pinigų<br/><i>judėjimas.</i></h1><p>Trumpas kasdienis signalas, kad darbas virsta laisve.</p><form onSubmit={unlock}><input aria-label="Slaptažodis" autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Slaptažodis"/><button>Atrakinti <span>→</span></button></form>{passwordError && <small>Neteisingas slaptažodis.</small>}</div></main>;

  return <main className="app-shell">
    <header><a className="logo" href="#top">FINANSŲ<span>OS</span></a><div className="header-actions"><span className="date">{new Intl.DateTimeFormat("lt-LT", { month: "long", year: "numeric" }).format(new Date())}</span><button className="icon-button" onClick={() => setEditing(!editing)} aria-label="Atidaryti redagavimą">{editing ? "×" : "⚙"}</button></div></header>
    <section className="hero" id="top"><div><p className="eyebrow">ŠIO MĖNESIO UŽDIRBTA</p><h1>{euros(net)}</h1><p className="subcopy">{data.startDate ? `${euros(baseEarned)} automatiškai · ${euros(extras)} papildomai · ${euros(spent)} išleista` : "Nustatyk darbo pradžios datą per ⚙ ir progresas pradės judėti pats."}</p></div><div className="pulse"><b>{data.startDate ? Math.round((earned / data.salary) * 100) : 0}%</b><span>mėnesio plano</span></div></section>
    <nav className="view-switcher"><button className={view === "overview" ? "selected" : ""} onClick={() => setView("overview")}>Apžvalga</button><button className={view === "chart" ? "selected" : ""} onClick={() => setView("chart")}>Ritmas</button><button className={view === "goals" ? "selected" : ""} onClick={() => setView("goals")}>Dėžutės</button></nav>
    {editing && <aside className="editor contract-editor"><div><p className="eyebrow">DARBO NUSTATYMAI</p><h2>Automatinis ritmas</h2></div><label>Pradėjau dirbti<input type="date" value={data.startDate} onInput={e => { const startDate = e.currentTarget.value; setData(d => ({ ...d, startDate })); }} onChange={e => setData(d => ({ ...d, startDate: e.target.value }))}/></label><label>Uždarbis už dieną<input type="number" value={data.dailyPay} onChange={e => setNumber("dailyPay", e.target.value)}/></label><label>Valandos per dieną<input type="number" value={data.hoursPerDay} onChange={e => setNumber("hoursPerDay", e.target.value)}/></label><label>Darbo dienos per savaitę<input type="number" min="1" max="7" value={data.workDays} onChange={e => setNumber("workDays", e.target.value)}/></label><label>Mėnesio planas<input type="number" value={data.salary} onChange={e => setNumber("salary", e.target.value)}/></label><form onSubmit={addBonus} className="entry-form"><label>Papildomai šiandien<input inputMode="decimal" value={bonus} onChange={e => setBonus(e.target.value)} /></label><label>Pastaba<input value={bonusNote} onChange={e => setBonusNote(e.target.value)} /></label><button className="primary">Pridėti +</button></form><form onSubmit={addExpense} className="entry-form expense-form"><label>Išlaida<input inputMode="decimal" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="0" /></label><label>Kategorija<select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>{["Maistas", "Kelionės", "Nuotykiai", "Kita"].map(x => <option key={x}>{x}</option>)}</select></label><button className="secondary">Pridėti išlaidą</button></form><div className="backup"><button onClick={exportData}>Eksportuoti duomenis</button><label>Importuoti<input type="file" accept="application/json" onChange={importData} /></label></div></aside>}
    {view === "overview" && <section className="overview-grid"><article className="metric-card neon-blue"><p>STANDARTINĖ DIENA</p><strong>{euros(data.dailyPay)}</strong><small>{data.hoursPerDay} val. · {data.workDays} d. savaitė</small></article><article className="metric-card neon-yellow"><p>ŠĮ MĖNESĮ</p><strong>{monthWorkdays}</strong><small>apmokėtos darbo dienos</small></article><article className="metric-card neon-pink"><p>NUO PRADŽIOS</p><strong>{totalWorkdays} d.</strong><small>{workedHours} val. pradirbta</small></article><section className="quick-work"><div><p className="eyebrow">DARBO PROGRESAS</p><h2>{data.startDate ? <>Dirbi <i>{totalWorkdays}</i> d.<br/>Pelnas kyla pats.</> : <>Nustatyk darbo<br/><i>pradžios datą.</i></>}</h2></div>{data.startDate && <><div className="auto-number"><b>{euros(baseEarned)}</b><span>automatiškai uždirbta</span></div><p className="hint">Skaičiuojama nuo {shortDate(data.startDate)} — tik tavo {data.workDays} darbo dienos per savaitę. Savaitgaliai sustoja.</p></>}</section><section className="recent"><div className="section-heading"><div><p className="eyebrow">MĖNESIO IŠMOKA</p><h2>{paid ? "Išmokėta" : "Dar neišmokėta"}</h2></div><b>{paid ? euros(paid.amount) : euros(earned)}</b></div><p className="hint">{paid ? `${shortDate(paid.date)} pažymėjai, kad alga gauta.` : "Mėnesio gale paspausk, kai pinigai realiai įkris."}</p><button className="payout-button" disabled={Boolean(paid) || !earned} onClick={markPaid}>{paid ? "✓ Pinigai išmokėti" : "Pažymėti: pinigai išmokėti"}</button></section></section>}
    {view === "chart" && <section className="chart-view"><div className="section-heading"><div><p className="eyebrow">PASKUTINĖS 14 DIENŲ</p><h2>Darbo ritmas</h2></div><p>{euros(earned)} šį mėnesį</p></div><div className="bar-chart">{days.map(day => <div className="bar-unit" key={day.key}><div className={`bar ${day.worked ? "worked" : ""}`} style={{ height: `${day.amount ? Math.max(10, day.amount / maxDay * 100) : 2}%` }}><span>{day.amount ? `${day.amount}€` : ""}</span></div><small>{day.label}</small></div>)}</div><div className="chart-legend"><span><i></i> Automatinė darbo diena</span><span>Poilsio diena = progresas sustoja</span></div><section className="spending"><div className="section-heading"><div><p className="eyebrow">IŠLAIDOS</p><h2>Kur išėjo pinigai</h2></div><b>{euros(spent)}</b></div>{monthExpenses.length ? <div className="entry-list">{[...monthExpenses].reverse().map(x => <div key={x.id}><span>{shortDate(x.date)}</span><span>{x.category}</span><b className="negative">−{euros(x.amount)}</b></div>)}</div> : <p className="empty">Išlaidas pridėk per ⚙, kai jos atsiranda.</p>}</section></section>}
    {view === "goals" && <section className="goals-view"><div className="section-heading"><div><p className="eyebrow">KUR KELIAUJA UŽDARBIS</p><h2>Tavo dėžutės</h2></div><p>{allocation}% paskirstyta</p></div><p className="intro">Kiekviena automatiškai suskaičiuota darbo diena iškart pripildo tavo dėžutes.</p><div className="bucket-grid">{data.buckets.map((bucket, index) => { const amount = earned * bucket.percent / 100; const monthTarget = data.salary * bucket.percent / 100; const fill = Math.min(100, amount / Math.max(1, monthTarget) * 100); return <article className="bucket" key={bucket.id} style={{ "--bucket": bucket.color } as React.CSSProperties}><div className="bucket-top"><span>0{index + 1}</span><b>{bucket.percent}%</b></div><h3>{bucket.name}</h3><div className="bucket-window"><div className="money-fill" style={{ height: `${fill}%` }}><i>✦</i><i>✦</i><i>✦</i></div><strong>{euros(amount)}</strong></div><p>{euros(monthTarget)} šio mėnesio dalis</p>{editing && <div className="bucket-edit"><input value={bucket.name} onChange={e => updateBucket(bucket.id, "name", e.target.value)} /><input type="number" value={bucket.percent} onChange={e => updateBucket(bucket.id, "percent", e.target.value)} /><span>%</span></div>}</article>; })}</div>{editing && <button className="add-bucket" onClick={addBucket}>+ Pridėti dėžutę</button>}{allocation !== 100 && <p className="allocation-note">Nepaskirstyta: {100 - allocation}% · {euros(earned * (100 - allocation) / 100)}</p>}</section>}
    <footer><span>Padaryta tavo darbui matomą.</span><button onClick={async () => { await fetch("/api/logout", { method: "POST" }); setLocked(true); }}>Užrakinti</button></footer>
  </main>;
}
