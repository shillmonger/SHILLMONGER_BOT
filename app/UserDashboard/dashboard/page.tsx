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

type Mode = "demo" | "live";

interface DashboardData {
  totalTrades: number;
  billing: number;
  credits: number;
  totalProfit: number;
  activePlan: ActivePlan | null;
  tradingCalendar: CalendarItem[];
  calendarAttribution?: string;
  news: NewsItem[];
  performance: Record<Mode, DayPoint[]>;
  recentTrades: TradeRow[];
}

// TODO: replace with real thumbnails per article once the news API is wired up.
const MOCK_NEWS_IMAGE =
  "https://i.postimg.cc/q7C5L9zC/The-West-Is-Losing-Control-Over-The-Gold-Price.jpg";

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

// Deterministic mock series so the chart looks the same on every load.
// Replace with real daily results from your trading API.
function generateSeries(
  seed: number,
  days: number,
  min: number,
  max: number,
): DayPoint[] {
  let s = seed;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  return Array.from({ length: days }, (_, i) => ({
    date: new Date(now - (days - 1 - i) * DAY).toISOString(),
    value: Math.round((min + rand() * (max - min)) * 100) / 100,
  }));
}

const IMPACT_CLS: Record<CalendarItem["impact"], string> = {
  High: "text-rose-600 dark:text-rose-400",
  Medium: "text-amber-600 dark:text-amber-400",
  Low: "text-muted-foreground",
};

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
    <div className="group rounded-2xl border border-violet-500/20 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-900/10">
      <div className="flex items-start justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${tone}`}
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
      <p className="mt-3 text-2xl font-extrabold tracking-tight tabular-nums font-mono">
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

type Level = "low" | "medium" | "high";

const LEVEL_META: Record<Level, { label: string; bar: string; dot: string; text: string }> = {
  low: {
    label: "Low",
    bar: "bg-red-500",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
  medium: {
    label: "Medium",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  high: {
    label: "High",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
};

function PerformanceBarChart({
  series,
}: {
  series: Record<Mode, DayPoint[]>;
}) {
  const [mode, setMode] = useState<Mode>("demo");
  const [active, setActive] = useState<number | null>(null);

  const points = series[mode];

  const totals = useMemo(
    () => ({
      demo: series.demo.reduce((sum, p) => sum + p.value, 0),
      live: series.live.reduce((sum, p) => sum + p.value, 0),
    }),
    [series],
  );

  const { min, max } = useMemo(() => {
    const values = points.map((p) => p.value);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [points]);

  const levelOf = (value: number): Level => {
    const ratio = (value - min) / (max - min || 1);
    if (ratio < 0.34) return "low";
    if (ratio < 0.67) return "medium";
    return "high";
  };

  const activePoint = active !== null ? points[active] : null;
  const activeLevel = activePoint ? levelOf(activePoint.value) : null;

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
            Showing daily profit for the last 3 months
          </p>
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
                className={`relative flex min-w-[150px] cursor-pointer flex-col items-start justify-center gap-1 border-l border-border/60 px-6 py-4 text-left transition-colors first:border-l-0 sm:first:border-l ${
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
            {points.map((p, i) => {
              const level = levelOf(p.value);
              const height = Math.max(4, (p.value / (max || 1)) * 100);
              const dimmed = active !== null && active !== i;
              return (
                <div
                  key={p.date}
                  className="flex h-full min-w-0 flex-1 cursor-pointer items-end px-[1px]"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                >
                  <div
                    className={`w-full rounded-t-[2px] transition-all duration-200 ${LEVEL_META[level].bar} ${
                      dimmed ? "opacity-40" : "opacity-100"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* tooltip */}
          {activePoint && activeLevel && active !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-36 -translate-x-1/2 rounded-xl border border-violet-500/30 bg-popover px-3 py-2 text-popover-foreground shadow-xl shadow-violet-900/20"
              style={{
                left: `clamp(72px, ${((active + 0.5) / points.length) * 100}%, calc(100% - 72px))`,
              }}
            >
              <p className="text-[11px] font-semibold text-muted-foreground">
                {formatDate(activePoint.date)}
              </p>
              <p className="mt-0.5 text-sm font-extrabold tabular-nums">
                {formatCurrency(activePoint.value)}
              </p>
              <p
                className={`mt-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${LEVEL_META[activeLevel].text}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${LEVEL_META[activeLevel].dot}`}
                />
                {LEVEL_META[activeLevel].label}
              </p>
            </div>
          )}
        </div>

        {/* x-axis */}
        <div className="mt-2 flex w-full">
          {points.map((p, i) => (
            <div key={p.date} className="relative h-5 min-w-0 flex-1">
              {i % 6 === 0 && (
                <span
                  className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground ${
                    i % 12 === 0 ? "" : "hidden sm:block"
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
          {(["low", "medium", "high"] as Level[]).map((l) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${LEVEL_META[l].dot}`} />
              {LEVEL_META[l].label}
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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
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

      const [response, news, calendar] = await Promise.all([
        fetch("/api/user/info", {
          method: "GET",
          cache: "no-store",
        }),
        fetchDashboardNews(),
        fetchDashboardCalendar(),
      ]);

      if (!response.ok) {
        throw new Error("Unable to load dashboard data");
      }

      const userData = await response.json();

      if (userData.success) {
        // Replace this object with the response from your trading API.
        // billing = amount billed, credits = credit balance (sample values).
        setData({
          totalTrades: 9,
          billing: 30,
          credits: 120,
          totalProfit: 15.5,
          activePlan: {
            name: "STANDARD PLAN",
            amount: 20,
            accountSize: "$200 - $500",
            duration: "14 DAYS",
            expires: "2026-08-04",
            status: "APPROVED",
          },
          // Sample daily profit for the last 90 days: wire to your real demo / live results.
          performance: {
            demo: generateSeries(7, 90, 20, 400),
            live: generateSeries(21, 90, 5, 220),
          },
          tradingCalendar: calendar.items,
          calendarAttribution: calendar.attribution,
          news,
          recentTrades: [
            { id: "TRD-001", symbol: "XAUUSDm", type: "BUY", entry: 4388.23, lotSize: 0.05, date: "2026-08-13", profit: 125.5, status: "WIN" },
            { id: "TRD-002", symbol: "XAUUSDm", type: "SELL", entry: 4388.71, lotSize: 0.05, date: "2026-08-13", profit: -45.3, status: "LOSS" },
            { id: "TRD-003", symbol: "XAUUSDm", type: "SELL", entry: 4426.15, lotSize: 0.02, date: "2026-08-12", profit: 78.25, status: "WIN" },
            { id: "TRD-004", symbol: "XAUUSDm", type: "BUY", entry: 4430.74, lotSize: 0.02, date: "2026-08-12", profit: -32.1, status: "LOSS" },
            { id: "TRD-005", symbol: "XAUUSDm", type: "BUY", entry: 4405.72, lotSize: 0.02, date: "2026-08-12", profit: 56.8, status: "WIN" },
            { id: "TRD-006", symbol: "XAUUSDm", type: "BUY", entry: 4405.72, lotSize: 0.02, date: "2026-08-12", profit: 12.4, status: "WIN" },
          ],
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
    fetchDashboardData();
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
            <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight md:text-3xl">
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
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Repeat className="h-4 w-4" />}
            label="Trades"
            value={String(data.totalTrades)}
            change="12%"
            trend="up"
            tone="bg-violet-500/15 text-violet-600 dark:text-violet-400"
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Profits"
            value={`${data.totalProfit >= 0 ? "" : "-"}${formatCurrency(data.totalProfit)}`}
            change="18%"
            trend="up"
            tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            icon={<Wallet className="h-4 w-4" />}
            label="Billing"
            value={formatCurrency(data.billing)}
            change="2%"
            trend="down"
            tone="bg-purple-500/15 text-purple-600 dark:text-purple-400"
          />
          <StatCard
            icon={<Coins className="h-4 w-4" />}
            label="Credits"
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

            <Link href="/user-dashboard/trading">
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