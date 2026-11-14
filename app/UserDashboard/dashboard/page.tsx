"use client";

import { useEffect, useState } from "react";
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
   Bot,
  Zap,
  Activity,
} from "lucide-react";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

import { Button } from "@/components/ui/button";
import ShillmongerLoader from "@/components/ShillmongerLoader";
import { useMainContentLoading } from "@/components/UserDashboard/MainContentLoading";
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
  closedAt: string | null;
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
  remainingCredits?: number;
  totalCredits?: number;
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
  recentTrades: TradeRow[];
}

// TODO: replace with real thumbnails per article once the news API is wired up.
const MOCK_NEWS_IMAGE =
  "https://i.postimg.cc/ZnDX5Ff3/5.jpg";

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
    id: `${(e.dealId ?? e._id ?? "").slice(-8)}-${String(e._id ?? "").slice(-4)}`.toUpperCase(),
    symbol: e.symbol || e.epic || "—",
    type: e.direction === "SELL" ? "SELL" : "BUY",
    entry: e.entryLevel ?? 0,
    lotSize: e.size ?? 0,
    date: execTimestamp(e),
    closedAt: e.closedAt ?? null,
    profit,
    status: open ? "OPEN" : profit >= 0 ? "WIN" : "LOSS",
  };
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


/* ───────────────── Page ───────────────── */

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const setMainLoading = useMainContentLoading();

  // Keep the layout loader visible until dashboard data finishes loading.
  useEffect(() => {
    setMainLoading(loading);
  }, [loading, setMainLoading]);

  useEffect(() => () => setMainLoading(false), [setMainLoading]);

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
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ShillmongerLoader className="w-full max-w-md" label="Loading dashboard" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[calc(100dvh-8.75rem)] items-center justify-center lg:min-h-[calc(100dvh-5.25rem)]">
        <Card className="h-[calc(100dvh-12rem)] w-full rounded-2xl text-center flex items-center justify-center">
          <CardContent className="p-8">
            <XCircle className="mx-auto h-10 w-10 text-red-500" />
            <h2 className="mt-4 text-lg font-bold">Dashboard unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We could not load your account information.
            </p>
            <Button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="mt-6 bg-gradient-to-r p-5 rounded-full text-sm from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500"
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
    <main className="min-h-screen text-foreground">
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

       
{/* ───────── Active Trading Plan (Compact) ───────── */}
{(() => {
  const CREDITS_PER_TRADE = 200; // deducted only when a trade closes in profit

  const total = Number(plan?.totalCredits ?? 0);
  const remaining = Number(plan?.remainingCredits ?? 0);
  const consumed = Math.max(0, total - remaining);
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((remaining / total) * 100))) : 0;
  const tradesLeft = Math.floor(remaining / CREDITS_PER_TRADE);

  const outOfCredits = remaining < CREDITS_PER_TRADE;
  const lowCredits = !outOfCredits && tradesLeft <= 3;
  const botRunning = plan?.status === "APPROVED" && !outOfCredits;

  const barColor =
    pct > 80 ? "bg-emerald-500" : pct > 40 ? "bg-amber-500" : "bg-rose-500";
  const pctColor =
    pct > 80
      ? "text-emerald-600 dark:text-emerald-400"
      : pct > 40
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";

  return (
    <Card className="relative overflow-hidden border-violet-500/20 shadow-sm">

      {plan ? (
        <>
          {/* Header */}
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/50 px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="truncate text-base font-bold tracking-tight">{plan.name}</CardTitle>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Trading Subscription · {plan.accountSize} Allocation
                </p>
              </div>
            </div>

            <Link
              href="/user-dashboard/plans"
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-violet-500/40 hover:text-violet-600 dark:hover:text-violet-300"
            >
              Manage
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>

          {/* Body */}
          <CardContent className="px-5">
            <div className="grid grid-cols-1 gap-5">
              {/* Credits */}
              <div className="rounded-xl border border-border/60 bg-background/60 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Zap className="h-3.5 w-3.5 text-violet-500" />
                    Available Credits
                  </span>

                  {/* Bot state follows credits: no credits = bot stops trading */}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      botRunning
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${botRunning ? "animate-pulse bg-emerald-500" : "bg-rose-500"}`} />
                    {botRunning ? "Bot trading" : outOfCredits ? "Bot paused" : "Bot inactive"}
                  </span>
                </div>

                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black tabular-nums tracking-tight">{remaining.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">/ {total.toLocaleString()} credits</span>
                  <span className={`ml-auto text-xs font-bold ${pctColor}`}>{pct}% left</span>
                </div>

                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-violet-500" />
                    {CREDITS_PER_TRADE} credits per profitable trade
                  </span>
                  <span>{consumed.toLocaleString()} used</span>
                </div>

                {/* Contextual notice */}
                {outOfCredits ? (
                  <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                    You're out of credits, so the bot has stopped trading for you. Top up to resume.
                  </p>
                ) : (
                  <p
                    className={`mt-3 rounded-lg border px-3 py-2 text-[11px] font-medium ${
                      lowCredits
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "border-border/50 bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {lowCredits
                      ? `Low credits: enough for ${tradesLeft} more profitable ${tradesLeft === 1 ? "trade" : "trades"}. The bot stops when they run out.`
                      : `Enough for about ${tradesLeft.toLocaleString()} more profitable trades. Credits are only deducted when a trade is in profit.`}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </>
      ) : (
        /* Empty state */
        <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/20 dark:text-violet-400">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">No Active Trading Subscription</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Select a plan to get your credits. The bot trades for you until they run out.
              </p>
            </div>
          </div>

          <Link
            href="/user-dashboard/plans"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-violet-500"
          >
            Explore Plans
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </CardContent>
      )}
    </Card>
  );
})()}




        {/* ───────── Trading calendar + News ───────── */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-violet-500/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-bold">Trading Calendar</CardTitle>
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
              <CardTitle className="text-lg font-bold">News</CardTitle>
              <ViewAllButton href="/user-dashboard/news" />
            </CardHeader>

            <CardContent className="space-y-0">
              {data.news.map((item) => (
                <NewsRow key={item.id} item={item} />
              ))}
             <p className="line-clamp-2 pt-1 text-[10px] leading-relaxed text-muted-foreground/60">
  News and headlines are aggregated from trusted sources and delivered through the NewsData.io API.
  Coverage and availability may vary by source and region.
</p>
            </CardContent>
          </Card>
        </section>

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
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-y border-border/50 bg-muted/20 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="px-6 py-3 text-left">Symbol</th>
                    <th className="px-6 py-3 text-center">Position</th>
                    <th className="px-6 py-3 text-center">Entry</th>
                    <th className="px-6 py-3 text-center">Lot size</th>
                    <th className="px-6 py-3 text-center">Result</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-right">Date</th>
                    <th className="px-6 py-3 text-right">Closed Date</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/40">
                  {data.recentTrades.slice(0, 6).map((trade, idx) => (
                    <tr
                      key={`${trade.id}-${idx}`}
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

                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            trade.status === "WIN"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : trade.status === "LOSS"
                                ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {trade.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                        {formatDate(trade.date)}
                      </td>

                      <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                        {trade.closedAt ? formatDate(trade.closedAt) : "—"}
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