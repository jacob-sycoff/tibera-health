"use client";

type EventSource = "client" | "server" | "db";
type PrivacyLevel = "standard" | "sensitive" | "redacted";

export type AppEvent = {
  event_id: string;
  event_type: string;
  ts: string;
  source: EventSource;
  session_id?: string | null;
  correlation_id?: string | null;
  idempotency_key?: string | null;
  schema_version?: number;
  privacy_level?: PrivacyLevel;
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

type EmitOptions = {
  session_id?: string | null;
  correlation_id?: string | null;
  idempotency_key?: string | null;
  privacy_level?: PrivacyLevel;
  schema_version?: number;
  context?: Record<string, unknown>;
};

const STORAGE_KEY = "tibera:app-events:v1";
const MAX_QUEUE = 500;
const FLUSH_BATCH = 25;

function safeParseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `evt_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

class EventClient {
  private queue: AppEvent[] = [];
  private baseContext: Record<string, unknown> = {};
  private sessionId: string | null = null;
  private flushTimer: number | null = null;
  private flushing = false;
  private initialized = false;
  private backoffMs = 400;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window === "undefined") return;

    const existing = safeParseJson(window.localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(existing)) {
      this.queue = existing.filter(isRecord) as AppEvent[];
    }

    window.addEventListener("online", this.handleOnline, { passive: true });
    document.addEventListener("visibilitychange", this.handleVisibility, { passive: true });

    this.scheduleFlush(250);
  }

  setBaseContext(context: Record<string, unknown>): void {
    this.baseContext = { ...this.baseContext, ...(context ?? {}) };
  }

  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  emit(event_type: string, payload: Record<string, unknown> = {}, options: EmitOptions = {}): void {
    if (typeof window === "undefined") return;
    if (!event_type || typeof event_type !== "string") return;
    this.init();

    const event_id = uuid();
    const event: AppEvent = {
      event_id,
      event_type,
      ts: nowIso(),
      source: "client",
      session_id: options.session_id ?? this.sessionId,
      correlation_id: options.correlation_id ?? null,
      idempotency_key: (options.idempotency_key ?? event_id).slice(0, 220),
      schema_version: options.schema_version ?? 1,
      privacy_level: options.privacy_level ?? "standard",
      payload,
      context: { ...this.baseContext, ...(options.context ?? {}) },
    };

    this.queue = [...this.queue, event].slice(-MAX_QUEUE);
    this.persist();
    this.scheduleFlush(250);
  }

  flushSoon(): void {
    this.init();
    this.scheduleFlush(0);
  }

  private scheduleFlush(delayMs: number): void {
    if (typeof window === "undefined") return;
    if (this.flushTimer != null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, Math.max(0, delayMs));
  }

  private persist(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue.slice(-MAX_QUEUE)));
    } catch {
      // ignore
    }
  }

  private handleOnline = () => {
    this.flushSoon();
  };

  private handleVisibility = () => {
    if (document.visibilityState === "hidden") {
      // Best-effort flush before tab goes away.
      this.scheduleFlush(0);
    }
  };

  private async flush(): Promise<void> {
    if (typeof window === "undefined") return;
    if (this.flushing) return;
    if (!navigator.onLine) return;
    if (this.queue.length === 0) return;

    this.flushing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.slice(0, FLUSH_BATCH);
        const resp = await fetch("/api/events/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: batch }),
          keepalive: true,
        }).catch(() => null);

        if (!resp || !resp.ok) {
          this.backoffMs = Math.min(15_000, Math.round(this.backoffMs * 1.6));
          this.scheduleFlush(this.backoffMs);
          return;
        }

        this.queue = this.queue.slice(batch.length);
        this.persist();
        this.backoffMs = 400;
      }
    } finally {
      this.flushing = false;
    }
  }
}

const globalKey = "__tibera_event_client__";
const anyGlobal = globalThis as unknown as Record<string, unknown>;
const existingClient = anyGlobal[globalKey] as EventClient | undefined;
export const events: EventClient = existingClient ?? new EventClient();
anyGlobal[globalKey] = events;

