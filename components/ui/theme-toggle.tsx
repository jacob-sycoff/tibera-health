"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useTheme } from "@/components/ui/theme";

export function ThemeToggle({
  className,
  size = "icon",
  variant = "outline",
  ...props
}: Omit<ButtonProps, "onClick" | "children" | "aria-label">) {
  const { resolvedTheme, toggle } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      shape="pill"
      className={cn("gap-2", className)}
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      {...props}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}

