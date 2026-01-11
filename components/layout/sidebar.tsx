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
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const sidebarItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/food", label: "Food Tracker", icon: Utensils },
  { href: "/planner", label: "Meal Planner", icon: Calendar },
  { href: "/shopping", label: "Shopping List", icon: ShoppingCart },
  { href: "/sleep", label: "Sleep Tracker", icon: Moon },
  { href: "/symptoms", label: "Symptoms", icon: Activity },
  { href: "/supplements", label: "Supplements", icon: Pill },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "w-64 border-r border-gray-200 bg-white flex flex-col",
        className
      )}
    >
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">Tibera</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {sidebarItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="px-3 py-2 text-xs text-gray-500">
          Tibera Health v1.0.0
        </div>
      </div>
    </aside>
  );
}
