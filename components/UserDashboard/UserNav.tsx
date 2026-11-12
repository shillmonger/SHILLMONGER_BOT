"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  BarChart3,
  PieChart,
  Settings,
} from "lucide-react";

export default function UserNav() {
  const pathname = usePathname();
  const basePath = "/UserDashboard";

  const navItems = [
    { name: "Home", icon: LayoutDashboard, href: `${basePath}/dashboard` },
    { name: "Billing", icon: Wallet, href: `${basePath}/subscription` },
    { name: "Predict", icon: BarChart3, href: `#` },
    { name: "Analytics", icon: PieChart, href: `${basePath}/my-investments` },
    { name: "Settings", icon: Settings, href: `${basePath}/account-setting` },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-50
        flex justify-around items-center
        bg-background/95 backdrop-blur-xl
        py-2 pb-2 rounded-t-[0rem]
        border-t border-violet-500/20
        shadow-[0_-10px_40px_-15px_rgba(124,58,237,0.35)]
        lg:hidden
      "
    >
      {/* thin purple glow line on top edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

      {navItems.map(({ name, href, icon: Icon }) => {
        const active = isActive(href);

        return (
          <Link
            key={name}
            href={href}
            className={`
              flex flex-col items-center transition-all duration-300
              ${active ? "text-violet-600 dark:text-violet-400 scale-105" : "text-muted-foreground hover:text-foreground"}
            `}
          >
            <div
              className={`
                flex items-center justify-center
                w-10 h-10 rounded-lg mb-1.5
                transition-all duration-300
                ${
                  active
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-900/30"
                    : "bg-secondary/50 hover:bg-violet-500/10"
                }
              `}
            >
              <Icon className={`w-5 h-5 transition-transform ${active ? "scale-110" : ""}`} />
            </div>

            <span
              className={`text-[9px] font-black tracking-[0.15em] uppercase ${
                active ? "text-violet-600 dark:text-violet-400 opacity-100" : "opacity-60"
              }`}
            >
              {name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}