"use client";

import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Zap, Coins } from "lucide-react";
import { FaTelegram, FaDiscord, FaTwitter, FaGithub, FaWhatsapp } from "react-icons/fa";
import { IBM_Plex_Mono } from "next/font/google";
import ScrollToTop from "./ScrollToTop";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

const footerLinks = {
  Company: [
    { name: "TradingView", href: "https://www.tradingview.com/" },
    { name: "MetaTrader 5", href: "https://www.metatrader5.com/" },
    { name: "Forex Factory", href: "https://www.forexfactory.com/" },
    { name: "Capital Platform", href: "https://www.deriv.com/" },
  ],
  Resources: [
    { name: "Customer Support", href: "/support" },
    { name: "Community Hub", href: "/community" },
    { name: "Developers Portal", href: "/developers" },
    { name: "Guides & Tutorials", href: "/guides" },
  ],
  Legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Cookies Policy", href: "/cookies" },
    { name: "Refund Policy", href: "/refund" },
    { name: "Terms & Conditions", href: "/terms" },
  ],
};

export default function Footer() {
  const socialLinks = [
    { name: "Telegram", icon: <FaTelegram size={18} />, href: "#" },
    { name: "Discord", icon: <FaDiscord size={18} />, href: "#" },
    { name: "X (Twitter)", icon: <FaTwitter size={18} />, href: "#" },
    { name: "WhatsApp", icon: <FaWhatsapp size={18} />, href: "#" },
    { name: "GitHub", icon: <FaGithub size={18} />, href: "#" },
  ];

  return (
    <section className="relative mt-0 lg:mt-10 w-full text-neutral-50 font-sans">
      {/* Footer Outer Container — violet / purple theme */}
      <footer className="m-0 lg:mx-full relative bg-gradient-to-br from-violet-950 via-purple-950 to-violet-900 border border-violet-500/20 overflow-hidden shadow-2xl shadow-black/40">

        {/* Background glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/4 top-0 h-[300px] w-[300px] rounded-full bg-violet-600/20 blur-[110px]" />
          <div className="absolute right-1/4 bottom-0 h-[320px] w-[320px] rounded-full bg-purple-600/20 blur-[120px]" />
          <div className="absolute right-0 top-0 h-40 w-full bg-gradient-to-b from-violet-400/10 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-20 max-w-[1500px] mx-auto px-4 lg:px-5 pt-5 md:pt-10 lg:pt-5 pb-0">

          {/* Top Row */}
          <div className="flex flex-col lg:flex-row justify-between gap-12 lg:gap-16">

            {/* Brand details */}
            <div className="max-w-sm">
              <Link href="/" className="inline-flex items-center">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={300}
                  height={100}
                  className="h-15 lg:h-20 w-auto object-contain"
                  priority
                />
              </Link>

              <p className="mt-4 text-sm leading-relaxed text-white/70 font-normal">
                Automate your trading with confidence. Choose a subscription plan that matches your account size and let our intelligent trading system execute trades whenever valid market opportunities arise.
              </p>

              {/* Social Icons */}
              <div className="flex gap-2.5 mt-6">
                {socialLinks.map((social) => (
                  <Link
                    key={social.name}
                    href={social.href}
                    aria-label={social.name}
                    className="w-11 h-11 rounded-xl border border-violet-500/25 bg-white/5 hover:bg-violet-500/20 hover:border-violet-400/60 hover:text-violet-400 transition-all duration-300 flex items-center justify-center text-white"
                  >
                    {social.icon}
                  </Link>
                ))}
              </div>
            </div>

            {/* Navigation links */}
            <div className="flex flex-col lg:flex-row justify-between lg:justify-end flex-1 lg:flex-initial lg:ml-auto gap-10 lg:gap-16">
              {Object.entries(footerLinks).map(([title, items]) => (
                <div key={title} className="min-w-[140px]">
                  <h3 className={`${plexMono.className} text-xs uppercase tracking-[0.15em] font-bold text-violet-400 mb-5`}>
                    {title}
                  </h3>
                  <ul className="space-y-3">
                    {items.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className="text-sm text-white/70 hover:text-violet-400 transition-colors duration-200 font-medium"
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Trust Badges */}
          <div className="max-w-[1500px] mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-violet-500/20 pt-12">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="text-violet-400" size={22} />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-white uppercase tracking-wide">Secure Trading</h4>
                <p className="text-xs text-white/60 mt-1">Your account credentials are encrypted and never shared.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
                <Zap className="text-violet-400" size={22} />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-white uppercase tracking-wide">Real-Time Execution</h4>
                <p className="text-xs text-white/60 mt-1">Lightning-fast trade execution on valid market conditions.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
                <Coins className="text-violet-400" size={22} />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-white uppercase tracking-wide">MT4/MT5 Compatible</h4>
                <p className="text-xs text-white/60 mt-1">Seamlessly integrates with MetaTrader 4 and 5 platforms.</p>
              </div>
            </div>
          </div>

          {/* Financial Disclaimer */}
          <div className="max-w-[1500px] mx-auto mt-6 space-y-5 text-xs leading-relaxed text-white/60 pt-2">

            {/* Risk Disclosure */}
            <div className="space-y-2 border-t border-violet-500/20 pt-6">
              <p className="text-xs font-normal">
                <span className={`${plexMono.className} font-bold text-violet-400`}>RISK DISCLOSURE:</span>{" "}
                Trading Forex and other financial markets involves substantial risk and may not be suitable for every investor. Our automated trading bot executes trades based on predefined trading strategies and valid market conditions. While our system is designed to identify quality trading opportunities, profits are never guaranteed, and losses can occur. Users should only trade with funds they can afford to lose.
              </p>
            </div>

            {/* Service Disclaimer */}
            <div className="space-y-2 border-t border-violet-500/20 pt-6">
              <p className={`${plexMono.className} font-bold text-violet-400 uppercase tracking-wider text-xs`}>
                SERVICE DISCLAIMER
              </p>
              <p className="text-xs font-normal">
                SHILLMONGER provides subscription-based access to an automated trading bot that places trades on connected MetaTrader 5 accounts according to each user's selected plan. The bot only executes trades when valid market conditions are detected and does not force trades during unfavorable market conditions. Performance targets described in each subscription plan are objectives rather than guarantees and may vary depending on market volatility and available trading opportunities.
              </p>
            </div>

            {/* User Responsibility */}
            <div className="space-y-2 border-t border-violet-500/20 pt-6">
              <p className={`${plexMono.className} font-bold text-violet-400 uppercase tracking-wider text-xs`}>
                USER RESPONSIBILITY
              </p>
              <p className="text-xs font-normal">
                By subscribing, users acknowledge the risks associated with financial market trading and remain fully responsible for their trading accounts, broker selection, and deposited funds. It is the user's responsibility to ensure their account meets the minimum requirements for their selected subscription plan.
              </p>
            </div>
          </div>

          {/* Final Copyright & Details */}
          <div className="max-w-[1500px] mx-auto border-t border-violet-500/20 mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-white/60">
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6">
              <p className="font-semibold text-white">© {new Date().getFullYear()} SHILLMONGER. All rights reserved.</p>
              <div className="flex flex-wrap md:flex-nowrap justify-center md:justify-start gap-x-4 gap-y-2">
                <Link href="/landing-page/privacy" className="hover:text-violet-400 transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/landing-page/terms" className="hover:text-violet-400 transition-colors">
                  Investor Agreement
                </Link>
                <Link href="/landing-page/refund" className="hover:text-violet-400 transition-colors">
                  Refunds Policy
                </Link>
                <Link href="/landing-page/security" className="hover:text-violet-400 transition-colors">
                  Security Policy
                </Link>
              </div>
            </div>
            <p className="text-center md:text-right max-w-md text-white/50 text-[11px] leading-relaxed">
              Trading involves risk and profits are never guaranteed. SHILLMONGER provides subscription-based access to an automated trading bot for MetaTrader 5. By using this platform, you acknowledge and accept our Risk Disclosure and Terms of Service.
            </p>
          </div>

          {/* Big brand image — same idea as the large CONVRTO wordmark.
              Fades out at the bottom and at the left/right edges. */}
          <div
            className="relative mt-10 -mb-6 md:-mb-10 lg:-mb-14 select-none pointer-events-none"
            aria-hidden="true"
          >
            <Image
              src="/logo1.png"
              alt=""
              width={1600}
              height={400}
              sizes="(max-width: 1500px) 100vw, 1500px"
              className="w-full h-auto object-contain"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 35%, transparent 100%), linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
                WebkitMaskComposite: "source-in",
                maskImage:
                  "linear-gradient(to bottom, black 35%, transparent 100%), linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
                maskComposite: "intersect",
              }}
            />
          </div>
        </div>
      </footer>
      <ScrollToTop />
    </section>
  );
}