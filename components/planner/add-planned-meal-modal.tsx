"use client";

import { useState } from "react";
import {
  X,
  Plus,
  Minus,
  Loader2,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Star,
  Search,
  Bookmark,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FoodSearch } from "@/components/food/food-search";
import { getFoodDetails } from "@/lib/api/usda";
import type { FoodSearchResult, Food } from "@/types";
import {
  useMealTemplates,
  useCreateMealTemplate,
  useIncrementTemplateUseCount,
  type MealType,
  type MealTemplate,
  type MealTemplateItem,
} from "@/lib/hooks/use-meal-plans";
import { cn } from "@/lib/utils/cn";

interface AddPlannedMealModalProps {
  date: string;
  mealType: MealType;
  onClose: () => void;
  onSave: (meal: {
    date: string;
    meal_type: MealType;
    food_id?: string;
    custom_food_name: string;
    servings: number;
    calories: number;
    notes?: string;
  }) => void;
  isLoading?: boolean;
}

const MEAL_TYPE_CONFIG = {
  breakfast: { icon: Coffee, label: "Breakfast", color: "text-amber-600" },
  lunch: { icon: Sun, label: "Lunch", color: "text-orange-600" },
  dinner: { icon: Moon, label: "Dinner", color: "text-indigo-600" },
  snack: { icon: Cookie, label: "Snack", color: "text-pink-600" },
};

export function AddPlannedMealModal({
  date,
  mealType: initialMealType,
  onClose,
  onSave,
  isLoading,
}: AddPlannedMealModalProps) {
  const [selectedMealType, setSelectedMealType] = useState<MealType>(initialMealType);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [loadingFood, setLoadingFood] = useState(false);
  const [servings, setServings] = useState(1);
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "templates">("search");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Templates
  const { data: templates = [] } = useMealTemplates();
  const createTemplate = useCreateMealTemplate();
  const incrementUseCount = useIncrementTemplateUseCount();

  const handleFoodSelect = async (searchResult: FoodSearchResult) => {
    setLoadingFood(true);
    try {
      const foodDetails = await getFoodDetails(searchResult.fdcId);
      if (foodDetails) {
        setSelectedFood(foodDetails);
      }
    } catch (error) {
      console.error("Error fetching food details:", error);
    } finally {
      setLoadingFood(false);
    }
  };

  const handleTemplateSelect = async (template: MealTemplate) => {
    // Use the first item from the template
    if (template.items.length > 0) {
      const item = template.items[0];
      // Create a mock food object from template item
      setSelectedFood({
        fdcId: "template",
        description: item.food_name,
        servingSize: 1,
        servingSizeUnit: "serving",
        nutrients: [
          { nutrientId: "1008", amount: item.calories, unit: "kcal" },
          { nutrientId: "1003", amount: item.protein || 0, unit: "g" },
          { nutrientId: "1005", amount: item.carbs || 0, unit: "g" },
          { nutrientId: "1004", amount: item.fat || 0, unit: "g" },
        ],
      });
      setServings(item.servings);
      setTemplateName(template.name);

      // Increment use count
      await incrementUseCount.mutateAsync(template.id);
    }
  };

  const handleSave = () => {
    if (!selectedFood) return;

    // Energy nutrient ID is 1008 in USDA database
    const energyNutrient = selectedFood.nutrients.find((n) => n.nutrientId === "1008");
    const calories = Math.round((energyNutrient?.amount || 0) * servings);

    onSave({
      date,
      meal_type: selectedMealType,
      custom_food_name: selectedFood.description,
      servings,
      calories,
      notes: notes || undefined,
    });
  };

  const handleSaveAsTemplate = async () => {
    if (!selectedFood || !templateName.trim()) return;

    const energyNutrient = selectedFood.nutrients.find((n) => n.nutrientId === "1008");
    const proteinNutrient = selectedFood.nutrients.find((n) => n.nutrientId === "1003");
    const carbsNutrient = selectedFood.nutrients.find((n) => n.nutrientId === "1005");
    const fatNutrient = selectedFood.nutrients.find((n) => n.nutrientId === "1004");

    const templateItem: MealTemplateItem = {
      food_name: selectedFood.description,
      servings,
      calories: Math.round((energyNutrient?.amount || 0) * servings),
      protein: proteinNutrient ? Math.round((proteinNutrient.amount || 0) * servings) : undefined,
      carbs: carbsNutrient ? Math.round((carbsNutrient.amount || 0) * servings) : undefined,
      fat: fatNutrient ? Math.round((fatNutrient.amount || 0) * servings) : undefined,
    };

    await createTemplate.mutateAsync({
      name: templateName.trim(),
      meal_type: selectedMealType,
      items: [templateItem],
    });

    setShowSaveTemplate(false);
    setTemplateName("");
  };

  const adjustServings = (delta: number) => {
    setServings((prev) => Math.max(0.25, Math.round((prev + delta) * 4) / 4));
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const getCalories = () => {
    if (!selectedFood) return 0;
    // Energy nutrient ID is 1008 in USDA database
    const energyNutrient = selectedFood.nutrients.find((n) => n.nutrientId === "1008");
    return Math.round((energyNutrient?.amount || 0) * servings);
  };

  const filteredTemplates = templates.filter(
    (t) => !t.meal_type || t.meal_type === selectedMealType
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
      <Card className="w-full max-w-lg mx-4 mb-4 lg:mb-0 max-h-[90vh] overflow-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Plan a Meal</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{formatDate(date)}</p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Meal Type Selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">Meal Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(MEAL_TYPE_CONFIG) as MealType[]).map((type) => {
                const config = MEAL_TYPE_CONFIG[type];
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedMealType(type)}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                      selectedMealType === type
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <Icon className={cn("w-5 h-5", config.color)} />
                    <span className="text-xs font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search / Templates Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "search" | "templates")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search" className="gap-2">
                <Search className="w-4 h-4" />
                Search Foods
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2">
                <Star className="w-4 h-4" />
                Templates
                {templates.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {templates.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="mt-4">
              <FoodSearch onSelect={handleFoodSelect} />
            </TabsContent>

            <TabsContent value="templates" className="mt-4">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No templates saved yet</p>
                  <p className="text-xs mt-1">
                    Save a meal as a template to quickly add it later
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-auto">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="w-full p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-all text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{template.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {template.total_calories} cal
                        </span>
                      </div>
                      {template.items.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.items[0].food_name}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Loading indicator */}
          {loadingFood && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading food details...
              </span>
            </div>
          )}

          {/* Selected Food */}
          {selectedFood && !loadingFood && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">{selectedFood.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedFood.servingSize} {selectedFood.servingSizeUnit}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setSelectedFood(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Servings Adjuster */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Servings</span>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => adjustServings(-0.25)}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-12 text-center font-medium">
                    {servings}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => adjustServings(0.25)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Calories Preview */}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Calories</span>
                <span className="font-semibold text-primary">
                  {getCalories()} cal
                </span>
              </div>

              {/* Save as Template */}
              {!showSaveTemplate ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowSaveTemplate(true)}
                >
                  <Bookmark className="w-4 h-4 mr-2" />
                  Save as Template
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Template name..."
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveAsTemplate}
                    disabled={!templateName.trim() || createTemplate.isPending}
                  >
                    {createTemplate.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSaveTemplate(false);
                      setTemplateName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Notes (optional)
            </label>
            <Input
              placeholder="Add a note..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={!selectedFood || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Plan
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
