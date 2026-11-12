"use client";

import { Montserrat } from "next/font/google";
import { Check, Monitor, Globe, Smartphone } from "lucide-react";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

/* ─────────────────────────────────────────────
   Video paths — files live in /public.
   Change these two lines if your folder/file names differ
   (paths are case-sensitive on Linux / Vercel).
───────────────────────────────────────────── */
const MT4_VIDEO = "/VIDEOS/MTR.mp4";
const MT5_VIDEO = "/VIDEOS/TRADE.mp4";

const PLATFORMS = [
  {
    badge: "4",
    name: "MetaTrader 4",
    desc: "The legendary platform trusted by traders worldwide. Fast execution, reliable charting and Expert Advisors, supported by Capital.com and fully compatible with SHILLMONGER.",
    chips: ["Expert Advisors (EAs)", "9 Timeframes", "One-Click Trading"],
    available: [
      { icon: Monitor, label: "Desktop" },
      { icon: Globe, label: "Web" },
      { icon: Smartphone, label: "iOS & Android" },
    ],
    video: MT4_VIDEO,
  },
  {
    badge: "5",
    name: "MetaTrader 5",
    desc: "The next-generation platform with deeper analysis tools, more timeframes and advanced order management, built for serious automated trading on gold.",
    chips: ["Advanced Charting", "21 Timeframes", "All Order Types"],
    available: [
      { icon: Monitor, label: "Desktop" },
      { icon: Globe, label: "Web" },
      { icon: Smartphone, label: "iOS & Android" },
    ],
    video: MT5_VIDEO,
  },
];

export default function TradingPlatforms() {
  return (
    <section
      id="platforms"
      className="relative w-full overflow-hidden bg-background py-10 md:py-10"
    >


      <div className="relative z-10 mx-auto max-w-[1100px] px-4 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center md:mb-10">
          <h2
            className={`${montserrat.className} text-3xl font-black uppercase leading-tight tracking-tight text-foreground md:text-4xl`}
          >
            Available{" "}
            <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">
              Trading
            </span>{" "}
            Platforms
          </h2>
          <p className="mx-auto mt-0 max-w-xl text-base text-muted-foreground md:text-lg">
            Two professional-grade platforms, fully synced with your Capital.com account. Trade from anywhere, on any device.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 items-start cursor-pointer gap-6 md:grid-cols-2 lg:gap-8">
          {PLATFORMS.map((p) => (
            <article
              key={p.name}
              className="group relative rounded-[1.75rem] border border-violet-500/20 bg-card p-4 shadow-xl shadow-violet-600/5 transition-all duration-300 hover:-translate-y-1.5 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-600/20 md:p-5"
            >
              {/* Video frame */}
              <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950 via-purple-950 to-violet-900 shadow-lg shadow-violet-900/20">
                <div className="aspect-[16/10] w-full">
                  <video
                    className="h-full w-full object-cover"
                    src={p.video}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-label={`${p.name} platform preview`}
                  />
                </div>
                {/* soft inner highlight */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-violet-950/40 to-transparent" />
              </div>

              {/* Title row */}
              <div className="mt-6 flex items-center gap-4 px-1">
                <div
                  className={`${montserrat.className} flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-2xl font-black text-white shadow-lg shadow-violet-600/40`}
                >
                  {p.badge}
                </div>
                <div>
                  <p
                    className={`${montserrat.className} text-[10px] font-bold uppercase tracking-[0.25em] text-violet-600 dark:text-violet-400`}
                  >
                    Platform
                  </p>
                  <h3
                    className={`${montserrat.className} text-xl font-extrabold leading-tight text-foreground md:text-2xl`}
                  >
                    {p.name}
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="mt-4 px-1 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
                {p.desc}
              </p>

              {/* Feature chips */}
              <div className="mt-5 flex flex-wrap gap-2 px-1">
                {p.chips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300"
                  >
                    <Check size={12} className="text-violet-600 dark:text-violet-400" />
                    {chip}
                  </span>
                ))}
              </div>

              {/* Available on */}
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-1 pt-4">
                <span
                  className={`${montserrat.className} text-[10px] font-bold uppercase tracking-widest text-muted-foreground`}
                >
                  Available on
                </span>
                {p.available.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground"
                  >
                    <Icon size={14} className="text-violet-600 dark:text-violet-400" />
                    {label}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}