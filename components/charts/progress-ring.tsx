"use client";

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
}

export function ProgressRing({
  value,
  max,
  size = 120,
  strokeWidth = 10,
  className,
  color = "stroke-primary-500",
  label,
  sublabel,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-muted fill-none"
        />
        {/* Progress circle */}
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
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && (
          <span className="text-2xl font-bold text-foreground">{label}</span>
        )}
        {sublabel && (
          <span className="text-xs text-muted-foreground">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
