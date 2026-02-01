"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface PillChipProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  onRemove?: () => void;
  removable?: boolean;
  selected?: boolean;
  icon?: React.ReactNode;
}

const PillChip = React.forwardRef<HTMLDivElement, PillChipProps>(
  ({ className, label, onRemove, removable = false, selected = false, icon, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium transition-colors",
          selected
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "border border-black/10 bg-white/70 backdrop-blur-sm text-slate-900 hover:bg-white dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-800",
          className
        )}
        {...props}
      >
        {icon && <span className="w-4 h-4">{icon}</span>}
        <span>{label}</span>
        {removable && onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className={cn(
              "ml-0.5 w-4 h-4 rounded-full flex items-center justify-center transition-colors",
              selected
                ? "hover:bg-white/20 text-white/80 hover:text-white dark:hover:bg-slate-900/20 dark:text-slate-900/80 dark:hover:text-slate-900"
                : "hover:bg-slate-200 text-slate-500 hover:text-slate-700 dark:hover:bg-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
            aria-label={`Remove ${label}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }
);
PillChip.displayName = "PillChip";

export { PillChip };
