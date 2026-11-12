"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Montserrat } from "next/font/google";
import { ArrowRight, ChevronLeft, ChevronRight, CircleDollarSign, FlaskConical, ShieldCheck } from "lucide-react";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

/* ─────────────────────────────────────────────────────────────
   ⚠️  REPLACE THESE WITH YOUR REAL BACKTEST RESULTS
   The numbers below are PLACEHOLDERS so the layout can be previewed.
   Only publish figures that come from your actual backtests / tracked results.

   • chart  → optional path to a screenshot of the real equity curve
              (e.g. "/backtests/aurum-scalp.png"). If omitted, a generic
              illustrative curve is drawn instead.
───────────────────────────────────────────────────────────── */
type Backtest = {
  name: string;
  market: string;
  strategy: string;
  timeframe: string;
  period: string;
  winRate: number; // %
  drawdown: number; // %
  gain: number; // %
  chart?: string;
};

const CHARTS = [
  "/BACKTEST/aurion.png",
  "/BACKTEST/cyptara.png",
  "/BACKTEST/falcon.png",
  "/BACKTEST/indiora.png",
  "/BACKTEST/razor.png",
  "/BACKTEST/vectron.png",
  "/BACKTEST/velorav1.png",
];

const BACKTESTS: Backtest[] = [
  { name: "Aurum Scalp", market: "XAUUSD", strategy: "Scalp", timeframe: "M5", period: "Jan – Jun 2025", winRate: 71, drawdown: 4.8, gain: 38.4, chart: CHARTS[0] },
  { name: "Aurum Trend", market: "XAUUSD", strategy: "Trend Follow", timeframe: "H1", period: "Jan – Jun 2025", winRate: 58, drawdown: 6.2, gain: 44.9, chart: CHARTS[1] },
  { name: "Gold Breakout", market: "XAUUSD", strategy: "Breakout", timeframe: "M15", period: "Jul – Dec 2024", winRate: 63, drawdown: 5.4, gain: 41.7, chart: CHARTS[2] },
  { name: "Trailing Edge", market: "XAUUSD", strategy: "Trailing Stop", timeframe: "M15", period: "Jul – Dec 2024", winRate: 66, drawdown: 4.1, gain: 36.2, chart: CHARTS[3] },
  { name: "Multi Level", market: "XAUUSD", strategy: "Multi Level", timeframe: "M30", period: "Jan – Jun 2025", winRate: 78, drawdown: 7.9, gain: 52.3, chart: CHARTS[4] },
  { name: "London Session", market: "XAUUSD", strategy: "Session Scalp", timeframe: "M5", period: "Jan – Dec 2024", winRate: 69, drawdown: 5.1, gain: 61.8, chart: CHARTS[5] },
  { name: "New York Open", market: "XAUUSD", strategy: "Momentum", timeframe: "M15", period: "Jan – Dec 2024", winRate: 61, drawdown: 6.8, gain: 49.5, chart: CHARTS[6] },
  { name: "Safe Harbor", market: "XAUUSD", strategy: "Low Risk", timeframe: "H1", period: "Jan – Dec 2024", winRate: 74, drawdown: 2.9, gain: 24.6, chart: CHARTS[0] },
  { name: "Volatility Rider", market: "XAUUSD", strategy: "Volatility", timeframe: "M15", period: "Jul – Dec 2024", winRate: 56, drawdown: 8.3, gain: 57.1, chart: CHARTS[1] },
  { name: "Steady Compounder", market: "XAUUSD", strategy: "Compounding", timeframe: "H4", period: "Jan – Dec 2024", winRate: 72, drawdown: 3.6, gain: 33.8, chart: CHARTS[2] },
];

const GAP = 24; // px between cards
const SPEED = 55; // px per second — continuous auto-scroll speed
const REPEATS = 3; // enough copies to fill the track for a seamless loop

/* Deterministic illustrative equity curve (used only when no chart image is supplied) */
function curvePoints(seed: number, up: number) {
  const pts: [number, number][] = [];
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const n = 36;
  let y = 100;
  for (let i = 0; i <= n; i++) {
    const trend = (up / n) * 0.9;
    y -= trend + (rand() - 0.42) * 4;
    pts.push([(i / n) * 300, Math.max(14, Math.min(108, y))]);
  }
  return pts;
}

function MiniChart({ idx, gain }: { idx: number; gain: number }) {
  const pts = useMemo(() => curvePoints(idx + 3, 70 + gain * 0.6), [idx, gain]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,120 ${line} 300,120`;
  const gid = `bt-grad-${idx}`;
  return (
    <svg viewBox="0 0 300 120" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[24, 48, 72, 96].map((y) => (
        <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="currentColor" strokeWidth="0.6" className="text-violet-500/15" />
      ))}
      {Array.from({ length: 22 }).map((_, i) => (
        <rect
          key={i}
          x={8 + i * 13.5}
          y={120 - (6 + ((i * 37 + idx * 11) % 22))}
          width="5"
          height={6 + ((i * 37 + idx * 11) % 22)}
          fill="#22C55E"
          opacity="0.35"
        />
      ))}
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BacktestCard({ item, idx, width }: { item: Backtest; idx: number; width: number }) {
  return (
    <article
      className="group shrink-0 rounded-3xl border border-violet-500/20 bg-card p-5 shadow-xl shadow-violet-600/5 transition-all duration-300 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-600/15"
      style={{ width }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between">
        <span
          className={`${montserrat.className} inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400`}
        >
          <CircleDollarSign size={14} />
          {item.market}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          <FlaskConical size={10} />
          Backtested
        </span>
      </div>

      <h3 className={`${montserrat.className} mt-3 text-xl font-extrabold tracking-tight text-foreground`}>
        {item.name}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {item.strategy} · {item.timeframe} · {item.period}
      </p>

      <div className="my-4 h-px bg-border" />

      {/* Chart */}
      <div className="relative h-[150px] w-full overflow-hidden rounded-xl border border-violet-500/15 bg-gradient-to-b from-violet-500/[0.04] to-transparent">
        {item.chart ? (
          <Image src={item.chart} alt={`${item.name} equity curve`} fill className="object-cover" />
        ) : (
          <MiniChart idx={idx} gain={item.gain} />
        )}
        <span className="absolute left-2.5 top-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Equity curve
        </span>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-muted/40 px-2.5 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Win rate</p>
          <p className="mt-1 text-base font-extrabold text-emerald-500">{item.winRate}%</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 px-2.5 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Drawdown</p>
          <p className="mt-1 text-base font-extrabold text-red-500">{item.drawdown}%</p>
        </div>
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-2.5 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">Total gain</p>
          <p className="mt-1 text-base font-extrabold text-violet-700 dark:text-violet-300">+{item.gain}%</p>
        </div>
      </div>

      {/* CTA */}
      <Link
        href="/auth-page/register"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-bold text-white shadow-md shadow-violet-600/30 transition-all hover:from-violet-500 hover:to-purple-500 active:scale-[0.98]"
      >
        Run {item.strategy} Strategy
      </Link>
    </article>
  );
}

export default function BacktestResults() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(0);
  const [paused, setPaused] = useState(false);

  const N = BACKTESTS.length;
  const slides = useMemo(() => Array.from({ length: REPEATS }, () => BACKTESTS).flat(), []);

  const posRef = useRef(0);
  const pausedRef = useRef(false);
  const setWidthRef = useRef(0);
  const manualRef = useRef<{ from: number; to: number; start: number; dur: number } | null>(null);

  /* Responsive card width (shows a peek of the next card, like the reference) */
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setVw(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visible = vw < 640 ? 1.12 : vw < 1024 ? 2.15 : vw < 1280 ? 3.15 : vw < 1600 ? 4.15 : 5;
  const cardW = vw ? (vw - GAP * (Math.ceil(visible) - 1)) / visible : 320;
  const step = cardW + GAP;
  const setWidth = N * step;

  useEffect(() => {
    setWidthRef.current = setWidth;
    pausedRef.current = paused;
  }, [setWidth, paused]);

  /* Continuous rAF-driven scroll — no React re-render per frame */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(64, t - last);
      last = t;
      const sw = setWidthRef.current;
      if (sw > 0 && trackRef.current) {
        if (manualRef.current) {
          const m = manualRef.current;
          const k = Math.min(1, (t - m.start) / m.dur);
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          posRef.current = m.from + (m.to - m.from) * e;
          if (k >= 1) {
            posRef.current = ((posRef.current % sw) + sw) % sw;
            manualRef.current = null;
          }
        } else if (!pausedRef.current) {
          posRef.current = (posRef.current + (SPEED * dt) / 1000) % sw;
        }
        trackRef.current.style.transform = `translate3d(${-posRef.current}px,0,0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const glideTo = useCallback((target: number) => {
    manualRef.current = { from: posRef.current, to: target, start: performance.now(), dur: 650 };
  }, []);

  const next = useCallback(() => glideTo(posRef.current + step), [glideTo, step]);

  const prev = useCallback(() => {
    const p = posRef.current;
    const sw = setWidthRef.current;
    glideTo(p - step + (p < step && sw > 0 ? sw : 0));
  }, [glideTo, step]);

  return (
    <section id="backtests" className="relative mx-auto max-w-full overflow-hidden bg-background py-16 md:py-0">

      <div className="relative z-10 mx-auto max-w-full px-4 lg:px-10">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-6 md:mb-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h2
              className={`${montserrat.className} text-3xl font-black leading-[1.1] uppercase tracking-tight text-foreground md:text-4xl`}
            >
              Backtested. Transparent.{" "}
              <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">
                Easy to compare.
              </span>
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
              Review win rate, drawdown and total gain to decide which strategy best matches your account size and risk preferences.
            </p>
          </div>
        </div>

        {/* Slider */}
        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div
            ref={viewportRef}
            className="overflow-hidden py-6"
            style={{
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)",
              maskImage: "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)",
            }}
          >
            <div
              ref={trackRef}
              className="flex will-change-transform"
              style={{ gap: GAP, transform: "translate3d(0,0,0)" }}
            >
              {slides.map((item, i) => (
                <BacktestCard key={`${item.name}-${i}`} item={item} idx={i % N} width={cardW} />
              ))}
            </div>
          </div>

          {/* Arrows */}
          <button
            onClick={prev}
            aria-label="Previous strategy"
            className="absolute left-0 top-1/2 z-20 flex h-12 w-12 -translate-x-1/3 -translate-y-1/2 items-center justify-center rounded-full border border-violet-500/30 bg-card text-violet-600 shadow-xl shadow-violet-600/20 transition-all hover:scale-105 hover:bg-gradient-to-br hover:from-violet-600 hover:to-purple-600 hover:text-white dark:text-violet-400"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            aria-label="Next strategy"
            className="absolute right-0 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 translate-x-1/3 items-center justify-center rounded-full border border-violet-500/30 bg-card text-violet-600 shadow-xl shadow-violet-600/20 transition-all hover:scale-105 hover:bg-gradient-to-br hover:from-violet-600 hover:to-purple-600 hover:text-white dark:text-violet-400"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Footer link + disclaimer */}
        <div className="mt-2 text-center">
          <Link
            href="#"
            className={`${montserrat.className} group inline-flex items-center gap-2 border-b-2 border-violet-500 pb-1 text-sm font-bold text-foreground transition-colors hover:text-violet-600 dark:hover:text-violet-400`}
          >
            View all backtest results
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <p className="mt-3 text-sm italic text-muted-foreground">
            Backtested results do not guarantee future performance. Trading carries risk of loss.
          </p>
        </div>
      </div>
    </section>
  );
}