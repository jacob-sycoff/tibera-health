"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  position?: "center" | "bottom" | "responsive";
  showCloseButton?: boolean;
}

/**
 * Modal - Saarinen-inspired overlay dialog
 *
 * Features smooth entrance/exit animations with organic
 * spring timing and proper focus management.
 */
export function Modal({
  open,
  onClose,
  children,
  className,
  size = "md",
  position = "center",
  showCloseButton = true,
}: ModalProps) {
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Handle open/close with animation
  React.useEffect(() => {
    if (open) {
      setShouldRender(true);
      // Small delay to ensure DOM is ready for animation
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else if (shouldRender) {
      setIsAnimating(false);
      // Wait for exit animation before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open, shouldRender]);

  // Lock body scroll when open
  React.useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Focus trap
  React.useEffect(() => {
    if (open && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      firstElement?.focus();

      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement?.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement?.focus();
            e.preventDefault();
          }
        }
      };

      document.addEventListener("keydown", handleTab);
      return () => document.removeEventListener("keydown", handleTab);
    }
  }, [open]);

  if (!shouldRender) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-full mx-4",
  };

  const positionClasses = {
    center: "items-center justify-center",
    bottom: "items-end justify-center",
    responsive: "items-end justify-center lg:items-center",
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex",
        positionClasses[position]
      )}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
          isAnimating ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        className={cn(
          "relative w-full mx-4 mb-4 lg:mb-0 max-h-[85vh] overflow-auto",
          "rounded-[var(--radius-xl)] border border-black/10 dark:border-white/10",
          "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl",
          "shadow-[0_20px_70px_-30px_rgba(2,6,23,0.5)]",
          "transition-all duration-300",
          isAnimating
            ? "opacity-100 translate-y-0 scale-100"
            : position === "bottom"
            ? "opacity-0 translate-y-8"
            : "opacity-0 scale-95",
          sizeClasses[size],
          className
        )}
        style={{
          transitionTimingFunction: isAnimating
            ? "cubic-bezier(0.34, 1.56, 0.64, 1)" // Spring in
            : "ease-out", // Ease out
        }}
      >
        {showCloseButton && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-4 right-4 z-10"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * ModalHeader - Consistent header styling
 */
export function ModalHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("p-6 pb-0", className)}>
      {children}
    </div>
  );
}

/**
 * ModalTitle - Modal heading
 */
export function ModalTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("text-xl font-semibold text-slate-900 dark:text-slate-100", className)}>
      {children}
    </h2>
  );
}

/**
 * ModalDescription - Subtitle text
 */
export function ModalDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-sm text-slate-500 dark:text-slate-400 mt-1", className)}>
      {children}
    </p>
  );
}

/**
 * ModalContent - Main content area
 */
export function ModalContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("p-6", className)}>
      {children}
    </div>
  );
}

/**
 * ModalFooter - Action buttons area
 */
export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("p-6 pt-0 flex items-center justify-end gap-3", className)}>
      {children}
    </div>
  );
}
