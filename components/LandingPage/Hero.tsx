"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Check } from "lucide-react";
import { Montserrat, IBM_Plex_Mono } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

// File lives in /public — change the name/case here if yours differs (case-sensitive on Vercel).
const HERO_VIDEO = "/VIDEOS/MTR.mp4";

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Some browsers pause autoplay videos — nudge it
  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  const pills = ["Automated", "Capital.com", "MT4", "MT5"];

  const bullets = [
    "Connect your Capital.com account (MT4 & MT5 supported) to our automated trading system.",
    "Our bot executes trades when valid market conditions are detected.",
  ];

  return (
    <section className="relative w-full lg:mb-20">
      {/* ───────────── Full-screen video background ───────────── */}
      <div className="relative h-[calc(100svh-2rem)] w-full overflow-hidden bg-violet-950 lg:min-h-[630px]">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        />

        {/* Top-left platform pills */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`${plexMono.className} absolute left-4 top-5 z-10 flex flex-wrap items-center gap-2 md:left-8 md:top-8`}
        >
          {pills.map((p, i) => (
            <span
              key={p}
              className={`rounded-full px-4 py-1.5 text-[11px] font-medium tracking-wide backdrop-blur-md ${
                i === 0
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-900/40"
                  : "border border-white/30 bg-white/15 text-white"
              }`}
            >
              {p}
            </span>
          ))}
        </motion.div>
      </div>

      {/* ───────────── Overlapping content box (bottom-right) ───────────── */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative z-20 w-full border-l-4 border-violet-400 bg-gradient-to-br from-violet-950 via-purple-950 to-violet-900 p-6 text-white shadow-2xl shadow-black/40 md:p-12 lg:absolute lg:-bottom-20 lg:right-0 lg:w-[48%] lg:p-10 xl:w-[43%]"
      >
        {/* soft glow */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-violet-500/20 blur-[80px]" />

        <div className="relative max-w-md">
          {/* Bullets */}
          <ul className="mb-6 space-y-2">
            {bullets.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2.5 text-xs font-medium leading-relaxed text-white/70 md:text-sm"
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {/* Headline */}
          <h1
            className={`${montserrat.className} mb-8 text-4xl font-black uppercase leading-[1.05] tracking-tight md:text-[40px]`}
          >
            Trade GOLD The Smarter Way
          </h1>

          {/* CTAs */}
          <div className="flex  flex-row items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/auth-page/login"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-xs lg:text-xs font-bold uppercase tracking-widest text-white transition-all hover:border-white hover:bg-white hover:text-violet-900 active:scale-95 sm:w-auto"
            >
              Sign in
            </Link>
            <Link
              href="/auth-page/register"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-7 py-3.5 text-xs lg:text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-violet-900/50 transition-all hover:bg-white hover:from-white hover:to-white hover:text-violet-900 active:scale-95 sm:w-auto"
            >
              Free Trial
              {/* <ArrowUpRight className="h-5 w-5" /> */}
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}