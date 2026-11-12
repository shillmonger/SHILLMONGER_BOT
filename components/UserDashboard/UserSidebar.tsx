"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { IBM_Plex_Mono } from "next/font/google";
import {
  LayoutDashboard,
  Settings,
  ChartCandlestick,
  Lock,
  LogOut,
  ChevronDown,
  Wallet,
  Link as LinkIcon,
  UsersRound,
  Bot,
  Trophy,
  Users,
  BarChart3,
  History,
  PieChart,
  Layers,
  X,
} from "lucide-react";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

type NavItem =
  | { name: string; icon: React.ElementType; href: string }
  | {
    name: string;
    icon: React.ElementType;
    children: { name: string; icon: React.ElementType; href: string }[];
  };

const ACTIVE_CLS =
  "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-900/30";
const IDLE_CLS =
  "text-muted-foreground hover:bg-violet-500/10 hover:text-foreground";

export default function UserSidebar({
  sidebarOpen,
  setSidebarOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userRole, setUserRole] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(10);
  const [unreadCount, setUnreadCount] = useState(0);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Earn Free USDT": true,
    Account: true,
    Withdrawals: true,
    Community: true,
  });

  const basePath = "/UserDashboard";

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch("/api/user/info");
        const data = await response.json();
        if (data.success && data.user.role) {
          setUserRole(data.user.role);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        // TODO: Implement chat messages when API endpoint is available
        // Currently commented out due to missing /api/chat/messages route
        setUnreadCount(0);
      } catch (error) {
        console.error("Error fetching unread count:", error);
        setUnreadCount(0);
      }
    };
    fetchUnreadCount();
    // Poll every 20 seconds
    const interval = setInterval(fetchUnreadCount, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showLogoutConfirm && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setShowLogoutConfirm(false);
      setCountdown(10);
    }
    return () => clearTimeout(timer);
  }, [showLogoutConfirm, countdown]);

  const navItems: NavItem[] = [
    { name: "Dashboard", icon: LayoutDashboard, href: `${basePath}/dashboard` },
    { name: "Subscription", icon: Wallet, href: `${basePath}/subscription` },
    { name: "Trading Bot Setup", icon: LinkIcon, href: `${basePath}/trading-setup` },
    { name: "Trade Signals", icon: ChartCandlestick, href: `${basePath}/signals` },
    { name: "Trade History", icon: Layers, href: `${basePath}/trade-history` },
    { name: "Transactions", icon: History, href: `${basePath}/transactions` },
    { name: "Predict Market", icon: BarChart3, href: `${basePath}/predict` },

    {
      name: "Community",
      icon: Users,
      children: [
        { name: "TG Channel", icon: UsersRound, href: `#` },
        { name: "Top Leaderboard", icon: Trophy, href: `${basePath}/leaderboard` },
      ],
    },

    { name: "Trade Analytics", icon: PieChart, href: `${basePath}/analytics` },
    {
      name: "Profile Settings",
      icon: Settings,
      href: `${basePath}/account-setting`,
    },
    ...(userRole.includes("admin")
      ? [
        {
          name: "Switch to Admin",
          icon: Lock,
          href: `/AdminDashboard/dashboard`,
        },
      ]
      : []),
  ];

  useEffect(() => {
    navItems.forEach((item) => {
      if ("children" in item) {
        const hasActive = item.children.some(
          (child) => pathname === child.href,
        );
        if (hasActive) {
          setOpenGroups((prev) => ({ ...prev, [item.name]: true }));
        }
      }
    });
  }, [pathname]);

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  /* ───────── Shared pieces ───────── */

  const Brand = () => (
    <div className="relative flex-shrink-0 flex items-center justify-start h-15 px-5 border-b border-border">
      <Link href="/UserDashboard/dashboard" className="flex flex-col gap-1">
        <Image
          src="/logo.png"
          alt="Shillmonger"
          width={160}
          height={40}
          priority
          className="h-14 w-auto self-start"
        />
      </Link>
    </div>
  );

  const renderNav = (onNavigate?: () => void) => (
    <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
      <p
        className={`${plexMono.className} px-2 pb-2 text-[9px] tracking-[0.2em] text-muted-foreground/70 uppercase`}
      >
        [ // Menu ]
      </p>

      {navItems.map((item) => {
        if ("href" in item) {
          const active = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={`group relative flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 ${active ? ACTIVE_CLS : IDLE_CLS
                }`}
            >
              <item.icon
                className={`w-5 h-5 mr-4 transition-transform ${active ? "scale-110" : "group-hover:scale-110"
                  }`}
              />
              <span className="text-[12px] font-extrabold uppercase tracking-widest">
                {item.name}
              </span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/90" />
              )}
            </Link>
          );
        }

        const isOpen = !!openGroups[item.name];
        const hasActiveChild = item.children.some((c) => pathname === c.href);

        return (
          <div key={item.name} className="flex flex-col">
            <button
              onClick={() => toggleGroup(item.name)}
              className={`group w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${hasActiveChild
                  ? "text-violet-600 dark:text-violet-400"
                  : IDLE_CLS
                }`}
            >
              <item.icon
                className={`w-5 h-5 mr-4 transition-transform ${hasActiveChild ? "scale-110" : "group-hover:scale-110"
                  }`}
              />
              <span className="flex-1 text-left text-[12px] font-extrabold uppercase tracking-widest">
                {item.name}
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""
                  }`}
              />
            </button>

            <div
              className={`${isOpen ? "block" : "hidden"} transition-all duration-300 ease-in-out`}
            >
              <div className="ml-6 mt-1 mb-1 pl-4 border-l border-violet-500/30 space-y-0.5">
                {item.children.map((child) => {
                  const childActive = pathname === child.href;
                  const isChatWithAgent = child.name === "Chat with Agent";
                  return (
                    <Link
                      key={child.name}
                      href={child.href}
                      onClick={onNavigate}
                      className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${childActive ? ACTIVE_CLS : IDLE_CLS
                        }`}
                    >
                      <child.icon
                        className={`w-4 h-4 flex-shrink-0 transition-transform ${childActive ? "scale-110" : "group-hover:scale-110"
                          }`}
                      />
                      <span className="text-[11px] font-extrabold uppercase tracking-widest">
                        {child.name}
                      </span>
                      {isChatWithAgent && unreadCount > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-violet-600 text-white text-[9px] font-black flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );

  const renderLogout = (onBefore?: () => void) => (
    <div className="flex-shrink-0 border-t border-border px-4 py-3">
      <button
        onClick={() => {
          onBefore?.();
          setShowLogoutConfirm(true);
        }}
        className="flex items-center cursor-pointer w-full px-4 py-3 text-red-500 hover:bg-red-500/10 transition-all rounded-lg group"
      >
        <LogOut className="w-5 h-5 mr-3 group-hover:-translate-x-1 transition-transform" />
        <span className="text-xs font-extrabold uppercase tracking-widest">
          Logout My Account
        </span>
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="relative hidden md:flex w-65 border-r h-screen bg-background flex-col shadow-xl overflow-hidden">
        {/* soft purple glow */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-56 w-56 rounded-full bg-violet-600/15 blur-[90px]" />
        <div className="pointer-events-none absolute bottom-10 -right-24 h-56 w-56 rounded-full bg-purple-600/10 blur-[90px]" />

        <div className="relative flex h-full flex-col">
          <Brand />
          {renderNav()}
          {renderLogout()}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed top-0 left-0 w-full h-full bg-background z-[100] flex flex-col shadow-2xl lg:hidden overflow-hidden">
            <div className="pointer-events-none absolute -top-24 -left-24 h-56 w-56 rounded-full bg-violet-600/15 blur-[90px]" />

            <div className="relative flex h-full flex-col">
              <div className="flex-shrink-0 flex items-center justify-between h-16 px-5 border-b border-border">
                <Link
                  href="/UserDashboard/dashboard"
                  className="flex flex-col gap-1"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Image
                    src="/logo.png"
                    alt="Shillmonger"
                    width={160}
                    height={40}
                    priority
                    className="h-12 w-auto self-start"
                  />
                </Link>
                <button
                  className="rounded-lg text-foreground"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderNav(() => setSidebarOpen(false))}
              {renderLogout(() => setSidebarOpen(false))}
            </div>
          </aside>
        </>
      )}

      {/* Logout Modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="bg-background/95 border border-border rounded-[1.5rem] shadow-2xl w-full max-w-sm p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-black uppercase tracking-tighter text-foreground mb-2">
              Logout?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to sign out? You'll need to log in again to
              access your account.
            </p>

            {/* Countdown Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Auto-closing in...</span>
                <span>{countdown}s</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-violet-600 to-purple-600 h-2 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / 10) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex sm:flex-row gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  setCountdown(10);
                }}
                className="flex-1 px-6 py-3 rounded-lg bg-secondary cursor-pointer text-foreground font-bold text-xs uppercase tracking-widest"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  router.push("/auth-page/login");
                  toast.success("Successfully signed out");
                  setShowLogoutConfirm(false);
                  setCountdown(10);
                }}
                className="flex-1 px-6 py-3 rounded-lg bg-red-500 cursor-pointer text-white font-bold text-xs uppercase tracking-widest hover:bg-red-600 transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}