"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mic, RefreshCcw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { analyzeMealPhoto, type MealPhotoAnalysis, type MealPhotoItem } from "@/lib/api/meal-photo-logger";
import { getFoodDetails, smartSearchFoods } from "@/lib/api/usda";
import { useCreateMealLog } from "@/lib/hooks/use-meals";
import { FoodSearch } from "@/components/food/food-search";
import type { Food, FoodNutrient, FoodSearchResult, MealType } from "@/types";
import { cn } from "@/lib/utils/cn";

type ResolvedItem = {
  key: string;
  analysisItem: MealPhotoItem | null;
  label: string;
  usdaQuery: string;
  gramsConsumed: number | null;
  matchedFood: Food | null;
  candidates: FoodSearchResult[];
  selectedCandidate: FoodSearchResult | null;
  servings: number;
  resolveError?: string;
};

function transformNutrients(nutrients: FoodNutrient[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const n of nutrients) result[n.nutrientId] = n.amount;
  return result;
}

function roundServings(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const rounded = Math.round(value * 4) / 4;
  return Math.max(0.25, Math.min(50, rounded));
}

function deriveConsumedGrams(item: MealPhotoItem): number | null {
  if (typeof item.consumedGrams === "number" && Number.isFinite(item.consumedGrams)) return item.consumedGrams;
  if (typeof item.servedGrams === "number" && Number.isFinite(item.servedGrams)) {
    if (typeof item.consumedFraction === "number" && Number.isFinite(item.consumedFraction)) {
      return item.servedGrams * item.consumedFraction;
    }
  }
  return null;
}

function servingsFromGrams(food: Food | null, grams: number | null): number | null {
  if (!food || grams == null || !Number.isFinite(grams) || grams <= 0) return null;
  const servingUnit = (food.servingSizeUnit || "").toLowerCase();
  const servingSize = food.servingSize || 0;
  if (servingSize <= 0) return null;
  if (servingUnit === "g" || servingUnit === "gram" || servingUnit === "grams" || servingUnit === "ml") {
    return grams / servingSize;
  }
  return null;
}

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

function candidateRank(candidate: FoodSearchResult): number {
  const dt = (candidate.dataType || "").toLowerCase();
  if (dt.includes("foundation")) return 0;
  if (dt.includes("sr legacy") || dt.includes("sr")) return 1;
  if (dt.includes("survey")) return 2;
  if (dt.includes("branded")) return 3;
  return 4;
}

function pickBestCandidate(candidates: FoodSearchResult[]): FoodSearchResult | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    const ra = candidateRank(a);
    const rb = candidateRank(b);
    if (ra !== rb) return ra - rb;
    return (b.score || 0) - (a.score || 0);
  });
  return sorted[0] || null;
}

async function resolveFirstValidFood(candidates: FoodSearchResult[]): Promise<{
  selectedCandidate: FoodSearchResult | null;
  food: Food | null;
}> {
  for (const candidate of candidates) {
    const food = await getFoodDetails(candidate.fdcId);
    if (food) return { selectedCandidate: candidate, food };
  }
  return { selectedCandidate: null, food: null };
}

export default function LogFoodFromPhotoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("breakfast");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const [note, setNote] = useState("");
  const [isDictating, setIsDictating] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MealPhotoAnalysis | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<{ message: string; progress: number } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const createMealLog = useCreateMealLog();
  const toast = useToast();

  useEffect(() => {
    setMounted(true);
    const hour = new Date().getHours();
    if (hour < 10) setSelectedMealType("breakfast");
    else if (hour < 14) setSelectedMealType("lunch");
    else if (hour < 18) setSelectedMealType("snack");
    else setSelectedMealType("dinner");
  }, []);

  const totalCalories = useMemo(() => {
    return resolvedItems.reduce((sum, item) => {
      const cal = item.matchedFood?.nutrients.find((n) => n.nutrientId === "1008")?.amount ?? 0;
      return sum + cal * item.servings;
    }, 0);
  }, [resolvedItems]);

  const handleSelectFile = (file: File) => {
    setAnalysisError(null);
    setAnalysis(null);
    setResolvedItems([]);

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resolveToUsdaFoods = async (analysisItems: MealPhotoItem[]) => {
    setIsResolving(true);
    try {
      const resolved = await Promise.all(
        analysisItems.map(async (analysisItem, idx) => {
          try {
            const query = analysisItem.usdaQuery || analysisItem.name;
            const candidates = await smartSearchFoods(query, 10);
            const ranked = pickBestCandidate(candidates);
            const ordered = ranked
              ? [ranked, ...candidates.filter((c) => c.fdcId !== ranked.fdcId)]
              : candidates;

            const { selectedCandidate, food } = await resolveFirstValidFood(ordered);

            const gramsConsumed = deriveConsumedGrams(analysisItem);
            const servingsFromAuto = servingsFromGrams(food, gramsConsumed);
            const servings = roundServings(servingsFromAuto ?? 1);

            return {
              key: `${idx}-${analysisItem.name}`,
              analysisItem,
              label: analysisItem.name,
              usdaQuery: query,
              gramsConsumed,
              matchedFood: food,
              candidates: ordered,
              selectedCandidate,
              servings: roundServings(servings),
            } satisfies ResolvedItem;
          } catch (error) {
            return {
              key: `${idx}-${analysisItem.name}`,
              analysisItem,
              label: analysisItem.name,
              usdaQuery: analysisItem.usdaQuery || analysisItem.name,
              gramsConsumed: deriveConsumedGrams(analysisItem),
              matchedFood: null,
              candidates: [],
              selectedCandidate: null,
              servings: 1,
              resolveError: error instanceof Error ? error.message : "Failed to match food",
            } satisfies ResolvedItem;
          }
        })
      );
      setResolvedItems(resolved);
    } finally {
      setIsResolving(false);
    }
  };

  const refreshCandidatesForItem = async (key: string) => {
    const item = resolvedItems.find((i) => i.key === key);
    if (!item) return;

    const query = item.usdaQuery.trim();
    if (query.length < 2) {
      toast.error("Enter a longer search query");
      return;
    }

    setIsResolving(true);
    try {
      const candidates = await smartSearchFoods(query, 12);
      const ranked = pickBestCandidate(candidates);
      const ordered = ranked
        ? [ranked, ...candidates.filter((c) => c.fdcId !== ranked.fdcId)]
        : candidates;

      const { selectedCandidate, food } = await resolveFirstValidFood(ordered);
      const nextServings = servingsFromGrams(food, item.gramsConsumed);

      setResolvedItems((prev) =>
        prev.map((p) =>
          p.key === key
            ? {
                ...p,
                candidates: ordered,
                selectedCandidate,
                matchedFood: food,
                servings: roundServings(nextServings ?? p.servings ?? 1),
                resolveError: food ? undefined : p.resolveError,
              }
            : p
        )
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    } finally {
      setIsResolving(false);
    }
  };

  const selectCandidateForItem = async (key: string, candidate: FoodSearchResult) => {
    setIsResolving(true);
    try {
      const food = await getFoodDetails(candidate.fdcId);
      if (!food) {
        toast.error("Could not load nutrition for that match. Try another.");
        return;
      }
      setResolvedItems((prev) =>
        prev.map((p) => {
          if (p.key !== key) return p;
          const nextServings = servingsFromGrams(food, p.gramsConsumed);
          return {
            ...p,
            selectedCandidate: candidate,
            matchedFood: food,
            label: p.label.trim() ? p.label : candidate.description,
            servings: roundServings(nextServings ?? p.servings ?? 1),
            resolveError: food ? undefined : p.resolveError,
          };
        })
      );
    } finally {
      setIsResolving(false);
    }
  };

  const addManualItem = () => {
    const idx = resolvedItems.length + 1;
    setResolvedItems((prev) => [
      ...prev,
      {
        key: `manual-${Date.now()}-${idx}`,
        analysisItem: null,
        label: "",
        usdaQuery: "",
        gramsConsumed: null,
        matchedFood: null,
        candidates: [],
        selectedCandidate: null,
        servings: 1,
      },
    ]);
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    setResolvedItems([]);

    const result = await analyzeMealPhoto(imageFile, {
      note,
      onProgress: (p) => setAnalysisProgress({ message: p.message, progress: p.progress }),
    });

    if (!result.success || !result.data) {
      setAnalysisError(result.error || "Failed to analyze photo");
      setIsAnalyzing(false);
      setAnalysisProgress(null);
      return;
    }

    setAnalysis(result.data);
    setIsAnalyzing(false);
    setAnalysisProgress(null);

    await resolveToUsdaFoods(result.data.items);
  };

  const handleRemoveItem = (key: string) => {
    setResolvedItems((prev) => prev.filter((i) => i.key !== key));
  };

  const handleSave = async () => {
    if (resolvedItems.length === 0 || isSaving) return;
    setIsSaving(true);

    try {
      await createMealLog.mutateAsync({
        date: selectedDate,
        meal_type: selectedMealType,
        notes: note.trim() ? `Photo log note: ${note.trim()}` : undefined,
        items: resolvedItems.map((item) => {
          if (item.matchedFood) {
            return {
              custom_food_name: item.label.trim() || item.matchedFood.description,
              custom_food_nutrients: transformNutrients(item.matchedFood.nutrients),
              servings: item.servings,
            };
          }
          return {
            custom_food_name: item.label.trim() || item.analysisItem?.name || "Unknown food",
            custom_food_nutrients: undefined,
            servings: item.servings,
          };
        }),
      });

      toast.success("Meal saved");
      router.push("/food");
    } catch (error) {
      console.error("Failed to save meal:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save meal");
      setIsSaving(false);
    }
  };

  const startDictation = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Dictation not supported in this browser");
      return;
    }

    if (isDictating) return;
    setIsDictating(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalText = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      const next = `${note.trim()} ${finalText}${interim}`.trim();
      setNote(next);
    };

    recognition.onerror = () => {
      setIsDictating(false);
      toast.error("Dictation failed");
    };

    recognition.onend = () => {
      setIsDictating(false);
      if (finalText.trim()) setNote((prev) => `${prev.trim()} ${finalText.trim()}`.trim());
    };

    recognition.start();
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Log Food from Photo</h1>
          <p className="text-sm text-slate-500">Review and confirm before saving.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Date</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Meal Type</label>
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Meal Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSelectFile(file);
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                setImageFile(null);
                setPreviewUrl(null);
                setAnalysis(null);
                setResolvedItems([]);
                setAnalysisError(null);
              }}
              disabled={!imageFile}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>

          {previewUrl && (
            <div className="rounded-lg overflow-hidden border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Meal preview" className="w-full h-auto" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Optional Note (Text or Dictation)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm text-slate-600">
              Example: “I only ate half the chicken but finished the rice.”
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
              placeholder="Add details to improve accuracy…"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={startDictation} disabled={isDictating}>
              <Mic className="w-4 h-4 mr-2" />
              {isDictating ? "Listening…" : "Dictate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleAnalyze} disabled={!imageFile || isAnalyzing}>
          {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
          Analyze Photo
        </Button>
        {analysisProgress && (
          <span className="text-sm text-slate-500">
            {analysisProgress.message} ({analysisProgress.progress}%)
          </span>
        )}
      </div>

      {analysisError && (
        <Card className="border-red-200">
          <CardContent className="pt-4 text-sm text-red-600">{analysisError}</CardContent>
        </Card>
      )}

      {(analysis || resolvedItems.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Detected Foods</CardTitle>
              <span className="text-sm font-medium text-primary-600">
                {Math.round(totalCalories)} kcal
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isResolving && (
              <div className="flex items-center text-sm text-slate-500">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Matching foods to nutrition database…
              </div>
            )}

            {analysis && (
              <div className="text-xs text-slate-500">
                Model confidence: {Math.round(analysis.overallConfidence * 100)}%
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" onClick={addManualItem}>
                Add Item
              </Button>
              <div className="text-xs text-slate-500">
                Tip: use “Search” if the match is wrong.
              </div>
            </div>

            <ul className="space-y-3">
              {resolvedItems.map((item) => (
                <li key={item.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Label</label>
                            <Input
                              value={item.label}
                              onChange={(e) => {
                                const value = e.target.value;
                                setResolvedItems((prev) =>
                                  prev.map((p) => (p.key === item.key ? { ...p, label: value } : p))
                                );
                              }}
                              placeholder="e.g., grilled chicken"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">USDA Search</label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={item.usdaQuery}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setResolvedItems((prev) =>
                                    prev.map((p) => (p.key === item.key ? { ...p, usdaQuery: value } : p))
                                  );
                                }}
                                placeholder="e.g., white rice cooked"
                              />
                              <Button variant="outline" onClick={() => refreshCandidatesForItem(item.key)}>
                                Search
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Match Override</label>
                            <FoodSearch
                              onSelect={(food) => selectCandidateForItem(item.key, food)}
                              className="max-w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Top Matches</label>
                            <select
                              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-600 dark:border-slate-800 dark:bg-slate-950"
                              value={item.selectedCandidate?.fdcId || ""}
                              onChange={(e) => {
                                const next = item.candidates.find((c) => c.fdcId === e.target.value);
                                if (next) selectCandidateForItem(item.key, next);
                              }}
                              disabled={item.candidates.length === 0}
                            >
                              <option value="" disabled>
                                {item.candidates.length ? "Select a match…" : "No matches yet"}
                              </option>
                              {item.candidates.map((c) => (
                                <option key={c.fdcId} value={c.fdcId}>
                                  {c.description}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.matchedFood?.description ? `Matched: ${item.matchedFood.description}` : "No USDA match selected"}
                        {item.analysisItem ? ` · AI: ${Math.round(item.analysisItem.confidence * 100)}%` : null}
                        {item.resolveError ? ` · ${item.resolveError}` : null}
                      </div>
                    </div>

                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.key)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Consumed (g / mL)</label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={item.gramsConsumed ?? ""}
                        onChange={(e) => {
                          const value = e.target.value === "" ? null : Number(e.target.value);
                          setResolvedItems((prev) =>
                            prev.map((p) => {
                              if (p.key !== item.key) return p;
                              const nextServings = servingsFromGrams(p.matchedFood, value);
                              return {
                                ...p,
                                gramsConsumed: value != null && Number.isFinite(value) ? value : null,
                                servings: roundServings(nextServings ?? p.servings ?? 1),
                              };
                            })
                          );
                        }}
                        placeholder="Optional"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Servings</label>
                      <Input
                        type="number"
                        step="0.25"
                        min="0.25"
                        value={item.servings}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setResolvedItems((prev) =>
                            prev.map((p) => (p.key === item.key ? { ...p, servings: roundServings(value) } : p))
                          );
                        }}
                      />
                    </div>

                    <div className="text-xs text-slate-500">
                      {item.analysisItem ? (
                        item.gramsConsumed != null ? (
                          `AI portion adjusted: ${Math.round(item.gramsConsumed)}g`
                        ) : (
                          "AI portion not in grams."
                        )
                      ) : (
                        "Manual item."
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {analysis?.assumptions?.length ? (
              <div className="text-xs text-slate-500">
                Assumptions: {analysis.assumptions.slice(0, 3).join(" · ")}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => router.push("/food")}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={resolvedItems.length === 0 || isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Meal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
