"use client";

import React, { useEffect, useMemo, useState } from "react";
import { IBM_Plex_Mono } from "next/font/google";
import {
  Activity, ArrowDownRight, ArrowUpDown, ArrowUpRight, BarChart3, Clock, Crown, Filter,
  Layers, MessageCircle, Radio, RefreshCw, Scale, Search, ShieldAlert, ShieldCheck,
  ShieldQuestion, TrendingDown, TrendingUp, Trophy, Users, X,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ShillmongerLoader from "@/components/ShillmongerLoader";
import { useMainContentLoading } from "@/components/UserDashboard/MainContentLoading";

/**
 * Move the `RecommendationType`, `TimePeriod`-independent types (TradeRecord, GroupAnalytics)
 * and `MOCK_GROUPS` from your old file into ./data.ts and export them.
 * In MOCK_GROUPS (g5) rename `worstTrade: -8.3` to `largestLoss: -8.3`.
 */
import { fetchGroupAnalytics, type GroupAnalytics, type RecommendationType } from "./data";

const plexMono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], display: "swap" });

/* ═════════════ Types & constants ═════════════ */

type TimePeriod = "today" | "yesterday" | "7d" | "30d" | "90d" | "this_month" | "last_month" | "all";
type SortField =
  | "netPnlAfterFees" | "roi" | "winRate" | "profitFactor" | "wins" | "losses" | "consistencyScore" | "totalSignals";

const PERIODS: { key: TimePeriod; label: string }[] = [
  { key: "today", label: "Today" }, { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7D" }, { key: "30d", label: "30D" }, { key: "90d", label: "90D" },
  { key: "this_month", label: "This month" }, { key: "last_month", label: "Last month" },
  { key: "all", label: "All time" },
];

const SERIES_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#ec4899"];

const REC_STYLE: Record<RecommendationType, { cls: string; icon: React.ReactNode }> = {
  KEEP: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: <ShieldCheck className="h-3 w-3" /> },
  MONITOR: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: <ShieldQuestion className="h-3 w-3" /> },
  REVIEW: { cls: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400", icon: <ShieldAlert className="h-3 w-3" /> },
  "CONSIDER LEAVING": { cls: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400", icon: <TrendingDown className="h-3 w-3" /> },
};

/* ═════════════ Helpers ═════════════ */

const money = (v: number) =>
  `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (v: number) => `${v >= 0 ? "+" : "-"}${money(v)}`;
const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const tone = (v: number) => (v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400");

/** Real cumulative P/L curve from the API; falls back to a flat line. */
function buildEquityCurve(g: GroupAnalytics, points = 30): number[] {
  if (Array.isArray(g.equityCurve) && g.equityCurve.length === points) return g.equityCurve;
  return Array.from({ length: points }, () => g.netPnlAfterFees);
}

/* ═════════════ Page ═════════════ */

export default function GroupPerformancePage() {
  const [period, setPeriod] = useState<TimePeriod>("30d");
  const [search, setSearch] = useState("");
  const [recFilter, setRecFilter] = useState<RecommendationType | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("netPnlAfterFees");
  const [sortAsc, setSortAsc] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<GroupAnalytics | null>(null);
  const [groups, setGroups] = useState<GroupAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setMainLoading = useMainContentLoading();

  // Keep the layout loader visible while group analytics are loading.
  useEffect(() => {
    setMainLoading(loading);
  }, [loading, setMainLoading]);

  useEffect(() => () => setMainLoading(false), [setMainLoading]);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchGroupAnalytics(period)
      .then((g: GroupAnalytics[]) => setGroups(g))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  const changePeriod = (p: TimePeriod) => {
    setLoading(true);
    setError(null);
    setPeriod(p);
  };

  useEffect(() => {
    let cancelled = false;
    fetchGroupAnalytics(period)
      .then((g: GroupAnalytics[]) => {
        if (cancelled) return;
        setGroups(g);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const overall = useMemo(() => {
    const sum = (f: (g: GroupAnalytics) => number) => groups.reduce((s, g) => s + f(g), 0);
    const wins = sum((g) => g.wins), losses = sum((g) => g.losses), be = sum((g) => g.breakeven);
    const net = sum((g) => g.netPnlAfterFees), capital = sum((g) => g.allocatedCapital);
    const byNet = [...groups].sort((a, b) => b.netPnlAfterFees - a.netPnlAfterFees);
    const byWin = [...groups].sort((a, b) => b.winRate - a.winRate);
    const grossProfit = sum((g) => g.grossProfit), grossLoss = sum((g) => g.grossLoss);
    return {
      active: groups.filter((g) => g.status === "connected").length,
      total: groups.length,
      signals: sum((g) => g.totalSignals),
      executed: sum((g) => g.totalExecuted),
      open: sum((g) => g.openTradesCount),
      wins, losses, be,
      winRate: wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0,
      grossProfit, grossLoss,
      profitFactor: grossLoss ? grossProfit / Math.abs(grossLoss) : 0,
      net, fees: sum((g) => g.totalFees),
      roi: capital ? (net / capital) * 100 : 0,
      best: byNet[0], worst: byNet[byNet.length - 1], topWin: byWin[0],
      profitable: groups.filter((g) => g.netPnlAfterFees > 0).length,
    };
  }, [groups]);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return groups
      .filter((g) => {
        const hit = g.name.toLowerCase().includes(q) || g.username?.toLowerCase().includes(q) || g.tgId.includes(q);
        return hit && (recFilter === "ALL" || g.recommendation === recFilter);
      })
      .sort((a, b) => {
        const d = (a[sortField] as number) - (b[sortField] as number);
        return sortAsc ? d : -d;
      });
  }, [groups, search, recFilter, sortField, sortAsc]);

  const compared = useMemo(() => groups.filter((g) => compareIds.includes(g.id)), [groups, compareIds]);

  const toggleCompare = (id: string) =>
    setCompareIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 4 ? [...p, id] : p));

  const onSort = (f: SortField) => {
    if (f === sortField) setSortAsc((v) => !v);
    else { setSortField(f); setSortAsc(false); }
  };

  if (groups.length === 0) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-1 py-6">
        <PageHeader period={period} onPeriod={changePeriod} loading={loading} onRefresh={load} />
        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <ShillmongerLoader className="w-full max-w-md" label="Loading group analytics" />
          </div>
        ) : (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Radio className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold">No signal groups found</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Connect a Telegram provider or wait for signal executions — groups appear here once trades or signals exist.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-1 py-6">
      <PageHeader period={period} onPeriod={changePeriod} loading={loading} onRefresh={load} />

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {loading && (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Loading live group analytics…
        </div>
      )}

      <KpiStrip o={overall} />

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Cumulative net P/L"
          desc="Running profit after fees for each connected group"
        >
          <EquityChart groups={groups} />
        </ChartCard>
        <ChartCard title="Trade outcomes" desc="All groups combined">
          <OutcomeDonut wins={overall.wins} losses={overall.losses} be={overall.be} />
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Net P/L by group" desc="Realized profit after fees and commissions">
          <PnlBars groups={groups} onPick={setSelected} />
        </ChartCard>
        <ChartCard title="Win / loss split" desc="Share of closed trades per group">
          <OutcomeBars groups={groups} onPick={setSelected} />
        </ChartCard>
      </section>

      <Highlights o={overall} groups={groups} />

      {compared.length >= 2 && <ComparePanel groups={compared} onClear={() => setCompareIds([])} />}

      <RankingsTable
        rows={rows}
        search={search} onSearch={setSearch}
        recFilter={recFilter} onRecFilter={setRecFilter}
        sortField={sortField} sortAsc={sortAsc} onSort={onSort}
        compareIds={compareIds} onToggle={toggleCompare}
        onOpen={setSelected}
      />

      {selected && <GroupDrawer group={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ═════════════ Header ═════════════ */

function PageHeader({ period, onPeriod, loading, onRefresh }: { period: TimePeriod; onPeriod: (p: TimePeriod) => void; loading: boolean; onRefresh: () => void }) {
  return (
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Group <span className="text-violet-600 dark:text-violet-400">performance</span>
          </h1>
          {/* <span className={`${plexMono.className} inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400`}>
            <span className={`h-1.5 w-1.5 rounded-full ${loading ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`} />
            {loading ? "Refreshing" : "Live data"}
          </span> */}
        </div>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Results, trade history and recommendations for every Telegram signal group you follow.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border border-border/60 bg-muted/20 p-1">
          {PERIODS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => onPeriod(o.key)}
              aria-pressed={period === o.key}
              className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                period === o.key ? "bg-violet-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </header>
  );
}

/* ═════════════ KPI strip ═════════════ */

type Overall = ReturnType<typeof useOverallType>;
// type helper only (never called)
function useOverallType() { return null as unknown as {
  active: number; total: number; signals: number; executed: number; open: number; wins: number; losses: number; be: number;
  winRate: number; grossProfit: number; grossLoss: number; profitFactor: number; net: number; fees: number; roi: number;
  best: GroupAnalytics; worst: GroupAnalytics; topWin: GroupAnalytics; profitable: number;
}; }

function KpiStrip({ o }: { o: Overall }) {
  const items = [
    { icon: <Users className="h-4 w-4" />, label: "Connected groups", value: `${o.active} / ${o.total}`, sub: `${o.profitable} profitable`, c: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
    { icon: <Radio className="h-4 w-4" />, label: "Signals executed", value: `${o.executed}`, sub: `of ${o.signals} · ${o.open} open now`, c: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
    { icon: <Trophy className="h-4 w-4" />, label: "Win rate", value: `${o.winRate}%`, sub: `${o.wins}W · ${o.losses}L · ${o.be}BE`, c: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    { icon: <TrendingUp className="h-4 w-4" />, label: "Profit factor", value: o.profitFactor.toFixed(2), sub: `${money(o.grossProfit)} won · ${money(o.grossLoss)} lost`, c: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" },
    { icon: <Scale className="h-4 w-4" />, label: "Net P/L after fees", value: signed(o.net), vt: tone(o.net), sub: `Fees paid ${money(o.fees)}`, c: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400" },
    { icon: <Activity className="h-4 w-4" />, label: "Portfolio ROI", value: pct(o.roi), vt: tone(o.roi), sub: "On allocated capital", c: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  ];
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-border/60 bg-card p-4 transition hover:border-violet-500/40">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${it.c}`}>{it.icon}</span>
          <p className={`mt-3 font-mono text-xl font-bold tabular-nums tracking-tight ${it.vt ?? ""}`}>{it.value}</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">{it.label}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground/80">{it.sub}</p>
        </div>
      ))}
    </section>
  );
}

/* ═════════════ Chart shell ═════════════ */

function ChartCard({ title, desc, className = "", children }: { title: string; desc: string; className?: string; children: React.ReactNode }) {
  return (
    <Card className={`border-border/60 shadow-sm ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold tracking-tight">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* ═════════════ Charts (pure SVG, no dependencies) ═════════════ */

function EquityChart({ groups }: { groups: GroupAnalytics[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const W = 800, H = 280, P = { l: 52, r: 16, t: 16, b: 28 };

  const series = useMemo(() => groups.map((g, i) => ({ g, color: SERIES_COLORS[i % SERIES_COLORS.length], data: buildEquityCurve(g) })), [groups]);
  const visible = series.filter((s) => !hidden.includes(s.g.id));
  const all = visible.flatMap((s) => s.data).concat(0);
  const min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  const n = series[0]?.data.length ?? 0;

  const x = (i: number) => P.l + (i / (n - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - min) / span) * (H - P.t - P.b);
  const ticks = Array.from({ length: 5 }, (_, i) => min + (span * i) / 4);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {series.map(({ g, color }) => {
          const off = hidden.includes(g.id);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setHidden((h) => (off ? h.filter((i) => i !== g.id) : [...h, g.id]))}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium transition ${off ? "opacity-40" : ""}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              {g.name}
            </button>
          );
        })}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.min(n - 1, Math.max(0, Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1)))));
        }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="3 4" strokeOpacity={0.6} />
            <text x={P.l - 8} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground" fontSize="10">
              {t < 0 ? "-" : ""}${Math.abs(Math.round(t))}
            </text>
          </g>
        ))}
        <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} className="stroke-foreground" strokeOpacity={0.35} />
        {[0, Math.floor(n / 2), n - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
            {i === 0 ? "Start" : i === n - 1 ? "Now" : "Mid"}
          </text>
        ))}
        {visible.map(({ g, color, data }) => (
          <g key={g.id}>
            <polyline fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
              points={data.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
            <circle cx={x(n - 1)} cy={y(data[n - 1])} r={3.5} fill={color} />
          </g>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} className="stroke-muted-foreground" strokeDasharray="2 3" />
            {visible.map(({ g, color, data }) => <circle key={g.id} cx={x(hover)} cy={y(data[hover])} r={4} fill={color} className="stroke-background" strokeWidth={2} />)}
          </g>
        )}
      </svg>

      {hover !== null && (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-muted/30 px-3 py-2 text-xs">
          {visible.map(({ g, color, data }) => (
            <span key={g.id} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="text-muted-foreground">{g.name}</span>
              <span className={`font-mono font-bold ${tone(data[hover])}`}>{signed(data[hover])}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function OutcomeDonut({ wins, losses, be }: { wins: number; losses: number; be: number }) {
  const total = wins + losses + be || 1;
  const R = 54, C = 2 * Math.PI * R;
  const parts = [
    { label: "Wins", v: wins, color: "#10b981" },
    { label: "Losses", v: losses, color: "#ef4444" },
    { label: "Breakeven", v: be, color: "#94a3b8" },
  ];
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-56 w-56 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" strokeWidth="16" className="stroke-muted/50" />
        {parts.map((p) => {
          const len = (p.v / total) * C;
          const el = (
            <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="16"
              strokeDasharray={`${Math.max(len - 2, 0)} ${C}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
        <g className="rotate-90" style={{ transformOrigin: "70px 70px" }}>
          <text x="70" y="68" textAnchor="middle" className="fill-foreground" fontSize="22" fontWeight="700">
            {Math.round((wins / total) * 100)}%
          </text>
          <text x="70" y="84" textAnchor="middle" className="fill-muted-foreground" fontSize="9">win share</text>
        </g>
      </svg>
      <ul className="w-full space-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
              {p.label}
            </span>
            <span className="font-mono font-semibold tabular-nums">
              {p.v} <span className="text-xs font-normal text-muted-foreground">({((p.v / total) * 100).toFixed(0)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PnlBars({ groups, onPick }: { groups: GroupAnalytics[]; onPick: (g: GroupAnalytics) => void }) {
  const sorted = [...groups].sort((a, b) => b.netPnlAfterFees - a.netPnlAfterFees);
  const max = Math.max(...sorted.map((g) => Math.abs(g.netPnlAfterFees)), 1);
  return (
    <div className="space-y-3">
      {sorted.map((g) => {
        const w = (Math.abs(g.netPnlAfterFees) / max) * 50;
        const pos = g.netPnlAfterFees >= 0;
        return (
          <button key={g.id} type="button" onClick={() => onPick(g)} className="group block w-full cursor-pointer text-left">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-semibold group-hover:text-violet-500">{g.name}</span>
              <span className={`font-mono font-bold tabular-nums ${tone(g.netPnlAfterFees)}`}>
                {signed(g.netPnlAfterFees)} <span className="font-normal text-muted-foreground">· {pct(g.roi)}</span>
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-muted/40">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div
                className={`absolute inset-y-0 rounded-full transition-all ${pos ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-500"}`}
                style={{ width: `${Math.max(w, 1.5)}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function OutcomeBars({ groups, onPick }: { groups: GroupAnalytics[]; onPick: (g: GroupAnalytics) => void }) {
  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const t = g.wins + g.losses + g.breakeven || 1;
        return (
          <button key={g.id} type="button" onClick={() => onPick(g)} className="group block w-full cursor-pointer text-left">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-semibold group-hover:text-violet-500">{g.name}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {g.wins}W · {g.losses}L · {g.breakeven}BE
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted/40">
              <div className="bg-emerald-500" style={{ width: `${(g.wins / t) * 100}%` }} />
              <div className="bg-slate-400/70" style={{ width: `${(g.breakeven / t) * 100}%` }} />
              <div className="bg-red-500" style={{ width: `${(g.losses / t) * 100}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ═════════════ Highlights ═════════════ */

function Highlights({ o, groups }: { o: Overall; groups: GroupAnalytics[] }) {
  // Best pair is computed from the data rather than hard-coded
  const pairs = useMemo(() => {
    const map = new Map<string, number>();
    groups.forEach((g) => g.pairBreakdown.forEach((p: GroupAnalytics["pairBreakdown"][number]) => map.set(p.symbol, (map.get(p.symbol) ?? 0) + p.netPnl)));
    return [...map.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [groups]);

  const cards = [
    { title: "Most profitable", icon: <Crown className="h-4 w-4 text-emerald-500" />, name: o.best.name, metric: signed(o.best.netPnlAfterFees), mt: tone(o.best.netPnlAfterFees), sub: `${pct(o.best.roi)} ROI · PF ${o.best.profitFactor}` },
    { title: "Biggest loss", icon: <TrendingDown className="h-4 w-4 text-rose-500" />, name: o.worst.name, metric: signed(o.worst.netPnlAfterFees), mt: tone(o.worst.netPnlAfterFees), sub: `${o.worst.winRate}% win rate · ${o.worst.losses} losses` },
    { title: "Highest win rate", icon: <Trophy className="h-4 w-4 text-violet-500" />, name: o.topWin.name, metric: `${o.topWin.winRate}%`, mt: "text-violet-600 dark:text-violet-400", sub: `Profit factor ${o.topWin.profitFactor}` },
    { title: "Best pair", icon: <BarChart3 className="h-4 w-4 text-sky-500" />, name: pairs?.[0] ?? "-", metric: signed(pairs?.[1] ?? 0), mt: tone(pairs?.[1] ?? 0), sub: "Net across all groups" },
  ];

  return (
    <section className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title} className="border-border/60 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">{c.icon}{c.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-sm font-bold">{c.name}</p>
            <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${c.mt}`}>{c.metric}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

/* ═════════════ Compare ═════════════ */

function ComparePanel({ groups, onClear }: { groups: GroupAnalytics[]; onClear: () => void }) {
  const metrics: { label: string; render: (g: GroupAnalytics) => React.ReactNode }[] = [
    { label: "Net P/L after fees", render: (g) => <b className={tone(g.netPnlAfterFees)}>{signed(g.netPnlAfterFees)}</b> },
    { label: "ROI", render: (g) => <b className={tone(g.roi)}>{pct(g.roi)}</b> },
    { label: "Profit factor", render: (g) => <b>{g.profitFactor.toFixed(2)}</b> },
    { label: "Win rate", render: (g) => `${g.winRate}% (${g.wins}W / ${g.losses}L)` },
    { label: "Capital / volume", render: (g) => `${money(g.allocatedCapital)} / ${g.totalVolume} lots` },
    { label: "Fees", render: (g) => `-${money(g.totalFees)}` },
    { label: "Stability", render: (g) => `${g.consistencyScore}/100` },
    { label: "Trend", render: (g) => <TrendBadge direction={g.trendDirection} /> },
  ];
  return (
    <Card className="border-violet-500/40 bg-violet-500/[0.03] shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <Layers className="h-4 w-4 text-violet-500" /> Comparing {groups.length} groups
          </CardTitle>
          <CardDescription>Side-by-side on return, risk, cost and consistency</CardDescription>
        </div>
        <button type="button" onClick={onClear} className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          Clear selection
        </button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Metric</th>
              {groups.map((g) => <th key={g.id} className="px-4 py-2 font-bold text-foreground">{g.name}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-xs">
            {metrics.map((m) => (
              <tr key={m.label}>
                <td className="py-2.5 pr-4 font-medium text-muted-foreground">{m.label}</td>
                {groups.map((g) => <td key={g.id} className="px-4 py-2.5 font-mono tabular-nums">{m.render(g)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/* ═════════════ Rankings table ═════════════ */

const TH = "px-3 py-3 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap select-none";
const TD = "px-3 py-3.5 text-sm font-medium tabular-nums whitespace-nowrap";

function SortableTh({ label, field, sortField, sortAsc, onSort }: {
  label: string; field: SortField; sortField: SortField; sortAsc: boolean; onSort: (f: SortField) => void;
}) {
  return (
    <th onClick={() => onSort(field)} className={`${TH} cursor-pointer text-right hover:text-foreground`}>
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {sortField === field && <span className="text-[9px]">{sortAsc ? "▲" : "▼"}</span>}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-violet-500" : "opacity-40"}`} />
      </span>
    </th>
  );
}

function RankingsTable(props: {
  rows: GroupAnalytics[];
  search: string; onSearch: (v: string) => void;
  recFilter: RecommendationType | "ALL"; onRecFilter: (v: RecommendationType | "ALL") => void;
  sortField: SortField; sortAsc: boolean; onSort: (f: SortField) => void;
  compareIds: string[]; onToggle: (id: string) => void;
  onOpen: (g: GroupAnalytics) => void;
}) {
  const { rows, sortField, sortAsc, compareIds } = props;

  return (
    <Card className="gap-0 overflow-hidden border-border/60 p-0 shadow-sm">
      <CardHeader className="flex flex-col justify-between gap-4 border-b border-border/50 py-4 md:flex-row md:items-center">
        <div>
          <CardTitle className="text-lg font-bold tracking-tight">Group rankings and advice</CardTitle>
          <CardDescription className="mt-1">Open a row for trade history and signal diagnostics. Tick up to 4 groups to compare.</CardDescription>
        </div>
        
<div className="flex flex-wrap items-center gap-3">
  {/* Search */}
  <div className="relative">
    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <input
      type="text"
      placeholder="Search group or @handle"
      value={props.search}
      onChange={(e) => props.onSearch(e.target.value)}
      className="h-11 rounded-full border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
    />
  </div>

  {/* Filter */}
  <div className="flex h-11 items-center gap-2 rounded-full border border-border bg-background px-3.5">
    <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />

    <select
      value={props.recFilter}
      onChange={(e) =>
        props.onRecFilter(
          e.target.value as RecommendationType | "ALL"
        )
      }
      className="h-full min-w-[170px] cursor-pointer bg-transparent text-sm font-medium text-foreground outline-none"
    >
      <option value="ALL" className="bg-background text-foreground">
        All recommendations
      </option>
      {(["KEEP", "MONITOR", "REVIEW", "CONSIDER LEAVING"] as const).map((r) => (
        <option
          key={r}
          value={r}
          className="bg-background text-foreground"
        >
          {r}
        </option>
      ))}
    </select>
  </div>
</div>

      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: 1320 }}>
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className={TH}>Compare</th>
              <th className={TH}>#</th>
              <th className={TH}>Group</th>
              <SortableTh label="Signals" field="totalSignals" sortField={sortField} sortAsc={sortAsc} onSort={props.onSort} />
              <th className={`${TH} text-right`}>Executed</th>
              <SortableTh label="Win rate" field="winRate" sortField={sortField} sortAsc={sortAsc} onSort={props.onSort} />
              <th className={`${TH} text-right`}>Gross P / L</th>
              <th className={`${TH} text-right`}>Fees</th>
              <SortableTh label="Net P/L" field="netPnlAfterFees" sortField={sortField} sortAsc={sortAsc} onSort={props.onSort} />
              <SortableTh label="ROI" field="roi" sortField={sortField} sortAsc={sortAsc} onSort={props.onSort} />
              <SortableTh label="PF" field="profitFactor" sortField={sortField} sortAsc={sortAsc} onSort={props.onSort} />
              <SortableTh label="Stability" field="consistencyScore" sortField={sortField} sortAsc={sortAsc} onSort={props.onSort} />
              <th className={`${TH} text-right`}>Trend</th>
              <th className={TH}>Recommendation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.length === 0 && (
              <tr><td colSpan={14} className="py-12 text-center text-sm text-muted-foreground">No groups match your filters. Clear the search or pick another recommendation.</td></tr>
            )}
            {rows.map((g, i) => {
              const rec = REC_STYLE[g.recommendation];
              const checked = compareIds.includes(g.id);
              return (
                <tr key={g.id} onClick={() => props.onOpen(g)} className="cursor-pointer transition-colors hover:bg-muted/30">
                  <td className={TD} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox" checked={checked} onChange={() => props.onToggle(g.id)}
                      disabled={!checked && compareIds.length >= 4} aria-label={`Compare ${g.name}`}
                      className="h-4 w-4 cursor-pointer rounded border-border accent-violet-600"
                    />
                  </td>
                  <td className={`${TD} font-bold text-muted-foreground`}>
                    {i === 0 && !sortAsc && sortField === "netPnlAfterFees" ? <Crown className="inline h-4 w-4 text-amber-500" /> : i + 1}
                  </td>
                  <td className={TD}>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300">
                        <MessageCircle className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="max-w-[200px] truncate font-bold">{g.name}</p>
                          <span className="rounded bg-emerald-500/10 px-1.5 text-[10px] font-semibold text-emerald-600">{g.status}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {g.username ? `@${g.username} · ` : ""}{g.membersCount.toLocaleString()} members
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={`${TD} text-right`}>
                    <div>{g.totalSignals}</div>
                    <div className="text-[10px] text-muted-foreground">{g.signalStats.conversionRate}% converted</div>
                  </td>
                  <td className={`${TD} text-right`}>
                    {g.totalExecuted}
                    {g.openTradesCount > 0 && <span className="ml-1 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-500">{g.openTradesCount} open</span>}
                  </td>
                  <td className={`${TD} text-right`}>
                    <span className="font-bold">{g.winRate}%</span>
                    <div className="mx-0 ml-auto mt-1 h-1 w-16 overflow-hidden rounded-full bg-muted/50">
                      <div className="h-full bg-emerald-500" style={{ width: `${g.winRate}%` }} />
                    </div>
                  </td>
                  <td className={`${TD} text-right text-xs`}>
                    <div className="text-emerald-600 dark:text-emerald-400">+{money(g.grossProfit)}</div>
                    <div className="text-red-600 dark:text-red-400">-{money(g.grossLoss)}</div>
                  </td>
                  <td className={`${TD} text-right text-xs text-muted-foreground`}>-{money(g.totalFees)}</td>
                  <td className={`${TD} text-right font-extrabold ${tone(g.netPnlAfterFees)}`}>{signed(g.netPnlAfterFees)}</td>
                  <td className={`${TD} text-right font-bold ${tone(g.roi)}`}>{pct(g.roi)}</td>
                  <td className={`${TD} text-right`}>{g.profitFactor.toFixed(2)}</td>
                  <td className={`${TD} text-right`}>{g.consistencyScore}/100</td>
                  <td className={`${TD} text-right`}><TrendBadge direction={g.trendDirection} /></td>
                  <td className={TD}>
                    <span title={g.recommendationReasons.join(" ")} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${rec.cls}`}>
                      {rec.icon}{g.recommendation}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TrendBadge({ direction }: { direction: GroupAnalytics["trendDirection"] }) {
  if (direction === "IMPROVING")
    return <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"><ArrowUpRight className="h-3 w-3" />Improving</span>;
  if (direction === "DETERIORATING")
    return <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400"><ArrowDownRight className="h-3 w-3" />Declining</span>;
  return <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">Stable</span>;
}

/* ═════════════ Detail drawer ═════════════ */

function DrawerStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 font-mono text-sm font-bold">{children}</div>
    </div>
  );
}

function GroupDrawer({ group, onClose }: { group: GroupAnalytics; onClose: () => void }) {
  const rec = REC_STYLE[group.recommendation];
  const s = group.signalStats;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const funnel = [
    { label: "Received", v: s.totalReceived },
    { label: "Processed", v: s.processed },
    { label: "Executed", v: s.executed },
  ];
  const dropped = [
    { label: "Ignored / rejected", v: s.ignoredOrRejected },
    { label: "Failed / invalid", v: s.failedExecution + s.invalid },
    { label: "Duplicate / expired", v: s.duplicates + s.expiredOrMissed },
  ];

  return (
    <div className="fixed inset-0 z-500 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l border-border bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold">{group.name}</h2>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${rec.cls}`}>{rec.icon}{group.recommendation}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-mono">{group.tgId}</span> · Added {group.addedAt} · {group.membersCount.toLocaleString()} members
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3.5">
          <p className="text-sm font-bold text-violet-600 dark:text-violet-400">Why this recommendation</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs">{group.recommendationReasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DrawerStat label="Net P/L after fees"><span className={tone(group.netPnlAfterFees)}>{signed(group.netPnlAfterFees)}</span></DrawerStat>
          <DrawerStat label="Avg win / avg loss"><span className="text-emerald-500">+{money(group.avgWin)}</span> / <span className="text-red-500">-{money(group.avgLoss)}</span></DrawerStat>
          <DrawerStat label="Best / worst trade"><span className="text-emerald-500">+{money(group.largestWin)}</span> / <span className="text-red-500">-{money(group.largestLoss)}</span></DrawerStat>
          <DrawerStat label="Avg duration / streaks">{group.avgDurationMin}m · {group.maxWinStreak}W / {group.maxLossStreak}L</DrawerStat>
        </div>

        {/* Funnel */}
        <section className="mt-7">
          <h3 className="text-sm font-bold">Signal funnel</h3>
          <div className="mt-3 space-y-2">
            {funnel.map((f) => (
              <div key={f.label} className="flex items-center gap-3 text-xs">
                <span className="w-20 text-muted-foreground">{f.label}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted/40">
                  <div className="h-full rounded-md bg-violet-500/80" style={{ width: `${(f.v / (s.totalReceived || 1)) * 100}%` }} />
                </div>
                <span className="w-10 text-right font-mono font-bold">{f.v}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {dropped.map((d) => (
              <div key={d.label} className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-center">
                <p className="font-mono text-sm font-bold">{d.v}</p>
                <p className="text-[10px] text-muted-foreground">{d.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Average latency <strong className="text-foreground">{s.avgLatencySec}s</strong> · Signal accuracy <strong className="text-foreground">{s.signalAccuracy}%</strong>
          </p>
        </section>

        <section className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-3.5">
            <h4 className="text-sm font-bold">Pairs</h4>
            <div className="mt-2 space-y-2">
              {group.pairBreakdown.map((p: GroupAnalytics["pairBreakdown"][number]) => (
                <div key={p.symbol} className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{p.symbol} <span className="font-normal text-muted-foreground">{p.trades} trades · {p.winRate}% win</span></span>
                  <span className={`font-mono font-bold ${tone(p.netPnl)}`}>{signed(p.netPnl)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border p-3.5">
            <h4 className="text-sm font-bold">Days and open exposure</h4>
            <dl className="mt-2 space-y-2 text-xs">
              {[
                ["Best day", `${group.bestTradingDay.date} (${signed(group.bestTradingDay.pnl)})`, "text-emerald-500"],
                ["Worst day", `${group.worstTradingDay.date} (${signed(group.worstTradingDay.pnl)})`, "text-red-500"],
                ["Open / pending", `${group.openTradesCount} / ${group.pendingTradesCount}`, ""],
                ["Floating P/L", signed(group.unrealizedPnl), tone(group.unrealizedPnl)],
              ].map(([k, v, c]) => (
                <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className={`font-mono font-bold ${c}`}>{v}</dd></div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mt-7">
          <h3 className="text-sm font-bold">Recent trades</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30 text-[11px] text-muted-foreground">
                <tr>
                  {["Symbol", "Side", "Status", "Signal", "Fees", "Net P/L"].map((h, i) => (
                    <th key={h} className={`px-3 py-2 font-semibold ${i > 3 ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {group.recentTrades.map((t: GroupAnalytics["recentTrades"][number]) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 font-bold">{t.symbol}</td>
                    <td className={`px-3 py-2 font-semibold ${t.side === "BUY" ? "text-emerald-500" : "text-red-500"}`}>{t.side}</td>
                    <td className="px-3 py-2"><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{t.status}</span></td>
                    <td className="px-3 py-2 text-muted-foreground">#{t.signalId}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">-{money(t.fees)}</td>
                    <td className={`px-3 py-2 text-right font-bold ${tone(t.netPnl)}`}>{signed(t.netPnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}