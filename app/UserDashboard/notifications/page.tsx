"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IBM_Plex_Mono } from "next/font/google";
import {
  Bell,
  Bot,
  CheckCheck,
  Eye,
  EyeOff,
  Landmark,
  LogIn,
  Rocket,
  Settings2,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import ShillmongerLoader from "@/components/ShillmongerLoader";
import { useMainContentLoading } from "@/components/UserDashboard/MainContentLoading";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

/* ───────────────── Types (mirrors NOTIFICATIONS docs) ───────────────── */

type Category = "auth" | "account" | "trading" | "broker" | "admin" | "system";

interface AppNotification {
  id: string;
  type: string;
  category: Category;
  actor: "user" | "admin" | "system";
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  source: string | null;
  seen: boolean;
  status: "unseen" | "seen";
  seenAt: string | null;
  createdAt: string; // ISO
}

/* ───────────────── Helpers ───────────────── */

const CATEGORY_META: Record<Category, { label: string; icon: React.ElementType; cls: string }> = {
  trading: { label: "Trading", icon: TrendingUp, cls: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  broker: { label: "Broker", icon: Landmark, cls: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  account: { label: "Account", icon: UserRound, cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  auth: { label: "Auth", icon: LogIn, cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  admin: { label: "Admin", icon: Settings2, cls: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  system: { label: "System", icon: Zap, cls: "border-border/60 bg-muted/30 text-muted-foreground" },
};

function typeIcon(n: AppNotification) {
  if (n.type.startsWith("trade.")) return TrendingUp;
  if (n.type.startsWith("bot.")) return Bot;
  if (n.type.startsWith("broker.")) return Landmark;
  if (n.type.startsWith("user.")) return Rocket;
  if (n.type.startsWith("account.")) return Settings2;
  if (n.type.startsWith("admin.")) return Bell;
  return Bell;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* ───────────────── Page ───────────────── */

const FILTERS: { key: Category | "all" | "unseen"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unseen", label: "Unseen" },
  { key: "trading", label: "Trading" },
  { key: "broker", label: "Broker" },
  { key: "account", label: "Account" },
  { key: "auth", label: "Auth" },
  { key: "admin", label: "Admin" },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | "all" | "unseen">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const setMainLoading = useMainContentLoading();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/notifications?limit=200", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load notifications");
      setNotifications(data.notifications ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setMainLoading(loading);
  }, [loading, setMainLoading]);

  useEffect(() => () => setMainLoading(false), [setMainLoading]);

  const filtered = useMemo(
    () =>
      notifications.filter((n) => {
        if (filter === "unseen") return !n.seen;
        if (filter !== "all") return n.category === filter;
        return true;
      }),
    [notifications, filter]
  );

  // Group consecutive items by day for section headers.
  const groups = useMemo(() => {
    const out: { label: string; items: AppNotification[] }[] = [];
    for (const n of filtered) {
      const label = dayLabel(n.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [filtered]);

  const unseenCount = notifications.filter((n) => !n.seen).length;

  const markSeen = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.seen || busyId) return;
    setBusyId(id);
    // Optimistic update.
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, seen: true, seenAt: new Date().toISOString() } : n))
    );
    try {
      const res = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to mark as seen");
    } catch {
      // Roll back on failure.
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, seen: target.seen, seenAt: target.seenAt } : n))
      );
      toast.error("Failed to mark notification as seen");
    } finally {
      setBusyId(null);
    }
  };

  const markAllSeen = async () => {
    if (markingAll || unseenCount === 0) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, seen: true, seenAt: now })));
    try {
      const res = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error("Failed to mark all as seen");
    } catch {
      toast.error("Failed to mark all as seen — refreshing");
      void load();
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
            [ // ACTIVITY ]
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold uppercase tracking-tight">
             Notifications
            {/* {unseenCount > 0 && (
              <span className={`${plexMono.className} rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-400`}>
                {unseenCount} new
              </span>
            )} */}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything that happens on your account — trades, bot changes, broker and security events.
          </p>
        </div>
        {unseenCount > 0 && (
          <button
            onClick={() => void markAllSeen()}
            disabled={markingAll}
            className="flex h-9 items-center gap-2 rounded-lg border border-violet-500/40 px-4 text-xs font-bold uppercase tracking-widest text-violet-600 transition-colors hover:bg-violet-500/10 disabled:opacity-50 dark:text-violet-400"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {markingAll ? "Marking…" : "Mark all seen"}
          </button>
        )}
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`h-8 rounded-full border px-3.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
              filter === f.key
                ? "border-violet-500/60 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-900/20"
                : "border-border/60 bg-card text-muted-foreground hover:border-violet-500/40 hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* feed */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <ShillmongerLoader className="w-full max-w-md" label="Loading notifications" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="border-violet-500/20">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
              <Bell className="h-7 w-7" />
            </span>
            <p className="text-sm font-extrabold text-muted-foreground">
              {filter === "unseen" ? "You're all caught up" : "Nothing here yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {filter === "unseen"
                ? "No unseen notifications."
                : "Events from your trading activity will show up here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        groups.map((g) => (
          <div key={g.label} className="space-y-2">
            <p className={`${plexMono.className} px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70`}>
              {g.label}
            </p>
            <Card className="gap-0 divide-y divide-border/40 border-violet-500/20 p-0 shadow-sm">
              {g.items.map((n) => {
                const Icon = typeIcon(n);
                const meta = CATEGORY_META[n.category];
                const unseen = !n.seen;
                return (
                  <div
                    key={n.id}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 ${
                      unseen ? "bg-violet-500/[0.04]" : ""
                    }`}
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${meta.cls}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        {unseen && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />}
                        <span className="truncate text-sm font-bold">{n.title}</span>
                        <span className={`${plexMono.className} ml-auto shrink-0 text-[10px] font-medium text-muted-foreground`}>
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{n.message}</span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className={`${plexMono.className} rounded-full border border-border/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground`}>
                          {n.type}
                        </span>
                        {n.actor === "admin" && (
                          <span className={`${plexMono.className} rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400`}>
                            by admin
                          </span>
                        )}
                        <span className={`${plexMono.className} rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                          unseen
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "border-border/60 bg-muted/30 text-muted-foreground"
                        }`}>
                          {unseen ? "unseen" : "seen"}
                        </span>
                      </span>
                    </span>
                    {/* eye toggle: mark unseen -> seen */}
                    <button
                      type="button"
                      onClick={() => void markSeen(n.id)}
                      disabled={n.seen || busyId === n.id}
                      title={n.seen ? "Seen" : "Mark as seen"}
                      aria-label={n.seen ? "Seen" : "Mark as seen"}
                      className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        n.seen
                          ? "border-border/40 text-muted-foreground/40"
                          : "border-violet-500/40 text-violet-600 hover:bg-violet-500/10 dark:text-violet-400"
                      } disabled:cursor-default`}
                    >
                      {n.seen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                );
              })}
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
