"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  label?: string;
  sublabel?: string;
  animated?: boolean;
  showPercentage?: boolean;
}

/**
 * ProgressRing - Saarinen-inspired circular progress
 *
 * Features organic entrance animation with spring easing,
 * creating a sense of life and responsiveness.
 */
export function ProgressRing({
  value,
  max,
  size = 120,
  strokeWidth = 10,
  className,
  color = "stroke-slate-900 dark:stroke-slate-100",
  label,
  sublabel,
  animated = true,
  showPercentage = false,
}: ProgressRingProps) {
  const [animatedOffset, setAnimatedOffset] = React.useState<number | null>(null);
  const [displayValue, setDisplayValue] = React.useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const targetOffset = circumference - (percentage / 100) * circumference;

  // Animate ring drawing and counter on mount
  React.useEffect(() => {
    if (!animated) {
      setAnimatedOffset(targetOffset);
      setDisplayValue(value);
      return;
    }

    // Start from full offset (empty ring)
    setAnimatedOffset(circumference);
    setDisplayValue(0);

    const startTime = performance.now();
    const duration = 800;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for organic feel
      const eased = 1 - Math.pow(1 - progress, 3);

      // Interpolate offset from full to target
      const currentOffset = circumference - (circumference - targetOffset) * eased;
      setAnimatedOffset(currentOffset);

      // Animate the display value too
      setDisplayValue(value * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    // Small delay before starting animation
    const timer = setTimeout(() => {
      requestAnimationFrame(animate);
    }, 100);

    return () => clearTimeout(timer);
  }, [value, max, animated, circumference, targetOffset]);

  const displayLabel = label ?? (showPercentage ? `${Math.round(percentage)}%` : undefined);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-slate-100 fill-none dark:stroke-slate-800"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={cn("fill-none", color)}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset ?? circumference}
          style={{
            transition: animated ? "none" : "stroke-dashoffset 500ms ease-out",
          }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {displayLabel && (
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {typeof label === "string" ? label : Math.round(displayValue)}
          </span>
        )}
        {sublabel && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{sublabel}</span>
        )}
      </div>
    </div>
  );
}

/**
 * MiniProgressRing - Compact version for inline use
 */
export function MiniProgressRing({
  value,
  max,
  size = 32,
  strokeWidth = 3,
  className,
  color = "stroke-slate-900 dark:stroke-slate-100",
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className={cn("transform -rotate-90", className)}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        className="stroke-slate-100 fill-none dark:stroke-slate-800"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        className={cn("fill-none transition-all duration-500 ease-out", color)}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}
