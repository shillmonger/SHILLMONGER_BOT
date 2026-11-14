"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IBM_Plex_Mono } from "next/font/google";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  ListChecks,
  RefreshCw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ShillmongerLoader from "@/components/ShillmongerLoader";
import { useMainContentLoading } from "@/components/UserDashboard/MainContentLoading";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

/* ───────────────── Types ───────────────── */

interface ExecutionRow {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
  environment: "demo" | "live" | null;
  chatId: number | null;
  messageId: number | null;
  signalId: string | null;
  symbol: string | null;
  groupName: string | null;
  provider: {
    groupId: string;
    groupName: string;
    profileImage: string | null;
    isActive: boolean;
  } | null;
  orderType: string | null;
  epic: string | null;
  direction: "BUY" | "SELL" | null;
  size: number | null;
  entryLevel: number | null;
  stopLevel: number | null;
  takeProfitLevel: number | null;
  dealId: string | null;
  status: string | null;
  error: string | null;
  realizedPnl: number | null;
  unrealizedPnl: number | null;
  openedAt: string | null;
  closedAt: string | null;
  confirmedAt: string | null;
  createdAt: string | null;
}

type StatusFilter = "all" | "open" | "closed" | "failed";
type EnvFilter = "all" | "demo" | "live";

const PAGE_SIZE = 15;

/* ───────────────── Helpers ───────────────── */

const money = (v: number) =>
  `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (v: number) => `${v >= 0 ? "+" : "-"}${money(v)}`;
const plTone = (v: number) => (v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400");

const fmtDT = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
};

const isOpenStatus = (s?: string | null) =>
  s === "open" || s === "submitted" || s === "pending";
const isFailedStatus = (s?: string | null) =>
  s === "rejected" || s === "failed" || s === "cancelled";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: "OPEN", cls: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  submitted: { label: "SUBMITTED", cls: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300" },
  pending: { label: "PENDING", cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  closed: { label: "CLOSED", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "REJECTED", cls: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  failed: { label: "FAILED", cls: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  cancelled: { label: "CANCELLED", cls: "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300" },
};

const Badge = ({ status }: { status?: string | null }) => {
  const key = (status ?? "").toLowerCase();
  const meta = STATUS_META[key] ?? { label: (status ?? "—").toUpperCase(), cls: "border-border/60 bg-muted/30 text-muted-foreground" };
  return (
    <span className={`${plexMono.className} inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider ${meta.cls}`}>
      {meta.label}
    </span>
  );
};

const DirTag = ({ dir }: { dir?: "BUY" | "SELL" | null }) => {
  if (!dir) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider ${dir === "BUY" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      {dir === "BUY" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {dir}
    </span>
  );
};

function Avatar({ name, src }: { name: string; src?: string | null }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().slice(0, 2).toUpperCase() || "?";
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className="h-9 w-9 shrink-0 rounded-full border border-violet-500/20 object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-600 text-xs font-bold text-white">
      {initials}
    </span>
  );
}

const SELECT_CLS =
  "h-10 rounded-lg border border-border/60 bg-card px-3 text-xs font-semibold outline-none transition-colors hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20";

const TH = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap";
const TD = "px-4 py-3 align-middle text-sm";

/* ───────────────── Page ───────────────── */

export default function TradeExecutionsPage() {
  const [rows, setRows] = useState<ExecutionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [envFilter, setEnvFilter] = useState<EnvFilter>("all");
  const [page, setPage] = useState(1);
  const setMainLoading = useMainContentLoading();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/trade-executions?limit=1000", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load trade executions");
      setRows(data.executions ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load trade executions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // Keep the layout loader visible while executions are loading.
  useEffect(() => {
    setMainLoading(loading);
  }, [loading, setMainLoading]);

  useEffect(() => () => setMainLoading(false), [setMainLoading]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (envFilter !== "all" && r.environment !== envFilter) return false;
      if (statusFilter === "open" && !isOpenStatus(r.status)) return false;
      if (statusFilter === "closed" && !(r.status === "closed")) return false;
      if (statusFilter === "failed" && !isFailedStatus(r.status)) return false;
      if (!q) return true;
      return [
        r.userName,
        r.userEmail,
        r.symbol,
        r.epic,
        r.groupName,
        r.provider?.groupName,
        r.dealId,
        r.orderType,
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, query, statusFilter, envFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
            [ // TRADE EXECUTIONS ]
          </p>
          <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight">
            Trade <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">Executions</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} execution{rows.length === 1 ? "" : "s"} across all users — newest first.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void load()}
          className="h-9 gap-2 rounded-lg border-violet-500/40 text-xs font-semibold"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* toolbar */}
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search user, symbol, group or deal ID"
            className="h-10 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
          className={SELECT_CLS}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="failed">Failed / rejected</option>
        </select>
        <select
          value={envFilter}
          onChange={(e) => { setEnvFilter(e.target.value as EnvFilter); setPage(1); }}
          className={SELECT_CLS}
          aria-label="Filter by environment"
        >
          <option value="all">All environments</option>
          <option value="demo">Demo</option>
          <option value="live">Live</option>
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <ShillmongerLoader className="w-full max-w-md" label="Loading executions" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-violet-500/20">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
              <ListChecks className="h-7 w-7" />
            </span>
            <p className="text-sm font-extrabold text-muted-foreground">No trade executions</p>
            <p className="text-xs text-muted-foreground">Trades submitted by the bot will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 1100 }}>
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className={TH}>User</th>
                  <th className={TH}>Signal Group</th>
                  <th className={TH}>Instrument</th>
                  <th className={TH}>Direction</th>
                  <th className={TH}>Entry</th>
                  <th className={TH}>Size</th>
                  <th className={TH}>P/L</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Opened</th>
                  <th className={TH}>Closed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-xs text-muted-foreground">
                      No executions match your filters.
                    </td>
                  </tr>
                ) : pageRows.map((r) => {
                  const pnl = isOpenStatus(r.status) ? r.unrealizedPnl : r.realizedPnl;
                  const groupName = r.groupName ?? r.provider?.groupName ?? null;
                  const groupImage = r.provider?.profileImage ?? null;
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-muted/30">
                      <td className={TD}>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.userName ?? r.userEmail ?? "?"} src={r.userAvatar} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{r.userName ?? "Unknown user"}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.userEmail ?? r.userId ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className={TD}>
                        {groupName || r.chatId != null ? (
                          <div className="flex items-center gap-3">
                            {groupImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={groupImage} alt={groupName ?? "group"} className="h-8 w-8 shrink-0 rounded-full border border-violet-500/20 object-cover" />
                            ) : (
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border/60 text-muted-foreground">
                                <HelpCircle className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold">{groupName ?? "Unknown group"}</p>
                              <p className="truncate text-xs text-muted-foreground">{r.chatId ?? "—"}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className={TD}>
                        <div className="font-bold">{r.symbol ?? r.epic ?? "—"}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {r.orderType ?? ""}{r.environment ? ` · ${r.environment}` : ""}
                        </div>
                      </td>
                      <td className={TD}><DirTag dir={r.direction} /></td>
                      <td className={`${TD} tabular-nums`}>{r.entryLevel ?? "—"}</td>
                      <td className={`${TD} tabular-nums`}>{r.size ?? "—"}</td>
                      <td className={`${TD} font-bold tabular-nums ${pnl == null ? "text-muted-foreground" : plTone(pnl)}`}>
                        {pnl == null ? "—" : signed(pnl)}
                      </td>
                      <td className={TD}><Badge status={r.status} /></td>
                      <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{fmtDT(r.openedAt ?? r.createdAt)}</td>
                      <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{fmtDT(r.closedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* footer / pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
            <span>
              {filtered.length === 0 ? "0 results" : `${start + 1} to ${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                aria-label="Previous page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 transition-colors hover:bg-violet-500/10 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[88px] text-center font-semibold">Page {safePage} of {totalPages}</span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                aria-label="Next page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 transition-colors hover:bg-violet-500/10 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
