"use client";
import React, { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "What is SHILLMONGER and how does it work?",
    answer: "SHILLMONGER is an automated XAUUSD (gold) trading bot that connects to your MetaTrader 4 or 5 account. Once linked, the bot analyzes gold market conditions and executes trades on your behalf — demo or live — so you can grow your account without watching charts all day."
  },
  {
    question: "How do the credit packages work?",
    answer: "SHILLMONGER uses prepaid credit packages from $20 to $1,000 — there is no monthly subscription. You get a credit balance (e.g. Starter = 1,000 credits) and credits are only deducted on profitable trading days: 200 credits per winning day. Losing, break-even and no-trade days cost 0 credits, and unused credits roll over and never expire."
  },
  {
    question: "Is there a free plan?",
    answer: "Yes — the Free plan gives you full bot access on a demo MT5 account at zero cost, forever. It's the safest way to test execution and watch the bot work before you put real capital on a live account."
  },
  {
    question: "How do I connect my MT4/MT5 account to the bot?",
    answer: "Pick a plan on the subscription page and complete checkout. After payment is confirmed, you connect your broker account through your SHILLMONGER dashboard and the bot starts trading XAUUSD on your behalf."
  },
  {
    question: "How and when can I withdraw my profits?",
    answer: "The bot trades directly inside your own broker account, so profits and losses show up there in real time — SHILLMONGER never holds your funds. You withdraw anytime through your broker using your usual methods, exactly as if you traded manually."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept crypto (USDT), bank transfer and major bank cards. All plans are one-time prepaid purchases, so there is never a recurring charge."
  },
  {
    question: "Is my broker account information secure?",
    answer: "Yes, security is our top priority. Your broker credentials are encrypted and never shared with third parties. We use industry-standard encryption to protect your account information at all times."
  },
  {
    question: "What lot sizes and risk settings does the bot use on XAUUSD?",
    answer: "SHILLMONGER sizes every XAUUSD trade according to your account balance and selected plan, using predefined risk parameters and stop-loss levels. The bot is built to manage drawdown responsibly rather than force trades during volatile or unfavorable gold market conditions."
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const half = Math.ceil(faqs.length / 2);
  const leftColumnFaqs = faqs.slice(0, half);
  const rightColumnFaqs = faqs.slice(half);

  return (
    <section id="faq" className="mx-auto max-w-[1500px] px-4 lg:px-8 py-20 w-full text-neutral-900 dark:text-neutral-100 font-sans">
      <div className="text-center mb-5 relative z-10 max-w-xl mx-auto">

        {/* Main Heading */}
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-2 text-foreground">
          Frequently Asked <span className="text-violet-600 dark:text-violet-400">Questions</span>
        </h2>

        {/* Centered Paragraph */}
          <p className="mx-auto mt-0 max-w-xl text-base text-muted-foreground md:text-lg">
          Everything you need to know about the SHILLMONGER automated XAUUSD trading bot.
          From MT4/MT5 integration and prepaid credits to payouts and payments.
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Column */}
        <div className="space-y-4">
          {leftColumnFaqs.map((faq, index) => (
            <FAQItem
              key={index}
              faq={faq}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {rightColumnFaqs.map((faq, index) => {
            const globalIndex = index + half;
            return (
              <FAQItem
                key={globalIndex}
                faq={faq}
                isOpen={openIndex === globalIndex}
                onClick={() => setOpenIndex(openIndex === globalIndex ? null : globalIndex)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ faq, isOpen, onClick }: { faq: any; isOpen: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`group relative transition-all duration-300 rounded-xl border cursor-pointer overflow-hidden ${
        isOpen
          ? "bg-white dark:bg-neutral-900 border-violet-500/40 shadow-lg shadow-violet-600/10"
          : "bg-white/70 dark:bg-neutral-900/70 hover:bg-white dark:hover:bg-neutral-900 border-neutral-200/80 dark:border-neutral-700/80 hover:border-violet-400/50 dark:hover:border-violet-500/40 shadow-sm"
      }`}
    >
      <div className="w-full flex items-center justify-between p-4 px-5 text-left">
        <span
          className={`text-base md:text-base font-bold tracking-tight transition-colors ${
            isOpen
              ? "text-violet-900 dark:text-white"
              : "text-neutral-800 dark:text-neutral-200 group-hover:text-violet-700 dark:group-hover:text-violet-300"
          }`}
        >
          {faq.question}
        </span>
        <div className="flex-shrink-0 ml-4">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 ${
              isOpen
                ? "bg-gradient-to-br from-violet-600 to-purple-600 text-white rotate-180 shadow-md shadow-violet-600/30"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/40 group-hover:text-violet-700 dark:group-hover:text-violet-300"
            }`}
          >
            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="px-6 pb-6 pt-0" onClick={(e) => e.stopPropagation()}>
          <div className="h-[1px] bg-violet-100 dark:bg-violet-900/40 mb-4" />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm md:text-sm leading-relaxed font-normal">
            {faq.answer}
          </p>
        </div>
      )}
    </div>
  );
}