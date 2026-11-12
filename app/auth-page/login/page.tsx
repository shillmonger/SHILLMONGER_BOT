"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setTimeout(() => {
          router.push("/UserDashboard/dashboard");
        }, 1000);
      } else {
        toast.error(data.error || "Login failed");
      }
    } catch (error) {
      toast.error("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  const socialBtn =
    "h-11 rounded-2xl cursor-pointer bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-foreground border border-neutral-200 dark:border-neutral-700 transition-all";

  const inputCls =
    "h-12 px-5 text-sm rounded-full border border-neutral-300 dark:border-neutral-700 bg-background text-foreground focus-visible:ring-0 focus-visible:border-violet-500 placeholder:text-neutral-400 dark:placeholder:text-neutral-500";

  return (
    <div className="min-h-screen w-full bg-background text-foreground lg:grid lg:grid-cols-2">
      {/* ───────── Left: form (follows light / dark theme) ───────── */}
      <div className="relative flex min-h-screen flex-col px-6 py-10 sm:px-10">
        {/* Logo - mobile only (right panel is hidden) */}
        <Link href="/" className="lg:hidden mx-auto">
          <Image
            src="/logo.png"
            alt="Shillmonger"
            width={180}
            height={48}
            priority
            className="h-10 w-auto"
          />
        </Link>

        <div className="flex flex-1 flex-col justify-center">
          <div className="w-full max-w-md mx-auto">
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                Welcome Back
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1 mb-10">
                Login to your account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Email */}
              <div className="grid gap-2">
                <Label htmlFor="email" className="sr-only">
                  Your email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="text"
                  placeholder="Enter your email"
                  disabled={isLoading}
                  required
                  className={inputCls}
                />
              </div>

              {/* Password */}
              <div className="grid gap-2">
                <Label htmlFor="password" className="sr-only">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    required
                    className={`${inputCls} pr-14`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-5 flex items-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-200 focus:outline-none cursor-pointer"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>

                <div className="flex justify-end">
                  <Link
                    href="/auth-page/forgot-password"
                    className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 mt-1 rounded-full text-sm font-bold cursor-pointer bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-900/30 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              {/* Divider */}
              <div className="relative text-center text-xs font-medium my-1 after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-neutral-200 dark:after:border-neutral-700">
                <span className="relative z-10 bg-background px-3 text-muted-foreground">
                  or continue with
                </span>
              </div>

              {/* Social row */}
              <div className="grid grid-cols-3 gap-3">
                <Button type="button" className={socialBtn}>
                  <svg
                    className="h-6 w-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.847h-7.406l-5.8-7.584-6.637 7.584H.474l8.6-9.83L0 1.153h7.594l5.243 6.932 6.064-6.932zM17.61 20.644h2.039L6.486 3.24H4.298z" />
                  </svg>
                  <span className="sr-only">Continue with X</span>
                </Button>

                <Button type="button" className={socialBtn}>
                  <svg className="h-6 w-6" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path
                      fill="#FFC107"
                      d="M43.611 20.083H42V20H24v8h11.303C33.655 32.657 29.207 36 24 36c-6.627 0-12-5.373-12-12S17.373 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.27 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.27 4 24 4c-7.682 0-14.348 4.337-17.694 10.691z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.104 0 9.799-1.957 13.355-5.145l-6.169-5.22C29.125 35.091 26.673 36 24 36c-5.186 0-9.623-3.326-11.283-7.946l-6.52 5.025C9.505 39.556 16.227 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.611 20.083H42V20H24v8h11.303c-1.058 2.996-3.202 5.379-6.117 6.635l6.169 5.22C38.999 36.564 44 31 44 24c0-1.341-.138-2.65-.389-3.917z"
                    />
                  </svg>
                  <span className="sr-only">Continue with Google</span>
                </Button>

                <Button type="button" className={socialBtn}>
                  <svg
                    className="h-6 w-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span className="sr-only">Continue with Facebook</span>
                </Button>
              </div>

              {/* Register link */}
              <div className="text-center text-sm font-medium text-muted-foreground mt-3">
                Don&apos;t have an account?{" "}
                <Link
                  href="/auth-page/register"
                  className="font-bold text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 transition-colors"
                >
                  Sign up
                </Link>
              </div>
            </form>
          </div>
        </div>

        {/* Legal footer */}
        <div className="w-full max-w-md mx-auto mt-8 text-center text-xs font-medium text-muted-foreground leading-relaxed">
          By clicking continue, you agree to our{" "}
          <Link href="#" className="font-semibold text-foreground hover:text-foreground/80 transition-colors">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="#" className="font-semibold text-foreground hover:text-foreground/80 transition-colors">
            Privacy Policy
          </Link>
          .
        </div>
      </div>

      {/* ───────── Right: purple hero panel with video ───────── */}
      <div className="hidden lg:block p-3">
        <div className="relative flex h-full min-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-700 via-violet-600 to-purple-700 pl-12 pt-12">
          {/* soft blurred blobs for depth */}
          <div className="pointer-events-none absolute -top-16 -left-16 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-purple-900/40 blur-3xl" />

          {/* Logo */}
          <Link href="/" className="relative z-10 w-fit">
            <Image
              src="/logo1.png"
              alt="Shillmonger"
              width={250}
              height={60}
              priority
              className="h-17 w-auto"
            />
          </Link>

          {/* Headline */}
          <div className="relative z-10 mt-10 pr-12 text-white">
            <p className="text-sm font-semibold text-violet-200 mb-3">
              You can easily
            </p>
            <h2 className="text-4xl xl:text-4xl font-extrabold leading-[1.1] tracking-tight">
              Get access to your personal hub for clarity and productivity
            </h2>
          </div>

          {/* Video - bleeds off the bottom-right like a dashboard preview */}
          <div className="relative z-10 mt-10 flex-1 min-h-[260px]">
            <div className="absolute inset-0 overflow-hidden rounded-tl-2xl border-l border-t border-white/25 bg-[#0d0b26] shadow-[0_-10px_60px_rgba(0,0,0,0.45)]">
              <video
                className="h-full w-full object-cover object-left-top"
                src="/videos/MTR.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}