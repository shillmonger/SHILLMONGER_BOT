"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Radio,
  RefreshCw,
  Loader2,
  AlertCircle,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Hash,
  Clock,
  Target,
  ShieldAlert,
} from "lucide-react";

// Shape of a signal document returned by the Python bot API
interface Signal {
  _id: string;
  chat_id: number;
  message_id: number;
  group_name: string;
  symbol: string;
  direction: "BUY" | "SELL" | string;
  order_type?: string;
  entry: number;
  entry_high?: number | null;
  entry_low?: number | null;
  stop_loss: number;
  take_profits: number[];
  raw_message?: string;
  confidence?: number;
  timestamp?: string | null;
  status: string;
  ingested_at?: string;
}

const LIMIT_OPTIONS = [25, 50, 100, 200];

function DirectionBadge({ direction }: { direction: string }) {
  const isBuy = direction === "BUY";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
        isBuy
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
      }`}
    >
      {isBuy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {direction}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  const cls =
    s === "RECEIVED"
      ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
      : "border-border/60 bg-muted/60 text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${cls}`}>
      {status || "unknown"}
    </span>
  );
}

function fmtPrice(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function AdminSignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters — only params the Python API supports: limit, symbol, direction, status
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(50);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (symbol.trim()) params.set("symbol", symbol.trim());
      if (direction) params.set("direction", direction);
      if (status.trim()) params.set("status", status.trim());

      const response = await fetch(`/api/admin/signals?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.detail || "Failed to load signals");
        setSignals([]);
        return;
      }
      setSignals(data.signals || []);
      setTotal(typeof data.total === "number" ? data.total : null);
    } catch {
      setError("Could not reach the bot service. Make sure the Python API is running.");
      setSignals([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, direction, status, limit]);

  useEffect(() => {
    // Deferred so the fetch (and its loading-state update) does not run
    // synchronously inside the effect body
    const timer = setTimeout(fetchSignals, 0);
    return () => clearTimeout(timer);
  }, [fetchSignals]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <main className="mx-auto w-full max-w-7xl py-5 lg:py-5">

        {/* HEADER */}
        <div className="mb-5 flex flex-col gap-4 border-b border-border/60 pb-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Telegram Signal Monitoring
            </p>
            <h1 className="flex items-center gap-2.5 text-2xl font-mono font-black uppercase tracking-tight">
              <Radio className="h-5 w-5 text-[#D4AF37]" />
              Signals
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {total !== null && (
              <span className="rounded-full border border-border/60 bg-muted/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {total} stored
              </span>
            )}
            <Button
              variant="outline"
              onClick={fetchSignals}
              disabled={loading}
              className="h-9 rounded-lg border-border/60 text-xs font-black uppercase tracking-widest"
            >
              {loading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {/* FILTERS — mirrors the Python API query params exactly */}
        <Card className="mb-5 overflow-hidden rounded-2xl border-border/60 shadow-sm">
          <CardContent className="px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-40 flex-1">
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Symbol
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="e.g. XAUUSDm"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border/60 bg-muted/60 pl-9 pr-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="w-36">
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Direction
                </label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border/60 bg-muted/60 px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                >
                  <option value="">All</option>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>

              <div className="min-w-32 flex-1">
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Status
                </label>
                <input
                  type="text"
                  placeholder="e.g. RECEIVED"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border/60 bg-muted/60 px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>

              <div className="w-28">
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Limit
                </label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="h-9 w-full rounded-lg border border-border/60 bg-muted/60 px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                >
                  {LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SIGNALS TABLE */}
        <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
          <CardContent className="px-0 py-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="text-sm font-bold text-muted-foreground">Loading signals...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <AlertCircle className="h-10 w-10 text-red-500" />
                <p className="text-sm font-bold text-muted-foreground">{error}</p>
                <Button
                  variant="outline"
                  onClick={fetchSignals}
                  className="mt-2 h-8 rounded-lg border-border/60 text-xs font-black uppercase tracking-widest"
                >
                  Retry
                </Button>
              </div>
            ) : signals.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <Radio className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-bold text-muted-foreground">No signals found</p>
                <p className="text-[10px] text-muted-foreground">
                  Validated signals from authorized Telegram groups will appear here
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-border/60 bg-muted/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Symbol</th>
                      <th className="px-4 py-3">Direction</th>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3 text-right">Entry</th>
                      <th className="px-4 py-3 text-right">Stop Loss</th>
                      <th className="px-4 py-3 text-right">TPs</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {signals.map((signal) => {
                      const expanded = expandedId === signal._id;
                      return (
                        <Fragment key={signal._id}>
                          <tr
                            onClick={() => setExpandedId(expanded ? null : signal._id)}
                            className="cursor-pointer transition-colors hover:bg-muted/40"
                          >
                            <td className="px-4 py-3">
                              <span className="font-mono text-sm font-bold">{signal.symbol}</span>
                            </td>
                            <td className="px-4 py-3">
                              <DirectionBadge direction={signal.direction} />
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-mono text-muted-foreground">
                                {signal.order_type || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-mono text-sm">{fmtPrice(signal.entry)}</span>
                              {(signal.entry_high != null || signal.entry_low != null) && (
                                <span className="block text-[9px] font-mono text-muted-foreground">
                                  {fmtPrice(signal.entry_low)} – {fmtPrice(signal.entry_high)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-mono text-sm text-red-500">{fmtPrice(signal.stop_loss)}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-mono text-sm">{signal.take_profits?.length ?? 0}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="block max-w-40 truncate text-xs font-semibold">
                                {signal.group_name || "Unknown"}
                              </span>
                              <span className="block text-[9px] font-mono text-muted-foreground">
                                chat {signal.chat_id}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {fmtTime(signal.timestamp || signal.ingested_at)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={signal.status} />
                            </td>
                            <td className="px-4 py-3">
                              {expanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </td>
                          </tr>
                          {expanded && (
                            <tr className="bg-muted/20">
                              <td colSpan={10} className="px-4 py-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
                                      <span className="flex items-center gap-1.5 text-muted-foreground">
                                        <Hash className="h-3 w-3" /> msg {signal.message_id}
                                      </span>
                                      <span className="flex items-center gap-1.5 text-muted-foreground">
                                        <Target className="h-3 w-3" /> confidence {signal.confidence ?? "—"}
                                      </span>
                                      <span className="flex items-center gap-1.5 text-muted-foreground">
                                        <ShieldAlert className="h-3 w-3" /> status {signal.status}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        Take Profits
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {(signal.take_profits || []).map((tp, i) => (
                                          <span
                                            key={i}
                                            className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400"
                                          >
                                            TP{i + 1}: {fmtPrice(tp)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                      <MessageSquare className="h-3 w-3" /> Raw Message
                                    </p>
                                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                                      {signal.raw_message || "—"}
                                    </pre>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
