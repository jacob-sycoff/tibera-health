"use client";

import * as React from "react";
import { Check, X, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAnnouncer } from "./announcer";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined
);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

const TOAST_DURATION = 4000;

const ToastIcon = ({ type }: { type: ToastType }) => {
  switch (type) {
    case "success":
      return <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    case "error":
      return <X className="w-4 h-4 text-red-600 dark:text-red-400" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    case "info":
      return <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  }
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const { announce } = useAnnouncer();

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = React.useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const newToast: Toast = { id, message, type };

      setToasts((prev) => [...prev, newToast]);

      // Announce to screen readers
      announce(message, type === "error" ? "assertive" : "polite");

      // Auto remove after duration
      setTimeout(() => {
        removeToast(id);
      }, TOAST_DURATION);
    },
    [announce, removeToast]
  );

  const contextValue = React.useMemo(
    () => ({
      toast: addToast,
      success: (message: string) => addToast(message, "success"),
      error: (message: string) => addToast(message, "error"),
      warning: (message: string) => addToast(message, "warning"),
      info: (message: string) => addToast(message, "info"),
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast container */}
      <div
        className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none"
        aria-hidden="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] shadow-lg border animate-slide-up",
              "bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl",
              "border-black/10 dark:border-white/10",
              "min-w-[280px] max-w-[400px]"
            )}
          >
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                toast.type === "success" && "bg-emerald-100 dark:bg-emerald-900/30",
                toast.type === "error" && "bg-red-100 dark:bg-red-900/30",
                toast.type === "warning" && "bg-amber-100 dark:bg-amber-900/30",
                toast.type === "info" && "bg-blue-100 dark:bg-blue-900/30"
              )}
            >
              <ToastIcon type={toast.type} />
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 flex-1">
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
