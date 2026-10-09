"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Bucket = { id: string; name: string; percent: number; color: string };
type Entry = { id: string; date: string; amount: number; note: string };
type Expense = { id: string; date: string; category: string; amount: number };
type Data = { salary: number; workDays: number; buckets: Bucket[]; entries: Entry[]; expenses: Expense[] };

const STORAGE = "finances-os-v1";
const initial: Data = {
  salary: 2300,
  workDays: 5,
  buckets: [
    { id: "car", name: "Mašina", percent: 20, color: "#ff5277" },
    { id: "save", name: "Taupymas", percent: 30, color: "#6547ff" },
    { id: "debt", name: "Skolos", percent: 25, color: "#ffad43" },
    { id: "food", name: "Maistas", percent: 15, color: "#00c9a7" }
  ],
  entries: [], expenses: []
};

const euros = (n: number) => new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const isoToday = () => new Date().toISOString().slice(0, 10);
const shortDate = (s: string) => new Intl.DateTimeFormat("lt-LT", { day: "numeric", month: "short" }).format(new Date(`${s}T12:00:00`));

export default function Home() {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [data, setData] = useState<Data>(initial);
  const [view, setView] = useState<"overview" | "chart" | "goals">("overview");
  const [editing, setEditing] = useState(false);
  const [income, setIncome] = useState("50");
  const [incomeNote, setIncomeNote] = useState("Darbo diena");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Maistas");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) setData(JSON.parse(saved));
      fetch("/api/session").then(response => setLocked(!response.ok)).catch(() => setLocked(true));
    } catch { /* start safely with defaults */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE, JSON.stringify(data)); }, [data, ready]);

  const today = isoToday();
  const monthPrefix = today.slice(0, 7);
  const monthEntries = data.entries.filter(x => x.date.startsWith(monthPrefix));
  const monthExpenses = data.expenses.filter(x => x.date.startsWith(monthPrefix));
  const earned = monthEntries.reduce((sum, x) => sum + x.amount, 0);
  const spent = monthExpenses.reduce((sum, x) => sum + x.amount, 0);
  const net = earned - spent;
  const dailyRate = data.salary / (4.333 * data.workDays);
  const allocation = data.buckets.reduce((sum, x) => sum + x.percent, 0);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const date = new Date(); date.setDate(date.getDate() - 13 + i);
    const key = date.toISOString().slice(0, 10);
    const entry = data.entries.find(x => x.date === key);
    return { key, label: new Intl.DateTimeFormat("lt-LT", { weekday: "short" }).format(date).replace(".", ""), amount: entry?.amount ?? 0, worked: !!entry };
  }), [data.entries]);
  const maxDay = Math.max(100, ...days.map(x => x.amount));

  async function unlock(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    if (response.ok) { setLocked(false); setPasswordError(false); setPassword(""); }
    else { setPasswordError(true); setPassword(""); }
  }
  function addIncome(event: FormEvent) {
    event.preventDefault(); const amount = Number(income);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setData(d => ({ ...d, entries: [...d.entries.filter(x => x.date !== today), { id: crypto.randomUUID(), date: today, amount, note: incomeNote || "Darbo diena" }] }));
  }
  function addExpense(event: FormEvent) {
    event.preventDefault(); const amount = Number(expenseAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setData(d => ({ ...d, expenses: [...d.expenses, { id: crypto.randomUUID(), date: today, category: expenseCategory, amount }] }));
    setExpenseAmount("");
  }
  function updateBucket(id: string, key: "name" | "percent", value: string) {
    setData(d => ({ ...d, buckets: d.buckets.map(b => b.id === id ? { ...b, [key]: key === "percent" ? Math.max(0, Number(value) || 0) : value } : b) }));
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `finansai-${today}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { setData(JSON.parse(String(reader.result))); } catch { alert("Nepavyko perskaityti failo."); } }; reader.readAsText(file);
  }
  if (!ready) return null;
  if (locked) return <main className="lock-screen"><div className="lock-card"><p className="eyebrow">FINANSŲ OS / PRIVATE</p><h1>Tavo pinigų<br/><i>judėjimas.</i></h1><p>Trumpas kasdienis signalas, kad darbas virsta laisve.</p><form onSubmit={unlock}><input aria-label="Slaptažodis" autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Slaptažodis"/><button>Atrakinti <span>→</span></button></form>{passwordError && <small>Neteisingas slaptažodis.</small>}</div></main>;

  return <main className="app-shell">
    <header><a className="logo" href="#top">FINANSŲ<span>OS</span></a><div className="header-actions"><span className="date">{new Intl.DateTimeFormat("lt-LT", { month: "long", year: "numeric" }).format(new Date())}</span><button className="icon-button" onClick={() => setEditing(!editing)} aria-label="Atidaryti redagavimą">{editing ? "×" : "⚙"}</button></div></header>
    <section className="hero" id="top"><div><p className="eyebrow">ŠIO MĖNESIO REZULTATAS</p><h1>{euros(net)}</h1><p className="subcopy">{earned ? `${euros(earned)} uždirbta · ${euros(spent)} išleista` : "Įrašyk šiandienos uždarbį ir pradėk matyti progresą."}</p></div><div className="pulse"><b>{earned ? Math.round((earned / data.salary) * 100) : 0}%</b><span>mėnesio algos</span></div></section>
    <nav className="view-switcher"><button className={view === "overview" ? "selected" : ""} onClick={() => setView("overview")}>Apžvalga</button><button className={view === "chart" ? "selected" : ""} onClick={() => setView("chart")}>Ritmas</button><button className={view === "goals" ? "selected" : ""} onClick={() => setView("goals")}>Dėžutės</button></nav>
    {editing && <aside className="editor"><div><p className="eyebrow">REDAGAVIMAS</p><h2>Greitas įrašas</h2></div><form onSubmit={addIncome} className="entry-form"><label>Šiandien uždirbau<input inputMode="decimal" value={income} onChange={e => setIncome(e.target.value)} /></label><label>Pastaba<input value={incomeNote} onChange={e => setIncomeNote(e.target.value)} /></label><button className="primary">Įrašyti +</button></form><form onSubmit={addExpense} className="entry-form expense-form"><label>Išlaida<input inputMode="decimal" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="0" /></label><label>Kategorija<select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>{["Maistas", "Kelionės", "Nuotykiai", "Kita"].map(x => <option key={x}>{x}</option>)}</select></label><button className="secondary">Pridėti išlaidą</button></form><div className="backup"><button onClick={exportData}>Eksportuoti duomenis</button><label>Importuoti<input type="file" accept="application/json" onChange={importData} /></label></div></aside>}
    {view === "overview" && <section className="overview-grid"><article className="metric-card neon-blue"><p>PLANO DIENA</p><strong>{euros(dailyRate)}</strong><small>pagal {data.workDays} d. savaitę</small></article><article className="metric-card neon-yellow"><p>ŠIANDIEN</p><strong>{euros(data.entries.find(x => x.date === today)?.amount ?? 0)}</strong><small>{data.entries.find(x => x.date === today) ? "užregistruota" : "dar neįrašyta"}</small></article><article className="metric-card neon-pink"><p>LIKĘ IKI ALGOS</p><strong>{euros(Math.max(0, data.salary - earned))}</strong><small>ne prognozė, o tavo tikslas</small></article><section className="quick-work"><div><p className="eyebrow">DARBO REŽIMAS</p><h2>Vienas įrašas.<br/>Matomas <i>poveikis.</i></h2></div><form onSubmit={addIncome}><input aria-label="Dienos uždarbis" inputMode="decimal" value={income} onChange={e => setIncome(e.target.value)} /><span>€</span><button>Pridėti šiandien</button></form><p className="hint">Savaitgaliai automatiškai neskaičiuojami į plano dienos sumą.</p></section><section className="recent"><div className="section-heading"><div><p className="eyebrow">PASKUTINIAI ĮRAŠAI</p><h2>Tavo tempas</h2></div><button onClick={() => setView("chart")}>Visas ritmas →</button></div>{monthEntries.length ? <div className="entry-list">{[...monthEntries].reverse().slice(0, 5).map(x => <div key={x.id}><span>{shortDate(x.date)}</span><span>{x.note}</span><b>+{euros(x.amount)}</b></div>)}</div> : <p className="empty">Čia atsiras tavo realiai uždirbtos darbo dienos.</p>}</section></section>}
    {view === "chart" && <section className="chart-view"><div className="section-heading"><div><p className="eyebrow">PASKUTINĖS 14 DIENŲ</p><h2>Darbo ritmas</h2></div><p>{euros(earned)} šį mėnesį</p></div><div className="bar-chart">{days.map(day => <div className="bar-unit" key={day.key}><div className="bar" style={{ height: `${day.amount ? Math.max(10, day.amount / maxDay * 100) : 2}%` }}><span>{day.amount ? `${day.amount}€` : ""}</span></div><small>{day.label}</small></div>)}</div><div className="chart-legend"><span><i></i> Užregistruota diena</span><span>Tuščia diena = poilsis arba dar neįvesta</span></div><section className="spending"><div className="section-heading"><div><p className="eyebrow">IŠLAIDOS</p><h2>Kur išėjo pinigai</h2></div><b>{euros(spent)}</b></div>{monthExpenses.length ? <div className="entry-list">{[...monthExpenses].reverse().map(x => <div key={x.id}><span>{shortDate(x.date)}</span><span>{x.category}</span><b className="negative">−{euros(x.amount)}</b></div>)}</div> : <p className="empty">Išlaidos dar neįrašytos. Jas pridėk per ⚙.</p>}</section></section>}
    {view === "goals" && <section className="goals-view"><div className="section-heading"><div><p className="eyebrow">KUR KELIAUJA UŽDARBIS</p><h2>Tavo dėžutės</h2></div><p>{allocation}% paskirstyta</p></div><p className="intro">Kiekviena uždirbta diena iškart pripildo tavo dėžutes. Procentus gali pakeisti per nustatymus.</p><div className="bucket-grid">{data.buckets.map((bucket, index) => { const amount = earned * bucket.percent / 100; const monthTarget = data.salary * bucket.percent / 100; const fill = Math.min(100, amount / Math.max(1, monthTarget) * 100); return <article className="bucket" key={bucket.id} style={{ "--bucket": bucket.color } as React.CSSProperties}><div className="bucket-top"><span>0{index + 1}</span><b>{bucket.percent}%</b></div><h3>{bucket.name}</h3><div className="bucket-window"><div className="money-fill" style={{ height: `${fill}%` }}><i>✦</i><i>✦</i><i>✦</i></div><strong>{euros(amount)}</strong></div><p>{euros(monthTarget)} šio mėnesio dalis</p>{editing && <div className="bucket-edit"><input value={bucket.name} onChange={e => updateBucket(bucket.id, "name", e.target.value)} /><input type="number" value={bucket.percent} onChange={e => updateBucket(bucket.id, "percent", e.target.value)} /><span>%</span></div>}</article>; })}</div>{allocation !== 100 && <p className="allocation-note">Nepaskirstyta: {100 - allocation}% · {euros(earned * (100 - allocation) / 100)}</p>}</section>}
    <footer><span>Padaryta tavo darbui matomą.</span><button onClick={async () => { await fetch("/api/logout", { method: "POST" }); setLocked(true); }}>Užrakinti</button></footer>
  </main>;
}
