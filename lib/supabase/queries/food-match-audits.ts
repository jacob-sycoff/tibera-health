import { supabase } from "../client";
import { requireAuthUserId } from "../constants";

export type FoodMatchAuditSource = "assistant" | "manual_log" | "recompute" | "photo";

export async function insertFoodMatchAudit(args: {
  mealItemId: string;
  source: FoodMatchAuditSource;
  queryText?: string | null;
  queryNorm?: string | null;
  candidates?: unknown | null;
  selected?: unknown | null;
  model?: unknown | null;
}): Promise<void> {
  const userId = await requireAuthUserId();
  const { error } = await supabase.from("food_match_audits").insert({
    user_id: userId,
    meal_item_id: args.mealItemId,
    source: args.source,
    query_text: args.queryText ?? null,
    query_norm: args.queryNorm ?? null,
    candidates: args.candidates ?? null,
    selected: args.selected ?? null,
    model: args.model ?? null,
  });
  if (error) throw error;
}

