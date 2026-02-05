import { supabase } from "../client";
import { requireAuthUserId } from "../constants";

function normalizeQuery(raw: string): string {
  const base = (raw || "")
    .trim()
    .toLowerCase()
    // keep words/numbers, drop punctuation
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Strip quantity noise so overrides generalize:
  // "steak (16 oz)" -> "steak"
  // "3 eggs" -> "eggs"
  // "200 g rice" -> "rice"
  const tokens = base.split(" ").filter(Boolean);
  const unitNoise = new Set([
    "g",
    "gram",
    "grams",
    "kg",
    "kilogram",
    "kilograms",
    "oz",
    "ounce",
    "ounces",
    "lb",
    "lbs",
    "pound",
    "pounds",
    "ml",
    "milliliter",
    "milliliters",
    "l",
    "liter",
    "liters",
    "cup",
    "cups",
    "tbsp",
    "tablespoon",
    "tablespoons",
    "tsp",
    "teaspoon",
    "teaspoons",
    "serving",
    "servings",
    "of",
  ]);

  const filtered = tokens.filter((t) => {
    if (unitNoise.has(t)) return false;
    if (/^\d+(?:\.\d+)?$/.test(t)) return false;
    if (/^\d+\/\d+$/.test(t)) return false;
    return true;
  });

  return filtered.join(" ").trim();
}

type OverrideRow = { fdc_id: string };

const cacheByUser = new Map<string, Map<string, string>>();

export async function getFoodResolutionOverride(rawQuery: string): Promise<string | null> {
  const queryNorm = normalizeQuery(rawQuery);
  if (!queryNorm) return null;
  const userId = await requireAuthUserId();

  const userCache = cacheByUser.get(userId);
  if (userCache?.has(queryNorm)) return userCache.get(queryNorm) ?? null;

  const { data, error } = await supabase
    .from("food_resolution_overrides")
    .select("fdc_id")
    .eq("user_id", userId)
    .eq("query_norm", queryNorm)
    .maybeSingle();
  if (error) throw error;
  const fdcId = (data as OverrideRow | null)?.fdc_id ?? null;

  if (!cacheByUser.has(userId)) cacheByUser.set(userId, new Map());
  cacheByUser.get(userId)!.set(queryNorm, fdcId ?? "");
  return fdcId;
}

export async function upsertFoodResolutionOverride(rawQuery: string, fdcId: string): Promise<void> {
  const queryNorm = normalizeQuery(rawQuery);
  if (!queryNorm) return;
  if (!fdcId) return;
  const userId = await requireAuthUserId();

  const { error } = await supabase.from("food_resolution_overrides").upsert(
    { user_id: userId, query_norm: queryNorm, fdc_id: fdcId, updated_at: new Date().toISOString() },
    { onConflict: "user_id,query_norm" }
  );
  if (error) throw error;

  if (!cacheByUser.has(userId)) cacheByUser.set(userId, new Map());
  cacheByUser.get(userId)!.set(queryNorm, fdcId);
}
