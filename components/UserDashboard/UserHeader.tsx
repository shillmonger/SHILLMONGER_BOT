"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Menu,
  Sun,
  Moon,
  Bell,
  BellOff,
  ArrowRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/useMounted";
import Link from "next/link";
import { IBM_Plex_Mono } from "next/font/google";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

interface HeaderProps {
  onLeftClick: () => void;
}

interface UserData {
  userName: string;
  email: string;
  avatar?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  time?: string;
  read?: boolean;
  href?: string;
}

export default function UserHeader({
  onLeftClick,
}: HeaderProps) {
  // Theme state
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();

  // Fetch user data from backend
  const [user, setUser] = useState<UserData>({
    userName: "Loading...",
    email: "",
    avatar: "https://github.com/shadcn.png",
  });
  const [isLoading, setIsLoading] = useState(true);

  // Notification count
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(true);

  // Notification dropdown
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Fetch user data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/user/info");
        const data = await response.json();

        if (data.success) {
          const userData = data.user;
          setUser({
            userName: userData.userName || "User",
            email: userData.email || "",
            avatar: userData.avatar || "",
          });

          // Fetch notification count
          await fetchNotificationCount(userData._id);
        } else {
          console.error("Failed to fetch user data:", data.error);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setIsLoading(false);
        setNotificationLoading(false);
      }
    };

    const fetchNotificationCount = async (userId: string) => {
      try {
        // TODO: Implement notification count when API endpoints are available
        // Currently commented out due to missing API routes
        setNotificationCount(0);
        setNotifications([]);
      } catch (error) {
        console.error("Error fetching notification count:", error);
        setNotificationCount(0);
        setNotifications([]);
      }
    };

    fetchData();
  }, []);

  // Close notification dropdown on outside click / Escape
  useEffect(() => {
    if (!notifOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [notifOpen]);

  // Default profile image constant
  const defaultProfileImage = "https://github.com/shadcn.png";

  return (
    <header className="relative h-15 lg:h-15 overflow-hidden border-b border-border flex items-center justify-between gap-4 px-4 sm:px-10 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      {/* soft purple glow — matches UserSidebar */}
      <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-violet-600/15 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-purple-600/10 blur-[80px]" />
      <div className="relative flex items-center gap-3 flex-shrink-0">
        <button
          className="lg:hidden p-2 rounded-xl hover:bg-violet-500/10 transition-colors"
          onClick={onLeftClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="space-y-0.5">
          <p
            className={`${plexMono.className} text-[8px] md:text-[10px] text-violet-600 dark:text-violet-400 font-medium uppercase tracking-[0.2em] hidden xs:block`}
          >
            [ // Member Experience ]
          </p>
        </div>
      </div>

      <div className="relative flex items-center gap-2 sm:gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg cursor-pointer bg-secondary hover:bg-violet-500/15 transition-colors"
          title="Toggle theme"
        >
          {mounted &&
            (theme === "dark" ? (
              <Sun className="w-5 h-5 text-white" />
            ) : (
              <Moon className="w-5 h-5 text-foreground" />
            ))}
        </button>

        {/* Notification Bell + Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={notifOpen}
            aria-label="Notifications"
            className={`p-2 rounded-lg relative cursor-pointer transition-colors ${notifOpen
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-900/30"
                : "bg-secondary hover:bg-violet-500/15"
              }`}
          >
            <Bell className="h-5 w-5" />

            {!notificationLoading && notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center border-2 border-background leading-none">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-3 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-violet-500/20 bg-background shadow-2xl shadow-violet-900/20 z-50">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-violet-600/10 to-purple-600/5 px-4 py-3">
                <p className="text-xs font-extrabold uppercase tracking-widest text-foreground">
                  Notifications
                </p>
                {notificationCount > 0 && (
                  <span
                    className={`${plexMono.className} rounded-full bg-violet-600/15 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400`}
                  >
                    {notificationCount} new
                  </span>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {notificationLoading ? (
                  <div className="space-y-3 p-4">
                    <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-2 w-56 animate-pulse rounded bg-muted" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-500/25 bg-violet-500/10">
                      <BellOff className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      You&apos;re all caught up
                    </p>
                    <p className="text-xs text-muted-foreground">
                      No new notifications right now.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <Link
                          href={n.href || "/UserDashboard/notifications"}
                          onClick={() => setNotifOpen(false)}
                          className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-violet-500/10"
                        >
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-violet-500"
                              }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-foreground">
                              {n.title}
                            </p>
                            {n.message && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {n.message}
                              </p>
                            )}
                            {n.time && (
                              <p
                                className={`${plexMono.className} mt-1 text-[10px] text-muted-foreground/70`}
                              >
                                {n.time}
                              </p>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer */}
              <Link
                href="/UserDashboard/notifications"
                onClick={() => setNotifOpen(false)}
                className="group flex items-center justify-center gap-2 border-t border-border px-4 py-3 text-xs font-extrabold uppercase tracking-widest text-violet-600 transition-colors hover:bg-violet-500/10 dark:text-violet-400"
              >
                View all notifications
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          )}
        </div>

        {/* User Details - No dropdown */}
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="hidden sm:block text-right">
            {!isLoading ? (
              <>
                <p className="text-xs font-black uppercase tracking-widest text-foreground">{user.userName}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{user.email}</p>
              </>
            ) : (
              <>
                <div className="h-3 w-20 bg-muted animate-pulse rounded mb-1" />
                <div className="h-2 w-28 bg-muted animate-pulse rounded" />
              </>
            )}
          </div>
          <Avatar className="h-10 w-10 border-2 border-violet-500/30 rounded-lg">
            <AvatarImage
              src={user.avatar || defaultProfileImage}
              alt={user.userName}
              className="rounded-lg"
            />
            <AvatarFallback className="bg-gradient-to-br from-violet-600 to-purple-600 text-white font-semibold rounded-lg">
              {user.userName?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}