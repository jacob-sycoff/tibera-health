import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const JsonObjectSchema = z.custom<Record<string, unknown>>((v) => isRecord(v));

const EventSchema = z
  .object({
    event_id: z.string().uuid().optional(),
    event_type: z.string().min(1).max(160),
    ts: z.string().datetime().optional(),
    source: z.enum(["client", "server", "db"]).optional(),
    session_id: z.string().uuid().nullable().optional(),
    correlation_id: z.string().uuid().nullable().optional(),
    idempotency_key: z.string().min(1).max(220).nullable().optional(),
    schema_version: z.number().int().min(1).max(10).optional(),
    privacy_level: z.enum(["standard", "sensitive", "redacted"]).optional(),
    payload: JsonObjectSchema.optional(),
    context: JsonObjectSchema.optional(),
  })
  .strict();

const RequestSchema = z
  .object({
    events: z.array(EventSchema).min(1).max(50),
  })
  .strict();

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  try {
    const nowIso = new Date().toISOString();
    const rows = parsed.data.events.map((e) => {
      const eventId = e.event_id ?? crypto.randomUUID();
      const idempotencyKey = (e.idempotency_key ?? eventId).slice(0, 220);

      const payload = e.payload ?? {};
      const context = e.context ?? {};

      const payloadBytes = JSON.stringify(payload).length;
      const contextBytes = JSON.stringify(context).length;
      if (payloadBytes > 50_000 || contextBytes > 20_000) {
        throw new Error("Event payload too large");
      }

      return {
        user_id: user.id,
        event_type: e.event_type,
        source: e.source ?? "client",
        ts: e.ts ?? nowIso,
        session_id: e.session_id ?? null,
        correlation_id: e.correlation_id ?? null,
        idempotency_key: idempotencyKey,
        schema_version: e.schema_version ?? 1,
        privacy_level: e.privacy_level ?? "standard",
        payload,
        context,
      } as const;
    });

    const { error } = await supabase
      .from("app_events")
      .upsert(rows as any, { onConflict: "user_id,idempotency_key", ignoreDuplicates: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { accepted: rows.length } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to ingest events";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
