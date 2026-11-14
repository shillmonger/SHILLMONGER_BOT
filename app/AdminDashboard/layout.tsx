"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { usePathname } from "next/navigation";
import ShillmongerLoader from "@/components/ShillmongerLoader";
import AdminHeader from "@/components/AdminDashboard/AdminHeader";
import AdminNav from "@/components/AdminDashboard/AdminNav";
import AdminSidebar from "@/components/AdminDashboard/AdminSidebar";
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

export default function AdminDashboardLayout({
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
      <AdminSidebar
        sidebarOpen={leftSidebarOpen}
        setSidebarOpen={setLeftSidebarOpen}
      />

      {/* 2. Main Area Wrapper (Holds Header + Page Content) */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Header spanning only the right side */}
        <header className="w-full shrink-0 z-40">
          <AdminHeader onLeftClick={() => setLeftSidebarOpen(true)} />
        </header>

        {/* Scrollable Main Content */}
        <main className="relative flex-1 min-w-0 overflow-y-auto px-4 pb-20 lg:px-6 lg:pb-6 scrollbar-hide">
          <Suspense fallback={<SuspenseFallback onPending={handlePendingChange} />}>
            {children}
          </Suspense>

          {(minLoading || contentPending) && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background">
              <ShillmongerLoader className="w-full max-w-md" label="Loading page" />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <AdminNav />
    </div>
    </MainContentLoadingContext.Provider>
  );
}
