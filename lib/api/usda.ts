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
      score: 1,
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

    const data: USDAFoodItem = await response.json();

    const nutrients: FoodNutrient[] = data.foodNutrients
      .filter((n) => TRACKED_NUTRIENTS[n.nutrientNumber])
      .map((n) => ({
        nutrientId: n.nutrientNumber,
        amount: n.value,
        unit: n.unitName,
      }));

    const food: Food = {
      fdcId: data.fdcId.toString(),
      description: data.description,
      brandOwner: data.brandOwner || data.brandName,
      servingSize: data.servingSize || 100,
      servingSizeUnit: data.servingSizeUnit || "g",
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
