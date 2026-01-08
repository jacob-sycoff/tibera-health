"use client";

import { cn } from "@/lib/utils/cn";
import { AlertTriangle } from "lucide-react";

interface NutrientBarProps {
  name: string;
  value: number;
  max: number;
  unit: string;
  showWarning?: boolean;
  className?: string;
}

export function NutrientBar({
  name,
  value,
  max,
  unit,
  showWarning = false,
  className,
}: NutrientBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const isLow = percentage < 50;
  const isHigh = percentage > 100;

  const getBarColor = () => {
    if (isHigh) return "bg-warning-500";
    if (isLow && showWarning) return "bg-warning-400";
    return "bg-primary-500";
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground flex items-center gap-1">
          {name}
          {isLow && showWarning && (
            <AlertTriangle className="w-3 h-3 text-warning-500" />
          )}
        </span>
        <span className="text-muted-foreground">
          {Math.round(value)}{unit} / {max}{unit}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            getBarColor()
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground text-right">
        {Math.round(percentage)}%
      </div>
    </div>
  );
}
