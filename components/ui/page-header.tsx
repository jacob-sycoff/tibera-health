"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, description, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}
        {...props}
      >
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          {description && (
            <p className="text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
          {children}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }
);
PageHeader.displayName = "PageHeader";

export { PageHeader };
