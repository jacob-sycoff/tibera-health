"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { AlertTriangle, Check, Info } from "lucide-react";

interface NutrientBarProps {
  name: string;
  value: number;
  max: number;
  unit: string;
  showWarning?: boolean;
  showZones?: boolean;
  info?: string;
  className?: string;
}

/**
 * NutrientBar - Saarinen-inspired progress visualization
 *
 * Features organic animations, optional threshold zones,
 * and clear visual hierarchy for health data.
 */
export function NutrientBar({
  name,
  value,
  max,
  unit,
  showWarning = false,
  showZones = false,
  info,
  className,
}: NutrientBarProps) {
  const [animatedValue, setAnimatedValue] = React.useState(0);
  const percentage = Math.min(Math.max((value / max) * 100, 0), 150);
  const displayPercentage = Math.min(percentage, 100);
  const isLow = percentage < 50;
  const isOptimal = percentage >= 75 && percentage <= 125;
  const isHigh = percentage > 125;

  // Animate value on mount and change
  React.useEffect(() => {
    const startTime = performance.now();
    const duration = 600;
    const startValue = animatedValue;
    const endValue = value;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedValue(startValue + (endValue - startValue) * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  const getBarColor = () => {
    if (isHigh) return "bg-amber-500 dark:bg-amber-400";
    if (isLow && showWarning) return "bg-amber-400 dark:bg-amber-500";
    if (isOptimal) return "bg-emerald-500 dark:bg-emerald-400";
    return "bg-slate-900 dark:bg-slate-100";
  };

  const getStatusIcon = () => {
    if (isLow && showWarning) {
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (isOptimal) {
      return <Check className="w-3.5 h-3.5 text-emerald-500" />;
    }
    if (isHigh) {
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    }
    return null;
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          {name}
          {getStatusIcon()}
          {info ? (
            <span
              className="inline-flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              title={info}
              aria-label={info}
              tabIndex={0}
            >
              <Info className="w-3.5 h-3.5" />
            </span>
          ) : null}
        </span>
        <span className="text-slate-500 dark:text-slate-400 tabular-nums">
          {Math.round(animatedValue)}{unit} / {max}{unit}
        </span>
      </div>

      {/* Progress bar with optional threshold zones */}
      <div className="relative h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        {/* Threshold zone indicators (subtle background) */}
        {showZones && (
          <div className="absolute inset-0 flex">
            <div className="w-1/2 bg-amber-100/50 dark:bg-amber-900/20" />
            <div className="w-1/4 bg-emerald-100/50 dark:bg-emerald-900/20" />
            <div className="w-1/4 bg-amber-100/50 dark:bg-amber-900/20" />
          </div>
        )}

        {/* Progress fill */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out",
            getBarColor()
          )}
          style={{ width: `${displayPercentage}%` }}
        />

        {/* Optimal zone marker (75-100%) */}
        {showZones && (
          <div
            className="absolute top-0 bottom-0 w-px bg-emerald-600/30 dark:bg-emerald-400/30"
            style={{ left: "75%" }}
          />
        )}
      </div>

      {/* Percentage with status color */}
      <div
        className={cn(
          "text-xs text-right tabular-nums",
          isOptimal && "text-emerald-600 dark:text-emerald-400",
          isLow && showWarning && "text-amber-600 dark:text-amber-400",
          isHigh && "text-amber-600 dark:text-amber-400",
          !isOptimal && !isLow && !isHigh && "text-slate-500 dark:text-slate-400"
        )}
      >
        {Math.round(percentage)}%
      </div>
    </div>
  );
}

/**
 * CompactNutrientBar - Minimal version for tight spaces
 */
export function CompactNutrientBar({
  name,
  value,
  max,
  className,
}: {
  name: string;
  value: number;
  max: number;
  className?: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-slate-500 dark:text-slate-400 w-16 truncate">
        {name}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-slate-900 dark:bg-slate-100 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 w-8 text-right">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}
