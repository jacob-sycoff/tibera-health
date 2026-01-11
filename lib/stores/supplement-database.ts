import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DetailedSupplement,
  SupplementIngredient,
  NutrientForm,
  NutrientSource,
} from "@/types/supplements";

// Pre-populated supplement database with common multivitamins
const SYSTEM_SUPPLEMENTS: DetailedSupplement[] = [
  {
    id: "sys_garden_of_life_womens",
    name: "Vitamin Code Women",
    brand: "Garden of Life",
    type: "multivitamin",
    servingSize: "4 capsules",
    servingsPerContainer: 30,
    ingredients: [
      { nutrientId: "1106", nutrientName: "Vitamin A", amount: 2500, unit: "IU", dailyValuePercent: 50, form: "beta_carotene", source: "whole_food" },
      { nutrientId: "1162", nutrientName: "Vitamin C", amount: 60, unit: "mg", dailyValuePercent: 100, form: "ascorbic_acid", source: "whole_food" },
      { nutrientId: "1114", nutrientName: "Vitamin D3", amount: 800, unit: "IU", dailyValuePercent: 200, form: "d3_cholecalciferol", source: "plant" },
      { nutrientId: "1109", nutrientName: "Vitamin E", amount: 22, unit: "IU", dailyValuePercent: 73, form: "mixed_tocopherols", source: "whole_food" },
      { nutrientId: "1185", nutrientName: "Vitamin K", amount: 80, unit: "mcg", dailyValuePercent: 100, form: "k1_phylloquinone", source: "plant" },
      { nutrientId: "1165", nutrientName: "Thiamin (B1)", amount: 2, unit: "mg", dailyValuePercent: 133, form: "thiamine_hcl", source: "whole_food" },
      { nutrientId: "1166", nutrientName: "Riboflavin (B2)", amount: 2, unit: "mg", dailyValuePercent: 118, form: "riboflavin", source: "whole_food" },
      { nutrientId: "1167", nutrientName: "Niacin (B3)", amount: 20, unit: "mg", dailyValuePercent: 100, form: "niacinamide", source: "whole_food" },
      { nutrientId: "1175", nutrientName: "Vitamin B6", amount: 4, unit: "mg", dailyValuePercent: 200, form: "pyridoxine_hcl", source: "whole_food" },
      { nutrientId: "1177", nutrientName: "Folate", amount: 400, unit: "mcg", dailyValuePercent: 100, form: "methylfolate", source: "whole_food" },
      { nutrientId: "1178", nutrientName: "Vitamin B12", amount: 100, unit: "mcg", dailyValuePercent: 1667, form: "methylcobalamin", source: "bacterial" },
      { nutrientId: "1089", nutrientName: "Iron", amount: 8, unit: "mg", dailyValuePercent: 44, form: "ferrous_bisglycinate", source: "mineral" },
      { nutrientId: "1095", nutrientName: "Zinc", amount: 4, unit: "mg", dailyValuePercent: 27, form: "glycinate", source: "mineral" },
      { nutrientId: "1103", nutrientName: "Selenium", amount: 55, unit: "mcg", dailyValuePercent: 79, form: "other", source: "yeast" },
    ],
    otherIngredients: ["Organic Rice", "Organic Rice Extract", "Capsule (cellulose)"],
    certifications: ["USDA Organic", "Non-GMO Verified", "Gluten Free"],
    isVerified: true,
    createdBy: "system",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "sys_thorne_basic_nutrients",
    name: "Basic Nutrients 2/Day",
    brand: "Thorne",
    type: "multivitamin",
    servingSize: "2 capsules",
    servingsPerContainer: 30,
    ingredients: [
      { nutrientId: "1106", nutrientName: "Vitamin A", amount: 2250, unit: "mcg", dailyValuePercent: 250, form: "beta_carotene", source: "natural" },
      { nutrientId: "1162", nutrientName: "Vitamin C", amount: 180, unit: "mg", dailyValuePercent: 200, form: "ascorbic_acid", source: "synthetic" },
      { nutrientId: "1114", nutrientName: "Vitamin D3", amount: 50, unit: "mcg", dailyValuePercent: 250, form: "d3_cholecalciferol", source: "natural" },
      { nutrientId: "1109", nutrientName: "Vitamin E", amount: 67, unit: "mg", dailyValuePercent: 447, form: "mixed_tocopherols", source: "natural" },
      { nutrientId: "1185", nutrientName: "Vitamin K1", amount: 100, unit: "mcg", dailyValuePercent: 83, form: "k1_phylloquinone", source: "synthetic" },
      { nutrientId: "1165", nutrientName: "Thiamin (B1)", amount: 40, unit: "mg", dailyValuePercent: 3333, form: "thiamine_hcl", source: "synthetic" },
      { nutrientId: "1166", nutrientName: "Riboflavin (B2)", amount: 5, unit: "mg", dailyValuePercent: 385, form: "riboflavin_5_phosphate", source: "synthetic" },
      { nutrientId: "1167", nutrientName: "Niacin (B3)", amount: 60, unit: "mg", dailyValuePercent: 375, form: "niacinamide", source: "synthetic" },
      { nutrientId: "1175", nutrientName: "Vitamin B6", amount: 10, unit: "mg", dailyValuePercent: 588, form: "pyridoxal_5_phosphate", source: "synthetic" },
      { nutrientId: "1177", nutrientName: "Folate", amount: 680, unit: "mcg DFE", dailyValuePercent: 170, form: "methylfolate", source: "synthetic" },
      { nutrientId: "1178", nutrientName: "Vitamin B12", amount: 500, unit: "mcg", dailyValuePercent: 20833, form: "methylcobalamin", source: "synthetic" },
      { nutrientId: "1087", nutrientName: "Calcium", amount: 100, unit: "mg", dailyValuePercent: 8, form: "citrate", source: "mineral" },
      { nutrientId: "1090", nutrientName: "Magnesium", amount: 100, unit: "mg", dailyValuePercent: 24, form: "citrate", source: "mineral" },
      { nutrientId: "1095", nutrientName: "Zinc", amount: 15, unit: "mg", dailyValuePercent: 136, form: "picolinate", source: "mineral" },
      { nutrientId: "1103", nutrientName: "Selenium", amount: 100, unit: "mcg", dailyValuePercent: 182, form: "other", source: "yeast" },
      { nutrientId: "1098", nutrientName: "Copper", amount: 1, unit: "mg", dailyValuePercent: 111, form: "citrate", source: "mineral" },
    ],
    certifications: ["NSF Certified for Sport", "Gluten Free"],
    isVerified: true,
    createdBy: "system",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "sys_naturelo_prenatal",
    name: "Prenatal Whole Food Multivitamin",
    brand: "NATURELO",
    type: "multivitamin",
    servingSize: "3 capsules",
    servingsPerContainer: 60,
    ingredients: [
      { nutrientId: "1106", nutrientName: "Vitamin A", amount: 900, unit: "mcg", dailyValuePercent: 100, form: "beta_carotene", source: "plant" },
      { nutrientId: "1162", nutrientName: "Vitamin C", amount: 100, unit: "mg", dailyValuePercent: 111, form: "ascorbic_acid", source: "plant" },
      { nutrientId: "1114", nutrientName: "Vitamin D3", amount: 25, unit: "mcg", dailyValuePercent: 125, form: "d3_cholecalciferol", source: "plant" },
      { nutrientId: "1109", nutrientName: "Vitamin E", amount: 15, unit: "mg", dailyValuePercent: 100, form: "d_alpha_tocopherol", source: "plant" },
      { nutrientId: "1185", nutrientName: "Vitamin K2", amount: 90, unit: "mcg", dailyValuePercent: 75, form: "k2_mk7", source: "fermented" },
      { nutrientId: "1177", nutrientName: "Folate", amount: 800, unit: "mcg DFE", dailyValuePercent: 133, form: "methylfolate", source: "synthetic" },
      { nutrientId: "1178", nutrientName: "Vitamin B12", amount: 25, unit: "mcg", dailyValuePercent: 893, form: "methylcobalamin", source: "bacterial" },
      { nutrientId: "1089", nutrientName: "Iron", amount: 27, unit: "mg", dailyValuePercent: 150, form: "ferrous_bisglycinate", source: "mineral" },
      { nutrientId: "1087", nutrientName: "Calcium", amount: 200, unit: "mg", dailyValuePercent: 15, form: "citrate", source: "algae" },
      { nutrientId: "1090", nutrientName: "Magnesium", amount: 100, unit: "mg", dailyValuePercent: 24, form: "glycinate", source: "mineral" },
      { nutrientId: "1095", nutrientName: "Zinc", amount: 15, unit: "mg", dailyValuePercent: 136, form: "glycinate", source: "mineral" },
      { nutrientId: "other_choline", nutrientName: "Choline", amount: 100, unit: "mg", dailyValuePercent: 18, form: "other", source: "plant" },
      { nutrientId: "other_dha", nutrientName: "DHA (Omega-3)", amount: 200, unit: "mg", form: "other", source: "algae" },
    ],
    allergens: [],
    certifications: ["Vegan", "Non-GMO", "Gluten Free", "Soy Free"],
    isVerified: true,
    createdBy: "system",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "sys_ritual_essential",
    name: "Essential for Women 18+",
    brand: "Ritual",
    type: "multivitamin",
    servingSize: "2 capsules",
    servingsPerContainer: 30,
    ingredients: [
      { nutrientId: "1114", nutrientName: "Vitamin D3", amount: 50, unit: "mcg", dailyValuePercent: 250, form: "d3_cholecalciferol", source: "plant", notes: "Lichen-sourced" },
      { nutrientId: "1109", nutrientName: "Vitamin E", amount: 6.7, unit: "mg", dailyValuePercent: 45, form: "d_alpha_tocopherol", source: "plant" },
      { nutrientId: "1185", nutrientName: "Vitamin K2", amount: 90, unit: "mcg", dailyValuePercent: 75, form: "k2_mk7", source: "fermented" },
      { nutrientId: "1177", nutrientName: "Folate", amount: 680, unit: "mcg DFE", dailyValuePercent: 170, form: "methylfolate", source: "synthetic" },
      { nutrientId: "1178", nutrientName: "Vitamin B12", amount: 8, unit: "mcg", dailyValuePercent: 333, form: "methylcobalamin", source: "synthetic" },
      { nutrientId: "1089", nutrientName: "Iron", amount: 8, unit: "mg", dailyValuePercent: 44, form: "ferrous_bisglycinate", source: "mineral" },
      { nutrientId: "1090", nutrientName: "Magnesium", amount: 30, unit: "mg", dailyValuePercent: 7, form: "citrate", source: "mineral" },
      { nutrientId: "other_omega3", nutrientName: "Omega-3 DHA", amount: 330, unit: "mg", form: "other", source: "algae" },
      { nutrientId: "other_boron", nutrientName: "Boron", amount: 0.7, unit: "mg", form: "other", source: "mineral" },
    ],
    certifications: ["Vegan", "Non-GMO", "Gluten Free", "Third-Party Tested"],
    isVerified: true,
    createdBy: "system",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "sys_nordic_naturals_omega",
    name: "Ultimate Omega",
    brand: "Nordic Naturals",
    type: "omega",
    servingSize: "2 soft gels",
    servingsPerContainer: 60,
    ingredients: [
      { nutrientId: "other_epa", nutrientName: "EPA", amount: 650, unit: "mg", form: "other", source: "fish" },
      { nutrientId: "other_dha", nutrientName: "DHA", amount: 450, unit: "mg", form: "other", source: "fish" },
      { nutrientId: "other_omega3", nutrientName: "Other Omega-3s", amount: 180, unit: "mg", form: "other", source: "fish" },
    ],
    otherIngredients: ["Purified fish oil", "Soft gel capsule (gelatin, glycerin, water)", "Natural lemon flavor", "d-alpha tocopherol", "Rosemary extract"],
    certifications: ["Non-GMO Verified", "Friend of the Sea Certified"],
    isVerified: true,
    createdBy: "system",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "sys_megafood_magnesium",
    name: "Magnesium",
    brand: "MegaFood",
    type: "mineral",
    servingSize: "2 tablets",
    servingsPerContainer: 45,
    ingredients: [
      { nutrientId: "1090", nutrientName: "Magnesium", amount: 300, unit: "mg", dailyValuePercent: 71, form: "glycinate", source: "mineral", notes: "FoodState Magnesium" },
    ],
    otherIngredients: ["Organic brown rice", "Vegetable cellulose", "Vegetable lubricant", "Silica"],
    certifications: ["Non-GMO Project Verified", "Certified B Corporation", "Gluten Free", "Vegetarian"],
    isVerified: true,
    createdBy: "system",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
];

interface SupplementDatabaseState {
  supplements: DetailedSupplement[];
  userSupplements: DetailedSupplement[];

  // Actions
  addUserSupplement: (supplement: Omit<DetailedSupplement, "id" | "createdAt" | "updatedAt" | "createdBy">) => string;
  updateSupplement: (id: string, updates: Partial<DetailedSupplement>) => void;
  deleteSupplement: (id: string) => void;
  getAllSupplements: () => DetailedSupplement[];
  getSupplementById: (id: string) => DetailedSupplement | undefined;
  searchSupplements: (query: string) => DetailedSupplement[];
  getSupplementsByType: (type: DetailedSupplement["type"]) => DetailedSupplement[];
}

export const useSupplementDatabase = create<SupplementDatabaseState>()(
  persist(
    (set, get) => ({
      supplements: SYSTEM_SUPPLEMENTS,
      userSupplements: [],

      addUserSupplement: (supplement) => {
        const id = `user_${crypto.randomUUID()}`;
        const newSupplement: DetailedSupplement = {
          ...supplement,
          id,
          createdBy: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({
          userSupplements: [...state.userSupplements, newSupplement],
        }));
        return id;
      },

      updateSupplement: (id, updates) => {
        set((state) => ({
          userSupplements: state.userSupplements.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s
          ),
        }));
      },

      deleteSupplement: (id) => {
        set((state) => ({
          userSupplements: state.userSupplements.filter((s) => s.id !== id),
        }));
      },

      getAllSupplements: () => {
        const state = get();
        return [...state.supplements, ...state.userSupplements];
      },

      getSupplementById: (id) => {
        const state = get();
        return [...state.supplements, ...state.userSupplements].find((s) => s.id === id);
      },

      searchSupplements: (query) => {
        const state = get();
        const all = [...state.supplements, ...state.userSupplements];
        const lowerQuery = query.toLowerCase();
        return all.filter(
          (s) =>
            s.name.toLowerCase().includes(lowerQuery) ||
            s.brand?.toLowerCase().includes(lowerQuery) ||
            s.ingredients.some((i) => i.nutrientName.toLowerCase().includes(lowerQuery))
        );
      },

      getSupplementsByType: (type) => {
        const state = get();
        return [...state.supplements, ...state.userSupplements].filter((s) => s.type === type);
      },
    }),
    {
      name: "tibera-supplement-database",
    }
  )
);

// Helper to calculate total daily value from a supplement
export function calculateTotalDailyValues(
  supplement: DetailedSupplement
): Record<string, { amount: number; percent: number }> {
  const totals: Record<string, { amount: number; percent: number }> = {};

  for (const ingredient of supplement.ingredients) {
    totals[ingredient.nutrientName] = {
      amount: ingredient.amount,
      percent: ingredient.dailyValuePercent || 0,
    };
  }

  return totals;
}
