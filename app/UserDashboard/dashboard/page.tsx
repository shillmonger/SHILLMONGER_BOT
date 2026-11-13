"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IBM_Plex_Mono } from "next/font/google";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Coins,
  Repeat,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/* ───────────────── Types ───────────────── */

interface TradeRow {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  entry: number;
  lotSize: number;
  date: string;
  profit: number;
  status: "WIN" | "LOSS" | "OPEN";
}

interface NewsItem {
  id: string;
  title: string;
  source: string;
  image: string;
  url?: string;
}

interface CalendarItem {
  id: string;
  country: string;
  title: string;
  time: string;
  impact: "High" | "Medium" | "Low";
}

interface ActivePlan {
  name: string;
  amount: number;
  accountSize: string;
  duration: string;
  expires: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
}

interface DayPoint {
  date: string; // ISO date
  value: number; // daily profit (USD)
}

/* Shape returned by /api/user/trading/executions (TRADE_EXECUTIONS docs) */
interface ExecDoc {
  _id: string;
  dealId?: string | null;
  symbol?: string | null;
  epic?: string | null;
  direction?: "BUY" | "SELL" | null;
  entryLevel?: number | null;
  size?: number | null;
  environment?: "demo" | "live" | null;
  status?: string | null;
  realizedPnl?: number | null;
  unrealizedPnl?: number | null;
  openedAt?: string | null;
  closedAt?: string | null;
  createdAt?: string | null;
}

type Mode = "demo" | "live";

interface DashboardData {
  totalTrades: number;
  billing: number;
  credits: number;
  totalProfit: number;
  totalLosses: number;
  activePlan: ActivePlan | null;
  tradingCalendar: CalendarItem[];
  calendarAttribution?: string;
  news: NewsItem[];
  performance: Record<Mode, DayPoint[]>;
  recentTrades: TradeRow[];
}

// TODO: replace with real thumbnails per article once the news API is wired up.
const MOCK_NEWS_IMAGE =
  "https://i.postimg.cc/MT3ww0Cb/bull1.jpg";

const MOCK_NEWS: NewsItem[] = [
  { id: "NEWS-001", title: "EUR/USD Analysis: Euro Loses Momentum Following the U.S. PCE Release", source: "Forexcom", image: MOCK_NEWS_IMAGE },
  { id: "NEWS-002", title: "Euro: Rally stalls against US Dollar as spreads drive trade – Scotiabank", source: "FX Street", image: MOCK_NEWS_IMAGE },
  { id: "NEWS-003", title: "Pound Sterling Price News and Forecast: GBP/USD retreats as sticky PCE revives Fed hike bets", source: "FX Street", image: MOCK_NEWS_IMAGE },
  { id: "NEWS-004", title: "USD/CAD Turns Bullish as GBP/USD, AUD/USD Lose Momentum", source: "FXEmpire", image: MOCK_NEWS_IMAGE },
];

const MOCK_CALENDAR: CalendarItem[] = [
  { id: "CAL-001", country: "US", title: "Non-Farm Payrolls", time: "08:30 AM", impact: "High" },
  { id: "CAL-002", country: "EU", title: "ECB Interest Rate Decision", time: "12:45 PM", impact: "High" },
  { id: "CAL-003", country: "UK", title: "GDP Growth Rate", time: "09:00 AM", impact: "Medium" },
  { id: "CAL-004", country: "JP", title: "BOJ Monetary Policy", time: "03:00 AM", impact: "Low" },
];

/* ───────────────── Helpers ───────────────── */

async function fetchDashboardCalendar(): Promise<{
  items: CalendarItem[];
  attribution: string;
}> {
  try {
    const response = await fetch("/api/user/calendar", { cache: "no-store" });

    if (!response.ok) {
      return { items: MOCK_CALENDAR, attribution: "" };
    }

    const payload = await response.json();

    if (
      !payload.success ||
      !Array.isArray(payload.calendar) ||
      payload.calendar.length === 0
    ) {
      return { items: MOCK_CALENDAR, attribution: "" };
    }

    return {
      items: payload.calendar.map(
        (item: Partial<CalendarItem> & { id: string }) => ({
          id: item.id,
          country: item.country ?? "US",
          title: item.title ?? "",
          time: item.time ?? "",
          impact: item.impact ?? "Low",
        })
      ),
      attribution: payload.attribution ?? "",
    };
  } catch {
    return { items: MOCK_CALENDAR, attribution: "" };
  }
}

async function fetchDashboardNews(): Promise<NewsItem[]> {
  try {
    const response = await fetch("/api/user/news", { cache: "no-store" });

    if (!response.ok) {
      return MOCK_NEWS;
    }

    const payload = await response.json();

    if (!payload.success || !Array.isArray(payload.news) || payload.news.length === 0) {
      return MOCK_NEWS;
    }

    return payload.news.map((item: Partial<NewsItem> & { id: string }) => ({
      id: item.id,
      title: item.title ?? "",
      source: item.source ?? "MarketAux",
      image: item.image || MOCK_NEWS_IMAGE,
      url: item.url,
    }));
  } catch {
    return MOCK_NEWS;
  }
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatCurrency(value: number) {
  return `$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

const IMPACT_CLS: Record<CalendarItem["impact"], string> = {
  High: "text-rose-600 dark:text-rose-400",
  Medium: "text-amber-600 dark:text-amber-400",
  Low: "text-muted-foreground",
};

/* ───────── Real-data mappers (TRADE_EXECUTIONS) ───────── */

const EXEC_TERMINAL_BAD = new Set(["failed", "cancelled", "rejected"]);
const EXEC_OPEN = new Set(["open", "pending", "submitted"]);

function execProfit(e: ExecDoc): number {
  return EXEC_OPEN.has(e.status ?? "")
    ? (e.unrealizedPnl ?? 0)
    : (e.realizedPnl ?? 0);
}

function execTimestamp(e: ExecDoc): string {
  return e.closedAt ?? e.openedAt ?? e.createdAt ?? new Date(0).toISOString();
}

function toRecentTrade(e: ExecDoc): TradeRow {
  const profit = execProfit(e);
  const open = EXEC_OPEN.has(e.status ?? "");
  return {
    id: (e.dealId ?? e._id).slice(-8).toUpperCase(),
    symbol: e.symbol || e.epic || "—",
    type: e.direction === "SELL" ? "SELL" : "BUY",
    entry: e.entryLevel ?? 0,
    lotSize: e.size ?? 0,
    date: execTimestamp(e),
    profit,
    status: open ? "OPEN" : profit >= 0 ? "WIN" : "LOSS",
  };
}

/** Daily realized P/L per environment, starting at the user's first
 *  execution (never before) and capped at `days` back. */
function buildPerformanceSeries(
  execs: ExecDoc[],
  days = 90,
): Record<Mode, DayPoint[]> {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const earliestAllowed = now - (days - 1) * DAY;

  // First day the user ever executed — the axis must not show days
  // before trading started.
  const firstTrade = execs.reduce((min, e) => {
    const t = Date.parse(e.createdAt ?? e.openedAt ?? e.closedAt ?? "");
    return Number.isFinite(t) && t < min ? t : min;
  }, Infinity);
  const firstDay = Number.isFinite(firstTrade)
    ? Math.floor(firstTrade / DAY) * DAY
    : earliestAllowed;
  const start = Math.max(earliestAllowed, firstDay);
  const count = Math.max(
    1,
    Math.min(days, Math.floor((now - start) / DAY) + 1)
  );

  const buckets: Record<Mode, Map<string, number>> = {
    demo: new Map(),
    live: new Map(),
  };

  for (const e of execs) {
    const env = e.environment === "live" ? "live" : "demo";
    const pnl = execProfit(e);
    if (!pnl) continue;
    const t = Date.parse(execTimestamp(e));
    if (!Number.isFinite(t) || t < start) continue;
    const key = new Date(t).toISOString().slice(0, 10);
    buckets[env].set(key, (buckets[env].get(key) ?? 0) + pnl);
  }

  const out = {} as Record<Mode, DayPoint[]>;
  for (const mode of ["demo", "live"] as Mode[]) {
    out[mode] = Array.from({ length: count }, (_, i) => {
      const date = new Date(start + i * DAY);
      const key = date.toISOString().slice(0, 10);
      return { date: date.toISOString(), value: buckets[mode].get(key) ?? 0 };
    });
  }
  return out;
}

/* ───────────────── Building blocks ───────────────── */

function StatCard({
  icon,
  label,
  value,
  change,
  trend,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
  tone: string;
}) {
  return (
    <div className="group rounded-2xl border border-violet-500/20 bg-card p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-900/10">
      <div className="flex items-start justify-between">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${tone}`}
        >
          {icon}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            trend === "up"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {trend === "up" ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {change}
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

function ViewAllButton({ href }: { href: string }) {
  return (
    <Link href={href}>
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-lg border-violet-500/40 bg-violet-500/10 text-xs font-semibold text-violet-600 hover:bg-violet-500/20 dark:text-violet-300"
      >
        View All
      </Button>
    </Link>
  );
}

function CalendarRow({ item }: { item: CalendarItem }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-[11px] font-bold text-violet-600 dark:text-violet-300">
          {item.country}
        </span>
        <div>
          <p className="text-sm font-bold leading-tight">{item.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.time}</p>
        </div>
      </div>
      <span className={`shrink-0 text-xs font-medium ${IMPACT_CLS[item.impact]}`}>
        {item.impact}
      </span>
    </div>
  );
}


function NewsRow({ item }: { item: NewsItem }) {
  const content = (
    <div className="group flex items-center gap-4 rounded-xl px-3 py-2 transition-all duration-200 hover:bg-muted/40">
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={item.title}
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src !== MOCK_NEWS_IMAGE) {
              img.src = MOCK_NEWS_IMAGE;
            }
          }}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-bold leading-snug transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-300">
          {item.title}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.source}
        </p>
      </div>
    </div>
  );

  if (!item.url) {
    return (
      <div className="border-b border-border/60 last:border-b-0">
        {content}
      </div>
    );
  }

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <Link
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {content}
      </Link>
    </div>
  );
}


/* ───────────────── Interactive bar chart (Demo / Live) ───────────────── */

type Period = "7" | "30" | "90";

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

const TONE_META = {
  profit: {
    label: "Profit",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  loss: {
    label: "Loss",
    bar: "bg-red-500",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
  flat: {
    label: "No activity",
    bar: "bg-zinc-400/40",
    dot: "bg-zinc-400",
    text: "text-muted-foreground",
  },
} as const;

type Tone = keyof typeof TONE_META;
const toneOf = (value: number): Tone =>
  value > 0 ? "profit" : value < 0 ? "loss" : "flat";

function PerformanceBarChart({
  series,
}: {
  series: Record<Mode, DayPoint[]>;
}) {
  const [mode, setMode] = useState<Mode>("demo");
  const [period, setPeriod] = useState<Period>("90");
  const [active, setActive] = useState<number | null>(null);
  const [compact, setCompact] = useState(false);

  // Downsample bars on small screens so ~90 daily bars don't collapse into
  // unreadable slivers. Deferred setState to satisfy react-hooks rules.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setCompact(mq.matches);
    const t = setTimeout(apply, 0);
    mq.addEventListener("change", apply);
    return () => {
      clearTimeout(t);
      mq.removeEventListener("change", apply);
    };
  }, []);

  // Window the full 90-day series to the selected period.
  const points = useMemo(
    () => series[mode].slice(-Number(period)),
    [series, mode, period]
  );

  // On mobile keep roughly every Nth point (~15 bars max) so each bar stays
  // readable; desktop renders the full daily series.
  const displayPoints = useMemo(() => {
    if (!compact || points.length <= 20) return points;
    const stride = Math.ceil(points.length / 15);
    const out = points.filter((_, i) => i % stride === 0);
    if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
    return out;
  }, [points, compact]);

  const totals = useMemo(
    () => ({
      demo: series.demo.slice(-Number(period)).reduce((sum, p) => sum + p.value, 0),
      live: series.live.slice(-Number(period)).reduce((sum, p) => sum + p.value, 0),
    }),
    [series, period],
  );

  const maxAbs = useMemo(() => {
    const values = points.map((p) => Math.abs(p.value));
    return Math.max(...values, 0);
  }, [points]);

  const activePoint = active !== null ? displayPoints[active] : null;
  const activeTone = activePoint ? toneOf(activePoint.value) : null;

  const tabs: { key: Mode; label: string }[] = [
    { key: "demo", label: "Demo" },
    { key: "live", label: "Live" },
  ];

  return (
    <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
      {/* Header */}
      <div className="flex flex-col border-b border-border/60 sm:flex-row sm:items-stretch">
        <div className="flex-1 px-6 py-5">
          <h2 className="text-lg font-extrabold tracking-tight">
            Trading Performance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing daily profit for the last {period} days
          </p>
        </div>

        <div className="flex items-center justify-center px-4 py-3 sm:px-6">
          <Segmented<Period>
            value={period}
            onChange={setPeriod}
            options={[
              { key: "7", label: "7D" },
              { key: "30", label: "30D" },
              { key: "90", label: "90D" },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 border-t border-border/60 sm:border-t-0">
          {tabs.map((tab) => {
            const selected = mode === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setMode(tab.key);
                  setActive(null);
                }}
                aria-pressed={selected}
                className={`relative flex min-w-0 cursor-pointer flex-col items-start justify-center gap-1 border-l border-border/60 px-4 py-4 text-left transition-colors first:border-l-0 sm:min-w-[150px] sm:px-6 ${
                  selected
                    ? "bg-violet-500/10"
                    : "hover:bg-muted/40"
                }`}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {tab.label}
                </span>
                <span className="text-xl font-extrabold leading-none tracking-tight tabular-nums">
                  {formatCurrency(totals[tab.key])}
                </span>
                {selected && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-violet-600 to-purple-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 pb-4 pt-6 sm:px-6">
        <div
          className="relative h-64 w-full"
          role="img"
          aria-label={`Daily ${mode} profit for the last 3 months`}
          onMouseLeave={() => setActive(null)}
        >
          {/* grid lines */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute inset-x-0 border-t border-border/50"
              style={{ top: `${(i / 3) * 100}%` }}
            />
          ))}

          {/* bars */}
          <div className="absolute inset-0 flex items-end">
            {displayPoints.map((p, i) => {
              const tone = toneOf(p.value);
              const height = Math.max(4, (Math.abs(p.value) / (maxAbs || 1)) * 100);
              const dimmed = active !== null && active !== i;
              return (
                <div
                  key={p.date}
                  className="flex h-full min-w-0 flex-1 cursor-pointer items-end px-[1px]"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                >
                  <div
                    className={`w-full rounded-t-[2px] transition-all duration-200 ${TONE_META[tone].bar} ${
                      dimmed ? "opacity-40" : "opacity-100"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* tooltip */}
          {activePoint && activeTone && active !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-36 -translate-x-1/2 rounded-xl border border-violet-500/30 bg-popover px-3 py-2 text-popover-foreground shadow-xl shadow-violet-900/20"
              style={{
                left: `clamp(72px, ${((active + 0.5) / displayPoints.length) * 100}%, calc(100% - 72px))`,
              }}
            >
              <p className="text-[11px] font-semibold text-muted-foreground">
                {formatDate(activePoint.date)}
              </p>
              <p className="mt-0.5 text-sm font-extrabold tabular-nums">
                {activePoint.value >= 0 ? "+" : "-"}
                {formatCurrency(activePoint.value)}
              </p>
              <p
                className={`mt-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${TONE_META[activeTone].text}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${TONE_META[activeTone].dot}`}
                />
                {TONE_META[activeTone].label}
              </p>
            </div>
          )}
        </div>

        {/* x-axis */}
        <div className="mt-2 flex w-full">
          {displayPoints.map((p, i) => (
            <div key={p.date} className="relative h-5 min-w-0 flex-1">
              {i % Math.max(1, Math.ceil(displayPoints.length / (compact ? 5 : 15))) === 0 && (
                <span
                  className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground ${
                    compact || i % 12 === 0 ? "" : "hidden sm:block"
                  }`}
                >
                  {shortDate(p.date)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* legend */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] font-semibold text-muted-foreground">
          {(["profit", "loss", "flat"] as Tone[]).map((l) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${TONE_META[l].dot}`} />
              {TONE_META[l].label}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ───────────────── Loading skeleton ───────────────── */

function LoadingDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6 py-4">
        <div className="h-12 w-64 rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="h-48 rounded-2xl bg-muted" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-80 rounded-2xl bg-muted" />
          <div className="h-80 rounded-2xl bg-muted" />
        </div>
        <div className="h-96 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

/* ───────────────── Page ───────────────── */

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchDashboardData(showRefresh = false) {
    try {
      if (showRefresh) setRefreshing(true);

      const [response, news, calendar, execRes] = await Promise.all([
        fetch("/api/user/info", {
          method: "GET",
          cache: "no-store",
        }),
        fetchDashboardNews(),
        fetchDashboardCalendar(),
        fetch("/api/user/trading/executions?limit=500", { cache: "no-store" }).catch(
          () => null
        ),
      ]);

      if (!response.ok) {
        throw new Error("Unable to load dashboard data");
      }

      const userData = await response.json();
      const execPayload = execRes?.ok ? await execRes.json().catch(() => ({})) : {};
      const execs: ExecDoc[] = Array.isArray(execPayload?.executions)
        ? execPayload.executions
        : [];

      if (userData.success) {
        const tradeExecs = execs.filter((e) => !EXEC_TERMINAL_BAD.has(e.status ?? ""));
        const recentTrades = [...tradeExecs]
          .sort((a, b) => Date.parse(execTimestamp(b)) - Date.parse(execTimestamp(a)))
          .slice(0, 6)
          .map(toRecentTrade);

        const closedPnl = execs
          .filter((e) => e.status === "closed")
          .map((e) => e.realizedPnl ?? 0);
        const totalProfit = closedPnl.filter((p) => p > 0).reduce((s, p) => s + p, 0);
        const totalLosses = closedPnl.filter((p) => p < 0).reduce((s, p) => s + p, 0);

        setData({
          totalTrades: tradeExecs.length,
          billing: 30,
          credits: 120,
          totalProfit,
          totalLosses,
          activePlan: {
            name: "STANDARD PLAN",
            amount: 20,
            accountSize: "$200 - $500",
            duration: "14 DAYS",
            expires: "2026-08-04",
            status: "APPROVED",
          },
          performance: buildPerformanceSeries(execs),
          tradingCalendar: calendar.items,
          calendarAttribution: calendar.attribution,
          news,
          recentTrades,
        });
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void fetchDashboardData(), 0);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return <LoadingDashboard />;
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <XCircle className="mx-auto h-10 w-10 text-red-500" />
            <h2 className="mt-4 text-lg font-bold">Dashboard unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We could not load your account information.
            </p>
            <Button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="mt-6 bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = data.activePlan;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-6 py-4">
        {/* ───────── Page header ───────── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}
            >
              [ // OVERVIEW ]
            </p>
            <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight md:text-2xl">
              User{" "}
              <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">
                Dashboard
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Let{" "}
              <strong className="font-bold text-foreground">SHILLMONGER</strong>{" "}
              do the work while you grow your portfolio.
            </p>
          </div>

          <Link href="/user-dashboard/plans">
            <Button className="h-10 gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-purple-500">
              Start Trading <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* ───────── Stats ───────── */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            icon={<Repeat className="h-4 w-4" />}
            label="Total Trades"
            value={String(data.totalTrades)}
            change="12%"
            trend="up"
            tone="bg-violet-500/15 text-violet-600 dark:text-violet-400"
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Total Profits"
            value={`${data.totalProfit >= 0 ? "" : "-"}${formatCurrency(data.totalProfit)}`}
            change="18%"
            trend="up"
            tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            icon={<XCircle className="h-4 w-4" />}
            label="Total Losses"
            value={`${data.totalLosses < 0 ? "-" : ""}${formatCurrency(data.totalLosses)}`}
            change="6%"
            trend="down"
            tone="bg-rose-500/15 text-rose-600 dark:text-rose-400"
          />
          <StatCard
            icon={<Wallet className="h-4 w-4" />}
            label="Total Billing"
            value={formatCurrency(data.billing)}
            change="2%"
            trend="down"
            tone="bg-purple-500/15 text-purple-600 dark:text-purple-400"
          />
          <StatCard
            icon={<Coins className="h-4 w-4" />}
            label="Available Credits"
            value={data.credits.toLocaleString("en-US")}
            change="24%"
            trend="up"
            tone="bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400"
          />
        </section>

        {/* ───────── Active plan ───────── */}
        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xl font-bold">Your Active Plan</CardTitle>
            <ViewAllButton href="/user-dashboard/plans" />
          </CardHeader>

          <CardContent>
            {plan ? (
              <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-extrabold">{plan.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Account size {plan.accountSize} · {plan.duration}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Plan fee
                    </p>
                    <p className="mt-0.5 font-bold">{formatCurrency(plan.amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Expires
                    </p>
                    <p className="mt-0.5 font-bold">{formatDate(plan.expires)}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${
                      plan.status === "APPROVED"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : plan.status === "PENDING"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {plan.status}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-base font-semibold text-muted-foreground">
                  No active plan yet.
                </p>
                <p className="mt-1 text-sm text-muted-foreground/80">
                  Subscribe to a plan to start automated trading.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ───────── Trading calendar + News ───────── */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-violet-500/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xl font-bold">Trading Calendar</CardTitle>
              <ViewAllButton href="/user-dashboard/calendar" />
            </CardHeader>

            <CardContent className="space-y-3">
              {data.tradingCalendar.map((item) => (
                <CalendarRow key={item.id} item={item} />
              ))}
              {data.calendarAttribution && (
                <p className="line-clamp-2 pt-1 text-[10px] leading-snug text-muted-foreground/60">
                  Data: XOOMAR · {data.calendarAttribution}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-violet-500/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xl font-bold">News</CardTitle>
              <ViewAllButton href="/user-dashboard/news" />
            </CardHeader>

            <CardContent className="space-y-3">
              {data.news.map((item) => (
                <NewsRow key={item.id} item={item} />
              ))}
            </CardContent>
          </Card>
        </section>

        {/* ───────── Performance bar chart (Demo / Live) ───────── */}
        <PerformanceBarChart series={data.performance} />

        {/* ───────── Recent activity (unchanged) ───────── */}
        <Card className="w-full border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider">
                Recent activity
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Your latest executed positions.
              </CardDescription>
            </div>

            <Link href="/UserDashboard/trade-history">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 border-violet-500/50 text-[10px] font-bold uppercase tracking-wider text-violet-600 hover:bg-violet-500/10 dark:text-violet-400"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-y border-border/50 bg-muted/20 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="px-6 py-3 text-left">Symbol</th>
                    <th className="px-6 py-3 text-center">Position</th>
                    <th className="px-6 py-3 text-center">Entry</th>
                    <th className="px-6 py-3 text-center">Lot size</th>
                    <th className="px-6 py-3 text-center">Result</th>
                    <th className="px-6 py-3 text-right">Date</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/40">
                  {data.recentTrades.slice(0, 6).map((trade) => (
                    <tr
                      key={trade.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-6 py-4 text-left">
                        <div className="font-bold tracking-tight">
                          {trade.symbol}
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {trade.id}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
                            trade.type === "BUY"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {trade.type === "BUY" ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          {trade.type}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center font-medium tabular-nums">
                        {trade.entry.toFixed(2)}
                      </td>

                      <td className="px-6 py-4 text-center font-medium tabular-nums">
                        {trade.lotSize.toFixed(2)}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div
                          className={`font-bold tabular-nums ${
                            trade.profit >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {trade.profit >= 0 ? "+" : "-"}
                          {formatCurrency(trade.profit)}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                        {formatDate(trade.date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}