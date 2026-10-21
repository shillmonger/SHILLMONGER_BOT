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
  LogOut,
  Radio,
  Clock,
  UserCircle2,
  Hash,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

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
}

interface TelegramConnection {
  connected: boolean;
  status: string;
  account?: {
    telegramUserId: string;
    username?: string;
    firstName?: string;
  };
  connectedAt?: string;
  lastCheckedAt?: string;
}

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
    <div className="flex items-center justify-between border-b border-border/60 pb-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-[#D4AF37]">
          {icon}
        </div>
        <h2 className="text-sm font-black uppercase tracking-wider">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export default function ProvidersPage() {
  const [greeting, setGreeting] = useState("Welcome");
  const [currentTime, setCurrentTime] = useState("");
  const [telegramGroups] = useState<TelegramGroup[]>([]);
  const [savedProviders] = useState<SavedProvider[]>([]);
  const [isLoading] = useState(false);
  const [isFetching] = useState(false);
  const [isLoadingProviders] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [telegramConnection] = useState<TelegramConnection>({
    connected: false,
    status: "disconnected",
  });
  const [isLoadingConnection] = useState(false);
  const [isConnecting] = useState(false);

  useEffect(() => {
    const hrs = new Date().getHours();
    if (hrs < 12) setGreeting("Good Morning");
    else if (hrs < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    setCurrentTime(new Date().toLocaleDateString("en-US", options));
  }, []);

  const filteredGroups = telegramGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <main className="mx-auto w-full max-w-7xl py-5 lg:py-5">

        {/* HEADER */}
        <div className="mb-5 flex flex-col gap-4 border-b border-border/60 pb-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              {greeting}, Admin
            </p>
            <h1 className="flex items-center gap-2.5 text-2xl font-mono font-black uppercase tracking-tight">
              <Send className="h-5 w-5 text-[#D4AF37]" />
              Signal Providers
            </h1>
          </div>
<div className="hidden items-center gap-3 md:flex">
            
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                telegramConnection?.connected
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {telegramConnection?.connected && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                )}
                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${telegramConnection?.connected ? "bg-emerald-500" : "bg-red-500"}`} />
              </span>
              {telegramConnection?.connected ? "Connected" : "Offline"}
            </span>
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/60 px-4 py-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <div>
                <span className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  System Time
                </span>
                <span className="text-xs font-mono font-bold">
                  {currentTime || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN GRID — connection panel on the right, content on the left */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* LEFT COLUMN — groups + saved providers */}
          <div className="space-y-6 lg:col-span-2">

            {/* AVAILABLE SIGNAL GROUPS */}
            <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
              <CardContent className="space-y-5 px-4 sm:px-6 sm:py-2">
                <SectionHeading
                  icon={<Users className="h-4 w-4" />}
                  title="Available Signal Groups / Channels"
                  right={null}
                />

                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-10 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-bold text-muted-foreground">
                    Signal Provider Integration Unavailable
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This feature is currently under development. Signal provider integration will be available in a future update.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* SAVED PROVIDERS */}
            <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
              <CardContent className="space-y-5 px-4 sm:px-6 sm:py-2">
                <SectionHeading
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Saved Providers"
                  right={
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      0 / 0 active
                    </span>
                  }
                />

                <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border/60 py-12 text-center">
                  <AlertCircle className="mb-2 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-bold text-muted-foreground">No providers saved yet</p>
                  <p className="text-[10px] text-muted-foreground">
                    Signal provider integration is under development
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN — Connection panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6 overflow-hidden rounded-2xl border-border/60 shadow-sm">
              <CardContent className="space-y-5 px-4 sm:px-6 sm:py-2">
                <SectionHeading
                  icon={<WifiOff className="h-4 w-4" />}
                  title="Provider Connection"
                />

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-600 dark:text-red-400">
                    <div>
                      <p className="mb-1 text-[10px] font-black uppercase tracking-widest">Status</p>
                      <p className="font-mono text-sm">NOT CONNECTED</p>
                    </div>
                    <WifiOff className="h-5 w-5" />
                  </div>

                  <p className="text-center text-sm text-muted-foreground">
                    Signal provider integration is currently under development. This feature will allow you to connect to various signal sources and automatically fetch trading signals.
                  </p>

                  <div className="space-y-2.5">
                    <Button
                      disabled={true}
                      className="w-full cursor-pointer rounded-xl bg-muted p-5 text-xs font-black uppercase tracking-widest text-foreground transition-colors opacity-50"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Fetch Groups
                    </Button>

                    <Button
                      disabled={true}
                      className="w-full cursor-pointer rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-xs font-black uppercase tracking-widest text-red-600 transition-colors opacity-50 dark:text-red-400"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
