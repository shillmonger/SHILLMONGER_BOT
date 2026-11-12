"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { X, Copy, Check, Gift, ArrowRight, BadgeCheck } from "lucide-react";
import { IBM_Plex_Mono, Montserrat } from "next/font/google";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

// ⚠️ Keep in sync with your PromoBanner code
const PROMO_CODE = "SHILL27";
const STORAGE_KEY = "discountPopup27";
const DEADLINE_KEY = `${STORAGE_KEY}_deadline`;
const SHOW_DELAY_MS = 3000; // wait before popping up
const RESHOW_AFTER_MS = 5 * 60 * 1000; // if closed with X, come back after 5 min

const PERKS = [
  "Applies to every bot subscription plan",
  "Works on any account size",
  "Enter the code at checkout",
];

/* ───────── Countdown (rolling digits) ───────── */

function RollingDigit({ digit }: { digit: string }) {
  return (
    <span className="relative inline-block h-[1.15em] w-[0.62em] overflow-hidden align-baseline">
      <AnimatePresence initial={false}>
        <motion.span
          key={digit}
          initial={{ y: "-110%" }}
          animate={{ y: "0%" }}
          exit={{ y: "110%" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function CountdownBox({ label, value }: { label: string; value: number }) {
  const digits = String(Math.max(0, value)).padStart(2, "0").split("");

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`${plexMono.className} flex w-full items-center justify-center rounded-lg border border-border bg-muted/50 py-2.5 text-xl font-medium text-foreground`}
      >
        {digits.map((d, i) => (
          <RollingDigit key={i} digit={d} />
        ))}
      </div>
      <span className="text-[10px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export default function DiscountPopup() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const reshowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Offer window: 12 months from first view, persisted so it stays consistent
  useEffect(() => {
    const id = setTimeout(() => {
      const fallback = new Date();
      fallback.setFullYear(fallback.getFullYear() + 1);
      let d = fallback.getTime();
      try {
        const stored = Number(localStorage.getItem(DEADLINE_KEY));
        if (stored > Date.now()) d = stored;
        else localStorage.setItem(DEADLINE_KEY, String(d));
      } catch {}
      setDeadline(d);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Tick once per second while the popup is open
  useEffect(() => {
    if (!open || deadline === null) return;
    const tick = () => {
      const diff = Math.max(0, deadline - Date.now());
      setTimeLeft({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor(diff / 3_600_000) % 24,
        minutes: Math.floor(diff / 60_000) % 60,
        seconds: Math.floor(diff / 1_000) % 60,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, deadline]);

  // Decide whether to show (once, after a short delay)
  useEffect(() => {
    setMounted(true);

    let status: string | null = null;
    try {
      status = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    if (status) return; // already claimed or declined

    const t = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Clear any pending re-show timer on unmount
  useEffect(() => {
    return () => {
      if (reshowTimer.current) clearTimeout(reshowTimer.current);
    };
  }, []);

  // Lock page scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // X / Escape: hide for now, show again later
  const handleClose = useCallback(() => {
    setOpen(false);
    if (reshowTimer.current) clearTimeout(reshowTimer.current);
    reshowTimer.current = setTimeout(() => setOpen(true), RESHOW_AFTER_MS);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const handleClaim = () => {
    if (reshowTimer.current) clearTimeout(reshowTimer.current);
    try {
      localStorage.setItem(STORAGE_KEY, "claimed");
      navigator.clipboard?.writeText(PROMO_CODE);
    } catch {}
    setOpen(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(PROMO_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <AnimatePresence>
      {mounted && open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[600] bg-black/50 backdrop-blur-sm"
          />

          {/* Positioner: bottom sheet on mobile, centered card on desktop */}
          <div
            className="pointer-events-none fixed inset-0 z-[601] flex items-end justify-center sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="27% off discount offer"
          >
            <motion.div
              key="card"
              initial={{ y: 60, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="pointer-events-auto relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-card shadow-2xl shadow-black/50 ring-1 ring-border sm:max-w-[430px] sm:rounded-3xl md:max-w-[880px]"
            >
              {/* Mobile drag handle (visual only) */}
              <div className="absolute left-1/2 top-2 z-30 h-1 w-10 -translate-x-1/2 rounded-full bg-white/40 md:hidden" />

              {/* Close */}
              <button
                onClick={handleClose}
                aria-label="Dismiss"
                className="absolute right-3 top-3 z-30 cursor-pointer rounded-full border border-white/20 bg-black/20 p-2 text-white backdrop-blur transition hover:bg-black/40 md:right-4 md:top-4 md:border-border md:bg-muted md:text-muted-foreground md:backdrop-blur-none md:hover:bg-accent md:hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Stacked on mobile, side-by-side from md up */}
              <div className="flex flex-col overflow-y-auto md:flex-row md:overflow-visible">
                {/* ───── Section 1: Offer (violet) ───── */}
                <section className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 px-6 pb-8 pt-9 text-white md:w-[45%] md:shrink-0 md:px-10 md:py-12">
                  {/* Subtle grid texture */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
                  />
                  {/* Glows */}
                  <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-fuchsia-400/30 blur-[70px] md:left-0 md:translate-x-0" />
                  <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-indigo-300/20 blur-[60px]" />

                  <div className="relative flex flex-col items-center text-center md:items-start md:text-left">
                    <div
                      className={`${plexMono.className} mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] backdrop-blur`}
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                      </span>
                      Limited-time offer
                    </div>

                    <div className="flex items-start">
                      <span
                        className={`${montserrat.className} bg-gradient-to-b from-white to-violet-200 bg-clip-text text-[88px] font-black leading-none tracking-tighter text-transparent md:text-[128px]`}
                      >
                        27
                      </span>
                      <div className="ml-1 mt-2 flex flex-col items-start md:mt-4">
                        <span
                          className={`${montserrat.className} text-4xl font-black leading-none md:text-6xl`}
                        >
                          %
                        </span>
                        <span
                          className={`${montserrat.className} mt-1 text-xl font-extrabold leading-none tracking-wide md:text-3xl`}
                        >
                          OFF
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 text-sm font-medium text-violet-100 md:text-base">
                      On every SHILLMONGER bot plan
                    </p>

                    {/* Perks: desktop only, keeps mobile sheet compact */}
                    <ul className="mt-8 hidden space-y-3 border-t border-white/15 pt-6 md:block">
                      {PERKS.map((perk) => (
                        <li
                          key={perk}
                          className="flex items-start gap-2.5 text-sm text-violet-50"
                        >
                          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                          {perk}
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                {/* ───── Section 2: Code + action ───── */}
                <section className="flex flex-col justify-center px-6 pb-7 pt-7 md:w-[55%] md:px-10 md:py-12">
                  <div className="flex items-center gap-3 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/20 dark:text-violet-400">
                      <Gift className="h-5 w-5" />
                    </div>
                    <h3
                      className={`${montserrat.className} text-lg font-extrabold leading-snug tracking-tight text-foreground md:text-xl`}
                    >
                      Your gold-trading discount is here
                    </h3>
                  </div>

                  <p className="mb-6 mt-3 text-left text-sm leading-relaxed text-muted-foreground">
                    Use the promo code below at checkout to save 27% on any
                    SHILLMONGER bot plan, no matter your account size.
                  </p>

                  {/* Promo code ticket */}
                  <button
                    onClick={copyCode}
                    aria-label={`Copy promo code ${PROMO_CODE}`}
                    className="group relative mb-6 flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-violet-500/50 bg-violet-500/5 px-4 py-3.5 text-left transition hover:border-violet-500 hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 active:scale-[0.99]"
                  >
                    <div>
                      <p
                        className={`${plexMono.className} text-[11px] text-muted-foreground`}
                      >
                        Promo code
                      </p>
                      <p
                        className={`${plexMono.className} text-xl font-medium tracking-[0.25em] text-violet-700 dark:text-violet-300`}
                      >
                        {PROMO_CODE}
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-1.5 text-xs font-bold text-white transition group-hover:bg-violet-700">
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </span>
                  </button>

                  {/* Countdown */}
                  {deadline !== null && (
                    <div className="mb-6">
                      <p
                        className={`${plexMono.className} mb-2.5 text-[11px] text-muted-foreground`}
                      >
                        Offer ends in
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        <CountdownBox label="Days" value={timeLeft.days} />
                        <CountdownBox label="Hours" value={timeLeft.hours} />
                        <CountdownBox label="Minutes" value={timeLeft.minutes} />
                        <CountdownBox label="Seconds" value={timeLeft.seconds} />
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <Link
                    href="/LandingPage/subscribtion"
                    onClick={handleClaim}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-violet-600/30 transition-all duration-300 hover:shadow-violet-600/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.98]"
                  >
                    Claim 27% off
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <p
                    className={`${plexMono.className} mt-4 text-center text-[11px] text-muted-foreground/70 md:text-left`}
                  >
                    Valid on all plans. Code applied at checkout.
                  </p>
                </section>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}