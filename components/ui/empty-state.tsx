"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
  iconClassName?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  iconClassName,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div
        className={cn(
          "w-16 h-16 rounded-[var(--radius-xl)] bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4",
          iconClassName
        )}
      >
        <Icon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
        {title}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[280px] mb-4">
        {description}
      </p>
      {action && (
        action.href ? (
          <a href={action.href}>
            <Button size="sm" variant="outline">
              {action.label}
            </Button>
          </a>
        ) : (
          <Button size="sm" variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
