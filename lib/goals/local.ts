import type { NutrientGoals } from "@/types";

const STORAGE_KEY = "tibera:goals:v1";
const EVENTS_KEY = "tibera:goal-events:v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readLocalGoals(): NutrientGoals | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const calories = typeof parsed.calories === "number" ? parsed.calories : null;
    const protein = typeof parsed.protein === "number" ? parsed.protein : null;
    const carbs = typeof parsed.carbs === "number" ? parsed.carbs : null;
    const fat = typeof parsed.fat === "number" ? parsed.fat : null;
    const fiber = typeof parsed.fiber === "number" ? parsed.fiber : null;
    const custom = isRecord(parsed.customNutrients) ? parsed.customNutrients : {};

    const customNutrients: Record<string, number> = {};
    for (const [key, value] of Object.entries(custom)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        customNutrients[key] = value;
      }
    }

    if (
      calories == null ||
      protein == null ||
      carbs == null ||
      fat == null ||
      fiber == null
    ) {
      return null;
    }

    return {
      calories,
      protein,
      carbs,
      fat,
      fiber,
      customNutrients,
    };
  } catch {
    return null;
  }
}

export function writeLocalGoals(goals: NutrientGoals): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // ignore storage failures
  }
}

export interface LocalGoalEvent {
  ts: string;
  eventType: "micronutrient_set" | "micronutrient_remove" | "macros_saved";
  nutrientKey?: string;
  amount?: number;
  unit?: string;
  prevAmount?: number;
  metadata?: Record<string, unknown>;
}

export function appendLocalGoalEvent(event: Omit<LocalGoalEvent, "ts"> & { ts?: string }): void {
  if (typeof window === "undefined") return;
  try {
    const existingRaw = window.localStorage.getItem(EVENTS_KEY);
    const existing: LocalGoalEvent[] = existingRaw ? JSON.parse(existingRaw) : [];
    const next = [
      ...(Array.isArray(existing) ? existing : []),
      {
        ts: event.ts ?? new Date().toISOString(),
        eventType: event.eventType,
        nutrientKey: event.nutrientKey,
        amount: event.amount,
        unit: event.unit,
        prevAmount: event.prevAmount,
        metadata: event.metadata ?? {},
      },
    ].slice(-500);
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

