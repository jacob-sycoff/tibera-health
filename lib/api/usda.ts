import type {
  Food,
  FoodSearchResult,
  USDAFoodSearchResponse,
  USDAFoodItem,
  FoodNutrient,
} from "@/types";

const USDA_API_BASE = "https://api.nal.usda.gov/fdc/v1";

// Get API key from environment or use demo key
const getApiKey = () => {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_USDA_API_KEY || "DEMO_KEY";
  }
  return process.env.USDA_API_KEY || "DEMO_KEY";
};

// Nutrient IDs we care about from USDA
export const TRACKED_NUTRIENTS: Record<string, { name: string; unit: string }> = {
  "1008": { name: "Calories", unit: "kcal" },
  "1003": { name: "Protein", unit: "g" },
  "1005": { name: "Carbohydrates", unit: "g" },
  "1004": { name: "Total Fat", unit: "g" },
  "1079": { name: "Fiber", unit: "g" },
  "1087": { name: "Calcium", unit: "mg" },
  "1089": { name: "Iron", unit: "mg" },
  "1090": { name: "Magnesium", unit: "mg" },
  "1091": { name: "Phosphorus", unit: "mg" },
  "1092": { name: "Potassium", unit: "mg" },
  "1093": { name: "Sodium", unit: "mg" },
  "1095": { name: "Zinc", unit: "mg" },
  "1098": { name: "Copper", unit: "mg" },
  "1103": { name: "Selenium", unit: "mcg" },
  "1106": { name: "Vitamin A", unit: "mcg" },
  "1109": { name: "Vitamin E", unit: "mg" },
  "1114": { name: "Vitamin D", unit: "mcg" },
  "1162": { name: "Vitamin C", unit: "mg" },
  "1165": { name: "Vitamin B1 (Thiamin)", unit: "mg" },
  "1166": { name: "Vitamin B2 (Riboflavin)", unit: "mg" },
  "1167": { name: "Vitamin B3 (Niacin)", unit: "mg" },
  "1170": { name: "Vitamin B5 (Pantothenic Acid)", unit: "mg" },
  "1175": { name: "Vitamin B6", unit: "mg" },
  "1177": { name: "Folate", unit: "mcg" },
  "1178": { name: "Vitamin B12", unit: "mcg" },
  "1185": { name: "Vitamin K", unit: "mcg" },
  "1253": { name: "Cholesterol", unit: "mg" },
  "1257": { name: "Trans Fat", unit: "g" },
  "1258": { name: "Saturated Fat", unit: "g" },
  "2000": { name: "Added Sugars", unit: "g" },
};

// Simple in-memory cache
const searchCache = new Map<string, { data: FoodSearchResult[]; timestamp: number }>();
const foodCache = new Map<string, { data: Food; timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION;
}

export async function searchFoods(
  query: string,
  pageSize: number = 25,
  options?: { dataTypes?: string }
): Promise<FoodSearchResult[]> {
  const cacheKey = `${query}-${pageSize}-${options?.dataTypes ?? "Foundation,SR Legacy,Branded"}`;

  // Check cache
  const cached = searchCache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }

  const apiKey = getApiKey();
  const url = new URL(`${USDA_API_BASE}/foods/search`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", pageSize.toString());
  url.searchParams.set("dataType", options?.dataTypes ?? "Foundation,SR Legacy,Branded");

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data: USDAFoodSearchResponse = await response.json();

    const results: FoodSearchResult[] = data.foods.map((food) => ({
      fdcId: food.fdcId.toString(),
      description: food.description,
      brandOwner: food.brandOwner || food.brandName,
      dataType: food.dataType,
      foodCategory: (food as unknown as { foodCategory?: string }).foodCategory,
      score: (food as unknown as { score?: number }).score ?? 1,
    }));

    // Cache results
    searchCache.set(cacheKey, { data: results, timestamp: Date.now() });

    return results;
  } catch (error) {
    console.error("USDA search error:", error);
    throw error;
  }
}

// Smarter search that improves recall/precision for common phrasing like
// "green beans cooked" (USDA often uses "Beans, snap, green, cooked, boiled...").
export async function smartSearchFoods(
  query: string,
  pageSize: number = 25
): Promise<FoodSearchResult[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const variants = buildQueryVariants(normalized);
  // Pull deeper per variant to increase recall for short ingredient queries.
  const perVariant = Math.max(18, Math.ceil(pageSize * 1.6));

  const looksGeneric = looksLikeGenericIngredientQuery(normalized);
  // For generic ingredient queries, branded results often dominate the API response ordering and
  // crowd out better reference entries. Do a reference-first pass, then fall back to branded.
  const primaryDataTypes = looksGeneric ? "Foundation,SR Legacy" : "Foundation,SR Legacy,Branded";
  const primaryBuckets = await Promise.all(
    variants.map((q) => searchFoods(q, perVariant, { dataTypes: primaryDataTypes }).catch(() => []))
  );

  const byId = new Map<string, FoodSearchResult>();
  for (const list of primaryBuckets) {
    for (const item of list) {
      if (!byId.has(item.fdcId)) byId.set(item.fdcId, item);
    }
  }

  // If we didn't get enough candidates, expand with branded.
  if (looksGeneric && byId.size < Math.max(8, Math.floor(pageSize * 0.6))) {
    const secondaryBuckets = await Promise.all(
      variants.map((q) => searchFoods(q, perVariant, { dataTypes: "Foundation,SR Legacy,Branded" }).catch(() => []))
    );
    for (const list of secondaryBuckets) {
      for (const item of list) {
        if (!byId.has(item.fdcId)) byId.set(item.fdcId, item);
      }
    }
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => scoreCandidate(normalized, b) - scoreCandidate(normalized, a));
  return merged.slice(0, pageSize);
}

export async function getFoodDetails(fdcId: string): Promise<Food | null> {
  // Check cache
  const cached = foodCache.get(fdcId);
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }

  if (!/^\d+$/.test(fdcId)) return null;

  const apiKey = getApiKey();
  const url = `${USDA_API_BASE}/food/${fdcId}?api_key=${apiKey}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data = (await response.json()) as unknown as USDAFoodItem;

    const serving = normalizeServingSize(data.servingSize, data.servingSizeUnit);

    const labelNutrients = extractLabelNutrients(data as unknown);

    const extracted = extractNutrients(data.foodNutrients, serving.scaleToServing, labelNutrients)
      .filter((n) => TRACKED_NUTRIENTS[n.nutrientId])
      .map((n) => ({
        nutrientId: n.nutrientId,
        amount: n.amount,
        unit: n.unit,
      }));

    const nutrients: FoodNutrient[] =
      extracted.length > 0
        ? extracted
        : Array.from(labelNutrients.entries())
            .filter(([nutrientId]) => TRACKED_NUTRIENTS[nutrientId])
            .map(([nutrientId, v]) => ({ nutrientId, amount: v.amount, unit: v.unit }));

    const food: Food = {
      fdcId: data.fdcId.toString(),
      description: data.description,
      brandOwner: data.brandOwner || data.brandName,
      servingSize: serving.size,
      servingSizeUnit: serving.unit,
      nutrients,
    };

    // Cache result
    foodCache.set(fdcId, { data: food, timestamp: Date.now() });

    return food;
  } catch (error) {
    // Avoid spamming the console for common transient failures.
    if (error instanceof Error && /USDA API error: 404/.test(error.message)) return null;
    console.warn("USDA food details error:", error);
    return null;
  }
}

export function getNutrientValue(
  nutrients: FoodNutrient[],
  nutrientId: string
): number {
  const nutrient = nutrients.find((n) => n.nutrientId === nutrientId);
  return nutrient?.amount || 0;
}

export function calculateNutrients(
  food: Food,
  servings: number
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const nutrient of food.nutrients) {
    const scaleFactor = servings;
    result[nutrient.nutrientId] = nutrient.amount * scaleFactor;
  }

  return result;
}

export function clearCache(): void {
  searchCache.clear();
  foodCache.clear();
}

// ============================================
// USDA RESPONSE NORMALIZATION
// ============================================

function normalizeServingSize(
  servingSize: unknown,
  servingSizeUnit: unknown
): { size: number; unit: string; scaleToServing: number } {
  const size = typeof servingSize === "number" && Number.isFinite(servingSize) && servingSize > 0 ? servingSize : 100;
  const unitRaw = typeof servingSizeUnit === "string" ? servingSizeUnit : "g";
  const unit = normalizeServingUnit(unitRaw);

  // FDC nutrient `amount` values are per 100g/100mL for most foods (including many branded items).
  // When the serving size is convertible to a mass/volume, scale nutrients to that serving.
  const scaleToServing = unit === "g" || unit === "ml" ? size / 100 : 1;

  return { size: unit === "g" || unit === "ml" ? size : 100, unit: unit === "g" || unit === "ml" ? unit : "g", scaleToServing };
}

function normalizeServingUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "g" || normalized === "gram" || normalized === "grams" || normalized === "grm") return "g";
  if (normalized === "ml" || normalized === "mlt" || normalized === "milliliter" || normalized === "milliliters") return "ml";
  return unit;
}

function buildQueryVariants(query: string): string[] {
  const variants = new Set<string>();
  variants.add(query);

  // USDA tends to describe oatmeal as "cereals, oats, ... cooked with water".
  // Expanding here improves recall significantly vs searching for "oatmeal".
  if (/\boatmeal\b/i.test(query)) {
    variants.add("oats cooked");
  }

  const qLower = query.toLowerCase();
  if (/\btomato\b/.test(qLower) && /\bsoup\b/.test(qLower)) {
    variants.add("soup, tomato");
    variants.add("tomato soup");
  }
  if (/\bgrilled\b/.test(qLower) && /\bcheese\b/.test(qLower) && /\bsandwich\b/.test(qLower)) {
    variants.add("sandwich, grilled cheese");
    variants.add("grilled cheese");
  }

  // Normalize common cooking terms to increase recall.
  const tokensToStrip = [
    "cooked",
    "raw",
    "steamed",
    "boiled",
    "grilled",
    "roasted",
    "baked",
    "fried",
    "sauteed",
    "sautéed",
  ];

  const stripped = tokensToStrip.reduce((acc, t) => acc.replace(new RegExp(`\\b${escapeRegExp(t)}\\b`, "gi"), " "), query);
  const base = stripped.replace(/\s+/g, " ").trim();
  if (base && base !== query) variants.add(base);

  // If user specified a cooking method, add a generic cooked variant too.
  const hasExplicitMethod = /\b(raw|cooked|steamed|boiled|grilled|roasted|baked|fried|sauteed|sautéed)\b/i.test(query);
  if (/\b(steamed|boiled|grilled|roasted|baked|fried|sauteed|sautéed)\b/i.test(query) && base) {
    variants.add(`${base} cooked`);
  }
  if (/\braw\b/i.test(query) && base) {
    variants.add(`${base} raw`);
  }
  // If user didn't specify, adding a cooked variant improves recall for many USDA entries
  // (e.g. rice/oatmeal/vegetables are frequently described as cooked).
  if (!hasExplicitMethod && base) {
    variants.add(`${base} cooked`);
  }

  return Array.from(variants).slice(0, 3);
}

const COOKING_TOKENS = new Set([
  "cooked",
  "raw",
  "steamed",
  "boiled",
  "grilled",
  "roasted",
  "baked",
  "fried",
  "sauteed",
  "sautéed",
  "poached",
  "smoked",
  "braised",
  "stir",
  "stirfry",
  "stir-fry",
  "stirfried",
]);

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "or",
  "the",
  "with",
  "without",
  "in",
  "of",
  "for",
  "to",
  "from",
  "homemade",
  "fresh",
  "frozen",
  "canned",
  "drained",
  "ready",
  "readytoeat",
  "ready-to-eat",
  "prepared",
  "unspecified",
]);

// These commonly produce "close but wrong" results when the user intends a plain ingredient.
// Penalties are intentionally large to counteract USDA scoring that ranks popular prepared foods highly.
const PREPARED_FORM_PENALTIES: Record<string, number> = {
  pie: 520,
  cake: 520,
  cookie: 520,
  pastry: 480,
  dessert: 520,
  candy: 520,

  bread: 460,
  roll: 360,
  cracker: 420,
  snack: 360,
  chip: 360,

  noodle: 460,
  pasta: 460,
  pizza: 520,
  burger: 520,
  sandwich: 520,
  soup: 360,
  salad: 260,
  cereal: 360,
  bar: 260,
  shake: 260,
  smoothie: 260,
  juice: 320,
  ice: 260,
  cream: 260,
};

const DERIVATIVE_FORM_PENALTIES: Record<string, number> = {
  bran: 420,
  flour: 420,
  powder: 360,
  concentrate: 360,
  extract: 360,
  syrup: 360,
  peel: 320,
  mix: 320,
  seasoning: 320,
  flavor: 280,
  grass: 460,
  instant: 320,
  quaker: 420,
  milk: 360,
  soymilk: 520,
  liqueur: 620,
  alcoholic: 620,
  babyfood: 620,
  infant: 620,
};

const PREPARED_FORM_TOKENS = new Set(Object.keys(PREPARED_FORM_PENALTIES));

// Strongly penalize unrequested varietals for common ingredients (e.g. broccoli).
const VARIETY_TOKENS = new Set(["raab", "rapini", "chinese"]);

const TOKEN_SYNONYMS: Record<string, string[]> = {
  oatmeal: ["oat"],
};

const MAJOR_INGREDIENT_PENALTIES: Record<string, number> = {
  chicken: 900,
  beef: 900,
  pork: 900,
  bacon: 700,
  ham: 700,
  turkey: 800,
  fish: 900,
  tuna: 900,
  salmon: 900,
  shrimp: 900,
  mayonnaise: 520,
  ranch: 520,
  club: 420,
  lettuce: 260,
  sauce: 260,
};

function tokenizeForMatch(input: string): string[] {
  const raw = input.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  // Light singularization helps align "noodles" vs "noodle", "crackers" vs "cracker".
  return raw.map((t) =>
    t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t
  );
}

function coreQueryTokens(query: string): string[] {
  const base = tokenizeForMatch(query).filter(
    (t) => t.length > 1 && !STOPWORDS.has(t) && !COOKING_TOKENS.has(t)
  );
  const expanded = new Set(base);
  for (const t of base) {
    const syns = TOKEN_SYNONYMS[t];
    if (!syns) continue;
    for (const s of syns) expanded.add(s);
  }
  return Array.from(expanded);
}

function looksLikeGenericIngredientQuery(query: string): boolean {
  if (/\bhomemade\b/i.test(query)) return true;
  const core = coreQueryTokens(query);
  if (core.length === 0) return true;
  if (core.length > 3) return false;
  if (/[0-9]/.test(query)) return false;
  // If user explicitly asked for a prepared form, it's not a plain ingredient query.
  if (core.some((t) => PREPARED_FORM_TOKENS.has(t))) return false;
  return true;
}

function scoreCandidate(query: string, candidate: FoodSearchResult): number {
  const desc = candidate.description.toLowerCase();
  const dt = (candidate.dataType || "").toLowerCase();
  const rawScore = typeof candidate.score === "number" ? candidate.score : 0;
  // USDA `score` can be very large for branded items; compress it so data quality + semantics dominate.
  const baseScore = Math.log1p(Math.max(0, rawScore)) * 25;

  // Prefer higher-quality reference data.
  const dataTypeBonus =
    dt.includes("foundation") ? 120 :
    dt.includes("sr legacy") || dt.includes("sr") ? 90 :
    dt.includes("survey") ? 40 :
    dt.includes("branded") ? 10 :
    0;

  const cookedQuery = /\b(cooked|steamed|boiled|grilled|roasted|baked|fried|sauteed|sautéed)\b/i.test(query);
  const rawQuery = /\braw\b/i.test(query);

  const hasRaw = /\braw\b/i.test(desc);
  const hasCooked = /\b(cooked|steamed|boiled|grilled|roasted|baked|fried|sauteed|sautéed)\b/i.test(desc);

  let methodScore = 0;
  if (cookedQuery) {
    if (hasCooked) methodScore += 120;
    if (hasRaw) methodScore -= 180;
  } else if (rawQuery) {
    if (hasRaw) methodScore += 120;
    if (hasCooked) methodScore -= 100;
  } else {
    // If user didn't specify, slightly prefer cooked entries for vegetables (often logged cooked).
    if (hasCooked && !hasRaw) methodScore += 10;
  }

  // If the user specifies a particular cooking method (grilled vs braised, etc.), prefer exact matches.
  const methodTokens = [
    "steamed",
    "boiled",
    "grilled",
    "roasted",
    "baked",
    "fried",
    "sauteed",
    "sautéed",
    "poached",
    "smoked",
    "braised",
  ] as const;
  const methodEquivalents: Partial<Record<(typeof methodTokens)[number], Array<(typeof methodTokens)[number]>>> =
    {
      steamed: ["boiled"],
      boiled: ["steamed"],
      roasted: ["baked"],
      baked: ["roasted"],
    };
  const queryMethods = methodTokens.filter((m) => new RegExp(`\\b${escapeRegExp(m)}\\b`, "i").test(query));
  const descMethods = methodTokens.filter((m) => new RegExp(`\\b${escapeRegExp(m)}\\b`, "i").test(desc));
  let specificMethodScore = 0;
  if (queryMethods.length > 0) {
    const descSetMethods = new Set(descMethods);
    const querySetMethods = new Set(queryMethods);
    const matchesMethod = (m: (typeof methodTokens)[number]) => {
      if (descSetMethods.has(m)) return "exact";
      const eq = methodEquivalents[m];
      if (eq?.some((e) => descSetMethods.has(e))) return "equivalent";
      return "none";
    };
    for (const qm of queryMethods) {
      const match = matchesMethod(qm);
      if (match === "exact") specificMethodScore += 140;
      else if (match === "equivalent") specificMethodScore += 70;
      else specificMethodScore -= 60;
    }
    for (const dm of descMethods) {
      if (querySetMethods.has(dm)) continue;
      // If the descriptor method is an acceptable equivalent for any requested method, don't treat it as conflicting.
      const isEquivalent = queryMethods.some((qm) => methodEquivalents[qm]?.includes(dm));
      if (isEquivalent) continue;
      specificMethodScore -= 80;
    }
  }

  // Token overlap (very simple, but helps e.g. "snap beans" vs "green beans").
  const qTokensAll = tokenizeForMatch(query);
  const qTokens = coreQueryTokens(query);
  const qSetAll = new Set(qTokensAll);
  const qSet = new Set(qTokens);
  const descTokens = tokenizeForMatch(desc);
  const descSet = new Set(descTokens);

  // If the user query is a generic ingredient (no numbers/brands), de-prioritize branded hits.
  // Branded results frequently win due to inflated USDA scores, but are often not what users mean.
  let brandedPenalty = 0;
  const looksGeneric = looksLikeGenericIngredientQuery(query);
  if (dt.includes("branded")) brandedPenalty -= looksGeneric ? 180 : 80;

  // Penalize common mismatches like "avocado" -> "avocado oil" unless explicitly asked.
  let mismatchPenalty = 0;
  const penalizeExtra = (token: string, penalty: number) => {
    if (descSet.has(token) && !qSetAll.has(token)) mismatchPenalty -= penalty;
  };
  if (looksGeneric) {
    penalizeExtra("oil", 420);
    const allowCereal = qSetAll.has("oatmeal") || qSetAll.has("oat");
    // For plain ingredient queries like "lemon" or "rice", steer away from prepared foods.
    for (const [t, penalty] of Object.entries(PREPARED_FORM_PENALTIES)) {
      if (qSetAll.has(t)) continue;
      if (t === "cereal" && allowCereal) continue;
      if (descSet.has(t)) mismatchPenalty -= penalty;
    }
    for (const [t, penalty] of Object.entries(DERIVATIVE_FORM_PENALTIES)) {
      if (qSetAll.has(t)) continue;
      if (t === "peel" && /\bwithout\s+peel\b/i.test(desc)) continue;
      if (descSet.has(t)) mismatchPenalty -= penalty;
    }
  } else {
    // Even for non-generic queries, penalize obvious wrong forms unless explicitly requested.
    // This fixes cases like "grilled cheese sandwich" matching "crackers, sandwich-type with cheese filling".
    for (const [t, penalty] of Object.entries(PREPARED_FORM_PENALTIES)) {
      if (qSetAll.has(t)) continue;
      if (descSet.has(t)) mismatchPenalty -= Math.round(penalty * 0.6);
    }
  }

  // Brand-ish SR Legacy entries often start with "BRAND'S," (e.g. "CAMPBELL'S, Tomato Soup").
  // For generic/homemade intents, prefer non-brand generic entries when available.
  if (looksGeneric && /^\w+'s,/.test(desc)) mismatchPenalty -= 650;

  // Dish mismatch penalty: down-rank candidates that introduce major ingredients not mentioned.
  for (const [t, penalty] of Object.entries(MAJOR_INGREDIENT_PENALTIES)) {
    if (!descSet.has(t)) continue;
    if (qSetAll.has(t)) continue;
    mismatchPenalty -= penalty;
  }

  // Penalize common "close but wrong" variants unless explicitly asked for.
  // Example: "broccoli cooked" should not match "broccoli raab, cooked".
  let variantPenalty = 0;
  const penalizeIfMissing = (token: string, penalty: number) => {
    if (descSet.has(token) && !qSetAll.has(token)) variantPenalty -= penalty;
  };
  for (const t of VARIETY_TOKENS) penalizeIfMissing(t, 500);

  let overlap = 0;
  let matchedCore = 0;
  for (const t of qTokens) {
    if (t.length <= 2) continue;
    // Exact token match is much stronger than substring.
    if (descSet.has(t)) {
      overlap += 18;
      matchedCore += 1;
    } else if (desc.includes(t)) {
      overlap += 6;
      matchedCore += 1;
    }
  }

  // If none of the core query tokens appear, it's almost certainly irrelevant (often driven by cooking terms).
  const hasAnyCore = qTokens.length === 0 ? true : qTokens.some((t) => descSet.has(t) || desc.includes(t));
  const coreMissingPenalty = hasAnyCore ? 0 : -800;

  let partialMatchPenalty = 0;
  if (qTokens.length >= 2 && matchedCore > 0 && matchedCore < Math.ceil(qTokens.length / 2)) {
    partialMatchPenalty -= 520;
  }

  return (
    baseScore +
    dataTypeBonus +
    methodScore +
    specificMethodScore +
    overlap +
    brandedPenalty +
    mismatchPenalty +
    variantPenalty +
    coreMissingPenalty +
    partialMatchPenalty
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractNutrients(
  foodNutrients: unknown,
  scaleToServing: number,
  overrides?: Map<string, { amount: number; unit: string }>
): Array<{ nutrientId: string; amount: number; unit: string }> {
  if (!Array.isArray(foodNutrients)) return [];

  const extracted: Array<{ nutrientId: string; amount: number; unit: string }> = [];

  for (const item of foodNutrients) {
    const nutrientId = getNutrientId(item);
    const amountPer100 = getNutrientAmount(item);
    const unit = getNutrientUnit(item);

    if (!nutrientId || amountPer100 == null || !unit) continue;

    const override = overrides?.get(nutrientId);
    extracted.push({
      nutrientId,
      amount: override ? override.amount : amountPer100 * scaleToServing,
      unit: override ? override.unit : unit,
    });
  }

  return extracted;
}

function getNutrientId(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;

  if (typeof record.nutrientId === "number") return String(record.nutrientId);
  const nutrient = record.nutrient as Record<string, unknown> | undefined;
  if (nutrient && typeof nutrient.id === "number") return String(nutrient.id);

  return null;
}

function getNutrientAmount(item: unknown): number | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;

  if (typeof record.amount === "number" && Number.isFinite(record.amount)) return record.amount;
  if (typeof record.value === "number" && Number.isFinite(record.value)) return record.value;

  if (typeof record.amount === "string") {
    const parsed = parseFloat(record.amount);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof record.value === "string") {
    const parsed = parseFloat(record.value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getNutrientUnit(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;

  if (typeof record.unitName === "string" && record.unitName.trim()) return record.unitName;
  const nutrient = record.nutrient as Record<string, unknown> | undefined;
  if (nutrient && typeof nutrient.unitName === "string" && nutrient.unitName.trim()) return nutrient.unitName;
  return null;
}

function extractLabelNutrients(data: unknown): Map<string, { amount: number; unit: string }> {
  const map = new Map<string, { amount: number; unit: string }>();
  if (!data || typeof data !== "object") return map;
  const record = data as Record<string, unknown>;
  const label = record.labelNutrients as Record<string, unknown> | undefined;
  if (!label || typeof label !== "object") return map;

  const getValue = (key: string): number | null => {
    const entry = label[key] as { value?: unknown } | undefined;
    const value = entry?.value;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const calories = getValue("calories");
  if (calories != null) map.set("1008", { amount: calories, unit: "kcal" });

  const protein = getValue("protein");
  if (protein != null) map.set("1003", { amount: protein, unit: "g" });

  const carbs = getValue("carbohydrates");
  if (carbs != null) map.set("1005", { amount: carbs, unit: "g" });

  const fat = getValue("fat");
  if (fat != null) map.set("1004", { amount: fat, unit: "g" });

  const fiber = getValue("fiber");
  if (fiber != null) map.set("1079", { amount: fiber, unit: "g" });

  const addedSugars = getValue("addedSugars");
  if (addedSugars != null) map.set("2000", { amount: addedSugars, unit: "g" });

  return map;
}
