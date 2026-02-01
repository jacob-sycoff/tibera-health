"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Sparkline } from "@/components/charts/sparkline";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  sparklineData?: number[];
  animated?: boolean;
}

/**
 * MetricCard - Saarinen-inspired data display
 *
 * Features optional sparkline visualization and organic
 * entrance animations for a living, breathing interface.
 */
const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ className, label, value, sublabel, icon, trend, trendValue, sparklineData, animated = true, ...props }, ref) => {
    const trendColors = {
      up: "text-emerald-600 dark:text-emerald-400",
      down: "text-red-600 dark:text-red-400",
      neutral: "text-slate-500 dark:text-slate-400",
    };

    const trendIcons = {
      up: <TrendingUp className="w-3 h-3" />,
      down: <TrendingDown className="w-3 h-3" />,
      neutral: <Minus className="w-3 h-3" />,
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[var(--radius-xl)] border backdrop-blur-xl p-4 border-[color:var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow)]",
          animated && "animate-spring-in",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {label}
            </p>
            <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {value}
            </p>
            {sublabel && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {sublabel}
              </p>
            )}
            {trend && trendValue && (
              <p className={cn("text-xs font-medium flex items-center gap-1", trendColors[trend])}>
                {trendIcons[trend]}
                {trend === "up" && "+"}{trendValue}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {icon && (
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                {icon}
              </div>
            )}
            {sparklineData && sparklineData.length >= 2 && (
              <Sparkline
                data={sparklineData}
                color={trend === "up" ? "success" : trend === "down" ? "warning" : "default"}
                showArea
                width={60}
                height={20}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
);
MetricCard.displayName = "MetricCard";

/**
 * CompactMetricCard - Minimal version for lists
 */
const CompactMetricCard = React.forwardRef<HTMLDivElement, Omit<MetricCardProps, "icon" | "sparklineData">>(
  ({ className, label, value, sublabel, trend, trendValue, ...props }, ref) => {
    const trendColors = {
      up: "text-emerald-600 dark:text-emerald-400",
      down: "text-red-600 dark:text-red-400",
      neutral: "text-slate-500 dark:text-slate-400",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[var(--radius-md)] border border-black/5 bg-white/50 dark:bg-slate-800/50 p-3",
          className
        )}
        {...props}
      >
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {value}
          </p>
          {trend && trendValue && (
            <span className={cn("text-xs", trendColors[trend])}>
              {trend === "up" && "+"}{trendValue}
            </span>
          )}
        </div>
        {sublabel && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sublabel}</p>
        )}
      </div>
    );
  }
);
CompactMetricCard.displayName = "CompactMetricCard";

export { MetricCard, CompactMetricCard };
