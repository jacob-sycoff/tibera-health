"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mic, RefreshCcw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { analyzeMealPhoto, type MealPhotoAnalysis, type MealPhotoItem } from "@/lib/api/meal-photo-logger";
import { getFoodDetails, searchFoods } from "@/lib/api/usda";
import { useCreateMealLog } from "@/lib/hooks/use-meals";
import type { Food, FoodNutrient, MealType } from "@/types";
import { cn } from "@/lib/utils/cn";

type ResolvedItem = {
  key: string;
  analysisItem: MealPhotoItem;
  matchedFood: Food | null;
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

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

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
            const results = await searchFoods(query, 5);
            const best = results[0];
            const food = best ? await getFoodDetails(best.fdcId) : null;

            const consumedGrams = deriveConsumedGrams(analysisItem);
            const servingUnit = (food?.servingSizeUnit || "").toLowerCase();
            const servingSize = food?.servingSize || 0;

            let servings = 1;
            if (consumedGrams != null && servingSize > 0 && (servingUnit === "g" || servingUnit === "gram" || servingUnit === "grams")) {
              servings = consumedGrams / servingSize;
            }

            return {
              key: `${idx}-${analysisItem.name}`,
              analysisItem,
              matchedFood: food,
              servings: roundServings(servings),
            } satisfies ResolvedItem;
          } catch (error) {
            return {
              key: `${idx}-${analysisItem.name}`,
              analysisItem,
              matchedFood: null,
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
              custom_food_name: item.matchedFood.description,
              custom_food_nutrients: transformNutrients(item.matchedFood.nutrients),
              servings: item.servings,
            };
          }
          return {
            custom_food_name: item.analysisItem.name,
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

            <ul className="space-y-3">
              {resolvedItems.map((item) => (
                <li key={item.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {item.matchedFood?.description || item.analysisItem.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.analysisItem.name}
                        {" · "}
                        {Math.round(item.analysisItem.confidence * 100)}%
                        {item.resolveError ? ` · ${item.resolveError}` : null}
                      </div>
                    </div>

                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.key)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="w-32">
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
                      {(() => {
                        const grams = deriveConsumedGrams(item.analysisItem);
                        if (grams == null) return "Portion estimated as servings.";
                        return `Estimated consumed: ${Math.round(grams)}g`;
                      })()}
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
