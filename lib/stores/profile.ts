import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Profile, HealthCondition, NutrientGoals, UserPreferences } from "@/types";

// Default nutrient goals (based on general adult recommendations)
const DEFAULT_GOALS: NutrientGoals = {
  calories: 2000,
  protein: 50,
  carbs: 275,
  fat: 78,
  fiber: 28,
};

const DEFAULT_PREFERENCES: UserPreferences = {
  units: "metric",
  theme: "system",
  notifications: true,
};

interface ProfileState {
  profile: Profile | null;

  // Actions
  initProfile: () => void;
  updateConditions: (conditions: HealthCondition[]) => void;
  updateGoals: (goals: Partial<NutrientGoals>) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  getAdjustedGoals: () => NutrientGoals;
}

// Condition-based goal adjustments
const CONDITION_ADJUSTMENTS: Partial<Record<HealthCondition, Partial<NutrientGoals>>> = {
  // Pregnancy and breastfeeding
  pregnancy_first_trimester: { calories: 2200, protein: 75, fiber: 30 },
  pregnancy_second_trimester: { calories: 2400, protein: 75, fiber: 30 },
  pregnancy_third_trimester: { calories: 2500, protein: 75, fiber: 30 },
  breastfeeding: { calories: 2500, protein: 71, fiber: 30 },

  // Weight management
  athletic_training: { calories: 2800, protein: 120, carbs: 350 },
  weight_loss: { calories: 1500, protein: 100, carbs: 150 },
  weight_gain: { calories: 2500, protein: 100, carbs: 350 },

  // Health conditions
  heart_health: { fat: 55, fiber: 35 }, // Lower fat, higher fiber for cardiovascular health
  diabetes_management: { carbs: 150, protein: 90, fiber: 35 }, // Lower carbs, higher fiber/protein
  iron_deficiency: { protein: 75 }, // Higher protein to encourage iron-rich foods
  bone_health: { protein: 75 }, // Protein supports bone matrix

  // Dietary patterns
  vegetarian: { protein: 70 }, // Slightly higher to compensate for plant protein bioavailability
  vegan: { protein: 75, calories: 2100 }, // Higher protein target, slightly more calories
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: null,

      initProfile: () => {
        if (!get().profile) {
          const newProfile: Profile = {
            id: crypto.randomUUID(),
            createdAt: new Date(),
            conditions: ["none"],
            preferences: DEFAULT_PREFERENCES,
            goals: DEFAULT_GOALS,
          };
          set({ profile: newProfile });
        }
      },

      updateConditions: (conditions) => {
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, conditions }
            : null,
        }));
      },

      updateGoals: (goals) => {
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, goals: { ...state.profile.goals, ...goals } }
            : null,
        }));
      },

      updatePreferences: (preferences) => {
        set((state) => ({
          profile: state.profile
            ? {
                ...state.profile,
                preferences: { ...state.profile.preferences, ...preferences },
              }
            : null,
        }));
      },

      getAdjustedGoals: () => {
        const profile = get().profile;
        if (!profile) return DEFAULT_GOALS;

        let adjustedGoals = { ...profile.goals };

        // Apply condition adjustments
        for (const condition of profile.conditions) {
          const adjustment = CONDITION_ADJUSTMENTS[condition];
          if (adjustment) {
            adjustedGoals = { ...adjustedGoals, ...adjustment };
          }
        }

        return adjustedGoals;
      },
    }),
    {
      name: "tibera-profile",
    }
  )
);

export const CONDITION_LABELS: Record<HealthCondition, string> = {
  pregnancy_first_trimester: "Pregnancy (1st Trimester)",
  pregnancy_second_trimester: "Pregnancy (2nd Trimester)",
  pregnancy_third_trimester: "Pregnancy (3rd Trimester)",
  breastfeeding: "Breastfeeding",
  athletic_training: "Athletic Training",
  weight_loss: "Weight Loss",
  weight_gain: "Weight Gain",
  heart_health: "Heart Health",
  diabetes_management: "Diabetes Management",
  iron_deficiency: "Iron Deficiency",
  bone_health: "Bone Health",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  none: "None",
};
