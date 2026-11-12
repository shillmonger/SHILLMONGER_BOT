"use client";

import Link from "next/link";
import { Montserrat } from "next/font/google";
import { Check, Flame, Minus } from "lucide-react";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

/* ───────────────── Content (edit these) ───────────────── */

const PLAN = {
  name: "Starter",
  badge: "Pay once",
  price: "$20",
  priceNote: "One-time purchase · credits never expire",
  cta: "Get started",
  href: "/LandingPage/subscribtion",
  credits: "1,000",
  profitableDays: "≈5",
  features: [
    { label: "1,000 credits included", included: true },
    { label: "≈5 profitable trading days", included: true },
    { label: "Credits deducted only on profitable days", included: true },
    { label: "Losing, break-even & no-trade days cost 0 credits", included: true },
    { label: "Unused credits roll over — never expire", included: true },
    { label: "Demo + live MT5 accounts", included: true },
    { label: "Upgrade to a bigger package anytime", included: true },
  ],
};

const NOTES = {
  pricing: {
    title: "Transparent pricing",
    desc: "One price, paid once. No monthly bill, no hidden fees.",
  },
  expiry: {
    title: "Credits never expire",
    desc: "Unused credits roll over forever — spend them at your own pace.",
  },
  action: {
    title: "Clear primary action",
    desc: "One button takes you straight to checkout.",
  },
  payForWins: {
    title: "Pay only for wins",
    desc: "200 credits per profitable day. Losing, break-even and no-trade days use 0 credits.",
  },
  features: {
    title: "Scannable feature list",
    desc: "Every benefit in plain words, easy to compare and remember.",
  },
};

/**
 * How far (px) each line reaches INTO the card, measured from the card edge.
 * Tune these if you change the price text, button width or feature labels.
 *  - pricingLeft / actionLeft: from the card's LEFT edge
 *  - priceNoteRight / creditsRight / featuresRight: from the card's RIGHT edge
 */
const REACH = {
  pricingLeft: 22, // stops just before the "$20" numeral
  actionLeft: 32, // lands on the left edge of the button
  priceNoteRight: 110, // lands near the end of the price-note line
  creditsRight: 64, // dot lands inside the credits highlight box
  featuresRight: 130, // bracket sits just right of the longest feature label
};

/* ───────────────── Small building blocks ───────────────── */

function Dot() {
  return (
    <span className="relative z-10 h-2 w-2 shrink-0 rounded-full bg-violet-500 ring-4 ring-violet-500/25 dark:bg-violet-300" />
  );
}

function Line() {
  return (
    <span className="h-px flex-1 bg-violet-500/60 dark:bg-violet-300/60" />
  );
}

function Note({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="w-56 shrink-0 rounded-xl border border-violet-500/25 bg-card/70 px-4 py-3 shadow-lg shadow-violet-600/10 backdrop-blur">
      <p
        className={`${montserrat.className} text-sm font-bold text-foreground`}
      >
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {desc}
      </p>
    </div>
  );
}

/**
 * Note on the LEFT. The cell is stretched `reach` px into the card so the
 * final dot lands on the element it describes. `h-0` + items-center pins the
 * line to the vertical middle of its grid row without changing the row height.
 */
function LeftNote({
  title,
  desc,
  row,
  reach,
}: {
  title: string;
  desc: string;
  row: string;
  reach: number;
}) {
  return (
    <div
      style={{ marginRight: -reach }}
      className={`pointer-events-none relative z-20 hidden h-0 items-center self-center lg:col-start-1 lg:flex ${row}`}
    >
      <Note title={title} desc={desc} />
      <Dot />
      <Line />
      <Dot />
    </div>
  );
}

/** Note on the RIGHT, reaching `reach` px into the card from its right edge. */
function RightNote({
  title,
  desc,
  row,
  reach,
  bracket = false,
}: {
  title: string;
  desc: string;
  row: string;
  reach: number;
  bracket?: boolean;
}) {
  return (
    <div
      style={{ marginLeft: -reach }}
      className={`pointer-events-none relative z-20 hidden items-center lg:col-start-3 lg:flex ${row} ${
        bracket ? "lg:pb-10 lg:pt-4" : "h-0 self-center"
      }`}
    >
      {bracket ? (
        <span className="relative w-px self-stretch bg-violet-500/60 dark:bg-violet-300/60">
          <span className="absolute -left-[3px] -top-1 h-2 w-2 rounded-full bg-violet-500 ring-4 ring-violet-500/25 dark:bg-violet-300" />
          <span className="absolute -bottom-1 -left-[3px] h-2 w-2 rounded-full bg-violet-500 ring-4 ring-violet-500/25 dark:bg-violet-300" />
        </span>
      ) : (
        <Dot />
      )}
      <Line />
      <Dot />
      <Note title={title} desc={desc} />
    </div>
  );
}

/* ───────────────── Section ───────────────── */

export default function PricingClarity() {
  return (
    <section
      id="pricing-clarity"
      className="relative w-full overflow-hidden bg-background py-16 md:py-24"
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-[130px]" />
      <div className="pointer-events-none absolute right-0 top-10 h-[300px] w-[300px] rounded-full bg-purple-600/10 blur-[110px]" />

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 lg:px-8">
        {/* Header */}
        <div className="text-center">
             <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-2 text-foreground">
          Clarity /<span className="text-violet-600 dark:text-violet-400">/ Confidence</span>
        </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">
            Prepaid credits, transparent pricing, and an obvious next step.
          </p>
        </div>

        {/* Card + annotations */}
        <div className="mx-auto mt-14 grid max-w-[440px] grid-cols-1 lg:max-w-none lg:grid-cols-[1fr_440px_1fr]">
          {/* Card surface (spans every row of the middle column) */}
          <div
            aria-hidden="true"
            className="relative col-start-1 row-span-6 row-start-1 overflow-hidden rounded-3xl border border-violet-400/40 bg-gradient-to-b from-violet-950 via-purple-950 to-violet-900 shadow-2xl shadow-violet-700/30 lg:col-start-2"
          >
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-fuchsia-500/40 via-violet-500/20 to-transparent blur-2xl" />
          </div>

          {/* Row 1: plan name + badge */}
          <div className="relative z-10 col-start-1 row-start-1 flex items-center justify-between px-7 pb-1 pt-7 lg:col-start-2">
            <p
              className={`${montserrat.className} text-xl font-bold text-white`}
            >
              {PLAN.name}
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-200">
              <Flame className="h-3.5 w-3.5 text-fuchsia-300" />
              {PLAN.badge}
            </span>
          </div>

          {/* Row 2: price numeral (line anchors to the middle of this row) */}
          <div className="relative z-10 col-start-1 row-start-2 px-7 pt-3 lg:col-start-2">
            <p
              className={`${montserrat.className} w-fit bg-gradient-to-b from-white to-violet-200 bg-clip-text text-6xl font-black leading-none tracking-tight text-transparent`}
            >
              {PLAN.price}
            </p>
          </div>

          {/* Row 3: price note */}
          <div className="relative z-10 col-start-1 row-start-3 px-7 pb-3 pt-2 lg:col-start-2">
            <p className="text-xs text-violet-200/80">{PLAN.priceNote}</p>
          </div>

          {/* Row 4: primary action */}
          <div className="relative z-10 col-start-1 row-start-4 px-7 py-4 lg:col-start-2">
            <Link
              href={PLAN.href}
              className={`${montserrat.className} flex w-full items-center justify-center rounded-full bg-white py-3 text-sm font-bold text-violet-700 shadow-lg shadow-violet-900/30 ring-2 ring-violet-400/60 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 active:scale-[0.98]`}
            >
              {PLAN.cta}
            </Link>
          </div>

          {/* Row 5: credits highlight */}
          <div className="relative z-10 col-start-1 row-start-5 px-7 py-4 lg:col-start-2">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p
                    className={`${montserrat.className} text-3xl font-black leading-none text-white`}
                  >
                    {PLAN.credits}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200/80">
                    credits included
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`${montserrat.className} text-3xl font-black leading-none text-emerald-300`}
                  >
                    {PLAN.profitableDays}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200/80">
                    profitable days
                  </p>
                </div>
              </div>
              <p className="mt-2.5 border-t border-white/10 pt-2 text-[11px] leading-snug text-violet-200/70">
                200 credits per profitable day · losing days cost 0 · ≈$4 per
                profitable day
              </p>
            </div>
          </div>

          {/* Row 6: features */}
          <ul className="relative z-10 col-start-1 row-start-6 space-y-3 px-7 pb-10 pt-4 lg:col-start-2">
            {PLAN.features.map((f) => (
              <li
                key={f.label}
                className={`flex items-center gap-2.5 text-sm ${
                  f.included
                    ? "text-violet-50"
                    : "text-violet-300/50 line-through"
                }`}
              >
                {f.included ? (
                  <Check
                    className="h-4 w-4 shrink-0 text-violet-300"
                    strokeWidth={2.5}
                  />
                ) : (
                  <Minus className="h-4 w-4 shrink-0 text-violet-300/40" />
                )}
                {f.label}
              </li>
            ))}
          </ul>

          {/* Desktop annotations: each line ends on the element it describes */}
          <LeftNote
            {...NOTES.pricing}
            row="lg:row-start-2"
            reach={REACH.pricingLeft}
          />
          <RightNote
            {...NOTES.expiry}
            row="lg:row-start-3"
            reach={REACH.priceNoteRight}
          />
          <LeftNote
            {...NOTES.action}
            row="lg:row-start-4"
            reach={REACH.actionLeft}
          />
          <RightNote
            {...NOTES.payForWins}
            row="lg:row-start-5"
            reach={REACH.creditsRight}
          />
          <RightNote
            {...NOTES.features}
            row="lg:row-start-6"
            reach={REACH.featuresRight}
            bracket
          />
        </div>

        {/* Mobile / tablet annotations */}
        <div className="mx-auto mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
          {Object.values(NOTES).map((n) => (
            <div
              key={n.title}
              className="rounded-xl border border-violet-500/25 bg-card px-4 py-3 shadow-lg shadow-violet-600/10"
            >
              <p
                className={`${montserrat.className} text-sm font-bold text-foreground`}
              >
                {n.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {n.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}