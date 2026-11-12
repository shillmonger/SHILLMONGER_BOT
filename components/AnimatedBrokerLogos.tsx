"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

export function AnimatedBrokerLogos({
  shillmonger,
  capital,
}: {
  shillmonger: React.ReactNode;
  capital: React.ReactNode;
}) {
  const [swapped, setSwapped] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSwapped((prev) => !prev);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const logos = [
    { id: "shill", content: shillmonger },
    { id: "capital", content: capital },
  ];

  const ordered = swapped ? [...logos].reverse() : logos;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.09] via-zinc-800 to-zinc-950 p-4">
      {/* Background glow */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />

      {/* Header */}
      <div className="relative mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-violet-300">
          BROKER NETWORK
        </span>

        <span className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] text-emerald-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          LIVE
        </span>
      </div>

      {/* Connection stage */}
      <div className="relative flex min-h-25 items-center justify-center gap-20 rounded-xl border border-white/10 bg-black/30 px-4 py-4">
        {/* Animated connection beam */}
        <div className="pointer-events-none absolute left-[20%] right-[20%] top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-violet-400 to-transparent">
          <motion.div
            className="absolute -top-1 h-2 w-2 rounded-full bg-violet-300 shadow-[0_0_15px_4px_rgba(167,139,250,0.7)]"
            animate={{ left: ["0%", "100%"] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </div>

        {/* Logos */}
        {ordered.map((logo) => (
          <motion.div
            key={logo.id}
            layout
            transition={{
              layout: {
                duration: 1.1,
                ease: [0.22, 1, 0.36, 1],
              },
            }}
            className="relative z-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-full  border border-white/15 bg-white shadow-[0_8px_30px_rgba(139,92,246,0.15)]"
          >
            <motion.div
              key={`${logo.id}-${swapped}`}
              initial={{ rotateY: 90, scale: 0.7, opacity: 0 }}
              animate={{ rotateY: 0, scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="flex h-full w-full items-center justify-center"
              style={{ backfaceVisibility: "hidden" }}
            >
              {logo.content}
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="relative mt-3 flex items-center justify-between text-xs">
        <span className="text-zinc-400">
          {swapped ? "Capital.com" : "Shillmonger"}
        </span>

        <span className="flex items-center gap-1.5 text-violet-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
          Synchronizing
        </span>

        <span className="text-zinc-400">
          {swapped ? "Shillmonger" : "Capital.com"}
        </span>
      </div>
    </div>
  );
}
