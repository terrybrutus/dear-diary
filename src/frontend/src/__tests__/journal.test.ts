import { describe, it, expect } from "vitest";
import {
  emptyJournal,
  parseJournal,
  stats,
  streak,
  localSearch,
  type Trade,
} from "../journal";
const t = (pnl: number, risk = 100, date = "2026-11-04"): Trade => ({
  id: String(pnl),
  date,
  symbol: "NQ",
  side: "Long",
  pnl,
  risk,
  setup: "Breakout",
  notes: "",
});
describe("Journal calculations and backup safety", () => {
  it("counts breakeven trades in the win-rate denominator, excludes undefined risk from average R, and groups sessions", () => {
    const s = stats([t(200), t(-100), t(0, 0), t(50, 0, "2026-11-05")]);
    expect(s.net).toBe(150);
    expect(s.winRate).toBe(50);
    expect(s.avgR).toBe(0.5);
    expect(s.days).toBe(2);
    expect(s.profitFactor).toBe(2.5);
  });
  it("leaves unavailable ratios undefined instead of dividing by zero", () => {
    expect(stats([]).avgR).toBeNull();
    expect(stats([t(10, 0)]).profitFactor).toBeNull();
  });
  it("rejects malformed backups and impossible dates before replacing data", () => {
    const d = emptyJournal();
    expect(parseJournal(JSON.stringify(d))).toEqual(d);
    expect(() =>
      parseJournal(
        JSON.stringify({ ...d, trades: [t(20, 100, "2026-02-30")] }),
      ),
    ).toThrow();
    expect(() =>
      parseJournal(JSON.stringify({ ...d, trades: [t(20), t(20)] })),
    ).toThrow();
    expect(() => parseJournal('{"version":1}')).toThrow();
  });
  it("counts consecutive calendar dates across month boundaries, using yesterday when today is blank", () => {
    const entries = ["2026-10-31", "2026-11-01"].map((date) => ({
      id: date,
      date,
      title: "Reflection",
      text: "x",
      mood: "Calm",
      tags: "",
    }));
    expect(streak(entries, "2026-11-02")).toBe(2);
    expect(streak(entries, "2026-11-03")).toBe(0);
  });
  it("searches dated journal text and trade results without inventing matches", () => {
    const d = emptyJournal();
    d.trades = [t(-100), t(200, 100, "2026-11-05")];
    d.entries = [
      {
        id: "e",
        date: "2026-11-03",
        title: "Patience",
        text: "I felt frustrated",
        mood: "Frustrated",
        tags: "FOMO",
      },
    ];
    expect(localSearch(d, "Show my losing days")).toEqual(["2026-11-04"]);
    expect(localSearch(d, "Find days where I felt frustrated")).toEqual([
      "2026-11-03",
    ]);
    expect(localSearch(d, "AAPL")).toEqual([]);
  });
});
