import { z } from "zod";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TimeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const MealItemSchema = z.object({
  label: z.string(),
  usdaQuery: z.string(),
  gramsConsumed: z.number().nullable().optional(),
  servings: z.number().nullable().optional(),
  notes: z.string().optional(),
});

const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("log_meal"),
    title: z.string(),
    confidence: z.number(),
    data: z.object({
      date: DateSchema.nullable().optional(),
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
      items: z.array(MealItemSchema),
      notes: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("log_symptom"),
    title: z.string(),
    confidence: z.number(),
    data: z.object({
      symptom: z.string(),
      severity: z.number().nullable().optional(),
      date: DateSchema.nullable().optional(),
      time: TimeSchema.nullable().optional(),
      notes: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("log_supplement"),
    title: z.string(),
    confidence: z.number(),
    data: z.object({
      supplement: z.string(),
      dosage: z.number().nullable().optional(),
      unit: z.string().nullable().optional(),
      date: DateSchema.nullable().optional(),
      time: TimeSchema.nullable().optional(),
      notes: z.string().optional(),
    }),
  }),
]);

const AssistantV3ResponseSchema = z.object({
  message: z.string(),
  actions: z.array(ActionSchema),
  decision: z.object({
    intent: z.enum(["log", "clarify", "chat"]),
    apply: z.enum(["auto", "confirm", "none"]),
    confidence: z.number(),
    action_handling: z.enum(["keep", "replace", "clear"]),
  }),
});

export type AssistantV3Response = z.infer<typeof AssistantV3ResponseSchema>;

export async function conversationV3(args: {
  text: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  existingActions?: AssistantV3Response["actions"];
  sessionId?: string;
  inputSource?: "typed" | "speech";
  correlationId?: string;
  mode?: "chat" | "conversation" | "conversation_v2" | "conversation_v3";
}): Promise<
  | { success: true; data: AssistantV3Response; meta?: { sessionId?: string; turnId?: string } }
  | { success: false; error: string }
> {
  const nowIso = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const response = await fetch("/api/assistant/conversation-v3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: args.text,
      nowIso,
      today,
      history: args.history,
      existingActions: args.existingActions,
      sessionId: args.sessionId,
      inputSource: args.inputSource,
      correlationId: args.correlationId,
      mode: args.mode,
    }),
  });

  const json = (await response.json()) as unknown;
  const parsed = z
    .object({
      success: z.boolean(),
      data: z.unknown().optional(),
      error: z.string().optional(),
      meta: z
        .object({
          sessionId: z.string().uuid().optional(),
          turnId: z.string().uuid().optional(),
        })
        .optional(),
    })
    .safeParse(json);

  if (!parsed.success) return { success: false, error: "Invalid assistant response" };
  if (!parsed.data.success) return { success: false, error: parsed.data.error || "Assistant error" };

  const outParsed = AssistantV3ResponseSchema.safeParse(parsed.data.data);
  if (!outParsed.success) return { success: false, error: "Could not parse assistant response" };

  return { success: true, data: outParsed.data, meta: parsed.data.meta };
}

