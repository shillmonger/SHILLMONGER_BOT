"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { IBM_Plex_Mono } from "next/font/google";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

/* ───────────────── Types (backend contract unchanged) ───────────────── */

interface BrokerRow {
  id: string;
  userId: string | null;
  // image / avatar / profileImage are optional: used if your API already returns one.
  user: {
    userName?: string;
    username?: string;
    email?: string;
    avatar?: string | null;
    image?: string | null;
    profileImage?: string | null;
  } | null;
  brokerName: string;
  accountEmail: string;
  environment: "demo" | "live";
  connectionStatus: string;
  status: "active" | "disabled";
  connectionError: string | null;
  account: {
    accountName?: string; accountId?: string; currency?: string | null;
    balance?: number | null; equity?: number | null; profitLoss?: number | null;
  } | null;
  lastConnectedAt: string | null;
  lastSessionRefreshAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type PendingAction = { kind: "toggle" | "delete"; broker: BrokerRow } | null;

const PAGE_SIZE = 10;

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

const fmtMoney = (v?: number | null, currency?: string | null) =>
  v == null
    ? "—"
    : `${v < 0 ? "-" : ""}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

/** Mask an email for display: local part uppercased + dots, domain hidden. */
const maskEmail = (e?: string | null) => {
  if (!e) return "—";
  const local = e.split("@")[0] ?? e;
  return `${local.toUpperCase()}.........`;
};

const connectionTone = (s: string): "green" | "red" | "gray" => {
  const v = s.toLowerCase();
  if (/error|fail|invalid|expired|denied/.test(v)) return "red";
  if (/^(connected|active|ok|live)$/.test(v)) return "green";
  return "gray";
};

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
  disabledRow, busy, onToggle, onDelete,
}: { disabledRow: boolean; busy: boolean; onToggle: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuHeight = 96;
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
          className="fixed z-50 w-44 rounded-xl border border-violet-500/20 bg-card p-1.5 shadow-xl shadow-black/20 animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onToggle(); }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors hover:bg-violet-500/10"
          >
            {disabledRow
              ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              : <ShieldOff className="h-3.5 w-3.5 text-amber-500" />}
            {disabledRow ? "Enable broker" : "Disable broker"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
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
  const { kind, broker } = pending;
  const isDelete = kind === "delete";
  const willDisable = broker.status === "active";
  const username = broker.user?.userName ?? broker.user?.username ?? "this user";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const title = isDelete ? "Delete this broker?" : willDisable ? "Disable this broker?" : "Enable this broker?";
  const body = isDelete
    ? "This deletes the broker record (credentials + session tokens) and the user's bot configuration. Trade history is kept. This cannot be undone."
    : willDisable
      ? "Trading will be blocked for this broker until you enable it again."
      : "This allows trading to resume for this broker.";
  const confirmLabel = isDelete ? "Delete" : willDisable ? "Disable" : "Enable";
  const danger = isDelete || willDisable;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <Card className={`w-full max-w-md ${isDelete ? "border-rose-500/30" : "border-violet-500/30"}`}>
        <CardContent className="space-y-4 p-6">
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            isDelete
              ? "bg-rose-500/15 text-rose-500"
              : willDisable
                ? "bg-amber-500/15 text-amber-500"
                : "bg-emerald-500/15 text-emerald-500"
          }`}>
            {isDelete ? <Trash2 className="h-5 w-5" /> : willDisable ? <ShieldOff className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </span>

          <div className="space-y-1.5">
            <h2 id="confirm-title" className="text-lg font-extrabold">{title}</h2>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
            <p className="font-bold">{maskEmail(broker.accountEmail)}</p>
            <p className="mt-0.5 text-muted-foreground">{broker.brokerName} · {username} · {broker.environment.toUpperCase()}</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={onCancel} className="flex-1 rounded-lg">Cancel</Button>
            <Button
              disabled={busy}
              onClick={onConfirm}
              className={`flex-1 gap-2 rounded-lg font-bold text-white ${
                danger ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
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

export default function BrokerControlPage() {
  const [brokers, setBrokers] = useState<BrokerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);

  const [query, setQuery] = useState("");
  const [envFilter, setEnvFilter] = useState<"all" | "demo" | "live">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/brokers", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load brokers");
      setBrokers(data.brokers ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load brokers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  /* filtering + pagination */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return brokers.filter((b) => {
      if (envFilter !== "all" && b.environment !== envFilter) return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!q) return true;
      return [b.user?.userName, b.user?.username, b.user?.email, b.accountEmail, b.brokerName]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [brokers, query, envFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  /* actions (same endpoints and payloads as before) */
  const toggleStatus = async (b: BrokerRow) => {
    const next = b.status === "active" ? "disabled" : "active";
    setBusyId(b.id);
    try {
      const res = await fetch(`/api/admin/brokers/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast.success(`Broker ${next === "active" ? "activated" : "disabled"} for ${b.accountEmail}`);
      setPending(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const deleteBroker = async (b: BrokerRow) => {
    setBusyId(b.id);
    try {
      const res = await fetch(`/api/admin/brokers/${b.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success(`Deleted broker + bot config for ${b.accountEmail}`);
      setPending(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const confirmPending = () => {
    if (!pending) return;
    if (pending.kind === "delete") void deleteBroker(pending.broker);
    else void toggleStatus(pending.broker);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
            [ // BROKER CONTROL ]
          </p>
          <h1 className="mt-1 text-2xl font-extrabold uppercase tracking-tight">
            Connected <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">Brokers</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {brokers.length} broker{brokers.length === 1 ? "" : "s"} connected — disable blocks trading; delete removes the broker record and that user&rsquo;s bot configuration.
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
            placeholder="Search name, email or account"
            className="h-10 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-violet-500/50 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <select
          value={envFilter}
          onChange={(e) => { setEnvFilter(e.target.value as typeof envFilter); setPage(1); }}
          className={`${SELECT_CLS} flex-1 sm:flex-none`}
          aria-label="Filter by environment"
        >
          <option value="all">All environments</option>
          <option value="demo">Demo</option>
          <option value="live">Live</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
          className={`${SELECT_CLS} flex-1 sm:flex-none`}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/20 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading brokers…
        </div>
      ) : brokers.length === 0 ? (
        <Card className="border-violet-500/20">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
              <Landmark className="h-7 w-7" />
            </span>
            <p className="text-sm font-extrabold text-muted-foreground">No brokers connected</p>
            <p className="text-xs text-muted-foreground">User Capital.com connections will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden border-violet-500/20 p-0 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 1180 }}>
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className={TH}>User</th>
                  <th className={TH}>Broker account</th>
                  <th className={TH}>Environment</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Connection</th>
                  <th className={TH}>Balance</th>
                  <th className={TH}>Equity</th>
                  <th className={TH}>Unrealized P/L</th>
                  <th className={TH}>Last connected</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-xs text-muted-foreground">
                      No brokers match your filters.
                    </td>
                  </tr>
                ) : rows.map((b) => {
                  const disabled = b.status === "disabled";
                  const busy = busyId === b.id;
                  const name = b.user?.userName ?? b.user?.username ?? "Unknown user";
                  const img = b.user?.avatar ?? b.user?.image ?? b.user?.profileImage ?? null;
                  const pl = b.account?.profitLoss;
                  return (
                    <tr key={b.id} className="transition-colors hover:bg-muted/30">
                      <td className={TD}>
                        <div className="flex items-center gap-3">
                          <Avatar name={name} src={img} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{name}</p>
                            <p className="truncate text-xs text-muted-foreground">{maskEmail(b.user?.email)}</p>
                          </div>
                        </div>
                      </td>
                      <td className={TD}>
                        <p className="max-w-[200px] truncate font-semibold" title={maskEmail(b.accountEmail)}>{maskEmail(b.accountEmail)}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.brokerName}{b.account?.accountName || b.account?.accountId ? ` · ${b.account?.accountName ?? b.account?.accountId}` : ""}
                        </p>
                      </td>
                      <td className={TD}>
                        <Badge text={b.environment.toUpperCase()} tone={b.environment === "live" ? "green" : "amber"} />
                      </td>
                      <td className={TD}>
                        <Badge text={disabled ? "DISABLED" : "ACTIVE"} tone={disabled ? "red" : "green"} />
                      </td>
                      <td className={TD}>
                        <Badge text={b.connectionStatus.toUpperCase().replace(/_/g, " ")} tone={connectionTone(b.connectionStatus)} />
                        {b.connectionError && (
                          <p
                            className="mt-1 flex max-w-[180px] items-center gap-1 truncate text-[11px] font-semibold text-rose-600 dark:text-rose-400"
                            title={b.connectionError}
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span className="truncate">{b.connectionError}</span>
                          </p>
                        )}
                      </td>
                      <td className={`${TD} font-semibold tabular-nums`}>{fmtMoney(b.account?.balance, b.account?.currency)}</td>
                      <td className={`${TD} font-semibold tabular-nums`}>{fmtMoney(b.account?.equity, b.account?.currency)}</td>
                      <td className={`${TD} font-bold tabular-nums ${
                        pl == null ? "" : pl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      }`}>
                        {pl == null ? "—" : `${pl >= 0 ? "+" : "-"}${fmtMoney(Math.abs(pl), b.account?.currency)}`}
                      </td>
                      <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{fmtDate(b.lastConnectedAt)}</td>
                      <td className={`${TD} text-right`}>
                        <ActionMenu
                          disabledRow={disabled}
                          busy={busy}
                          onToggle={() => setPending({ kind: "toggle", broker: b })}
                          onDelete={() => setPending({ kind: "delete", broker: b })}
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
          busy={busyId === pending.broker.id}
          onCancel={() => setPending(null)}
          onConfirm={confirmPending}
        />
      )}
    </div>
  );
}