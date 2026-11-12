"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FaDiscord, FaTwitter, FaWhatsapp } from "react-icons/fa";
import { ArrowUp, Sparkles } from "lucide-react";

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function FloatingSidebar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(window.scrollY / max, 1) : 0);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const socialLinks = [
    {
      label: "Discord",
      href: "#",
      icon: <FaDiscord size={19} />,
    },
    {
      label: "Twitter",
      href: "#",
      icon: <FaTwitter size={17} />,
    },
    // {
    //   label: "WhatsApp",
    //   href: "#",
    //   icon: <FaWhatsapp size={18} />,
    // },
  ];

  const tooltip = `
    pointer-events-none absolute right-14
    whitespace-nowrap rounded-full
    border border-border bg-popover
    px-3 py-1.5 text-xs font-semibold
    text-popover-foreground shadow-lg
    opacity-0 translate-x-2
    transition-all duration-200
    group-hover:translate-x-0
    group-hover:opacity-100
  `;

  return (
    <aside
      aria-label="Quick Actions Sidebar"
      className="
        fixed right-4 top-1/2 z-[100]
        hidden -translate-y-1/2 flex-col items-center
        rounded-full
        border border-border/70
        bg-background/85
        px-2.5 py-4
        shadow-[0_8px_40px_rgba(0,0,0,0.10)]
        backdrop-blur-2xl
        transition-all duration-300
        dark:bg-card/80
        dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]
        md:flex
      "
    >
      {/* Brand Icon */}
      <Link
        href="/"
        aria-label="Nexus Home"
        className="
          group mb-2 flex h-11 w-11 items-center
          justify-center rounded-full
          bg-gradient-to-br from-violet-600 to-purple-600
          text-white shadow-lg shadow-violet-600/25
          transition-all duration-300
          hover:scale-105 hover:shadow-violet-600/40
        "
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          className="h-6 w-6 transition-transform duration-500 group-hover:rotate-90"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M10 12L16 16L22 12M16 16V24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      {/* Divider */}
      <div className="my-2 h-px w-8 bg-border" />

      {/* Social Links */}
      <div className="flex flex-col items-center gap-1">
        {socialLinks.map((social) => (
          <Link
            key={social.label}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.label}
            className="
              group relative flex h-10 w-10
              items-center justify-center rounded-full
              text-muted-foreground
              transition-all duration-300
              hover:scale-110
              hover:bg-violet-500/10
              hover:text-violet-600
              dark:hover:text-violet-400
            "
          >
            {social.icon}
            <span className={tooltip}>{social.label}</span>
          </Link>
        ))}
      </div>

      {/* Divider */}
      <div className="my-2 h-px w-8 bg-border" />

      {/* Scroll to Top + progress ring */}
      <button
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className="
          group relative flex h-10 w-10
          items-center justify-center rounded-full
          text-muted-foreground
          transition-all duration-300
          hover:scale-110
          hover:bg-violet-500/10
          hover:text-violet-600
          dark:hover:text-violet-400
        "
      >
        <svg
          viewBox="0 0 40 40"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-10 w-10 -rotate-90"
        >
          <circle
            cx="20"
            cy="20"
            r={RADIUS}
            fill="none"
            strokeWidth="2"
            className="stroke-border"
          />
          <circle
            cx="20"
            cy="20"
            r={RADIUS}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            className="stroke-violet-600 transition-[stroke-dashoffset] duration-150 ease-linear dark:stroke-violet-400"
          />
        </svg>

        <ArrowUp
          size={17}
          className="transition-transform duration-300 group-hover:-translate-y-0.5"
        />

        <span className={tooltip}>
          Back to top · {Math.round(progress * 100)}%
        </span>
      </button>

      {/* Divider */}
      <div className="my-2 h-px w-8 bg-border" />

      {/* Get Funded CTA */}
      <Link
        href="/auth-page/register"
        className="
          group flex flex-col items-center gap-2
          rounded-full bg-gradient-to-b
          from-violet-600 to-purple-700
          px-3 py-4 text-white
          shadow-lg shadow-violet-600/20
          transition-all duration-300
          hover:-translate-y-0.5
          hover:shadow-violet-600/40
          active:scale-95
        "
      >

        <span
          className="
            [writing-mode:vertical-rl]
            rotate-180
            text-[10px] font-extrabold
            uppercase tracking-[0.18em]
          "
        >
          Get BOT
        </span>
      </Link>
    </aside>
  );
}