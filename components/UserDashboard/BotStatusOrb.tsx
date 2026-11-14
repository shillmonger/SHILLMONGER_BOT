"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  BotMessageSquare,
  ChevronRight,
  OctagonX,
  Pause,
  GamepadDirectional,
  Play,
  ShieldAlert,
  Square,
  X,
  Zap,
} from "lucide-react";
import { IBM_Plex_Mono } from "next/font/google";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

/* ───────────────── Types ───────────────── */

type BotState = "stopped" | "running" | "paused";
type Mode = "demo" | "live";

interface BotConfig {
  state?: BotState;
  environment?: Mode;
  automationEnabled?: boolean;
  emergencyStop?: boolean;
}

/* ───────────────── Meta ───────────────── */

// Put your bot character (transparent PNG) here. If it's missing, the Bot icon is shown instead.
const BOT_AVATAR = "/shillmonger-bot.png";

const STATE_META: Record<
  BotState,
  { label: string; orb: string; ring: string; glow: string; dot: string; halo: string }
> = {
  running: {
    label: "Running",
    orb: "from-emerald-400 via-emerald-500 to-teal-600",
    ring: "border-emerald-400/40",
    glow: "shadow-[0_0_35px_rgba(16,185,129,0.45)]",
    dot: "bg-emerald-400",
    halo: "bg-emerald-500/40",
  },
  paused: {
    label: "Paused",
    orb: "from-amber-300 via-amber-400 to-orange-500",
    ring: "border-amber-400/40",
    glow: "shadow-[0_0_30px_rgba(251,191,36,0.35)]",
    dot: "bg-amber-400",
    halo: "bg-amber-400/35",
  },
  stopped: {
    label: "Stopped",
    orb: "from-zinc-400 via-zinc-500 to-zinc-700",
    ring: "border-zinc-400/30",
    glow: "shadow-[0_0_25px_rgba(113,113,122,0.3)]",
    dot: "bg-zinc-400",
    halo: "bg-zinc-500/25",
  },
};

const POLL_MS = 15000;

const CSS = `
@keyframes sbo-float   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes sbo-bob     { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-3px) rotate(2deg); } }
@keyframes sbo-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
@keyframes sbo-shake   { 0%,70%,100% { transform: translateX(0); } 74% { transform: translateX(-3px) rotate(-3deg); } 78% { transform: translateX(3px) rotate(3deg); } 82% { transform: translateX(-2px); } 86% { transform: translateX(2px); } 90% { transform: translateX(0); } }
@keyframes sbo-halo    { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: .95; transform: scale(1.12); } }
@keyframes sbo-sweep   { from { transform: translateX(-120%); } to { transform: translateX(220%); } }

.sbo-float   { animation: sbo-float 4.5s ease-in-out infinite; }
.sbo-halo    { animation: sbo-halo 3.2s ease-in-out infinite; }
.sbo-bob     { transform-origin: 50% 100%; animation: sbo-bob 2.2s ease-in-out infinite; }
.sbo-breathe { transform-origin: 50% 100%; animation: sbo-breathe 4s ease-in-out infinite; filter: saturate(.8); }
.sbo-slump   { transform-origin: 50% 100%; transform: rotate(-8deg) translateY(2px); filter: grayscale(.7) brightness(.75); }
.sbo-shake   { transform-origin: 50% 100%; animation: sbo-shake 2.4s ease-in-out infinite; }
.sbo-sweep   { animation: sbo-sweep 2.6s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .sbo-float, .sbo-halo, .sbo-bob, .sbo-breathe, .sbo-shake, .sbo-sweep { animation: none !important; }
}
`;

/* ───────────────── Component ───────────────── */

export default function BotStatusOrb() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [bot, setBot] = useState<BotConfig | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const state: BotState = bot?.state ?? "stopped";
  const env: Mode = bot?.environment === "live" ? "live" : "demo";
  const automation = bot?.automationEnabled === true;
  const emergency = bot?.emergencyStop === true;
  const effective: BotState = emergency ? "stopped" : state;

  const meta = STATE_META[effective];
  const emergencyMeta = {
    label: "Emergency Stop",
    orb: "from-rose-400 via-rose-500 to-red-700",
    ring: "border-rose-500/50",
    glow: "shadow-[0_0_40px_rgba(244,63,94,0.55)]",
    dot: "bg-rose-500",
    halo: "bg-rose-500/45",
  };
  const display = emergency ? emergencyMeta : meta;

  // Which character animation to play
  const anim = emergency
    ? "sbo-shake"
    : effective === "running"
      ? "sbo-bob"
      : effective === "paused"
        ? "sbo-breathe"
        : "sbo-slump";

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/user/trading/bot", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setBot(data.bot ?? null);
    } catch {
      /* keep last known state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Close popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const update = useCallback(
    async (key: string, body: Record<string, unknown>, okMsg: string) => {
      setBusy(key);
      try {
        const res = await fetch("/api/user/trading/bot", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Update failed");
        if (data.bot) setBot(data.bot);
        toast.success(okMsg, { id: `orb-${key}` });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed", {
          id: `orb-${key}`,
        });
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const setState = (s: BotState) =>
    update(`state-${s}`, { state: s }, `Bot ${s}`);

  const toggleEmergency = () =>
    update(
      "emergency",
      { emergencyStop: !emergency },
      emergency ? "Emergency stop cleared" : "EMERGENCY STOP ENGAGED"
    );

  const toggleAutomation = () =>
    update(
      "automation",
      { automationEnabled: !automation },
      automation ? "Automation disabled" : "Automation enabled"
    );

  const onConfigure = () => setOpen(false);

  // Don't render on the trading-setup page itself — controls already live there.
  if (pathname?.startsWith("/UserDashboard/trading-setup")) return null;

  return (
    <div ref={wrapRef} className="fixed bottom-24 right-2 z-50 lg:bottom-10 lg:right-4">
      <style>{CSS}</style>

      {/* ── Popover ── */}
      <div
        className={`absolute bottom-full right-0 mb-4 w-80 max-w-[calc(100vw-2rem)] origin-bottom-right transition-all duration-200 sm:w-90 ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-2 scale-95 opacity-0"
        }`}
      >
        <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-background/90 shadow-2xl shadow-violet-950/30 backdrop-blur-2xl">
          {/* soft purple glow — match header & sidebar */}
          <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-violet-600/20 blur-[70px]" />

          {/* Header */}
          <div className="relative flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-violet-600/10 to-purple-600/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className={`relative flex h-11 w-11 shrink-0 items-end justify-center rounded-xl border bg-gradient-to-br ${display.orb} ${display.ring}`}
              >
                <BotFace anim={anim} variant="header" />
                <span
                  className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-background ${display.dot} ${effective === "running" && !emergency ? "animate-pulse" : ""}`}
                />
              </span>
              <div>
                <p className={`${plexMono.className} text-[10px] uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
                  [ // Bot Control ]
                </p>
                <p className="text-base font-extrabold leading-tight">
                  {emergency ? "Emergency Stop" : `${display.label} Bot`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="cursor-pointer self-start rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* State toggles */}
          <div className="relative space-y-1 p-3">
            <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Bot state
            </p>
            <StateToggle
              icon={<Play className="h-4 w-4" />}
              label="Start Bot"
              desc="Begin executing signals"
              on={state === "running"}
              tone="emerald"
              disabled={busy !== null || emergency}
              onClick={() => setState("running")}
            />
            <StateToggle
              icon={<Pause className="h-4 w-4" />}
              label="Pause Bot"
              desc="Hold positions, stop new entries"
              on={state === "paused"}
              tone="amber"
              disabled={busy !== null || emergency || state === "stopped"}
              onClick={() => setState(state === "paused" ? "running" : "paused")}
            />
            <StateToggle
              icon={<Square className="h-4 w-4" />}
              label="Stop Bot"
              desc="Fully shut down the bot"
              on={state === "stopped"}
              tone="zinc"
              disabled={busy !== null}
              onClick={() => setState("stopped")}
            />
          </div>

          {/* Toggles */}
          <div className="relative space-y-1 border-t border-border/60 px-3 py-3">
            <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Safety
            </p>
            <ToggleRow
              icon={<ShieldAlert className="h-4 w-4" />}
              label="Automation"
              desc={automation ? "Signals will execute" : "Signals ignored"}
              on={automation}
              disabled={busy !== null || emergency}
              onClick={toggleAutomation}
            />
            <ToggleRow
              icon={<OctagonX className="h-4 w-4" />}
              label="Emergency Stop"
              desc={emergency ? "All execution halted" : "Kill switch"}
              on={emergency}
              danger
              disabled={busy !== null}
              onClick={toggleEmergency}
            />
          </div>

          {/* Footer */}
          <Link
            href="/UserDashboard/trading-setup"
            onClick={onConfigure}
            className="group relative flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-violet-600 transition-colors hover:bg-violet-500/10 dark:text-violet-400"
          >
            <span className="flex items-center gap-1.5">
              <Zap className="h-4 w-4" /> Full controls
            </span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* ── Orb button ── */}
      <div className="sbo-float group/orb relative">
        {/* hover label (hidden while the popover is open) */}
        {!open && (
          <span
            className={`pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-xl border border-violet-500/25 bg-background/90 px-3 py-1.5 opacity-0 shadow-lg shadow-violet-950/20 backdrop-blur-md transition-all duration-200 group-hover/orb:translate-x-0 group-hover/orb:opacity-100 sm:flex`}
          >
            <span className={`h-2 w-2 rounded-full ${display.dot}`} />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              {display.label}
            </span>
            <span className={`${plexMono.className} text-[10px] uppercase text-muted-foreground`}>
              · {env}
            </span>
          </span>
        )}

        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={`Bot status: ${display.label}. Click for controls.`}
          aria-expanded={open}
          className="group relative block h-13 w-13 cursor-pointer rounded-full transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          {/* rotating dashed orbit ring */}
          <span
            className={`absolute -inset-1 rounded-full border-2 border-dashed ${display.ring} animate-[spin_5s_linear_infinite]`}
          />
          {/* pulse ring while running */}
          {effective === "running" && !emergency && (
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
          )}
          {emergency && (
            <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/30" />
          )}
          {/* core */}
          <span
            className={`absolute inset-[5px] rounded-full bg-gradient-to-br ${display.orb} shadow-inner ring-1 ring-white/20 ${
              loading ? "animate-pulse" : ""
            }`}
          >
            {/* glossy highlight */}
            <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.45),transparent_45%)]" />
            <BotFace anim={anim} variant="orb" />
          </span>
        </button>
      </div>
    </div>
  );
}

/* ───────────────── Sub-components ───────────────── */

/** Your bot character (public/shillmonger-bot.png), animated by status. Falls back to the Bot icon. */
function BotFace({ anim, variant }: { anim: string; variant: "orb" | "header" }) {
  const [ok, setOk] = useState(true);

  if (!ok) {
    return (
      <span className="absolute inset-0 flex items-center justify-center">
        <BotMessageSquare className={`text-white drop-shadow ${variant === "orb" ? "h-7 w-7" : "h-5 w-5"}`} />
      </span>
    );
  }

  return (
    <span className="absolute inset-0 flex items-end justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BOT_AVATAR}
        alt=""
        draggable={false}
        onError={() => setOk(false)}
        className={`select-none object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] ${anim} ${
          variant === "orb" ? "h-[112%] w-auto pb-[1px]" : "h-[110%] w-auto"
        }`}
      />
    </span>
  );
}

function StateToggle({
  icon,
  label,
  desc,
  on,
  tone,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  on: boolean;
  tone: "emerald" | "amber" | "zinc";
  disabled?: boolean;
  onClick: () => void;
}) {
  const tones = {
    emerald: {
      chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      track: "bg-emerald-500",
    },
    amber: {
      chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      track: "bg-amber-500",
    },
    zinc: {
      chip: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400",
      track: "bg-zinc-500",
    },
  } as const;
  const t = tones[tone];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "border-violet-500/20 bg-muted/30" : "border-transparent"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.chip}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-tight">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {desc}
        </span>
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          on ? t.track : "bg-muted-foreground/25"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            on ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function ToggleRow({
  icon,
  label,
  desc,
  on,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  on: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        on
          ? danger
            ? "border-rose-500/25 bg-rose-500/5"
            : "border-violet-500/20 bg-muted/30"
          : "border-transparent"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          danger
            ? on
              ? "bg-rose-500/20 text-rose-500"
              : "bg-muted text-muted-foreground"
            : on
              ? "bg-violet-500/20 text-violet-500"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-tight">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {desc}
        </span>
      </span>
      {/* switch */}
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          on
            ? danger
              ? "bg-rose-500"
              : "bg-gradient-to-r from-violet-600 to-purple-600"
            : "bg-muted-foreground/25"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            on ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}