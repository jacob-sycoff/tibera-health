"use client";

import * as React from "react";

interface AnnouncerContextValue {
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

const AnnouncerContext = React.createContext<AnnouncerContextValue | undefined>(
  undefined
);

export function useAnnouncer() {
  const context = React.useContext(AnnouncerContext);
  if (!context) {
    throw new Error("useAnnouncer must be used within an AnnouncerProvider");
  }
  return context;
}

interface AnnouncerProviderProps {
  children: React.ReactNode;
}

export function AnnouncerProvider({ children }: AnnouncerProviderProps) {
  const [politeMessage, setPoliteMessage] = React.useState("");
  const [assertiveMessage, setAssertiveMessage] = React.useState("");

  const announce = React.useCallback(
    (message: string, priority: "polite" | "assertive" = "polite") => {
      if (priority === "assertive") {
        setAssertiveMessage("");
        // Small delay to ensure the region is cleared first
        requestAnimationFrame(() => {
          setAssertiveMessage(message);
        });
      } else {
        setPoliteMessage("");
        requestAnimationFrame(() => {
          setPoliteMessage(message);
        });
      }
    },
    []
  );

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Screen reader only live regions */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}
