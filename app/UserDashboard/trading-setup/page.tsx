"use client";

import { useEffect, useMemo, useState } from "react";
import { IBM_Plex_Mono } from "next/font/google";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis } from "recharts";
import {
  AlertTriangle, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  BarChart3, Bot, Check, KeyRound, LayoutDashboard, LineChart, Link2,
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
  id: string; symbol: string; dir: "BUY" | "SELL"; entry: number; current: number;
  size: number; sl: number; tp: number; pl: number;
}
interface Trade {
  id: string; symbol: string; dir: "BUY" | "SELL"; entry: number; exit: number | null;
  opened: string; closed: string | null; pl: number; status: "WIN" | "LOSS" | "OPEN";
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

const POSITIONS: Position[] = [
  { id: "P-101", symbol: "XAU/USD", dir: "BUY", entry: 4405.72, current: 4418.3, size: 0.02, sl: 4390.0, tp: 4440.0, pl: 25.16 },
  { id: "P-102", symbol: "EUR/USD", dir: "SELL", entry: 1.0842, current: 1.0861, size: 0.1, sl: 1.0885, tp: 1.0780, pl: -19.0 },
  { id: "P-103", symbol: "USD/JPY", dir: "BUY", entry: 151.22, current: 151.64, size: 0.05, sl: 150.8, tp: 152.4, pl: 13.85 },
];

const TRADES: Trade[] = [
  { id: "TRD-001", symbol: "XAU/USD", dir: "BUY", entry: 4388.23, exit: 4413.33, opened: "2026-11-11 09:14", closed: "2026-11-11 11:40", pl: 125.5, status: "WIN" },
  { id: "TRD-002", symbol: "XAU/USD", dir: "SELL", entry: 4388.71, exit: 4397.77, opened: "2026-11-11 12:02", closed: "2026-11-11 12:51", pl: -45.3, status: "LOSS" },
  { id: "TRD-003", symbol: "GBP/USD", dir: "SELL", entry: 1.2641, exit: 1.2603, opened: "2026-11-10 08:30", closed: "2026-11-10 14:05", pl: 78.25, status: "WIN" },
  { id: "TRD-004", symbol: "USD/CAD", dir: "BUY", entry: 1.3712, exit: 1.3688, opened: "2026-11-10 15:11", closed: "2026-11-10 16:20", pl: -32.1, status: "LOSS" },
  { id: "TRD-005", symbol: "AUD/USD", dir: "BUY", entry: 0.6544, exit: 0.6571, opened: "2026-11-09 07:45", closed: "2026-11-09 10:30", pl: 56.8, status: "WIN" },
  { id: "TRD-006", symbol: "USD/CHF", dir: "SELL", entry: 0.8812, exit: 0.8799, opened: "2026-11-09 13:00", closed: "2026-11-09 15:42", pl: 12.4, status: "WIN" },
  { id: "TRD-007", symbol: "XAU/USD", dir: "BUY", entry: 4405.72, exit: null, opened: "2026-11-12 08:20", closed: null, pl: 25.16, status: "OPEN" },
  { id: "TRD-008", symbol: "EUR/USD", dir: "SELL", entry: 1.0842, exit: null, opened: "2026-11-12 09:05", closed: null, pl: -19.0, status: "OPEN" },
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

function generateSeries(seed: number, days: number): DayPoint[] {
  let s = seed;
  const rand = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const DAY = 86400000;
  const base = new Date("2026-11-12T00:00:00Z").getTime();
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(base - (days - 1 - i) * DAY).toISOString(),
    value: Math.round((-90 + rand() * 300) * 100) / 100,
  }));
}

function sumChunks(points: DayPoint[], size: number): PnlPoint[] {
  const out: PnlPoint[] = [];
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size);
    out.push({ x: shortDate(chunk[0].date), value: chunk.reduce((a, p) => a + p.value, 0) });
  }
  return out;
}

const SampleBadge = ({ text = "DEMO / SAMPLE DATA" }: { text?: string }) => (
  <span className={`${plexMono.className} inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-600 dark:text-amber-400`}>
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

function CapitalConnectForm({ env }: { env: Mode }) {
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
      const res = await fetch("/api/capital/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), apiKey: apiKey.trim(), apiPassword, env }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not connect. Check your details and try again.");
      setStatus("success");
      setMessage("Capital.com account connected.");
      // Never keep credentials in the browser after submitting.
      setEmail(""); setApiKey(""); setApiPassword("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  };

  return (
    <form onSubmit={submit} autoComplete="off" className="space-y-4 rounded-2xl border border-violet-500/20 bg-card p-5 shadow-sm">
      <div>
        <p className="text-base font-bold">Connect your Capital.com account</p>
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

      <div className="space-y-1.5">
        <label htmlFor="cap-key" className="flex items-center gap-1.5 text-xs font-semibold">
          <KeyRound className="h-3.5 w-3.5 text-violet-500" /> API key
        </label>
        <input id="cap-key" type="password" required autoComplete="off" spellCheck={false} value={apiKey}
          onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your API key" className={INPUT_CLS} />
        <p className="text-[11px] text-muted-foreground">Capital.com → Settings → API integrations.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cap-pass" className="flex items-center gap-1.5 text-xs font-semibold">
          <Lock className="h-3.5 w-3.5 text-violet-500" /> Custom API-key password
        </label>
        <input id="cap-pass" type="password" required autoComplete="new-password" value={apiPassword}
          onChange={(e) => setApiPassword(e.target.value)} placeholder="The password you set for this key" className={INPUT_CLS} />
        <p className="text-[11px] text-muted-foreground">Not your normal Capital.com login password.</p>
      </div>

      {status === "success" && (
        <p role="status" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{message}</p>
      )}
      {status === "error" && (
        <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">{message}</p>
      )}

      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-10 w-full gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-bold text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-purple-500"
      >
        {status === "loading" ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting</> : "Connect account"}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
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
      <p className="text-center text-[11px] text-muted-foreground">{DISCLAIMER}</p>
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
const TH = "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground";
const TD = "px-3 py-2 text-sm font-medium tabular-nums";

const DirTag = ({ dir }: { dir: "BUY" | "SELL" }) => (
  <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider ${dir === "BUY" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
    {dir === "BUY" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
    {dir}
  </span>
);

function PositionsTable() {
  return (
    <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
        <CardTitle className="text-xl font-bold">Open Positions</CardTitle>
        <SampleBadge />
      </CardHeader>
      <TableShell min={900}>
        <thead>
          <tr className="border-y border-border/50 bg-muted/20">
            {["Instrument", "Direction", "Entry", "Current", "Size", "Stop-loss", "Take-profit", "Unrealized P/L", "Status"].map((h) => <th key={h} className={TH}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {POSITIONS.map((p) => (
            <tr key={p.id} className="hover:bg-muted/30">
              <td className={`${TD} font-bold`}>{p.symbol}</td>
              <td className={TD}><DirTag dir={p.dir} /></td>
              <td className={TD}>{p.entry}</td>
              <td className={TD}>{p.current}</td>
              <td className={TD}>{p.size.toFixed(2)}</td>
              <td className={TD}>{p.sl}</td>
              <td className={TD}>{p.tp}</td>
              <td className={`${TD} font-bold ${plTone(p.pl)}`}>{signed(p.pl)}</td>
              <td className={TD}><span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-violet-600 dark:text-violet-300">Open</span></td>
            </tr>
          ))}
        </tbody>
      </TableShell>
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
        <p className="truncate text-sm font-bold">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <Toggle on={on} onClick={onToggle} label={label} />
    </div>
  );
}

function BotControl({
  a, credits, bot, setBot, env, onEnv,
}: { a: Answers; credits: number; bot: BotState; setBot: (b: BotState) => void; env: Mode; onEnv: (m: Mode) => void }) {
  const rows = [
    ["Pair", "XAU/USD"],
    ["Level", a.experience || "Not set"],
    ["Credits", String(credits)],
  ];
  return (
    <Card className="gap-3 border-violet-500/20 py-4 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4">
        <CardTitle className="flex items-center gap-2 text-lg font-bold"><Bot className="h-4 w-4 text-violet-500" /> Bot Control</CardTitle>
        <SampleBadge text="UI DEMO ONLY" />
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
        </div>
        {env === "live" && <Notice tone="danger">Live is a preview only. No trades are placed from this screen.</Notice>}
        <div className="grid grid-cols-3 gap-2">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</p>
              <p className="mt-0.5 truncate text-sm font-bold" title={v}>{v}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Demonstration only. No bot is running.</p>
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

function Analytics() {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const full = useMemo(() => generateSeries(7, 90), []);

  const daily = useMemo(
    () => full.slice(-Number(period)).map((p) => ({ x: p.date, value: p.value })),
    [full, period],
  );
  const weekly = useMemo(() => sumChunks(full.slice(-84), 7), [full]);
  const monthly = useMemo(() => sumChunks(full, 30), [full]);

  const total = daily.reduce((a, d) => a + d.value, 0);
  const best = Math.max(...daily.map((d) => d.value));
  const worst = Math.min(...daily.map((d) => d.value));

  const wins = TRADES.filter((t) => t.status === "WIN").length;
  const losses = TRADES.filter((t) => t.status === "LOSS").length;
  const rate = Math.round((wins / (wins + losses)) * 100);

  const summary = [
    { label: "Net", value: total },
    { label: "Best day", value: best },
    { label: "Worst day", value: worst },
  ];

  return (
    <div className="space-y-6">
      {/* Daily profit / loss: interactive bar chart */}
      <Card className="gap-0 overflow-hidden border-violet-500/20 py-0 shadow-sm">
        <CardHeader className="flex flex-col items-stretch gap-0 border-b p-0 sm:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-2 px-6 pb-3 pt-4 sm:py-0">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-extrabold tracking-tight">Daily Profit / Loss</CardTitle>
              <SampleBadge />
            </div>
            <CardDescription>Net result per day over the last {period} days</CardDescription>
            <div><Segmented value={period} onChange={setPeriod} options={[{ key: "7", label: "7D" }, { key: "30", label: "30D" }, { key: "90", label: "90D" }]} /></div>
          </div>
          <div className="flex">
            {summary.map((s) => (
              <div key={s.label} className="relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className={`font-mono text-lg font-bold leading-none tabular-nums sm:text-2xl ${plTone(s.value)}`}>{signed(s.value)}</span>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="px-2 py-4 sm:p-6">
          <PnlBarChart data={daily} tickFormatter={shortDate} labelFormatter={longDate} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xl font-bold">Weekly Performance</CardTitle>
              <SampleBadge />
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
              <CardTitle className="text-xl font-bold">Monthly Performance</CardTitle>
              <SampleBadge />
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
          <CardTitle className="text-xl font-bold">Winning vs Losing Trades</CardTitle><SampleBadge />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
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
  answers, env, onRestart, onReset,
}: { answers: Answers; env: Mode; onRestart: () => void; onReset: () => void }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      {/* Left: stays in place while the right side scrolls */}
      <aside className="space-y-6 lg:sticky lg:top-24">
        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Broker Connection</CardTitle>
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
            <p className="text-center text-[11px] text-muted-foreground">{DISCLAIMER}</p>
          </CardContent>
        </Card>

        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Your Answers</CardTitle>
            <CardDescription>Your saved setup answers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {[["Pair", "XAU/USD"], ["Experience", answers.experience || "Not set"]].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
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
        <CapitalConnectForm env={env} />

        <Card className="border-violet-500/20 shadow-sm">
          <CardHeader>
            <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>[ // CAPITAL.COM API ]</p>
            <CardTitle className="text-2xl font-extrabold tracking-tight">Power your bot through the Capital.com API</CardTitle>
            <CardDescription>
              The bot opens and manages XAU/USD trades through an API key you create in your own Capital.com account.
              You stay in control and can delete the key at any time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiSteps />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ───────────────── Dashboard shell ───────────────── */

function Dashboard({
  answers, setAnswers, onRestart,
}: { answers: Answers; setAnswers: (a: Answers) => void; onRestart: () => void }) {
  const [view, setView] = useState<View>("dashboard");
  const [bot, setBot] = useState<BotState>("stopped");
  const [confirmLive, setConfirmLive] = useState(false);
  const env = answers.env;
  const credits = 120;

  const closedTrades = TRADES.filter((t) => t.status !== "OPEN");
  const winRate = Math.round((closedTrades.filter((t) => t.status === "WIN").length / closedTrades.length) * 100);
  const totalProfit = closedTrades.reduce((a, t) => a + t.pl, 0);
  const openPl = POSITIONS.reduce((a, p) => a + p.pl, 0);

  const switchEnv = (m: Mode) => {
    if (m === "live") setConfirmLive(true);
    else setAnswers({ ...answers, env: "demo" });
  };

  const reset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setAnswers(EMPTY);
    onRestart();
  };

  const current = NAV.find((n) => n.key === view);

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
        <SampleBadge />
      </div>

      {view === "dashboard" && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <StatCard icon={<Wallet className="h-4 w-4" />} label="Account Balance" value={money(10425.5)} tone="bg-violet-500/15 text-violet-600 dark:text-violet-400" />
            <StatCard icon={openPl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} label="Today's P/L" value={signed(openPl)} valueCls={plTone(openPl)} tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
            <StatCard icon={<Trophy className="h-4 w-4" />} label="Total Profit" value={signed(totalProfit)} valueCls={plTone(totalProfit)} tone="bg-purple-500/15 text-purple-600 dark:text-purple-400" />
            <StatCard icon={<LineChart className="h-4 w-4" />} label="Open Positions" value={String(POSITIONS.length)} tone="bg-violet-500/15 text-violet-600 dark:text-violet-400" />
            <StatCard icon={<Percent className="h-4 w-4" />} label="Win Rate" value={`${winRate}%`} tone="bg-rose-500/15 text-rose-600 dark:text-rose-400" />
          </section>
          <BotControl a={answers} credits={credits} bot={bot} setBot={setBot} env={env} onEnv={switchEnv} />
          <PositionsTable />
        </>
      )}

      {view === "analytics" && <Analytics />}

      {view === "setup" && <SetupView answers={answers} env={env} onRestart={onRestart} onReset={reset} />}

      <p className="pb-4 text-center text-[11px] text-muted-foreground">
        Leveraged trading and CFDs carry significant risk of loss. All figures shown are simulated sample data.
      </p>

      {confirmLive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
          <Card className="w-full max-w-md border-rose-500/30">
            <CardContent className="space-y-4 p-6">
              <ShieldAlert className="h-9 w-9 text-rose-500" />
              <h2 className="text-lg font-extrabold">Switch to Live?</h2>
              <p className="text-sm text-muted-foreground">Real money is at risk in live trading. In this preview, Live is only a display setting and no trades will be placed.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmLive(false)} className="rounded-lg">Stay on Demo</Button>
                <Button onClick={() => { setAnswers({ ...answers, env: "live" }); setConfirmLive(false); }} className="rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white">I understand, switch</Button>
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { answers: Answers; done: boolean };
        setAnswers({ ...EMPTY, ...parsed.answers });
        setDone(!!parsed.done);
      }
    } catch { /* storage unavailable: start fresh */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, done })); } catch { /* ignore */ }
  }, [answers, done, ready]);

  if (!ready) return <div className="min-h-screen bg-background" />;

  return done ? (
    <Dashboard answers={answers} setAnswers={setAnswers} onRestart={() => { setDone(false); }} />
  ) : (
    <Onboarding answers={answers} setAnswers={setAnswers} onFinish={() => setDone(true)} />
  );
}