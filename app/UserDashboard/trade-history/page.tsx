"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Percent,
  Repeat,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { IBM_Plex_Mono } from "next/font/google";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const plexMono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], display: "swap" });

/* ───────────────── Types ───────────────── */

type Filter = "all" | "winning" | "losing" | "open" | "closed";
type TradeStatus = "WIN" | "LOSS" | "OPEN" | "FAILED";

interface Trade {
  id: string;
  symbol: string;
  dir: "BUY" | "SELL";
  entry: number | null;
  exit: number | null;
  opened: string;
  closed: string | null;
  pl: number;
  status: TradeStatus;
}

interface ExecutionDoc {
  _id: string;
  dealId?: string | null;
  symbol?: string | null;
  epic?: string | null;
  direction?: "BUY" | "SELL" | null;
  entryLevel?: number | null;
  exitLevel?: number | null;
  size?: number | null;
  orderType?: string | null;
  status?: string | null;
  realizedPnl?: number | null;
  unrealizedPnl?: number | null;
  openedAt?: string | null;
  closedAt?: string | null;
  createdAt?: string | null;
  error?: string | null;
}

/* ───────────────── Helpers ───────────────── */

const money = (v: number) =>
  `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (v: number) => `${v >= 0 ? "+" : "-"}${money(v)}`;
const plTone = (v: number) => (v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400");

const fmtDT = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toTrade = (e: ExecutionDoc): Trade => {
  const isOpen = e.status === "open" || e.status === "submitted" || e.status === "pending";
  const failed = e.status === "rejected" || e.status === "failed" || e.status === "cancelled";
  const pnl = isOpen ? (e.unrealizedPnl ?? 0) : (e.realizedPnl ?? 0);

  return {
    id: e.dealId || e._id.slice(-8).toUpperCase(),
    symbol: e.symbol || e.epic || "—",
    dir: e.direction === "SELL" ? "SELL" : "BUY",
    entry: e.entryLevel ?? null,
    exit: e.exitLevel ?? null,
    opened: fmtDT(e.openedAt ?? e.createdAt),
    closed: e.closedAt ? fmtDT(e.closedAt) : null,
    pl: pnl,
    status: failed ? "FAILED" : isOpen ? "OPEN" : pnl >= 0 ? "WIN" : "LOSS",
  };
};

const TH = "px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground";
const TD = "px-4 py-3.5 text-sm font-medium tabular-nums";

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="group rounded-2xl border border-violet-500/20 bg-card p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-900/10">
      <div className="flex items-start justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${tone}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-xl font-extrabold tracking-tight tabular-nums font-mono">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

const DirTag = ({ dir }: { dir: "BUY" | "SELL" }) => (
  <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider ${dir === "BUY" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
    {dir === "BUY" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
    {dir}
  </span>
);

function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-border/60 bg-muted/20 p-1">
      {options.map((o) => (
        <button
          key={o.key} type="button" onClick={() => onChange(o.key)} aria-pressed={value === o.key}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === o.key ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────────── Page ───────────────── */

export default function TradeHistoryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/user/trading/executions?limit=500", { cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || "Failed to load trade history");
        if (!cancelled) {
          setTrades((payload.executions ?? []).map(toTrade));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load trade history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const closed = trades.filter((t) => t.status === "WIN" || t.status === "LOSS");
    const wins = closed.filter((t) => t.status === "WIN").length;
    const losses = closed.length - wins;
    const profit = closed.reduce((s, t) => s + Math.max(t.pl, 0), 0);
    const loss = closed.reduce((s, t) => s + Math.min(t.pl, 0), 0);
    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
    const total = trades.filter((t) => t.status !== "FAILED").length;
    return { total, profit, loss, winRate };
  }, [trades]);

  const rows = trades.filter((t) =>
    filter === "all" ? true : filter === "winning" ? t.status === "WIN" : filter === "losing" ? t.status === "LOSS" : filter === "open" ? t.status === "OPEN" : t.status !== "OPEN");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-6 py-4">
        <div>
          <p
            className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}
          >
            [ // HISTORY ]
          </p>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight md:text-2xl">
            Trade{" "}
            <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">
              History
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All your executed trades and positions.
          </p>
        </div>

        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniStat
            icon={<Repeat className="h-4 w-4" />}
            label="Total Trades"
            value={String(stats.total)}
            tone="bg-violet-500/15 text-violet-600 dark:text-violet-400"
          />
          <MiniStat
            icon={<TrendingUp className="h-4 w-4" />}
            label="Total Profit"
            value={`${stats.profit >= 0 ? "+" : ""}${money(stats.profit)}`}
            tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          />
          <MiniStat
            icon={<TrendingDown className="h-4 w-4" />}
            label="Total Loss"
            value={stats.loss < 0 ? `-${money(stats.loss)}` : money(0)}
            tone="bg-rose-500/15 text-rose-600 dark:text-rose-400"
          />
          <MiniStat
            icon={<Percent className="h-4 w-4" />}
            label="Win Rate"
            value={`${stats.winRate}%`}
            tone="bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400"
          />
        </section>

        <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
          <CardHeader className="flex flex-col gap-3 space-y-0 py-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-xl font-bold">Trade History</CardTitle>
            <div className="overflow-x-auto">
              <Segmented<Filter>
                value={filter} onChange={setFilter}
                options={[{ key: "all", label: "All" }, { key: "winning", label: "Winning" }, { key: "losing", label: "Losing" }, { key: "open", label: "Open" }, { key: "closed", label: "Closed" }]}
              />
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 960 }}>
              <thead>
                <tr className="border-y border-border/50 bg-muted/20">
                  {["Instrument", "Direction", "Entry", "Exit", "Opened", "Closed", "Net P/L", "Status"].map((h) => <th key={h} className={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading && <tr><td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Loading trade history…</td></tr>}
                {!loading && error && <tr><td colSpan={8} className="py-10 text-center text-sm text-red-600 dark:text-red-400">{error}</td></tr>}
                {!loading && !error && rows.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">No trades match this filter.</td></tr>}
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className={TD}><div className="font-bold">{t.symbol}</div><div className="text-[10px] text-muted-foreground">{t.id}</div></td>
                    <td className={TD}><DirTag dir={t.dir} /></td>
                    <td className={TD}>{t.entry ?? "—"}</td>
                    <td className={TD}>{t.exit ?? "—"}</td>
                    <td className={TD}>{t.opened}</td>
                    <td className={TD}>{t.closed ?? "—"}</td>
                    <td className={`${TD} font-bold ${plTone(t.pl)}`}>{signed(t.pl)}</td>
                    <td className={TD}>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${
                        t.status === "WIN" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : t.status === "LOSS" ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : t.status === "FAILED" ? "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300"
                        : "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300"}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          Leveraged trading and CFDs carry significant risk of loss.
        </p>
      </div>
    </main>
  );
}
