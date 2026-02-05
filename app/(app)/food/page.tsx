"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, Trash2, Loader2, Camera, Sparkles, ChevronDown, ChevronUp, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NutrientBar } from "@/components/charts/nutrient-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { useMealLogsByDate, useDeleteMealItem, useUpdateMealItem, type MealLog } from "@/lib/hooks/use-meals";
import { useEffectiveGoals, useSupplementLogsByDate } from "@/lib/hooks";
import { getFoodDetails, smartSearchFoods, TRACKED_NUTRIENTS } from "@/lib/api/usda";
import { rerankUsdaCandidates } from "@/lib/api/usda-rerank";
import type { FoodNutrient } from "@/types";
import type { MealType } from "@/types";
import { cn } from "@/lib/utils/cn";
import { localDateISO, parseISODateLocal } from "@/lib/utils/dates";
import { getFoodResolutionOverride, upsertFoodResolutionOverride } from "@/lib/supabase/queries";

// Calculate daily nutrient totals from Supabase meal logs
function calculateDailyNutrients(meals: MealLog[]): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const meal of meals) {
    for (const item of meal.meal_items) {
      // Get nutrients from custom_food_nutrients (stored when logging USDA foods)
      const customNutrients = item.custom_food_nutrients || {};

      // Sum nutrients, multiplying by servings
      for (const [id, amount] of Object.entries(customNutrients)) {
        const numericAmount = typeof amount === 'number' ? amount : 0;
        totals[id] = (totals[id] || 0) + (numericAmount * item.servings);
      }
    }
  }

  return totals;
}

function transformNutrients(nutrients: FoodNutrient[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const n of nutrients) result[n.nutrientId] = n.amount;
  return result;
}

function normalizeDoseUnit(raw: string | null | undefined): string {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9µμ\s-]+/g, " ")
    .replace(/\s+/g, " ");
}

function singularizeUnit(unit: string): string {
  const u = normalizeDoseUnit(unit);
  if (u === "capsules") return "capsule";
  if (u === "tablets") return "tablet";
  if (u === "softgels") return "softgel";
  if (u === "gummies") return "gummy";
  if (u === "servings") return "serving";
  if (u.endsWith("ies") && u.length > 4) return `${u.slice(0, -3)}y`;
  if (u.endsWith("s") && u.length > 2) return u.slice(0, -1);
  return u;
}

function parseServingSizeText(raw: string | null | undefined): { count: number; unit: string } | null {
  if (!raw) return null;
  const trimmed = raw.split("(")[0].replace(/serving size[:]?/i, "").trim();
  if (!trimmed) return null;
  const m = trimmed.match(/(\d+(?:\.\d+)?)\s*([a-zA-Zµμ][a-zA-Zµμ\s-]{0,24})/);
  if (!m) return null;
  const count = Number(m[1]);
  if (!Number.isFinite(count) || count <= 0) return null;
  const unit = singularizeUnit(m[2]);
  if (!unit) return null;
  return { count, unit };
}

function isNutrientAmountUnit(unitNorm: string): boolean {
  // Units we want to treat as "direct nutrient amounts" when the user logs "400mg magnesium", etc.
  return ["mg", "mcg", "µg", "μg", "g", "kcal", "iu", "cfu"].includes(unitNorm);
}

function supplementServingMultiplier(args: {
  dosage: number;
  loggedUnit: string | null | undefined;
  servingSize: string | null | undefined;
}): number | null {
  const dosage = Number.isFinite(args.dosage) && args.dosage > 0 ? args.dosage : 1;
  const loggedUnitNorm = singularizeUnit(args.loggedUnit || "");
  const serving = parseServingSizeText(args.servingSize);

  // If we don't know the serving size, only "serving" can be safely treated as a multiplier.
  if (!serving) {
    if (!loggedUnitNorm || loggedUnitNorm === "serving") return dosage;
    return null;
  }

  // If the logged unit is itself a serving-size phrase ("2 capsules"), treat it as servings.
  const loggedAsServingPhrase = parseServingSizeText(args.loggedUnit);
  if (
    loggedAsServingPhrase &&
    loggedAsServingPhrase.unit === serving.unit &&
    Math.abs(loggedAsServingPhrase.count - serving.count) < 1e-6
  ) {
    return dosage;
  }

  if (!loggedUnitNorm || loggedUnitNorm === "serving") return dosage;
  if (loggedUnitNorm === serving.unit) return dosage / serving.count;
  return null;
}

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const LEGACY_USDA_NUMBERS_BY_ID: Record<string, string> = {
  "1008": "208", // Energy
  "1003": "203", // Protein
  "1004": "204", // Fat
  "1005": "205", // Carbs
  "1079": "291", // Fiber
  "1093": "307", // Sodium
  "1253": "601", // Cholesterol
  "1162": "401", // Vitamin C
  "1114": "328", // Vitamin D
};

function NutrientContributors({
  name,
  unit,
  total,
  foods,
  supplements,
  onClear,
}: {
  name: string;
  unit: string;
  total: number;
  foods: Array<{ key: string; label: string; amount: number; unit: string }>;
  supplements: Array<{ key: string; label: string; amount: number; unit: string }>;
  onClear: () => void;
}) {
  return (
    <div className="mt-2 ml-4 pl-4 border-l-2 border-slate-200/80 dark:border-slate-800">
      <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Contributors
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Collapse contributors" title="Collapse">
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        {name}: {Math.round(total)}
        {unit}
      </div>

      {foods.length === 0 && supplements.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          No contributors found for this nutrient.
        </div>
      ) : (
        <div className="space-y-4">
          {foods.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                Foods
              </div>
              <ul className="space-y-2">
                {foods.slice(0, 12).map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-900 dark:text-slate-100 truncate">
                      {c.label}
                    </span>
                    <span className="text-sm tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {Math.round(c.amount)}
                      {c.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {supplements.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                Supplements
              </div>
              <ul className="space-y-2">
                {supplements.slice(0, 12).map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-900 dark:text-slate-100 truncate">
                      {c.label}
                    </span>
                    <span className="text-sm tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {Math.round(c.amount)}
                      {c.unit || unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function SelectableNutrient({
  selected,
  onSelect,
  children,
  expanded,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  expanded?: React.ReactNode;
}) {
  return (
    <div className="-mx-2">
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          "relative rounded-lg px-2 py-2 cursor-pointer transition-colors",
          "hover:bg-slate-50 dark:hover:bg-slate-900/40",
          selected && "bg-slate-50 dark:bg-slate-900/40 ring-1 ring-black/5 dark:ring-white/10"
        )}
      >
        {children}
        <span className="absolute top-3 right-2 text-slate-400">
          {selected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </div>
      {selected ? expanded : null}
    </div>
  );
}

export default function FoodTrackerPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "nutrients">("all");
  const [selectedDate, setSelectedDate] = useState(
    localDateISO()
  );
  const [fixingItemId, setFixingItemId] = useState<string | null>(null);
  const [fixModal, setFixModal] = useState<{
    open: boolean;
    itemId: string;
    query: string;
    candidates: Array<{ fdcId: string; description: string; brandOwner?: string; dataType?: string }>;
    selectedFdcId: string | null;
    remember: boolean;
  } | null>(null);
  const [selectedNutrientId, setSelectedNutrientId] = useState<string | null>(null);

  const { data: meals = [], isLoading } = useMealLogsByDate(selectedDate);
  const { data: supplementLogs = [] } = useSupplementLogsByDate(selectedDate);
  const deleteMealItem = useDeleteMealItem();
  const updateMealItem = useUpdateMealItem();
  const { goals } = useEffectiveGoals();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setActiveTab(urlParams.get("tab") === "nutrients" ? "nutrients" : "all");
    setMounted(true);
  }, []);

  const dailyNutrients = calculateDailyNutrients(meals);

  const nutrientMeta = (nutrientId: string) => {
    const tracked = TRACKED_NUTRIENTS[nutrientId];
    if (tracked) return tracked;
    if (nutrientId === "1003") return { name: "Protein", unit: "g" };
    if (nutrientId === "1005") return { name: "Carbs", unit: "g" };
    if (nutrientId === "1004") return { name: "Fat", unit: "g" };
    if (nutrientId === "1008") return { name: "Calories", unit: "kcal" };
    return { name: nutrientId, unit: "" };
  };

  const resolveItemNutrient = (
    nutrientId: string,
    item: { custom_food_nutrients?: Record<string, number> | null }
  ) => {
    const v = item.custom_food_nutrients?.[nutrientId];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const legacy = LEGACY_USDA_NUMBERS_BY_ID[nutrientId];
    if (legacy) {
      const lv = item.custom_food_nutrients?.[legacy];
      if (typeof lv === "number" && Number.isFinite(lv)) return lv;
    }
    return 0;
  };

  const selectedBreakdown = useMemo(() => {
    if (!selectedNutrientId) return null;

    const meta = nutrientMeta(selectedNutrientId);

    const foods = meals.flatMap((meal) =>
      meal.meal_items
        .map((item) => {
          const perServing = resolveItemNutrient(selectedNutrientId, item);
          const amount = perServing * item.servings;
          return {
            key: item.id,
            label: `${MEAL_TYPE_LABELS[meal.meal_type]} · ${item.custom_food_name || "Unknown food"}`,
            amount,
            unit: meta.unit,
          };
        })
        .filter((x) => x.amount > 0)
    );

    const supplements = supplementLogs
      .map((log) => {
        const supplement = log.supplement as unknown as {
          supplement_ingredients?: Array<{
            nutrient?: { usda_id?: number; unit?: string; name?: string } | null;
            nutrient_name?: string;
            amount?: number;
            unit?: string;
          }>;
        } | null;

        const ingredients = supplement?.supplement_ingredients || [];
        const targetUsdaId = Number(selectedNutrientId);

        const matching = ingredients.find((ing) => {
          const usdaId = ing.nutrient?.usda_id;
          if (typeof usdaId === "number" && Number.isFinite(usdaId)) {
            return usdaId === targetUsdaId;
          }
          const name = (ing.nutrient_name || ing.nutrient?.name || "").toLowerCase();
          return name === meta.name.toLowerCase();
        });

        if (!matching) return null;

        const amountPerServing = typeof matching.amount === "number" ? matching.amount : 0;
        const dosage = typeof log.dosage === "number" ? log.dosage : 1;
        const unit = (matching.unit || matching.nutrient?.unit || meta.unit || "").toString();

        const loggedUnitNorm = singularizeUnit(log.unit);
        const ingredientUnitNorm = singularizeUnit(unit);

        // If the user logged an explicit nutrient amount ("400 mg magnesium"), treat it as the direct amount.
        // This avoids incorrectly interpreting mg/mcg/etc as "servings".
        if (loggedUnitNorm && loggedUnitNorm === ingredientUnitNorm && isNutrientAmountUnit(ingredientUnitNorm)) {
          return {
            key: log.id,
            label: `Supplement · ${log.supplement_name}`,
            amount: dosage,
            unit,
          };
        }

        const multiplier = supplementServingMultiplier({
          dosage,
          loggedUnit: log.unit,
          servingSize: (supplement as any)?.serving_size,
        });
        if (multiplier == null) return null;
        const amount = amountPerServing * multiplier;

        return {
          key: log.id,
          label: `Supplement · ${log.supplement_name}`,
          amount,
          unit,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x && x.amount > 0);

    const total =
      foods.reduce((s, x) => s + x.amount, 0) +
      supplements.reduce((s, x) => s + x.amount, 0);

    const sortDesc = <T extends { amount: number }>(a: T, b: T) => b.amount - a.amount;
    foods.sort(sortDesc);
    supplements.sort(sortDesc);

    return { nutrientId: selectedNutrientId, ...meta, total, foods, supplements };
  }, [meals, supplementLogs, selectedNutrientId]);

  const toggleNutrient = (nutrientId: string) => {
    setSelectedNutrientId((prev) => (prev === nutrientId ? null : nutrientId));
  };

  const goalMax = (usdaId: string, fallback: number) => {
    const value = goals.customNutrients?.[usdaId];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };

  const navigateDate = (direction: number) => {
    const date = parseISODateLocal(selectedDate);
    date.setDate(date.getDate() + direction);
    setSelectedDate(localDateISO(date));
  };

  const isToday =
    selectedDate === localDateISO();

  const formatDate = (dateStr: string) => {
    const date = parseISODateLocal(dateStr);
    if (isToday) return "Today";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getMealsByType = (type: MealType) => {
    return meals.filter((meal) => meal.meal_type === type);
  };

  const applyFixSelection = async (args: {
    itemId: string;
    query: string;
    fdcId: string;
    remember: boolean;
    updateName?: boolean;
  }) => {
    const food = await getFoodDetails(args.fdcId);
    if (!food) return;
    updateMealItem.mutate({
      id: args.itemId,
      updates: {
        custom_food_nutrients: transformNutrients(food.nutrients),
        ...(args.updateName ? { custom_food_name: food.description } : {}),
      },
    });
    if (args.remember) {
      await upsertFoodResolutionOverride(args.query, args.fdcId);
    }
  };

  const fixNutritionForItem = async (itemId: string, name: string) => {
    const query = name.trim();
    if (!query) return;
    setFixingItemId(itemId);
    try {
      const override = await getFoodResolutionOverride(query).catch(() => null);
      if (override) {
        await applyFixSelection({ itemId, query, fdcId: override, remember: true, updateName: false });
        return;
      }

      const results = await smartSearchFoods(query, 8);
      if (results.length === 0) return;
      const nanoPick = await rerankUsdaCandidates({
        query,
        candidates: results.map((r) => ({
          fdcId: r.fdcId,
          description: r.description,
          dataType: r.dataType,
          brandOwner: r.brandOwner,
        })),
      }).catch(() => null);
      const suggested =
        nanoPick?.fdcId && results.some((r) => r.fdcId === nanoPick.fdcId)
          ? nanoPick.fdcId
          : results[0]?.fdcId ?? null;

      const nanoFdcId = nanoPick?.fdcId ?? null;
      const autoOk = nanoPick && nanoFdcId && nanoPick.confidence >= 0.92 && !nanoPick.needsUserConfirmation;
      if (autoOk) {
        await applyFixSelection({ itemId, query, fdcId: nanoFdcId, remember: true, updateName: false });
        return;
      }
      setFixModal({
        open: true,
        itemId,
        query,
        candidates: results.map((r) => ({
          fdcId: r.fdcId,
          description: r.description,
          brandOwner: r.brandOwner,
          dataType: r.dataType,
        })),
        selectedFdcId: suggested,
        remember: true,
      });
    } finally {
      setFixingItemId(null);
    }
  };

  if (!mounted) return <FoodTrackerSkeleton />;

  return (
    <div className="space-y-6">
      {fixModal?.open && (
        <Modal open={true} onClose={() => setFixModal(null)}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Pick the best USDA match</ModalTitle>
              <ModalDescription>{fixModal.query}</ModalDescription>
            </ModalHeader>
            <div className="space-y-2 max-h-[52vh] overflow-auto pr-1">
              {fixModal.candidates.map((c) => (
                <button
                  key={c.fdcId}
                  type="button"
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors",
                    fixModal.selectedFdcId === c.fdcId
                      ? "border-primary-600/40 bg-primary-600/10"
                      : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                  onClick={() => setFixModal((prev) => (prev ? { ...prev, selectedFdcId: c.fdcId } : prev))}
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100">{c.description}</div>
                  <div className="text-xs text-slate-500">
                    {(c.dataType || "Unknown").toString()}
                    {c.brandOwner ? ` • ${c.brandOwner}` : ""}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={fixModal.remember}
                  onChange={(e) => setFixModal((prev) => (prev ? { ...prev, remember: e.target.checked } : prev))}
                />
                Remember this choice
              </label>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setFixModal(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={!fixModal.selectedFdcId || updateMealItem.isPending}
                  onClick={async () => {
                    const selectedFdcId = fixModal.selectedFdcId;
                    if (!selectedFdcId) return;
                    const current = fixModal;
                    setFixModal(null);
                    await applyFixSelection({
                      itemId: current.itemId,
                      query: current.query,
                      fdcId: selectedFdcId,
                      remember: current.remember,
                      updateName: false,
                    });
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </ModalContent>
        </Modal>
      )}
      {/* Header */}
      <PageHeader
        title="Food Tracker"
        action={
          <div className="flex items-center gap-2">
            <Link href="/food/guides">
              <Button variant="outline">Guides</Button>
            </Link>
            <Link href="/food/log/photo">
              <Button variant="outline">
                <Camera className="w-4 h-4 mr-2" />
                Photo
              </Button>
            </Link>
            <Link href="/food/log">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Log Food
              </Button>
            </Link>
          </div>
        }
      />

      {/* Date Navigation */}
      <Card className="!p-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="font-medium text-slate-900 dark:text-slate-100">{formatDate(selectedDate)}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate(1)}
            disabled={isToday}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Daily Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {Math.round(dailyNutrients["1008"] || 0)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Calories</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {Math.round(dailyNutrients["1003"] || 0)}g
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Protein</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {Math.round(dailyNutrients["1005"] || 0)}g
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Carbs</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {Math.round(dailyNutrients["1004"] || 0)}g
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Fat</p>
            </div>
          </div>

          <NutrientBar
            name="Calories"
            value={dailyNutrients["1008"] || 0}
            max={goals.calories}
            unit="kcal"
          />
        </CardContent>
      </Card>

      {/* Meals by Type */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "all" | "nutrients")}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          <TabsTrigger value="nutrients" className="flex-1">Nutrients</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-500 dark:text-slate-400">Loading meals...</span>
            </div>
          ) : (
            MEAL_TYPE_ORDER.map((mealType) => {
              const typeMeals = getMealsByType(mealType);
              const totalCalories = typeMeals.reduce((sum, meal) => {
                return (
                  sum +
                  meal.meal_items.reduce((itemSum, item) => {
                    const cal =
                      item.custom_food_nutrients?.["1008"] ??
                      item.custom_food_nutrients?.["208"] ??
                      0;
                    return itemSum + cal * item.servings;
                  }, 0)
                );
              }, 0);

              return (
                <Card key={mealType}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {MEAL_TYPE_LABELS[mealType]}
                      </CardTitle>
                      {totalCalories > 0 && (
                        <Badge variant="secondary">
                          {Math.round(totalCalories)} kcal
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {typeMeals.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          No {mealType} logged yet
                        </p>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {typeMeals.map((meal) =>
                          meal.meal_items.map((item) => {
                            const cal =
                              item.custom_food_nutrients?.["1008"] ??
                              item.custom_food_nutrients?.["208"] ??
                              0;
                            const itemCalories = cal * item.servings;
                            const canFix =
                              itemCalories === 0 &&
                              !!item.custom_food_name &&
                              !deleteMealItem.isPending &&
                              !updateMealItem.isPending;

                            return (
                              <li
                                key={item.id}
                                className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                              >
                                <div className="flex-1 min-w-0 mr-4">
                                  <p className="font-medium text-sm truncate text-slate-900 dark:text-slate-100">
                                    {item.custom_food_name || "Unknown food"}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">×{item.servings}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium whitespace-nowrap text-slate-900 dark:text-slate-100">
                                    {Math.round(itemCalories)} kcal
                                  </span>
                                  {canFix && (
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-slate-400 hover:text-slate-700"
                                      disabled={fixingItemId === item.id}
                                      onClick={() =>
                                        fixNutritionForItem(
                                          item.id,
                                          item.custom_food_name || ""
                                        )
                                      }
                                      title="Recompute nutrition from USDA"
                                    >
                                      {fixingItemId === item.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Sparkles className="w-4 h-4" />
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-slate-400 hover:text-red-500"
                                    disabled={deleteMealItem.isPending}
                                    onClick={() => deleteMealItem.mutate(item.id)}
                                  >
                                    {deleteMealItem.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="nutrients" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Detailed Nutrients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Macros */}
              <div>
                <h3 className="font-medium mb-3 text-slate-900 dark:text-slate-100">Macros</h3>
                <div className="space-y-3">
                  <SelectableNutrient
                    selected={selectedNutrientId === "1003"}
                    onSelect={() => toggleNutrient("1003")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1003" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Protein" value={dailyNutrients["1003"] || 0} max={goals.protein} unit="g" />
                  </SelectableNutrient>
                  <SelectableNutrient
                    selected={selectedNutrientId === "1005"}
                    onSelect={() => toggleNutrient("1005")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1005" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Carbs" value={dailyNutrients["1005"] || 0} max={goals.carbs} unit="g" />
                  </SelectableNutrient>
                  <SelectableNutrient
                    selected={selectedNutrientId === "1004"}
                    onSelect={() => toggleNutrient("1004")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1004" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Fat" value={dailyNutrients["1004"] || 0} max={goals.fat} unit="g" />
                  </SelectableNutrient>
                </div>
              </div>

              {/* Vitamins */}
              <div>
                <h3 className="font-medium mb-3 text-slate-900 dark:text-slate-100">Vitamins</h3>
                <div className="space-y-3">
                  <SelectableNutrient
                    selected={selectedNutrientId === "1106"}
                    onSelect={() => toggleNutrient("1106")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1106" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Vitamin A" value={dailyNutrients["1106"] || 0} max={goalMax("1106", 900)} unit="mcg" showWarning />
                  </SelectableNutrient>
                  <SelectableNutrient
                    selected={selectedNutrientId === "1162"}
                    onSelect={() => toggleNutrient("1162")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1162" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Vitamin C" value={dailyNutrients["1162"] || 0} max={goalMax("1162", 90)} unit="mg" showWarning />
                  </SelectableNutrient>
                  <SelectableNutrient
                    selected={selectedNutrientId === "1114"}
                    onSelect={() => toggleNutrient("1114")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1114" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Vitamin D" value={dailyNutrients["1114"] || 0} max={goalMax("1114", 20)} unit="mcg" showWarning />
                  </SelectableNutrient>
                  <SelectableNutrient
                    selected={selectedNutrientId === "1178"}
                    onSelect={() => toggleNutrient("1178")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1178" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Vitamin B12" value={dailyNutrients["1178"] || 0} max={goalMax("1178", 2.4)} unit="mcg" showWarning />
                  </SelectableNutrient>
                </div>
              </div>

              {/* Minerals */}
              <div>
                <h3 className="font-medium mb-3 text-slate-900 dark:text-slate-100">Minerals</h3>
                <div className="space-y-3">
                  <SelectableNutrient
                    selected={selectedNutrientId === "1089"}
                    onSelect={() => toggleNutrient("1089")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1089" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Iron" value={dailyNutrients["1089"] || 0} max={goalMax("1089", 18)} unit="mg" showWarning />
                  </SelectableNutrient>
                  <SelectableNutrient
                    selected={selectedNutrientId === "1087"}
                    onSelect={() => toggleNutrient("1087")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1087" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Calcium" value={dailyNutrients["1087"] || 0} max={goalMax("1087", 1000)} unit="mg" showWarning />
                  </SelectableNutrient>
                  <SelectableNutrient
                    selected={selectedNutrientId === "1090"}
                    onSelect={() => toggleNutrient("1090")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1090" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Magnesium" value={dailyNutrients["1090"] || 0} max={goalMax("1090", 400)} unit="mg" showWarning />
                  </SelectableNutrient>
                  <SelectableNutrient
                    selected={selectedNutrientId === "1092"}
                    onSelect={() => toggleNutrient("1092")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1092" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Potassium" value={dailyNutrients["1092"] || 0} max={goalMax("1092", 4700)} unit="mg" showWarning />
                  </SelectableNutrient>
                  <SelectableNutrient
                    selected={selectedNutrientId === "1095"}
                    onSelect={() => toggleNutrient("1095")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1095" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Zinc" value={dailyNutrients["1095"] || 0} max={goalMax("1095", 11)} unit="mg" showWarning />
                  </SelectableNutrient>
                </div>
              </div>

              {/* Other */}
              <div>
                <h3 className="font-medium mb-3 text-slate-900 dark:text-slate-100">Other</h3>
                <div className="space-y-3">
                  <SelectableNutrient
                    selected={selectedNutrientId === "1079"}
                    onSelect={() => toggleNutrient("1079")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1079" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Fiber" value={dailyNutrients["1079"] || 0} max={goals.fiber} unit="g" showWarning />
                  </SelectableNutrient>
                  <SelectableNutrient
                    selected={selectedNutrientId === "1093"}
                    onSelect={() => toggleNutrient("1093")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1093" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Sodium" value={dailyNutrients["1093"] || 0} max={goalMax("1093", 2300)} unit="mg" />
                  </SelectableNutrient>
                  <SelectableNutrient
                    selected={selectedNutrientId === "1253"}
                    onSelect={() => toggleNutrient("1253")}
                    expanded={
                      selectedBreakdown?.nutrientId === "1253" ? (
                        <NutrientContributors
                          name={selectedBreakdown.name}
                          unit={selectedBreakdown.unit}
                          total={selectedBreakdown.total}
                          foods={selectedBreakdown.foods}
                          supplements={selectedBreakdown.supplements}
                          onClear={() => setSelectedNutrientId(null)}
                        />
                      ) : null
                    }
                  >
                    <NutrientBar name="Cholesterol" value={dailyNutrients["1253"] || 0} max={goalMax("1253", 300)} unit="mg" />
                  </SelectableNutrient>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FoodTrackerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse w-48" />
      <div className="h-14 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
      <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
      <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
    </div>
  );
}
