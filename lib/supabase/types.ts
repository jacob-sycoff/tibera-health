// Supabase Database Types
// Generated types for Tibera Health database schema
// In production, regenerate with: npx supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Enum Types
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

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type SleepQuality = "1" | "2" | "3" | "4" | "5";

export type SleepFactor =
  | "caffeine"
  | "alcohol"
  | "exercise"
  | "stress"
  | "screen_time"
  | "late_meal"
  | "medication";

export type SymptomCategory =
  | "digestive"
  | "energy"
  | "mood"
  | "pain"
  | "skin"
  | "respiratory"
  | "other";

export type NutrientCategory =
  | "macro"
  | "vitamin"
  | "mineral"
  | "other"
  | "harmful";

export type SupplementType =
  | "multivitamin"
  | "single"
  | "mineral"
  | "herbal"
  | "amino"
  | "probiotic"
  | "omega"
  | "other";

export type NutrientForm =
  | "d3_cholecalciferol"
  | "d2_ergocalciferol"
  | "methylcobalamin"
  | "cyanocobalamin"
  | "methylfolate"
  | "folic_acid"
  | "ascorbic_acid"
  | "sodium_ascorbate"
  | "citrate"
  | "oxide"
  | "glycinate"
  | "chelated"
  | "picolinate"
  | "sulfate"
  | "gluconate"
  | "carbonate"
  | "bisglycinate"
  | "threonate"
  | "malate"
  | "taurate"
  | "orotate"
  | "ferrous_sulfate"
  | "ferrous_gluconate"
  | "ferrous_bisglycinate"
  | "heme_iron"
  | "retinyl_palmitate"
  | "beta_carotene"
  | "mixed_tocopherols"
  | "d_alpha_tocopherol"
  | "dl_alpha_tocopherol"
  | "k1_phylloquinone"
  | "k2_mk4"
  | "k2_mk7"
  | "thiamine_hcl"
  | "benfotiamine"
  | "riboflavin"
  | "riboflavin_5_phosphate"
  | "niacinamide"
  | "nicotinic_acid"
  | "pyridoxine_hcl"
  | "pyridoxal_5_phosphate"
  | "other"
  | "unknown";

export type NutrientSource =
  | "synthetic"
  | "natural"
  | "fermented"
  | "whole_food"
  | "algae"
  | "fish"
  | "plant"
  | "animal"
  | "mineral"
  | "yeast"
  | "bacterial"
  | "unknown";

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

export type CreatorType = "system" | "user" | "ai";

// Database Interface
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          updated_at?: string;
        };
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          units: "metric" | "imperial";
          theme: "light" | "dark" | "system";
          notifications_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          units?: "metric" | "imperial";
          theme?: "light" | "dark" | "system";
          notifications_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          units?: "metric" | "imperial";
          theme?: "light" | "dark" | "system";
          notifications_enabled?: boolean;
          updated_at?: string;
        };
      };
      user_goals: {
        Row: {
          id: string;
          user_id: string;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          fiber: number;
          custom_nutrients: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          calories?: number;
          protein?: number;
          carbs?: number;
          fat?: number;
          fiber?: number;
          custom_nutrients?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          calories?: number;
          protein?: number;
          carbs?: number;
          fat?: number;
          fiber?: number;
          custom_nutrients?: Json;
          updated_at?: string;
        };
      };
      health_conditions: {
        Row: {
          id: string;
          code: HealthCondition;
          name: string;
          description: string | null;
          goal_adjustments: Json;
        };
        Insert: {
          id?: string;
          code: HealthCondition;
          name: string;
          description?: string | null;
          goal_adjustments?: Json;
        };
        Update: {
          code?: HealthCondition;
          name?: string;
          description?: string | null;
          goal_adjustments?: Json;
        };
      };
      user_health_conditions: {
        Row: {
          id: string;
          user_id: string;
          condition_code: HealthCondition;
          started_at: string;
          ended_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          condition_code: HealthCondition;
          started_at?: string;
          ended_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          condition_code?: HealthCondition;
          started_at?: string;
          ended_at?: string | null;
          notes?: string | null;
        };
      };
      nutrients: {
        Row: {
          id: string;
          usda_id: number | null;
          name: string;
          unit: string;
          category: NutrientCategory;
          daily_value: number | null;
          description: string | null;
          is_harmful: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          usda_id?: number | null;
          name: string;
          unit: string;
          category: NutrientCategory;
          daily_value?: number | null;
          description?: string | null;
          is_harmful?: boolean;
          created_at?: string;
        };
        Update: {
          usda_id?: number | null;
          name?: string;
          unit?: string;
          category?: NutrientCategory;
          daily_value?: number | null;
          description?: string | null;
          is_harmful?: boolean;
        };
      };
      foods: {
        Row: {
          id: string;
          fdc_id: number | null;
          name: string;
          brand: string | null;
          serving_size: number | null;
          serving_unit: string | null;
          category: string | null;
          ingredients: string | null;
          is_custom: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fdc_id?: number | null;
          name: string;
          brand?: string | null;
          serving_size?: number | null;
          serving_unit?: string | null;
          category?: string | null;
          ingredients?: string | null;
          is_custom?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          fdc_id?: number | null;
          name?: string;
          brand?: string | null;
          serving_size?: number | null;
          serving_unit?: string | null;
          category?: string | null;
          ingredients?: string | null;
          is_custom?: boolean;
          updated_at?: string;
        };
      };
      food_nutrients: {
        Row: {
          id: string;
          food_id: string;
          nutrient_id: string;
          amount_per_serving: number | null;
          amount_per_100g: number | null;
        };
        Insert: {
          id?: string;
          food_id: string;
          nutrient_id: string;
          amount_per_serving?: number | null;
          amount_per_100g?: number | null;
        };
        Update: {
          food_id?: string;
          nutrient_id?: string;
          amount_per_serving?: number | null;
          amount_per_100g?: number | null;
        };
      };
      meal_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          meal_type: MealType;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          meal_type: MealType;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          date?: string;
          meal_type?: MealType;
          notes?: string | null;
          updated_at?: string;
        };
      };
      meal_items: {
        Row: {
          id: string;
          meal_log_id: string;
          food_id: string | null;
          custom_food_name: string | null;
          custom_food_nutrients: Json | null;
          servings: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          meal_log_id: string;
          food_id?: string | null;
          custom_food_name?: string | null;
          custom_food_nutrients?: Json | null;
          servings?: number;
          created_at?: string;
        };
        Update: {
          food_id?: string | null;
          custom_food_name?: string | null;
          custom_food_nutrients?: Json | null;
          servings?: number;
        };
      };
      sleep_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          bedtime: string;
          wake_time: string;
          duration_minutes: number | null;
          quality: SleepQuality;
          factors: SleepFactor[];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          bedtime: string;
          wake_time: string;
          duration_minutes?: number | null;
          quality: SleepQuality;
          factors?: SleepFactor[];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          date?: string;
          bedtime?: string;
          wake_time?: string;
          duration_minutes?: number | null;
          quality?: SleepQuality;
          factors?: SleepFactor[];
          notes?: string | null;
          updated_at?: string;
        };
      };
      symptoms: {
        Row: {
          id: string;
          name: string;
          category: SymptomCategory;
          is_system: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: SymptomCategory;
          is_system?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          category?: SymptomCategory;
          is_system?: boolean;
        };
      };
      symptom_logs: {
        Row: {
          id: string;
          user_id: string;
          symptom_id: string;
          severity: number;
          logged_at: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symptom_id: string;
          severity: number;
          logged_at?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          symptom_id?: string;
          severity?: number;
          logged_at?: string;
          notes?: string | null;
          updated_at?: string;
        };
      };
      symptom_correlations: {
        Row: {
          id: string;
          user_id: string;
          symptom_id: string;
          correlated_type: "food" | "sleep" | "supplement";
          correlated_id: string | null;
          correlated_name: string | null;
          correlation_score: number | null;
          sample_size: number | null;
          computed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symptom_id: string;
          correlated_type: "food" | "sleep" | "supplement";
          correlated_id?: string | null;
          correlated_name?: string | null;
          correlation_score?: number | null;
          sample_size?: number | null;
          computed_at?: string;
        };
        Update: {
          symptom_id?: string;
          correlated_type?: "food" | "sleep" | "supplement";
          correlated_id?: string | null;
          correlated_name?: string | null;
          correlation_score?: number | null;
          sample_size?: number | null;
          computed_at?: string;
        };
      };
      supplements: {
        Row: {
          id: string;
          name: string;
          brand: string | null;
          type: SupplementType;
          serving_size: string | null;
          servings_per_container: number | null;
          other_ingredients: string[] | null;
          allergens: string[] | null;
          certifications: string[] | null;
          image_url: string | null;
          product_url: string | null;
          barcode: string | null;
          is_verified: boolean;
          created_by: CreatorType;
          created_by_user: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          brand?: string | null;
          type?: SupplementType;
          serving_size?: string | null;
          servings_per_container?: number | null;
          other_ingredients?: string[] | null;
          allergens?: string[] | null;
          certifications?: string[] | null;
          image_url?: string | null;
          product_url?: string | null;
          barcode?: string | null;
          is_verified?: boolean;
          created_by?: CreatorType;
          created_by_user?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          brand?: string | null;
          type?: SupplementType;
          serving_size?: string | null;
          servings_per_container?: number | null;
          other_ingredients?: string[] | null;
          allergens?: string[] | null;
          certifications?: string[] | null;
          image_url?: string | null;
          product_url?: string | null;
          barcode?: string | null;
          is_verified?: boolean;
          updated_at?: string;
        };
      };
      supplement_ingredients: {
        Row: {
          id: string;
          supplement_id: string;
          nutrient_id: string | null;
          nutrient_name: string;
          amount: number;
          unit: string;
          daily_value_percent: number | null;
          form: NutrientForm;
          source: NutrientSource;
          notes: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          supplement_id: string;
          nutrient_id?: string | null;
          nutrient_name: string;
          amount: number;
          unit: string;
          daily_value_percent?: number | null;
          form?: NutrientForm;
          source?: NutrientSource;
          notes?: string | null;
          sort_order?: number;
        };
        Update: {
          nutrient_id?: string | null;
          nutrient_name?: string;
          amount?: number;
          unit?: string;
          daily_value_percent?: number | null;
          form?: NutrientForm;
          source?: NutrientSource;
          notes?: string | null;
          sort_order?: number;
        };
      };
      supplement_logs: {
        Row: {
          id: string;
          user_id: string;
          supplement_id: string | null;
          supplement_name: string;
          dosage: number;
          unit: string;
          logged_at: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          supplement_id?: string | null;
          supplement_name: string;
          dosage: number;
          unit: string;
          logged_at?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          supplement_id?: string | null;
          supplement_name?: string;
          dosage?: number;
          unit?: string;
          logged_at?: string;
          notes?: string | null;
        };
      };
      meal_plans: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          week_start: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          week_start: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string | null;
          week_start?: string;
          updated_at?: string;
        };
      };
      planned_meals: {
        Row: {
          id: string;
          meal_plan_id: string;
          date: string;
          meal_type: MealType;
          food_id: string | null;
          custom_food_name: string | null;
          servings: number;
          notes: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          meal_plan_id: string;
          date: string;
          meal_type: MealType;
          food_id?: string | null;
          custom_food_name?: string | null;
          servings?: number;
          notes?: string | null;
          sort_order?: number;
        };
        Update: {
          date?: string;
          meal_type?: MealType;
          food_id?: string | null;
          custom_food_name?: string | null;
          servings?: number;
          notes?: string | null;
          sort_order?: number;
        };
      };
      shopping_lists: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      shopping_items: {
        Row: {
          id: string;
          list_id: string;
          name: string;
          quantity: number | null;
          unit: string | null;
          category: ShoppingCategory;
          is_checked: boolean;
          from_meal_plan: boolean;
          meal_plan_id: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          name: string;
          quantity?: number | null;
          unit?: string | null;
          category?: ShoppingCategory;
          is_checked?: boolean;
          from_meal_plan?: boolean;
          meal_plan_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          quantity?: number | null;
          unit?: string | null;
          category?: ShoppingCategory;
          is_checked?: boolean;
          from_meal_plan?: boolean;
          meal_plan_id?: string | null;
          sort_order?: number;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      health_condition: HealthCondition;
      meal_type: MealType;
      sleep_quality: SleepQuality;
      sleep_factor: SleepFactor;
      symptom_category: SymptomCategory;
      nutrient_category: NutrientCategory;
      supplement_type: SupplementType;
      nutrient_form: NutrientForm;
      nutrient_source: NutrientSource;
      shopping_category: ShoppingCategory;
      creator_type: CreatorType;
    };
  };
}

// Helper types for easier access
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Insertable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updatable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
