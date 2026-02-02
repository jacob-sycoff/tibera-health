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
  pageSize: number = 25
): Promise<FoodSearchResult[]> {
  const cacheKey = `${query}-${pageSize}`;

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
  url.searchParams.set("dataType", "Foundation,SR Legacy,Branded");

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

export async function getFoodDetails(fdcId: string): Promise<Food | null> {
  // Check cache
  const cached = foodCache.get(fdcId);
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }

  const apiKey = getApiKey();
  const url = `${USDA_API_BASE}/food/${fdcId}?api_key=${apiKey}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
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
    console.error("USDA food details error:", error);
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
