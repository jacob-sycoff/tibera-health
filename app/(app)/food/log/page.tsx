"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Minus, Check, Loader2, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FoodSearch } from "@/components/food/food-search";
import { useCreateMealLog } from "@/lib/hooks/use-meals";
import { getFoodDetails } from "@/lib/api/usda";
import type { MealType, Food, FoodSearchResult, FoodNutrient } from "@/types";
import { cn } from "@/lib/utils/cn";
import { localDateISO } from "@/lib/utils/dates";

// Transform USDA nutrients array to a key-value object for Supabase storage
function transformNutrients(nutrients: FoodNutrient[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const n of nutrients) {
    result[n.nutrientId] = n.amount;
  }
  return result;
}

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export default function LogFoodPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("breakfast");
  const [selectedDate, setSelectedDate] = useState(
    localDateISO()
  );
  const [items, setItems] = useState<Array<{ food: Food; servings: number }>>([]);
  const [loading, setLoading] = useState(false);

  const createMealLog = useCreateMealLog();

  useEffect(() => {
    setMounted(true);
    // Set default meal type based on time of day
    const hour = new Date().getHours();
    if (hour < 10) setSelectedMealType("breakfast");
    else if (hour < 14) setSelectedMealType("lunch");
    else if (hour < 18) setSelectedMealType("snack");
    else setSelectedMealType("dinner");
  }, []);

  const handleFoodSelect = async (result: FoodSearchResult) => {
    setLoading(true);
    try {
      const food = await getFoodDetails(result.fdcId);
      if (food) {
        setItems((prev) => [...prev, { food, servings: 1 }]);
      }
    } catch (error) {
      console.error("Error fetching food details:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateServings = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const newServings = Math.max(0.25, item.servings + delta);
          return { ...item, servings: newServings };
        }
        return item;
      })
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (items.length === 0) return;

    createMealLog.mutate(
      {
        date: selectedDate,
        meal_type: selectedMealType,
        items: items.map((item) => ({
          custom_food_name: item.food.description,
          custom_food_nutrients: transformNutrients(item.food.nutrients),
          servings: item.servings,
        })),
      },
      {
        onSuccess: () => {
          router.push("/food");
        },
        onError: (error) => {
          console.error("Error saving meal:", error);
        },
      }
    );
  };

  const totalCalories = items.reduce((sum, item) => {
    const cal = item.food.nutrients.find((n) => n.nutrientId === "1008");
    return sum + (cal?.amount || 0) * item.servings;
  }, 0);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold">Log Food</h1>
        <div className="ml-auto">
          <Link href="/food/log/photo">
            <Button variant="outline">
              <Camera className="w-4 h-4 mr-2" />
              Log from Photo
            </Button>
          </Link>
        </div>
      </div>

      {/* Date & Meal Type Selection */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">
              Date
            </label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={localDateISO()}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">
              Meal Type
            </label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {MEAL_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedMealType(type.value)}
                  className={cn(
                    "py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                    selectedMealType === type.value
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-100/80"
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Food Search */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Search Foods</CardTitle>
        </CardHeader>
        <CardContent>
          <FoodSearch onSelect={handleFoodSelect} />
          {loading && (
            <p className="text-sm text-gray-500 mt-2">Loading food details...</p>
          )}
        </CardContent>
      </Card>

      {/* Selected Items */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Selected Foods</CardTitle>
              <span className="text-sm font-medium text-primary-600">
                {Math.round(totalCalories)} kcal
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {items.map((item, index) => {
                const cal = item.food.nutrients.find(
                  (n) => n.nutrientId === "1008"
                );
                const itemCalories = (cal?.amount || 0) * item.servings;

                return (
                  <li
                    key={index}
                    className="flex items-center gap-3 py-3 border-b border-gray-200 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.food.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {Math.round(itemCalories)} kcal
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateServings(index, -0.25)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">
                        {item.servings}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateServings(index, 0.25)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeItem(index)}
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <Button
        className="w-full h-12"
        disabled={items.length === 0 || createMealLog.isPending}
        onClick={handleSave}
      >
        {createMealLog.isPending ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Check className="w-5 h-5 mr-2" />
            Save Meal ({items.length} item{items.length !== 1 ? "s" : ""})
          </>
        )}
      </Button>
    </div>
  );
}
