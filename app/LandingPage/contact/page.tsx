"use client";

import React, { useState } from "react";
import { Headphones, Send } from "lucide-react";
import FQ from "@/components/LandingPage/F&Q";
import { toast } from "sonner";
import {
  FaTelegram,
  FaDiscord,
  FaTwitter,
  FaGithub,
  FaWhatsapp,
  FaEnvelope,
} from "react-icons/fa";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
});

/*
  Palette: theme-aware text (light = dark text on page bg, dark = white text),
  violet / purple accents matching the footer. The info card stays dark purple
  in both modes.
*/
const CONTACT = {
  hotline: {
    label: "Support Hotline",
    value: "+234 805 848 3041",
    href: "tel:+2348058483041",
  },
  whatsapp: {
    label: "WhatsApp / Telegram",
    value: "+234 805 848 3041",
    href: "https://wa.me/2348058483041",
  },
  email: {
    label: "Email",
    value: "shillmonger0@gmail.com",
    href: "mailto:shillmonger0@gmail.com",
  },
};

const CONTACT_ICONS = {
  hotline: Headphones,
  whatsapp: FaWhatsapp,
  email: FaEnvelope,
};

// Same social channels as the footer
const SOCIALS = [
  { label: "Telegram", href: "#", icon: FaTelegram },
  { label: "Discord", href: "#", icon: FaDiscord },
  { label: "X (Twitter)", href: "#", icon: FaTwitter },
  { label: "WhatsApp", href: "#", icon: FaWhatsapp },
  { label: "GitHub", href: "#", icon: FaGithub },
];

const inputBase =
  "w-full rounded-full border border-neutral-300 bg-white px-3.5 py-3 text-xs sm:px-5 sm:py-3.5 sm:text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15 dark:border-violet-400/20 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-violet-400 dark:focus:ring-violet-500/20";

const labelBase =
  "mb-1.5 block text-xs font-semibold text-neutral-800 dark:text-white/90";

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactSection() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("sent");
      form.reset();
      toast.success("Message sent successfully!");
    } catch {
      setStatus("error");
      toast.error("Failed to send message. Please try again.");
    }
  }

  return (
    <section
      id="contact"
      className={`${poppins.className} relative w-full overflow-hidden py-8 lg:pt-10 lg:pb-0`}
    >
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-4 lg:px-8">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-4xl md:text-5xl">
          Contact <span className="text-violet-600 dark:text-violet-400">Us</span>
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-xs leading-relaxed text-neutral-600 dark:text-white/70 sm:text-sm md:text-base">
          Questions about a subscription plan, setup on MetaTrader 5, or how our
          automated XAUUSD strategies work? Our team is here to help you get
          started.
        </p>

        <div className="mt-8 grid gap-6 lg:mt-12 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-8">
          {/* ============ FORM CARD ============ */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-[0_10px_40px_-12px_rgba(76,29,149,0.15)] sm:rounded-[2rem] sm:p-8 lg:p-10 dark:border-violet-500/20 dark:bg-white/5 dark:shadow-[0_10px_40px_-12px_rgba(76,29,149,0.35)] dark:backdrop-blur-sm">
            <h3 className="text-lg font-bold text-neutral-900 sm:text-xl lg:text-2xl dark:text-white">
              Send us a message
            </h3>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-neutral-600 sm:text-sm dark:text-white/70">
              Tell us about your account size and trading goals — we'll help you
              pick the right plan and get the bot running on your MT5 account.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4 sm:space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className={labelBase}>
                    First Name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    autoComplete="given-name"
                    placeholder="First name"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className={labelBase}>
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    autoComplete="family-name"
                    placeholder="Last name"
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="email" className={labelBase}>
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Enter your email"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className={labelBase}>
                    Contact Details
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Enter your phone number"
                    className={inputBase}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="message" className={labelBase}>
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={4}
                  placeholder="Tell us what you need help with..."
                  className={`${inputBase} resize-none rounded-xl`}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 text-xs font-semibold text-white transition-transform hover:scale-[1.02] hover:from-violet-500 hover:to-purple-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:px-8 sm:py-3.5 sm:text-sm"
                >
                  {status === "sending" ? "Sending..." : "Send a Message"}
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </form>
          </div>

          {/* ============ INFO CARD ============ */}
          <aside className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-700 via-purple-800 to-violet-950 p-4 text-white shadow-[0_10px_40px_-12px_rgba(76,29,149,0.45)] sm:rounded-[2rem] sm:p-8 dark:from-violet-600/30 dark:via-purple-700/30 dark:to-violet-900/40 dark:shadow-none dark:backdrop-blur-sm">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-400/20 sm:h-44 sm:w-44" />
            <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-48 rotate-[-20deg] rounded-[50%] bg-purple-400/20 sm:h-48 sm:w-56" />

            <div className="relative">
              <h3 className="text-base font-bold leading-snug sm:text-lg">
                Questions about the bot? We're always here to help.
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-white/70 sm:text-sm">
                Whether it's plan selection, MT5 setup, or strategy questions —
                reach out and we'll get back to you quickly.
              </p>

              <ul className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3">
                <InfoRow icon={CONTACT_ICONS.hotline} {...CONTACT.hotline} />
                <InfoRow icon={CONTACT_ICONS.whatsapp} {...CONTACT.whatsapp} />
                <InfoRow icon={CONTACT_ICONS.email} {...CONTACT.email} />
              </ul>

              <div className="mt-6 border-t border-violet-400/20 pt-5 sm:mt-8 sm:pt-6">
                <p className="text-xs font-semibold text-white/90">
                  Connect with us
                </p>
                <ul className="mt-3 flex flex-wrap items-center gap-2.5 sm:gap-3">
                  {SOCIALS.map(({ label, href, icon: Icon }) => (
                    <li key={label}>
                      <a
                        href={href}
                        aria-label={label}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/25 bg-white/5 text-white transition-all duration-300 hover:scale-105 hover:border-violet-400/60 hover:bg-violet-500/20 hover:text-violet-300"
                      >
                        <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>

        <FQ />
      </div>
    </section>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <li>
      <a
        href={href}
        className="flex items-center gap-3 rounded-xl border border-violet-400/15 bg-white/5 px-3 py-2.5 backdrop-blur-sm transition hover:bg-violet-500/20 sm:gap-4 sm:rounded-2xl sm:px-4 sm:py-3.5"
      >
        <Icon className="h-4 w-4 shrink-0 text-violet-300 sm:h-5 sm:w-5" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold sm:text-xs">
            {label}
          </span>
          <span className="block truncate text-[11px] text-white/80 sm:text-xs">
            {value}
          </span>
        </span>
      </a>
    </li>
  );
}
