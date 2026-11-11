import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  Flame,
  Home,
  Menu,
  MessageCircle,
  Moon,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Sun,
  Tags,
  Target,
  Trash2,
  TrendingUp,
  X,
  CandlestickChart,
  PanelLeftClose,
  Paperclip,
  Mic,
} from "lucide-react";
import { DayMedia, MediaLibrary } from "./components/DayMedia";
import {
  listMedia,
  subscribeMedia,
  downloadBlob,
  restoreMediaAndJournal,
  type MediaRecord,
} from "./media-store";
import { createJournalBackup, readJournalBackup } from "./media-backup";
import {
  KEY,
  emptyJournal,
  parseJournal,
  dateKey,
  stats,
  streak,
  demoJournal,
  localSearch,
  type Journal,
  type Entry,
  type Trade,
} from "./journal";
const nav = [
  ["Dashboard", Home],
  ["Calendar Journal", CalendarDays],
  ["Trades", CandlestickChart],
  ["Analytics", BarChart3],
  ["AI Insights", Sparkles],
  ["Playbook", BookOpen],
  ["Tags & Setups", Tags],
  ["Reports", FileText],
  ["Goals", Target],
  ["Media Library", Paperclip],
  ["Import / Sync", ArrowUpFromLine],
  ["Settings", Settings],
] as const;
const uid = () => crypto.randomUUID(),
  pretty = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
function download(name: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return { data: raw ? parseJournal(raw) : emptyJournal(), error: "" };
    } catch {
      return {
        data: emptyJournal(),
        error:
          "Saved data could not be read. Download recovery data in Import / Sync before saving.",
      };
    }
  });
  const [data, setData] = useState<Journal>(initial.data),
    [page, setPage] = useState("Calendar Journal"),
    [month, setMonth] = useState(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    [day, setDay] = useState<string | null>(null),
    [mode, setMode] = useState<"journal" | "trade">("journal"),
    [editing, setEditing] = useState<Entry | Trade | null>(null),
    [notice, setNotice] = useState(initial.error),
    [blocked, setBlocked] = useState(!!initial.error),
    [collapsed, setCollapsed] = useState(false),
    [dark, setDark] = useState(
      () => localStorage.getItem("diary-theme") === "dark",
    ),
    [chat, setChat] = useState(false),
    [messages, setMessages] = useState<
      { role: string; text: string; dates?: string[] }[]
    >([]),
    [busy, setBusy] = useState(false),
    [aiReady, setAiReady] = useState(false),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState("");
  const [media, setMedia] = useState<MediaRecord[]>([]),
    [mediaError, setMediaError] = useState(""),
    [captureBusy, setCaptureBusy] = useState(false),
    [backupBusy, setBackupBusy] = useState(false);
  const reflectionField = useRef<HTMLTextAreaElement>(null),
    titleField = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null),
    chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      listMedia()
        .then((records) => {
          if (live) {
            setMedia(records);
            setMediaError("");
          }
        })
        .catch((error) => {
          if (live) setMediaError(error.message);
        });
    };
    refresh();
    const unsubscribe = subscribeMedia(refresh);
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("diary-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setAiReady(!!s?.configured))
      .catch(() => {});
  }, []);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);
  useEffect(() => {
    if (!day) return;
    const drawer = document.querySelector<HTMLElement>(".day-drawer"),
      background = [
        ...document.querySelectorAll<HTMLElement>(
          ".sidebar,main,.assistant-launcher,.chat",
        ),
      ],
      overflow = document.body.style.overflow;
    for (const el of background) el.inert = true;
    document.body.style.overflow = "hidden";
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !drawer) return;
      const controls = [
          ...drawer.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,textarea,[tabindex="0"]',
          ),
        ],
        first = controls[0],
        last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      for (const el of background) el.inert = false;
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", trap);
    };
  }, [day]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!captureBusy) setDay(null);
        setChat(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [captureBusy]);
  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === KEY) {
        setBlocked(true);
        setNotice(
          "Journal changed in another tab. Reload before saving to avoid overwriting changes.",
        );
      }
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);
  function persist(next: Journal) {
    if (blocked) {
      setNotice("Saving paused. Export recovery data and reload first.");
      return false;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setData(next);
      return true;
    } catch {
      setNotice(
        "Could not save in this browser. Export a backup before closing.",
      );
      return false;
    }
  }
  const prefix = dateKey(month).slice(0, 7),
    monthly = data.trades.filter((t) => t.date.startsWith(prefix)),
    entries = data.entries.filter((e) => e.date.startsWith(prefix)),
    s = stats(monthly),
    total = stats(data.trades),
    monthTitle = month.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  const money = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: data.currency,
      maximumFractionDigits: 2,
    }).format(n);
  function openDay(date: string, tab: "journal" | "trade" = "journal") {
    setEditing(null);
    setMode(tab);
    setDay(date);
  }
  function remove(kind: "entries" | "trades" | "plays" | "goals", id: string) {
    if (confirm("Delete this record? This cannot be undone."))
      persist({ ...data, [kind]: data[kind].filter((x) => x.id !== id) });
  }
  function saveDay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      date = String(f.get("date"));
    if (!day) return;
    if (mode === "journal") {
      const item: Entry = {
        id: editing?.id || uid(),
        date,
        title: String(f.get("title")).trim(),
        text: String(f.get("text")).trim(),
        mood: String(f.get("mood")),
        tags: String(f.get("tags")),
      };
      if (
        persist({
          ...data,
          entries: [...data.entries.filter((x) => x.id !== item.id), item],
        })
      ) {
        setEditing(null);
        e.currentTarget.reset();
        setNotice("Journal entry saved.");
      }
    } else {
      const item: Trade = {
        id: editing?.id || uid(),
        date,
        symbol: String(f.get("symbol")).trim().toUpperCase(),
        side: f.get("side") as Trade["side"],
        pnl: Number(f.get("pnl")),
        risk: Number(f.get("risk")),
        setup: String(f.get("setup")),
        notes: String(f.get("notes")),
      };
      if (
        persist({
          ...data,
          trades: [...data.trades.filter((x) => x.id !== item.id), item],
        })
      ) {
        setEditing(null);
        e.currentTarget.reset();
        setNotice("Trade saved.");
      }
    }
  }
  async function ask(e?: FormEvent, suggestion?: string) {
    e?.preventDefault();
    const q = (suggestion || query).trim();
    if (!q || busy) return;
    setQuery("");
    const dates = localSearch(data, q),
      next = [...messages, { role: "user", text: q }];
    setMessages(next);
    setBusy(true);
    if (aiReady) {
      try {
        const r = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: q,
              history: next.slice(-10),
              journal: data,
            }),
          }),
          result = await r.json();
        if (!r.ok) throw new Error(result.error || "Request failed");
        setMessages([
          ...next,
          {
            role: "assistant",
            text: result.text,
            dates: result.dates || dates.slice(0, 8),
          },
        ]);
      } catch (err) {
        setMessages([
          ...next,
          {
            role: "assistant",
            text: `Claude could not respond: ${(err as Error).message}. Local matching records are below.`,
            dates: dates.slice(0, 12),
          },
        ]);
      }
    } else
      setMessages([
        ...next,
        {
          role: "assistant",
          text: dates.length
            ? `Local search found ${dates.length} matching day${dates.length === 1 ? "" : "s"}. Open a day below to review the original records. This is record search, not a Claude response.`
            : "No matching records. Try a symbol, emotion, setup, date, winning days, or losing days. Connect Claude in Settings for conversational analysis.",
          dates: dates.slice(0, 12),
        },
      ]);
    setBusy(false);
  }
  async function backup() {
    if (captureBusy) {
      setNotice("Stop and save your recording before exporting a backup.");
      return false;
    }
    setBackupBusy(true);
    try {
      const archive = await createJournalBackup(data);
      downloadBlob(`dear-diary-${dateKey()}-${Date.now()}.zip`, archive);
      setNotice(
        "Journal + media backup downloaded. Keep it somewhere private.",
      );
      return true;
    } catch (error) {
      setNotice(`Backup failed: ${(error as Error).message}`);
      return false;
    } finally {
      setBackupBusy(false);
    }
  }
  function useTranscript(text: string) {
    const field = reflectionField.current,
      title = titleField.current;
    if (field) {
      field.value = [field.value.trim(), text.trim()]
        .filter(Boolean)
        .join("\n\n");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (title && !title.value.trim()) title.value = `Voice reflection · ${day}`;
    setNotice(
      "Transcript added to your reflection draft. Review it, then save the entry.",
    );
  }
  async function importBackup(f: File) {
    try {
      if (blocked)
        throw new Error(
          "Reload this page before restoring a backup. Saving is paused.",
        );
      const incoming = await readJournalBackup(f);
      if (
        confirm(
          `Restore ${incoming.journal.trades.length} trades, ${incoming.journal.entries.length} entries${incoming.media ? ` and ${incoming.media.length} media files (replacing this media library)` : "; this older JSON backup leaves existing media unchanged"}? Your current journal and media will download first.`,
        )
      ) {
        if (!(await backup())) return;
        if (incoming.media) {
          await restoreMediaAndJournal(
            incoming.media,
            JSON.stringify(incoming.journal),
            KEY,
          );
          setData(incoming.journal);
          setNotice("Journal and original media restored.");
        } else if (persist(incoming.journal))
          setNotice("Journal restored. Existing media files were kept.");
      }
    } catch (e) {
      setNotice((e as Error).message);
    }
    if (file.current) file.current.value = "";
  }
  function tradeTable(trades: Trade[]) {
    return trades.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol / side</th>
              <th>Setup</th>
              <th>Net P/L</th>
              <th>R multiple</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id}>
                <td>
                  <button
                    className="text-btn"
                    onClick={() => openDay(t.date, "trade")}
                  >
                    {pretty(t.date)}
                  </button>
                </td>
                <td>
                  <b>{t.symbol}</b> <span className="muted">{t.side}</span>
                </td>
                <td>{t.setup || "—"}</td>
                <td className={t.pnl < 0 ? "negative" : "positive"}>
                  {money(t.pnl)}
                </td>
                <td>{t.risk ? (t.pnl / t.risk).toFixed(2) : "—"}</td>
                <td>
                  <button
                    aria-label={`Edit ${t.symbol} trade`}
                    className="icon-btn"
                    onClick={() => {
                      setDay(t.date);
                      setMode("trade");
                      setEditing(t);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    aria-label={`Delete ${t.symbol} trade`}
                    className="icon-btn"
                    onClick={() => remove("trades", t.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="Your trading story starts here"
        text="Log your first trade to see performance, setups, and patterns come into focus."
        action="Log a trade"
        onClick={() => openDay(dateKey(), "trade")}
      />
    );
  }
  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <BookOpen size={23} />
          </div>
          {!collapsed && (
            <div className="brand-copy">
              <b>
                Dear Diary<span>®</span>
              </b>
              <small>YOUR TRADING, IN PERSPECTIVE</small>
            </div>
          )}
          <button
            className="icon-btn collapse"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <Menu size={18} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <button
          className="primary new-entry"
          aria-label="New journal entry"
          onClick={() => openDay(dateKey())}
        >
          <Plus size={19} />
          {!collapsed && <span>New journal entry</span>}
        </button>
        <div className="nav-label">{!collapsed && "WORKSPACE"}</div>
        <nav aria-label="Main navigation">
          {nav.map(([label, Icon], i) => (
            <button
              key={label}
              title={label}
              className={`nav-item ${page === label ? "active" : ""} ${i === 9 ? "nav-separated" : ""}`}
              onClick={() => {
                setPage(label);
                setSearch("");
              }}
            >
              <Icon size={19} />
              {!collapsed && (
                <>
                  <span>{label}</span>
                  {label === "Calendar Journal" && <span className="nav-dot" />}
                </>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            aria-label="Toggle dark mode"
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}{" "}
            {!collapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
          </button>
          {!collapsed && (
            <div className="profile">
              <span className="avatar">
                {data.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <b>{data.name}</b>
                <small>
                  <i /> Local workspace
                </small>
              </div>
              <button
                className="icon-btn"
                aria-label="Open settings"
                onClick={() => setPage("Settings")}
              >
                <Settings size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <span>{page}</span>
          </div>
          <div className="top-actions">
            <span className="local-badge">
              <i />
              {blocked ? "Saving paused" : "Local browser storage"}
            </span>
            <button
              className="icon-btn"
              aria-label="Open help"
              onClick={() => setPage("Import / Sync")}
            >
              <CircleHelp size={19} />
            </button>
            <span className="mini-avatar">
              {data.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">REFLECT. REFINE. REPEAT.</div>
              <h1>{page}</h1>
              <p>
                {page === "Calendar Journal"
                  ? "Every session tells a story. Make yours worth learning from."
                  : page === "Dashboard"
                    ? "A little perspective on your progress."
                    : page === "AI Insights"
                      ? "Turn your trading history into your next lesson."
                      : "A clearer process. A more intentional trader."}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="secondary"
                onClick={backup}
                disabled={backupBusy}
              >
                <ArrowDownToLine size={16} />{" "}
                {backupBusy ? "Preparing backup…" : "Export journal"}
              </button>
              <button
                className="primary"
                onClick={() => openDay(dateKey(), "trade")}
              >
                <Plus size={17} />
                <span>Log trade</span>
              </button>
            </div>
          </div>
          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button
                className="icon-btn"
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {["Calendar Journal", "Dashboard", "Analytics", "Reports"].includes(
            page,
          ) && (
            <div className="metrics">
              <div className="metric">
                <span>
                  <TrendingUp size={15} /> Net P/L
                </span>
                <strong
                  className={
                    s.net < 0 ? "negative" : s.net > 0 ? "positive" : ""
                  }
                >
                  {money(s.net)}
                </strong>
                <small>After fees · {monthTitle}</small>
              </div>
              <div className="metric">
                <span>
                  <Target size={15} /> Win rate
                </span>
                <strong>{s.count ? `${s.winRate.toFixed(0)}%` : "—"}</strong>
                <small>
                  {s.wins} wins / {s.count} trades
                </small>
              </div>
              <div className="metric">
                <span>
                  <CalendarDays size={15} /> Trading days
                </span>
                <strong>
                  {s.days}
                  <em> days</em>
                </strong>
                <small>
                  {entries.length} journal{" "}
                  {entries.length === 1 ? "entry" : "entries"}
                </small>
              </div>
              <div className="metric">
                <span>
                  <BarChart3 size={15} /> Average R
                </span>
                <strong
                  className={s.avgR !== null && s.avgR > 0 ? "positive" : ""}
                >
                  {s.avgR === null
                    ? "—"
                    : `${s.avgR > 0 ? "+" : ""}${s.avgR.toFixed(2)}R`}
                </strong>
                <small>Trades with defined risk</small>
              </div>
              <div className="metric">
                <span>
                  <Flame size={15} /> Journal streak
                </span>
                <strong>
                  {streak(data.entries)}
                  <em> days</em>
                </strong>
                <small>Through today or yesterday</small>
              </div>
            </div>
          )}
          {page === "Calendar Journal" && (
            <>
              <section className="calendar-panel">
                <div className="calendar-toolbar">
                  <div className="month-nav">
                    <button
                      className="icon-btn"
                      aria-label="Previous month"
                      onClick={() =>
                        setMonth(
                          new Date(
                            month.getFullYear(),
                            month.getMonth() - 1,
                            1,
                          ),
                        )
                      }
                    >
                      <ChevronLeft size={19} />
                    </button>
                    <h2>{monthTitle}</h2>
                    <button
                      className="icon-btn"
                      aria-label="Next month"
                      onClick={() =>
                        setMonth(
                          new Date(
                            month.getFullYear(),
                            month.getMonth() + 1,
                            1,
                          ),
                        )
                      }
                    >
                      <ChevronRight size={19} />
                    </button>
                    <button
                      className="secondary today"
                      onClick={() =>
                        setMonth(
                          new Date(
                            new Date().getFullYear(),
                            new Date().getMonth(),
                            1,
                          ),
                        )
                      }
                    >
                      Today
                    </button>
                  </div>
                  <div className="calendar-key">
                    <span>
                      <i className="green-dot" /> Profit
                    </span>
                    <span>
                      <i className="red-dot" /> Loss
                    </span>
                    <span>
                      <Pencil size={12} /> Journal entry
                    </span>
                  </div>
                </div>
                <div className="calendar-scroll">
                  <div className="calendar">
                    <div className="weekdays">
                      {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(
                        (x) => (
                          <div key={x}>{x}</div>
                        ),
                      )}
                    </div>
                    <div className="days">
                      {Array.from(
                        {
                          length:
                            Math.ceil(
                              (month.getDay() +
                                new Date(
                                  month.getFullYear(),
                                  month.getMonth() + 1,
                                  0,
                                ).getDate()) /
                                7,
                            ) * 7,
                        },
                        (_, i) => {
                          const date = new Date(
                              month.getFullYear(),
                              month.getMonth(),
                              i - month.getDay() + 1,
                            ),
                            key = dateKey(date),
                            ts = data.trades.filter((t) => t.date === key),
                            es = data.entries.filter((e) => e.date === key),
                            files = media.filter((r) => r.date === key),
                            net = stats(ts).net;
                          return (
                            <button
                              key={key}
                              aria-label={`${pretty(key)}, ${ts.length} trades, ${es.length} journal entries, ${files.length} attachments`}
                              className={`day ${date.getMonth() !== month.getMonth() ? "outside" : ""} ${key === dateKey() ? "is-today" : ""}`}
                              onClick={() => openDay(key)}
                            >
                              <span className="day-number">
                                {date.getDate()}
                              </span>
                              {(ts.length > 0 ||
                                es.length > 0 ||
                                files.length > 0) && (
                                <div
                                  className={`day-card ${ts.length ? (net > 0 ? "profit" : net < 0 ? "loss" : "neutral") : "journal-only"}`}
                                >
                                  <div className="day-pnl">
                                    {ts.length
                                      ? money(net)
                                      : es.length
                                        ? "Reflection"
                                        : "Day media"}
                                    <ChevronRight size={15} />
                                  </div>
                                  {ts.length > 0 && (
                                    <div className="trade-count">
                                      {ts.length}{" "}
                                      {ts.length === 1 ? "trade" : "trades"}
                                    </div>
                                  )}
                                  {es.length > 0 && (
                                    <div className="entry-count">
                                      <Pencil size={12} />
                                      {es.length} journal{" "}
                                      {es.length === 1 ? "entry" : "entries"}
                                    </div>
                                  )}
                                  {files.length > 0 && (
                                    <div className="entry-count">
                                      {files.some((r) => r.kind === "audio") ? (
                                        <Mic size={12} />
                                      ) : (
                                        <Paperclip size={12} />
                                      )}{" "}
                                      {files.length}{" "}
                                      {files.length === 1
                                        ? "attachment"
                                        : "attachments"}
                                    </div>
                                  )}
                                </div>
                              )}
                              <span className="day-add">
                                <Plus size={13} /> Add entry
                              </span>
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>
                </div>
                <div className="calendar-footer">
                  <span>
                    <i className="blue-dot" /> Today, {pretty(dateKey())}
                  </span>
                  <span>Small reflections. Better decisions.</span>
                  <span>{s.count} trades this month</span>
                </div>
              </section>
              <div className="below-calendar">
                <span>
                  <Sparkles size={16} /> Your edge grows with every reflection.
                </span>
                <button className="text-btn" onClick={() => setChat(true)}>
                  Explore your patterns <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          )}
          {page === "Dashboard" && (
            <>
              <div className="section-title">
                <h2>Your recent reflections</h2>
                <button
                  className="text-btn"
                  onClick={() => setPage("Calendar Journal")}
                >
                  View calendar <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="cards">
                {data.entries.length ? (
                  data.entries
                    .slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 6)
                    .map((e) => (
                      <button
                        className="reflection-card"
                        key={e.id}
                        onClick={() => openDay(e.date)}
                      >
                        <small>
                          {pretty(e.date)} · {e.mood}
                        </small>
                        <h3>{e.title}</h3>
                        <p>{e.text}</p>
                        <span className="text-btn">
                          Read reflection <ArrowUpRight size={14} />
                        </span>
                      </button>
                    ))
                ) : (
                  <Empty
                    title="A fresh page, every day"
                    text="Record what you saw, how you felt, and what you learned. Trading is more than a P/L."
                    action="Write your first entry"
                    onClick={() => openDay(dateKey())}
                  />
                )}
              </div>
              <div className="section-title">
                <h2>Recent trades</h2>
              </div>
              {tradeTable(
                data.trades
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 5),
              )}
            </>
          )}
          {page === "Trades" && (
            <section className="panel">
              <div className="section-title">
                <h2>
                  Trade ledger <small>{data.trades.length} total</small>
                </h2>
                <label className="search">
                  <Search size={16} />
                  <input
                    aria-label="Search trades"
                    placeholder="Search symbol, setup, notes…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              {tradeTable(
                data.trades
                  .filter((t) =>
                    JSON.stringify(t)
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .sort((a, b) => b.date.localeCompare(a.date)),
              )}
            </section>
          )}
          {page === "Analytics" && (
            <div className="analytics-grid">
              <section className="panel">
                <h2>Daily performance · {monthTitle}</h2>
                <p className="muted">
                  Net result after fees, grouped by trading day.
                </p>
                {s.count ? (
                  <div className="bars">
                    {[...new Set(monthly.map((t) => t.date))]
                      .sort()
                      .map((d) => {
                        const n = stats(
                            monthly.filter((t) => t.date === d),
                          ).net,
                          max = Math.max(
                            ...monthly.map((t) =>
                              Math.abs(
                                stats(monthly.filter((x) => x.date === t.date))
                                  .net,
                              ),
                            ),
                            1,
                          );
                        return (
                          <button
                            className="bar-row"
                            key={d}
                            onClick={() => openDay(d, "trade")}
                          >
                            <span>{d.slice(5)}</span>
                            <div>
                              <i
                                style={{
                                  width: `${Math.max(1, (Math.abs(n) / max) * 100)}%`,
                                }}
                                className={n < 0 ? "loss-bar" : "profit-bar"}
                              />
                            </div>
                            <b className={n < 0 ? "negative" : "positive"}>
                              {money(n)}
                            </b>
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  <p className="empty-inline">
                    Log a trade to begin your performance chart.
                  </p>
                )}
              </section>
              <section className="panel">
                <h2>Setup performance · all time</h2>
                {data.trades.length ? (
                  [
                    ...new Set(
                      data.trades.map((t) => t.setup || "Uncategorized"),
                    ),
                  ].map((setup) => {
                    const st = stats(
                      data.trades.filter(
                        (t) => (t.setup || "Uncategorized") === setup,
                      ),
                    );
                    return (
                      <div className="setup-row" key={setup}>
                        <div>
                          <b>{setup}</b>
                          <small>
                            {st.count} trades · {st.winRate.toFixed(0)}% win
                            rate
                          </small>
                        </div>
                        <b className={st.net < 0 ? "negative" : "positive"}>
                          {money(st.net)}
                        </b>
                      </div>
                    );
                  })
                ) : (
                  <p className="empty-inline">
                    Your setups appear when you log trades.
                  </p>
                )}
                <div className="setup-row">
                  <span>All-time profit factor</span>
                  <b>
                    {total.profitFactor === null
                      ? "—"
                      : total.profitFactor.toFixed(2)}
                  </b>
                </div>
              </section>
            </div>
          )}
          {page === "AI Insights" && (
            <section className="panel insights">
              <div className="sparkle-orb">
                <Sparkles size={30} />
              </div>
              <span className="eyebrow">A THOUGHTFUL SECOND PERSPECTIVE</span>
              <h2>Find the story behind your numbers.</h2>
              <p>
                Your assistant can search saved trades and reflections. With
                Claude connected, it can review your decisions with your
                complete journal, playbook, and goals in context.
              </p>
              <div className="insight-prompts">
                {[
                  "Show my losing days",
                  "Find days where I felt frustrated",
                  "Review my risk discipline",
                ].map((q) => (
                  <button
                    className="secondary"
                    key={q}
                    onClick={() => {
                      setChat(true);
                      ask(undefined, q);
                    }}
                  >
                    {q}
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
              <span className="connection">
                {aiReady
                  ? "Claude connected · journal context per request"
                  : "Local search active · connect Claude in Settings"}
              </span>
            </section>
          )}
          {page === "Playbook" && (
            <>
              <section className="panel">
                <h2>Create a repeatable setup</h2>
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (
                      persist({
                        ...data,
                        plays: [
                          ...data.plays,
                          {
                            id: uid(),
                            name: String(f.get("name")),
                            rules: String(f.get("rules")),
                          },
                        ],
                      })
                    )
                      e.currentTarget.reset();
                  }}
                >
                  <label>
                    Setup name
                    <input
                      name="name"
                      required
                      placeholder="e.g. Opening range breakout"
                    />
                  </label>
                  <label>
                    Entry, exit, and risk rules
                    <textarea
                      name="rules"
                      required
                      rows={3}
                      placeholder="What must be true before you take this trade?"
                    />
                  </label>
                  <button className="primary">
                    <Plus size={16} /> Save setup
                  </button>
                </form>
              </section>
              <div className="cards">
                {data.plays.map((p) => (
                  <article className="panel" key={p.id}>
                    <div className="section-title">
                      <h3>{p.name}</h3>
                      <button
                        className="icon-btn"
                        aria-label={`Delete ${p.name}`}
                        onClick={() => remove("plays", p.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="pre-line">{p.rules}</p>
                    <button
                      className="text-btn"
                      onClick={() => {
                        setDay(dateKey());
                        setMode("trade");
                        setEditing({
                          id: "",
                          date: dateKey(),
                          symbol: "",
                          side: "Long",
                          pnl: 0,
                          risk: 0,
                          setup: p.name,
                          notes: "",
                        });
                      }}
                    >
                      Log this setup <ArrowUpRight size={14} />
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
          {page === "Tags & Setups" && (
            <section className="panel">
              <h2>A vocabulary for your process</h2>
              <p className="muted">
                Create tags for emotions and behaviors. Use them on journal
                entries, then search them with your assistant.
              </p>
              <form
                className="tag-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget),
                    tag = String(f.get("tag")).trim();
                  if (
                    tag &&
                    !data.tags.includes(tag) &&
                    persist({ ...data, tags: [...data.tags, tag] })
                  )
                    e.currentTarget.reset();
                }}
              >
                <input
                  name="tag"
                  required
                  aria-label="New tag"
                  placeholder="e.g. Patient, FOMO, Followed plan"
                />
                <button className="primary">
                  <Plus size={16} /> Add tag
                </button>
              </form>
              <div className="tag-list">
                {data.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                    <button
                      aria-label={`Remove ${tag} tag`}
                      onClick={() =>
                        persist({
                          ...data,
                          tags: data.tags.filter((t) => t !== tag),
                        })
                      }
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <h3>Setups belong in your playbook</h3>
              <p className="muted">
                Keep the rules beside the name, then attach a setup to each
                trade.
              </p>
              <button className="secondary" onClick={() => setPage("Playbook")}>
                Open playbook <ArrowUpRight size={16} />
              </button>
            </section>
          )}
          {page === "Reports" && (
            <section className="panel">
              <div className="section-title">
                <h2>Monthly review</h2>
                <input
                  aria-label="Report month"
                  type="month"
                  value={prefix}
                  onChange={(e) => {
                    if (e.target.value)
                      setMonth(new Date(`${e.target.value}-01T12:00:00`));
                  }}
                />
              </div>
              <p className="muted">
                {monthTitle} · {s.count} trades · {entries.length} reflections
              </p>
              <div className="report-copy">
                <h3>Your numbers</h3>
                <p>
                  Net result: <b>{money(s.net)}</b>. Win rate:{" "}
                  <b>{s.winRate.toFixed(1)}%</b>. Average R:{" "}
                  <b>{s.avgR === null ? "Not available" : s.avgR.toFixed(2)}</b>
                  .
                </p>
                <h3>Your reflections</h3>
                {entries.length ? (
                  entries.map((e) => (
                    <div key={e.id}>
                      <button
                        className="text-btn"
                        onClick={() => openDay(e.date)}
                      >
                        {pretty(e.date)} · {e.title}
                      </button>
                      <p className="pre-line">{e.text}</p>
                    </div>
                  ))
                ) : (
                  <p>No journal entries for this month.</p>
                )}
              </div>
              <button
                className="primary"
                onClick={() => {
                  const csv = [
                    [
                      "Date",
                      "Symbol",
                      "Side",
                      "Net P/L",
                      "Initial risk",
                      "Setup",
                      "Notes",
                    ],
                    ...monthly.map((t) => [
                      t.date,
                      t.symbol,
                      t.side,
                      t.pnl,
                      t.risk,
                      t.setup,
                      t.notes,
                    ]),
                  ]
                    .map((row) =>
                      row
                        .map(
                          (v) =>
                            `"${(typeof v === "string" ? v.replace(/^[=+@\-]/, "'$&") : String(v)).replaceAll('"', '""')}"`,
                        )
                        .join(","),
                    )
                    .join("\r\n");
                  download(`dear-diary-trades-${prefix}.csv`, csv, "text/csv");
                }}
              >
                <ArrowDownToLine size={16} /> Export monthly trades (CSV)
              </button>
            </section>
          )}
          {page === "Goals" && (
            <>
              <section className="panel">
                <h2>Measure the habits that matter</h2>
                <p className="muted">
                  Set a process goal and update your progress as you go.
                </p>
                <form
                  className="tag-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (
                      persist({
                        ...data,
                        goals: [
                          ...data.goals,
                          {
                            id: uid(),
                            name: String(f.get("name")),
                            target: Number(f.get("target")),
                            current: 0,
                          },
                        ],
                      })
                    )
                      e.currentTarget.reset();
                  }}
                >
                  <input
                    aria-label="Goal name"
                    name="name"
                    required
                    placeholder="Journal after 20 sessions"
                  />
                  <input
                    aria-label="Goal target"
                    name="target"
                    type="number"
                    min="1"
                    required
                    placeholder="Target"
                  />
                  <button className="primary">
                    <Plus size={16} /> Add goal
                  </button>
                </form>
              </section>
              <div className="cards">
                {data.goals.map((g) => (
                  <article className="panel" key={g.id}>
                    <div className="section-title">
                      <h3>{g.name}</h3>
                      <button
                        className="icon-btn"
                        aria-label={`Delete ${g.name}`}
                        onClick={() => remove("goals", g.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <progress value={g.current} max={g.target} />
                    <div className="section-title">
                      <span>
                        {g.current} / {g.target}
                      </span>
                      <button
                        className="secondary"
                        disabled={g.current >= g.target}
                        onClick={() =>
                          persist({
                            ...data,
                            goals: data.goals.map((x) =>
                              x.id === g.id
                                ? { ...x, current: x.current + 1 }
                                : x,
                            ),
                          })
                        }
                      >
                        <Check size={16} />
                        {g.current >= g.target ? "Complete" : "Log progress"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {page === "Import / Sync" && (
            <div className="sync-grid">
              <section className="panel">
                <span className="eyebrow">YOUR DATA, YOURS TO KEEP</span>
                <h2>Pick up where you left off.</h2>
                <p className="muted">
                  Journal data is saved in this browser on this computer. GitHub
                  syncs app code; it does not sync private trading records.
                </p>
                <ol className="steps">
                  <li>Export your journal before switching computers.</li>
                  <li>
                    Transfer the ZIP backup using your private drive or AirDrop.
                  </li>
                  <li>
                    Update the app on the other computer, then restore the
                    backup.
                  </li>
                </ol>
                <div className="button-row">
                  <button
                    className="primary"
                    onClick={backup}
                    disabled={backupBusy}
                  >
                    <ArrowDownToLine size={16} />{" "}
                    {backupBusy
                      ? "Preparing backup…"
                      : "Export journal + media"}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => file.current?.click()}
                    disabled={backupBusy || blocked}
                  >
                    <ArrowUpFromLine size={16} /> Restore backup
                  </button>
                </div>
                <input
                  ref={file}
                  hidden
                  type="file"
                  accept="application/json,application/zip,.json,.zip"
                  onChange={(e) => {
                    if (e.target.files?.[0]) importBackup(e.target.files[0]);
                  }}
                />
                {blocked && (
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        "dear-diary-recovery.txt",
                        localStorage.getItem(KEY) || "",
                      )
                    }
                  >
                    Download recovery data
                  </button>
                )}
                <p className="small muted">
                  ZIP backups include all original audio, images, videos, and
                  saved transcripts. Restore validates the archive and downloads
                  a safety backup before replacing records. Older JSON backups
                  restore text only and keep existing media.
                </p>
                <button
                  className="text-btn"
                  onClick={() =>
                    download(
                      `dear-diary-text-${dateKey()}.json`,
                      JSON.stringify(data, null, 2),
                    )
                  }
                >
                  Export text-only JSON (excludes media)
                </button>
              </section>
              <section className="panel">
                <h2>This workspace</h2>
                {[
                  ["Trades", data.trades.length],
                  ["Journal entries", data.entries.length],
                  ["Playbook setups", data.plays.length],
                  ["Media files", media.length],
                  ["Data location", "This browser"],
                ].map(([k, v]) => (
                  <div className="setup-row" key={k}>
                    <span>{k}</span>
                    <b>{v}</b>
                  </div>
                ))}
                <p className="muted small">
                  Use the same browser and local address each time. Clearing
                  browser data removes local records. Keep regular backups.
                </p>
                <h3>MacBook ↔ Desktop</h3>
                <p className="muted small">
                  Use Start-Mac.command or Start-Windows.cmd from the
                  repository. Each safely pulls updates when the checkout is
                  clean, then starts the app. See README for first-time setup.
                </p>
              </section>
            </div>
          )}
          {page === "Media Library" && (
            <MediaLibrary
              records={media}
              error={mediaError}
              onOpenDay={(date) => openDay(date)}
              onBackup={backup}
            />
          )}
          {page === "Settings" && (
            <div className="sync-grid">
              <section className="panel">
                <h2>Your workspace</h2>
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (
                      persist({
                        ...data,
                        name: String(f.get("name")),
                        currency: String(f.get("currency")),
                      })
                    )
                      setNotice("Preferences saved.");
                  }}
                >
                  <label>
                    Display name
                    <input
                      name="name"
                      defaultValue={data.name}
                      required
                      maxLength={40}
                    />
                  </label>
                  <label>
                    Reporting currency
                    <select name="currency" defaultValue={data.currency}>
                      {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <p className="small muted">
                    Currency changes the display label. It does not convert
                    values.
                  </p>
                  <button className="primary">Save preferences</button>
                </form>
                <div className="setup-row">
                  <span>Appearance</span>
                  <button className="secondary" onClick={() => setDark(!dark)}>
                    {dark ? <Sun size={16} /> : <Moon size={16} />}{" "}
                    {dark ? "Light" : "Dark"} mode
                  </button>
                </div>
              </section>
              <section className="panel">
                <div className="section-title">
                  <h2>Claude assistant</h2>
                  <span className="status-pill">
                    {aiReady ? "Connected" : "Not connected"}
                  </span>
                </div>
                <p className="muted">
                  The local server reads your API key from{" "}
                  <code>.env.local</code>. The key is never stored in the
                  browser or committed to Git.
                </p>
                <pre>
                  ANTHROPIC_API_KEY=your-key-here{"\n"}
                  ANTHROPIC_MODEL=claude-haiku-4-5
                </pre>
                <p className="muted small">
                  Create this file in the project root and restart the launcher.
                  Connected requests send your complete journal and recent chat
                  to Anthropic. All dated records are sorted chronologically. No
                  vector database is configured.
                </p>
                <button className="secondary" onClick={() => setChat(true)}>
                  <MessageCircle size={16} /> Open assistant
                </button>
                <hr />
                <h3>Explore with sample data</h3>
                <p className="muted small">
                  Optional demonstration records inspired by your reference.
                  Loading them replaces current records after exporting a
                  backup.
                </p>
                <button
                  className="secondary"
                  disabled={backupBusy}
                  onClick={async () => {
                    if (
                      confirm(
                        "Export your current backup and replace journal text and trades with sample records? Existing media files will be kept.",
                      )
                    ) {
                      if (!(await backup())) return;
                      if (persist(demoJournal()))
                        setNotice(
                          "Sample journal loaded. These are demonstration records, not your actual trading history.",
                        );
                    }
                  }}
                >
                  Load sample journal
                </button>
              </section>
            </div>
          )}
        </div>
        <footer className="app-footer">
          <span>
            Dear Diary <span className="muted">/</span> A clearer view of your
            trading.
          </span>
          <span>PRIVATE BY DEFAULT · LOCAL FIRST</span>
        </footer>
      </main>
      <button
        className={`assistant-launcher ${chat ? "hidden" : ""}`}
        aria-label="Ask your journal"
        onClick={() => setChat(true)}
      >
        <span className="assistant-icon">
          <MessageCircle size={24} />
          <Sparkles size={13} />
        </span>
        <span>
          Ask your journal<small>A little clarity, on demand</small>
        </span>
        <ChevronRight size={16} />
      </button>
      {chat && (
        <section className="chat" aria-label="Journal assistant">
          <div className="chat-header">
            <div className="assistant-icon">
              <Sparkles size={21} />
            </div>
            <div>
              <b>Your journal assistant</b>
              <small>
                {aiReady
                  ? "Claude · journal context connected"
                  : "Local search · Claude not connected"}
              </small>
            </div>
            <button
              className="icon-btn"
              aria-label="Close assistant"
              onClick={() => setChat(false)}
            >
              <X size={19} />
            </button>
          </div>
          <div className="chat-body">
            {!messages.length && (
              <div className="chat-welcome">
                <Sparkles size={27} />
                <h3>Let’s connect the dots.</h3>
                <p>
                  Search your trading days, revisit a lesson, or reflect on a
                  pattern.
                </p>
                {["Show my losing days", "Find patient trades"].map((q) => (
                  <button
                    className="secondary"
                    key={q}
                    onClick={() => ask(undefined, q)}
                  >
                    {q}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`message ${m.role}`}>
                <small>
                  {m.role === "user"
                    ? "YOU"
                    : aiReady
                      ? "ASSISTANT"
                      : "LOCAL SEARCH"}
                </small>
                <p>{m.text}</p>
                {m.dates?.map((d) => (
                  <button
                    key={d}
                    className="day-link"
                    onClick={() => {
                      openDay(d);
                      setChat(false);
                    }}
                  >
                    <CalendarDays size={14} />
                    {pretty(d)}
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
            ))}
            {busy && (
              <p className="muted" role="status">
                Reading your journal…
              </p>
            )}
            <div ref={chatEnd} />
          </div>
          <form className="chat-input" onSubmit={ask}>
            <input
              aria-label="Ask your journal question"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What would you like to explore?"
              required
              maxLength={4000}
            />
            <button
              className="primary"
              disabled={busy || !query.trim()}
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
          </form>
          <div className="chat-disclaimer">
            {aiReady
              ? "AI can make mistakes. Review the original records."
              : "Search stays on this device. Connect Claude in Settings."}
          </div>
        </section>
      )}
      {day && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !captureBusy) setDay(null);
          }}
        >
          <section
            className="day-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-title"
          >
            <div className="drawer-header">
              <div>
                <div className="eyebrow">YOUR DAILY REFLECTION</div>
                <h2 id="day-title">{pretty(day)}</h2>
              </div>
              <button
                autoFocus
                className="icon-btn"
                aria-label="Close day"
                disabled={captureBusy}
                onClick={() => setDay(null)}
              >
                <X size={22} />
              </button>
            </div>
            <div className="day-summary">
              <span>
                Net P/L{" "}
                <b
                  className={
                    stats(data.trades.filter((t) => t.date === day)).net < 0
                      ? "negative"
                      : "positive"
                  }
                >
                  {money(stats(data.trades.filter((t) => t.date === day)).net)}
                </b>
              </span>
              <span>
                {data.trades.filter((t) => t.date === day).length} trades ·{" "}
                {data.entries.filter((e) => e.date === day).length} entries
              </span>
            </div>
            <div className="tabs">
              <button
                disabled={captureBusy}
                className={mode === "journal" ? "selected" : ""}
                onClick={() => {
                  setMode("journal");
                  setEditing(null);
                }}
              >
                <Pencil size={15} /> Journal
              </button>
              <button
                disabled={captureBusy}
                className={mode === "trade" ? "selected" : ""}
                onClick={() => {
                  setMode("trade");
                  setEditing(null);
                }}
              >
                <CandlestickChart size={15} /> Trades
              </button>
            </div>
            <div className="drawer-body">
              {mode === "journal" && (
                <DayMedia
                  key={day}
                  date={day}
                  records={media}
                  storageError={mediaError}
                  onTranscript={useTranscript}
                  onBusy={setCaptureBusy}
                />
              )}
              {mode === "journal"
                ? data.entries
                    .filter((e) => e.date === day)
                    .map((e) => (
                      <article className="saved-entry" key={e.id}>
                        <div className="section-title">
                          <h3>{e.title}</h3>
                          <div>
                            <button
                              className="icon-btn"
                              aria-label={`Edit ${e.title}`}
                              onClick={() => setEditing(e)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-btn"
                              aria-label={`Delete ${e.title}`}
                              onClick={() => remove("entries", e.id)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                        <span className="mood">
                          {e.mood}
                          {e.tags && ` · ${e.tags}`}
                        </span>
                        <p className="pre-line">{e.text}</p>
                      </article>
                    ))
                : data.trades
                    .filter((t) => t.date === day)
                    .map((t) => (
                      <article className="saved-entry" key={t.id}>
                        <div className="section-title">
                          <b>
                            {t.symbol} · {t.side}
                          </b>
                          <b className={t.pnl < 0 ? "negative" : "positive"}>
                            {money(t.pnl)}
                          </b>
                          <div>
                            <button
                              className="icon-btn"
                              aria-label={`Edit ${t.symbol}`}
                              onClick={() => setEditing(t)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-btn"
                              aria-label={`Delete ${t.symbol}`}
                              onClick={() => remove("trades", t.id)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                        <small>{t.setup}</small>
                        <p>{t.notes}</p>
                      </article>
                    ))}
              <form
                key={`${mode}-${editing?.id || "new"}`}
                className="inline-form day-form"
                onSubmit={saveDay}
              >
                <h3>
                  {editing?.id ? "Edit" : "New"}{" "}
                  {mode === "journal" ? "journal entry" : "trade"}
                </h3>
                <label>
                  Date
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={editing?.date || day}
                  />
                </label>
                {mode === "journal" ? (
                  <>
                    <label>
                      Title
                      <input
                        name="title"
                        ref={titleField}
                        required
                        maxLength={160}
                        placeholder="What did today teach you?"
                        defaultValue={(editing as Entry)?.title || ""}
                      />
                    </label>
                    <label>
                      Reflection
                      <textarea
                        name="text"
                        ref={reflectionField}
                        rows={5}
                        required
                        placeholder="Your plan, your decisions, your emotions, your lesson…"
                        defaultValue={(editing as Entry)?.text || ""}
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        State of mind
                        <select
                          name="mood"
                          defaultValue={(editing as Entry)?.mood || "Calm"}
                        >
                          {[
                            "Calm",
                            "Focused",
                            "Confident",
                            "Anxious",
                            "Frustrated",
                            "Tired",
                            "Neutral",
                          ].map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Tags (comma separated)
                        <input
                          name="tags"
                          list="tags-list"
                          defaultValue={(editing as Entry)?.tags || ""}
                          placeholder="Patient, Followed plan"
                        />
                        <datalist id="tags-list">
                          {data.tags.map((t) => (
                            <option key={t} value={t} />
                          ))}
                        </datalist>
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-grid">
                      <label>
                        Symbol
                        <input
                          name="symbol"
                          required
                          maxLength={30}
                          defaultValue={(editing as Trade)?.symbol || ""}
                          placeholder="NQ, ES, AAPL…"
                        />
                      </label>
                      <label>
                        Direction
                        <select
                          name="side"
                          defaultValue={(editing as Trade)?.side || "Long"}
                        >
                          <option>Long</option>
                          <option>Short</option>
                        </select>
                      </label>
                      <label>
                        Net P/L ({data.currency})
                        <input
                          name="pnl"
                          required
                          type="number"
                          step="0.01"
                          placeholder="After all fees"
                          defaultValue={(editing as Trade)?.pnl}
                        />
                      </label>
                      <label>
                        Initial risk ({data.currency})
                        <input
                          name="risk"
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          defaultValue={(editing as Trade)?.risk ?? 0}
                        />
                      </label>
                    </div>
                    <label>
                      Setup
                      <input
                        name="setup"
                        list="setup-list"
                        defaultValue={(editing as Trade)?.setup || ""}
                        placeholder="Select or type a setup"
                      />
                      <datalist id="setup-list">
                        {data.plays.map((p) => (
                          <option key={p.id} value={p.name} />
                        ))}
                      </datalist>
                    </label>
                    <label>
                      Execution notes
                      <textarea
                        name="notes"
                        rows={3}
                        defaultValue={(editing as Trade)?.notes || ""}
                      />
                    </label>
                  </>
                )}
                <div className="button-row">
                  <button className="primary" disabled={captureBusy}>
                    <Check size={17} /> Save{" "}
                    {mode === "journal" ? "entry" : "trade"}
                  </button>
                  {editing && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setEditing(null)}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function Empty({
  title,
  text,
  action,
  onClick,
}: { title: string; text: string; action: string; onClick: () => void }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <BookOpen size={27} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="secondary" onClick={onClick}>
        <Plus size={16} />
        {action}
      </button>
    </div>
  );
}
