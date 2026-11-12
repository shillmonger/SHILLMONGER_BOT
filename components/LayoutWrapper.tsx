"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/LandingPage/Header";
import FloatingSidebar from "@/components/LandingPage/FloatingSidebar";
import Footer from "@/components/LandingPage/Footer";
import Discount from "@/components/LandingPage/Discount";
import PromoBanner from "@/components/LandingPage/PromoBanner";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/auth-page");
  const isUserDashboard = pathname?.startsWith("/UserDashboard");
  const isAdminDashboard = pathname?.startsWith("/AdminDashboard");

  if (isAuthPage || isUserDashboard || isAdminDashboard) {
    return <>{children}</>;
  }

  return (
    <>
      <PromoBanner />
      <div className="hidden md:block">
        <FloatingSidebar />
      </div>
      {/* Spacer so page content isn't hidden behind the fixed banner (h-8 = banner height) */}
      <div className="h-5" aria-hidden="true" />
      <Header />
      {children}
      <Footer />
      <Discount />
    </>
  );
}