"use client";

import { Camera, Sparkles, FileSearch, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ScanProgress } from "@/lib/api/supplement-scanner";
import { cn } from "@/lib/utils/cn";

interface ScanProgressProps {
  progress: ScanProgress;
  onCancel?: () => void;
}

const STAGE_CONFIG = {
  uploading: {
    icon: Camera,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
  },
  analyzing: {
    icon: Sparkles,
    color: "text-purple-500",
    bgColor: "bg-purple-50",
  },
  extracting: {
    icon: FileSearch,
    color: "text-orange-500",
    bgColor: "bg-orange-50",
  },
  validating: {
    icon: Loader2,
    color: "text-green-500",
    bgColor: "bg-green-50",
  },
  complete: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-50",
  },
};

export function ScanProgressDisplay({ progress, onCancel }: ScanProgressProps) {
  const config = STAGE_CONFIG[progress.stage];
  const Icon = config.icon;
  const isComplete = progress.stage === "complete";
  const isError = progress.stage === "error";
  const isLoading = !isComplete && !isError;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Icon */}
          <div
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center",
              config.bgColor
            )}
          >
            <Icon
              className={cn(
                "w-8 h-8",
                config.color,
                isLoading && progress.stage !== "uploading" && "animate-spin"
              )}
            />
          </div>

          {/* Message */}
          <div>
            <p className="font-medium text-lg">{progress.message}</p>
            {isLoading && (
              <p className="text-sm text-gray-500 mt-1">
                This may take a few seconds...
              </p>
            )}
          </div>

          {/* Progress Bar */}
          {isLoading && (
            <div className="w-full">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-500 ease-out rounded-full",
                    progress.stage === "error" ? "bg-red-500" : "bg-primary-500"
                  )}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {progress.progress}% complete
              </p>
            </div>
          )}

          {/* Stage indicators */}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {["uploading", "analyzing", "extracting", "validating"].map((stage, i) => (
                <div key={stage} className="flex items-center gap-1">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      progress.stage === stage
                        ? "bg-primary-500 animate-pulse"
                        : i < ["uploading", "analyzing", "extracting", "validating"].indexOf(progress.stage)
                        ? "bg-green-500"
                        : "bg-gray-200"
                    )}
                  />
                  <span className="capitalize hidden sm:inline">{stage}</span>
                </div>
              ))}
            </div>
          )}

          {/* Cancel Button */}
          {isLoading && onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}

          {/* Error Retry */}
          {isError && (
            <p className="text-sm text-red-600">
              Please try again with a clearer image
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ScanProgressDisplay;
