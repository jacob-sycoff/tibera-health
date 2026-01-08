"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Utensils,
  Calendar,
  ShoppingCart,
  Moon,
  Activity,
  Pill,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/food", label: "Food", icon: Utensils },
  { href: "/planner", label: "Plan", icon: Calendar },
  { href: "/sleep", label: "Sleep", icon: Moon },
  { href: "/supplements", label: "Supps", icon: Pill },
];

interface NavigationProps {
  className?: string;
}

export function Navigation({ className }: NavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border",
        className
      )}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors",
                isActive
                  ? "text-primary-600"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
