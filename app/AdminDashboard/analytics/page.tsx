"use client";

import { useEffect, useMemo, useState } from "react";
import { IBM_Plex_Mono } from "next/font/google";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Radio,
  Trophy,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

/* ───────────────── Types & helpers (mirrors trading-setup analytics) ───────────────── */

interface DayPoint { date: string; value: number }
interface PnlPoint { x: string; value: number }
interface ExecPoint { x: string; success: number; failed: number }

const PROFIT_COLOR = "#10b981";
const LOSS_COLOR = "#ef4444";

const pnlConfig = {
  value: { label: "Net P/L", color: PROFIT_COLOR },
} satisfies ChartConfig;

const execConfig = {
  success: { label: "Executed", color: PROFIT_COLOR },
  failed: { label: "Failed", color: LOSS_COLOR },
} satisfies ChartConfig;

const money = (v: number) =>
  `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (v: number) => `${v >= 0 ? "+" : "-"}${money(v)}`;
const plTone = (v: number) => (v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400");
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
const longDate = (d: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(d));

function sumChunks(points: DayPoint[], size: number): PnlPoint[] {
  const out: PnlPoint[] = [];
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size);
    out.push({ x: shortDate(chunk[0].date), value: chunk.reduce((a, p) => a + p.value, 0) });
  }
  return out;
}

/* ───────────────── Mock data (seeded, generated once on mount) ───────────────── */

interface MockData {
  daily: DayPoint[];
  signals: { x: string; value: number }[];
  execs: ExecPoint[];
  wins: number;
  losses: number;
  totalSignals: number;
  totalTrades: number;
  activeUsers: number;
}

/** Deterministic PRNG so the mock data is stable across renders. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMock(): MockData {
  const rand = mulberry32(20260214);
  const DAY = 86400000;
  const now = Date.now();

  // 90 days of P/L — gentle upward drift with noise
  const daily: DayPoint[] = Array.from({ length: 90 }, (_, i) => {
    const drift = (i - 45) * 4;
    const noise = (rand() - 0.42) * 900;
    return {
      date: new Date(now - (89 - i) * DAY).toISOString(),
      value: Math.round((drift + noise) * 100) / 100,
    };
  });

  // Last 30 days: signals received + executions
  const signals = Array.from({ length: 30 }, (_, i) => ({
    x: shortDate(new Date(now - (29 - i) * DAY).toISOString()),
    value: Math.floor(20 + rand() * 60),
  }));
  const execs: ExecPoint[] = Array.from({ length: 30 }, (_, i) => {
    const total = Math.floor(8 + rand() * 30);
    const failed = Math.floor(rand() * total * 0.25);
    return {
      x: shortDate(new Date(now - (29 - i) * DAY).toISOString()),
      success: total - failed,
      failed,
    };
  });

  const wins = 148 + Math.floor(rand() * 60);
  const losses = 61 + Math.floor(rand() * 40);

  return {
    daily,
    signals,
    execs,
    wins,
    losses,
    totalSignals: 3842,
    totalTrades: wins + losses + 19,
    activeUsers: 30,
  };
}

/* ───────────────── Small building blocks ───────────────── */

const MockBadge = () => (
  <span className={`${plexMono.className} inline-flex whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-600 dark:text-amber-400`}>
    MOCK DATA
  </span>
);

function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-border/60 bg-muted/20 p-1">
      {options.map((o) => (
        <button
          key={o.key} type="button" onClick={() => onChange(o.key)} aria-pressed={value === o.key}
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === o.key ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="group rounded-2xl border border-violet-500/20 bg-card p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-900/10">
      <div className="flex items-start justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${tone}`}>
          {icon}
        </span>
        <MockBadge />
      </div>
      <p className="mt-2 text-xl font-extrabold tracking-tight tabular-nums font-mono">{value}</p>
      <p className={`${plexMono.className} mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground`}>
        {label}
      </p>
    </div>
  );
}

/* ───────────────── Charts ───────────────── */

function PnlBarChart({
  data, tickFormatter, labelFormatter, height = "h-[250px]",
}: {
  data: PnlPoint[];
  tickFormatter?: (v: string) => string;
  labelFormatter?: (v: string) => string;
  height?: string;
}) {
  return (
    <ChartContainer config={pnlConfig} className={`aspect-auto ${height} w-full`}>
      <BarChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="x" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={tickFormatter} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              className="w-[170px]"
              hideIndicator
              labelFormatter={(v) => (labelFormatter ? labelFormatter(String(v)) : String(v))}
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">Net P/L</span>
                  <span className={`font-mono font-bold tabular-nums ${plTone(Number(value))}`}>{signed(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="value" radius={3}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function SignalsBarChart({ data }: { data: { x: string; value: number }[] }) {
  return (
    <ChartContainer config={{ value: { label: "Signals", color: "#8b5cf6" } }} className="aspect-auto h-[220px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="x" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent className="w-[150px]" hideIndicator labelFormatter={(v) => String(v)} />} />
        <Bar dataKey="value" fill="#8b5cf6" radius={3} />
      </BarChart>
    </ChartContainer>
  );
}

function ExecBarChart({ data }: { data: ExecPoint[] }) {
  return (
    <ChartContainer config={execConfig} className="aspect-auto h-[220px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="x" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="success" stackId="a" fill={PROFIT_COLOR} radius={[0, 0, 0, 0]} />
        <Bar dataKey="failed" stackId="a" fill={LOSS_COLOR} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/* ───────────────── Page ───────────────── */

export default function AdminAnalyticsPage() {
  const [mock, setMock] = useState<MockData | null>(null);
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");

  // Deferred so Date.now() + setState don't run synchronously in the effect
  // body (react-hooks/purity + set-state-in-effect rules).
  useEffect(() => {
    const t = setTimeout(() => setMock(buildMock()), 0);
    return () => clearTimeout(t);
  }, []);

  const daily = useMemo(
    () => (mock ? mock.daily.slice(-Number(period)).map((p) => ({ x: p.date, value: p.value })) : []),
    [mock, period],
  );
  const weekly = useMemo(() => (mock ? sumChunks(mock.daily.slice(-84), 7) : []), [mock]);
  const monthly = useMemo(() => (mock ? sumChunks(mock.daily, 30) : []), [mock]);

  const total = daily.reduce((a, d) => a + d.value, 0);
  const best = daily.length ? Math.max(...daily.map((d) => d.value)) : 0;
  const worst = daily.length ? Math.min(...daily.map((d) => d.value)) : 0;

  const winRate = mock ? Math.round((mock.wins / (mock.wins + mock.losses)) * 100) : 0;
  const summary = [
    { label: "Net", value: total },
    { label: "Best day", value: best },
    { label: "Worst day", value: worst },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
            [ // BOT ANALYTICS ]
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-extrabold uppercase tracking-tight">
            Platform <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">Analytics</span>
            <MockBadge />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregate trading performance across all connected users and signals.
          </p>
        </div>
      </div>

      {/* top stats — same StatCard style as /UserDashboard/dashboard */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<Radio className="h-4 w-4" />} label="Signals Received" value={mock ? mock.totalSignals.toLocaleString("en-US") : "—"} tone="bg-violet-500/15 text-violet-600 dark:text-violet-400" />
        <StatCard icon={<Zap className="h-4 w-4" />} label="Trades Executed" value={mock ? mock.totalTrades.toLocaleString("en-US") : "—"} tone="bg-sky-500/15 text-sky-600 dark:text-sky-400" />
        <StatCard icon={<Trophy className="h-4 w-4" />} label="Win Rate" value={mock ? `${winRate}%` : "—"} tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
        <StatCard icon={<Users className="h-4 w-4" />} label="Active Users" value={mock ? String(mock.activeUsers) : "—"} tone="bg-amber-500/15 text-amber-600 dark:text-amber-400" />
      </section>

      {/* Daily P/L */}
      <Card className="border-violet-500/20 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-xl font-extrabold tracking-tight">
                Daily Profit / Loss <MockBadge />
              </CardTitle>
              <CardDescription className="mt-1">Net result per day over the last {period} days</CardDescription>
            </div>
            <Segmented value={period} onChange={setPeriod} options={[{ key: "7", label: "7D" }, { key: "30", label: "30D" }, { key: "90", label: "90D" }]} />
            <div className="flex overflow-hidden rounded-xl border border-border/60">
              {summary.map((s, i) => (
                <div key={s.label} className={`flex flex-1 flex-col justify-center gap-0.5 px-4 py-2.5 text-left ${i > 0 ? "border-l border-border/60" : ""}`}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
                  <span className={`font-mono text-sm font-bold leading-none tabular-nums ${plTone(s.value)}`}>{signed(s.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {mock ? (
            <PnlBarChart data={daily} tickFormatter={shortDate} labelFormatter={longDate} height="h-[280px]" />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-muted-foreground">
              <BarChart3 className="h-6 w-6 animate-pulse" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xl font-extrabold tracking-tight">Weekly Performance</CardTitle>
              <MockBadge />
            </div>
            <CardDescription>Net P/L per week, last 12 weeks</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {mock ? <PnlBarChart data={weekly} height="h-[220px]" /> : null}
          </CardContent>
        </Card>

        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xl font-extrabold tracking-tight">Monthly Performance</CardTitle>
              <MockBadge />
            </div>
            <CardDescription>Net P/L per 30-day period, last 90 days</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {mock ? <PnlBarChart data={monthly} height="h-[220px]" /> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Signals received */}
        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xl font-extrabold tracking-tight">Signals Received</CardTitle>
              <MockBadge />
            </div>
            <CardDescription>Telegram signals ingested per day, last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {mock && <SignalsBarChart data={mock.signals} />}
          </CardContent>
        </Card>

        {/* Executions */}
        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xl font-extrabold tracking-tight">Trade Executions</CardTitle>
              <MockBadge />
            </div>
            <CardDescription>Executed vs failed orders per day, last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {mock && (
              <>
                <ExecBarChart data={mock.execs} />
                <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Executed
                  </span>
                  <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <XCircle className="h-3.5 w-3.5" /> Failed
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Winning vs losing — full width, last section */}
      <Card className="border-violet-500/20 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xl font-extrabold tracking-tight">Winning vs Losing Trades</CardTitle>
          <MockBadge />
        </CardHeader>
        <CardContent className="space-y-3">
          {mock && (
            <>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="bg-emerald-500" style={{ width: `${winRate}%` }} />
                <div className="bg-red-500" style={{ width: `${100 - winRate}%` }} />
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-xs font-semibold">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight className="h-3.5 w-3.5" /> {mock.wins} winning
                </span>
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <ArrowDownRight className="h-3.5 w-3.5" /> {mock.losses} losing
                </span>
                <span>Win rate {winRate}%</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
