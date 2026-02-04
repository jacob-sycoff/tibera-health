/**
 * Shared Action Schemas for Assistant V3
 *
 * Single source of truth for all action type definitions used by:
 * - Server route (app/api/assistant/conversation-v3/route.ts)
 * - Client API wrapper (lib/api/assistant-v3.ts)
 * - Assistant launcher component (components/assistant/assistant-launcher.tsx)
 *
 * Supports 11 action types: 5 create, 5 edit, 1 delete.
 */

import { z } from "zod";

// ── Base schemas ──────────────────────────────────────────────────────

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const TimeSchema = z.string().regex(/^\d{2}:\d{2}$/);

export const MealItemSchema = z.object({
  label: z.string().min(1),
  usdaQuery: z.string().min(1),
  gramsConsumed: z.number().positive().nullable().optional(),
  servings: z.number().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ── Action type literals ──────────────────────────────────────────────

export const ACTION_TYPES = [
  "log_meal",
  "log_symptom",
  "log_supplement",
  "log_sleep",
  "add_shopping_item",
  "edit_meal",
  "edit_symptom",
  "edit_supplement",
  "edit_sleep",
  "edit_shopping_item",
  "delete_entry",
] as const;

export type ActionTypeLiteral = (typeof ACTION_TYPES)[number];

// ── Sleep & shopping enums ────────────────────────────────────────────

export const SLEEP_FACTORS = [
  "caffeine",
  "alcohol",
  "exercise",
  "stress",
  "screen_time",
  "late_meal",
  "medication",
  "late_night_chores",
] as const;

export const SHOPPING_CATEGORIES = [
  "produce",
  "dairy",
  "meat",
  "grains",
  "frozen",
  "canned",
  "snacks",
  "beverages",
  "household",
  "other",
] as const;

export const ENTRY_TYPES = [
  "meal",
  "symptom",
  "supplement",
  "sleep",
  "shopping_item",
] as const;

// ── Zod action schemas (discriminated union on "type") ────────────────

export const ActionSchema = z.discriminatedUnion("type", [
  // ─── Create actions ───────────────────────────────────────────────

  z.object({
    type: z.literal("log_meal"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    data: z.object({
      date: DateSchema.nullable().optional(),
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
      items: z.array(MealItemSchema).min(1),
      notes: z.string().nullable().optional(),
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
      notes: z.string().nullable().optional(),
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
      notes: z.string().nullable().optional(),
    }),
  }),

  z.object({
    type: z.literal("log_sleep"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    data: z.object({
      date: DateSchema.nullable().optional(),
      bedtime: TimeSchema.nullable().optional(),
      wake_time: TimeSchema.nullable().optional(),
      quality: z.number().int().min(1).max(5).nullable().optional(),
      factors: z.array(z.enum(SLEEP_FACTORS)).nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  }),

  z.object({
    type: z.literal("add_shopping_item"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    data: z.object({
      name: z.string().min(1),
      quantity: z.number().positive().nullable().optional(),
      unit: z.string().nullable().optional(),
      category: z.enum(SHOPPING_CATEGORIES).nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  }),

  // ─── Edit actions ─────────────────────────────────────────────────

  z.object({
    type: z.literal("edit_meal"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    entryId: z.string().uuid(),
    data: z.object({
      date: DateSchema.nullable().optional(),
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
      items: z.array(MealItemSchema).nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  }),

  z.object({
    type: z.literal("edit_symptom"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    entryId: z.string().uuid(),
    data: z.object({
      severity: z.number().int().min(1).max(10).nullable().optional(),
      date: DateSchema.nullable().optional(),
      time: TimeSchema.nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  }),

  z.object({
    type: z.literal("edit_supplement"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    entryId: z.string().uuid(),
    data: z.object({
      dosage: z.number().positive().nullable().optional(),
      unit: z.string().nullable().optional(),
      date: DateSchema.nullable().optional(),
      time: TimeSchema.nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  }),

  z.object({
    type: z.literal("edit_sleep"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    entryId: z.string().uuid(),
    data: z.object({
      bedtime: TimeSchema.nullable().optional(),
      wake_time: TimeSchema.nullable().optional(),
      quality: z.number().int().min(1).max(5).nullable().optional(),
      factors: z.array(z.enum(SLEEP_FACTORS)).nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  }),

  z.object({
    type: z.literal("edit_shopping_item"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    entryId: z.string().uuid(),
    data: z.object({
      name: z.string().nullable().optional(),
      quantity: z.number().positive().nullable().optional(),
      unit: z.string().nullable().optional(),
      category: z.enum(SHOPPING_CATEGORIES).nullable().optional(),
      is_checked: z.boolean().nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  }),

  // ─── Delete action ────────────────────────────────────────────────

  z.object({
    type: z.literal("delete_entry"),
    title: z.string().min(1),
    confidence: z.number().min(0).max(1),
    entryId: z.string().uuid(),
    data: z.object({
      entryType: z.enum(ENTRY_TYPES),
    }),
  }),
]);

export type Action = z.infer<typeof ActionSchema>;

// ── Response schema ───────────────────────────────────────────────────

export const AssistantV3ResponseSchema = z.object({
  message: z.string().min(1),
  actions: z.array(ActionSchema).max(12),
  decision: z.object({
    intent: z.enum(["log", "clarify", "chat"]),
    apply: z.enum(["auto", "confirm", "none"]),
    confidence: z.number().min(0).max(1),
    action_handling: z.enum(["keep", "replace", "clear"]),
  }),
});

export type AssistantV3Response = z.infer<typeof AssistantV3ResponseSchema>;

// ── Recent entry schema (for edit/delete context) ─────────────────────

export const RecentEntrySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(ENTRY_TYPES),
  summary: z.string().max(200),
  date: z.string().optional(),
  time: z.string().optional(),
});

export type RecentEntry = z.infer<typeof RecentEntrySchema>;

// ── OpenAI JSON Schema ────────────────────────────────────────────────
//
// Uses `anyOf` inside `actions.items` to give each action type its own
// schema with only the relevant data fields. This replaces the old flat
// superset approach (all fields nullable on every action). The model gets
// explicit structural guidance per action type, reducing output tokens
// and improving accuracy. Zod still validates after generation.

const MEAL_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["label", "usdaQuery", "gramsConsumed", "servings", "notes"],
  properties: {
    label: { type: "string", minLength: 1 },
    usdaQuery: { type: "string", minLength: 1 },
    gramsConsumed: { type: ["number", "null"], minimum: 0 },
    servings: { type: ["number", "null"], minimum: 0 },
    notes: { type: ["string", "null"] },
  },
} as const;

const SLEEP_FACTORS_ENUM = [
  "caffeine", "alcohol", "exercise", "stress",
  "screen_time", "late_meal", "medication", "late_night_chores",
] as const;

const SHOPPING_CATEGORIES_ENUM = [
  "produce", "dairy", "meat", "grains", "frozen",
  "canned", "snacks", "beverages", "household", "other", null,
] as const;

const ENTRY_TYPES_ENUM = [
  "meal", "symptom", "supplement", "sleep", "shopping_item", null,
] as const;

export const RESPONSE_JSON_SCHEMA = {
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
          anyOf: [
            // ─── log_meal ─────────────────────────────────────────
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "title", "confidence", "entryId", "data"],
              properties: {
                type: { enum: ["log_meal"] },
                title: { type: "string", minLength: 1 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                entryId: { type: ["string", "null"] },
                data: {
                  type: "object",
                  additionalProperties: false,
                  required: ["date", "mealType", "items", "notes"],
                  properties: {
                    date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                    mealType: { type: ["string", "null"], enum: ["breakfast", "lunch", "dinner", "snack", null] },
                    items: { type: "array", minItems: 1, items: MEAL_ITEM_SCHEMA },
                    notes: { type: ["string", "null"] },
                  },
                },
              },
            },

            // ─── log_symptom ──────────────────────────────────────
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "title", "confidence", "entryId", "data"],
              properties: {
                type: { enum: ["log_symptom"] },
                title: { type: "string", minLength: 1 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                entryId: { type: ["string", "null"] },
                data: {
                  type: "object",
                  additionalProperties: false,
                  required: ["symptom", "severity", "date", "time", "notes"],
                  properties: {
                    symptom: { type: "string", minLength: 1 },
                    severity: { type: ["integer", "null"], minimum: 1, maximum: 10 },
                    date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                    time: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
                    notes: { type: ["string", "null"] },
                  },
                },
              },
            },

            // ─── log_supplement ────────────────────────────────────
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "title", "confidence", "entryId", "data"],
              properties: {
                type: { enum: ["log_supplement"] },
                title: { type: "string", minLength: 1 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                entryId: { type: ["string", "null"] },
                data: {
                  type: "object",
                  additionalProperties: false,
                  required: ["supplement", "dosage", "unit", "date", "time", "notes"],
                  properties: {
                    supplement: { type: "string", minLength: 1 },
                    dosage: { type: ["number", "null"], minimum: 0 },
                    unit: { type: ["string", "null"] },
                    date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                    time: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
                    notes: { type: ["string", "null"] },
                  },
                },
              },
            },

            // ─── log_sleep ────────────────────────────────────────
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "title", "confidence", "entryId", "data"],
              properties: {
                type: { enum: ["log_sleep"] },
                title: { type: "string", minLength: 1 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                entryId: { type: ["string", "null"] },
                data: {
                  type: "object",
                  additionalProperties: false,
                  required: ["date", "bedtime", "wake_time", "quality", "factors", "notes"],
                  properties: {
                    date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                    bedtime: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
                    wake_time: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
                    quality: { type: ["integer", "null"], minimum: 1, maximum: 5 },
                    factors: { type: ["array", "null"], items: { type: "string", enum: [...SLEEP_FACTORS_ENUM] } },
                    notes: { type: ["string", "null"] },
                  },
                },
              },
            },

            // ─── add_shopping_item ────────────────────────────────
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "title", "confidence", "entryId", "data"],
              properties: {
                type: { enum: ["add_shopping_item"] },
                title: { type: "string", minLength: 1 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                entryId: { type: ["string", "null"] },
                data: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "quantity", "unit", "category", "notes"],
                  properties: {
                    name: { type: "string", minLength: 1 },
                    quantity: { type: ["number", "null"], minimum: 0 },
                    unit: { type: ["string", "null"] },
                    category: { type: ["string", "null"], enum: [...SHOPPING_CATEGORIES_ENUM] },
                    notes: { type: ["string", "null"] },
                  },
                },
              },
            },

            // ─── edit_meal ────────────────────────────────────────
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "title", "confidence", "entryId", "data"],
              properties: {
                type: { enum: ["edit_meal"] },
                title: { type: "string", minLength: 1 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                entryId: { type: "string" },
                data: {
                  type: "object",
                  additionalProperties: false,
                  required: ["date", "mealType", "items", "notes"],
                  properties: {
                    date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                    mealType: { type: ["string", "null"], enum: ["breakfast", "lunch", "dinner", "snack", null] },
                    items: { type: ["array", "null"], items: MEAL_ITEM_SCHEMA },
                    notes: { type: ["string", "null"] },
                  },
                },
              },
            },

            // ─── edit_symptom ─────────────────────────────────────
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "title", "confidence", "entryId", "data"],
              properties: {
                type: { enum: ["edit_symptom"] },
                title: { type: "string", minLength: 1 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                entryId: { type: "string" },
                data: {
                  type: "object",
                  additionalProperties: false,
                  required: ["severity", "date", "time", "notes"],
                  properties: {
                    severity: { type: ["integer", "null"], minimum: 1, maximum: 10 },
                    date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                    time: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
                    notes: { type: ["string", "null"] },
                  },
                },
              },
            },

            // ─── edit_supplement ───────────────────────────────────
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "title", "confidence", "entryId", "data"],
              properties: {
                type: { enum: ["edit_supplement"] },
                title: { type: "string", minLength: 1 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                entryId: { type: "string" },
                data: {
                  type: "object",
                  additionalProperties: false,
                  required: ["dosage", "unit", "date", "time", "notes"],
                  properties: {
                    dosage: { type: ["number", "null"], minimum: 0 },
                    unit: { type: ["string", "null"] },
                    date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                    time: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
                    notes: { type: ["string", "null"] },
                  },
                },
              },
            },

            // ─── edit_sleep ───────────────────────────────────────
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "title", "confidence", "entryId", "data"],
              properties: {
                type: { enum: ["edit_sleep"] },
                title: { type: "string", minLength: 1 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                entryId: { type: "string" },
                data: {
                  type: "object",
                  additionalProperties: false,
                  required: ["bedtime", "wake_time", "quality", "factors", "notes"],
                  properties: {
                    bedtime: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
                    wake_time: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
                    quality: { type: ["integer", "null"], minimum: 1, maximum: 5 },
                    factors: { type: ["array", "null"], items: { type: "string", enum: [...SLEEP_FACTORS_ENUM] } },
                    notes: { type: ["string", "null"] },
                  },
                },
              },
            },

            // ─── edit_shopping_item ───────────────────────────────
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "title", "confidence", "entryId", "data"],
              properties: {
                type: { enum: ["edit_shopping_item"] },
                title: { type: "string", minLength: 1 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                entryId: { type: "string" },
                data: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "quantity", "unit", "category", "is_checked", "notes"],
                  properties: {
                    name: { type: ["string", "null"] },
                    quantity: { type: ["number", "null"], minimum: 0 },
                    unit: { type: ["string", "null"] },
                    category: { type: ["string", "null"], enum: [...SHOPPING_CATEGORIES_ENUM] },
                    is_checked: { type: ["boolean", "null"] },
                    notes: { type: ["string", "null"] },
                  },
                },
              },
            },

            // ─── delete_entry ─────────────────────────────────────
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "title", "confidence", "entryId", "data"],
              properties: {
                type: { enum: ["delete_entry"] },
                title: { type: "string", minLength: 1 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                entryId: { type: "string" },
                data: {
                  type: "object",
                  additionalProperties: false,
                  required: ["entryType"],
                  properties: {
                    entryType: { type: "string", enum: ["meal", "symptom", "supplement", "sleep", "shopping_item"] },
                  },
                },
              },
            },
          ],
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
} as const;
