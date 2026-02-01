"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/supplements", label: "Tracker" },
  { href: "/supplements/research", label: "Research" },
  { href: "/supplements/guides", label: "Guides" },
  { href: "/supplements/omega-3", label: "Omega‑3" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/supplements") return pathname === "/supplements";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SupplementsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen -mx-4 lg:-mx-8 -my-6">
      {/* Section header */}
      <div className="relative border-b border-black/5 dark:border-white/10 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(900px_circle_at_15%_-10%,rgba(2,6,23,0.10),transparent_55%),radial-gradient(800px_circle_at_90%_0%,rgba(2,6,23,0.07),transparent_50%),linear-gradient(to_bottom,rgba(248,250,252,1),rgba(255,255,255,1))] dark:bg-[radial-gradient(900px_circle_at_15%_-10%,rgba(var(--accent-glow-rgb),0.10),transparent_55%),radial-gradient(800px_circle_at_90%_0%,rgba(148,163,184,0.10),transparent_55%),linear-gradient(to_bottom,rgba(2,6,23,1),rgba(15,23,42,1))]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-44 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(15,23,42,0.10),transparent_60%)] blur-3xl" />
          <div className="absolute -bottom-44 right-[-140px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(var(--accent-glow-rgb),0.14),transparent_60%)] blur-3xl" />
        </div>

        <div className="relative px-6 lg:px-10 pt-8 pb-6 max-w-7xl">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-500 dark:text-slate-400 uppercase">
              Supplements
            </p>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Supplements
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                  Track, research, and learn — all in one place.
                </p>
              </div>
              <nav className="w-full md:w-auto">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {navItems.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "shrink-0 h-10 px-4 rounded-full border text-sm font-medium transition-colors inline-flex items-center justify-center",
                          active
                            ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                            : "border-black/10 bg-white/70 text-slate-900 hover:bg-white dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100 dark:hover:bg-slate-900/70"
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Page content area */}
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,1),rgba(248,250,252,1))] dark:bg-[linear-gradient(to_bottom,rgba(15,23,42,1),rgba(2,6,23,1))]"
        />
        <div className="relative px-6 lg:px-10 py-8 max-w-7xl text-slate-900 dark:text-slate-100">
          {children}
        </div>
      </div>
    </div>
  );
}
