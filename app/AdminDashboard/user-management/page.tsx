"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { IBM_Plex_Mono } from "next/font/google";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Crown,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldOff,
  Trash2,
  UserCheck,
  Users,
  UserX,
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

interface UserRow {
  id: string;
  userName: string;
  email: string;
  avatar: string | null;
  role: "user" | "admin";
  status: "active" | "inactive" | "suspended";
  phone: string | null;
  country: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

type PendingAction =
  | { kind: "suspend" | "activate" | "make-admin" | "remove-admin" | "delete"; user: UserRow }
  | null;

const PAGE_SIZE = 10;

/* ───────────────── Helpers ───────────────── */

const Badge = ({ text, tone }: { text: string; tone: "green" | "amber" | "red" | "gray" | "violet" }) => (
  <span className={`${plexMono.className} inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
    tone === "green"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "red"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : tone === "violet"
            ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"
            : "border-border/60 bg-muted/30 text-muted-foreground"
  }`}>
    {text}
  </span>
);

/** Mask an email for display: local part uppercased + dots, domain hidden. */
const maskEmail = (e?: string | null) => {
  if (!e) return "—";
  const local = e.split("@")[0] ?? e;
  return `${local.toUpperCase()}.........`;
};

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

const statusTone = (s: string): "green" | "red" | "gray" => {
  if (s === "active") return "green";
  if (s === "suspended") return "red";
  return "gray";
};

/* ───────────────── Stat card (matches /UserDashboard/dashboard) ───────────────── */

function StatCard({
  icon,
  label,
  value,
  share,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  share: string;
  tone: string;
}) {
  return (
    <div className="group rounded-2xl border border-violet-500/20 bg-card p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-900/10">
      <div className="flex items-start justify-between">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${tone}`}
        >
          {icon}
        </span>
        <span className="inline-flex items-center rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {share}
        </span>
      </div>
      <p className="mt-2 text-xl font-extrabold tracking-tight tabular-nums font-mono">
        {value}
      </p>
      <p className={`${plexMono.className} mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground`}>
        {label}
      </p>
    </div>
  );
}

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

/* ───────────────── Row action dropdown ───────────────── */

function ActionMenu({
  user, busy, onAction,
}: { user: UserRow; busy: boolean; onAction: (kind: NonNullable<PendingAction>["kind"]) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const suspended = user.status === "suspended";
  const isAdmin = user.role === "admin";

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuHeight = 176;
      const top = r.bottom + menuHeight + 12 > window.innerHeight ? r.top - menuHeight - 6 : r.bottom + 6;
      setPos({ top, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const item =
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors hover:bg-violet-500/10";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={busy}
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-violet-500/10 hover:text-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-50 w-48 rounded-xl border border-violet-500/20 bg-card p-1.5 shadow-xl shadow-black/20 animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onAction(suspended ? "activate" : "suspend"); }}
            className={item}
          >
            {suspended
              ? <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
              : <Ban className="h-3.5 w-3.5 text-amber-500" />}
            {suspended ? "Activate user" : "Suspend user"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onAction(isAdmin ? "remove-admin" : "make-admin"); }}
            className={item}
          >
            {isAdmin
              ? <ShieldOff className="h-3.5 w-3.5 text-amber-500" />
              : <Crown className="h-3.5 w-3.5 text-violet-500" />}
            {isAdmin ? "Remove admin" : "Set as admin"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onAction("delete"); }}
            className={`${item} text-rose-600 dark:text-rose-400`}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete user
          </button>
        </div>
      )}
    </>
  );
}

/* ───────────────── Confirmation popup ───────────────── */

function ConfirmDialog({
  pending, busy, onCancel, onConfirm,
}: { pending: NonNullable<PendingAction>; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { kind, user } = pending;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const copy: Record<string, { title: string; body: string; label: string; danger: boolean; icon: "red" | "amber" | "green" | "violet" }> = {
    delete: {
      title: "Delete this user?",
      body: "This permanently deletes the user account along with their broker connection, bot configuration, and trade execution records. This cannot be undone.",
      label: "Delete",
      danger: true,
      icon: "red",
    },
    suspend: {
      title: "Suspend this user?",
      body: "The user will be blocked from signing in and their bot will stop executing trades until reactivated.",
      label: "Suspend",
      danger: true,
      icon: "amber",
    },
    activate: {
      title: "Activate this user?",
      body: "The user will be able to sign in and their bot can execute trades again.",
      label: "Activate",
      danger: false,
      icon: "green",
    },
    "make-admin": {
      title: "Set user as admin?",
      body: "This user will get full admin access to the dashboard, including user and broker management.",
      label: "Make admin",
      danger: false,
      icon: "violet",
    },
    "remove-admin": {
      title: "Remove admin role?",
      body: "This user will lose admin access and become a regular user.",
      label: "Remove admin",
      danger: true,
      icon: "amber",
    },
  };
  const c = copy[kind];

  const iconBg =
    c.icon === "red" ? "bg-rose-500/15 text-rose-500"
    : c.icon === "amber" ? "bg-amber-500/15 text-amber-500"
    : c.icon === "green" ? "bg-emerald-500/15 text-emerald-500"
    : "bg-violet-500/15 text-violet-500";
  const Icon = kind === "delete" ? Trash2 : kind === "suspend" ? Ban : kind === "activate" ? UserCheck : kind === "make-admin" ? Crown : ShieldOff;

  const btnCls = c.danger
    ? "bg-rose-600 hover:bg-rose-500"
    : c.icon === "violet"
      ? "bg-violet-600 hover:bg-violet-500"
      : "bg-emerald-600 hover:bg-emerald-500";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <Card className={`w-full max-w-md ${c.danger ? "border-rose-500/30" : "border-violet-500/30"}`}>
        <CardContent className="space-y-4 p-6">
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className="h-5 w-5" />
          </span>

          <div className="space-y-1.5">
            <h2 id="confirm-title" className="text-lg font-extrabold">{c.title}</h2>
            <p className="text-sm text-muted-foreground">{c.body}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
            <p className="font-bold">{user.userName}</p>
            <p className="mt-0.5 text-muted-foreground">{maskEmail(user.email)} · {user.role.toUpperCase()} · {user.status.toUpperCase()}</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={onCancel} className="flex-1 rounded-lg">Cancel</Button>
            <Button
              disabled={busy}
              onClick={onConfirm}
              className={`flex-1 gap-2 rounded-lg font-bold text-white ${btnCls}`}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {c.label}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────── Page ───────────────── */

const TH = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap";
const TD = "px-4 py-3 align-middle text-sm";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "admin">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "inactive">("all");
  const [page, setPage] = useState(1);
  const setMainLoading = useMainContentLoading();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers(data.users ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // Keep the layout loader visible while users are loading.
  useEffect(() => {
    setMainLoading(loading);
  }, [loading, setMainLoading]);

  useEffect(() => () => setMainLoading(false), [setMainLoading]);

  /* stats — same shape as /UserDashboard/dashboard StatCard */
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "active").length;
    const suspended = users.filter((u) => u.status === "suspended").length;
    const admins = users.filter((u) => u.role === "admin").length;
    const share = (n: number) => (total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`);
    return [
      { label: "Total Users", value: total, icon: <Users className="h-4 w-4" />, tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400", share: "100%" },
      { label: "Active Users", value: active, icon: <UserCheck className="h-4 w-4" />, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", share: share(active) },
      { label: "Suspended Users", value: suspended, icon: <UserX className="h-4 w-4" />, tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400", share: share(suspended) },
      { label: "Admins", value: admins, icon: <Crown className="h-4 w-4" />, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400", share: share(admins) },
    ];
  }, [users]);

  /* filtering + pagination */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (!q) return true;
      return [u.userName, u.email, u.phone, u.country]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [users, query, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  /* actions */
  const runAction = async (p: NonNullable<PendingAction>) => {
    const { kind, user } = p;
    setBusyId(user.id);
    try {
      if (kind === "delete") {
        const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Delete failed");
        toast.success(`Deleted ${user.userName} and all related data`);
      } else {
        const body =
          kind === "suspend" ? { status: "suspended" }
          : kind === "activate" ? { status: "active" }
          : kind === "make-admin" ? { role: "admin" }
          : { role: "user" };
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Update failed");
        const verb =
          kind === "suspend" ? "suspended" : kind === "activate" ? "activated"
          : kind === "make-admin" ? "promoted to admin" : "demoted to user";
        toast.success(`${user.userName} ${verb}`);
      }
      setPending(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
            [ // USER MANAGEMENT ]
          </p>
          <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight">
            Manage <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">Users</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {users.length} user{users.length === 1 ? "" : "s"} registered — suspend blocks sign-in and trading; delete removes the account and all related data.
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

      {/* stats — same card style as /UserDashboard/dashboard */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            icon={s.icon}
            label={s.label}
            value={String(s.value)}
            share={s.share}
            tone={s.tone}
          />
        ))}
      </section>

      {/* toolbar */}
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search name, email, phone or country"
            className="h-10 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value as typeof roleFilter); setPage(1); }}
          className={`${SELECT_CLS} flex-1 sm:flex-none`}
          aria-label="Filter by role"
        >
          <option value="all">All roles</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
          className={`${SELECT_CLS} flex-1 sm:flex-none`}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <ShillmongerLoader className="w-full max-w-md" label="Loading users" />
        </div>
      ) : users.length === 0 ? (
        <Card className="border-violet-500/20">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
              <Users className="h-7 w-7" />
            </span>
            <p className="text-sm font-extrabold text-muted-foreground">No users yet</p>
            <p className="text-xs text-muted-foreground">Registered users will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 960 }}>
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className={TH}>User</th>
                  <th className={TH}>Role</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Contact</th>
                  <th className={TH}>Joined</th>
                  <th className={TH}>Last login</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-xs text-muted-foreground">
                      No users match your filters.
                    </td>
                  </tr>
                ) : rows.map((u) => {
                  const busy = busyId === u.id;
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-muted/30">
                      <td className={TD}>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.userName} src={u.avatar} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{u.userName}</p>
                            <p className="truncate text-xs text-muted-foreground">{maskEmail(u.email)}</p>
                          </div>
                        </div>
                      </td>
                      <td className={TD}>
                        <Badge
                          text={u.role.toUpperCase()}
                          tone={u.role === "admin" ? "violet" : "gray"}
                        />
                      </td>
                      <td className={TD}>
                        <Badge text={u.status.toUpperCase()} tone={statusTone(u.status)} />
                      </td>
                      <td className={TD}>
                        <p className="text-xs text-muted-foreground">
                          {u.phone ?? "—"}{u.country ? ` · ${u.country}` : ""}
                        </p>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{fmtDate(u.createdAt)}</td>
                      <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{fmtDate(u.lastLoginAt)}</td>
                      <td className={`${TD} text-right`}>
                        <ActionMenu
                          user={u}
                          busy={busy}
                          onAction={(kind) => setPending({ kind, user: u })}
                        />
                      </td>
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

      {pending && (
        <ConfirmDialog
          pending={pending}
          busy={busyId === pending.user.id}
          onCancel={() => setPending(null)}
          onConfirm={() => void runAction(pending)}
        />
      )}
    </div>
  );
}
