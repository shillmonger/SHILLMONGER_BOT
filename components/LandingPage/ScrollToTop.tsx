"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

interface ThemeAndScrollProps {
  children?: React.ReactNode;
}

export default function ThemeAndScroll({ children }: ThemeAndScrollProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;

      setShowScrollTop(scrollTop > 200);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // run once on mount

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {children}

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="
            fixed bottom-20 left-2 lg:left-5 sm:bottom-22 sm:right-2 z-[50]
            bg-white/90 dark:bg-violet-950/80 backdrop-blur-md text-violet-700 dark:text-violet-200 border border-violet-300/60 dark:border-violet-500/30
            w-12 h-12 rounded-full
            flex items-center justify-center
            shadow-lg shadow-violet-600/10 dark:shadow-black/30
            hover:bg-gradient-to-br hover:from-violet-600 hover:to-purple-600 hover:text-white dark:hover:text-white hover:border-transparent hover:scale-110 hover:shadow-violet-600/40
            active:scale-95
            transition-all duration-300 cursor-pointer
          "
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Floating Theme Toggle Button */}
      {mounted && (
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="fixed bottom-6 left-2 lg:left-5 sm:bottom-8 sm:right-2 z-50 flex items-center justify-center w-12 h-12 rounded-xl
          bg-gradient-to-tr from-violet-800 via-violet-600 to-purple-500 text-white shadow-lg shadow-violet-600/30 transition-all duration-300
          hover:shadow-xl hover:shadow-violet-600/50 hover:scale-110 active:scale-95 cursor-pointer focus:outline-none ring-1 ring-white/20"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      )}
    </>
  );
}