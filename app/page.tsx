"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Bucket = { id: string; name: string; percent: number; color: string; target: number };
type Entry = { id: string; date: string; amount: number; note: string };
type Expense = { id: string; date: string; category: string; amount: number; note: string; pullId?: string };
type Payout = { id: string; period: string; date: string; amount: number; deposited?: boolean };
type HourLog = { id: string; date: string; hours: number };
type Pull = { id: string; date: string; bucketId: string; amount: number; note: string };
type Data = { salary: number; dailyPay: number; hoursPerDay: number; workDays: number; startDate: string; bank: number; buckets: Bucket[]; entries: Entry[]; expenses: Expense[]; payouts: Payout[]; hourLogs: HourLog[]; skipped: string[]; pulls: Pull[] };

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
const initial: Data = { salary: 2300, dailyPay: 100, hoursPerDay: 8, workDays: 5, startDate: "", bank: 0, buckets: plan, entries: [], expenses: [], payouts: [], hourLogs: [], skipped: [], pulls: [] };

const euros = (n: number) => new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const localISO = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const isoToday = () => localISO();
const months = ["sau.", "vas.", "kov.", "bal.", "geg.", "bir.", "lie.", "rgp.", "rugs.", "spa.", "lap.", "gru."];
const shortDate = (s: string) => { const [, m, d] = s.split("-"); return `${Number(d)} ${months[Number(m) - 1] || ""}`; };
const asDate = (value: string) => new Date(`${value}T12:00:00`);
function isWorkday(value: Date, workDays: number) { return (value.getDay() || 7) <= Math.max(1, Math.min(7, workDays)); }
function weekdaysBetween(from: string, to: string, workDays: number, skipped: string[] = []) {
  if (!from || from > to) return 0;
  const off = new Set(skipped);
  const cursor = asDate(from); const end = asDate(to); let count = 0;
  while (cursor <= end) { const key = localISO(cursor); if (isWorkday(cursor, workDays) && !off.has(key)) count += 1; cursor.setDate(cursor.getDate() + 1); }
  return count;
}
function loadData(): Data {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (!saved) return initial;
    const buckets = Array.isArray(saved.buckets) ? saved.buckets.map((b: Bucket) => ({ ...b, target: b.target || 0 })) : plan;
    const hasPlan = buckets.some((b: Bucket) => b.id === "crypto");
    return { ...initial, ...saved, bank: Number(saved.bank) || 0, hourLogs: saved.hourLogs || [], skipped: saved.skipped || [], pulls: saved.pulls || [], expenses: (saved.expenses || []).map((x: Expense) => ({ ...x, note: x.note || "" })), buckets: hasPlan ? buckets : plan };
  } catch { return initial; }
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [data, setData] = useState<Data>(initial);
  const [view, setView] = useState<"overview" | "chart" | "goals" | "bank">("overview");
  const [editing, setEditing] = useState(false);

  // Bonus
  const [bonus, setBonus] = useState("25");
  const [bonusDate, setBonusDate] = useState(isoToday());
  const [bonusNote, setBonusNote] = useState("Papildomos valandos");

  // Expense
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(isoToday());
  const [expenseCategory, setExpenseCategory] = useState("Maistas");
  const [expenseNote, setExpenseNote] = useState("");

  // Hours
  const [hourInput, setHourInput] = useState("1");
  const [hourDate, setHourDate] = useState(isoToday());

  // Past day skip picker
  const [skipDate, setSkipDate] = useState(isoToday());

  // Drafts for pull (independent per bucket)
  const [drafts, setDrafts] = useState<Record<string, { amount: string; note: string }>>({});

  // Drafts for percent reallocate (independent per bucket)
  const [reallocDrafts, setReallocDrafts] = useState<Record<string, { amount: string; to: string }>>({});

  const [chartSpan, setChartSpan] = useState<"month" | "all">("all");

  useEffect(() => {
    setData(loadData());
    fetch("/api/session").then(response => setLocked(!response.ok)).catch(() => setLocked(true));
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE, JSON.stringify(data)); }, [data, ready]);

  const today = isoToday(); const monthPrefix = today.slice(0, 7); const monthStart = `${monthPrefix}-01`;
  const effectiveStart = data.startDate && data.startDate > monthStart ? data.startDate : monthStart;
  const monthWorkdays = data.startDate ? weekdaysBetween(effectiveStart, today, data.workDays, data.skipped) : 0;
  const totalWorkdays = weekdaysBetween(data.startDate, today, data.workDays, data.skipped);
  const baseEarned = monthWorkdays * data.dailyPay;
  const monthEntries = data.entries.filter(x => x.date.startsWith(monthPrefix));
  const monthExpenses = data.expenses.filter(x => x.date.startsWith(monthPrefix));
  const extras = monthEntries.reduce((sum, x) => sum + x.amount, 0);
  const lifetimeExtras = data.entries.reduce((sum, x) => sum + x.amount, 0);
  const earned = baseEarned + extras;
  const lifetime = totalWorkdays * data.dailyPay + lifetimeExtras;
  const spent = monthExpenses.reduce((sum, x) => sum + x.amount, 0);
  const net = earned - spent;
  const allocation = Math.round(data.buckets.reduce((sum, x) => sum + x.percent, 0) * 10) / 10;
  const unallocatedPercent = Math.round((100 - allocation) * 10) / 10;
  const goalTarget = data.buckets.reduce((sum, b) => sum + (b.target || 0), 0);
  const goalSaved = data.buckets.reduce((sum, b) => { if (!b.target) return sum; const pulled = data.pulls.filter(x => x.bucketId === b.id).reduce((s, x) => s + x.amount, 0); return sum + Math.max(0, lifetime * b.percent / 100 - pulled); }, 0);
  const goalPct = goalTarget ? Math.min(100, goalSaved / goalTarget * 100) : 0;
  const paid = data.payouts.find(x => x.period === monthPrefix);
  const monthHours = monthWorkdays * data.hoursPerDay + data.hourLogs.filter(x => x.date.startsWith(monthPrefix)).reduce((sum, x) => sum + x.hours, 0);

  const life = useMemo(() => {
    if (!data.startDate) return [] as { key: string; label: string; amount: number; total: number; worked: boolean }[];
    const off = new Set(data.skipped);
    const cursor = asDate(data.startDate); const end = asDate(today); let running = 0; const rows = [];
    while (cursor <= end) {
      const key = localISO(cursor);
      const extra = data.entries.filter(x => x.date === key).reduce((sum, x) => sum + x.amount, 0);
      const worked = isWorkday(cursor, data.workDays) && !off.has(key);
      const amount = (worked ? data.dailyPay : 0) + extra;
      running += amount;
      rows.push({ key, label: shortDate(key), amount, total: running, worked });
      cursor.setDate(cursor.getDate() + 1);
    }
    return rows;
  }, [data.dailyPay, data.entries, data.skipped, data.startDate, data.workDays, today]);

  const days = chartSpan === "all" && life.length ? life : life.slice(-14);
  const plotted = days.length ? days : [{ key: today, label: shortDate(today), amount: 0, total: 0, worked: false }];
  const maxTotal = Math.max(1, ...plotted.map(x => x.total));
  const chartWidth = 640;
  const leftPad = 48;
  const rightPad = 48;
  const usableWidth = chartWidth - leftPad - rightPad;

  const points = plotted.map((day, i) => {
    const x = leftPad + (plotted.length > 1 ? i * (usableWidth / (plotted.length - 1)) : usableWidth / 2);
    const y = 142 - (day.total / maxTotal) * 88;
    return { ...day, x, y };
  });
  const line = points.map(p => `${p.x},${p.y}`).join(" ");
  const area = `${leftPad},176 ${line} ${chartWidth - rightPad},176`;

  const showIndices = useMemo(() => {
    if (chartSpan === "month") {
      // 14 dienų kreivėje suma ant kiekvienos dienos
      return new Set(plotted.map((_, i) => i));
    }
    // Viso laiko kreivėje žymos retos (5 žymos tolygiai)
    const count = plotted.length;
    if (count <= 5) return new Set(plotted.map((_, i) => i));
    const set = new Set<number>();
    const totalTicks = 5;
    for (let k = 0; k < totalTicks; k++) {
      const idx = Math.round(k * (count - 1) / (totalTicks - 1));
      set.add(idx);
    }
    return set;
  }, [chartSpan, plotted]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    if (response.ok) { setLocked(false); setPasswordError(false); setPassword(""); } else { setPasswordError(true); setPassword(""); }
  }

  function addBonus(event: FormEvent) {
    event.preventDefault();
    const amount = Number(bonus);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const targetDate = bonusDate || today;
    setData(d => ({ ...d, entries: [...d.entries, { id: crypto.randomUUID(), date: targetDate, amount, note: bonusNote || "Papildomai" }] }));
  }

  function addExpense(event: FormEvent) {
    event.preventDefault();
    const amount = Number(expenseAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const targetDate = expenseDate || today;
    setData(d => ({ ...d, bank: d.bank - amount, expenses: [...d.expenses, { id: crypto.randomUUID(), date: targetDate, category: expenseCategory, amount, note: expenseNote.trim() }] }));
    setExpenseAmount(""); setExpenseNote("");
  }

  function toggleTodaySkip() {
    setData(d => ({ ...d, skipped: d.skipped.includes(today) ? d.skipped.filter(x => x !== today) : [...d.skipped, today] }));
  }

  function addSkippedDay(day: string) {
    if (!day) return;
    setData(d => ({ ...d, skipped: d.skipped.includes(day) ? d.skipped : [...d.skipped, day] }));
  }

  function removeSkipped(day: string) {
    setData(d => ({ ...d, skipped: d.skipped.filter(x => x !== day) }));
  }

  function pullFrom(bucketId: string) {
    const draft = drafts[bucketId] || { amount: "", note: "" };
    const amount = Number(String(draft.amount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const bucket = data.buckets.find(b => b.id === bucketId);
    const pullId = crypto.randomUUID();
    const note = draft.note.trim() || "Netikėta išlaida";
    setData(d => ({ ...d, bank: d.bank - amount, pulls: [...d.pulls, { id: pullId, date: today, bucketId, amount, note }], expenses: [...d.expenses, { id: crypto.randomUUID(), date: today, category: bucket?.name || "Kita", amount, note, pullId }] }));
    setDrafts(d => ({ ...d, [bucketId]: { amount: "", note: "" } }));
  }

  function removeExpense(id: string) {
    setData(d => {
      const item = d.expenses.find(x => x.id === id);
      return {
        ...d,
        bank: d.bank + (item?.amount || 0),
        expenses: d.expenses.filter(x => x.id !== id),
        pulls: item?.pullId ? d.pulls.filter(x => x.id !== item.pullId) : d.pulls
      };
    });
  }

  function removeEntry(id: string) { setData(d => ({ ...d, entries: d.entries.filter(x => x.id !== id) })); }
  function removeHour(id: string) { setData(d => ({ ...d, hourLogs: d.hourLogs.filter(h => h.id !== id) })); }
  function undoPayout() { setData(d => ({ ...d, bank: d.bank - (paid?.deposited ? paid.amount : 0), payouts: d.payouts.filter(x => x.period !== monthPrefix) })); }
  function depositPayout() { if (paid && !paid.deposited) setData(d => ({ ...d, bank: d.bank + paid.amount, payouts: d.payouts.map(x => x.period === monthPrefix ? { ...x, deposited: true } : x) })); }

  function addHours(event: FormEvent) {
    event.preventDefault();
    const hours = Number(hourInput);
    if (!Number.isFinite(hours) || hours <= 0) return;
    const targetDate = hourDate || today;
    setData(d => ({ ...d, hourLogs: [...d.hourLogs, { id: crypto.randomUUID(), date: targetDate, hours }] }));
  }

  function setNumber(key: "salary" | "dailyPay" | "hoursPerDay" | "workDays", value: string) {
    setData(d => ({ ...d, [key]: Math.max(0, Number(value) || 0) }));
  }

  function updateBucket(id: string, key: "name" | "percent" | "target", value: string) {
    setData(d => ({ ...d, buckets: d.buckets.map(b => b.id === id ? { ...b, [key]: key === "name" ? value : Math.max(0, Number(value) || 0) } : b) }));
  }

  function movePercent(fromId: string) {
    const draft = reallocDrafts[fromId] || { amount: "", to: data.buckets.find(b => b.id !== fromId)?.id || "save" };
    const amount = Number(draft.amount);
    const targetTo = draft.to || data.buckets.find(b => b.id !== fromId)?.id || "save";
    if (!Number.isFinite(amount) || amount <= 0 || targetTo === fromId) return;
    setData(d => {
      const from = d.buckets.find(b => b.id === fromId);
      if (!from) return d;
      const shift = Math.min(from.percent, amount);
      if (shift <= 0) return d;
      return {
        ...d,
        buckets: d.buckets.map(b =>
          b.id === fromId
            ? { ...b, percent: Math.round((b.percent - shift) * 10) / 10 }
            : b.id === targetTo
            ? { ...b, percent: Math.round((b.percent + shift) * 10) / 10 }
            : b
        )
      };
    });
    setReallocDrafts(prev => ({
      ...prev,
      [fromId]: { amount: "", to: prev[fromId]?.to || "" }
    }));
  }

  function markPaid() { if (!paid && earned > 0) setData(d => ({ ...d, payouts: [...d.payouts, { id: crypto.randomUUID(), period: monthPrefix, date: today, amount: earned }] })); }
  function exportData() { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `finansai-${today}.json`; a.click(); URL.revokeObjectURL(url); }
  function importData(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { setData(loadDataFrom(String(reader.result))); } catch { alert("Nepavyko perskaityti failo."); } }; reader.readAsText(file); }
  function loadDataFrom(raw: string): Data { const saved = JSON.parse(raw); const buckets = Array.isArray(saved.buckets) ? saved.buckets.map((b: Bucket) => ({ ...b, target: b.target || 0 })) : plan; return { ...initial, ...saved, bank: Number(saved.bank) || 0, hourLogs: saved.hourLogs || [], buckets }; }

  if (!ready) return null;
  if (locked) return <main className="lock-screen"><div className="lock-card"><p className="eyebrow">FINANSŲ OS / SIGNALAS</p><h1>Pinigai,<br/><i>kurie juda.</i></h1><p>Apskaičiuota suma ir gauta alga čia nesimaišo.</p><form onSubmit={unlock}><input aria-label="Slaptažodis" autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Slaptažodis"/><button>Atrakinti <span>→</span></button></form>{passwordError && <small>Neteisingas slaptažodis.</small>}</div></main>;

  return <main className="app-shell">
    <header><a className="logo" href="#top">FINANSŲ<span>OS</span></a><div className="header-actions"><span className="date">{new Intl.DateTimeFormat("lt-LT", { month: "long", year: "numeric" }).format(new Date())}</span><button className="icon-button" onClick={() => setEditing(!editing)} aria-label="Atidaryti redagavimą">{editing ? "×" : "⚙"}</button></div></header>
    <section className="hero" id="top"><div><p className="eyebrow">APSKAIČIUOTA, DAR NE IŠMOKA</p><h1>{euros(net)}</h1><p className="subcopy">{data.startDate ? `${euros(baseEarned)} automatiškai · ${euros(extras)} papildomai · ${euros(spent)} išleista` : "Nustatyk darbo pradžios datą per ⚙ ir progresas pradės judėti pats."}</p></div></section>
    <nav className="view-switcher"><button className={view === "overview" ? "selected" : ""} onClick={() => setView("overview")}>Apžvalga</button><button className={view === "chart" ? "selected" : ""} onClick={() => setView("chart")}>Kaupimasis</button><button className={view === "goals" ? "selected" : ""} onClick={() => setView("goals")}>Dėžutės</button><button className={view === "bank" ? "selected" : ""} onClick={() => setView("bank")}>Sąskaita</button></nav>

    {editing && <aside className="editor">
      <div><p className="eyebrow">DARBO NUSTATYMAI</p><h2>Darbas</h2></div>
      <label>Pradėjau dirbti<input type="date" value={data.startDate} onInput={e => { const startDate = e.currentTarget.value; setData(d => ({ ...d, startDate })); }} onChange={e => setData(d => ({ ...d, startDate: e.target.value }))}/></label>
      <label>Uždarbis už dieną<input type="number" value={data.dailyPay} onChange={e => setNumber("dailyPay", e.target.value)}/></label>
      <label>Valandos per dieną<input type="number" value={data.hoursPerDay} onChange={e => setNumber("hoursPerDay", e.target.value)}/></label>
      <label>Darbo dienos per savaitę<input type="number" min="1" max="7" value={data.workDays} onChange={e => setNumber("workDays", e.target.value)}/></label>
      <label>Mėnesio planas<input type="number" value={data.salary} onChange={e => setNumber("salary", e.target.value)}/></label>
      <form onSubmit={addBonus} className="entry-form">
        <label>Data<input type="date" value={bonusDate} onChange={e => setBonusDate(e.target.value)} /></label>
        <label>Papildoma suma<input inputMode="decimal" value={bonus} onChange={e => setBonus(e.target.value)} /></label>
        <label>Pastaba<input value={bonusNote} onChange={e => setBonusNote(e.target.value)} /></label>
        <button className="primary">Pridėti +</button>
      </form>
      {data.entries.length > 0 && <div className="ledger"><p>Papildomi įrašai</p>{[...data.entries].sort((a, b) => b.date.localeCompare(a.date)).map(x => <div key={x.id}><span>{shortDate(x.date)}</span><span>{x.note}</span><b>{euros(x.amount)}</b><button type="button" onClick={() => removeEntry(x.id)}>Išimti</button></div>)}</div>}
      <form onSubmit={addExpense} className="entry-form">
        <label>Data<input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} /></label>
        <label>Išlaida<input inputMode="decimal" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="0" /></label>
        <label>Kategorija<select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>{categories.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Pastaba<input value={expenseNote} onChange={e => setExpenseNote(e.target.value)} placeholder="Kas tai buvo" /></label>
        <button className="secondary">Pridėti išlaidą</button>
      </form>
      <details className="backup"><summary>Atsarginė kopija</summary><button onClick={exportData}>Eksportuoti duomenis</button><label>Importuoti<input type="file" accept="application/json" onChange={importData} /></label><button onClick={() => setData(d => ({ ...d, buckets: plan }))}>Atstatyti dėžutes</button></details>
    </aside>}

    {view === "overview" && <section className="overview-page">
      <div className="overview-row">
        <article className="metric-card pillar-card">
          <p className="eyebrow">Apskaičiuota alga</p>
          <strong>{euros(net)}</strong>
          <small>{euros(baseEarned)} pagal dienas · {euros(extras)} priedai · {euros(spent)} išlaidos</small>
        </article>
        <article className="metric-card pillar-card">
          <p className="eyebrow">Pažymėta išmoka</p>
          <strong>{paid ? euros(paid.amount) : "0 €"}</strong>
          <small>{paid ? (paid.deposited ? "Įskaityta į sąskaitą" : "Pažymėta, neįskaityta") : "Mėnuo dar neišmokėtas"}</small>
        </article>
        <article className="metric-card pillar-card">
          <p className="eyebrow">Banke</p>
          <strong>{euros(data.bank)}</strong>
          <small>Faktinis sąskaitos likutis</small>
        </article>
      </div>

      <div className="overview-grid">
        <article className="metric-card"><p>Standartinė diena</p><strong>{euros(data.dailyPay)}</strong><small>{data.hoursPerDay} val. · {data.workDays} d. savaitė</small></article>
        <article className="metric-card hours-card">
          <p>Šį mėnesį</p>
          <strong>{monthHours} val.</strong>
          <small>{monthWorkdays} darbo dienos · {data.hoursPerDay} val. standartas</small>
          <form onSubmit={addHours} className="entry-form">
            <label>Data<input type="date" value={hourDate} onChange={e => setHourDate(e.target.value)} /></label>
            <label>Papildomai valandų<input type="number" min="0.5" step="0.5" value={hourInput} onChange={e => setHourInput(e.target.value)} /></label>
            <button className="secondary">Pridėti</button>
          </form>
          {data.hourLogs.length > 0 && <div className="ledger">{[...data.hourLogs].sort((a, b) => b.date.localeCompare(a.date)).map(x => <div key={x.id}><span>{shortDate(x.date)}</span><b>{x.hours} val.</b><button type="button" onClick={() => removeHour(x.id)}>Išimti</button></div>)}</div>}
        </article>
        <article className="metric-card"><p>Nuo pradžios</p><strong>{totalWorkdays} d.</strong><small>{totalWorkdays * data.hoursPerDay} val. pagal ritmą</small></article>
        <section className="quick-work">
          <div><p className="eyebrow">DARBO PROGRESAS</p><h2>{data.startDate ? <>Dirbi <i>{totalWorkdays}</i> d.<br/>Pelnas kyla pats.</> : <>Nustatyk darbo<br/><i>pradžios datą.</i></>}</h2></div>
          {data.startDate && <>
            <div className="auto-number"><b>{euros(baseEarned)}</b><span>suskaičiuota, dar negauta</span></div>
            <p className="hint">Nuo {shortDate(data.startDate)}, tik {data.workDays} darbo dienos per savaitę. Savaitgaliais suma nejuda.</p>
            <div className="skip-row">
              <button type="button" className="secondary" onClick={toggleTodaySkip}>
                {data.skipped.includes(today) ? "Šiandien nedirbta (atšaukti)" : "Šiandien nedirbau"}
              </button>
              <div className="skip-date-picker">
                <input type="date" value={skipDate} onChange={e => setSkipDate(e.target.value)} max={today} />
                <button type="button" className="secondary" onClick={() => addSkippedDay(skipDate)}>
                  {data.skipped.includes(skipDate) ? "Jau pažymėta nedirbta" : "Pažymėti nedirbta"}
                </button>
              </div>
            </div>
            {data.skipped.length > 0 && <div className="ledger">
              <p className="eyebrow">PAŽYMĖTOS NEDARBO DIENOS</p>
              {[...data.skipped].sort().reverse().map(day => <div key={day}><span>{shortDate(day)}</span><span>nedarbo diena</span><b>0 €</b><button type="button" onClick={() => removeSkipped(day)}>Grąžinti</button></div>)}
            </div>}
          </>}
        </section>
        <section className="recent">
          <div className="section-heading"><div><p className="eyebrow">MĖNESIO IŠMOKA</p><h2>{paid ? "Išmokėta" : "Dar neišmokėta"}</h2></div><b>{paid ? euros(paid.amount) : "0 €"}</b></div>
          <p className="hint">{paid ? `${shortDate(paid.date)} pažymėjai, kad alga gauta.` : "Mėnesio gale paspausk tik tada, kai pinigai realiai įkris į tavo rankas."}</p>
          <button className="payout-button" disabled={!paid && !earned} onClick={paid ? undoPayout : markPaid}>{paid ? "Atšaukti išmoką" : "Pažymėti: pinigai išmokėti"}</button>
          {paid && !paid.deposited && <button className="primary" onClick={depositPayout}>Pridėti {euros(paid.amount)} į sąskaitą</button>}
          {paid?.deposited && <p className="hint">Ši išmoka jau įskaityta į sąskaitą.</p>}
        </section>
        {data.entries.length > 0 && <section className="recent ledger">
          <p className="eyebrow">PAPILDOMI ĮRAŠAI</p>
          {[...data.entries].sort((a, b) => b.date.localeCompare(a.date)).map(x => <div key={x.id}><span>{shortDate(x.date)}</span><span>{x.note}</span><b>{euros(x.amount)}</b><button type="button" onClick={() => removeEntry(x.id)}>Išimti</button></div>)}
        </section>}
      </div>
    </section>}

    {view === "chart" && <section className="chart-view">
      <div className="section-heading"><div><p className="eyebrow">{chartSpan === "all" ? "NUO PRADŽIOS" : "PASKUTINĖS DIENOS"}</p><h2>Kaupiasi</h2></div><b>{euros(plotted.at(-1)?.total || 0)}</b></div>
      <div className="view-switcher"><button className={chartSpan === "all" ? "selected" : ""} onClick={() => setChartSpan("all")}>Visas laikas</button><button className={chartSpan === "month" ? "selected" : ""} onClick={() => setChartSpan("month")}>14 dienų</button></div>
      <svg className="pulse-chart" viewBox="0 0 640 216" role="img" aria-label="Kaupiama suma">
        <line x1={leftPad} y1="176" x2={chartWidth - rightPad} y2="176" />
        <polygon points={area} />
        <polyline points={line} />
        {points.map((p, i) => {
          const isShown = showIndices.has(i);
          const sumY = chartSpan === "month" ? (i % 2 === 0 ? p.y - 12 : p.y - 25) : p.y - 14;
          const axisY = chartSpan === "month" ? (i % 2 === 0 ? 193 : 206) : 198;
          return (
            <g key={p.key}>
              <circle cx={p.x} cy={p.y} r={p.worked ? 3.5 : 2.5} className={p.worked ? "on" : "off"} />
              {isShown && <text x={p.x} y={sumY} className="chart-value">{Math.round(p.total)}</text>}
              {isShown && <text className="axis" x={p.x} y={axisY}>{p.label}</text>}
            </g>
          );
        })}
      </svg>
      <div className="chart-legend"><span><i></i> Darbo diena prideda dienpinigius</span><span>Poilsio diena kreivę sustabdo</span></div>
      <section className="spending">
        <div className="section-heading"><div><p className="eyebrow">IŠLAIDOS</p><h2>Kur išėjo pinigai</h2></div><b>{euros(spent)}</b></div>
        {data.expenses.length ? <div className="entry-list">{[...data.expenses].sort((a, b) => b.date.localeCompare(a.date)).map(x => <div key={x.id}><span>{shortDate(x.date)}</span><span>{x.category}{x.note ? ` · ${x.note}` : ""}</span><b className="negative">−{euros(x.amount)}</b><button type="button" onClick={() => removeExpense(x.id)}>Išimti</button></div>)}</div> : <p className="empty">Išlaidų dar nėra.</p>}
      </section>
    </section>}

    {view === "bank" && <section className="bank-box">
      <div className="section-heading"><div><p className="eyebrow">SĄSKAITA</p><h2>Pinigai banke</h2></div><strong>{euros(data.bank)}</strong></div>
      <label>Dabartinis likutis<input type="number" value={data.bank} onChange={e => setData(d => ({ ...d, bank: Number(e.target.value) || 0 }))} /></label>
      <form onSubmit={addExpense} className="entry-form">
        <label>Data<input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} /></label>
        <label>Išlaida<input inputMode="decimal" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="20" /></label>
        <label>Kam<select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>{categories.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Kas tai buvo<input value={expenseNote} onChange={e => setExpenseNote(e.target.value)} placeholder="Nusikirpau" /></label>
        <button className="secondary">{expenseAmount ? `Nurašyti ${euros(Number(expenseAmount) || 0)} · ${expenseCategory}` : "Nurašyti išlaidą"}</button>
      </form>
      {data.expenses.length > 0 && <div className="ledger">{[...data.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map(x => <div key={x.id}><span>{shortDate(x.date)}</span><span>{x.category}{x.note ? ` · ${x.note}` : ""}</span><b className="negative">−{euros(x.amount)}</b><button type="button" onClick={() => removeExpense(x.id)}>Išimti</button></div>)}</div>}
    </section>}

    {view === "goals" && <section className="goals-view">
      <div className="section-heading"><div><p className="eyebrow">KUR KELIAUJA UŽDARBIS</p><h2>Dėžutės nuo {euros(data.salary)}</h2></div><p>{allocation} % paskirstyta</p></div>
      <p className="intro">Kiekviena dėžutė ima savo dalį. Kreivė rodo, kaip ta dalis auga: 100, tada 200, tada 300. Kai tikslas pilnas arba nori keisti proporcijas, procentą ir tikslą gali pakeisti bet kada.</p>

      {allocation < 100 && <aside className="allocation-alert warning">
        <div className="allocation-alert-content">
          <strong>Laisvas likutis: {unallocatedPercent} % ({euros(data.salary * unallocatedPercent / 100)} / mėn.)</strong>
          <p>Šis likutis lieka laisvas ir nesiunčiamas į jokią dėžutę, kol pats jo nepriskiri.</p>
        </div>
      </aside>}
      {allocation > 100 && <aside className="allocation-alert error">
        <div className="allocation-alert-content">
          <strong>Procentai viršija 100 %: paskirstyta {allocation} % ({Math.round((allocation - 100) * 10) / 10} % per daug)</strong>
          <p>Sumažink kurios nors dėžutės procentą, kad bendra suma nesudarytų daugiau nei 100 %.</p>
        </div>
      </aside>}
      {allocation === 100 && <aside className="allocation-alert ok">
        <p>Paskirstyta tiksliai 100 % ({euros(data.salary)} / mėn.). Kiekviena dalis turi savo paskirtį.</p>
      </aside>}

      <div className="bucket-grid">
        {data.buckets.map(bucket => {
          const monthSlice = data.salary * bucket.percent / 100;
          const pulled = data.pulls.filter(x => x.bucketId === bucket.id).reduce((sum, x) => sum + x.amount, 0);
          const saved = lifetime * bucket.percent / 100 - pulled;
          const reached = bucket.target > 0 && saved >= bucket.target;
          const fill = bucket.target ? Math.min(100, Math.max(0, saved / bucket.target * 100)) : Math.min(100, Math.max(0, bucket.percent));
          const monthsLeft = bucket.target && monthSlice ? bucket.target / monthSlice : 0;
          const spark = days.map(day => day.total * bucket.percent / 100);
          const sparkMax = Math.max(1, ...spark);
          const sparkLine = spark.map((value, i) => `${(i / Math.max(1, days.length - 1)) * 148},${34 - (value / sparkMax) * 26}`).join(" ");

          return <article className={reached ? "bucket reached" : "bucket"} key={bucket.id} style={{ "--bucket": bucket.color } as React.CSSProperties}>
            <div className="bucket-top">
              <span>{bucket.percent} %</span>
              <b>{reached ? "Tikslas pasiektas" : bucket.target ? `~${monthsLeft.toFixed(1)} mėn.` : "be lubų"}</b>
            </div>
            <h3>{bucket.name}</h3>
            <svg className="spark" viewBox="0 0 148 38" aria-hidden="true"><polyline points={sparkLine} /></svg>
            <div className="track"><i style={{ width: `${fill}%` }} /></div>
            <strong>{euros(monthSlice)}</strong>
            <p>{bucket.target ? `${euros(saved)} iš ${euros(bucket.target)}` : `${euros(saved)} sukaupta`}</p>

            <div className="bucket-settings">
              <label>
                <span>Dalis:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={bucket.percent}
                  onChange={e => updateBucket(bucket.id, "percent", e.target.value)}
                />
                <i>%</i>
              </label>
              <label>
                <span>Tikslas:</span>
                <input
                  type="number"
                  min="0"
                  value={bucket.target || ""}
                  placeholder="0 (be lubų)"
                  onChange={e => updateBucket(bucket.id, "target", e.target.value)}
                />
                <i>€</i>
              </label>
            </div>

            <div className="pull">
              <input
                inputMode="decimal"
                value={(drafts[bucket.id] || { amount: "" }).amount}
                onChange={e => setDrafts(d => ({ ...d, [bucket.id]: { amount: e.target.value, note: (d[bucket.id] || { note: "" }).note } }))}
                placeholder="Suma"
              />
              <input
                value={(drafts[bucket.id] || { note: "" }).note}
                onChange={e => setDrafts(d => ({ ...d, [bucket.id]: { amount: (d[bucket.id] || { amount: "" }).amount, note: e.target.value } }))}
                placeholder="Kas tai buvo"
              />
              <button type="button" onClick={() => pullFrom(bucket.id)}>Išimti</button>
            </div>

            <div className="reallocate">
              <input
                type="number"
                min="1"
                max={bucket.percent}
                value={reallocDrafts[bucket.id]?.amount ?? ""}
                placeholder="%"
                aria-label={`Perkelti % iš ${bucket.name}`}
                onChange={e => setReallocDrafts(prev => ({
                  ...prev,
                  [bucket.id]: {
                    amount: e.target.value,
                    to: prev[bucket.id]?.to || data.buckets.find(b => b.id !== bucket.id)?.id || "save"
                  }
                }))}
              />
              <select
                value={reallocDrafts[bucket.id]?.to || data.buckets.find(b => b.id !== bucket.id)?.id || "save"}
                aria-label={`Kur perkelti % iš ${bucket.name}`}
                onChange={e => setReallocDrafts(prev => ({
                  ...prev,
                  [bucket.id]: {
                    amount: prev[bucket.id]?.amount ?? "",
                    to: e.target.value
                  }
                }))}
              >
                {data.buckets.filter(x => x.id !== bucket.id).map(x => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => movePercent(bucket.id)}>Perkelti</button>
            </div>

            {editing && <div className="bucket-edit">
              <label>Pavadinimas:
                <input value={bucket.name} onChange={e => updateBucket(bucket.id, "name", e.target.value)} />
              </label>
            </div>}
          </article>;
        })}
      </div>

      <section className="goal-total">
        <div className="section-heading"><div><p className="eyebrow">VISI TIKSLAI</p><h2>{Math.round(goalPct)} %</h2></div><b>{euros(goalSaved)} iš {euros(goalTarget)}</b></div>
        <div className="scale"><i style={{ width: `${goalPct}%` }} /></div>
        <div className="scale-labels"><span>0 %</span><span>liko {euros(Math.max(0, goalTarget - goalSaved))}</span><span>100 %</span></div>
      </section>
    </section>}

    <footer><span>Apskaičiuota nėra tas pats, kas gauta.</span><button onClick={async () => { await fetch("/api/logout", { method: "POST" }); setLocked(true); }}>Užrakinti</button></footer>
  </main>;
}
