/**
 * Assistant Conversation V3 API Route
 *
 * Similar to Conversation V2, but intended for more "voice-first" behavior.
 * This endpoint returns a single structured response that can either:
 * - Chat (no actions)
 * - Propose actions to log
 * - Ask one clarifying question while proposing partial actions
 *
 * POST /api/assistant/conversation-v3
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { OPENAI_MODELS } from "@/lib/openai/models";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TimeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const MealItemSchema = z.object({
  label: z.string().min(1),
  usdaQuery: z.string().min(1),
  gramsConsumed: z.number().positive().nullable().optional(),
  servings: z.number().positive().nullable().optional(),
  notes: z.string().optional(),
});

const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("log_meal"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    data: z.object({
      date: DateSchema.nullable().optional(),
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
      items: z.array(MealItemSchema).min(1),
      notes: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("log_symptom"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    data: z.object({
      symptom: z.string().min(1),
      severity: z.number().int().min(1).max(10).nullable().optional(),
      date: DateSchema.nullable().optional(),
      time: TimeSchema.nullable().optional(),
      notes: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("log_supplement"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    data: z.object({
      supplement: z.string().min(1),
      dosage: z.number().positive().nullable().optional(),
      unit: z.string().min(1).nullable().optional(),
      date: DateSchema.nullable().optional(),
      time: TimeSchema.nullable().optional(),
      notes: z.string().optional(),
    }),
  }),
]);

const AssistantV3ResponseSchema = z.object({
  message: z.string().min(1),
  actions: z.array(ActionSchema).max(12),
  decision: z.object({
    intent: z.enum(["log", "clarify", "chat"]),
    apply: z.enum(["auto", "confirm", "none"]),
    confidence: z.number().min(0).max(1),
    action_handling: z.enum(["keep", "replace", "clear"]),
  }),
});

type AssistantV3Response = z.infer<typeof AssistantV3ResponseSchema>;

const RequestSchema = z
  .object({
    text: z.string().min(1),
    nowIso: z.string().datetime().optional(),
    today: DateSchema.optional(),
    sessionId: z.string().uuid().optional(),
    correlationId: z.string().uuid().optional(),
    inputSource: z.enum(["typed", "speech"]).optional(),
    mode: z.enum(["chat", "conversation", "conversation_v2", "conversation_v3"]).optional(),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            text: z.string().min(1),
          })
          .strict()
      )
      .max(16)
      .optional(),
    existingActions: z.array(ActionSchema).max(12).optional(),
  })
  .strict();

const SYSTEM_PROMPT = `You are the Tibera Health assistant (Conversation V3).

You are voice-first, fast, and natural. You decide if this turn is:

- chat: respond warmly and briefly, do not log. actions: []
- log: propose structured actions for foods/symptoms/supplements mentioned
- clarify: ask ONE targeted question while proposing partial actions

Return ONLY valid JSON with:
{
  "message": "string",
  "actions": [ ... ],
  "decision": {
    "intent": "log|clarify|chat",
    "apply": "auto|confirm|none",
    "confidence": 0-1,
    "action_handling": "keep|replace|clear"
  }
}

Guidance:
- Mic checks / small talk => intent=chat, apply=none, action_handling=keep, actions=[]
- Corrections to prior suggestions => update existingActions; action_handling=replace
- If user cancels logging => intent=chat, apply=none, action_handling=clear, actions=[]
- For symptoms with no severity, use 5.
- For supplements with no dosage/unit, use dosage 1 and unit "serving".
- For date/time: if missing, use null.
- Never mention schemas/tools/IDs.`;

// OpenAI JSON schema subset: no `oneOf` for `actions.items`. Use superset and validate with Zod after.
const RESPONSE_JSON_SCHEMA: any = {
  name: "assistant_conversation_v3",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["message", "actions", "decision"],
    properties: {
      message: { type: "string", minLength: 1 },
      actions: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "title", "confidence", "data"],
          properties: {
            type: { enum: ["log_meal", "log_symptom", "log_supplement"] },
            title: { type: "string", minLength: 1 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            data: {
              type: "object",
              additionalProperties: false,
              properties: {
                date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                time: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
                notes: { type: "string" },
                // meal
                mealType: { type: ["string", "null"], enum: ["breakfast", "lunch", "dinner", "snack", null] },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["label", "usdaQuery"],
                    properties: {
                      label: { type: "string", minLength: 1 },
                      usdaQuery: { type: "string", minLength: 1 },
                      gramsConsumed: { type: ["number", "null"], minimum: 0 },
                      servings: { type: ["number", "null"], minimum: 0 },
                      notes: { type: "string" },
                    },
                  },
                },
                // symptom
                symptom: { type: "string" },
                severity: { type: ["number", "null"], minimum: 1, maximum: 10 },
                // supplement
                supplement: { type: "string" },
                dosage: { type: ["number", "null"], minimum: 0 },
                unit: { type: ["string", "null"], minLength: 1 },
              },
            },
          },
        },
      },
      decision: {
        type: "object",
        additionalProperties: false,
        required: ["intent", "apply", "confidence", "action_handling"],
        properties: {
          intent: { enum: ["log", "clarify", "chat"] },
          apply: { enum: ["auto", "confirm", "none"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          action_handling: { enum: ["keep", "replace", "clear"] },
        },
      },
    },
  },
};

function cleanJson(text: string): string {
  let jsonText = text.trim();
  if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
  if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
  if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);
  return jsonText.trim();
}

function extractResponsesText(payload: any): string | null {
  const text = payload?.output_text;
  if (typeof text === "string" && text.trim()) return text;
  const output = payload?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (c?.type === "output_text" && typeof c?.text === "string" && c.text.trim()) return c.text;
      }
    }
  }
  return null;
}

async function tryOpenAiConversationV3(args: {
  model: string;
  text: string;
  nowIso?: string;
  today?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  existingActions?: AssistantV3Response["actions"];
}): Promise<AssistantV3Response> {
  const nowBlock = args.nowIso ? `\nCurrent time (ISO): ${args.nowIso}` : "";
  const todayBlock = args.today ? `\nToday's date: ${args.today}` : "";
  const historyBlock =
    args.history && args.history.length > 0
      ? `\n\nConversation so far (most recent last):\n${args.history
          .slice(-12)
          .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
          .join("\n")}`
      : "";
  const existingActionsBlock =
    args.existingActions && args.existingActions.length > 0
      ? `\n\nExisting suggested actions (update these rather than duplicating):\n${JSON.stringify(
          { actions: args.existingActions },
          null,
          2
        )}`
      : "";

  const userPrompt = `User said:\n${args.text}${todayBlock}${nowBlock}\n\nReturn JSON only.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.2,
      max_output_tokens: 1400,
      instructions: SYSTEM_PROMPT,
      input: `${userPrompt}${historyBlock}${existingActionsBlock}`,
      text: {
        format: {
          type: "json_schema",
          name: RESPONSE_JSON_SCHEMA.name,
          strict: RESPONSE_JSON_SCHEMA.strict,
          schema: RESPONSE_JSON_SCHEMA.schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const suffix = body ? `: ${body.slice(0, 800)}` : "";
    throw new Error(`OpenAI responses error ${response.status}${suffix}`);
  }

  const json = (await response.json()) as unknown as any;
  const text = extractResponsesText(json);
  if (!text) throw new Error("OpenAI responses error: missing output_text");

  let raw: unknown;
  try {
    raw = JSON.parse(cleanJson(text));
  } catch {
    throw new Error("Assistant v3 response was not valid JSON");
  }

  const parsed = AssistantV3ResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Assistant v3 response failed schema validation");
  return parsed.data;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "AI service not configured. Please add OPENAI_API_KEY to environment variables." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const parsedBody = RequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    const { text, nowIso, today } = parsedBody.data;
    const history = parsedBody.data.history;
    const existingActions = parsedBody.data.existingActions;
    const sessionId = parsedBody.data.sessionId ?? crypto.randomUUID();
    const correlationId = parsedBody.data.correlationId ?? crypto.randomUUID();
    const inputSource = parsedBody.data.inputSource ?? "typed";

    let turnId: string | null = null;
    try {
      await supabase
        .from("assistant_sessions")
        .upsert(
          { id: sessionId, user_id: user.id, mode: "conversation_v3", last_active_at: new Date().toISOString() },
          { onConflict: "id" }
        );

      const { data: turn } = await supabase
        .from("assistant_turns")
        .insert({
          user_id: user.id,
          session_id: sessionId,
          correlation_id: correlationId,
          input_text: text,
          input_source: inputSource,
          metadata: { version: "v3" },
        })
        .select("id")
        .single();
      turnId = (turn?.id as string | undefined) ?? null;
    } catch {
      // ignore
    }

    const startedAt = Date.now();
    // Use strong model for v3 by default (more agency/robustness).
    const model = OPENAI_MODELS.assistant.strong;

    let planned: AssistantV3Response;
    try {
      planned = await tryOpenAiConversationV3({ model, text, nowIso, today, history, existingActions });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assistant v3 failed";
      try {
        await supabase.from("app_events").insert({
          user_id: user.id,
          session_id: sessionId,
          correlation_id: correlationId,
          event_type: "assistant.v3.error",
          source: "server",
          ts: new Date().toISOString(),
          privacy_level: "sensitive",
          payload: { turn_id: turnId, error: message, model },
        });
      } catch {
        // ignore
      }
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }

    const latencyMs = Math.max(0, Date.now() - startedAt);
    try {
      if (turnId) {
        await supabase
          .from("assistant_turns")
          .update({
            plan_json: planned as any,
            plan_message: planned.message,
            plan_actions_count: planned.actions.length,
            plan_model: model,
            plan_latency_ms: latencyMs,
            metadata: { version: "v3", decision: planned.decision },
          })
          .eq("id", turnId)
          .eq("user_id", user.id);
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, data: planned, meta: { sessionId, turnId } });
  } catch (error) {
    console.error("Assistant v3 error:", error);
    return NextResponse.json({ success: false, error: "Failed to respond. Please try again." }, { status: 500 });
  }
}

