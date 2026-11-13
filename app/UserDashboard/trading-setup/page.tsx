"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IBM_Plex_Mono } from "next/font/google";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis } from "recharts";
import {
  AlertTriangle, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  BarChart3, Bot, Check, Eye, EyeOff, KeyRound, Landmark, LayoutDashboard, LineChart, Link2,
  Loader2, Lock, Mail, Percent, Settings, ShieldAlert, SlidersHorizontal,
  TrendingDown, TrendingUp, Trophy, Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedBrokerLogos } from "@/components/AnimatedBrokerLogos";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const plexMono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], display: "swap" });

/* ───────────────── Types ───────────────── */

type Mode = "demo" | "live";
type View = "dashboard" | "analytics" | "setup";
type BotState = "stopped" | "running" | "paused";

interface Answers {
  adult: "yes" | "no" | null;
  experience: string;
  env: Mode;
  ack: boolean;
}

interface Position {
  id: string; symbol: string; dir: "BUY" | "SELL"; entry: number | null; current: number | null;
  size: number | null; sl: number | null; tp: number | null; pl: number | null;
}
interface Trade {
  id: string; symbol: string; dir: "BUY" | "SELL"; entry: number | null; exit: number | null;
  opened: string; closed: string | null; pl: number | null; status: "WIN" | "LOSS" | "OPEN";
}
interface DayPoint { date: string; value: number }
interface PnlPoint { x: string; value: number }

/* ───────────────── Constants & sample data ───────────────── */

const STORAGE_KEY = "shillmonger:setup:v2";
const CAPITAL_LOGO = "https://i.postimg.cc/rmGVzdRc/capital-logo.jpg";

const EMPTY: Answers = { adult: null, experience: "", env: "demo", ack: false };

const EXPERIENCE = [
  { title: "Beginner", desc: "New to trading, or less than 1 year." },
  { title: "Intermediate", desc: "1 to 3 years of trading experience." },
  { title: "Pro", desc: "More than 3 years of trading experience." },
];

const NAV: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { key: "analytics", label: "Analytics", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { key: "setup", label: "Trading Setup", icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
];

/* ───────────────── Helpers ───────────────── */

const money = (v: number) =>
  `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (v: number) => `${v >= 0 ? "+" : "-"}${money(v)}`;
const plTone = (v: number) => (v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400");
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
const longDate = (d: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(d));

function fmtPrice(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function sumChunks(points: DayPoint[], size: number): PnlPoint[] {
  const out: PnlPoint[] = [];
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size);
    out.push({ x: shortDate(chunk[0].date), value: chunk.reduce((a, p) => a + p.value, 0) });
  }
  return out;
}

/* ───────────────── Backend API types & mappers ───────────────── */

interface ApiSummary {
  balance: number | null; available: number | null; equity: number | null;
  currency: string | null; openPositionsCount: number; openPnl: number; todayPnl: number | null;
}
interface ApiPosition {
  id: string; symbol: string | null; epic: string | null; dir: string;
  entry: number | null; current: number | null; size: number | null;
  sl: number | null; tp: number | null; pl: number | null; status: string;
}
interface ApiTrade {
  id: string | null; epic: string | null; symbol: string | null; direction: string | null;
  size: number | null; entry: number | null; exit: number | null;
  profit: number | null; type: string | null; status: string | null;
  openedAt: string | null; closedAt: string | null;
}
interface AnalyticsDaily { date: string; value: number }

interface ApiBrokerStatus {
  connected: boolean;
  status: string;
  /** false when the operator disabled the broker in the Danger Zone */
  active?: boolean;
  environment: Mode;
  email: string | null;
  account: {
    accountId?: string; accountName?: string; currency?: string | null;
    balance?: number | null; available?: number | null; equity?: number | null;
    profitLoss?: number | null; accountType?: string | null;
  } | null;
  connectionError: string | null;
  lastConnectedAt: string | null;
  lastSessionRefreshAt: string | null;
}

interface TradingData {
  loading: boolean;
  error: string | null;
  source: "broker" | "stale_cache" | "unavailable" | "";
  environment: Mode;
  connected: boolean;
  summary: ApiSummary | null;
  positions: Position[];
  trades: Trade[];
  daily: { date: string; value: number }[];
  winRate: number | null;
  wins: number;
  losses: number;
  botState: BotState;
  automationEnabled: boolean;
  emergencyStop: boolean;
  broker: ApiBrokerStatus | null;
  refresh: () => void;
  setBot: (s: BotState) => Promise<void>;
  setAutomationEnabled: (v: boolean) => Promise<void>;
  setEmergencyStop: (v: boolean) => Promise<void>;
  setEnvironment: (m: Mode) => Promise<boolean>;
}

function mapPosition(p: ApiPosition): Position | null {
  const dir = String(p.dir ?? "").toUpperCase();
  if (dir !== "BUY" && dir !== "SELL") return null;
  return {
    id: String(p.id ?? `${p.epic}-${Date.now()}`),
    symbol: p.symbol || p.epic || "Unknown",
    dir,
    entry: p.entry,
    current: p.current,
    size: p.size,
    sl: p.sl,
    tp: p.tp,
    pl: p.pl,
  };
}

function mapTrade(t: ApiTrade, idx: number): Trade | null {
  const dir = String(t.direction ?? "").toUpperCase();
  if (dir !== "BUY" && dir !== "SELL") return null;
  const pl = t.profit ?? null;
  const status: Trade["status"] =
    String(t.status ?? "").toUpperCase() === "OPEN" ? "OPEN" : pl == null ? "OPEN" : pl > 0 ? "WIN" : pl < 0 ? "LOSS" : "WIN";
  return {
    id: String(t.id ?? `trade-${idx}`),
    symbol: t.symbol || t.epic || "Unknown",
    dir,
    entry: t.entry,
    exit: t.exit,
    opened: t.openedAt ?? "",
    closed: t.closedAt,
    pl,
    status,
  };
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

async function apiSend<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

/** Fetches all trading data for the current environment. */
function useTradingData(environment: Mode): TradingData {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<TradingData["source"]>("");
  const [connected, setConnected] = useState(false);
  const [summary, setSummary] = useState<ApiSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [daily, setDaily] = useState<{ date: string; value: number }[]>([]);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [botState, setBotState] = useState<BotState>("stopped");
  const [automationEnabled, setAutomationEnabledState] = useState(false);
  const [emergencyStop, setEmergencyStopState] = useState(false);
  const [broker, setBroker] = useState<ApiBrokerStatus | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [dash, pos, hist, ana, bot, brk] = await Promise.all([
          apiGet<{
            environment?: Mode; source?: TradingData["source"]; account?: { balance?: number } | null;
            summary?: ApiSummary; bot?: { state?: BotState; automationEnabled?: boolean; emergencyStop?: boolean; environment?: Mode } | null;
            reason?: string;
          }>("/api/user/trading/dashboard"),
          apiGet<{ positions?: ApiPosition[] }>("/api/user/trading/positions").catch(() => ({ positions: [] })),
          apiGet<{ trades?: ApiTrade[] }>("/api/user/trading/history?days=90").catch(() => ({ trades: [] })),
          apiGet<{ daily?: AnalyticsDaily[]; winRate?: number | null; wins?: number; losses?: number }>(
            "/api/user/trading/analytics?days=90"
          ).catch((): { daily?: AnalyticsDaily[]; winRate?: number | null; wins?: number; losses?: number } => ({ daily: [] })),
          apiGet<{ bot?: { state?: BotState; automationEnabled?: boolean; emergencyStop?: boolean; environment?: Mode } | null }>(
            "/api/user/trading/bot"
          ).catch(() => ({ bot: null })),
          apiGet<ApiBrokerStatus>("/api/user/capital/status").catch(() => null),
        ]);
        if (cancelled) return;

        const dashConnected = dash.source !== "unavailable";
        setConnected(dashConnected);
        setSource(dash.source ?? "");
        setSummary(dash.summary ?? null);
        setPositions((pos.positions ?? []).map(mapPosition).filter((p): p is Position => p !== null));
        setTrades((hist.trades ?? []).map(mapTrade).filter((t): t is Trade => t !== null));
        setDaily((ana.daily ?? []).map((d) => ({ date: d.date, value: d.value })));
        setWinRate(ana.winRate ?? null);
        setWins(ana.wins ?? 0);
        setLosses(ana.losses ?? 0);
        const bs = bot.bot?.state ?? dash.bot?.state;
        if (bs) setBotState(bs as BotState);
        const ae = bot.bot?.automationEnabled ?? dash.bot?.automationEnabled;
        if (typeof ae === "boolean") setAutomationEnabledState(ae);
        const es = bot.bot?.emergencyStop ?? dash.bot?.emergencyStop;
        if (typeof es === "boolean") setEmergencyStopState(es);
        setBroker(brk);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load trading data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [environment, tick]);

  const setBot = useCallback(async (s: BotState) => {
    const data = await apiSend<{ bot?: { state?: BotState } }>("/api/user/trading/bot", "PUT", { state: s });
    const next = (data.bot?.state ?? s) as BotState;
    setBotState(next);
  }, []);

  const setAutomationEnabled = useCallback(async (v: boolean) => {
    const data = await apiSend<{ bot?: { automationEnabled?: boolean } }>("/api/user/trading/bot", "PUT", { automationEnabled: v });
    setAutomationEnabledState(data.bot?.automationEnabled ?? v);
  }, []);

  const setEmergencyStop = useCallback(async (v: boolean) => {
    const data = await apiSend<{ bot?: { emergencyStop?: boolean } }>("/api/user/trading/bot", "PUT", { emergencyStop: v });
    setEmergencyStopState(data.bot?.emergencyStop ?? v);
  }, []);

  const setEnvironment = useCallback(async (m: Mode) => {
    try {
      await apiSend("/api/user/trading/environment", "PUT", { environment: m });
      setTick((t) => t + 1);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    loading, error, source, environment, connected, summary, positions, trades,
    daily, winRate, wins, losses, botState, automationEnabled, emergencyStop, broker,
    refresh, setBot, setAutomationEnabled, setEmergencyStop, setEnvironment,
  };
}

const SampleBadge = ({ text = "DEMO / SAMPLE DATA", tone = "amber" }: { text?: string; tone?: "amber" | "green" }) => (
  <span className={`${plexMono.className} inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
    tone === "green"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  }`}>
    {text}
  </span>
);

/* ───────────────── Shared form pieces ───────────────── */

function OptionCard({
  selected, onClick, title, desc,
}: { selected: boolean; onClick: () => void; title: string; desc?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
        selected
          ? "border-violet-500/60 bg-violet-500/10 shadow-lg shadow-violet-900/10"
          : "border-violet-500/20 bg-card hover:-translate-y-0.5 hover:border-violet-500/50"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-violet-500 bg-gradient-to-br from-violet-600 to-purple-600 text-white" : "border-border"
        }`}
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        {desc && <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>}
      </span>
    </button>
  );
}

function Notice({ tone, children }: { tone: "warn" | "danger" | "info"; children: React.ReactNode }) {
  const cls =
    tone === "danger"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  return (
    <div className={`flex gap-3 rounded-xl border p-3 text-xs leading-relaxed ${cls}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/* ───────────────── Capital.com connection ───────────────── */

const INPUT_CLS =
  "h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20";

function SecretInput({
  id, icon, label, value, onChange, placeholder, hint, autoComplete = "off",
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold">
        {icon} {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          required
          autoComplete={autoComplete}
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${INPUT_CLS} pr-10`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CapitalConnectForm({ env, onSuccess }: { env: Mode; onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const canSubmit = email.trim() && apiKey.trim() && apiPassword && status !== "loading";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/user/capital/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), apiKey: apiKey.trim(), apiPassword, env }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.connected === false) throw new Error(data.error || data.message || "Could not connect. Check your details and try again.");
      setStatus("success");
      setMessage("Capital.com account connected.");
      toast.success(
        `Capital.com account connected (${env === "demo" ? "demo" : "live"})`,
        { id: "capital-connect" }
      );
      // Never keep credentials in the browser after submitting.
      setEmail(""); setApiKey(""); setApiPassword("");
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Try again.";
      setStatus("error");
      setMessage(msg);
      toast.error(`Could not connect Capital.com account — ${msg}`, {
        id: "capital-connect",
      });
    }
  };

  return (
    <form onSubmit={submit} autoComplete="off" className="space-y-4 rounded-2xl border border-violet-500/20 bg-card p-5 shadow-sm">
      <div>
        <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>[ // CONNECT ]</p>
        <p className="text-xl font-extrabold tracking-tight">Connect your Capital.com account</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter the three details Capital.com needs to start an API session for your {env === "demo" ? "demo" : "live"} account.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cap-email" className="flex items-center gap-1.5 text-xs font-semibold">
          <Mail className="h-3.5 w-3.5 text-violet-500" /> Capital.com login email
        </label>
        <input id="cap-email" type="email" required autoComplete="off" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={INPUT_CLS} />
      </div>

      <SecretInput
        id="cap-key"
        icon={<KeyRound className="h-3.5 w-3.5 text-violet-500" />}
        label="API key"
        value={apiKey}
        onChange={setApiKey}
        placeholder="Paste your API key"
        hint="Capital.com → Settings → API integrations."
      />

      <SecretInput
        id="cap-pass"
        icon={<Lock className="h-3.5 w-3.5 text-violet-500" />}
        label="Custom API-key password"
        value={apiPassword}
        onChange={setApiPassword}
        placeholder="The password you set for this key"
        autoComplete="new-password"
        hint="Not your normal Capital.com login password."
      />

      {status === "success" && (
        <p role="status" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{message}</p>
      )}
      {status === "error" && (
        <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">{message}</p>
      )}

      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-11 w-full gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-bold text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-purple-500"
      >
        {status === "loading" ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting</> : "Connect account"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Your details are sent securely to our server and are not saved in your browser.
      </p>
    </form>
  );
}

const DISCLAIMER = "Shillmonger is not partnered with or endorsed by Capital.com. Brand names belong to their owners.";

const API_STEPS = [
  { icon: <Link2 className="h-4 w-4" />, t: "What an API key is", d: "A credential generated inside your own Capital.com account. It lets an approved application place requests on your behalf." },
  { icon: <Settings className="h-4 w-4" />, t: "Where to find it", d: "Sign in to Capital.com, open your account settings and look for the API integrations section." },
  { icon: <KeyRound className="h-4 w-4" />, t: "How to generate a key", d: "Create a new key in that section and give it a label you will recognise. Keep the key private." },
  { icon: <Lock className="h-4 w-4" />, t: "The custom API-key password", d: "You set this password when you create the key. It is different from your normal login password. Never share it." },
];

function ApiSteps() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {API_STEPS.map((s) => (
        <div key={s.t} className="rounded-2xl border border-violet-500/20 bg-card p-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">{s.icon}</span>
          <p className="mt-3 text-sm font-bold">{s.t}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
        </div>
      ))}
    </div>
  );
}

/* Used in onboarding: animated sync, connect form, then API steps */
function CapitalGuide({ env }: { env: Mode }) {
  return (
    <div className="space-y-5">
      <AnimatedBrokerLogos
        shillmonger={
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/pfp.jpg" alt="Shillmonger" className="h-12 w-12 rounded-xl object-cover" />
        }
        capital={
          // eslint-disable-next-line @next/next/no-img-element
          <img src={CAPITAL_LOGO} alt="Capital.com" className="h-12 w-12 rounded-xl object-cover" />
        }
      />
      <p className="text-center text-xs text-muted-foreground">{DISCLAIMER}</p>
      <CapitalConnectForm env={env} />
      <ApiSteps />
    </div>
  );
}

/* ───────────────── Onboarding wizard ───────────────── */

const TOTAL_STEPS = 4; // age, experience, risk acknowledgement, connect broker

function Onboarding({
  answers, setAnswers, onFinish,
}: { answers: Answers; setAnswers: (a: Answers) => void; onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const set = (p: Partial<Answers>) => setAnswers({ ...answers, ...p });

  const valid = [answers.adult === "yes", !!answers.experience, answers.ack, true][step];

  const errors = [
    answers.adult === "no" ? "You must be 18 or older to use Shillmonger." : "Select an option to continue.",
    "Select your experience level.",
    "Confirm the risk acknowledgement to continue.",
    "",
  ];

  const next = () => {
    if (!valid) { setTried(true); return; }
    setTried(false);
    if (step === TOTAL_STEPS - 1) onFinish(); else setStep(step + 1);
  };
  const prev = () => { setTried(false); setStep(Math.max(0, step - 1)); };

  const heading = [
    ["Are you at least 18 years old?", "Trading is only available to adults. We only ask yes or no, never your date of birth."],
    ["What is your trading experience?", "This helps us tailor explanations to your level."],
    ["Understand the risk", "Please read and confirm before you continue."],
    ["Connect your broker", "Add your Capital.com details so the bot can trade XAU/USD for you. You can also do this later in Trading Setup."],
  ][step];

  return (
    <main className="flex min-h-[calc(100vh-10rem)] items-center justify-center bg-background px-4 py-6 text-foreground">
      <div className="w-full max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>[ // TRADING SETUP ]</p>
          <span className={`${plexMono.className} text-[11px] tracking-[0.2em] text-muted-foreground`}>
            STEP {step + 1}/{TOTAL_STEPS}
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={step + 1} aria-valuemax={TOTAL_STEPS}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-500 transition-all duration-500"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-extrabold tracking-tight">{heading[0]}</CardTitle>
            <CardDescription>{heading[1]}</CardDescription>
          </CardHeader>

          <CardContent key={step} className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-300">
            {step === 0 && (
              <>
                <OptionCard selected={answers.adult === "yes"} onClick={() => set({ adult: "yes" })} title="Yes, I am 18 or older." />
                <OptionCard selected={answers.adult === "no"} onClick={() => set({ adult: "no" })} title="No, I am under 18." />
                {answers.adult === "no" && (
                  <Notice tone="danger">Shillmonger is only available to people aged 18 and over, so you can&apos;t continue.</Notice>
                )}
              </>
            )}

            {step === 1 && EXPERIENCE.map((o) => (
              <OptionCard key={o.title} selected={answers.experience === o.title} onClick={() => set({ experience: o.title })} title={o.title} desc={o.desc} />
            ))}

            {step === 2 && (
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
                <input type="checkbox" checked={answers.ack} onChange={(e) => set({ ack: e.target.checked })} className="mt-0.5 h-4 w-4 accent-violet-600" />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  I understand that leveraged trading and CFDs carry a significant risk of financial loss, that I can lose more than I expect,
                  and that nothing on Shillmonger is a guarantee of profit.
                </span>
              </label>
            )}

            {step === 3 && <CapitalGuide env={answers.env} />}

            {tried && !valid && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">{errors[step]}</p>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={prev} disabled={step === 0} className="h-10 gap-2 rounded-xl border-violet-500/40 text-sm font-semibold">
            <ArrowLeft className="h-4 w-4" /> Previous
          </Button>
          <Button
            onClick={next}
            disabled={step === 0 && answers.adult === "no"}
            className="h-10 gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-purple-500"
          >
            {step === TOTAL_STEPS - 1 ? "Enter dashboard" : "Next"} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}

/* ───────────────── Dashboard building blocks ───────────────── */

function StatCard({ icon, label, value, tone, valueCls = "" }: { icon: React.ReactNode; label: string; value: string; tone: string; valueCls?: string }) {
  return (
    <div className="group rounded-2xl border border-violet-500/20 bg-card p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-900/10">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      <p className={`mt-2 font-mono text-xl font-extrabold tabular-nums tracking-tight ${valueCls}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

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

function TableShell({ children, min = 760 }: { children: React.ReactNode; min?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: min }}>{children}</table>
    </div>
  );
}
const TH = "px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground";
const TD = "px-3 py-2 text-sm font-medium tabular-nums";

const DirTag = ({ dir }: { dir: "BUY" | "SELL" }) => (
  <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider ${dir === "BUY" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
    {dir === "BUY" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
    {dir}
  </span>
);

function PositionsTable({ positions, loading, connected, env }: { positions: Position[]; loading: boolean; connected: boolean; env: Mode }) {
  return (
    <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
        <CardTitle className="text-xl font-extrabold tracking-tight">Open Positions</CardTitle>
        <SampleBadge
          text={connected ? `CAPITAL.COM · ${env.toUpperCase()}` : "NOT CONNECTED"}
          tone={env === "live" ? "green" : "amber"}
        />
      </CardHeader>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading positions…
        </div>
      ) : positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
            <LineChart className="h-7 w-7" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-extrabold text-muted-foreground">
              {connected ? "No open positions" : "Broker not connected"}
            </p>
            <p className="text-sm text-muted-foreground">
              {connected ? "Open positions from Capital.com will appear here." : "Connect your Capital.com account in Trading Setup to see real positions."}
            </p>
          </div>
        </div>
      ) : (
      <TableShell min={900}>
        <thead>
          <tr className="border-y border-border/50 bg-muted/20">
            {["Instrument", "Direction", "Entry", "Current", "Size", "Stop-loss", "Take-profit", "Unrealized P/L", "Status"].map((h) => <th key={h} className={TH}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {positions.map((p) => (
            <tr key={p.id} className="hover:bg-muted/30">
              <td className={`${TD} font-bold`}>{p.symbol}</td>
              <td className={TD}><DirTag dir={p.dir} /></td>
              <td className={TD}>{fmtPrice(p.entry)}</td>
              <td className={TD}>{fmtPrice(p.current)}</td>
              <td className={TD}>{p.size != null ? p.size.toFixed(2) : "—"}</td>
              <td className={TD}>{fmtPrice(p.sl)}</td>
              <td className={TD}>{fmtPrice(p.tp)}</td>
              <td className={`${TD} font-bold ${p.pl != null ? plTone(p.pl) : ""}`}>{p.pl != null ? signed(p.pl) : "—"}</td>
              <td className={TD}><span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-violet-600 dark:text-violet-300">Open</span></td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      )}
    </Card>
  );
}

/* Compact switch: 44x24 track, 16px knob, stays fully inside the track. */
function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors ${
        on ? "border-transparent bg-gradient-to-r from-violet-600 to-purple-600" : "border-border bg-muted"
      }`}
    >
      <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-md transition-transform ${on ? "translate-x-[18px]" : "translate-x-0"}`} />
    </button>
  );
}

function ToggleRow({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <Toggle on={on} onClick={onToggle} label={label} />
    </div>
  );
}

function BotControl({
  bot, setBot, env, onEnv, statusNote,
  automationEnabled, onAutomationEnabled,
  emergencyStop, onEmergencyStop,
}: {
  bot: BotState;
  setBot: (b: BotState) => void;
  env: Mode;
  onEnv: (m: Mode) => void;
  statusNote?: string;
  automationEnabled: boolean;
  onAutomationEnabled: (v: boolean) => void;
  emergencyStop: boolean;
  onEmergencyStop: (v: boolean) => void;
}) {
  return (
    <Card className="gap-3 border-violet-500/20 py-4 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4">
        <CardTitle className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><Bot className="h-4 w-4 text-violet-500" /> Bot Control</CardTitle>
        <SampleBadge
          text={statusNote ? `BACKEND LINKED · ${env.toUpperCase()}` : "PREFERENCE ONLY"}
          tone={env === "live" ? "green" : "amber"}
        />
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ToggleRow
            label="Live Account"
            desc="Trade with real funds"
            on={env === "live"}
            onToggle={() => onEnv(env === "live" ? "demo" : "live")}
          />
          <ToggleRow
            label="Demo Account"
            desc="Trade with simulated funds"
            on={env === "demo"}
            onToggle={() => onEnv(env === "demo" ? "live" : "demo")}
          />
          <ToggleRow
            label="Start Bot"
            desc="Begin automated trading"
            on={bot === "running"}
            onToggle={() => setBot(bot === "running" ? "stopped" : "running")}
          />
          <ToggleRow
            label="Pause Bot"
            desc="Temporarily halt the bot"
            on={bot === "paused"}
            onToggle={() => setBot(bot === "paused" ? "running" : "paused")}
          />
          <ToggleRow
            label="Emergency Stop"
            desc="Halt all trading immediately"
            on={emergencyStop}
            onToggle={() => onEmergencyStop(!emergencyStop)}
          />
          <ToggleRow
            label="Automation"
            desc="Execute signals on your account"
            on={automationEnabled}
            onToggle={() => onAutomationEnabled(!automationEnabled)}
          />
        </div>
        <p className="text-xs text-muted-foreground">{statusNote ?? "Automation preference only — order execution requires a connected broker."}</p>
      </CardContent>
    </Card>
  );
}

/* ───────────────── Broker account (from BROKER collection) ───────────────── */

function BrokerAccount({ broker }: { broker: ApiBrokerStatus | null }) {
  const env = broker?.environment ?? "demo";
  const connected = broker?.connected === true;
  const acc = broker?.account ?? null;
  const currency = acc?.currency ?? "";
  const fmt = (v?: number | null) =>
    v == null
      ? "—"
      : `${v < 0 ? "-" : ""}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;

  const rows: [string, string][] = [
    ["Broker", "Capital.com"],
    ["Account email", broker?.email ?? "—"],
    ["Account", acc?.accountName ?? acc?.accountId ?? "—"],
    ["Equity", fmt(acc?.equity)],
    ["Unrealized P/L", acc?.profitLoss == null ? "—" : signed(acc.profitLoss)],
    ["Status", connected ? "Connected" : broker?.status === "error" ? "Error" : "Not connected"],
    ["Activation", broker?.active === false ? "Disabled" : "Active"],
    ["Last connected", broker?.lastConnectedAt ? new Date(broker.lastConnectedAt).toLocaleString() : "—"],
    ["Session refreshed", broker?.lastSessionRefreshAt ? new Date(broker.lastSessionRefreshAt).toLocaleString() : "—"],
  ];

  return (
    <Card className="gap-3 border-violet-500/20 py-4 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4">
        <CardTitle className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <Landmark className="h-4 w-4 text-violet-500" /> Broker Account
        </CardTitle>
        <SampleBadge
          text={connected ? `CONNECTED · ${env.toUpperCase()}` : "NOT CONNECTED"}
          tone={connected && env === "live" ? "green" : "amber"}
        />
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        {broker?.connectionError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-all">{broker.connectionError}</span>
          </div>
        )}
        {!broker && (
          <p className="text-xs text-muted-foreground">No broker connection found for your account.</p>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[11px] font-semibold  tracking-wider text-muted-foreground">{k}</p>
              <p className="mt-0.5 truncate text-xs font-bold" title={v}>{v}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Read-only view of your stored broker record. Credentials and session tokens are never sent to the browser.
        </p>
      </CardContent>
    </Card>
  );
}

/* ───────────────── Danger zone (broker activation + deletion) ───────────────── */

function DangerZone({ broker, onChanged }: { broker: ApiBrokerStatus | null; onChanged?: () => void }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState<"toggle" | "delete" | null>(null);
  const hasBroker = !!broker?.email;
  const active = broker?.active !== false;
  const canDelete = hasBroker && confirmText.trim() === "DELETE" && busy === null;

  const setActivation = async (v: boolean) => {
    setBusy("toggle");
    try {
      await apiSend("/api/user/capital/manage", "PUT", { active: v });
      toast.success(v ? "Broker activated" : "Broker disabled — no new trades will execute");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update broker status");
    } finally {
      setBusy(null);
    }
  };

  const deleteBroker = async () => {
    if (!canDelete) return;
    setBusy("delete");
    try {
      await apiSend("/api/user/capital/manage", "DELETE");
      toast.success("Broker account and bot configuration deleted");
      setConfirmText("");
      // Reset onboarding answers so the user can start over, then leave.
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      onChanged?.();
      router.push("/UserDashboard/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete broker data");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="gap-3 border-rose-500/30 py-4 shadow-sm">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
          <ShieldAlert className="h-4 w-4" /> Danger Zone
        </CardTitle>
        <CardDescription>
          Control whether your broker connection can execute trades, or permanently remove it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        {!hasBroker ? (
          <p className="text-xs text-muted-foreground">No broker connected — connect a Capital.com account above first.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ToggleRow
                label="Active"
                desc="Allow the bot to trade"
                on={active}
                onToggle={() => void setActivation(true)}
              />
              <ToggleRow
                label="Disabled"
                desc="Block all trade execution"
                on={!active}
                onToggle={() => void setActivation(false)}
              />
            </div>

            <div className="space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Delete broker connection
              </p>
              <p className="text-xs text-muted-foreground">
                This permanently deletes your stored Capital.com credentials, session tokens,
                account snapshot, and bot configuration. Type <span className={`${plexMono.className} font-bold`}>DELETE</span> to confirm.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  autoComplete="off"
                  className="h-10 flex-1 rounded-xl border border-rose-500/40 bg-background px-3 text-sm font-semibold outline-none focus:border-rose-500"
                />
                <Button
                  onClick={() => void deleteBroker()}
                  disabled={!canDelete}
                  className="h-10 rounded-xl bg-rose-600 px-5 text-sm font-bold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────────── Analytics (shadcn charts) ───────────────── */

const PROFIT_COLOR = "#10b981";
const LOSS_COLOR = "#ef4444";

const pnlConfig = {
  value: { label: "Net P/L", color: PROFIT_COLOR },
} satisfies ChartConfig;

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
        <XAxis
          dataKey="x"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={tickFormatter}
        />
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

function Analytics({
  series, winRate: apiWinRate, wins: apiWins, losses: apiLosses, loading, env,
}: {
  series: { date: string; value: number }[];
  winRate: number | null; wins: number; losses: number; loading: boolean; env: Mode;
}) {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  // Normalize broker daily series into DayPoint shape for chunking.
  const full = useMemo<DayPoint[]>(
    () => series.map((p) => ({ date: new Date(`${p.date}T00:00:00Z`).toISOString(), value: p.value })),
    [series],
  );

  // When there is no history yet, render the charts on a flat zero baseline
  // (last 90 days of zeros) instead of an empty canvas. Generated in an
  // effect because Date.now() is not allowed during render.
  const [zeroBase, setZeroBase] = useState<DayPoint[] | null>(null);
  useEffect(() => {
    if (full.length > 0 || zeroBase) return;
    // Deferred so Date.now() + setState don't run synchronously in the
    // effect body (react-hooks/purity + set-state-in-effect rules).
    const timer = setTimeout(() => {
      const DAY = 86400000;
      const now = Date.now();
      setZeroBase(
        Array.from({ length: 90 }, (_, i) => ({
          date: new Date(now - (89 - i) * DAY).toISOString(),
          value: 0,
        }))
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [full.length, zeroBase]);

  const base = useMemo<DayPoint[]>(
    () => (full.length > 0 ? full : (zeroBase ?? [])),
    [full, zeroBase]
  );

  const daily = useMemo(
    () => base.slice(-Number(period)).map((p) => ({ x: p.date, value: p.value })),
    [base, period],
  );
  const weekly = useMemo(() => sumChunks(base.slice(-84), 7), [base]);
  const monthly = useMemo(() => sumChunks(base, 30), [base]);

  const total = daily.reduce((a, d) => a + d.value, 0);
  const best = daily.length ? Math.max(...daily.map((d) => d.value)) : 0;
  const worst = daily.length ? Math.min(...daily.map((d) => d.value)) : 0;

  const wins = apiWins;
  const losses = apiLosses;
  const rate = apiWinRate ?? (wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0);

  const summary = [
    { label: "Net", value: total },
    { label: "Best day", value: best },
    { label: "Worst day", value: worst },
  ];

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/20 py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
        </div>
      )}
      {!loading && series.length === 0 && (
        <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          No trading activity in this period yet. Analytics are built from your trade execution history.
        </p>
      )}
      {/* Daily profit / loss: interactive bar chart */}
      <Card className="border-violet-500/20 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-xl font-extrabold tracking-tight">Daily Profit / Loss</CardTitle>
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
          <PnlBarChart data={daily} tickFormatter={shortDate} labelFormatter={longDate} height="h-[280px]" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xl font-extrabold tracking-tight">Weekly Performance</CardTitle>
              <SampleBadge text={`TRADE EXECUTIONS · ${env.toUpperCase()}`} tone={env === "live" ? "green" : "amber"} />
            </div>
            <CardDescription>Net P/L per week, last 12 weeks</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <PnlBarChart data={weekly} height="h-[220px]" />
          </CardContent>
        </Card>

        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xl font-extrabold tracking-tight">Monthly Performance</CardTitle>
              <SampleBadge text={`TRADE EXECUTIONS · ${env.toUpperCase()}`} tone={env === "live" ? "green" : "amber"} />
            </div>
            <CardDescription>Net P/L per 30-day period, last 90 days</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <PnlBarChart data={monthly} height="h-[220px]" />
          </CardContent>
        </Card>
      </div>

      {/* Winning vs losing trades: unchanged */}
      <Card className="border-violet-500/20 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xl font-extrabold tracking-tight">Winning vs Losing Trades</CardTitle><SampleBadge text={`TRADE EXECUTIONS · ${env.toUpperCase()}`} tone={env === "live" ? "green" : "amber"} />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="bg-emerald-500" style={{ width: `${rate}%` }} />
            <div className="bg-red-500" style={{ width: `${100 - rate}%` }} />
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs font-semibold">
            <span className="text-emerald-600 dark:text-emerald-400">{wins} winning</span>
            <span className="text-red-600 dark:text-red-400">{losses} losing</span>
            <span>Win rate {rate}%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────── Trading setup view ───────────────── */

function SetupView({
  answers, env, connected, broker, onRestart, onReset, onChanged,
}: {
  answers: Answers; env: Mode; connected: boolean; broker: ApiBrokerStatus | null;
  onRestart: () => void; onReset: () => void; onChanged?: () => void;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      {/* Left: stays in place while the right side scrolls */}
      <aside className="space-y-6 lg:sticky lg:top-24">
        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-extrabold tracking-tight">Broker Connection</CardTitle>
            <CardDescription>We trade Gold on your Capital.com account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AnimatedBrokerLogos
              shillmonger={
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/pfp.jpg" alt="Shillmonger" className="h-12 w-12 rounded-xl object-cover" />
              }
              capital={
                // eslint-disable-next-line @next/next/no-img-element
                <img src={CAPITAL_LOGO} alt="Capital.com" className="h-12 w-12 rounded-xl object-cover" />
              }
            />
            <p className="text-center text-xs text-muted-foreground">{DISCLAIMER}</p>
            <p className={`text-center text-xs font-bold ${
              !connected
                ? "text-amber-600 dark:text-amber-400"
                : env === "live"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
            }`}>
              {connected ? `Connected · ${env.toUpperCase()} environment` : "Not connected"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-extrabold tracking-tight">Your Answers</CardTitle>
            <CardDescription>Your saved setup answers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-2">
              {[["Pair", "XAU/USD"], ["Experience", answers.experience || "Not set"]].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</p>
                  <p className="mt-0.5 text-sm font-bold">{v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={onRestart} className="h-10 w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-bold text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-purple-500">Edit setup</Button>
              <Button
                variant="outline"
                onClick={onReset}
                className="h-10 w-full rounded-xl border-rose-500/40 text-sm font-bold text-rose-600 dark:text-rose-400"
              >
                Reset - Start over
              </Button>
            </div>
          </CardContent>
        </Card>
      </aside>

      {/* Right: connect form first, then API guide */}
      <div className="min-w-0 space-y-6">
        <CapitalConnectForm env={env} onSuccess={onChanged} />

        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>[ // CAPITAL.COM API ]</p>
            <CardTitle className="text-xl font-extrabold tracking-tight">Power your bot through the Capital.com API</CardTitle>
            <CardDescription>
              The bot opens and manages XAU/USD trades through an API key you create in your own Capital.com account.
              You stay in control and can delete the key at any time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiSteps />
          </CardContent>
        </Card>

        <DangerZone broker={broker} onChanged={onChanged} />
      </div>
    </div>
  );
}

/* ───────────────── Dashboard shell ───────────────── */

function Dashboard({
  answers, setAnswers, onRestart,
}: { answers: Answers; setAnswers: (a: Answers) => void; onRestart: () => void }) {
  const [view, setView] = useState<View>("dashboard");
  const [confirmLive, setConfirmLive] = useState(false);
  const [envBusy, setEnvBusy] = useState(false);
  const env = answers.env;

  const data = useTradingData(env);

  const closedTrades = data.trades.filter((t) => t.status !== "OPEN");
  const totalProfit = closedTrades.reduce((a, t) => a + (t.pl ?? 0), 0);
  const openPl = data.positions.reduce((a, p) => a + (p.pl ?? 0), 0);

  const applyEnv = async (m: Mode) => {
    setEnvBusy(true);
    try {
      const ok = await data.setEnvironment(m);
      if (ok) {
        setAnswers({ ...answers, env: m });
        toast.success(`Environment set to ${m.toUpperCase()}`);
      } else {
        toast.error(
          m === "live"
            ? "Live environment is not available — broker session could not be verified."
            : "Could not switch environment. Try again."
        );
      }
    } finally {
      setEnvBusy(false);
    }
  };

  const switchEnv = (m: Mode) => {
    if (m === env) return;
    if (m === "live") setConfirmLive(true);
    else void applyEnv("demo");
  };

  const handleBot = async (s: BotState) => {
    try {
      await data.setBot(s);
      toast.success(`Bot ${s === "running" ? "start" : s === "paused" ? "paused" : "stopped"} preference saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update bot");
    }
  };

  const handleAutomation = async (v: boolean) => {
    try {
      await data.setAutomationEnabled(v);
      toast.success(v ? "Automation enabled — signals will execute" : "Automation disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update automation");
    }
  };

  const handleEmergencyStop = async (v: boolean) => {
    try {
      await data.setEmergencyStop(v);
      toast.success(v ? "Emergency stop activated" : "Emergency stop cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update emergency stop");
    }
  };

  const statusNote = !data.connected
    ? "Broker not connected — connect Capital.com in Trading Setup."
    : data.botState === "running"
      ? `Automation armed for ${env.toUpperCase()} — executing validated signals via Capital.com.`
      : "Automation preference saved. Start the bot to allow signal execution.";

  const reset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setAnswers(EMPTY);
    onRestart();
  };

  const current = NAV.find((n) => n.key === view);
  const badgeText = data.connected
    ? `CAPITAL.COM · ${env.toUpperCase()}`
    : data.loading
      ? "LOADING…"
      : "NOT CONNECTED";

  return (
    <div className="space-y-4 py-4">
      {/* breadcrumb-style navigation */}
      <nav aria-label="Trading sections" className={`${plexMono.className} flex items-center gap-1 overflow-x-auto whitespace-nowrap text-sm`}>
        {NAV.map((n, i) => (
          <span key={n.key} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/50">/</span>}
            <button
              type="button" onClick={() => setView(n.key)} aria-current={view === n.key ? "page" : undefined}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 font-semibold transition-colors ${
                view === n.key ? "bg-violet-500/15 text-violet-600 dark:text-violet-300" : "text-muted-foreground hover:text-foreground"
              }`}
            > {n.label}
            </button>
          </span>
        ))}
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>[ // {current?.label.toUpperCase()} ]</p>
          <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight">
            Shill<span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">monger</span> Terminal
          </h1>
        </div>
        <SampleBadge text={badgeText} tone={env === "live" ? "green" : "amber"} />
      </div>

      {data.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-600 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {data.error}
        </div>
      )}

      {view === "dashboard" && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <StatCard
              icon={<Wallet className="h-4 w-4" />}
              label="Account Balance"
              value={data.summary?.balance != null ? money(data.summary.balance) : "—"}
              tone="bg-violet-500/15 text-violet-600 dark:text-violet-400"
            />
            <StatCard
              icon={openPl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              label="Open P/L"
              value={data.positions.length ? signed(openPl) : "—"}
              valueCls={plTone(openPl)}
              tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              icon={<Trophy className="h-4 w-4" />}
              label="Total Profit"
              value={closedTrades.length ? signed(totalProfit) : "—"}
              valueCls={plTone(totalProfit)}
              tone="bg-purple-500/15 text-purple-600 dark:text-purple-400"
            />
            <StatCard
              icon={<LineChart className="h-4 w-4" />}
              label="Open Positions"
              value={String(data.summary?.openPositionsCount ?? data.positions.length)}
              tone="bg-violet-500/15 text-violet-600 dark:text-violet-400"
            />
            <StatCard
              icon={<Percent className="h-4 w-4" />}
              label="Win Rate"
              value={data.winRate != null ? `${data.winRate}%` : "—"}
              tone="bg-rose-500/15 text-rose-600 dark:text-rose-400"
            />
          </section>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <BrokerAccount broker={data.broker} />
            <BotControl
              bot={data.botState}
              setBot={(s) => void handleBot(s)}
              env={env}
              onEnv={switchEnv}
              statusNote={statusNote}
              automationEnabled={data.automationEnabled}
              onAutomationEnabled={(v) => void handleAutomation(v)}
              emergencyStop={data.emergencyStop}
              onEmergencyStop={(v) => void handleEmergencyStop(v)}
            />
          </div>
          {data.emergencyStop && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0" /> EMERGENCY STOP ACTIVE — no new trades will be submitted.
            </div>
          )}
          <PositionsTable positions={data.positions} loading={data.loading} connected={data.connected} env={env} />
        </>
      )}

      {view === "analytics" && (
        <Analytics
          series={data.daily}
          winRate={data.winRate}
          wins={data.wins}
          losses={data.losses}
          loading={data.loading}
          env={env}
        />
      )}

      {view === "setup" && (
        <SetupView
          answers={answers}
          env={env}
          connected={data.connected}
          broker={data.broker}
          onRestart={onRestart}
          onReset={reset}
          onChanged={data.refresh}
        />
      )}

      <p className="pb-4 text-center text-xs text-muted-foreground">
        Leveraged trading and CFDs carry significant risk of loss. Figures shown come from your connected Capital.com {env.toUpperCase()} account.
      </p>

      
{confirmLive && (
  <div
    className="fixed inset-0 z-500 flex items-center justify-center
    bg-black/40 px-4 py-6 backdrop-blur-sm
    animate-in fade-in duration-300"
    role="dialog"
    aria-modal="true"
    aria-labelledby="live-dialog-title"
  >
    <Card className="
      w-full max-w-md overflow-hidden
      rounded-2xl border border-rose-500/20
      bg-background/95 text-foreground
      shadow-2xl shadow-black/20
      backdrop-blur-2xl
      animate-in zoom-in-95 slide-in-from-bottom-3 duration-300
    ">
      <CardContent className="space-y-5 p-5 sm:p-5">

        {/* Icon */}
        <div className="flex h-10 w-10 items-center justify-center
          rounded-xl border border-rose-500/20
          bg-rose-500/10 shadow-inner"
        >
          <ShieldAlert className="h-5 w-5 text-rose-500" />
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h2
            id="live-dialog-title"
            className="text-xl font-extrabold tracking-tight"
          >
            Switch to Live?
          </h2>

          <p className="text-sm leading-relaxed text-muted-foreground">
            Live trading uses real funds on your Capital.com account. The switch is verified
            server-side — if your live session cannot be authenticated, the environment will not change.
          </p>
        </div>

        {/* Buttons */}
        <div className="
          flex w-full flex-col gap-2
          sm:flex-row sm:justify-end
        ">
          <Button
            variant="outline"
            onClick={() => setConfirmLive(false)}
            className="
              h-11 w-full rounded-xl
              border-border bg-background
              transition-all duration-200
              hover:border-muted-foreground/40
              sm:flex-1
            "
          >
            Stay on Demo
          </Button>

          <Button
            disabled={envBusy}
            onClick={() => {
              setConfirmLive(false);
              void applyEnv("live");
            }}
            className="
              h-11 w-full rounded-xl
              bg-gradient-to-r from-violet-600 to-purple-600
              font-semibold text-white
              shadow-lg shadow-violet-500/20
              transition-all duration-200
              hover:scale-[1.02] hover:from-violet-500 hover:to-purple-500
              active:scale-[0.98]
              sm:flex-1
            "
          >
            I understand, switch
          </Button>
        </div>

      </CardContent>
    </Card>
  </div>
)}

    </div>
  );
}

/* ───────────────── Page ───────────────── */

export default function TradingSetupPage() {
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Deferred so localStorage reads (and the resulting setState) do not
    // run synchronously inside the effect body.
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { answers: Answers; done: boolean };
          setAnswers({ ...EMPTY, ...parsed.answers });
          setDone(!!parsed.done);
        }
      } catch { /* storage unavailable: start fresh */ }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, done })); } catch { /* ignore */ }
  }, [answers, done, ready]);

  if (!ready) return <div className="min-h-screen bg-background" />;

  return done ? (
    <Dashboard answers={answers} setAnswers={setAnswers} onRestart={() => { setDone(false); }} />
  ) : (
    <Onboarding
      answers={answers}
      setAnswers={setAnswers}
      onFinish={() => {
        setDone(true);
      }}
    />
  );
}