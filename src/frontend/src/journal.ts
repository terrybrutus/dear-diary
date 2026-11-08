export type Trade = {
  id: string;
  date: string;
  symbol: string;
  side: "Long" | "Short";
  pnl: number;
  risk: number;
  setup: string;
  notes: string;
};
export type Entry = {
  id: string;
  date: string;
  title: string;
  text: string;
  mood: string;
  tags: string;
};
export type Journal = {
  version: 1;
  trades: Trade[];
  entries: Entry[];
  plays: { id: string; name: string; rules: string }[];
  tags: string[];
  goals: { id: string; name: string; target: number; current: number }[];
  name: string;
  currency: string;
};
export const KEY = "dear-diary-v1";
export const emptyJournal = (): Journal => ({
  version: 1,
  trades: [],
  entries: [],
  plays: [],
  tags: [],
  goals: [],
  name: "Trader",
  currency: "USD",
});
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function validDate(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    dateKey(new Date(`${s}T12:00:00`)) === s
  );
}
export function parseJournal(raw: string): Journal {
  const d = JSON.parse(raw),
    str = (v: unknown) => typeof v === "string",
    num = (v: unknown) => typeof v === "number" && Number.isFinite(v),
    ids = (a: { id: string }[]) =>
      new Set(a.map((x) => x.id)).size === a.length;
  if (
    !d ||
    d.version !== 1 ||
    !str(d.name) ||
    !["USD", "EUR", "GBP", "CAD", "AUD"].includes(d.currency) ||
    !Array.isArray(d.trades) ||
    !d.trades.every(
      (t) =>
        str(t.id) &&
        validDate(t.date) &&
        str(t.symbol) &&
        ["Long", "Short"].includes(t.side) &&
        num(t.pnl) &&
        num(t.risk) &&
        t.risk >= 0 &&
        str(t.setup) &&
        str(t.notes),
    ) ||
    !Array.isArray(d.entries) ||
    !d.entries.every(
      (e) =>
        str(e.id) &&
        validDate(e.date) &&
        str(e.title) &&
        str(e.text) &&
        str(e.mood) &&
        str(e.tags),
    ) ||
    !Array.isArray(d.plays) ||
    !d.plays.every((p) => str(p.id) && str(p.name) && str(p.rules)) ||
    !Array.isArray(d.tags) ||
    !d.tags.every(str) ||
    !Array.isArray(d.goals) ||
    !d.goals.every(
      (g) =>
        str(g.id) &&
        str(g.name) &&
        num(g.target) &&
        g.target > 0 &&
        num(g.current) &&
        g.current >= 0,
    ) ||
    ![d.trades, d.entries, d.plays, d.goals].every(ids)
  )
    throw new Error("Invalid Dear Diary v1 backup. Your data has not changed.");
  return d;
}
export function stats(trades: Trade[]) {
  const net = trades.reduce((n, t) => n + t.pnl, 0),
    wins = trades.filter((t) => t.pnl > 0),
    losses = trades.filter((t) => t.pnl < 0),
    risk = trades.filter((t) => t.risk > 0);
  return {
    net,
    count: trades.length,
    wins: wins.length,
    days: new Set(trades.map((t) => t.date)).size,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    avgR: risk.length
      ? risk.reduce((n, t) => n + t.pnl / t.risk, 0) / risk.length
      : null,
    profitFactor: losses.length
      ? wins.reduce((n, t) => n + t.pnl, 0) /
        Math.abs(losses.reduce((n, t) => n + t.pnl, 0))
      : null,
  };
}
export function streak(entries: Entry[], today = dateKey()) {
  const days = new Set(entries.map((e) => e.date));
  let d = new Date(`${today}T12:00:00`),
    n = 0;
  if (!days.has(dateKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dateKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
export function demoJournal(): Journal {
  const d = emptyJournal(),
    m = dateKey().slice(0, 7);
  d.trades = [
    {
      id: "demo1",
      date: `${m}-04`,
      symbol: "NQ",
      side: "Long",
      pnl: 1683.2,
      risk: 500,
      setup: "Opening range breakout",
      notes: "Waited for the retest. Followed the plan.",
    },
    {
      id: "demo2",
      date: `${m}-05`,
      symbol: "ES",
      side: "Short",
      pnl: -3471.5,
      risk: 1000,
      setup: "Reversal",
      notes: "Added to a loser. Review risk discipline.",
    },
    {
      id: "demo3",
      date: `${m}-06`,
      symbol: "NQ",
      side: "Long",
      pnl: 275.5,
      risk: 300,
      setup: "Opening range breakout",
      notes: "Reduced size. Focused on execution.",
    },
  ];
  d.entries = [
    {
      id: "e1",
      date: `${m}-04`,
      title: "Patience paid off",
      text: "I waited for the opening range to settle and took the retest. Clear head, clean execution.",
      mood: "Focused",
      tags: "Patient, A+ setup",
    },
    {
      id: "e2",
      date: `${m}-05`,
      title: "A lesson in risk",
      text: "I traded frustrated and added to a loser. Tomorrow: one planned entry, fixed risk, no exceptions.",
      mood: "Frustrated",
      tags: "Overtrading",
    },
    {
      id: "e3",
      date: `${m}-06`,
      title: "Back to the process",
      text: "A smaller green day. Respected my stop and walked away after my planned session.",
      mood: "Calm",
      tags: "Patient",
    },
  ];
  d.tags = ["Patient", "A+ setup", "Overtrading"];
  d.plays = [
    {
      id: "p1",
      name: "Opening range breakout",
      rules:
        "Mark the first 15-minute range.\nWait for a close outside and a retest.\nDefine the stop before entering.",
    },
  ];
  return d;
}
export function localSearch(d: Journal, query: string) {
  const q = query.toLowerCase(),
    loss = /loss|losing|red/.test(q),
    win = /win|profit|green/.test(q),
    words = q
      .replace(/[^a-z0-9 -]/g, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 &&
          ![
            "show",
            "find",
            "take",
            "where",
            "days",
            "with",
            "that",
            "have",
            "when",
            "were",
            "what",
            "about",
            "trades",
            "journal",
            "entries",
            "please",
            "the",
            "and",
            "did",
            "how",
            "all",
            "felt",
          ].includes(w),
      );
  return [
    ...new Set([
      ...d.entries.map((e) => e.date),
      ...d.trades.map((t) => t.date),
    ]),
  ]
    .sort()
    .reverse()
    .filter((date) => {
      const ts = d.trades.filter((t) => t.date === date),
        net = stats(ts).net,
        text = JSON.stringify([
          ...ts,
          ...d.entries.filter((e) => e.date === date),
        ]).toLowerCase();
      return loss
        ? net < 0
        : win
          ? net > 0
          : words.length
            ? words.some((w) => text.includes(w))
            : true;
    });
}
