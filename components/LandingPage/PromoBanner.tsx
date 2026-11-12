"use client";

import React, { useState } from "react";
import { Gift, Percent, Copy, Check } from "lucide-react";
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

// ⚠️ Replace with your real promo code
const PROMO_CODE = "SHILL27";

export default function PromoBanner() {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(PROMO_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable, ignore */
    }
  };

  const item = (key: number) => (
    <div
      key={key}
      className="flex shrink-0 items-center gap-3 px-6 sm:gap-4 sm:px-10"
    >
      <Percent className="h-4 w-4 shrink-0" strokeWidth={2.5} />

      <span className="whitespace-nowrap">
        Promo Code Deal – Get 27% off every bot subscription!
      </span>

      <button
        type="button"
        onClick={copyCode}
        aria-label={`Copy promo code ${PROMO_CODE}`}
        className="inline-flex items-center cursor-pointer gap-1.5 whitespace-nowrap rounded-full border border-white/40 bg-white px-2.5 py-0.5 text-[11px] font-extrabold tracking-widest text-violet-700 transition hover:scale-105 active:scale-95 dark:bg-white/95"
      >
        {copied ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : (
          <Copy className="h-3 w-3" strokeWidth={2.5} />
        )}
        {copied ? "COPIED!" : `CODE: ${PROMO_CODE}`}
      </button>

      <Gift className="h-5 w-5 shrink-0" strokeWidth={2.2} />
    </div>
  );

  return (
    <>
      <style jsx global>{`
        @keyframes promo-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        .promo-track {
          animation: promo-marquee 30s linear infinite;
        }
        .promo-banner:hover .promo-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .promo-track {
            animation: none;
          }
        }
      `}</style>

      <div
        role="region"
        aria-label="Promotion"
        className={`${montserrat.className} promo-banner fixed inset-x-0 top-0 z-[60] h-8 overflow-hidden border-b border-white/15 bg-gradient-to-r from-violet-700 via-violet-600 to-purple-600 text-xs font-extrabold uppercase tracking-tight text-white shadow-lg shadow-violet-900/20 sm:text-xs dark:from-violet-800 dark:via-violet-700 dark:to-purple-700`}
      >
        <div className="promo-track flex h-full w-max items-center">
          {/* Content is rendered twice so the loop is seamless */}
          {Array.from({ length: 6 }).map((_, i) => item(i))}
        </div>
      </div>
    </>
  );
}