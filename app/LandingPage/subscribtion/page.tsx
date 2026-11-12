"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Montserrat } from "next/font/google";
import {
  Check,
  X,
  Info,
  Zap,
  Star,
  Coins,
  CalendarCheck,
  Ban,
  Wallet,
  TrendingUp,
  Infinity as InfinityIcon,
  Landmark,
} from "lucide-react";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

/* ─────────────────────────────────────────────────────────────
   9 PLANS: 1 free demo + 8 prepaid credit packages ($20 – $1,000)
   Credit packages are NOT monthly subscriptions.
   Profitable Trading Days = credits / CREDITS_PER_PROFITABLE_DAY
───────────────────────────────────────────────────────────── */
const CREDITS_PER_PROFITABLE_DAY = 200;

type Plan = {
  id: string;
  name: string;
  price: number; // USD
  credits: number;
  isFree?: boolean;
  popular?: boolean;
  description: string;
  benefits: string[];
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    credits: 0,
    isFree: true,
    description:
      "Practice XAUUSD automation on a demo account, risk-free. The Free plan is for demo accounts only and stays free forever.",
    benefits: [
      "Full bot access on a demo MT5 account",
      "Free forever, no expiry",
      "No credits needed",
      "No live capital at risk",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 20,
    credits: 1000,
    description: "A low-cost way to start live XAUUSD automation with prepaid credits.",
    benefits: [
      "Credits only used on profitable days",
      "Unused credits roll over, no expiry",
      "One-time purchase, no billing cycle",
      "Upgrade to a bigger package anytime",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    price: 50,
    credits: 3000,
    description: "More profitable trading days for growing accounts.",
    benefits: [
      "Credits only used on profitable days",
      "Unused credits roll over, no expiry",
      "One-time purchase, no billing cycle",
      "Upgrade to a bigger package anytime",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    price: 100,
    credits: 6000,
    popular: true,
    description: "Our most popular package for consistent, ongoing automation.",
    benefits: [
      "Credits only used on profitable days",
      "Unused credits roll over, no expiry",
      "One-time purchase, no billing cycle",
      "Upgrade to a bigger package anytime",
    ],
  },
  {
    id: "silver",
    name: "Silver",
    price: 150,
    credits: 10000,
    description: "Extended coverage with a better credit-to-price ratio.",
    benefits: [
      "Credits only used on profitable days",
      "Unused credits roll over, no expiry",
      "One-time purchase, no billing cycle",
      "Upgrade to a bigger package anytime",
    ],
  },
  {
    id: "gold",
    name: "Gold",
    price: 200,
    credits: 14000,
    description: "Built for active traders who want a long runway of profitable days.",
    benefits: [
      "Credits only used on profitable days",
      "Unused credits roll over, no expiry",
      "One-time purchase, no billing cycle",
      "Upgrade to a bigger package anytime",
    ],
  },
  {
    id: "platinum",
    name: "Platinum",
    price: 350,
    credits: 26000,
    description: "High-volume credits for larger live accounts.",
    benefits: [
      "Credits only used on profitable days",
      "Unused credits roll over, no expiry",
      "One-time purchase, no billing cycle",
      "Upgrade to a bigger package anytime",
    ],
  },
  {
    id: "diamond",
    name: "Diamond",
    price: 500,
    credits: 40000,
    description: "Serious capacity for long-term automated trading.",
    benefits: [
      "Credits only used on profitable days",
      "Unused credits roll over, no expiry",
      "One-time purchase, no billing cycle",
      "Upgrade to a bigger package anytime",
    ],
  },
  {
    id: "ultimate",
    name: "Ultimate",
    price: 1000,
    credits: 90000,
    description: "Maximum credits and the lowest cost per profitable day.",
    benefits: [
      "Credits only used on profitable days",
      "Unused credits roll over, no expiry",
      "One-time purchase, no billing cycle",
      "Upgrade to a bigger package anytime",
    ],
  },
];

const fmt = (n: number) => n.toLocaleString("en-US");
const profitableDays = (credits: number) => Math.floor(credits / CREDITS_PER_PROFITABLE_DAY);
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const everyPlan = [
  { icon: TrendingUp, label: "Profit days only", value: `${CREDITS_PER_PROFITABLE_DAY} credits / day` },
  { icon: Ban, label: "Other days", value: "0 credits used" },
  { icon: InfinityIcon, label: "Credit expiry", value: "Never expires" },
  { icon: Wallet, label: "Billing", value: "One-time prepaid" },
];

const PAYMENT_METHODS = [
  { name: "Mastercard", src: "https://cdn.simpleicons.org/mastercard/EB001B" },
  { name: "Crypto (USDT)", src: "https://cdn.simpleicons.org/tether/26A17B" },
];


const comparisonData = [
  {
    metric: "Execution Speed",
    manual: "Slow, limited by human reaction",
    automated: "Fast, rule-based algorithmic execution",
  },
  {
    metric: "Strategy",
    manual: "Driven by greed, fear and FOMO",
    automated: "Guided by predefined trading rules",
  },
  {
    metric: "Consistency",
    manual: "Depends on mood and focus",
    automated: "Repeatable execution based on configured rules",
  },
  {
    metric: "Availability",
    manual: "Active only when the trader is available",
    automated: "Operates 24/5 when markets are open",
  },
  {
    metric: "Setup & Ease",
    manual: "Complex analysis and a steep learning curve",
    automated: "AI presets with ready-made GRID/DCA setups",
  },
  {
    metric: "Risk Management",
    manual: "Requires constant manual monitoring",
    automated: "Configured stop-loss and position limits",
  },
  {
    metric: "Emotional Control",
    manual: "Fear, greed and revenge trading can interfere",
    automated: "Executes without emotional decision-making",
  },
  {
    metric: "Market Monitoring",
    manual: "Requires watching charts continuously",
    automated: "Automated signal and trade monitoring",
  },
  {
    metric: "Multitasking",
    manual: "Difficult to monitor multiple opportunities",
    automated: "Can process multiple eligible trading accounts",
  },
  {
    metric: "Trade Management",
    manual: "Requires manually adjusting and tracking trades",
    automated: "Automatically monitors configured trade parameters",
  },
  {
    metric: "Signal Execution",
    manual: "Requires reading and placing trades manually",
    automated: "Processes supported signals automatically",
  },
  {
    metric: "Human Error",
    manual: "Prone to miscalculations and execution mistakes",
    automated: "Reduces repetitive manual execution errors",
  },
  {
    metric: "Time Commitment",
    manual: "Requires significant screen time",
    automated: "Reduces the need for constant chart watching",
  },
  {
    metric: "Scalability",
    manual: "Limited by individual attention and capacity",
    automated: "Designed to manage multiple connected accounts",
  },
  {
    metric: "Trade Tracking",
    manual: "Requires manual record keeping",
    automated: "Centralized trade history and performance tracking",
  },
  {
    metric: "Rule Enforcement",
    manual: "Discipline can change from trade to trade",
    automated: "Follows configured trading parameters consistently",
  },
  {
    metric: "Decision Fatigue",
    manual: "Repeated decisions can cause mental exhaustion",
    automated: "Automates repetitive execution decisions",
  },
  {
    metric: "Performance Review",
    manual: "Requires manually reviewing trading records",
    automated: "Provides structured trade and profit/loss records",
  },
];


/* ───────────────────────── small helpers ───────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400 sm:text-sm">
      {children}
    </p>
  );
}

function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-semibold ${accent ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */
export default function SubscriptionPage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("standard");

  const N = PLANS.length; // 9
  const index = PLANS.findIndex((p) => p.id === selectedId);
  const plan = PLANS[index];
  const days = profitableDays(plan.credits);

  /* Passes plan id, name, price and credits to the existing login / payment flow.
     Credits are NOT activated here; activation must only happen after payment is verified server-side. */
  const handleGetStarted = (p: Plan) => {
    if (p.isFree) {
      router.push("/auth-page/register");
      return;
    }
    const params = new URLSearchParams({
      plan: p.id,
      name: p.name,
      amount: String(p.price),
      credits: String(p.credits),
    });
    router.push(`/auth-page/login?${params.toString()}`);
  };

  return (
    <main className="flex min-h-screen flex-col bg-background pb-24 font-sans text-foreground">
      {/* Header */}
      <section className="mx-auto w-full max-w-[1500px] px-4 pb-8 pt-15 lg:px-10">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-violet-600/80 dark:text-violet-400/80">
          [ // Credit Packages ]
        </p>

        <h1
          className={`${montserrat.className} max-w-3xl text-3xl font-black leading-[1.02] uppercase tracking-tight text-foreground sm:text-4xl md:text-5xl`}
        >
          Choose Your{" "}
          <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">
            Trading Credits
          </span>
        </h1>

        <p className="mt-5 max-w-2xl text-sm font-normal leading-relaxed text-muted-foreground md:text-base">
          Start free on a demo account, or buy prepaid credits from $20 to $1,000. Credits are only used on profitable
          trading days and never expire.
        </p>
      </section>

      {/* Selector + details */}
      <section className="mx-auto w-full max-w-[1500px] px-4 lg:px-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT: plan list + features + CTA */}
          <div className="lg:col-span-8">
            <div className="rounded-3xl border border-violet-500/20 bg-card p-4 shadow-xl shadow-violet-600/5 sm:p-5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
                {/* Plan list */}
                <div className="flex flex-col gap-2.5 md:col-span-2">
                  {PLANS.map((p) => {
                    const active = p.id === selectedId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        aria-pressed={active}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-300
                          ${active
                            ? "border-violet-500 bg-gradient-to-r from-violet-500/20 to-transparent shadow-[0_0_24px_-6px] shadow-violet-500/50"
                            : "border-border bg-muted/30 hover:border-violet-500/40 hover:bg-violet-500/5"
                          }`}
                      >
                        <span className="min-w-0">
                          <span className={`${montserrat.className} block truncate text-sm font-extrabold text-foreground`}>
                            {p.name}
                          </span>
                          <span className="block text-xs text-muted-foreground sm:text-sm">
                            {p.isFree ? "Demo accounts only" : `${fmt(p.credits)} credits`}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          {p.popular && (
                            <span className="rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                              Popular
                            </span>
                          )}
                          <span
                            className={`${montserrat.className} text-lg font-extrabold ${p.isFree ? "text-emerald-500" : active ? "text-violet-600 dark:text-violet-300" : "text-foreground"
                              }`}
                          >
                            {p.isFree ? "FREE" : `$${fmt(p.price)}`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Features */}
                <div key={plan.id} className="animate-in fade-in duration-300 md:col-span-3">
                  <SectionLabel>Plan Features</SectionLabel>
                  <div className="divide-y divide-border/60">
                    <Row label="Total Credits" value={plan.isFree ? "Not required" : fmt(plan.credits)} />
                    <Row
                      label="Est. Profitable Trading Days"
                      value={plan.isFree ? "Unlimited (demo)" : `${fmt(days)} days`}
                      accent="text-emerald-500"
                    />
                    <Row label="Credits per Profitable Day" value={plan.isFree ? "0" : CREDITS_PER_PROFITABLE_DAY} />
                    <Row
                      label="Cost per Profitable Day"
                      value={plan.isFree ? "$0" : money(plan.price / days)}
                    />
                  </div>

                  <div className="mt-5">
                    <SectionLabel>Credit Usage</SectionLabel>
                    <div className="divide-y divide-border/60">
                      <Row label="Profitable Day" value={plan.isFree ? "0 credits" : `${CREDITS_PER_PROFITABLE_DAY} credits`} />
                      <Row label="Losing Day" value="0 credits" />
                      <Row label="Break-even Day" value="0 credits" />
                      <Row label="No-trade Day" value="0 credits" />
                    </div>
                  </div>

                  <div className="mt-5">
                    <SectionLabel>Account Access</SectionLabel>
                    <div className="divide-y divide-border/60">
                      <Row
                        label="Demo Account"
                        value="Yes"
                        accent="text-emerald-500"
                      />
                      <Row
                        label="Live Account"
                        value={plan.isFree ? "No" : "Yes"}
                        accent={plan.isFree ? "text-rose-500" : "text-emerald-500"}
                      />
                      <Row label="Credit Expiry" value={plan.isFree ? "None (free forever)" : "Never expires"} />
                      <Row label="Billing" value={plan.isFree ? "Free" : "One-time purchase"} />
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <span className="text-sm font-bold text-foreground">Fee</span>
                    <span className={`${montserrat.className} text-5xl font-extrabold text-violet-700 dark:text-violet-500`}>
                      {plan.isFree ? "$0" : `$${fmt(plan.price)}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => handleGetStarted(plan)}
              className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 text-base font-bold text-white shadow-lg shadow-violet-600/30 transition-all duration-300 hover:from-violet-500 hover:to-purple-500 active:scale-[0.99]"
            >
              {plan.isFree ? "Start Free Demo" : `Get Started with ${plan.name}`}
              <Zap size={16} />
            </button>

            <p className="mt-3 text-sm text-muted-foreground">
              Profitable trading days are estimates (credits ÷ {CREDITS_PER_PROFITABLE_DAY}), not guaranteed calendar
              durations or guaranteed profits. Trading carries risk of loss.
            </p>
          </div>

          {/* RIGHT: description */}
          <aside className="lg:col-span-4 flex flex-col gap-4">
            <div
              key={plan.id}
              className="animate-in fade-in rounded-3xl border border-violet-500/20 bg-card p-6 shadow-xl shadow-violet-600/5 duration-300"
            >
              <h2 className={`${montserrat.className} text-2xl font-extrabold tracking-tight text-foreground`}>
                {plan.name}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>

              <p className="mb-3 mt-6 text-sm font-bold text-foreground">Key Benefits:</p>
              <ul className="space-y-2.5">
                {plan.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 stroke-[2.5] text-violet-600 dark:text-violet-400" />
                    <span className="text-sm leading-snug text-muted-foreground">{b}</span>
                  </li>
                ))}
              </ul>

              {/* Premium Rotating Image Badge */}
              <div className="mt-6 flex items-center gap-3.5 rounded-full border border-violet-500/30 bg-gradient-to-r from-violet-500/15 via-card to-transparent px-4 py-2.5 shadow-[0_4px_20px_rgba(139,92,246,0.15)]">

                {/* Circular Image + Larger Rotating Text */}
                <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center">

                  {/* Rotating circular text (larger radius & path) */}
                  <svg
                    viewBox="0 0 120 120"
                    className="absolute inset-0 h-full w-full animate-[spin_12s_linear_infinite]"
                  >
                    <defs>
                      <path
                        id="badgeCircularPath"
                        d="M 60,60 m -48,0 a 48,48 0 1,1 96,0 a 48,48 0 1,1 -96,0"
                      />
                    </defs>

                    <text
                      fill="currentColor"
                      fontSize="15"
                      fontWeight="900"
                      letterSpacing="2.5"
                      className="text-violet-400"
                    >
                      <textPath href="#badgeCircularPath">
                        CHOICE • TRADER • CHOICE • TRADER
                      </textPath>
                    </text>
                  </svg>

                  {/* Profile image */}
                  <div className="relative h-[50px] w-[50px] overflow-hidden rounded-full border border-violet-500/50 bg-card shadow-[0_0_12px_rgba(139,92,246,0.35)]">
                    <img
                      src="/pfp.jpg"
                      alt="Trader profile"
                      className="h-full w-full rounded-full object-cover"
                    />
                  </div>
                </div>

                {/* Badge Text */}
                <div className="min-w-0 flex-1 pr-2">
                  <span className="block text-xs font-extrabold uppercase tracking-wider text-muted-foreground sm:text-[10]">
                    {plan.isFree
                      ? "Demo Accounts Only"
                      : plan.popular
                        ? "Trader's Top Choice"
                        : "Prepaid Credits"}
                  </span>

                  <span className={`${montserrat.className} block truncate text-lg font-extrabold text-violet-600 dark:text-violet-300`}>
                    {plan.isFree
                      ? "Free Forever"
                      : plan.popular
                        ? `${plan.name} Package`
                        : `${fmt(days)} Profitable Days`}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-border bg-muted/50 p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {plan.isFree
                    ? "The Free plan runs on a demo MT5 account only, so you can test the bot's execution with zero risk for as long as you like."
                    : "Credits are deducted only after a profitable trading day is confirmed. Losing, break-even and no-trade days never use credits."}
                </p>
              </div>
            </div>


             {/*payment methods */}
          <div className="lg:col-span-4 lg:col-start-9">
            <div className="rounded-3xl border border-violet-500/20 bg-card p-5 shadow-xl shadow-violet-600/5">
              <h3
                className={`${montserrat.className} text-lg font-extrabold tracking-tight text-foreground`}
              >
                Payment Methods
              </h3>
              <p className="mt-0 text-sm leading-relaxed text-muted-foreground">
                We accept crypto, bank transfer, bank cards and more.
              </p>

              <div className="mt-5 grid grid-cols-3 gap-2.5">
                {PAYMENT_METHODS.map((m) => (
                  <div
                    key={m.name}
                    className="flex flex-col cursor-not-allowed items-center gap-2 rounded-xl border border-border bg-muted/40 px-1 py-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.src}
                      alt={m.name}
                      loading="lazy"
                      className="h-6 w-auto"
                    />
                    <span className="text-center text-[10px] font-semibold leading-tight text-muted-foreground">
                      {m.name}
                    </span>
                  </div>
                ))}

                {/* Bank transfer */}
                <div className="flex cursor-not-allowed flex-col items-center gap-2 rounded-xl border border-border bg-muted/40 px-1 py-3">
                  <Landmark className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  <span className="text-center text-[10px] font-semibold leading-tight text-muted-foreground">
                    Bank Transfer
                  </span>
                </div>
              </div>
            </div>
          </div>
          </aside>

         
        </div>
      </section>

      {/* Available in every plan */}
      <section className="mx-auto mt-10 w-full max-w-[1500px] px-4 lg:px-10">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
          [ // Available in every plan ]
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {everyPlan.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-2xl border border-violet-500/20 bg-card px-5 py-4 transition-colors hover:border-violet-500/50"
            >
              <Icon className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-base font-bold text-foreground">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>




      {/* Comparison Section (Automated vs Manual) */}
      <section className="mx-auto mt-20 w-full max-w-[1500px] px-4 lg:px-10">
        <div className="mx-auto max-w-3xl pb-5 text-center">
          <h2 className={`${montserrat.className} mb-2 text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl`}>
            Automated vs Manual
          </h2>
          <p className="mx-auto text-sm font-normal leading-relaxed text-muted-foreground md:text-base">
            Choose a plan and let our advanced trading systems work for you. Earnings topped up automatically every 24
            hours.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-violet-500/20 bg-card shadow-xl shadow-violet-600/5">
          <div className="hidden grid-cols-3 border-b border-border bg-muted p-5 text-sm font-bold uppercase tracking-wider md:grid">
            <div className="text-foreground">Metric</div>
            <div className="text-rose-500">Manual Trading</div>
            <div className="text-emerald-500">Automated Trading</div>
          </div>

          <div className="divide-y divide-border">
            {comparisonData.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-1 items-center gap-3 p-5 transition-colors hover:bg-violet-500/5 md:grid-cols-3 md:gap-4"
              >
                <div className="text-base font-semibold text-foreground">{row.metric}</div>

                <div className="flex items-start gap-2.5 md:pr-4">
                  <span className="mb-1 block text-xs font-semibold text-rose-500 md:hidden">Manual:</span>
                  <div className="flex items-start gap-2">
                    <X className="mt-0.5 h-4 w-4 shrink-0 stroke-[2.5] text-rose-500" />
                    <span className="text-sm font-normal leading-relaxed text-muted-foreground md:text-base">{row.manual}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="mb-1 block text-xs font-semibold text-emerald-500 md:hidden">Automated:</span>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 stroke-[2.5] text-emerald-500" />
                    <span className="text-sm font-medium leading-relaxed text-foreground md:text-base">{row.automated}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}