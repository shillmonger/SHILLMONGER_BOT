"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Montserrat } from "next/font/google";
import { ArrowRight } from "lucide-react";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

/* ───────────────────────── Content ───────────────────────── */
const ITEMS = [
  {
    highlight: "100%",
    title: "XAUUSD Focused",
    desc: "Built only for gold, so the strategy specialises in one market's volatility and liquidity.",
    label: "Gold specialist",
    img: "/PFP_IMG/pfp1.jpg",
  },
  {
    highlight: "Demo",
    title: "First, Always",
    desc: "Test the bot on a Capital.com demo account before a single real dollar is at risk.",
    label: "Tests before trading",
    img: "/PFP_IMG/pfp2.jpg",
  },
  {
    highlight: "Your Funds",
    title: "Stay Yours",
    desc: "Money stays in your own Capital.com account. We never hold or touch your capital.",
    label: "Full custody",
    img: "/PFP_IMG/pfp3.jpg",
  },
  {
    highlight: "Built-in",
    title: "Risk Management",
    desc: "Every trade is sized to your balance with predefined stop-loss levels to protect capital.",
    label: "Trades with discipline",
    img: "/PFP_IMG/pfp4.jpg",
  },
  {
    highlight: "Trailing",
    title: "Stop Automation",
    desc: "The bot follows price and adjusts stops automatically to lock in profit as a trade moves.",
    label: "Locks in gains",
    img: "/PFP_IMG/pfp5.jpg",
  },
  {
    highlight: "Zero",
    title: "Forced Trades",
    desc: "No trade is placed just to be active. The bot waits for valid market conditions.",
    label: "Patient execution",
    img: "/PFP_IMG/pfp6.jpg",
  },
  {
    highlight: "Flexible",
    title: "Subscription Plans",
    desc: "Pick a plan that matches your account size, from 5 days up to a full month.",
    label: "Plans for every size",
    img: "/PFP_IMG/pfp7.jpg",
  },
  {
    highlight: "Withdraw",
    title: "Anytime",
    desc: "Your profits sit in your broker account. Withdraw whenever you like, then renew or upgrade.",
    label: "Keeps what it earns",
    img: "/PFP_IMG/pfp8.jpg",
  },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/* Path length at which the (y-monotonic) path first reaches `y` */
const lengthAtY = (path: SVGPathElement, y: number, total: number) => {
  let lo = 0;
  let hi = total;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (path.getPointAtLength(mid).y < y) lo = mid;
    else hi = mid;
  }
  return hi;
};

type Geo = { h: number; ys: number[]; scr: number[]; lens: number[]; half: number };

/* Scroll position (px inside the timeline) → length along the path.
   Between two hooks the scroll is split: short drop down, long straight run across, short drop down. */
const mapLength = (y: number, geo: Geo) => {
  const { scr, lens, half } = geo;
  const n = scr.length;
  if (n < 2 || y <= 0) return 0;
  if (y >= scr[n - 1]) return lens[n - 1];

  let j = 0;
  while (j < n - 2 && y >= scr[j + 1]) j++;

  const u = (y - scr[j]) / (scr[j + 1] - scr[j]);
  const dl = lens[j + 1] - lens[j];

  if (j === 0) return lens[0] + dl * u; // lead-in: straight down to the first hook

  const a = Math.min(0.4, half / dl); // share of the length that is the vertical drop
  let f: number;
  if (u < 0.2) f = a * (u / 0.2);
  else if (u < 0.8) f = a + (1 - 2 * a) * ((u - 0.2) / 0.6);
  else f = 1 - a + a * ((u - 0.8) / 0.2);
  return lens[j] + dl * f;
};

export default function WhyShillmonger() {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressPathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const dotGlowRef = useRef<SVGCircleElement>(null);

  const geoRef = useRef<Geo>({ h: 0, ys: [], scr: [], lens: [], half: 0 });
  const currentYRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const activeCountRef = useRef(0);

  const [w, setW] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [ctaActive, setCtaActive] = useState(false);

  const mobile = w > 0 && w < 768;

  /* ── All geometry comes from one place so the line, hooks and cards always line up ── */
  const g = useMemo(() => {
    const rowH = mobile ? 176 : 210; // height of one row
    const av = mobile ? 64 : 112; // hook (avatar) size
    const inset = mobile ? 6 : 16; // hooks sit at the very left / right edge of the screen
    const xL = av / 2 + inset;
    const xR = w - av / 2 - inset;
    const cx = w / 2;
    const cr = mobile ? 20 : 28; // corner radius of the line
    const gapC = mobile ? 10 : 24; // gap between hook and its card
    const tail = mobile ? 110 : 140; // line continues below the last hook toward the CTA
    const h = ITEMS.length * rowH + tail;
    const ys = ITEMS.map((_, i) => i * rowH + rowH / 2); // hook centers

    // Pattern: LEFT end → RIGHT end → MIDDLE of the screen → LEFT end → RIGHT end → MIDDLE ...
    const pos = ITEMS.map((_, i) => (["left", "right", "middle"] as const)[i % 3]);
    const xs = pos.map((p) => (p === "left" ? xL : p === "right" ? xR : cx));

    const cardWEnd = mobile
      ? Math.max(140, w - av - inset * 2 - gapC)
      : Math.min(400, Math.max(260, w - av - inset * 2 - gapC - 40));
    const cardWMid = Math.max(120, Math.min(cardWEnd, cx - av / 2 - gapC - inset));
    const cardW = pos.map((p) => (p === "middle" ? cardWMid : cardWEnd));
    const cardLeft = pos.map((p, i) => {
      if (p === "left") return xL + av / 2 + gapC; // card to the right of the hook
      if (p === "right") return xR - av / 2 - gapC - cardWEnd; // card to the left of the hook
      // middle hook: card sits beside it, alternating sides each cycle
      return Math.floor(i / 3) % 2 === 0 ? cx + av / 2 + gapC : cx - av / 2 - gapC - cardWMid;
    });

    return { rowH, av, inset, xL, xR, cr, gapC, cardW, cardLeft, tail, cx, h, ys, xs };
  }, [w, mobile]);

  /* ── Measure container width only ── */
  useLayoutEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const update = () => setW(c.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  /* ── Zig-zag path: down from the left hook, straight across to the right hook,
        down a bit, straight back to the left hook, and so on until the end ── */
  const pathD = useMemo(() => {
    if (!w) return "";
    const r = g.cr;
    let d = `M ${g.xs[0]} 0`;
    ITEMS.forEach((_, k) => {
      const x = g.xs[k];
      const yr = (k + 1) * g.rowH; // y of the horizontal run after hook k
      const tx = k < ITEMS.length - 1 ? g.xs[k + 1] : g.cx; // next hook column (last run ends at center)
      if (Math.abs(tx - x) < 1) {
        d += ` L ${x} ${yr + r}`; // same column, just keep going down
        return;
      }
      const dir = tx > x ? 1 : -1;
      d += ` L ${x} ${yr - r} Q ${x} ${yr} ${x + dir * r} ${yr} L ${tx - dir * r} ${yr} Q ${tx} ${yr} ${tx} ${yr + r}`;
    });
    d += ` L ${g.cx} ${g.h}`;
    return d;
  }, [w, g]);

  /* ── Measure where each hook sits along the path ── */
  useLayoutEffect(() => {
    const path = progressPathRef.current;
    if (!path || !pathD) return;
    const total = path.getTotalLength();
    const lens = g.ys.map((y) => lengthAtY(path, y, total));
    geoRef.current = {
      h: g.h,
      ys: g.ys,
      scr: [0, ...g.ys, g.h],
      lens: [0, ...lens, total],
      half: g.rowH / 2,
    };
  }, [g, pathD]);

  /* ── Scroll tracking with eased follow ── */
  const tick = useCallback(() => {
    const c = containerRef.current;
    const path = progressPathRef.current;
    const L = geoRef.current;
    if (!c || !path || !L.h) {
      rafRef.current = null;
      return;
    }

    const rect = c.getBoundingClientRect();
    const target = clamp(window.innerHeight * 0.55 - rect.top, 0, L.h);

    const diff = target - currentYRef.current;
    currentYRef.current += Math.abs(diff) < 0.4 ? diff : diff * 0.14;
    const lineY = currentYRef.current;

    const total = path.getTotalLength();
    const len = clamp(mapLength(lineY, L), 0, total);
    path.style.strokeDasharray = `${total}`;
    path.style.strokeDashoffset = `${total - len}`;

    const p = path.getPointAtLength(len);
    [dotRef.current, dotGlowRef.current].forEach((el) => {
      if (el) {
        el.setAttribute("cx", String(p.x));
        el.setAttribute("cy", String(p.y));
        el.style.opacity = lineY <= 1 ? "0" : "1";
      }
    });

    // activate a hook (and its card) once the line reaches it
    const count = L.ys.filter((y) => y <= lineY + 20).length;
    if (count !== activeCountRef.current) {
      activeCountRef.current = count;
      setActiveCount(count);
    }
    setCtaActive(lineY >= L.h - 4);

    if (Math.abs(target - currentYRef.current) > 0.4) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
    }
  }, []);

  const requestTick = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    requestTick();
    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", requestTick);
    return () => {
      window.removeEventListener("scroll", requestTick);
      window.removeEventListener("resize", requestTick);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [requestTick, pathD]);

  return (
    <section id="why-shillmonger" className="relative mx-auto max-w-[1500px] px-4 lg:px-8 overflow-hidden bg-background py-16 md:pb-10 md:pt-15">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[130px]" />
      <div className="pointer-events-none absolute right-0 bottom-1/4 h-[320px] w-[320px] rounded-full bg-purple-600/10 blur-[110px]" />

      <div className="relative z-10 mx-auto max-w-[1500px] px-4 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-left md:mb-5">
          <h2
            className={`${montserrat.className} mt-5 text-3xl font-black uppercase leading-tight tracking-tight text-foreground md:text-5xl xl:text-4xl`}
          >
            Everything stacked
            <span className="block bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">
              in your favor
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            Smart automation, transparent rules and full control of your funds, working for you before your first live trade.
          </p>
        </div>

      </div>

      {/* Zig-zag timeline (full screen width) */}
      <div
        ref={containerRef}
        className="relative z-10 w-full mx-auto max-w-[1300px] px-4 lg:px-8"
          style={{ height: g.h || undefined, opacity: w ? 1 : 0 }}
        >
          {/* SVG line */}
          {w > 0 && (
            <svg
              className="pointer-events-none absolute left-0 top-0 z-0"
              width={w}
              height={g.h}
              viewBox={`0 0 ${w} ${g.h}`}
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="snakeGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={g.h}>
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#9333ea" />
                </linearGradient>
              </defs>

              {/* Track */}
              <path
                d={pathD}
                stroke="currentColor"
                strokeWidth="2"
                className="text-violet-500/20"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Progress */}
              <path
                ref={progressPathRef}
                d={pathD}
                stroke="url(#snakeGrad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 0 6px rgba(139,92,246,0.8))" }}
              />

              {/* Leading dot */}
              <circle ref={dotGlowRef} r="12" fill="#8b5cf6" opacity="0" style={{ opacity: 0 }} />
              <circle ref={dotRef} r="5" fill="#ffffff" stroke="#8b5cf6" strokeWidth="2" style={{ opacity: 0 }} />
            </svg>
          )}

          {/* Rows */}
          {ITEMS.map((item, i) => {
            const active = i < activeCount;
            const avatarLeft = g.xs[i] - g.av / 2;
            const cardLeft = g.cardLeft[i];

            return (
              <div
                key={item.title}
                className="absolute left-0 z-10 w-full"
                style={{ top: i * g.rowH, height: g.rowH }}
              >
                {/* Card (beside its hook, toward the center) */}
                <div
                  className="absolute transition-all duration-700 ease-out"
                  style={{
                    left: cardLeft,
                    top: g.rowH / 2,
                    width: g.cardW[i],
                    opacity: active ? 1 : 0.25,
                    transform: `translateY(${active ? "-50%" : "calc(-50% + 24px)"})`,
                    transitionDelay: active ? "120ms" : "0ms",
                  }}
                >
                  <div
                    className={`rounded-xl border bg-card p-3 transition-all duration-700 md:rounded-2xl md:p-5 ${
                      active
                        ? "border-violet-500/40 shadow-xl shadow-violet-600/15"
                        : "border-border shadow-none"
                    }`}
                  >
                    <h3
                      className={`${montserrat.className} text-[13px] font-extrabold leading-tight text-foreground md:text-lg`}
                    >
                      <span className="text-violet-600 dark:text-violet-400">{item.highlight}</span> {item.title}
                    </h3>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground md:mt-1.5 md:text-sm md:leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>

                {/* Hook / avatar (the line runs through it) */}
                <div
                  className="absolute transition-all duration-700 ease-out"
                  style={{
                    left: avatarLeft,
                    top: g.rowH / 2 - g.av / 2,
                    width: g.av,
                    height: g.av,
                    opacity: active ? 1 : 0.3,
                    transform: `scale(${active ? 1 : 0.85})`,
                  }}
                >
                  <div
                    className={`relative h-full w-full overflow-hidden rounded-full border-2 bg-card transition-all duration-700 ${
                      active
                        ? "border-violet-400 shadow-[0_0_0_4px_rgba(139,92,246,0.18),0_0_24px_rgba(139,92,246,0.45)]"
                        : "border-border grayscale"
                    }`}
                  >
                    <Image
                      src={item.img}
                      alt={item.label}
                      width={g.av * 2}
                      height={g.av * 2}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span
                    className={`${montserrat.className} absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-2 py-0.5 text-[7px] font-bold uppercase tracking-wider text-white shadow-md shadow-violet-600/30 md:px-2.5 md:text-[9px]`}
                  >
                    {item.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      <div className="relative z-10 w-full">
        {/* End CTA */}
        <div
          className={`relative z-10 -mt-6 text-center transition-all duration-700 ease-out md:-mt-8 ${
            ctaActive ? "translate-y-0 opacity-100" : "translate-y-8 opacity-20"
          }`}
        >
          <h2
            className={`${montserrat.className} mt-3 text-2xl font-black uppercase leading-tight tracking-tight text-foreground md:text-2xl`}
          >
            The line ends where <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">your edge begins</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Connect your account in minutes and let every advantage above start working for you from day one.
          </p>
        </div>
      </div>
    </section>
  );
}