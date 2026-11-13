"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IBM_Plex_Mono } from "next/font/google";
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

/* ───────────────── Types ───────────────── */

interface LogRow {
  id: string;
  chatId: string;
  messageId: number | null;
  processedAt: string | null;
  provider: {
    groupId: string;
    groupName: string;
    profileImage: string | null;
    isActive: boolean;
  } | null;
}

const PAGE_SIZE = 15;

/* ───────────────── Helpers ───────────────── */

const Badge = ({ text, tone }: { text: string; tone: "green" | "amber" | "red" | "gray" }) => (
  <span className={`${plexMono.className} inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
    tone === "green"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "red"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-border/60 bg-muted/30 text-muted-foreground"
  }`}>
    {text}
  </span>
);

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

const SELECT_CLS =
  "h-10 rounded-lg border border-border/60 bg-card px-3 text-xs font-semibold outline-none transition-colors hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20";

/* ───────────────── Avatar ───────────────── */

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

/* ───────────────── Page ───────────────── */

const TH = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap";
const TD = "px-4 py-3 align-middle text-sm";

export default function ProcessedLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/processed-logs", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load logs");
      setLogs(data.logs ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  /* provider options for the filter */
  const providers = useMemo(() => {
    const map = new Map<string, { name: string; image: string | null }>();
    logs.forEach((l) => {
      if (l.provider) map.set(l.provider.groupId, { name: l.provider.groupName, image: l.provider.profileImage });
    });
    return [...map.entries()].map(([id, p]) => ({ id, ...p }));
  }, [logs]);

  /* filtering + pagination */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (providerFilter !== "all" && l.chatId !== providerFilter) return false;
      if (!q) return true;
      return [
        l.provider?.groupName,
        l.chatId,
        l.messageId != null ? String(l.messageId) : null,
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [logs, query, providerFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
            [ // AUDIT LOGS ]
          </p>
          <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight">
            Processed <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">Logs</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {logs.length} Telegram message{logs.length === 1 ? "" : "s"} processed by the signal worker — newest first.
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
            placeholder="Search provider, chat ID or message ID"
            className="h-10 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <select
          value={providerFilter}
          onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
          className={`${SELECT_CLS} flex-1 sm:flex-none`}
          aria-label="Filter by provider"
        >
          <option value="all">All providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/20 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading logs…
        </div>
      ) : logs.length === 0 ? (
        <Card className="border-violet-500/20">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
              <MessageSquareText className="h-7 w-7" />
            </span>
            <p className="text-sm font-extrabold text-muted-foreground">No processed messages</p>
            <p className="text-xs text-muted-foreground">Messages handled by the Telegram worker will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 760 }}>
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className={TH}>Provider</th>
                  <th className={TH}>Chat ID</th>
                  <th className={TH}>Message ID</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Processed at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-xs text-muted-foreground">
                      No logs match your filters.
                    </td>
                  </tr>
                ) : rows.map((l) => (
                  <tr key={l.id} className="transition-colors hover:bg-muted/30">
                    <td className={TD}>
                      {l.provider ? (
                        <div className="flex items-center gap-3">
                          <Avatar name={l.provider.groupName} src={l.provider.profileImage} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{l.provider.groupName}</p>
                            <p className="truncate text-xs text-muted-foreground">{l.provider.groupId}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border/60 text-muted-foreground">
                            <HelpCircle className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-muted-foreground">Unknown provider</p>
                            <p className="truncate text-xs text-muted-foreground">{l.chatId}</p>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className={`${TD} font-mono text-xs text-muted-foreground`}>{l.chatId}</td>
                    <td className={`${TD} font-mono text-xs font-semibold`}>{l.messageId ?? "—"}</td>
                    <td className={TD}>
                      {l.provider ? (
                        <Badge
                          text={l.provider.isActive ? "ACTIVE" : "INACTIVE"}
                          tone={l.provider.isActive ? "green" : "gray"}
                        />
                      ) : (
                        <Badge text="UNLINKED" tone="amber" />
                      )}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{fmtDate(l.processedAt)}</td>
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
