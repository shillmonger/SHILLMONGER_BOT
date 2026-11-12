"use client";
// components/landing-page/why-platform-section.tsx
import React from "react";
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});
import {
  UserPlus,
  CreditCard,
  KeyRound,
  TestTubeDiagonal,
  ArrowUpFromLine,
  RefreshCw,
  Landmark,
  Bot,
} from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const ICON_TONES = {
  violet: "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:from-violet-600 group-hover:to-violet-400",
  purple: "border-purple-500/25 bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:from-purple-600 group-hover:to-fuchsia-500",
  fuchsia: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 group-hover:from-fuchsia-600 group-hover:to-pink-500",
  indigo: "border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:from-indigo-600 group-hover:to-blue-500",
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:from-sky-600 group-hover:to-cyan-400",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:from-emerald-600 group-hover:to-teal-400",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:from-amber-500 group-hover:to-orange-500",
  rose: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:from-rose-600 group-hover:to-red-500",
} as const;

type Tone = keyof typeof ICON_TONES;

export default function WhyPlatformSection() {
  const steps = [
    {
      step: "01",
      title: "Create Account",
      desc: "Join SHILLMONGER in seconds. Our registration is fast, encrypted, and built to protect your identity from day one.",
      icon: <UserPlus className="w-[18px] h-[18px]" />,
      tone: "violet" as Tone,
    },
    {
      step: "02",
      title: "Connect & Test Demo",
      desc: "Connect a Capital.com demo account and test the bot first to make sure everything works before using real funds.",
      icon: <TestTubeDiagonal className="w-[18px] h-[18px]" />,
      tone: "sky" as Tone,
    },
    {
      step: "03",
      title: "Buy Bot Subscription",
      desc: "Purchase a bot subscription plan that suits your trading goals and account size.",
      icon: <CreditCard className="w-[18px] h-[18px]" />,
      tone: "emerald" as Tone,
    },
    {
      step: "04",
      title: "Fund Capital.com",
      desc: "Open a live Capital.com account and fund it. Your money stays in your own broker account at all times.",
      icon: <Landmark className="w-[18px] h-[18px]" />,
      tone: "amber" as Tone,
    },
    {
      step: "05",
      title: "Link via API",
      desc: "Securely link your Capital.com account to SHILLMONGER with your API credentials. Capital.com supports MT4 and MT5 too.",
      icon: <KeyRound className="w-[18px] h-[18px]" />,
      tone: "fuchsia" as Tone,
    },
    {
      step: "06",
      title: "Bot Trades for You",
      desc: "Our bot places XAUUSD trades on your account through the Capital.com REST API whenever valid market setups appear.",
      icon: <Bot className="w-[18px] h-[18px]" />,
      tone: "indigo" as Tone,
    },
    {
      step: "07",
      title: "Withdraw Profits",
      desc: "Withdraw your profits at the end of your subscription period to your preferred payment method.",
      icon: <ArrowUpFromLine className="w-[18px] h-[18px]" />,
      tone: "rose" as Tone,
    },
    {
      step: "08",
      title: "Renew or Upgrade",
      desc: "At the end of each subscription, buy a new one or upgrade to keep your automated trading running.",
      icon: <RefreshCw className="w-[18px] h-[18px]" />,
      tone: "purple" as Tone,
    },
  ];

  return (
    <section
      id="why-this-platform"
      className="mx-auto max-w-[1500px] px-4 lg:px-8 py-20 lg:py-0 w-full"
    >
      {/* Header */}
      <div className="mb-5">
        <h2 className={`${montserrat.className} text-3xl md:text-4xl font-black uppercase leading-tight tracking-tight text-foreground mb-2`}>
          How we{" "}
          <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">
            Work
          </span>
        </h2>

        <p className="text-muted-foreground max-w-xl text-base md:text-lg leading-relaxed">
          A streamlined 8-step journey — from sign-up to subscription renewal
          with institutional-grade efficiency.
        </p>
      </div>

      {/* Desktop / Tablet Grid — 4 cards per row on large screens (2 rows of 4) */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {steps.map((step, index) => (
          <StepCard key={index} step={step} />
        ))}
      </div>

      {/* Mobile Carousel */}
      <div className="md:hidden">
        <Carousel className="w-full">
          <CarouselContent>
            {steps.map((step, i) => (
              <CarouselItem key={i}>
                <StepCard step={step} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="mt-8 flex items-center justify-center gap-6">
            <CarouselPrevious className="static translate-y-0 w-11 h-11 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-600 dark:text-violet-400 rounded-xl" />
            <CarouselNext className="static translate-y-0 w-11 h-11 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-600 dark:text-violet-400 rounded-xl" />
          </div>
        </Carousel>
      </div>

      {/* Footer rule */}
      <div className="mt-5 flex items-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
        <span className="text-[11px] uppercase font-bold tracking-widest text-violet-600 dark:text-violet-400 whitespace-nowrap">
          Start your journey today
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
      </div>
    </section>
  );
}

// ─── Step Card Sub-component ──────────────────────────────────────────────────

type Step = {
  step: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
};

function StepCard({ step }: { step: Step }) {
  return (
    <div className="group relative cursor-pointer h-full rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-[0_8px_32px_-8px_rgba(124,58,237,0.35)] cursor-default overflow-hidden">
      {/* Top accent line — visible on hover */}
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-violet-500 to-purple-600 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      {/* Faint big step number */}
      <span className="pointer-events-none absolute -bottom-3 right-3 select-none text-7xl font-black leading-none text-violet-500/[0.07] dark:text-violet-400/[0.08]">
        {step.step}
      </span>

      {/* Step label + Icon */}
      <div className="relative flex items-start justify-between mb-0">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
          Step {step.step}
        </span>
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400 transition-colors duration-200 group-hover:bg-gradient-to-br group-hover:from-violet-600 group-hover:to-purple-600 group-hover:text-white group-hover:border-transparent">
          {step.icon}
        </div>
      </div>

      {/* Text */}
      <h3 className="relative font-bold text-[1rem] tracking-tight text-foreground mb-1">
        {step.title}
      </h3>
      <p className="relative text-sm md:text-base text-muted-foreground leading-relaxed">
        {step.desc}
      </p>
    </div>
  );
}