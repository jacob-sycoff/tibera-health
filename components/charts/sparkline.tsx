"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  color?: "default" | "success" | "warning" | "danger";
  showArea?: boolean;
  animated?: boolean;
}

/**
 * Sparkline - Saarinen-inspired micro-visualization
 *
 * A minimal, organic line chart that conveys trends
 * without overwhelming the interface.
 */
export function Sparkline({
  data,
  width = 80,
  height = 24,
  strokeWidth = 1.5,
  className,
  color = "default",
  showArea = false,
  animated = true,
}: SparklineProps) {
  const [isVisible, setIsVisible] = React.useState(!animated);

  React.useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [animated]);

  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Add padding for stroke
  const padding = strokeWidth;
  const innerHeight = height - padding * 2;
  const innerWidth = width - padding * 2;

  // Calculate points
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * innerWidth;
    const y = padding + innerHeight - ((value - min) / range) * innerHeight;
    return `${x},${y}`;
  });

  const pathD = `M${points.join(" L")}`;

  // Area path (closed shape)
  const areaD = `${pathD} L${padding + innerWidth},${height - padding} L${padding},${height - padding} Z`;

  const colorClasses = {
    default: "stroke-slate-900 dark:stroke-slate-100",
    success: "stroke-emerald-500 dark:stroke-emerald-400",
    warning: "stroke-amber-500 dark:stroke-amber-400",
    danger: "stroke-red-500 dark:stroke-red-400",
  };

  const areaColorClasses = {
    default: "fill-slate-900/10 dark:fill-slate-100/10",
    success: "fill-emerald-500/10 dark:fill-emerald-400/10",
    warning: "fill-amber-500/10 dark:fill-amber-400/10",
    danger: "fill-red-500/10 dark:fill-red-400/10",
  };

  // Determine trend for last segment
  const trend = data.length >= 2 ? data[data.length - 1] - data[data.length - 2] : 0;

  return (
    <svg
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Area fill */}
      {showArea && (
        <path
          d={areaD}
          className={cn(
            areaColorClasses[color],
            "transition-opacity duration-500",
            isVisible ? "opacity-100" : "opacity-0"
          )}
          fill="currentColor"
        />
      )}

      {/* Line */}
      <path
        d={pathD}
        className={cn(
          colorClasses[color],
          "fill-none transition-all duration-700",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: isVisible ? "none" : innerWidth * 2,
          strokeDashoffset: isVisible ? 0 : innerWidth * 2,
        }}
      />

      {/* End point dot */}
      <circle
        cx={padding + innerWidth}
        cy={padding + innerHeight - ((data[data.length - 1] - min) / range) * innerHeight}
        r={strokeWidth + 1}
        className={cn(
          colorClasses[color].replace("stroke-", "fill-"),
          "transition-all duration-500",
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-0"
        )}
        style={{ transformOrigin: "center" }}
      />
    </svg>
  );
}

/**
 * SparklineWithTrend - Sparkline with trend indicator
 */
export function SparklineWithTrend({
  data,
  label,
  className,
}: {
  data: number[];
  label?: string;
  className?: string;
}) {
  if (data.length < 2) return null;

  const trend = data[data.length - 1] - data[0];
  const trendPercent = ((trend / data[0]) * 100).toFixed(1);
  const isPositive = trend >= 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Sparkline
        data={data}
        color={isPositive ? "success" : "warning"}
        showArea
      />
      <div className="text-xs">
        {label && (
          <span className="text-slate-500 dark:text-slate-400 mr-1">{label}</span>
        )}
        <span
          className={cn(
            "font-medium",
            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
          )}
        >
          {isPositive ? "+" : ""}
          {trendPercent}%
        </span>
      </div>
    </div>
  );
}
