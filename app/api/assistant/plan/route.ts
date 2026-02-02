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
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            text: z.string().min(1),
          })
          .strict()
      )
      .max(12)
      .optional(),
    existingActions: z.array(ActionSchema).max(12).optional(),
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

function normalizeKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ");
}

function hasMealItem(actions: AssistantPlan["actions"], needle: string): boolean {
  const n = normalizeKey(needle);
  return actions.some((a) => {
    if (a.type !== "log_meal") return false;
    return a.data.items.some((it) => normalizeKey(it.usdaQuery).includes(n) || normalizeKey(it.label).includes(n));
  });
}

const COOKING_FAT_GRAMS_PER_TBSP: Record<string, number> = {
  "olive oil": 13.5,
  "avocado oil": 13.5,
  "canola oil": 13.6,
  "vegetable oil": 13.6,
  "coconut oil": 13.6,
  "sesame oil": 13.6,
  butter: 14,
  ghee: 13,
};

function extractTablespoons(text: string): number | null {
  const t = text.toLowerCase();
  const m1 = t.match(/(\d+(?:\.\d+)?)\s*(tbsp|tbsps|tablespoon|tablespoons)\b/);
  if (m1) return Number(m1[1]);
  const m2 = t.match(/\b(one|two|three)\s*(tbsp|tbsps|tablespoon|tablespoons)\b/);
  if (m2) {
    const map: Record<string, number> = { one: 1, two: 2, three: 3 };
    return map[m2[1]] ?? null;
  }
  return null;
}

function extractTeaspoons(text: string): number | null {
  const t = text.toLowerCase();
  const m1 = t.match(/(\d+(?:\.\d+)?)\s*(tsp|tsps|teaspoon|teaspoons)\b/);
  if (m1) return Number(m1[1]);
  const m2 = t.match(/\b(one|two|three)\s*(tsp|tsps|teaspoon|teaspoons)\b/);
  if (m2) {
    const map: Record<string, number> = { one: 1, two: 2, three: 3 };
    return map[m2[1]] ?? null;
  }
  return null;
}

function applyCookingHeuristics(inputText: string, planned: AssistantPlan): AssistantPlan {
  const text = inputText.toLowerCase();
  const actions = planned.actions.map((a) => ({ ...a }));

  const mealIndex = actions.findIndex((a) => a.type === "log_meal");
  if (mealIndex === -1) return planned;

  const meal = actions[mealIndex] as Extract<AssistantPlan["actions"][number], { type: "log_meal" }>;

  // 1) Cooking fats/oils: add as separate items (USDA foods generally don't include the user's specific cooking fat).
  for (const fatName of Object.keys(COOKING_FAT_GRAMS_PER_TBSP)) {
    if (!text.includes(fatName)) continue;
    if (hasMealItem(actions, fatName)) continue;

    const tbsp = extractTablespoons(text);
    const tsp = extractTeaspoons(text);
    const gramsPerTbsp = COOKING_FAT_GRAMS_PER_TBSP[fatName];

    let grams: number | null = null;
    let note: string | undefined;
    if (tbsp && Number.isFinite(tbsp) && tbsp > 0) {
      grams = Math.round(tbsp * gramsPerTbsp * 10) / 10;
      note = `Assumed ${tbsp} tbsp ${fatName} ≈ ${grams}g.`;
    } else if (tsp && Number.isFinite(tsp) && tsp > 0) {
      grams = Math.round((tsp / 3) * gramsPerTbsp * 10) / 10;
      note = `Assumed ${tsp} tsp ${fatName} ≈ ${grams}g.`;
    }

    meal.data.items = [
      ...meal.data.items,
      {
        label: fatName,
        usdaQuery: fatName,
        gramsConsumed: grams,
        servings: null,
        ...(note ? { notes: note } : {}),
      },
    ];
  }

  // 2) Salt: include as a note unless an explicit amount is given.
  if (/\bsalt\b/.test(text) && !hasMealItem(actions, "salt")) {
    const tbsp = extractTablespoons(text);
    const tsp = extractTeaspoons(text);
    const explicit = (tbsp != null && text.includes("salt")) || (tsp != null && text.includes("salt"));

    if (explicit) {
      // Table salt ~ 18g/tbsp, ~6g/tsp.
      let grams: number | null = null;
      let note: string | undefined;
      if (tbsp && Number.isFinite(tbsp) && tbsp > 0) {
        grams = Math.round(tbsp * 18 * 10) / 10;
        note = `Assumed ${tbsp} tbsp salt ≈ ${grams}g.`;
      } else if (tsp && Number.isFinite(tsp) && tsp > 0) {
        grams = Math.round(tsp * 6 * 10) / 10;
        note = `Assumed ${tsp} tsp salt ≈ ${grams}g.`;
      }
      meal.data.items = [
        ...meal.data.items,
        {
          label: "salt",
          usdaQuery: "salt table",
          gramsConsumed: grams,
          servings: null,
          ...(note ? { notes: note } : {}),
        },
      ];
    } else {
      const existing = meal.data.notes?.trim();
      const appended = "Salt added (amount unknown).";
      meal.data.notes = existing ? `${existing}\n${appended}` : appended;
    }
  }

  actions[mealIndex] = meal;
  return { ...planned, actions };
}

const MEDICATION_DEFAULTS: Array<{
  keys: string[];
  canonical: string;
  perUnit: number;
  unit: string;
  formLabel: string;
}> = [
  { keys: ["ibuprofen", "advil", "motrin"], canonical: "ibuprofen", perUnit: 200, unit: "mg", formLabel: "tablet" },
  { keys: ["acetaminophen", "tylenol", "paracetamol"], canonical: "acetaminophen", perUnit: 500, unit: "mg", formLabel: "tablet" },
  { keys: ["naproxen", "aleve"], canonical: "naproxen", perUnit: 220, unit: "mg", formLabel: "tablet" },
];

function extractCountNear(text: string, keys: string[]): number | null {
  const t = text.toLowerCase();
  for (const key of keys) {
    const r1 = new RegExp(`(\\d+)\\s*(?:x\\s*)?(?:${key})\\b`, "i");
    const m1 = t.match(r1);
    if (m1) return Number(m1[1]);

    const r2 = new RegExp(`\\b${key}\\b\\s*(\\d+)`, "i");
    const m2 = t.match(r2);
    if (m2) return Number(m2[1]);

    const r3 = new RegExp(`(\\d+)\\s*(?:tabs?|tablets?|pills?|caps?|capsules?)\\b`, "i");
    const m3 = t.match(r3);
    if (m3 && t.includes(key)) return Number(m3[1]);
  }
  return null;
}

function applyMedicationHeuristics(inputText: string, planned: AssistantPlan): AssistantPlan {
  const text = inputText.toLowerCase();
  const actions = planned.actions.map((a) => ({ ...a }));

  for (const med of MEDICATION_DEFAULTS) {
    const mentioned = med.keys.some((k) => text.includes(k));
    if (!mentioned) continue;

    const existingIndex = actions.findIndex(
      (a) => a.type === "log_supplement" && med.keys.some((k) => normalizeKey(a.data.supplement).includes(normalizeKey(k)))
    );

    const count = extractCountNear(text, med.keys);
    const unitsTaken = count && Number.isFinite(count) && count > 0 ? count : 1;
    const dose = Math.round(unitsTaken * med.perUnit);
    const note = `Assumed ${unitsTaken} ${med.formLabel}${unitsTaken === 1 ? "" : "s"} × ${med.perUnit}${med.unit}.`;

    if (existingIndex === -1) {
      actions.push({
        type: "log_supplement",
        title: `Log ${med.canonical}`,
        confidence: unitsTaken === 1 ? 0.75 : 0.85,
        data: {
          supplement: med.canonical,
          dosage: dose,
          unit: med.unit,
          date: null,
          time: null,
          notes: note,
        },
      });
      continue;
    }

    const existing = actions[existingIndex] as Extract<AssistantPlan["actions"][number], { type: "log_supplement" }>;

    // If the model left it blank or used the generic defaults, overwrite with a sensible default.
    const looksDefault =
      existing.data.dosage == null ||
      existing.data.unit == null ||
      (existing.data.dosage === 1 && normalizeKey(existing.data.unit) === "serving");

    if (looksDefault) {
      existing.data.dosage = dose;
      existing.data.unit = med.unit;
      existing.data.notes = existing.data.notes ? `${existing.data.notes}\n${note}` : note;
      existing.confidence = Math.max(existing.confidence, unitsTaken === 1 ? 0.75 : 0.85);
      existing.title = existing.title || `Log ${med.canonical}`;
      actions[existingIndex] = existing;
    }
  }

  return { ...planned, actions: actions.slice(0, 12) };
}

function extractCount(text: string, term: string): number | null {
  const t = text.toLowerCase();
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m1 = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s+(?:x\\s*)?(?:${escaped})\\b`, "i"));
  if (m1) return Number(m1[1]);

  const m2 = t.match(new RegExp(`\\b${escaped}\\b\\s*(\\d+(?:\\.\\d+)?)`, "i"));
  if (m2) return Number(m2[1]);

  const m3 = t.match(new RegExp(`\\b(one|two|three|four|five|six)\\s+(?:${escaped})\\b`, "i"));
  if (m3) {
    const map: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    return map[m3[1].toLowerCase()] ?? null;
  }
  return null;
}

function applyPortionHeuristics(inputText: string, planned: AssistantPlan): AssistantPlan {
  const text = inputText.toLowerCase();
  const actions = planned.actions.map((a) => ({ ...a }));

  const mealIndex = actions.findIndex((a) => a.type === "log_meal");
  if (mealIndex === -1) return planned;

  const meal = actions[mealIndex] as Extract<AssistantPlan["actions"][number], { type: "log_meal" }>;

  // Only set grams when the user implied a COUNT (eggs/slices/pieces) and the model didn't provide grams.
  const rules: Array<{
    key: string;
    gramsEach: number;
    terms: string[];
    note: (count: number, grams: number) => string;
  }> = [
    {
      key: "egg",
      gramsEach: 50,
      terms: ["egg", "eggs"],
      note: (count, grams) => `Assumed ${count} egg(s) ≈ ${grams}g edible portion.`,
    },
    {
      key: "bacon",
      gramsEach: 15,
      terms: ["bacon", "beef bacon", "turkey bacon"],
      note: (count, grams) => `Assumed ${count} slice/piece bacon ≈ ${grams}g.`,
    },
    {
      key: "waffle",
      gramsEach: 35,
      terms: ["waffle", "waffles"],
      note: (count, grams) => `Assumed ${count} waffle(s) ≈ ${grams}g.`,
    },
    {
      key: "chicken breast",
      gramsEach: 120,
      terms: ["chicken breast", "breast"],
      note: (count, grams) => `Assumed ${count} chicken breast portion(s) ≈ ${grams}g.`,
    },
    {
      key: "chicken thigh",
      gramsEach: 100,
      terms: ["chicken thigh", "thigh"],
      note: (count, grams) => `Assumed ${count} chicken thigh portion(s) ≈ ${grams}g.`,
    },
  ];

  const nextItems = meal.data.items.map((item) => {
    if (item.gramsConsumed != null) return item;

    // If the model put a small integer in "servings", it might be a count (2 eggs, 2 slices, etc).
    const servingsAsCount =
      typeof item.servings === "number" && Number.isFinite(item.servings) && item.servings > 0 && item.servings <= 6
        ? Math.round(item.servings)
        : null;

    const normalized = normalizeKey(`${item.label} ${item.usdaQuery}`);

    for (const rule of rules) {
      const mentioned = rule.terms.some((t) => normalized.includes(normalizeKey(t))) || normalized.includes(rule.key);
      if (!mentioned) continue;

      // Try to read explicit count from the user's text; otherwise fall back to servings-as-count.
      const countFromText =
        rule.terms
          .map((t) => extractCount(text, t))
          .find((v) => typeof v === "number" && Number.isFinite(v) && v > 0) ?? null;
      const count = (countFromText != null ? countFromText : servingsAsCount) as number | null;
      if (count == null || !Number.isFinite(count) || count <= 0) continue;

      const grams = Math.round(count * rule.gramsEach * 10) / 10;
      const note = rule.note(count, grams);

      return {
        ...item,
        gramsConsumed: grams,
        servings: null, // let the client compute servings from grams once USDA match is selected
        notes: item.notes ? `${item.notes}\n${note}` : note,
      };
    }

    return item;
  });

  // Deduplicate by query/label (some models repeat items across turns).
  const deduped = new Map<string, typeof nextItems[number]>();
  for (const item of nextItems) {
    const key = normalizeKey(item.usdaQuery || item.label);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, item);
      continue;
    }
    const merged = {
      ...existing,
      gramsConsumed:
        existing.gramsConsumed != null && item.gramsConsumed != null
          ? existing.gramsConsumed + item.gramsConsumed
          : existing.gramsConsumed ?? item.gramsConsumed ?? null,
      servings:
        existing.servings != null && item.servings != null
          ? existing.servings + item.servings
          : existing.servings ?? item.servings ?? null,
      notes: [existing.notes, item.notes].filter(Boolean).join("\n") || undefined,
    };
    deduped.set(key, merged);
  }

  meal.data.items = Array.from(deduped.values());
  actions[mealIndex] = meal;
  return { ...planned, actions: actions.slice(0, 12) };
}

const SYSTEM_PROMPT = `You are an assistant for a health tracking app.

You convert the user's free-form text into a SHORT list of actions the app can apply.

You may also be given:
- conversation history
- existing suggested actions (not yet applied)

If existing actions are provided, update them instead of creating duplicates.
Example: if the user says "they were cooked in 1 tbsp olive oil", and there is an existing meal action,
add an item like "olive oil" (usdaQuery "olive oil") and add a note about the tablespoon.

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
- Include actions implied by the user. If unsure, ask for clarification in "message" and keep actions minimal.
- Prefer 2-6 actions total.
- For meal items: create USDA-friendly queries (e.g. "broccoli steamed", "chicken breast grilled", "white rice cooked").
- If the user mentions eating only part of something, prefer gramsConsumed if possible; otherwise include servings (e.g. 0.5).
- IMPORTANT: USDA foods generally do NOT include the user's specific cooking oils/fats. If the user says "cooked in olive oil/butter/etc", add a SEPARATE meal item for that oil/fat.
- If the user mentions common measures, convert when safe:
  - 1 tbsp olive oil ≈ 13.5g (set gramsConsumed and note the assumption)
- For common OTC medications (e.g. ibuprofen/Advil), set a reasonable default dose if the user doesn't specify (include an assumption note).
- If no severity is given for a symptom, set severity to 5 (moderate).
- If dosage/unit is missing for a supplement, use dosage 1 and unit "serving".
- If date/time is not specified, use null (the client will default to 'now' or 'today').
- confidence must be 0-1 and reflect how certain you are that the action is correct.`;

async function tryOpenAiPlan(args: {
  model: string;
  text: string;
  nowIso?: string;
  today?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  existingActions?: AssistantPlan["actions"];
}): Promise<AssistantPlan | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const nowBlock = args.nowIso ? `\nCurrent time (ISO): ${args.nowIso}` : "";
  const todayBlock = args.today ? `\nToday's date: ${args.today}` : "";
  const historyBlock =
    args.history && args.history.length > 0
      ? `\n\nConversation so far (most recent last):\n${args.history
          .slice(-8)
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
        { role: "user", content: `${userPrompt}${historyBlock}${existingActionsBlock}` },
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
    const history = parsedBody.data.history;
    const existingActions = parsedBody.data.existingActions;

    const models = {
      cheap: process.env.OPENAI_ASSISTANT_MODEL_CHEAP || "gpt-4o-mini",
      strong: process.env.OPENAI_ASSISTANT_MODEL_STRONG || "gpt-4o",
    };

    let planned = await tryOpenAiPlan({ model: models.cheap, text, nowIso, today, history, existingActions });
    if (planned && shouldUpgradeToStrongModel(planned)) {
      const upgraded = await tryOpenAiPlan({ model: models.strong, text, nowIso, today, history, existingActions });
      if (upgraded) planned = upgraded;
    } else if (!planned) {
      planned = await tryOpenAiPlan({ model: models.strong, text, nowIso, today, history, existingActions });
    }

    if (!planned) {
      return NextResponse.json(
        { success: false, error: "Could not understand that. Try adding a bit more detail." },
        { status: 422 }
      );
    }

    const enriched = applyPortionHeuristics(text, applyMedicationHeuristics(text, applyCookingHeuristics(text, planned)));
    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Assistant plan error:", error);
    return NextResponse.json({ success: false, error: "Failed to plan actions. Please try again." }, { status: 500 });
  }
}
