"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200",
        primary:
          "bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600",
        warning:
          "bg-warning-600 text-white hover:bg-warning-700 dark:bg-warning-500 dark:hover:bg-warning-600",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700",
        outline:
          "border border-black/10 bg-white/80 backdrop-blur-sm hover:bg-white text-slate-900 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800",
        secondary:
          "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
        ghost:
          "hover:bg-slate-100 text-slate-900 dark:hover:bg-slate-800 dark:text-slate-100",
        link:
          "text-slate-900 underline-offset-4 hover:underline dark:text-slate-100",
      },
      size: {
        default: "h-10 px-5 py-2 rounded-[var(--radius-md)]",
        sm: "h-9 px-4 rounded-[var(--radius-md)] text-xs",
        lg: "h-11 px-6 rounded-[var(--radius-md)]",
        icon: "h-10 w-10 rounded-[var(--radius-md)]",
        "icon-sm": "h-9 w-9 rounded-[var(--radius-md)]",
        "icon-lg": "h-11 w-11 rounded-[var(--radius-md)]",
      },
      shape: {
        default: "rounded-[var(--radius-md)]",
        pill: "rounded-full",
        square: "rounded-[var(--radius-sm)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, asChild, ...props }, ref) => {
    // asChild is destructured but not used - prevents it from being passed to DOM
    void asChild;
    return (
      <button
        className={cn(buttonVariants({ variant, size, shape, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
