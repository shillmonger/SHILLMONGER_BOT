"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/useMounted";
import { IBM_Plex_Mono } from "next/font/google";
import {
  User,
  Lock,
  Mail,
  Globe,
  Phone,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Image as ImageIcon,
  X,
  Palette,
  Moon,
  Sun,
  CalendarDays,
  BadgeCheck,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

// --- Types ---
interface PersonalInfo {
  username: string;
  email: string;
  phone: string;
  country: string;
  profileImage: string;
  emailVerified: boolean;
  createdAt: string;
  role: string;
  status: string;
}

interface UserData {
  _id: string;
  username: string;
  email: string;
  role: string;
  emailVerified: boolean;
  status: string;
  avatar: string;
  phone?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

// Maps legacy "/PFP_IMG/<n>.jfif" paths to the renamed "pfp<n>.jpg" files.
const normalizeAvatarPath = (avatar?: string | null): string | undefined =>
  avatar?.replace(/\/PFP_IMG\/(\d+)\.jfif$/i, "/PFP_IMG/pfp$1.jpg");

// --- Shared styles ---
const inputCls =
  "w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 ring-violet-500/20 placeholder:text-muted-foreground/60";
const readOnlyCls =
  "w-full bg-muted/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-muted-foreground cursor-not-allowed opacity-70";
const labelCls =
  "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
const primaryBtn =
  "w-full gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 p-5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-purple-500";

// --- Small building blocks ---
function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/20 to-purple-600/10 text-violet-600 dark:text-violet-400">
        {icon}
      </span>
      <div>
        <CardTitle className="text-sm font-extrabold uppercase tracking-wider">
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="mt-1 text-xs">
            {description}
          </CardDescription>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <Field label={label} icon={<Lock className="w-4 h-4" />}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        className={`${inputCls} pr-10`}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </Field>
  );
}

function InfoRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <span className="text-violet-600 dark:text-violet-400">{icon}</span>
        {label}
      </span>
      {children}
    </div>
  );
}

const pillBase =
  "px-2.5 py-0.5 rounded-full font-bold uppercase border text-[10px] tracking-wider";
const pillGood =
  "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-500/20";
const pillWarn =
  "bg-amber-500/10 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-500/20";
const pillBad =
  "bg-red-500/10 text-red-700 dark:bg-red-950/50 dark:text-red-400 border-red-500/20";
const pillPurple =
  "bg-violet-500/10 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border-violet-500/25";

// Simple client-side strength meter (display only — no backend involved).
function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ["Weak", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[score] };
}

export default function UserSettingsPage() {
  // --- Theme state ---
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();
  const darkMode = theme === "dark";
  const toggleTheme = () => setTheme(darkMode ? "light" : "dark");

  // --- Personal Info State ---
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    username: "",
    email: "",
    phone: "",
    country: "",
    profileImage: "",
    emailVerified: false,
    createdAt: "",
    role: "user",
    status: "active",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // --- Password States ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // --- Danger Zone / Delete Account State ---
  const [deleteInput, setDeleteInput] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // --- Profile Image Picker State ---
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  const [availableImages, setAvailableImages] = useState<string[]>([]);

  // --- Fetch User Data ---
  useEffect(() => {
    const fetchPfpImages = async () => {
      try {
        const response = await fetch('/api/pfp-images');
        const data = await response.json();
        if (response.ok && Array.isArray(data.images)) {
          setAvailableImages(data.images);
        }
      } catch (error) {
        console.error('Error fetching profile images:', error);
      }
    };

    fetchPfpImages();

    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/user/me');
        const data = await response.json();

        if (response.ok && data.user) {
          const user: UserData = data.user;
          setPersonalInfo({
            username: user.username,
            email: user.email,
            phone: user.phone || "",
            country: user.country || "",
            profileImage: normalizeAvatarPath(user.avatar) || "/PFP_IMG/pfp14.jpg",
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
            role: user.role,
            status: user.status,
          });
        } else {
          toast.error('Failed to load user data');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Failed to load user data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // --- Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPersonalInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);

    try {
      const response = await fetch('/api/user/update-profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: personalInfo.username,
          phone: personalInfo.phone,
          country: personalInfo.country,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update local state with the returned data
        if (data.user) {
          setPersonalInfo(prev => ({
            ...prev,
            username: data.user.username,
            phone: data.user.phone || "",
            country: data.user.country || "",
          }));
        }
        toast.success("Profile details updated successfully");
      } else {
        toast.error(data.error || "Failed to update profile");
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error("Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const response = await fetch('/api/user/update-password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        toast.success("Your password has been changed successfully");
      } else {
        toast.error(data.error || "Failed to update password");
      }
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error("Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteInput !== "DELETE") {
      toast.error("Please type DELETE to confirm account closure.");
      return;
    }

    if (!deletePassword) {
      toast.error("Please enter your password to confirm account deletion.");
      return;
    }

    setIsDeletingAccount(true);

    try {
      const response = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: deletePassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setDeleteInput("");
        setDeletePassword("");
        // Redirect to home page after successful deletion
        window.location.href = '/';
      } else {
        toast.error(data.error || "Failed to delete account");
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error("Failed to delete account");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleImageSelect = async (imagePath: string) => {
    setIsUpdatingImage(true);
    try {
      const response = await fetch('/api/user/update-profile-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profileImage: imagePath }),
      });

      const data = await response.json();

      if (response.ok) {
        setPersonalInfo((prev) => ({ ...prev, profileImage: normalizeAvatarPath(data.avatar) || imagePath }));
        toast.success("Profile image updated successfully");
        setShowImagePicker(false);
      } else {
        toast.error(data.error || "Failed to update profile image");
      }
    } catch (error) {
      console.error('Error updating profile image:', error);
      toast.error("Failed to update profile image");
    } finally {
      setIsUpdatingImage(false);
    }
  };

  const strength = getPasswordStrength(newPassword);
  const strengthColor =
    strength.score <= 1
      ? "bg-red-500"
      : strength.score === 2
        ? "bg-amber-500"
        : strength.score === 3
          ? "bg-violet-500"
          : "bg-emerald-500";

  const statusPill =
    personalInfo.status === "active"
      ? pillGood
      : personalInfo.status === "suspended"
        ? pillWarn
        : pillBad;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl space-y-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : (
          <>
            {/* Page header */}
            <div>
              <p
                className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}
              >
                [ // ACCOUNT ]
              </p>
              <h1 className="mt-1 text-2xl md:text-3xl font-extrabold uppercase tracking-tight">
                Account{" "}
                <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">
                  Settings
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Update credentials and manage account settings
              </p>
            </div>

            {/* Profile hero */}
            <Card className="overflow-hidden border-violet-500/20 shadow-sm p-0 gap-0">
              <div className="relative h-28 bg-gradient-to-r from-violet-700 via-violet-600 to-purple-600">
                <div className="pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 right-10 h-48 w-48 rounded-full bg-purple-900/40 blur-3xl" />
              </div>

              <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
                <div className="relative -mt-14 h-30 w-30 shrink-0">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-xl shadow-violet-900/20">
                    {personalInfo.profileImage ? (
                      <img
                        src={personalInfo.profileImage}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10 text-muted-foreground" />
                    )}
                  </div>

                  <button
                    onClick={() => setShowImagePicker(true)}
                    className="absolute -bottom-2 -right-2 cursor-pointer rounded-full border-2 border-background bg-gradient-to-r from-violet-600 to-purple-600 p-2 text-white shadow-lg shadow-violet-900/40 transition-transform hover:scale-110"
                    aria-label="Change profile image"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className="min-w-0 flex-1 sm:pb-1">
                  <h2 className="truncate text-xl font-extrabold uppercase tracking-tight">
                    {personalInfo.username || "User Account"}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {personalInfo.email || "user@example.com"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 sm:pb-1">
                  <span className={`${pillBase} ${pillPurple}`}>
                    {personalInfo.role?.toUpperCase() || "USER"}
                  </span>
                  <span
                    className={`${pillBase} ${personalInfo.emailVerified ? pillGood : pillBad}`}
                  >
                    {personalInfo.emailVerified ? "VERIFIED" : "UNVERIFIED"}
                  </span>
                </div>
              </div>
            </Card>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT: forms */}
              <div className="lg:col-span-2 space-y-6">
                {/* Personal Information */}
                <Card className="border-border/50 shadow-sm">
                  <CardHeader>
                    <SectionTitle
                      icon={<User className="w-4 h-4" />}
                      title="Personal Information"
                      description="Manage your active contact information"
                    />
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleProfileUpdate} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Field label="Username" icon={<User className="w-4 h-4" />}>
                          <input
                            name="username"
                            type="text"
                            value={personalInfo.username}
                            readOnly
                            className={readOnlyCls}
                          />
                        </Field>

                        <Field label="Email Address" icon={<Mail className="w-4 h-4" />}>
                          <input
                            name="email"
                            type="email"
                            value={personalInfo.email}
                            readOnly
                            className={readOnlyCls}
                          />
                        </Field>

                        <Field label="Country" icon={<Globe className="w-4 h-4" />}>
                          <input
                            name="country"
                            type="text"
                            value={personalInfo.country}
                            onChange={handleInputChange}
                            className={inputCls}
                          />
                        </Field>

                        <Field label="Phone Number" icon={<Phone className="w-4 h-4" />}>
                          <input
                            name="phone"
                            type="tel"
                            value={personalInfo.phone}
                            onChange={handleInputChange}
                            className={inputCls}
                          />
                        </Field>
                      </div>

                      <Button
                        type="submit"
                        disabled={isUpdatingProfile}
                        className={primaryBtn}
                      >
                        {isUpdatingProfile ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Credentials & Password */}
                <Card className="border-border/50 shadow-sm">
                  <CardHeader>
                    <SectionTitle
                      icon={<Lock className="w-4 h-4" />}
                      title="Credentials & Password"
                      description="Change your current portal password"
                    />
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handlePasswordUpdate} className="space-y-6">
                      <div className="space-y-5">
                        <PasswordField
                          label="Current Password"
                          value={currentPassword}
                          onChange={setCurrentPassword}
                          show={showCurrentPassword}
                          onToggle={() => setShowCurrentPassword(!showCurrentPassword)}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <PasswordField
                            label="New Password"
                            value={newPassword}
                            onChange={setNewPassword}
                            show={showNewPassword}
                            onToggle={() => setShowNewPassword(!showNewPassword)}
                          />
                          <PasswordField
                            label="Confirm New Password"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            show={showConfirmPassword}
                            onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                          />
                        </div>

                        {newPassword && (
                          <div className="space-y-1.5">
                            <div className="flex gap-1.5">
                              {[1, 2, 3, 4].map((i) => (
                                <span
                                  key={i}
                                  className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.score ? strengthColor : "bg-muted"
                                    }`}
                                />
                              ))}
                            </div>
                            <p
                              className={`${plexMono.className} text-[10px] text-muted-foreground`}
                            >
                              Strength: {strength.label} · use 8+ characters, mixed case, a number and a symbol
                            </p>
                          </div>
                        )}
                      </div>

                      <Button
                        type="submit"
                        disabled={isUpdatingPassword}
                        className={primaryBtn}
                      >
                        {isUpdatingPassword ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Changing Password...
                          </>
                        ) : (
                          "Update Password"
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT: overview + appearance */}
              <div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
                <Card className="border-border/50 shadow-sm">
                  <CardHeader>
                    <SectionTitle
                      icon={<ShieldCheck className="w-4 h-4" />}
                      title="Account Overview"
                    />
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <InfoRow label="Access Level" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                      <span className={`${pillBase} ${pillPurple}`}>
                        {personalInfo.role?.toUpperCase() || "USER"}
                      </span>
                    </InfoRow>
                    <InfoRow label="Identity" icon={<BadgeCheck className="w-3.5 h-3.5" />}>
                      <span
                        className={`${pillBase} ${personalInfo.emailVerified ? pillGood : pillBad}`}
                      >
                        {personalInfo.emailVerified ? "VERIFIED" : "UNVERIFIED"}
                      </span>
                    </InfoRow>
                    <InfoRow label="Status" icon={<Check className="w-3.5 h-3.5" />}>
                      <span className={`${pillBase} ${statusPill}`}>
                        {personalInfo.status?.toUpperCase() || "ACTIVE"}
                      </span>
                    </InfoRow>
                    <InfoRow label="Joined" icon={<CalendarDays className="w-3.5 h-3.5" />}>
                      <span className={`${pillBase} ${pillPurple}`}>
                        {personalInfo.createdAt
                          ? new Date(personalInfo.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                          : 'N/A'}
                      </span>
                    </InfoRow>
                  </CardContent>
                </Card>

                {/* Appearance */}
                <Card className="border-border/50 shadow-sm">
                  <CardHeader>
                    <SectionTitle
                      icon={<Palette className="w-4 h-4" />}
                      title="Appearance"
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div>
                        <p className="text-sm font-bold">Dark Mode</p>
                        <p className="text-[11px] text-muted-foreground">
                          Switch between light and dark
                        </p>
                      </div>
                      {mounted ? (
                        <button
                          onClick={toggleTheme}
                          className={`relative w-14 h-8 rounded-full cursor-pointer border border-border transition-colors ${darkMode ? "bg-gradient-to-r from-violet-600 to-purple-600" : "bg-muted"}`}
                          aria-label="Toggle dark mode"
                        >
                          <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform flex items-center justify-center ${darkMode ? "translate-x-6" : "translate-x-1"}`}>
                            {darkMode ? <Moon className="w-3.5 h-3.5 text-violet-700" /> : <Sun className="w-3.5 h-3.5 text-yellow-500" />}
                          </div>
                        </button>
                      ) : (
                        <div className="relative w-14 h-8 rounded-full border border-border bg-muted">
                          <div className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform flex items-center justify-center translate-x-1">
                            <Sun className="w-3.5 h-3.5 text-yellow-500" />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Danger Zone */}
            <Card className="border-red-500/40 shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-red-600 dark:text-red-400">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-red-600 dark:text-red-400">
                      Danger Zone
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      Once you delete your account, there is no going back. Please be certain.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDeleteAccount} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                        Type <span className="font-mono bg-red-500/10 px-1 py-0.5 rounded-lg border border-red-500/20 text-red-600 dark:text-red-400">DELETE</span> to confirm
                      </label>
                      <input
                        type="text"
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        placeholder="DELETE"
                        className="w-full bg-background border border-red-500/50 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-red-500/20 outline-none transition"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                        Enter your password
                      </label>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Your password"
                        className="w-full bg-background border border-red-500/50 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-red-500/20 outline-none transition"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isDeletingAccount || deleteInput !== "DELETE" || !deletePassword}
                    className="w-full gap-2 rounded-xl bg-red-600 p-5 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-700 disabled:opacity-30"
                  >
                    {isDeletingAccount ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" /> Delete Account
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Profile Image Picker Modal */}
      {showImagePicker && (
        <div className="fixed inset-0 z-500">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowImagePicker(false)}
          />
          <Card
            className="absolute right-0 top-0 flex h-full w-full flex-col overflow-hidden rounded-none border-l border-violet-500/30 shadow-2xl animate-in slide-in-from-right duration-300 md:w-2/6"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex items-center justify-between space-y-0 border-b border-border bg-gradient-to-r from-violet-600/10 to-purple-600/5">
              <CardTitle className="text-sm font-extrabold uppercase tracking-tighter flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" /> Select Profile Image
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowImagePicker(false)}
                className="h-8 w-8"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {availableImages.map((imagePath) => (
                  <button
                    key={imagePath}
                    onClick={() => handleImageSelect(imagePath)}
                    disabled={isUpdatingImage}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:border-violet-500 hover:scale-[1.03] ${personalInfo.profileImage === imagePath
                        ? 'border-violet-500 ring-2 ring-violet-500/50'
                        : 'border-border'
                      } ${isUpdatingImage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <img
                      src={imagePath}
                      alt={`Profile option ${imagePath}`}
                      className="w-full h-full object-cover"
                    />
                    {personalInfo.profileImage === imagePath && (
                      <div className="absolute inset-0 bg-violet-600/25 flex items-center justify-center">
                        <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-full p-1">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>

            <div className="p-4 border-t border-border flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowImagePicker(false)}
                disabled={isUpdatingImage}
                className="rounded-full"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}