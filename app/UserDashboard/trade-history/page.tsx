"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { IBM_Plex_Mono } from "next/font/google";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const plexMono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], display: "swap" });

/* ───────────────── Types & sample data ───────────────── */

type Filter = "all" | "winning" | "losing" | "open" | "closed";

interface Trade {
  id: string; symbol: string; dir: "BUY" | "SELL"; entry: number; exit: number | null;
  opened: string; closed: string | null; pl: number; status: "WIN" | "LOSS" | "OPEN";
}

const TRADES: Trade[] = [
  { id: "TRD-001", symbol: "XAU/USD", dir: "BUY", entry: 4388.23, exit: 4413.33, opened: "2026-11-11 09:14", closed: "2026-11-11 11:40", pl: 125.5, status: "WIN" },
  { id: "TRD-002", symbol: "XAU/USD", dir: "SELL", entry: 4388.71, exit: 4397.77, opened: "2026-11-11 12:02", closed: "2026-11-11 12:51", pl: -45.3, status: "LOSS" },
  { id: "TRD-003", symbol: "GBP/USD", dir: "SELL", entry: 1.2641, exit: 1.2603, opened: "2026-11-10 08:30", closed: "2026-11-10 14:05", pl: 78.25, status: "WIN" },
  { id: "TRD-004", symbol: "USD/CAD", dir: "BUY", entry: 1.3712, exit: 1.3688, opened: "2026-11-10 15:11", closed: "2026-11-10 16:20", pl: -32.1, status: "LOSS" },
  { id: "TRD-005", symbol: "AUD/USD", dir: "BUY", entry: 0.6544, exit: 0.6571, opened: "2026-11-09 07:45", closed: "2026-11-09 10:30", pl: 56.8, status: "WIN" },
  { id: "TRD-006", symbol: "USD/CHF", dir: "SELL", entry: 0.8812, exit: 0.8799, opened: "2026-11-09 13:00", closed: "2026-11-09 15:42", pl: 12.4, status: "WIN" },
  { id: "TRD-007", symbol: "XAU/USD", dir: "BUY", entry: 4405.72, exit: null, opened: "2026-11-12 08:20", closed: null, pl: 25.16, status: "OPEN" },
  { id: "TRD-008", symbol: "EUR/USD", dir: "SELL", entry: 1.0842, exit: null, opened: "2026-11-12 09:05", closed: null, pl: -19.0, status: "OPEN" },
];

/* ───────────────── Helpers ───────────────── */

const money = (v: number) =>
  `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (v: number) => `${v >= 0 ? "+" : "-"}${money(v)}`;
const plTone = (v: number) => (v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400");

const TH = "px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground";
const TD = "px-4 py-3.5 text-sm font-medium tabular-nums";

const DirTag = ({ dir }: { dir: "BUY" | "SELL" }) => (
  <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider ${dir === "BUY" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
    {dir === "BUY" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
    {dir}
  </span>
);

function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-border/60 bg-muted/20 p-1">
      {options.map((o) => (
        <button
          key={o.key} type="button" onClick={() => onChange(o.key)} aria-pressed={value === o.key}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === o.key ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────────── Page ───────────────── */

export default function TradeHistoryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = TRADES.filter((t) =>
    filter === "all" ? true : filter === "winning" ? t.status === "WIN" : filter === "losing" ? t.status === "LOSS" : filter === "open" ? t.status === "OPEN" : t.status !== "OPEN");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-6 py-4">
        <div>
          <p
            className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}
          >
            [ // HISTORY ]
          </p>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight md:text-2xl">
            Trade{" "}
            <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">
              History
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All your executed trades and positions.
          </p>
        </div>

        <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
          <CardHeader className="flex flex-col gap-3 space-y-0 py-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-xl font-bold">Trade History</CardTitle>
            <div className="overflow-x-auto">
              <Segmented<Filter>
                value={filter} onChange={setFilter}
                options={[{ key: "all", label: "All" }, { key: "winning", label: "Winning" }, { key: "losing", label: "Losing" }, { key: "open", label: "Open" }, { key: "closed", label: "Closed" }]}
              />
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 960 }}>
              <thead>
                <tr className="border-y border-border/50 bg-muted/20">
                  {["Instrument", "Direction", "Entry", "Exit", "Opened", "Closed", "Net P/L", "Status"].map((h) => <th key={h} className={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">No trades match this filter.</td></tr>}
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className={TD}><div className="font-bold">{t.symbol}</div><div className="text-[10px] text-muted-foreground">{t.id}</div></td>
                    <td className={TD}><DirTag dir={t.dir} /></td>
                    <td className={TD}>{t.entry}</td>
                    <td className={TD}>{t.exit ?? "—"}</td>
                    <td className={TD}>{t.opened}</td>
                    <td className={TD}>{t.closed ?? "—"}</td>
                    <td className={`${TD} font-bold ${plTone(t.pl)}`}>{signed(t.pl)}</td>
                    <td className={TD}>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${
                        t.status === "WIN" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : t.status === "LOSS" ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300"}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          Leveraged trading and CFDs carry significant risk of loss. All figures shown are simulated sample data.
        </p>
      </div>
    </main>
  );
}
