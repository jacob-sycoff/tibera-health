// ==========================================
// Core Types
// ==========================================

export interface Profile {
  id: string;
  createdAt: Date;
  conditions: HealthCondition[];
  preferences: UserPreferences;
  goals: NutrientGoals;
}

export interface UserPreferences {
  units: "metric" | "imperial";
  theme: "light" | "dark" | "system";
  notifications: boolean;
}

// ==========================================
// Nutrients & Foods
// ==========================================

export type NutrientCategory =
  | "macro"
  | "vitamin"
  | "mineral"
  | "other"
  | "harmful";

export interface Nutrient {
  id: string;
  name: string;
  unit: string;
  category: NutrientCategory;
  dailyValue: number | null;
  description?: string;
}

export interface FoodNutrient {
  nutrientId: string;
  amount: number;
  unit: string;
}

export interface Food {
  fdcId: string;
  description: string;
  brandOwner?: string;
  servingSize: number;
  servingSizeUnit: string;
  nutrients: FoodNutrient[];
  category?: string;
}

export interface FoodSearchResult {
  fdcId: string;
  description: string;
  brandOwner?: string;
  score: number;
}

// ==========================================
// Meal Tracking
// ==========================================

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealItem {
  id: string;
  food: Food;
  servings: number;
  customServing?: number;
}

export interface MealLog {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  mealType: MealType;
  items: MealItem[];
  notes?: string;
  createdAt: Date;
}

export interface DailyNutrientSummary {
  date: string;
  nutrients: Record<string, number>;
  meals: MealLog[];
}

// ==========================================
// Meal Planning
// ==========================================

export interface PlannedMeal {
  id: string;
  date: string;
  mealType: MealType;
  foods: {
    food: Food;
    servings: number;
  }[];
  notes?: string;
}

export interface MealPlan {
  id: string;
  weekStart: string;
  meals: PlannedMeal[];
}

// ==========================================
// Shopping List
// ==========================================

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category: ShoppingCategory;
  checked: boolean;
  fromMealPlan?: boolean;
}

export type ShoppingCategory =
  | "produce"
  | "dairy"
  | "meat"
  | "grains"
  | "frozen"
  | "canned"
  | "snacks"
  | "beverages"
  | "household"
  | "other";

export interface ShoppingList {
  id: string;
  name: string;
  items: ShoppingItem[];
  createdAt: Date;
}

// ==========================================
// Sleep Tracking
// ==========================================

export type SleepQuality = 1 | 2 | 3 | 4 | 5;

export interface SleepLog {
  id: string;
  date: string;
  bedtime: string; // HH:mm format
  wakeTime: string; // HH:mm format
  quality: SleepQuality;
  notes?: string;
  factors?: SleepFactor[];
}

export type SleepFactor =
  | "caffeine"
  | "alcohol"
  | "exercise"
  | "stress"
  | "screen_time"
  | "late_meal"
  | "medication";

export interface SleepStats {
  averageDuration: number; // in minutes
  averageQuality: number;
  consistency: number; // percentage
  logs: SleepLog[];
}

// ==========================================
// Symptom Tracking
// ==========================================

export type SymptomSeverity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface Symptom {
  id: string;
  name: string;
  category: SymptomCategory;
}

export type SymptomCategory =
  | "digestive"
  | "energy"
  | "mood"
  | "pain"
  | "skin"
  | "respiratory"
  | "other";

export interface SymptomLog {
  id: string;
  symptomId: string;
  symptomName: string;
  severity: SymptomSeverity;
  dateTime: Date;
  notes?: string;
}

export interface SymptomCorrelation {
  symptomId: string;
  correlatedWith: string;
  correlation: number; // -1 to 1
  type: "food" | "sleep" | "supplement";
}

// ==========================================
// Supplement Tracking
// ==========================================

export interface Supplement {
  id: string;
  name: string;
  brand?: string;
  nutrients: {
    nutrientId: string;
    amount: number;
    unit: string;
  }[];
  dosageUnit: string;
  recommendedDosage?: number;
}

export interface SupplementLog {
  id: string;
  supplementId: string;
  supplementName: string;
  dosage: number;
  unit: string;
  dateTime: Date;
  notes?: string;
}

export interface SupplementRecommendation {
  nutrientId: string;
  nutrientName: string;
  currentIntake: number;
  recommendedIntake: number;
  gap: number;
  suggestedSupplements: Supplement[];
}

// ==========================================
// Health Conditions & Recommendations
// ==========================================

export type HealthCondition =
  | "pregnancy_first_trimester"
  | "pregnancy_second_trimester"
  | "pregnancy_third_trimester"
  | "breastfeeding"
  | "athletic_training"
  | "weight_loss"
  | "weight_gain"
  | "heart_health"
  | "diabetes_management"
  | "iron_deficiency"
  | "bone_health"
  | "vegetarian"
  | "vegan"
  | "none";

export interface ConditionRecommendation {
  condition: HealthCondition;
  nutrientId: string;
  minAmount: number;
  maxAmount?: number;
  unit: string;
  priority: "critical" | "important" | "suggested";
  notes?: string;
}

export interface NutrientGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  customNutrients?: Record<string, number>;
}

// ==========================================
// USDA API Types
// ==========================================

export interface USDAFoodSearchResponse {
  foods: USDAFoodItem[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

export interface USDAFoodItem {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  brandName?: string;
  ingredients?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients: USDAFoodNutrient[];
}

export interface USDAFoodNutrient {
  nutrientId: number;
  nutrientName: string;
  nutrientNumber: string;
  unitName: string;
  value: number;
}

// ==========================================
// UI State Types
// ==========================================

export interface DateRange {
  start: string;
  end: string;
}

export type ViewMode = "day" | "week" | "month";

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}
