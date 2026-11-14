"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { IBM_Plex_Mono } from "next/font/google";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Info,
  RefreshCw,
  Search,
  Users,
  X,
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

interface PersonRef {
  id: string;
  userName: string;
  email: string;
  avatar: string | null;
  role: string;
}

interface NotificationRow {
  id: string;
  createdAt: string;
  actor: "user" | "admin" | "system";
  actorId: string | null;
  actorName: string | null;
  actorUser: PersonRef | null;
  type: string;
  category: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  source: string | null;
  seen: boolean;
  status: "unseen" | "seen";
  seenAt: string | null;
  user: PersonRef | null;
}

const PAGE_SIZE = 20;

/* ───────────────── Helpers ───────────────── */

type Tone = "green" | "amber" | "red" | "gray" | "blue" | "violet";

const toneFor = (key: string): Tone => {
  const k = key.toLowerCase();
  if (/closed|connected|enabled|verified|registered|login|opened/.test(k)) return "green";
  if (/failed|rejected|deleted|disabled|cancelled|disconnect/.test(k)) return "red";
  if (/paused|stopped|pending|placed|requested|updated|seen/.test(k)) return "amber";
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
  "h-10 cursor-pointer rounded-lg border border-border/60 bg-card px-3 text-xs font-semibold outline-none transition-colors hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20";

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

function PersonCell({ person, fallback }: { person: PersonRef | null; fallback: string }) {
  if (!person) {
    return <span className={`${plexMono.className} text-xs text-muted-foreground`}>{fallback}</span>;
  }
  return (
    <div className="flex items-center gap-3">
      <Avatar name={person.userName} src={person.avatar} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-bold" title={person.userName}>
          {person.userName}
          {person.role === "admin" && (
            <span className={`${plexMono.className} rounded border border-violet-500/30 bg-violet-500/10 px-1 py-px text-[8px] font-bold uppercase text-violet-600 dark:text-violet-400`}>
              admin
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={person.email}>{person.email}</p>
      </div>
    </div>
  );
}

/* ───────────────── Page ───────────────── */

const TH = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap";
const TD = "px-4 py-3 align-middle text-sm";

const CATEGORIES = ["all", "auth", "account", "trading", "broker", "admin", "system"];
const ACTORS = ["all", "user", "admin", "system"];
const PAGE_LIMIT = 500;

export default function AdminNotificationsPage() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [query, setQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [actor, setActor] = useState("all");
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<NotificationRow | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setMainLoading = useMainContentLoading();

  const buildParams = useCallback(
    (before?: string) => {
      const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
      if (before) params.set("before", before);
      if (category !== "all") params.set("category", category);
      if (actor !== "all") params.set("actor", actor);
      if (query.trim()) params.set("q", query.trim());
      if (userQuery.trim()) params.set("user", userQuery.trim());
      return params;
    },
    [category, actor, query, userQuery]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/notifications?${buildParams()}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load notifications");
      setRows(data.notifications ?? []);
      setTotal(typeof data.total === "number" ? data.total : (data.notifications ?? []).length);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Debounced reload when filters change.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      void load();
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [load]);

  useEffect(() => {
    setMainLoading(loading);
  }, [loading, setMainLoading]);

  useEffect(() => () => setMainLoading(false), [setMainLoading]);

  const loadMore = async () => {
    const oldest = rows[rows.length - 1]?.createdAt;
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/admin/notifications?${buildParams(oldest)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load more");
      const incoming = (data.notifications ?? []) as NotificationRow[];
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...incoming.filter((r) => !seen.has(r.id))];
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const visible = useMemo(
    () => (unseenOnly ? rows.filter((r) => r.status !== "seen") : rows),
    [rows, unseenOnly]
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = visible.slice(start, start + PAGE_SIZE);

  const unseenTotal = rows.filter((r) => r.status !== "seen").length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
            [ // SITE-WIDE ACTIVITY ]
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold uppercase tracking-tight">
            <Bell className="h-6 w-6 text-violet-500" /> All Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total.toLocaleString()} event{total === 1 ? "" : "s"} across all users — who did what, and when.
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
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search message or event type"
            className="h-10 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <div className="relative min-w-[180px] flex-1 sm:max-w-[240px]">
          <Users className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Filter by user (name/email)"
            className="h-10 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${SELECT_CLS} flex-1 sm:flex-none`}
          aria-label="Filter by category"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All categories" : c.toUpperCase()}</option>
          ))}
        </select>
        <select
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className={`${SELECT_CLS} flex-1 sm:flex-none`}
          aria-label="Filter by actor"
        >
          {ACTORS.map((a) => (
            <option key={a} value={a}>{a === "all" ? "All actors" : a.toUpperCase()}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setUnseenOnly((v) => !v)}
          className={`flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
            unseenOnly
              ? "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "border-border/60 bg-card text-muted-foreground hover:border-violet-500/40 hover:text-foreground"
          }`}
        >
          {unseenOnly ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          Unseen{unseenTotal > 0 ? ` (${unseenTotal})` : ""}
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <ShillmongerLoader className="w-full max-w-md" label="Loading notifications" />
        </div>
      ) : visible.length === 0 ? (
        <Card className="border-violet-500/20">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
              <Bell className="h-7 w-7" />
            </span>
            <p className="text-sm font-extrabold text-muted-foreground">No notifications found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed" style={{ minWidth: 1200 }}>
                <colgroup>
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "21%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className={TH}>User</th>
                    <th className={TH}>Actor</th>
                    <th className={TH}>Event</th>
                    <th className={TH}>Category</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-right`}>Time</th>
                    <th className={`${TH} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {pageRows.map((n) => (
                    <tr key={n.id} className={`transition-colors hover:bg-muted/30 ${n.status !== "seen" ? "bg-amber-500/[0.03]" : ""}`}>
                      <td className={TD}>
                        <PersonCell person={n.user} fallback="— system —" />
                      </td>
                      <td className={TD}>
                        <PersonCell person={n.actorUser} fallback={n.actorName ?? n.actor.toUpperCase()} />
                      </td>
                      <td className={TD}>
                        <Badge text={n.type} tone={toneFor(n.type)} />
                      </td>
                      <td className={TD}>
                        <Badge text={n.category.toUpperCase()} tone="gray" />
                      </td>
                      <td className={TD}>
                        <Badge
                          text={n.status === "seen" ? "SEEN" : "UNSEEN"}
                          tone={n.status === "seen" ? "gray" : "amber"}
                        />
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right text-muted-foreground`}>
                        {fmtDate(n.createdAt)}
                      </td>
                      <td className={`${TD} text-right`}>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setSelected(n)}
                            title="View full details"
                            aria-label="View full details"
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-600 transition-colors hover:bg-violet-500/20 dark:text-violet-400"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* footer / pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
              <span>
                {visible.length === 0
                  ? "0 results"
                  : `${start + 1} to ${Math.min(start + PAGE_SIZE, visible.length)} of ${visible.length} loaded (${total.toLocaleString()} total)`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                  aria-label="Previous page"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border/60 transition-colors hover:bg-violet-500/10 disabled:pointer-events-none disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[88px] text-center font-semibold">Page {safePage} of {totalPages}</span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                  aria-label="Next page"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border/60 transition-colors hover:bg-violet-500/10 disabled:pointer-events-none disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>

          {rows.length < total && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="h-9 gap-2 rounded-lg border-violet-500/40 text-xs font-semibold"
              >
                {loadingMore ? "Loading…" : `Load more (${rows.length.toLocaleString()} / ${total.toLocaleString()})`}
              </Button>
            </div>
          )}
        </>
      )}

      {/* ───────── Slide-out detail panel ───────── */}
      {selected && (
        <div className="fixed inset-0 z-[100]">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelected(null)}
          />
          {/* panel */}
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-violet-500/20 bg-background shadow-2xl animate-in slide-in-from-right duration-300">
            {/* header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p className={`${plexMono.className} text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
                  [ // EVENT DETAILS ]
                </p>
                <h2 className="mt-1 truncate text-base font-extrabold tracking-tight">{selected.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close details"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-violet-500/10 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* body */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge text={selected.type} tone={toneFor(selected.type)} />
                <Badge text={selected.category.toUpperCase()} tone="gray" />
                <Badge
                  text={selected.status === "seen" ? "SEEN" : "UNSEEN"}
                  tone={selected.status === "seen" ? "gray" : "amber"}
                />
                <Badge text={selected.actor.toUpperCase()} tone={selected.actor === "admin" ? "violet" : "blue"} />
              </div>

              {/* message */}
              <section>
                <p className={`${plexMono.className} mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70`}>
                  Message
                </p>
                <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed">{selected.message}</p>
              </section>

              {/* who performed it */}
              <section>
                <p className={`${plexMono.className} mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70`}>
                  Performed by
                </p>
                {selected.actor === "system" ? (
                  <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
                    System / automated process
                  </p>
                ) : (
                  <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                    <PersonCell person={selected.actorUser} fallback={selected.actorName ?? selected.actor} />
                    {selected.actorId && (
                      <p className={`${plexMono.className} mt-1.5 truncate text-[10px] text-muted-foreground/70`} title={selected.actorId}>
                        actor id: {selected.actorId}
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* affected user */}
              <section>
                <p className={`${plexMono.className} mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70`}>
                  Affected user
                </p>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                  {selected.user ? (
                    <PersonCell person={selected.user} fallback="—" />
                  ) : (
                    <p className="text-sm text-muted-foreground">Platform-level event (no user)</p>
                  )}
                </div>
              </section>

              {/* timestamps + source */}
              <section className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <p className={`${plexMono.className} flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground`}>
                    <Clock className="h-3 w-3" /> Occurred
                  </p>
                  <p className="mt-1 text-xs font-bold">{fmtDate(selected.createdAt)}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <p className={`${plexMono.className} flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground`}>
                    <Eye className="h-3 w-3" /> Seen at
                  </p>
                  <p className="mt-1 text-xs font-bold">{selected.status === "seen" ? fmtDate(selected.seenAt) : "—"}</p>
                </div>
              </section>

              {selected.source && (
                <section>
                  <p className={`${plexMono.className} mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70`}>
                    Source
                  </p>
                  <p className={`${plexMono.className} rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground`}>
                    {selected.source}
                  </p>
                </section>
              )}

              {/* metadata */}
              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <section>
                  <p className={`${plexMono.className} mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70`}>
                    Metadata
                  </p>
                  <pre className={`${plexMono.className} max-h-64 overflow-auto rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] leading-relaxed`}>
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </section>
              )}

              {/* raw ids */}
              <section>
                <p className={`${plexMono.className} mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70`}>
                  Record
                </p>
                <p className={`${plexMono.className} truncate rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground`} title={selected.id}>
                  id: {selected.id}
                </p>
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
