/**
 * Assistant Conversation V3 API Route
 *
 * Voice-first assistant that can create, edit, and delete health entries.
 * Returns a structured response with actions and a decision envelope.
 *
 * POST /api/assistant/conversation-v3
 * Body: { text, nowIso?, today?, history?, existingActions?, recentEntries? }
 * Returns: { success, data?: AssistantV3Response, meta?: { sessionId, turnId }, error? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { OPENAI_MODELS } from "@/lib/openai/models";
import {
  ActionSchema,
  AssistantV3ResponseSchema,
  RecentEntrySchema,
  RESPONSE_JSON_SCHEMA,
  type AssistantV3Response,
  type RecentEntry,
} from "@/lib/assistant/action-schemas";
import { CONVERSATION_V3_SYSTEM_PROMPT } from "@/lib/assistant/prompts";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const RequestSchema = z
  .object({
    text: z.string().min(1),
    nowIso: z.string().datetime().optional(),
    today: DateSchema.optional(),
    sessionId: z.string().uuid().optional(),
    correlationId: z.string().uuid().optional(),
    inputSource: z.enum(["typed", "speech"]).optional(),
    mode: z.enum(["chat", "conversation_v3"]).optional(),
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
    recentEntries: z.array(RecentEntrySchema).max(30).optional(),
  })
  .strict();

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

const REPAIR_INSTRUCTIONS = `You returned an invalid plan in the previous attempt.

- If the user provided loggable information, you MUST return at least 1 action.
- If you cannot create any action due to missing details, use intent="clarify", apply="none", and ask ONE targeted question.
- Never set apply="auto" or apply="confirm" when returning zero actions.`;

function ensureEndsWithQuestion(message: string, suffixQuestion: string): string {
  const trimmed = message.trim();
  if (!trimmed) return suffixQuestion;
  if (trimmed.includes("?")) return trimmed;
  const cleaned = trimmed.replace(/[.!\s]+$/, "");
  return `${cleaned} ${suffixQuestion}`.trim();
}

function normalizePlannedResponse(
  planned: AssistantV3Response,
  ctx: { existingActionsCount: number }
): AssistantV3Response {
  const existingCount = ctx.existingActionsCount;
  const hasPlannedActions = planned.actions.length > 0;
  const hasExistingActions = existingCount > 0;

  const decision = { ...planned.decision };

  // Keep apply aligned with intent.
  if (decision.intent === "clarify") {
    decision.apply = "none";
  }
  if (decision.intent === "chat") {
    decision.apply = "none";
  }

  // If the model returned actions, "keep" would hide them client-side.
  if (decision.action_handling === "keep" && hasPlannedActions) {
    decision.action_handling = "replace";
  }

  // If the model is asking for confirmation, ensure it's a question.
  let message = planned.message;
  if (decision.apply === "confirm") {
    message = ensureEndsWithQuestion(message, "Save it?");
  }
  if (decision.intent === "clarify") {
    message = ensureEndsWithQuestion(message, "Which detail should I use?");
  }

  // If we're logging and we have actions, don't allow a no-op apply mode.
  if (decision.intent === "log" && hasPlannedActions && decision.apply === "none") {
    decision.apply = message.includes("?") ? "confirm" : "auto";
  }

  // No-op guard: if we have no actions and nothing to keep, force a single question.
  if (!hasPlannedActions && !hasExistingActions && decision.intent !== "chat") {
    return {
      ...planned,
      message: "What should I log?",
      actions: [],
      decision: { ...decision, intent: "clarify", apply: "none", action_handling: "keep", confidence: Math.min(0.5, decision.confidence) },
    };
  }

  // Never promise "auto" if there is nothing to apply (unless we're keeping existing actions).
  if (!hasPlannedActions && !hasExistingActions && decision.apply !== "none") {
    return {
      ...planned,
      message: "What should I log?",
      actions: [],
      decision: { ...decision, intent: "clarify", apply: "none", action_handling: "keep", confidence: Math.min(0.5, decision.confidence) },
    };
  }

  return { ...planned, message, decision };
}

function shouldRepairPlannedResponse(planned: AssistantV3Response, existingActionsCount: number): boolean {
  const hasActions = planned.actions.length > 0;
  const hasExisting = existingActionsCount > 0;
  if (hasActions) return false;
  if (hasExisting && planned.decision.action_handling === "keep") return false;
  if (planned.decision.intent === "log") return true;
  if (planned.decision.apply !== "none") return true;
  if (planned.decision.intent === "clarify") return true;
  return false;
}

async function tryOpenAiConversationV3(args: {
  model: string;
  text: string;
  nowIso?: string;
  today?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  existingActions?: AssistantV3Response["actions"];
  recentEntries?: RecentEntry[];
  extraInstructions?: string;
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
  const recentEntriesBlock =
    args.recentEntries && args.recentEntries.length > 0
      ? `\n\nRecent entries the user can edit or delete:\n${JSON.stringify(args.recentEntries, null, 2)}`
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
      max_output_tokens: 2000,
      instructions: args.extraInstructions
        ? `${CONVERSATION_V3_SYSTEM_PROMPT}\n\n${args.extraInstructions}`.trim()
        : CONVERSATION_V3_SYSTEM_PROMPT,
      input: `${userPrompt}${historyBlock}${existingActionsBlock}${recentEntriesBlock}`,
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
    const recentEntries = parsedBody.data.recentEntries;
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
    const model = OPENAI_MODELS.assistant.strong;

    let planned: AssistantV3Response;
    let repaired = false;
    try {
      planned = await tryOpenAiConversationV3({ model, text, nowIso, today, history, existingActions, recentEntries });
      const existingCount = existingActions?.length ?? 0;
      if (shouldRepairPlannedResponse(planned, existingCount)) {
        repaired = true;
        planned = await tryOpenAiConversationV3({
          model,
          text,
          nowIso,
          today,
          history,
          existingActions,
          recentEntries,
          extraInstructions: REPAIR_INSTRUCTIONS,
        });
      }
      planned = normalizePlannedResponse(planned, { existingActionsCount: existingCount });
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
            metadata: { version: "v3", decision: planned.decision, repaired },
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
