"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { appNavItems } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const isActivePath = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={cn(
        "relative w-64 border-r backdrop-blur-xl flex flex-col overflow-hidden",
        "border-[color:var(--glass-border)] bg-[var(--glass-bg)]",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_0%_-15%,rgba(var(--accent-glow-rgb),0.10),transparent_55%),radial-gradient(800px_circle_at_120%_30%,rgba(2,6,23,0.08),transparent_55%)]"
      />

      {/* Logo */}
      <div className="relative p-6 border-b border-black/5 dark:border-white/5">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative h-9 w-[170px]">
            <Image
              src="/brand/tibera-logo-v2.png"
              alt="Tibera Health"
              fill
              priority
              className="object-contain"
            />
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 p-4" aria-label="Primary">
        <ul className="space-y-1">
          {appNavItems.map((item) => {
            const isActive = isActivePath(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-[18px] text-sm font-medium transition-all",
                    "pl-8 pr-3 py-2.5",
                    isActive
                      ? "bg-slate-900 text-white shadow-[0_18px_50px_-35px_rgba(2,6,23,0.75)] dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-700 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-3 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-primary-500 transition-opacity",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                    )}
                  />
                  <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
                  {item.sidebarLabel}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User & Footer */}
      <div className="relative p-4 border-t border-black/5 dark:border-white/5 space-y-3">
        {user && (
          <div className="flex items-center gap-3 px-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
              {(user.user_metadata?.full_name || user.email || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                {user.user_metadata?.full_name || "User"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user.email}
              </p>
            </div>
            <button
              onClick={signOut}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Tibera Health v1.0.0
          </div>
          <ThemeToggle size="icon-sm" variant="outline" />
        </div>
      </div>
    </aside>
  );
}
