/**
 * Assistant Planning API Route
 *
 * Turns free-form user text into a set of suggested actions the UI can review/apply.
 *
 * POST /api/assistant/plan
 * Body: { text: string, nowIso?: string, today?: string }
 * Returns: { success: boolean, data?: AssistantPlan, error?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TimeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const MealItemSchema = z
  .object({
    label: z.string().min(1),
    usdaQuery: z.string().min(1),
    gramsConsumed: z.number().positive().nullable().optional(),
    servings: z.number().positive().nullable().optional(),
    notes: z.string().optional(),
  })
  .strict();

const MealActionSchema = z
  .object({
    type: z.literal("log_meal"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    data: z
      .object({
        date: DateSchema.nullable().optional(),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
        items: z.array(MealItemSchema).min(1),
        notes: z.string().optional(),
      })
      .strict(),
  })
  .strict();

const SymptomActionSchema = z
  .object({
    type: z.literal("log_symptom"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    data: z
      .object({
        symptom: z.string().min(1),
        severity: z.number().int().min(1).max(10).nullable().optional(),
        date: DateSchema.nullable().optional(),
        time: TimeSchema.nullable().optional(),
        notes: z.string().optional(),
      })
      .strict(),
  })
  .strict();

const SupplementActionSchema = z
  .object({
    type: z.literal("log_supplement"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    data: z
      .object({
        supplement: z.string().min(1),
        dosage: z.number().positive().nullable().optional(),
        unit: z.string().min(1).nullable().optional(),
        date: DateSchema.nullable().optional(),
        time: TimeSchema.nullable().optional(),
        notes: z.string().optional(),
      })
      .strict(),
  })
  .strict();

const ActionSchema = z.discriminatedUnion("type", [
  MealActionSchema,
  SymptomActionSchema,
  SupplementActionSchema,
]);

const AssistantPlanSchema = z
  .object({
    message: z.string().min(1),
    actions: z.array(ActionSchema).max(12),
  })
  .strict();

type AssistantPlan = z.infer<typeof AssistantPlanSchema>;

const RequestSchema = z
  .object({
    text: z.string().min(1),
    nowIso: z.string().datetime().optional(),
    today: DateSchema.optional(),
  })
  .strict();

function cleanJson(text: string): string {
  let jsonText = text.trim();
  if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
  if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
  if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);
  return jsonText.trim();
}

function shouldUpgradeToStrongModel(plan: AssistantPlan): boolean {
  if (plan.actions.length === 0) return true;
  const avg = plan.actions.reduce((s, a) => s + (Number.isFinite(a.confidence) ? a.confidence : 0.5), 0) / plan.actions.length;
  if (avg < 0.65) return true;
  const hasMealWithoutItems = plan.actions.some((a) => a.type === "log_meal" && (!a.data.items || a.data.items.length === 0));
  if (hasMealWithoutItems) return true;
  return false;
}

const SYSTEM_PROMPT = `You are an assistant for a health tracking app.

You convert the user's free-form text into a SHORT list of actions the app can apply.

Return ONLY valid JSON matching this exact schema:
{
  "message": "string",
  "actions": [
    {
      "type": "log_meal" | "log_symptom" | "log_supplement",
      "title": "string",
      "confidence": number,
      "data": { ... }
    }
  ]
}

Action types and data:

1) log_meal
data:
{
  "date": "YYYY-MM-DD" | null,
  "mealType": "breakfast" | "lunch" | "dinner" | "snack" | null,
  "items": [
    {
      "label": "string",
      "usdaQuery": "string",
      "gramsConsumed": number | null,
      "servings": number | null,
      "notes": "string" (optional)
    }
  ],
  "notes": "string" (optional)
}

2) log_symptom
data:
{
  "symptom": "string",
  "severity": 1-10 | null,
  "date": "YYYY-MM-DD" | null,
  "time": "HH:MM" | null,
  "notes": "string" (optional)
}

3) log_supplement
data:
{
  "supplement": "string",
  "dosage": number | null,
  "unit": "string" | null,
  "date": "YYYY-MM-DD" | null,
  "time": "HH:MM" | null,
  "notes": "string" (optional)
}

Rules:
- Only include actions explicitly implied by the user. If unsure, omit the action.
- Prefer 2-6 actions total.
- For meal items: create USDA-friendly queries (e.g. "broccoli steamed", "chicken breast grilled", "white rice cooked").
- If the user mentions eating only part of something, prefer gramsConsumed if possible; otherwise include servings (e.g. 0.5).
- If no severity is given for a symptom, set severity to 5 (moderate).
- If dosage/unit is missing for a supplement, use dosage 1 and unit "serving".
- If date/time is not specified, use null (the client will default to 'now' or 'today').
- confidence must be 0-1 and reflect how certain you are that the action is correct.`;

async function tryOpenAiPlan(args: {
  model: string;
  text: string;
  nowIso?: string;
  today?: string;
}): Promise<AssistantPlan | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const nowBlock = args.nowIso ? `\nCurrent time (ISO): ${args.nowIso}` : "";
  const todayBlock = args.today ? `\nToday's date: ${args.today}` : "";

  const userPrompt = `User said:\n${args.text}${todayBlock}${nowBlock}\n\nReturn JSON only.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) return null;

  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content;
  if (!text) return null;

  try {
    const data = JSON.parse(cleanJson(text)) as unknown;
    const parsed = AssistantPlanSchema.safeParse(data);
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const models = {
      cheap: process.env.OPENAI_ASSISTANT_MODEL_CHEAP || "gpt-4o-mini",
      strong: process.env.OPENAI_ASSISTANT_MODEL_STRONG || "gpt-4o",
    };

    let planned = await tryOpenAiPlan({ model: models.cheap, text, nowIso, today });
    if (planned && shouldUpgradeToStrongModel(planned)) {
      const upgraded = await tryOpenAiPlan({ model: models.strong, text, nowIso, today });
      if (upgraded) planned = upgraded;
    } else if (!planned) {
      planned = await tryOpenAiPlan({ model: models.strong, text, nowIso, today });
    }

    if (!planned) {
      return NextResponse.json(
        { success: false, error: "Could not understand that. Try adding a bit more detail." },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, data: planned });
  } catch (error) {
    console.error("Assistant plan error:", error);
    return NextResponse.json({ success: false, error: "Failed to plan actions. Please try again." }, { status: 500 });
  }
}

