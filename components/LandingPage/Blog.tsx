"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Play, Plus, Sparkles } from "lucide-react";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
});

/*
  HOW THE COLLAGE IS BUILT (from the reference image)
  ---------------------------------------------------
  5 columns, each a flex column, all sharing one bottom edge:

  col 1  [ TALL ][ short ]          starts at the very top
  col 2  (gap)[   MEDIUM TALL   ]   starts a bit lower, ends at the bottom
  col 3  (gap + sparkle)[ card ][ button ]   starts lowest
  col 4  (gap)[   MEDIUM TALL   ]   mirrors col 2 (same start + same height)
  col 5  [ TALL ][ short ]          mirror of col 1

  Heights are flex ratios (flex-[66] etc.) so the shape scales with the
  container. Some cards have a concave "notch" cut from one top corner,
  done with a CSS mask so it works on any background.

  Placeholder photos are random. Replace each `src` with her own work,
  e.g. "/showcase/1.jpg".
*/

const IMG = {
  c1Tall: "/Blog/1.png",
  c1Short: "https://i.postimg.cc/L62fth8Z/April-Design.jpg",    
  c2: "https://i.postimg.cc/XqMKS8W9/Independence-day-design-(1).jpg",
  c3: "https://i.postimg.cc/FFJGWfvK/New-week-post.jpg",
  c4: "https://i.postimg.cc/d1fdR9D1/September.jpg",
  c5Tall: "https://i.postimg.cc/mDp3XspB/Independence-day-design.jpg",
  c5Short: "https://i.postimg.cc/j5xv3vs5/New-Month-design.jpg",
};

const AVATARS = ["AO", "CE", "TK"];

type Notch = "tl" | "tr" | undefined;

function notchMask(notch: Notch): React.CSSProperties {
  if (!notch) return {};
  const pos = notch === "tr" ? "100% 0" : "0 0";
  const mask = `radial-gradient(circle at ${pos}, transparent 22px, #000 22.5px)`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

function Tile({
  src,
  alt,
  tint,
  notch,
  className = "",
}: {
  src: string;
  alt: string;
  tint: string;
  notch?: Notch;
  className?: string;
}) {
  return (
    <div
      className={`group relative min-h-0 overflow-hidden rounded-[1.4rem] border-4 border-[#471700] ${className}`}
      style={{ backgroundColor: tint, ...notchMask(notch) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
    </div>
  );
}

function RotatingBadge() {
  return (
    <Link
      href="#about"
      aria-label="Watch my story"
      className="group relative flex h-24 w-24 shrink-0 items-center justify-center"
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full animate-[spin_18s_linear_infinite] motion-reduce:animate-none"
        aria-hidden
      >
        <defs>
          <path id="pd-badge-circle" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <text
          className="fill-[#351200] text-[9.5px] font-medium tracking-[0.22em] dark:fill-white"
          style={{ fontFamily: "inherit" }}
        >
          <textPath href="#pd-badge-circle">LEARN ABOUT MY STORY • WATCH MY INTRO •</textPath>
        </text>
      </svg>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#351200] text-white transition-transform group-hover:scale-110 dark:bg-[#D2B48C] dark:text-[#351200]">
        <Play className="ml-0.5 h-4 w-4 fill-current" />
      </span>
    </Link>
  );
}

function AvatarStack() {
  return (
    <div className="flex items-center -space-x-2" aria-label="Happy clients">
      {AVATARS.map((initials, i) => (
        <span
          key={initials}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#E8C9B8] text-[10px] font-bold text-[#471700] dark:border-[#1a110b]"
          style={{ zIndex: 3 - i }}
        >
          {initials}
        </span>
      ))}
      <span className="z-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#351200] text-white dark:border-[#1a110b] dark:bg-[#D2B48C] dark:text-[#351200]">
        <Plus className="h-4 w-4" />
      </span>
    </div>
  );
}

export default function DesignShowcase() {
  return (
    <section
      className={`${poppins.className} mx-auto w-full max-w-[1500px] px-4 py-14 lg:px-8 lg:py-20`}
    >
      {/* Mobile: badge + avatars row */}
      <div className="mb-6 flex items-center justify-between lg:hidden">
        <RotatingBadge />
        <AvatarStack />
      </div>

      {/* Headline (+ desktop side items) */}
      <div className="relative mb-8 lg:mb-10">
        <div className="absolute left-0 top-0 hidden lg:block">
          <RotatingBadge />
        </div>
        <div className="absolute right-0 top-3 hidden lg:block">
          <AvatarStack />
        </div>

        <h2 className="mx-auto max-w-3xl text-center text-4xl font-extrabold leading-[1.1] tracking-tight text-[#351200] dark:text-white sm:text-5xl lg:text-6xl">
          Bring Your Ideas To Life With Bold Design
        </h2>
      </div>

      {/* Collage: swipe on mobile, 5-column grid on desktop */}
      <div className="-mx-4 flex h-[400px] snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 [-ms-overflow-style:none] [scrollbar-width:none] lg:mx-0 lg:grid lg:h-[540px] lg:grid-cols-5 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        {/* COL 1 — tall + short, top aligned */}
        <div className="flex w-[44%] shrink-0 snap-start flex-col gap-3 lg:w-auto">
          <Tile src={IMG.c1Tall} alt="Design work 1" tint="#C48A6A" className="flex-[55]" />
          <Tile src={IMG.c1Short} alt="Design work 2" tint="#E8C9B8" className="flex-[45]" />
        </div>

        {/* COL 2 — starts lower, runs to the bottom */}
        <div className="flex w-[44%] shrink-0 snap-start flex-col gap-3 lg:w-auto">
          <div className="flex-[10]" />
          <Tile src={IMG.c2} alt="Design work 3" tint="#D2B48C" className="flex-[90]" />
        </div>

        {/* COL 3 — sparkle, centre card, call-to-action button */}
        <div className="flex w-[44%] shrink-0 snap-start flex-col gap-3 lg:w-auto">
          <div className="flex flex-[25] items-center justify-center" aria-hidden>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8C9B8] text-[#471700] dark:bg-[#D2B48C]/25 dark:text-[#D2B48C]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
          </div>
          <Tile src={IMG.c3} alt="Design work 4" tint="#A9714B" className="flex-[55]" />
          <Link
            href="https://www.pinterest.com/peculiardizynz/"
            className="flex flex-[15] items-center justify-center gap-2 rounded-full bg-[#1F130C] px-4 text-sm font-bold sm:text-xl text-white transition-transform hover:scale-[1.03] active:scale-95 dark:bg-[#F5EDE3] dark:text-[#351200]"
          >
            View My Work
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* COL 4 — mirrors col 2: same start, same height, same bottom edge */}
        <div className="flex w-[44%] shrink-0 snap-start flex-col gap-3 lg:w-auto">
          <div className="flex-[10]" />
          <Tile src={IMG.c4} alt="Design work 5" tint="#E8C9B8" className="flex-[90]" />
        </div>

        {/* COL 5 — tall + short, top aligned (mirror of col 1) */}
        <div className="flex w-[44%] shrink-0 snap-start flex-col gap-3 lg:w-auto">
          <Tile src={IMG.c5Tall} alt="Design work 6" tint="#471700" className="flex-[55]" />
          <Tile src={IMG.c5Short} alt="Design work 7" tint="#351200" className="flex-[45]" />
        </div>
      </div>
    </section>
  );
}