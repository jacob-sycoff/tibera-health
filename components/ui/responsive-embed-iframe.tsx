"use client";

import { useEffect, useMemo, useState } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeDefaultHeight() {
  if (typeof window === "undefined") return 720;
  // Roughly: visible area inside a card on mobile/desktop.
  const candidate = window.innerHeight * 0.78;
  return clamp(Math.round(candidate), 520, 980);
}

export function ResponsiveEmbedIFrame({
  src,
  title,
  embedId,
  className,
}: {
  src: string;
  title: string;
  embedId: string;
  className?: string;
}) {
  // Keep SSR and first client render identical to avoid hydration mismatches.
  const [height, setHeight] = useState<number>(720);

  const expectedOrigin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  useEffect(() => {
    setHeight(computeDefaultHeight());
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!expectedOrigin || event.origin !== expectedOrigin) return;
      const data = event.data as unknown;
      if (
        !data ||
        typeof data !== "object" ||
        !("type" in data) ||
        !("id" in data) ||
        !("height" in data)
      ) {
        return;
      }
      const { type, id, height: nextHeight } = data as {
        type: string;
        id: string;
        height: number;
      };
      if (type !== "tibera:embed-height") return;
      if (id !== embedId) return;
      if (typeof nextHeight !== "number" || !Number.isFinite(nextHeight)) return;

      setHeight((prev) => {
        const clamped = clamp(Math.round(nextHeight), 520, 1600);
        return clamped === prev ? prev : clamped;
      });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedId, expectedOrigin]);

  useEffect(() => {
    const onResize = () => setHeight(computeDefaultHeight());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <iframe
      title={title}
      src={src}
      className={className}
      style={{ height }}
    />
  );
}
