"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "shimmer" | "pulse";
}

/**
 * Skeleton - Saarinen-inspired loading placeholder
 *
 * Uses gradient shimmer for a flowing, organic loading effect
 * that feels alive rather than static.
 */
function Skeleton({
  className,
  variant = "shimmer",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)]",
        variant === "shimmer" && "animate-shimmer",
        variant === "pulse" && "animate-pulse bg-slate-100 dark:bg-slate-800",
        variant === "default" && "bg-slate-100 dark:bg-slate-800",
        className
      )}
      {...props}
    />
  );
}

/**
 * SkeletonText - Text placeholder with natural line heights
 */
function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 && "w-3/4" // Last line shorter
          )}
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * SkeletonCard - Card-shaped placeholder
 */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-black/5 bg-white/50 dark:bg-slate-800/50 p-6 space-y-4",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

/**
 * SkeletonMetric - Metric card placeholder
 */
function SkeletonMetric({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-black/5 bg-white/50 dark:bg-slate-800/50 p-6 text-center",
        className
      )}
    >
      <Skeleton className="h-20 w-20 rounded-full mx-auto mb-3" />
      <Skeleton className="h-4 w-16 mx-auto" />
    </div>
  );
}

/**
 * SkeletonList - List of skeleton items with stagger
 */
function SkeletonList({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-black/5 bg-white/30 dark:bg-slate-800/30"
          style={{ animationDelay: `${i * 75}ms` }}
        >
          <Skeleton className="h-10 w-10 rounded-[var(--radius-md)]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-16 rounded-[var(--radius-md)]" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonMetric, SkeletonList };
