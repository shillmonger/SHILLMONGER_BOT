"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IBM_Plex_Mono } from "next/font/google";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Hash,
  Inbox,
  Loader2,
  MessageSquare,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

/* ───────────────── Types ───────────────── */

interface SignalRow {
  id: string;
  chat_id: number | string | null;
  message_id: number | null;
  group_name: string | null;
  symbol: string | null;
  direction: string | null;
  order_type: string | null;
  entry: number | null;
  entry_high: number | null;
  entry_low: number | null;
  stop_loss: number | null;
  take_profits: number[];
  raw_message: string | null;
  confidence: number | null;
  timestamp: string | null;
  status: string;
  ingested_at: string | null;
  queued_at: string | null;
  attempts: number | null;
}

type SignalType = "signals" | "pending";

const PAGE_SIZE = 15;

/* ───────────────── Helpers ───────────────── */

const Badge = ({ text, tone }: { text: string; tone: "green" | "amber" | "red" | "gray" | "blue" | "violet" }) => (
  <span className={`${plexMono.className} inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
    tone === "green"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "red"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : tone === "blue"
            ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
            : tone === "violet"
              ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"
              : "border-border/60 bg-muted/30 text-muted-foreground"
  }`}>
    {text}
  </span>
);

function DirectionBadge({ direction }: { direction: string | null }) {
  const d = (direction ?? "").toUpperCase();
  const isBuy = d === "BUY";
  return (
    <Badge
      text={d || "—"}
      tone={isBuy ? "green" : d === "SELL" ? "red" : "gray"}
    />
  );
}

function StatusBadge({ status, type }: { status: string; type: SignalType }) {
  const s = (status || "").toUpperCase();
  if (type === "pending" || s === "PENDING" || s === "QUEUED") return <Badge text={s || "PENDING"} tone="amber" />;
  if (s === "RECEIVED" || s === "STORED") return <Badge text={s} tone="blue" />;
  if (s === "EXECUTED" || s === "OPEN" || s === "FILLED") return <Badge text={s} tone="green" />;
  if (s === "REJECTED" || s === "FAILED" || s === "ERROR") return <Badge text={s} tone="red" />;
  return <Badge text={s || "—"} tone="gray" />;
}

const fmtPrice = (n?: number | null) =>
  n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 2 });

const fmtTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const SELECT_CLS =
  "h-10 rounded-lg border border-border/60 bg-card px-3 text-xs font-semibold outline-none transition-colors hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20";

/* ───────────────── Page ───────────────── */

const TH = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap";
const TD = "px-4 py-3 align-middle text-sm";

export default function AdminSignalsPage() {
  const [type, setType] = useState<SignalType>("signals");
  const [rows, setRows] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [dirFilter, setDirFilter] = useState<"all" | "BUY" | "SELL">("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/signals?type=${type}&limit=1000`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load signals");
      setRows(data.signals ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load signals");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  /* filtering + pagination */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((s) => {
      if (dirFilter !== "all" && (s.direction ?? "").toUpperCase() !== dirFilter) return false;
      if (!q) return true;
      return [s.symbol, s.group_name, s.raw_message, s.status]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, query, dirFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  const switchType = (t: SignalType) => {
    if (t === type) return;
    setType(t);
    setPage(1);
    setExpandedId(null);
    setQuery("");
    setDirFilter("all");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
            [ // TRADE SIGNALS ]
          </p>
          <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight">
            Telegram <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">Signals</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} {type === "pending" ? "pending" : "stored"} signal{filtered.length === 1 ? "" : "s"} — click a row for details.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void load()}
          className="h-9 gap-2 rounded-lg border-violet-500/40 text-xs font-semibold"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* type toggle */}
      <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
        {(["signals", "pending"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchType(t)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              type === t
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-900/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "signals" ? <Radio className="h-3.5 w-3.5" /> : <Inbox className="h-3.5 w-3.5" />}
            {t === "signals" ? "Signals" : "Pending Signals"}
          </button>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search symbol, group or message"
            className="h-10 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <select
          value={dirFilter}
          onChange={(e) => { setDirFilter(e.target.value as typeof dirFilter); setPage(1); }}
          className={`${SELECT_CLS} flex-1 sm:flex-none`}
          aria-label="Filter by direction"
        >
          <option value="all">All directions</option>
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/20 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading signals…
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-violet-500/20">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
              <Radio className="h-7 w-7" />
            </span>
            <p className="text-sm font-extrabold text-muted-foreground">
              {type === "pending" ? "No pending signals" : "No signals stored"}
            </p>
            <p className="text-xs text-muted-foreground">
              {type === "pending"
                ? "Signals that failed backend delivery will queue here for retry."
                : "Validated signals from Telegram groups will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 1080 }}>
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className={TH}>Symbol</th>
                  <th className={TH}>Direction</th>
                  <th className={TH}>Order</th>
                  <th className={`${TH} text-right`}>Entry</th>
                  <th className={`${TH} text-right`}>Stop Loss</th>
                  <th className={`${TH} text-right`}>TPs</th>
                  <th className={TH}>Source</th>
                  <th className={TH}>Time</th>
                  <th className={TH}>Status</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-xs text-muted-foreground">
                      No signals match your filters.
                    </td>
                  </tr>
                ) : pageRows.map((s) => {
                  const expanded = expandedId === s.id;
                  const time = type === "pending"
                    ? (s.queued_at ?? s.timestamp ?? s.ingested_at)
                    : (s.timestamp ?? s.ingested_at);
                  return (
                    <Fragment key={s.id}>
                      <tr
                        onClick={() => setExpandedId(expanded ? null : s.id)}
                        className="cursor-pointer transition-colors hover:bg-muted/30"
                      >
                        <td className={TD}>
                          <span className={`${plexMono.className} text-sm font-bold`}>{s.symbol ?? "—"}</span>
                        </td>
                        <td className={TD}><DirectionBadge direction={s.direction} /></td>
                        <td className={TD}>
                          <span className={`${plexMono.className} text-xs text-muted-foreground`}>
                            {s.order_type ?? "—"}
                          </span>
                        </td>
                        <td className={`${TD} text-right`}>
                          <span className={`${plexMono.className} text-sm font-semibold`}>{fmtPrice(s.entry)}</span>
                          {(s.entry_high != null || s.entry_low != null) && (
                            <span className={`${plexMono.className} block text-[10px] text-muted-foreground`}>
                              {fmtPrice(s.entry_low)} – {fmtPrice(s.entry_high)}
                            </span>
                          )}
                        </td>
                        <td className={`${TD} text-right`}>
                          <span className={`${plexMono.className} text-sm font-semibold text-rose-600 dark:text-rose-400`}>
                            {fmtPrice(s.stop_loss)}
                          </span>
                        </td>
                        <td className={`${TD} text-right`}>
                          <span className={`${plexMono.className} text-sm font-semibold`}>
                            {s.take_profits?.length ?? 0}
                          </span>
                        </td>
                        <td className={TD}>
                          <p className="max-w-[180px] truncate text-xs font-semibold">
                            {s.group_name || "Unknown"}
                          </p>
                          <p className={`${plexMono.className} text-[10px] text-muted-foreground`}>
                            chat {s.chat_id ?? "—"}
                          </p>
                        </td>
                        <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{fmtTime(time)}</td>
                        <td className={TD}>
                          <StatusBadge status={s.status} type={type} />
                          {type === "pending" && s.attempts != null && s.attempts > 0 && (
                            <p className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              {s.attempts} attempt{s.attempts === 1 ? "" : "s"}
                            </p>
                          )}
                        </td>
                        <td className={TD}>
                          {expanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-muted/20">
                          <td colSpan={10} className="px-4 py-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1.5">
                                    <Hash className="h-3 w-3" /> msg {s.message_id ?? "—"}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <Target className="h-3 w-3" /> confidence {s.confidence ?? "—"}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <ShieldAlert className="h-3 w-3" /> status {s.status}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3" /> {fmtTime(time)}
                                  </span>
                                </div>
                                <div>
                                  <p className={`${plexMono.className} mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground`}>
                                    Take Profits
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(s.take_profits || []).length === 0 ? (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    ) : s.take_profits.map((tp, i) => (
                                      <span
                                        key={i}
                                        className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400"
                                      >
                                        TP{i + 1}: {fmtPrice(tp)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div>
                                <p className={`${plexMono.className} mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground`}>
                                  <MessageSquare className="h-3 w-3" /> Raw Message
                                </p>
                                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                                  {s.raw_message || "—"}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* footer / pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
            <span>
              {filtered.length === 0 ? "0 results" : `${start + 1} to ${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                aria-label="Previous page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 transition-colors hover:bg-violet-500/10 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[88px] text-center font-semibold">Page {safePage} of {totalPages}</span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                aria-label="Next page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 transition-colors hover:bg-violet-500/10 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
