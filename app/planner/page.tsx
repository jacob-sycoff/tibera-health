"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Clock,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Trash2,
  ShoppingCart,
  Copy,
  Loader2,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useMealLogsByDate } from "@/lib/hooks/use-meals";
import {
  usePlannedMealsByDateRange,
  useGetOrCreateMealPlan,
  useAddPlannedMeal,
  useDeletePlannedMeal,
  useConvertPlannedToLogged,
  useCopyDayMeals,
  type MealType,
  type PlannedMeal,
} from "@/lib/hooks/use-meal-plans";
import { useGenerateShoppingListFromPlan } from "@/lib/hooks/use-shopping";
import { getWeekStart, getWeekDates } from "@/lib/supabase/queries/meal-plans";
import { AddPlannedMealModal } from "@/components/planner/add-planned-meal-modal";
import { MealTemplatesDrawer } from "@/components/planner/meal-templates-drawer";
import { cn } from "@/lib/utils/cn";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const MEAL_CONFIG: Record<
  MealType,
  { icon: typeof Coffee; label: string; shortLabel: string; color: string }
> = {
  breakfast: {
    icon: Coffee,
    label: "Breakfast",
    shortLabel: "Bfast",
    color: "text-amber-600 bg-amber-50",
  },
  lunch: {
    icon: Sun,
    label: "Lunch",
    shortLabel: "Lunch",
    color: "text-orange-600 bg-orange-50",
  },
  dinner: {
    icon: Moon,
    label: "Dinner",
    shortLabel: "Dinner",
    color: "text-indigo-600 bg-indigo-50",
  },
  snack: {
    icon: Cookie,
    label: "Snack",
    shortLabel: "Snack",
    color: "text-pink-600 bg-pink-50",
  },
};

function getWeekDatesFromStart(startDate: Date): Date[] {
  const dates: Date[] = [];
  const start = new Date(startDate);

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function MealPlannerPage() {
  const router = useRouter();
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return new Date(getWeekStart(today));
  });

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    mealType: MealType;
  } | null>(null);

  // Copy day state
  const [copySourceDate, setCopySourceDate] = useState<string | null>(null);

  // Templates drawer state
  const [showTemplatesDrawer, setShowTemplatesDrawer] = useState(false);

  // Mutations
  const getOrCreatePlan = useGetOrCreateMealPlan();
  const addPlannedMeal = useAddPlannedMeal();
  const deletePlannedMeal = useDeletePlannedMeal();
  const convertToLogged = useConvertPlannedToLogged();
  const copyDayMeals = useCopyDayMeals();
  const generateShoppingList = useGenerateShoppingListFromPlan();

  useEffect(() => {
    setMounted(true);
  }, []);

  const weekDates = getWeekDatesFromStart(currentWeekStart);
  const weekStartStr = formatLocalDate(currentWeekStart);
  const weekEndStr = formatLocalDate(weekDates[6]);
  const today = formatLocalDate(new Date());

  // Fetch planned meals for the week
  const { data: plannedMeals = [], isLoading: plannedLoading } =
    usePlannedMealsByDateRange(weekStartStr, weekEndStr);

  // Fetch logged meals for each day of the week
  const dayMealQueries = weekDates.map((date) => {
    const dateStr = formatLocalDate(date);
    return useMealLogsByDate(dateStr);
  });

  const navigateWeek = (direction: number) => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + direction * 7);
    setCurrentWeekStart(newStart);
  };

  const goToThisWeek = () => {
    setCurrentWeekStart(new Date(getWeekStart(new Date())));
  };

  const formatWeekRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    return `${start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;
  };

  const handleSlotClick = (date: string, mealType: MealType) => {
    setSelectedSlot({ date, mealType });
    setShowAddModal(true);
  };

  const handleAddPlannedMeal = async (meal: {
    date: string;
    meal_type: MealType;
    custom_food_name: string;
    servings: number;
    calories: number;
    notes?: string;
  }) => {
    try {
      // Get or create the meal plan for the meal's week
      const planWeekStart = getWeekStart(new Date(meal.date + "T00:00:00"));
      const plan = await getOrCreatePlan.mutateAsync(planWeekStart);

      // Add the planned meal
      await addPlannedMeal.mutateAsync({
        mealPlanId: plan.id,
        meal: {
          date: meal.date,
          meal_type: meal.meal_type,
          custom_food_name: meal.custom_food_name,
          servings: meal.servings,
          notes: meal.notes,
        },
      });

      setShowAddModal(false);
      setSelectedSlot(null);
    } catch (error) {
      const err = error as { message?: string; code?: string; details?: string; hint?: string };
      console.error("Error adding planned meal:", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        raw: error,
      });
      toast.error(err?.message || "Failed to add planned meal");
    }
  };

  const handleDeletePlannedMeal = async (id: string) => {
    try {
      await deletePlannedMeal.mutateAsync(id);
    } catch (error) {
      console.error("Error deleting planned meal:", error);
    }
  };

  const handleConvertToLogged = async (id: string) => {
    try {
      await convertToLogged.mutateAsync(id);
    } catch (error) {
      console.error("Error converting meal:", error);
    }
  };

  const handleCopyDay = async (targetDate: string) => {
    if (!copySourceDate) return;

    try {
      await copyDayMeals.mutateAsync({
        sourceDate: copySourceDate,
        targetDate,
      });
      setCopySourceDate(null);
    } catch (error) {
      console.error("Error copying day:", error);
    }
  };

  const handleGenerateShoppingList = async () => {
    try {
      await generateShoppingList.mutateAsync({
        startDate: weekStartStr,
        endDate: weekEndStr,
        listName: `Shopping List (${formatWeekRange()})`,
      });
      router.push("/shopping");
    } catch (error) {
      console.error("Error generating shopping list:", error);
    }
  };

  const getPlannedMealsForDate = (dateStr: string) => {
    return plannedMeals.filter((m) => m.date === dateStr);
  };

  const getPlannedMealForSlot = (dateStr: string, mealType: MealType) => {
    return plannedMeals.find(
      (m) => m.date === dateStr && m.meal_type === mealType
    );
  };

  const isCurrentWeek =
    weekStartStr === getWeekStart(new Date());

  if (!mounted) return <PlannerSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Meal Planner"
        description="Plan your meals for the week"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplatesDrawer(true)}
            >
              <Star className="w-4 h-4 mr-2" />
              Templates
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateShoppingList}
              disabled={generateShoppingList.isPending || plannedMeals.length === 0}
            >
              {generateShoppingList.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4 mr-2" />
              )}
              Generate List
            </Button>
          </div>
        }
      />

      {/* Week Navigation */}
      <Card className="!p-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-900 dark:text-slate-100">{formatWeekRange()}</span>
            {!isCurrentWeek && (
              <Button variant="outline" size="sm" onClick={goToThisWeek}>
                Today
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigateWeek(1)}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-900 dark:bg-slate-100" />
          <span className="text-slate-500 dark:text-slate-400">Logged</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-400" />
          <span className="text-slate-500 dark:text-slate-400">Planned</span>
        </div>
      </div>

      {/* Week Grid */}
      <div className="space-y-3">
        {weekDates.map((date, dayIndex) => {
          const dateStr = formatLocalDate(date);
          const dayPlannedMeals = getPlannedMealsForDate(dateStr);
          const dayLoggedMeals = dayMealQueries[dayIndex].data || [];
          const isToday = dateStr === today;
          const isPast = dateStr < today;
          const isFuture = dateStr > today;

          // Calculate total calories
          let totalCalories = 0;

          // Add logged meal calories (simplified - just count meals for now)
          // The actual calorie data would need proper nutrient extraction
          dayLoggedMeals.forEach((meal) => {
            if (meal.meal_items) {
              meal.meal_items.forEach((item) => {
                // Access food_nutrients from the joined data
                const food = item.food as Record<string, unknown> | null;
                const foodNutrients = food?.food_nutrients as Array<{
                  nutrient?: { name?: string };
                  amount_per_serving?: number;
                }> | undefined;

                if (foodNutrients) {
                  const energyNutrient = foodNutrients.find(
                    (fn) => fn.nutrient?.name?.toLowerCase().includes("energy")
                  );
                  totalCalories += (energyNutrient?.amount_per_serving || 0) * item.servings;
                }
              });
            }
          });

          // Add planned meal calories (estimate from custom food)
          dayPlannedMeals.forEach((meal) => {
            if (meal.food) {
              totalCalories += (meal.food.calories_per_serving || 0) * meal.servings;
            }
          });

          return (
            <Card
              key={dateStr}
              className={cn(
                "transition-all relative",
                isToday && "ring-2 ring-primary",
                isPast && "opacity-75",
                copySourceDate === dateStr && "ring-2 ring-blue-400"
              )}
            >
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isToday && "text-primary"
                      )}
                    >
                      {date.toLocaleDateString("en-US", {
                        weekday: "short",
                      })}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {isToday && (
                      <Badge variant="default" className="ml-2">
                        Today
                      </Badge>
                    )}
                    {isFuture && dayPlannedMeals.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        <Clock className="w-3 h-3 mr-1" />
                        Planned
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {totalCalories > 0 && (
                      <span className="text-sm font-medium">
                        {Math.round(totalCalories)} kcal
                      </span>
                    )}
                    {/* Copy day buttons */}
                    {copySourceDate === null && dayPlannedMeals.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setCopySourceDate(dateStr)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    )}
                    {copySourceDate !== null && copySourceDate !== dateStr && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleCopyDay(dateStr)}
                        disabled={copyDayMeals.isPending}
                      >
                        {copyDayMeals.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Paste here"
                        )}
                      </Button>
                    )}
                    {copySourceDate === dateStr && (
                      <Badge variant="secondary" className="text-xs">
                        Copying...
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Cancel copy mode */}
                {copySourceDate !== null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2 h-6 text-xs"
                    onClick={() => setCopySourceDate(null)}
                  >
                    Cancel
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-4 gap-2">
                  {MEAL_TYPES.map((mealType) => {
                    const config = MEAL_CONFIG[mealType];
                    const Icon = config.icon;
                    const plannedMeal = getPlannedMealForSlot(dateStr, mealType);
                    const loggedMeal = dayLoggedMeals.find(
                      (m) => m.meal_type === mealType
                    );

                    const hasLogged = !!loggedMeal;
                    const hasPlanned = !!plannedMeal;
                    const isEmpty = !hasLogged && !hasPlanned;

                    return (
                      <div key={mealType} className="relative">
                        <button
                          onClick={() => {
                            if (isEmpty || (!hasLogged && isFuture)) {
                              handleSlotClick(dateStr, mealType);
                            }
                          }}
                          disabled={hasLogged}
                          className={cn(
                            "w-full text-center p-3 rounded-lg transition-all border-2",
                            isEmpty &&
                              "border-dashed border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 cursor-pointer",
                            hasLogged && "border-primary/30 bg-primary/10 cursor-default",
                            hasPlanned && !hasLogged && "border-blue-300 bg-blue-50 cursor-pointer hover:border-blue-400"
                          )}
                        >
                          <Icon
                            className={cn(
                              "w-4 h-4 mx-auto mb-1",
                              isEmpty && "text-slate-400 dark:text-slate-500",
                              hasLogged && "text-primary",
                              hasPlanned && !hasLogged && "text-blue-500"
                            )}
                          />
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {config.shortLabel}
                          </p>
                          {hasLogged && (
                            <div className="flex items-center justify-center gap-1">
                              <Check className="w-3 h-3 text-primary" />
                              <span className="text-xs text-primary">Eaten</span>
                            </div>
                          )}
                          {hasPlanned && !hasLogged && (
                            <p className="text-xs text-blue-600 truncate">
                              {plannedMeal.custom_food_name || plannedMeal.food?.name || "Planned"}
                            </p>
                          )}
                          {isEmpty && (
                            <Plus className="w-4 h-4 mx-auto text-slate-400 dark:text-slate-500" />
                          )}
                        </button>

                        {/* Action buttons for planned meals */}
                        {hasPlanned && !hasLogged && (
                          <div className="absolute -top-2 -right-2 flex gap-1">
                            {isToday && (
                              <button
                                onClick={() => handleConvertToLogged(plannedMeal.id)}
                                className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors"
                                title="Mark as eaten"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeletePlannedMeal(plannedMeal.id)}
                              className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quick add for past days */}
                {isPast && (
                  <div className="mt-3 pt-3 border-t">
                    <Link href={`/food/log?date=${dateStr}`}>
                      <Button variant="ghost" size="sm" className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Log a meal
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Weekly Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const totalPlanned = plannedMeals.length;
            const totalLogged = dayMealQueries.reduce(
              (sum, q) => sum + (q.data?.length || 0),
              0
            );

            if (totalPlanned === 0 && totalLogged === 0) {
              return (
                <p className="text-center text-muted-foreground py-4">
                  No meals planned or logged this week
                </p>
              );
            }

            return (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{totalLogged}</p>
                  <p className="text-xs text-muted-foreground">Meals Logged</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{totalPlanned}</p>
                  <p className="text-xs text-muted-foreground">Meals Planned</p>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Add Planned Meal Modal */}
      {showAddModal && selectedSlot && (
        <AddPlannedMealModal
          date={selectedSlot.date}
          mealType={selectedSlot.mealType}
          onClose={() => {
            setShowAddModal(false);
            setSelectedSlot(null);
          }}
          onSave={handleAddPlannedMeal}
          isLoading={addPlannedMeal.isPending}
        />
      )}

      {/* Meal Templates Drawer */}
      <MealTemplatesDrawer
        isOpen={showTemplatesDrawer}
        onClose={() => setShowTemplatesDrawer(false)}
        onSelectTemplate={(template) => {
          // When a template is selected from the drawer,
          // open the add modal with today's date and the template's meal type
          const today = formatLocalDate(new Date());
          setSelectedSlot({
            date: today,
            mealType: template.meal_type || "lunch",
          });
          setShowTemplatesDrawer(false);
          setShowAddModal(true);
        }}
      />
    </div>
  );
}

function PlannerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse w-48" />
      <div className="h-14 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
      ))}
    </div>
  );
}
