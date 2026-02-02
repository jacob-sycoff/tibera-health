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

const AssistantPlanSchema = z.object({
  message: z.string(),
  actions: z.array(
    z.discriminatedUnion("type", [
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
    ])
  ),
});

export type AssistantPlan = z.infer<typeof AssistantPlanSchema>;

export async function planAssistantActions(args: { text: string }): Promise<{ success: true; data: AssistantPlan } | { success: false; error: string }> {
  const nowIso = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const response = await fetch("/api/assistant/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: args.text, nowIso, today }),
  });

  const json = (await response.json()) as unknown;
  const parsed = z
    .object({ success: z.boolean(), data: z.unknown().optional(), error: z.string().optional() })
    .safeParse(json);

  if (!parsed.success) return { success: false, error: "Invalid assistant response" };
  if (!parsed.data.success) return { success: false, error: parsed.data.error || "Assistant error" };

  const planParsed = AssistantPlanSchema.safeParse(parsed.data.data);
  if (!planParsed.success) return { success: false, error: "Could not parse assistant plan" };

  return { success: true, data: planParsed.data };
}

