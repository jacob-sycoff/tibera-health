import type { LucideIcon } from "lucide-react";
import {
  Utensils,
  Calendar,
  ShoppingCart,
  Moon,
  Activity,
  Pill,
  BookOpen,
  Settings,
  LayoutDashboard,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  icon: LucideIcon;
  mobileLabel: string;
  sidebarLabel: string;
};

export const appNavItems: AppNavItem[] = [
  {
    href: "/",
    icon: LayoutDashboard,
    mobileLabel: "Home",
    sidebarLabel: "Dashboard",
  },
  {
    href: "/research",
    icon: BookOpen,
    mobileLabel: "Research",
    sidebarLabel: "Research",
  },
  {
    href: "/food",
    icon: Utensils,
    mobileLabel: "Food",
    sidebarLabel: "Food Tracker",
  },
  {
    href: "/planner",
    icon: Calendar,
    mobileLabel: "Plan",
    sidebarLabel: "Meal Planner",
  },
  {
    href: "/sleep",
    icon: Moon,
    mobileLabel: "Sleep",
    sidebarLabel: "Sleep Tracker",
  },
  {
    href: "/supplements",
    icon: Pill,
    mobileLabel: "Supps",
    sidebarLabel: "Supplements",
  },
  {
    href: "/shopping",
    icon: ShoppingCart,
    mobileLabel: "Shop",
    sidebarLabel: "Shopping List",
  },
  {
    href: "/symptoms",
    icon: Activity,
    mobileLabel: "Symptoms",
    sidebarLabel: "Symptoms",
  },
  {
    href: "/settings",
    icon: Settings,
    mobileLabel: "Settings",
    sidebarLabel: "Settings",
  },
];
