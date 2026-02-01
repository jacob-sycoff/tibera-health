"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { appNavItems } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface NavigationProps {
  className?: string;
}

export function Navigation({ className }: NavigationProps) {
  const pathname = usePathname();

  const isActivePath = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <nav className={cn("fixed inset-x-0 bottom-0 z-40", className)} aria-label="Primary navigation">
        <div className="mx-auto max-w-md px-4 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <div
            className={cn(
              "rounded-[32px] border backdrop-blur-xl",
              "bg-[var(--glass-bg)] border-[color:var(--glass-border)] shadow-[var(--glass-shadow)]",
              "px-1 py-1"
            )}
          >
            <div className="relative">
              <div className="absolute -top-3 right-2">
                <ThemeToggle
                  size="icon-sm"
                  variant="outline"
                  className="shadow-[0_10px_30px_-18px_rgba(2,6,23,0.45)]"
                />
              </div>
            <div className="grid grid-cols-5 items-stretch">
              {appNavItems.map((item) => {
                const isActive = isActivePath(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex flex-col items-center justify-center gap-1 rounded-[26px] px-2 py-2.5 transition-colors",
                      isActive
                        ? "text-slate-900 dark:text-slate-100"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-0 rounded-[26px] transition-colors",
                        isActive
                          ? "bg-white/70 dark:bg-slate-800/60"
                          : "bg-transparent group-hover:bg-white/40 dark:group-hover:bg-slate-800/40"
                      )}
                    />
                    <Icon className={cn("relative h-5 w-5", isActive && "stroke-[2.5]")} />
                    <span
                      className={cn(
                        "relative text-[11px] leading-none tracking-tight",
                        isActive ? "font-semibold" : "font-medium"
                      )}
                    >
                      {item.mobileLabel}
                    </span>
                  </Link>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
