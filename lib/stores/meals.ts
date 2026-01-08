import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MealLog, MealItem, MealType, Food } from "@/types";

interface MealsState {
  meals: MealLog[];

  // Actions
  addMeal: (meal: Omit<MealLog, "id" | "createdAt">) => void;
  updateMeal: (id: string, updates: Partial<MealLog>) => void;
  deleteMeal: (id: string) => void;
  addItemToMeal: (mealId: string, item: Omit<MealItem, "id">) => void;
  removeItemFromMeal: (mealId: string, itemId: string) => void;
  updateItemServings: (mealId: string, itemId: string, servings: number) => void;
  getMealsByDate: (date: string) => MealLog[];
  getMealsByDateRange: (startDate: string, endDate: string) => MealLog[];
}

export const useMealsStore = create<MealsState>()(
  persist(
    (set, get) => ({
      meals: [],

      addMeal: (meal) => {
        const newMeal: MealLog = {
          ...meal,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        };
        set((state) => ({ meals: [...state.meals, newMeal] }));
      },

      updateMeal: (id, updates) => {
        set((state) => ({
          meals: state.meals.map((meal) =>
            meal.id === id ? { ...meal, ...updates } : meal
          ),
        }));
      },

      deleteMeal: (id) => {
        set((state) => ({
          meals: state.meals.filter((meal) => meal.id !== id),
        }));
      },

      addItemToMeal: (mealId, item) => {
        const newItem: MealItem = {
          ...item,
          id: crypto.randomUUID(),
        };
        set((state) => ({
          meals: state.meals.map((meal) =>
            meal.id === mealId
              ? { ...meal, items: [...meal.items, newItem] }
              : meal
          ),
        }));
      },

      removeItemFromMeal: (mealId, itemId) => {
        set((state) => ({
          meals: state.meals.map((meal) =>
            meal.id === mealId
              ? { ...meal, items: meal.items.filter((item) => item.id !== itemId) }
              : meal
          ),
        }));
      },

      updateItemServings: (mealId, itemId, servings) => {
        set((state) => ({
          meals: state.meals.map((meal) =>
            meal.id === mealId
              ? {
                  ...meal,
                  items: meal.items.map((item) =>
                    item.id === itemId ? { ...item, servings } : item
                  ),
                }
              : meal
          ),
        }));
      },

      getMealsByDate: (date) => {
        return get().meals.filter((meal) => meal.date === date);
      },

      getMealsByDateRange: (startDate, endDate) => {
        return get().meals.filter(
          (meal) => meal.date >= startDate && meal.date <= endDate
        );
      },
    }),
    {
      name: "tibera-meals",
    }
  )
);

// Helper function to calculate total nutrients for a day
export function calculateDailyNutrients(
  meals: MealLog[]
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const meal of meals) {
    for (const item of meal.items) {
      for (const nutrient of item.food.nutrients) {
        const scaled = nutrient.amount * item.servings;
        totals[nutrient.nutrientId] = (totals[nutrient.nutrientId] || 0) + scaled;
      }
    }
  }

  return totals;
}
