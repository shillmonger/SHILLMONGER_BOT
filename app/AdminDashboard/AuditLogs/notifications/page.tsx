"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { IBM_Plex_Mono } from "next/font/google";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
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

interface NotificationRow {
  id: string;
  createdAt: string;
  actor: "user" | "admin" | "system";
  actorName: string | null;
  type: string;
  category: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  source: string | null;
  seen: boolean;
  status: "unseen" | "seen";
  user: {
    id: string;
    userName: string;
    email: string;
    avatar: string | null;
    role: string;
  } | null;
}

const PAGE_SIZE = 15;

/* ───────────────── Helpers ───────────────── */

type Tone = "green" | "amber" | "red" | "gray" | "blue" | "violet";

const toneFor = (key: string): Tone => {
  const k = key.toLowerCase();
  if (/closed|connected|enabled|verified|registered|login|opened/.test(k)) return "green";
  if (/failed|rejected|deleted|disabled|cancelled|disconnect/.test(k)) return "red";
  if (/paused|stopped|pending|placed|requested|updated/.test(k)) return "amber";
  if (/admin|system/.test(k)) return "violet";
  return "blue";
};

const Badge = ({ text, tone }: { text: string; tone: Tone }) => (
  <span className={`${plexMono.className} inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
    tone === "green"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "red"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : tone === "violet"
            ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"
            : tone === "blue"
              ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
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

const CATEGORIES = ["all", "auth", "account", "trading", "broker", "admin", "system"];
const ACTORS = ["all", "user", "admin", "system"];

export default function NotificationsPage() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [actor, setActor] = useState("all");
  const [page, setPage] = useState(1);
  const setMainLoading = useMainContentLoading();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "1000" });
      if (category !== "all") params.set("category", category);
      if (actor !== "all") params.set("actor", actor);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/admin/notifications?${params}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load notifications");
      setRows(data.notifications ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [category, actor, query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setMainLoading(loading);
  }, [loading, setMainLoading]);

  useEffect(() => () => setMainLoading(false), [setMainLoading]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
            [ // ACTIVITY FEED ]
          </p>
          <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight">
            Site <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">Notifications</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} event{rows.length === 1 ? "" : "s"} recorded — registrations, bot actions, trades, broker and admin activity.
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
            placeholder="Search user, message or event type"
            className="h-10 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className={`${SELECT_CLS} flex-1 sm:flex-none`}
          aria-label="Filter by category"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All categories" : c.toUpperCase()}</option>
          ))}
        </select>
        <select
          value={actor}
          onChange={(e) => { setActor(e.target.value); setPage(1); }}
          className={`${SELECT_CLS} flex-1 sm:flex-none`}
          aria-label="Filter by actor"
        >
          {ACTORS.map((a) => (
            <option key={a} value={a}>{a === "all" ? "All actors" : a.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <ShillmongerLoader className="w-full max-w-md" label="Loading notifications" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-violet-500/20">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
              <Bell className="h-7 w-7" />
            </span>
            <p className="text-sm font-extrabold text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground">User and admin actions across the site will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed" style={{ minWidth: 1080 }}>
              <colgroup>
                <col style={{ width: "17%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "30%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className={TH}>User</th>
                  <th className={TH}>Actor</th>
                  <th className={TH}>Event</th>
                  <th className={TH}>Category</th>
                  <th className={`${TH} text-right`}>Time</th>
                  <th className={TH}>Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {pageRows.map((n) => (
                  <tr key={n.id} className="transition-colors hover:bg-muted/30">
                    <td className={TD}>
                      {n.user ? (
                        <div className="flex items-center gap-3">
                          <Avatar name={n.user.userName} src={n.user.avatar} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold" title={n.user.userName}>{n.user.userName}</p>
                            <p className="truncate text-xs text-muted-foreground" title={n.user.email}>{n.user.email}</p>
                          </div>
                        </div>
                      ) : (
                        <span className={`${plexMono.className} text-xs text-muted-foreground`}>— system —</span>
                      )}
                    </td>
                    <td className={TD}>
                      <Badge
                        text={n.actor.toUpperCase()}
                        tone={n.actor === "admin" ? "violet" : n.actor === "system" ? "gray" : "blue"}
                      />
                      {n.actorName && n.actor !== "user" && (
                        <p className="mt-1 truncate text-[10px] text-muted-foreground" title={n.actorName}>{n.actorName}</p>
                      )}
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge text={n.type} tone={toneFor(n.type)} />
                        {!n.seen && <Badge text="UNSEEN" tone="amber" />}
                      </div>
                    </td>
                    <td className={TD}>
                      <Badge text={n.category.toUpperCase()} tone="gray" />
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right text-muted-foreground`}>
                      {fmtDate(n.createdAt)}
                    </td>
                    <td className={TD}>
                      <p className="text-xs font-semibold leading-snug">{n.title}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{n.message}</p>
                      {n.metadata && Object.keys(n.metadata).length > 0 && (
                        <details className="mt-1">
                          <summary className={`${plexMono.className} cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-violet-600 hover:text-violet-500 dark:text-violet-400`}>
                            metadata
                          </summary>
                          <pre className={`${plexMono.className} mt-1 max-h-32 overflow-auto rounded-md border border-border/50 bg-muted/30 p-2 text-[10px] leading-relaxed`}>
                            {JSON.stringify(n.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* footer / pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
            <span>
              {rows.length === 0 ? "0 results" : `${start + 1} to ${Math.min(start + PAGE_SIZE, rows.length)} of ${rows.length}`}
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
