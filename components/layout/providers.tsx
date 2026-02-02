"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AnnouncerProvider } from "@/components/ui/announcer";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/ui/theme";
import { AssistantLauncher } from "@/components/assistant/assistant-launcher";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AnnouncerProvider>
          <ToastProvider>
            {children}
            <AssistantLauncher />
          </ToastProvider>
        </AnnouncerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
