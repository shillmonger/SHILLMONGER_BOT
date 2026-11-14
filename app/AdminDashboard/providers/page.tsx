"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Send,
  RefreshCw,
  Check,
  X,
  Loader2,
  Users,
  AlertCircle,
  Search,
  Wifi,
  WifiOff,
  Radio,
  ShieldCheck,
  Plus,
  Play,
  Square,
  Server,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import ShillmongerLoader from "@/components/ShillmongerLoader";
import { useMainContentLoading } from "@/components/UserDashboard/MainContentLoading";

interface TelegramGroup {
  id: string;
  name: string;
  profile_image?: string;
  type?: string;
  username?: string;
}

interface SavedProvider {
  _id: string;
  groupId: string;
  groupName: string;
  profileImage: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Exact shape returned by the Python bot's GET /api/telegram/status
interface TelegramStatus {
  connected: boolean;
  monitoring: boolean;
  connection_status: "connected" | "connecting" | "error" | "disconnected" | string;
  monitored_group_count: number;
  last_error: string | null;
}

const STATUS_POLL_MS = 10000;

/**
 * ToggleRow
 * Shared settings-list toggle primitive (label + optional description on
 * the left, pill switch on the right) — kept visually consistent with the
 * toggle pattern used elsewhere in the dashboard.
 */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  color = "emerald",
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  color?: "emerald" | "gold" | "amber" | "red";
}) {
  const trackColor: Record<string, string> = {
    emerald: "bg-emerald-500",
    gold: "bg-[#D4AF37]",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 text-right">
        {description && (
          <p className="text-[10px] font-mono text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-black/5 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-40 ${
          checked ? trackColor[color] : "bg-muted-foreground/25"
        }`}
      >
        <span
          className="inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
          style={{ transform: checked ? "translateX(21px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-[#D4AF37]">
          {icon}
        </div>
        <h2 className="truncate text-sm font-black uppercase tracking-wider">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function StatusBadge({ status }: { status: TelegramStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
        API Offline
      </span>
    );
  }
  const connected = status.connection_status === "connected";
  const connecting = status.connection_status === "connecting";
  const errored = status.connection_status === "error";
  const cls = connected
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : errored
      ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
      : connecting
        ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
  const dot = connected ? "bg-emerald-500" : errored ? "bg-red-500" : connecting ? "bg-amber-500" : "bg-red-500";
  const label = connected
    ? "Telegram Connected"
    : connecting
      ? "Connecting"
      : errored
        ? "Listener Error"
        : "Telegram Offline";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${cls}`}>
      <span className="relative flex h-1.5 w-1.5">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dot}`} />
      </span>
      {label}
    </span>
  );
}

export default function ProvidersPage() {
  const [telegramGroups, setTelegramGroups] = useState<TelegramGroup[]>([]);
  const [savedProviders, setSavedProviders] = useState<SavedProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const setMainLoading = useMainContentLoading();
  const [searchTerm, setSearchTerm] = useState("");

  // Real listener status from the Python bot (null = API unreachable)
  const [botStatus, setBotStatus] = useState<TelegramStatus | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/admin/telegram/status");
      if (response.ok) {
        const data = await response.json();
        setBotStatus(data);
        setApiOnline(true);
      } else {
        setBotStatus(null);
        setApiOnline(false);
      }
    } catch {
      setBotStatus(null);
      setApiOnline(false);
    }
  };

  const refreshStatus = async (showSpinner = false) => {
    if (showSpinner) setIsLoadingStatus(true);
    await fetchStatus();
    if (showSpinner) setIsLoadingStatus(false);
  };

  const fetchTelegramGroups = async () => {
    setIsFetching(true);
    try {
      const response = await fetch("/api/admin/telegram/groups");
      const data = await response.json();
      if (response.ok && data.groups) {
        setTelegramGroups(data.groups);
        toast.success(`Fetched ${data.groups.length} Telegram groups`);
      } else {
        toast.error(data.error || data.detail || "Failed to fetch Telegram groups");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to fetch Telegram groups");
    } finally {
      setIsFetching(false);
    }
  };

  const fetchSavedProviders = async () => {
    try {
      const response = await fetch("/api/admin/providers");
      const data = await response.json();
      if (response.ok) {
        interface RawProvider {
          _id: { toString(): string };
          groupId: string;
          groupName: string;
          profileImage?: string;
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        }
        const providers = ((data.providers || []) as RawProvider[]).map((p) => ({
          _id: p._id.toString(),
          groupId: p.groupId,
          groupName: p.groupName,
          profileImage: p.profileImage || "",
          isActive: p.isActive,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));
        setSavedProviders(providers);
      } else {
        toast.error(data.error || "Failed to fetch saved providers");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to fetch saved providers");
    } finally {
      setIsLoadingProviders(false);
    }
  };

  useEffect(() => {
    // Deferred so data fetching (and its state updates) does not run
    // synchronously inside the effect body
    const timer = setTimeout(() => {
      fetchStatus();
      fetchSavedProviders();
    }, 0);

    // Poll listener status; cleaned up on unmount
    const interval = setInterval(() => fetchStatus(), STATUS_POLL_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Keep the layout loader visible while providers/groups are loading.
  useEffect(() => {
    setMainLoading(isLoadingProviders || isFetching);
  }, [isLoadingProviders, isFetching, setMainLoading]);

  useEffect(() => () => setMainLoading(false), [setMainLoading]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch("/api/admin/telegram/connect", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        toast.success("Telegram listener start requested");
      } else {
        toast.error(data.error || data.detail || "Failed to connect Telegram");
      }
    } catch {
      toast.error("Failed to reach the bot service");
    } finally {
      setIsConnecting(false);
      // Listener startup is async on the Python side — refresh shortly after
      setTimeout(() => refreshStatus(), 2000);
      setTimeout(() => refreshStatus(), 6000);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const response = await fetch("/api/admin/telegram/disconnect", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        toast.success("Telegram listener stopped");
      } else {
        toast.error(data.error || data.detail || "Failed to disconnect Telegram");
      }
    } catch {
      toast.error("Failed to reach the bot service");
    } finally {
      setIsDisconnecting(false);
      setTimeout(() => refreshStatus(), 1500);
    }
  };

  const handleAddProvider = async (group: TelegramGroup) => {
    try {
      const response = await fetch("/api/admin/providers/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: group.id,
          groupName: group.name,
          profileImage: group.profile_image || "",
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(`Added ${group.name} to providers`);
        fetchSavedProviders();
      } else {
        toast.error(data.error || "Failed to add provider");
      }
    } catch (error) {
      console.error("Add error:", error);
      toast.error("Failed to add provider");
    }
  };

  const handleToggleProvider = async (provider: SavedProvider) => {
    try {
      const response = await fetch("/api/admin/providers/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: provider.groupId }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(`${provider.groupName} ${data.isActive ? "activated" : "deactivated"}`);
        fetchSavedProviders();
      } else {
        toast.error(data.error || "Failed to toggle provider");
      }
    } catch (error) {
      console.error("Toggle error:", error);
      toast.error("Failed to toggle provider");
    }
  };

  const handleDeleteProvider = async (provider: SavedProvider) => {
    try {
      const response = await fetch(`/api/admin/providers/${encodeURIComponent(provider.groupId)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(`Removed ${provider.groupName}`);
        fetchSavedProviders();
      } else {
        toast.error(data.error || "Failed to remove provider");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to remove provider");
    }
  };

  const filteredGroups = telegramGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const telegramLive = botStatus?.connection_status === "connected";
  const telegramMonitoring = Boolean(botStatus?.monitoring);

  return (
         <div className="flex h-full w-full min-w-0 bg-background overflow-x-clip">

      <div className="flex-1 flex w-full min-w-0 flex-col py-5">

        <main className="flex-1 w-full min-w-0 overflow-x-clip">

        {/* HEADER */}
        <div className="mb-5 flex flex-col gap-4 border-b border-border/60 pb-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Telegram Signal Monitoring
            </p>
            <h1 className="flex items-center gap-2.5 text-2xl font-mono font-black uppercase tracking-tight">
              <Send className="h-5 w-5 text-[#D4AF37]" />
              Signal Providers
            </h1>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <StatusBadge status={botStatus} />
          </div>
        </div>

        {/* MAIN GRID — connection panel on the right, content on the left */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* LEFT COLUMN — groups + saved providers */}
          <div className="min-w-0 space-y-6 lg:col-span-2">

            {/* AVAILABLE SIGNAL GROUPS */}
            <Card className="overflow-hidden rounded-2xl border border-border/60 shadow-sm ring-0">
              <CardContent className="space-y-5 px-4 sm:px-6 sm:py-2">
                <SectionHeading
                  icon={<Users className="h-4 w-4" />}
                  title="Available Signal Groups / Channels"
                  right={
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="relative min-w-0 flex-1 sm:flex-none">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search groups..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="h-8 w-full rounded-lg border border-border/60 bg-muted/60 pl-9 pr-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#D4AF37] sm:w-48"
                        />
                      </div>
                    </div>
                  }
                />

                {isFetching ? (
                  <div className="flex min-h-[30vh] items-center justify-center">
                    <ShillmongerLoader className="w-full max-w-md" label="Fetching groups" />
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-10 text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-bold text-muted-foreground">
                      {apiOnline ? "No groups found" : "Bot service offline"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {apiOnline
                        ? "Click 'Fetch Groups' to load the Telegram groups visible to the bot account"
                        : "Start the Python bot service, then try again"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredGroups.map((group) => {
                      const alreadyAdded = savedProviders.some(
                        (p) => String(p.groupId) === String(group.id)
                      );
                      return (
                        <div
                          key={group.id}
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white">
                              {group.profile_image ? (
                                <img src={group.profile_image} alt={group.name} className="h-10 w-10 rounded-full object-cover" />
                              ) : (
                                <Radio className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold">{group.name}</p>
                              <p className="break-all text-[10px] font-mono text-muted-foreground">ID: {group.id}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 shrink-0 rounded-lg border-border/60 text-xs font-black uppercase tracking-widest"
                            onClick={() => handleAddProvider(group)}
                            disabled={alreadyAdded}
                          >
                            {alreadyAdded ? (
                              <>
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SAVED PROVIDERS */}
            <Card className="overflow-hidden rounded-2xl border border-border/60 shadow-sm ring-0">
              <CardContent className="space-y-5 px-4 sm:px-6 sm:py-2">
                <SectionHeading
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Saved Providers"
                  right={
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {savedProviders.filter(p => p.isActive).length} / {savedProviders.length} active
                    </span>
                  }
                />

                {isLoadingProviders ? (
                  <div className="flex min-h-[30vh] items-center justify-center">
                    <ShillmongerLoader className="w-full max-w-md" label="Loading providers" />
                  </div>
                ) : savedProviders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border/60 py-12 text-center">
                    <AlertCircle className="mb-2 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-bold text-muted-foreground">No providers saved yet</p>
                    <p className="text-[10px] text-muted-foreground">
                      Add signal providers from the available groups above
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedProviders.map((provider) => (
                      <div
                        key={provider._id}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white">
                            {provider.profileImage ? (
                              <img src={provider.profileImage} alt={provider.groupName} className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                              <Radio className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{provider.groupName}</p>
                            <p className="break-all text-[10px] font-mono text-muted-foreground">ID: {provider.groupId}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <ToggleRow
                            label="Active"
                            checked={provider.isActive}
                            onChange={() => handleToggleProvider(provider)}
                            color="emerald"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDeleteProvider(provider)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN — Telegram listener connection panel */}
          <div className="min-w-0 lg:col-span-1">
            <Card className="sticky top-6 overflow-hidden rounded-2xl border border-border/60 shadow-sm ring-0">
              <CardContent className="space-y-5 px-4 sm:px-6 sm:py-2">
                <SectionHeading
                  icon={telegramLive ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  title="Telegram Listener"
                />

                <div className="space-y-4">
                  {/* Bot API service reachability */}
                  <div
                    className={`flex items-center justify-between rounded-xl border p-4 ${
                      apiOnline === true
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}
                  >
                    <div>
                      <p className="mb-1 text-[10px] font-black uppercase tracking-widest">Bot API</p>
                      <p className="font-mono text-sm">
                        {apiOnline === null ? "Checking..." : apiOnline ? "ONLINE" : "OFFLINE"}
                      </p>
                    </div>
                    <Server className="h-5 w-5" />
                  </div>

                  {/* Real Telegram listener status */}
                  <div
                    className={`flex items-center justify-between rounded-xl border p-4 ${
                      telegramLive
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-border/60 bg-muted/30 text-foreground"
                    }`}
                  >
                    <div>
                      <p className="mb-1 text-[10px] font-black uppercase tracking-widest">Telegram</p>
                      <p className="font-mono text-sm uppercase">
                        {botStatus ? botStatus.connection_status : apiOnline ? "UNKNOWN" : "—"}
                      </p>
                    </div>
                    {telegramLive ? (
                      <Wifi className="h-5 w-5" />
                    ) : (
                      <WifiOff className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {botStatus && (
                    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monitoring</span>
                        <span className="text-[10px] font-mono">
                          {telegramMonitoring ? "ACTIVE" : "IDLE"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monitored Groups</span>
                        <span className="text-[10px] font-mono">
                          {botStatus.monitored_group_count ?? 0}
                        </span>
                      </div>
                      {botStatus.last_error && (
                        <div className="flex items-start justify-between gap-2 border-t border-border/60 pt-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Last Error</span>
                          <span className="text-right text-[10px] font-mono text-red-500 break-all">
                            {botStatus.last_error}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-center text-sm text-muted-foreground">
                    {telegramLive
                      ? "The listener is connected to Telegram and monitoring authorized groups."
                      : apiOnline
                        ? "The bot API is running but the Telegram listener is not connected. Start it to begin monitoring."
                        : "The bot service is not reachable. Start the Python service (run_api.py) to enable monitoring."}
                  </p>

                  <div className="space-y-2.5">
                    {!telegramLive ? (
                      <Button
                        disabled={!apiOnline || isConnecting || isLoadingStatus}
                        onClick={handleConnect}
                        className="w-full cursor-pointer rounded-xl bg-[#D4AF37] p-5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-[#B8860B] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Connect Telegram
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        disabled={isDisconnecting}
                        onClick={handleDisconnect}
                        className="w-full cursor-pointer rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-xs font-black uppercase tracking-widest text-red-600 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                      >
                        {isDisconnecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          <>
                            <Square className="mr-2 h-4 w-4" />
                            Disconnect Telegram
                          </>
                        )}
                      </Button>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        disabled={isFetching || !apiOnline}
                        onClick={fetchTelegramGroups}
                        className="cursor-pointer rounded-xl border border-border/60 bg-muted p-4 text-[10px] font-black uppercase tracking-widest text-foreground transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isFetching ? (
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" />
                            Fetch Groups
                          </>
                        )}
                      </Button>
                      <Button
                        disabled={isLoadingStatus}
                        onClick={() => refreshStatus(true)}
                        className="cursor-pointer rounded-xl border border-border/60 bg-muted p-4 text-[10px] font-black uppercase tracking-widest text-foreground transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoadingStatus ? (
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Activity className="mr-1.5 inline h-3.5 w-3.5" />
                            Refresh
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
    </div>
  );
}
