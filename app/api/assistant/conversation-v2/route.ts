/**
 * Assistant Conversation V2 API Route
 *
 * A single advanced LLM prompt decides whether to:
 * - Respond conversationally (no actions)
 * - Propose structured health log actions
 * - Ask targeted clarifying questions
 *
 * POST /api/assistant/conversation-v2
 * Body: { text: string, nowIso?: string, today?: string, history?: [...], existingActions?: [...] }
 * Returns: { success: boolean, data?: AssistantV2Response, meta?: { sessionId, turnId }, error?: string }
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

const AssistantV2ResponseSchema = z.object({
  message: z.string().min(1),
  actions: z.array(ActionSchema).max(12),
  decision: z.object({
    intent: z.enum(["log", "clarify", "chat"]),
    apply: z.enum(["auto", "confirm", "none"]),
    confidence: z.number().min(0).max(1),
    action_handling: z.enum(["keep", "replace", "clear"]),
  }),
});

type AssistantV2Response = z.infer<typeof AssistantV2ResponseSchema>;

const RequestSchema = z
  .object({
    text: z.string().min(1),
    nowIso: z.string().datetime().optional(),
    today: DateSchema.optional(),
    sessionId: z.string().uuid().optional(),
    correlationId: z.string().uuid().optional(),
    inputSource: z.enum(["typed", "speech"]).optional(),
    mode: z.enum(["chat", "conversation", "conversation_v2"]).optional(),
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

const SYSTEM_PROMPT = `You are the Tibera Health assistant (Conversation V2).

Your job is to be HUMAN and helpful, while also turning real health-tracking info into structured log actions.

You MUST decide what kind of turn this is:

1) "chat" (no logging):
- mic checks: "testing 1 2 3", "can you hear me?"
- greetings / small talk
- questions that are not health events ("what can you do?")
For these, set actions: [] and decision.intent="chat", decision.apply="none".
Set decision.action_handling="keep" (do not touch pending suggestions).

2) "log" (ready to log):
- user describes food eaten, symptoms, supplements/meds taken
Return actions and a concise message.
If you're confident and details are sufficient, set decision.apply="auto".
If the user should confirm first, set decision.apply="confirm".
Set decision.action_handling="replace" (return the full updated suggestion list).

3) "clarify" (needs one question):
- user mentions a loggable thing but missing a key detail (e.g. what symptom? which supplement? vague meal)
Return partial actions for what you can, and ask ONE targeted follow-up question in message.
Set decision.intent="clarify". Usually decision.apply="confirm".
Set decision.action_handling="replace" (return the full updated suggestion list).

Important product rules:
- Never mention internal schemas, USDA matching, IDs, or tools.
- Never be annoying. Don't ask meal follow-up questions for mic checks or greetings.
- If the user is correcting previous info ("no it was dinner not lunch"), update existingActions rather than duplicating.
- If the user explicitly wants to discard suggestions ("cancel that", "never mind logging"), set decision.action_handling="clear" and return actions: [].
- Prefer logging with reasonable defaults over blocking.
- For symptoms with no severity, use severity 5.
- For supplements with no dosage/unit, use dosage 1 and unit "serving".
- For date/time: if missing, use null.
- Keep actions list short (1-6 actions), but include all distinct foods as items.

Return ONLY valid JSON matching the schema.`;

const RESPONSE_JSON_SCHEMA: any = {
  name: "assistant_conversation_v2",
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
        items: { oneOf: [] as any[] },
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

// Fill action schemas (keep in sync with ActionSchema/Zod)
RESPONSE_JSON_SCHEMA.schema.properties.actions.items.oneOf = [
  {
    type: "object",
    additionalProperties: false,
    required: ["type", "title", "confidence", "data"],
    properties: {
      type: { const: "log_meal" },
      title: { type: "string", minLength: 1 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      data: {
        type: "object",
        additionalProperties: false,
        required: ["items"],
        properties: {
          date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          mealType: { type: ["string", "null"], enum: ["breakfast", "lunch", "dinner", "snack", null] },
          items: {
            type: "array",
            minItems: 1,
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
          notes: { type: "string" },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["type", "title", "confidence", "data"],
    properties: {
      type: { const: "log_symptom" },
      title: { type: "string", minLength: 1 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      data: {
        type: "object",
        additionalProperties: false,
        required: ["symptom"],
        properties: {
          symptom: { type: "string", minLength: 1 },
          severity: { type: ["number", "null"], minimum: 1, maximum: 10 },
          date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          time: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
          notes: { type: "string" },
        },
      },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["type", "title", "confidence", "data"],
    properties: {
      type: { const: "log_supplement" },
      title: { type: "string", minLength: 1 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      data: {
        type: "object",
        additionalProperties: false,
        required: ["supplement"],
        properties: {
          supplement: { type: "string", minLength: 1 },
          dosage: { type: ["number", "null"], minimum: 0 },
          unit: { type: ["string", "null"], minLength: 1 },
          date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          time: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
          notes: { type: "string" },
        },
      },
    },
  },
];

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

async function tryOpenAiConversationV2(args: {
  model: string;
  text: string;
  nowIso?: string;
  today?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  existingActions?: AssistantV2Response["actions"];
}): Promise<AssistantV2Response | null> {
  if (!process.env.OPENAI_API_KEY) return null;

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
      response_format: { type: "json_schema", json_schema: RESPONSE_JSON_SCHEMA },
    }),
  });

  if (!response.ok) return null;

  const json = (await response.json()) as unknown as any;
  const text = extractResponsesText(json);
  if (!text) return null;

  try {
    const raw = JSON.parse(cleanJson(text)) as unknown;
    const parsed = AssistantV2ResponseSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return null;
  } catch {
    return null;
  }
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
          {
            id: sessionId,
            user_id: user.id,
            mode: "conversation_v2",
            last_active_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      const { data: turn, error: turnError } = await supabase
        .from("assistant_turns")
        .insert({
          user_id: user.id,
          session_id: sessionId,
          correlation_id: correlationId,
          input_text: text,
          input_source: inputSource,
          metadata: {
            version: "v2",
            history_count: history?.length ?? 0,
            existing_actions_count: existingActions?.length ?? 0,
          },
        })
        .select("id")
        .single();
      if (!turnError && turn?.id) turnId = turn.id as string;

      await supabase.from("app_events").insert({
        user_id: user.id,
        session_id: sessionId,
        correlation_id: correlationId,
        event_type: "assistant.v2.request",
        source: "server",
        ts: new Date().toISOString(),
        privacy_level: "sensitive",
        payload: {
          turn_id: turnId,
          input_source: inputSource,
          input_chars: text.length,
        },
      });
    } catch {
      // ignore
    }

    const startedAt = Date.now();
    const model = OPENAI_MODELS.assistantV2;
    const planned = await tryOpenAiConversationV2({ model, text, nowIso, today, history, existingActions });
    if (!planned) {
      try {
        await supabase.from("app_events").insert({
          user_id: user.id,
          session_id: sessionId,
          correlation_id: correlationId,
          event_type: "assistant.v2.error",
          source: "server",
          ts: new Date().toISOString(),
          privacy_level: "sensitive",
          payload: { turn_id: turnId, error: "Failed to produce a valid response" },
        });
      } catch {
        // ignore
      }
      return NextResponse.json({ success: false, error: "Could not understand that. Try again." }, { status: 422 });
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
            metadata: { version: "v2", decision: planned.decision },
          })
          .eq("id", turnId)
          .eq("user_id", user.id);
      }

      await supabase.from("app_events").insert({
        user_id: user.id,
        session_id: sessionId,
        correlation_id: correlationId,
        event_type: "assistant.v2.success",
        source: "server",
        ts: new Date().toISOString(),
        privacy_level: "standard",
        payload: {
          turn_id: turnId,
          actions_count: planned.actions.length,
          intent: planned.decision.intent,
          apply: planned.decision.apply,
          confidence: planned.decision.confidence,
          model,
          latency_ms: latencyMs,
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, data: planned, meta: { sessionId, turnId } });
  } catch (error) {
    console.error("Assistant v2 error:", error);
    return NextResponse.json({ success: false, error: "Failed to respond. Please try again." }, { status: 500 });
  }
}
