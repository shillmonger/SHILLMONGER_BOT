"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IBM_Plex_Mono } from "next/font/google";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Microscope,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

/* ───────────────── Types ───────────────── */

interface EvaluationRow {
  id: string;
  signalChatId: number | null;
  signalMessageId: number | null;
  signalRefId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
  environment: "demo" | "live" | null;
  symbol: string | null;
  direction: string | null;
  groupName: string | null;
  orderType: string | null;
  eligible: boolean;
  stage: string | null;
  reason: string | null;
  executionId: string | null;
  evaluatedAt: string | null;
}

type EligibleFilter = "all" | "eligible" | "rejected";
type EnvFilter = "all" | "demo" | "live";

const PAGE_SIZE = 15;

/* ───────────────── Helpers ───────────────── */

const fmtDT = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
};

const DirTag = ({ dir }: { dir?: string | null }) => {
  if (!dir) return <span className="text-muted-foreground">—</span>;
  const isBuy = dir.toUpperCase() === "BUY";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider ${isBuy ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      {isBuy ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
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

export default function SignalEvaluationPage() {
  const [rows, setRows] = useState<EvaluationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [eligibleFilter, setEligibleFilter] = useState<EligibleFilter>("all");
  const [envFilter, setEnvFilter] = useState<EnvFilter>("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/signal-evaluations?limit=1000", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load signal evaluations");
      setRows(data.evaluations ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load signal evaluations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const stats = useMemo(() => {
    const eligible = rows.filter((r) => r.eligible).length;
    return { total: rows.length, eligible, rejected: rows.length - eligible };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (eligibleFilter === "eligible" && !r.eligible) return false;
      if (eligibleFilter === "rejected" && r.eligible) return false;
      if (envFilter !== "all" && r.environment !== envFilter) return false;
      if (!q) return true;
      return [
        r.userName,
        r.userEmail,
        r.symbol,
        r.groupName,
        r.stage,
        r.reason,
        r.signalMessageId != null ? String(r.signalMessageId) : null,
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, query, eligibleFilter, envFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
            [ // SIGNAL EVALUATION ]
          </p>
          <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight">
            Signal <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">Evaluation</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.total} evaluation{stats.total === 1 ? "" : "s"} — {stats.eligible} eligible, {stats.rejected} rejected.
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
            placeholder="Search user, symbol, group, stage or reason"
            className="h-10 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <select
          value={eligibleFilter}
          onChange={(e) => { setEligibleFilter(e.target.value as EligibleFilter); setPage(1); }}
          className={SELECT_CLS}
          aria-label="Filter by result"
        >
          <option value="all">All results</option>
          <option value="eligible">Eligible</option>
          <option value="rejected">Rejected</option>
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
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/20 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading evaluations…
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-violet-500/20">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
              <Microscope className="h-7 w-7" />
            </span>
            <p className="text-sm font-extrabold text-muted-foreground">No signal evaluations</p>
            <p className="text-xs text-muted-foreground">Per-user eligibility checks will appear here once signals are evaluated.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 1000 }}>
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className={TH}>User</th>
                  <th className={TH}>Signal</th>
                  <th className={TH}>Direction</th>
                  <th className={TH}>Group</th>
                  <th className={TH}>Result</th>
                  <th className={TH}>Stage</th>
                  <th className={TH}>Reason</th>
                  <th className={TH}>Evaluated at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-xs text-muted-foreground">
                      No evaluations match your filters.
                    </td>
                  </tr>
                ) : pageRows.map((r) => (
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
                      <div className="font-bold">{r.symbol ?? "—"}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        msg {r.signalMessageId ?? "—"}{r.environment ? ` · ${r.environment}` : ""}
                      </div>
                    </td>
                    <td className={TD}><DirTag dir={r.direction} /></td>
                    <td className={`${TD} max-w-[180px] font-bold text-xs truncate text-muted-foreground`}>{r.groupName ?? "—"}</td>
                    <td className={TD}>
                      {r.eligible ? (
                        <span className={`${plexMono.className} inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400`}>
                          <CheckCircle2 className="h-3 w-3" /> ELIGIBLE
                        </span>
                      ) : (
                        <span className={`${plexMono.className} inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-rose-600 dark:text-rose-400`}>
                          <XCircle className="h-3 w-3" /> REJECTED
                        </span>
                      )}
                    </td>
                    <td className={`${TD} font-mono text-xs text-muted-foreground`}>{r.stage ?? "—"}</td>
                    <td className={`${TD} max-w-[220px] truncate text-xs text-muted-foreground`} title={r.reason ?? undefined}>
                      {r.reason ?? "—"}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{fmtDT(r.evaluatedAt)}</td>
                  </tr>
                ))}
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
