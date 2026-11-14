"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { usePathname } from "next/navigation";
import ShillmongerLoader from "@/components/ShillmongerLoader";
import UserNav from "@/components/UserDashboard/UserNav";
import UserLeftSidebar from "@/components/UserDashboard/UserSidebar";
import UserHeader from "@/components/UserDashboard/UserHeader";
import PromotionPopup from "@/components/UserDashboard/PromotionPopup";
import BotStatusOrb from "@/components/UserDashboard/BotStatusOrb";
import { MainContentLoadingContext } from "@/components/UserDashboard/MainContentLoading";

const MIN_LOADER_MS = 3500;

function SuspenseFallback({
  onPending,
}: {
  onPending: (pending: boolean) => void;
}) {
  useEffect(() => {
    onPending(true);
    return () => onPending(false);
  }, [onPending]);

  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <ShillmongerLoader className="w-full max-w-md" label="Loading page" />
    </div>
  );
}

export default function UserDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [minLoading, setMinLoading] = useState(true);
  const [contentPending, setContentPending] = useState(false);

  const pathname = usePathname();

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMinLoading(true);
  }

  useEffect(() => {
    const timer = setTimeout(() => setMinLoading(false), MIN_LOADER_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  const handlePendingChange = useCallback((pending: boolean) => {
    setContentPending(pending);
  }, []);

  useEffect(() => {
    const checkPromotion = () => {
      const lastShown = localStorage.getItem("lastPromotionShown");
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;

      if (!lastShown || now - parseInt(lastShown) > tenMinutes) {
        const timer = setTimeout(() => {
          setPromotionOpen(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    };

    checkPromotion();

    const interval = setInterval(() => {
      const lastShown = localStorage.getItem("lastPromotionShown");
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;

      if (!lastShown || now - parseInt(lastShown) > tenMinutes) {
        setPromotionOpen(true);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleClosePromotion = () => {
    setPromotionOpen(false);
    localStorage.setItem("lastPromotionShown", Date.now().toString());
  };

  return (
    <MainContentLoadingContext.Provider value={handlePendingChange}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        {/* 1. Left Sidebar (Takes full screen height on desktop) */}
        <UserLeftSidebar
          sidebarOpen={leftSidebarOpen}
          setSidebarOpen={setLeftSidebarOpen}
        />

        {/* 2. Main Area Wrapper (Holds Header + Page Content) */}
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          {/* Header spanning only the right side */}
          <header className="w-full shrink-0 z-40">
            <UserHeader onLeftClick={() => setLeftSidebarOpen(true)} />
          </header>

          {/* Scrollable Main Content */}

          <main className="relative isolate flex-1 min-w-0 overflow-y-auto px-4 pb-20 lg:px-6 lg:pb-6 scrollbar-hide">

            {/* Fixed animated ambient shadows */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">

              {/* Bottom-right - subtle animated glow */}
              <div className="absolute -bottom-32 -right-32 h-[450px] w-[450px] rounded-full bg-violet-500/15 blur-[120px] animate-glow-secondary" />

            </div>

            <div className="relative z-10">
              <Suspense fallback={<SuspenseFallback onPending={handlePendingChange} />}>
                {children}
              </Suspense>
            </div>

            {(minLoading || contentPending) && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-background">
                <ShillmongerLoader className="w-full max-w-md" label="Loading page" />
              </div>
            )}
          </main>

        </div>

        {/* Mobile Bottom Navigation */}
        <UserNav />

        {/* Floating bot status orb with quick controls */}
        <BotStatusOrb />

        {/* Promotion Popup */}
        <PromotionPopup isOpen={promotionOpen} onClose={handleClosePromotion} />
      </div>
    </MainContentLoadingContext.Provider>
  );
}