import { supabase } from "../client";
import { requireAuthUserId } from "../constants";

function normalizeQuery(raw: string): string {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

