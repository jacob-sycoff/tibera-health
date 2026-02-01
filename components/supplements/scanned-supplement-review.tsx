"use client";

import { useState } from "react";
import {
  X,
  Check,
  AlertTriangle,
  Edit2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Save,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ScannedSupplement, ScannedIngredient, DietaryAttributes, SupplementCategory } from "@/lib/api/supplement-scanner";
import { SUPPLEMENT_CATEGORIES } from "@/lib/api/supplement-scanner";
import { cn } from "@/lib/utils/cn";

// Infer category from product name and ingredients
function inferCategory(data: ScannedSupplement): SupplementCategory {
  const productName = data.name.toLowerCase();
  const ingredientNames = data.ingredients.map((i) => i.name.toLowerCase());

  // Check product name first for clear indicators
  if (productName.includes("prenatal") || productName.includes("pre-natal")) {
    return "multivitamin";
  }
  if (productName.includes("multivitamin") || productName.includes("multi-vitamin")) {
    return "multivitamin";
  }
  if (productName.includes("probiotic") && !productName.includes("vitamin")) {
    return "probiotic";
  }
  if (productName.includes("omega") || productName.includes("fish oil") || productName.includes("dha")) {
    return "omega";
  }

  // Count different nutrient types
  const vitaminCount = ingredientNames.filter((n) =>
    n.includes("vitamin") || n.includes("folate") || n.includes("folic") ||
    n.includes("biotin") || n.includes("niacin") || n.includes("thiamin") ||
    n.includes("riboflavin") || n.includes("cobalamin") || n.includes("choline")
  ).length;

  const mineralCount = ingredientNames.filter((n) =>
    ["calcium", "magnesium", "iron", "zinc", "potassium", "selenium", "iodine",
     "copper", "manganese", "chromium", "molybdenum"].some((m) => n.includes(m))
  ).length;

  const hasOmega3 = ingredientNames.some((n) =>
    n.includes("epa") || n.includes("dha") || n.includes("omega")
  );

  const hasProbiotics = ingredientNames.some((n) =>
    n.includes("probiotic") || n.includes("lactobacillus") || n.includes("bifidobacterium")
  );

  // If it has multiple vitamins AND minerals, it's a multivitamin
  if (vitaminCount >= 3 || (vitaminCount >= 2 && mineralCount >= 2)) {
    return "multivitamin";
  }

  // Only classify as probiotic if it's primarily probiotics
  if (hasProbiotics && vitaminCount < 2 && mineralCount < 2) {
    return "probiotic";
  }

  if (hasOmega3) return "omega";

  if (mineralCount > 0 && vitaminCount === 0 && data.ingredients.length <= 3) {
    return "mineral";
  }

  if (vitaminCount === 1 && mineralCount === 0) {
    return "single";
  }

  return "other";
}

// Helper to format attribute names for display
function formatAttributeName(key: string): string {
  const nameMap: Record<string, string> = {
    thirdPartyTested: "Third-Party Tested",
    thirdPartyTesters: "Tested By",
    cgmpCertified: "cGMP Certified",
    heavyMetalsTested: "Heavy Metals Tested",
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    meatFree: "Meat-Free",
    porkFree: "Pork-Free",
    shellfishFree: "Shellfish-Free",
    fishFree: "Fish-Free",
    gelatinFree: "Gelatin-Free",
    animalGelatinFree: "Animal Gelatin-Free",
    usesVegetarianCapsule: "Vegetarian Capsule",
    usesFishGelatin: "Fish Gelatin",
    usesPorkGelatin: "Pork Gelatin",
    usesBeefGelatin: "Beef Gelatin",
    capsuleType: "Capsule Type",
    kosher: "Kosher",
    kosherCertifier: "Kosher Certifier",
    halal: "Halal",
    halalCertifier: "Halal Certifier",
    glutenFree: "Gluten-Free",
    dairyFree: "Dairy-Free",
    soyFree: "Soy-Free",
    nutFree: "Nut-Free",
    eggFree: "Egg-Free",
    cornFree: "Corn-Free",
    nonGMO: "Non-GMO",
    organic: "Organic",
    organicCertifier: "Organic Certifier",
    sustainablySourced: "Sustainably Sourced",
    pregnancySafe: "Pregnancy Safe",
    nursingSafe: "Nursing Safe",
    madeInUSA: "Made in USA",
    countryOfOrigin: "Country of Origin",
  };
  return nameMap[key] || key.replace(/([A-Z])/g, " $1").trim();
}

interface ScannedSupplementReviewProps {
  data: ScannedSupplement;
  onConfirm: (data: ScannedSupplement) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function ScannedSupplementReview({
  data,
  onConfirm,
  onCancel,
  isSaving = false,
}: ScannedSupplementReviewProps) {
  // Initialize with inferred category if not already set
  const initialData = {
    ...data,
    category: data.category || inferCategory(data),
  };
  const [editedData, setEditedData] = useState<ScannedSupplement>(initialData);
  const [expandedSections, setExpandedSections] = useState({
    ingredients: true,
    otherIngredients: false,
    allergens: false,
    warnings: false,
    dietaryAttributes: true,
  });
  const [editingIngredient, setEditingIngredient] = useState<number | null>(null);

  const confidenceColor =
    editedData.confidence >= 0.8
      ? "text-green-600"
      : editedData.confidence >= 0.5
      ? "text-yellow-600"
      : "text-red-600";

  const confidenceLabel =
    editedData.confidence >= 0.8
      ? "High"
      : editedData.confidence >= 0.5
      ? "Medium"
      : "Low";

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateField = <K extends keyof ScannedSupplement>(
    field: K,
    value: ScannedSupplement[K]
  ) => {
    setEditedData((prev) => ({ ...prev, [field]: value }));
  };

  const updateIngredient = (index: number, field: keyof ScannedIngredient, value: string | number) => {
    setEditedData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      ),
    }));
  };

  const removeIngredient = (index: number) => {
    setEditedData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const addIngredient = () => {
    setEditedData((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { name: "", amount: 0, unit: "mg" },
      ],
    }));
    setEditingIngredient(editedData.ingredients.length);
  };

  const removeOtherIngredient = (index: number) => {
    setEditedData((prev) => ({
      ...prev,
      otherIngredients: prev.otherIngredients.filter((_, i) => i !== index),
    }));
  };

  const addOtherIngredient = (value: string) => {
    if (!value.trim()) return;
    setEditedData((prev) => ({
      ...prev,
      otherIngredients: [...prev.otherIngredients, value.trim()],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <CardHeader className="border-b shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-500" />
                <CardTitle>Review Scanned Supplement</CardTitle>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Please review and edit the extracted information before saving
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Confidence Indicator */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-gray-500">AI Confidence:</span>
            <Badge
              variant="outline"
              className={cn("font-medium", confidenceColor)}
            >
              {confidenceLabel} ({Math.round(editedData.confidence * 100)}%)
            </Badge>
            {editedData.confidence < 0.8 && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Please verify the extracted data
              </span>
            )}
          </div>
        </CardHeader>

        {/* Content - Scrollable */}
        <CardContent className="overflow-y-auto flex-1 py-4 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Product Name *</label>
              <Input
                value={editedData.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Supplement name"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Brand</label>
                <Input
                  value={editedData.brand || ""}
                  onChange={(e) => updateField("brand", e.target.value || null)}
                  placeholder="Brand name"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Serving Size</label>
                <Input
                  value={editedData.servingSize || ""}
                  onChange={(e) => updateField("servingSize", e.target.value || null)}
                  placeholder="e.g., 2 capsules"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Servings Per Container</label>
                <Input
                  type="number"
                  value={editedData.servingsPerContainer || ""}
                  onChange={(e) =>
                    updateField("servingsPerContainer", e.target.value ? parseInt(e.target.value) : null)
                  }
                  placeholder="Number of servings"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <select
                  value={editedData.category || "other"}
                  onChange={(e) => updateField("category", e.target.value as SupplementCategory)}
                  className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                >
                  {SUPPLEMENT_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Ingredients Section */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection("ingredients")}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  Active Ingredients ({editedData.ingredients.length})
                </span>
                {editedData.ingredients.length === 0 && (
                  <Badge variant="warning">None detected</Badge>
                )}
              </div>
              {expandedSections.ingredients ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>

            {expandedSections.ingredients && (
              <div className="border-t p-3 space-y-3">
                {editedData.ingredients.map((ing, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded-lg border",
                      editingIngredient === index ? "border-primary-500 bg-primary-50" : "bg-gray-50"
                    )}
                  >
                    {editingIngredient === index ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500">Name</label>
                            <Input
                              value={ing.name}
                              onChange={(e) => updateIngredient(index, "name", e.target.value)}
                              placeholder="Nutrient name"
                              className="mt-1"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Form (optional)</label>
                            <Input
                              value={ing.form || ""}
                              onChange={(e) => updateIngredient(index, "form", e.target.value)}
                              placeholder="e.g., Methylcobalamin"
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-gray-500">Amount</label>
                            <Input
                              type="number"
                              step="any"
                              value={ing.amount}
                              onChange={(e) => updateIngredient(index, "amount", parseFloat(e.target.value) || 0)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Unit</label>
                            <select
                              value={ing.unit}
                              onChange={(e) => updateIngredient(index, "unit", e.target.value)}
                              className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-sm"
                            >
                              <option value="mcg">mcg</option>
                              <option value="mg">mg</option>
                              <option value="g">g</option>
                              <option value="IU">IU</option>
                              <option value="mcg RAE">mcg RAE</option>
                              <option value="mcg DFE">mcg DFE</option>
                              <option value="mg NE">mg NE</option>
                              <option value="billion CFU">billion CFU</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">% DV</label>
                            <Input
                              type="number"
                              value={ing.dailyValue ?? ""}
                              onChange={(e) =>
                                updateIngredient(index, "dailyValue", e.target.value ? parseFloat(e.target.value) : undefined as any)
                              }
                              placeholder="Optional"
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeIngredient(index)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setEditingIngredient(null)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Done
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{ing.name || "Unnamed"}</span>
                          {ing.form && (
                            <span className="text-sm text-gray-500 ml-1">
                              ({ing.form})
                            </span>
                          )}
                          <div className="text-sm text-gray-600">
                            {ing.amount} {ing.unit}
                            {ing.dailyValue != null && (
                              <span className="text-gray-500 ml-2">
                                ({ing.dailyValue}% DV)
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingIngredient(index)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={addIngredient}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Ingredient
                </Button>
              </div>
            )}
          </div>

          {/* Other Ingredients Section */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection("otherIngredients")}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
            >
              <span className="font-medium">
                Other Ingredients ({editedData.otherIngredients.length})
              </span>
              {expandedSections.otherIngredients ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>

            {expandedSections.otherIngredients && (
              <div className="border-t p-3">
                <div className="flex flex-wrap gap-2 mb-3">
                  {editedData.otherIngredients.map((ing, index) => (
                    <Badge key={index} variant="secondary" className="pr-1">
                      {ing}
                      <button
                        onClick={() => removeOtherIngredient(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <OtherIngredientInput onAdd={addOtherIngredient} />
              </div>
            )}
          </div>

          {/* Allergens Section */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection("allergens")}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
            >
              <span className="font-medium">
                Allergens ({editedData.allergens.length})
              </span>
              {expandedSections.allergens ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>

            {expandedSections.allergens && (
              <div className="border-t p-3">
                {editedData.allergens.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {editedData.allergens.map((allergen, index) => (
                      <Badge key={index} variant="destructive">
                        {allergen}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No allergens detected</p>
                )}
              </div>
            )}
          </div>

          {/* Certifications */}
          {editedData.certifications.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Certifications</label>
              <div className="flex flex-wrap gap-2">
                {editedData.certifications.map((cert, index) => (
                  <Badge key={index} variant="success">
                    <Check className="w-3 h-3 mr-1" />
                    {cert}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Dietary Attributes Section */}
          {editedData.dietaryAttributes && Object.keys(editedData.dietaryAttributes).length > 0 && (
            <div className="border rounded-lg">
              <button
                onClick={() => toggleSection("dietaryAttributes")}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                <span className="font-medium">
                  Dietary & Quality Attributes
                </span>
                {expandedSections.dietaryAttributes ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {expandedSections.dietaryAttributes && (
                <div className="border-t p-3 space-y-4">
                  {/* Testing & Quality */}
                  <DietaryAttributeGroup
                    title="Testing & Quality"
                    attributes={editedData.dietaryAttributes}
                    keys={["thirdPartyTested", "thirdPartyTesters", "cgmpCertified", "heavyMetalsTested"]}
                  />

                  {/* Dietary Restrictions */}
                  <DietaryAttributeGroup
                    title="Dietary"
                    attributes={editedData.dietaryAttributes}
                    keys={["vegetarian", "vegan", "meatFree", "porkFree", "shellfishFree", "fishFree"]}
                  />

                  {/* Capsule/Gelatin Type */}
                  <DietaryAttributeGroup
                    title="Capsule Type"
                    attributes={editedData.dietaryAttributes}
                    keys={["capsuleType", "gelatinFree", "animalGelatinFree", "usesVegetarianCapsule", "usesFishGelatin", "usesPorkGelatin", "usesBeefGelatin"]}
                  />

                  {/* Religious Certifications */}
                  <DietaryAttributeGroup
                    title="Religious"
                    attributes={editedData.dietaryAttributes}
                    keys={["kosher", "kosherCertifier", "halal", "halalCertifier"]}
                  />

                  {/* Allergen-Free */}
                  <DietaryAttributeGroup
                    title="Allergen-Free"
                    attributes={editedData.dietaryAttributes}
                    keys={["glutenFree", "dairyFree", "soyFree", "nutFree", "eggFree", "cornFree"]}
                  />

                  {/* Other */}
                  <DietaryAttributeGroup
                    title="Other"
                    attributes={editedData.dietaryAttributes}
                    keys={["nonGMO", "organic", "organicCertifier", "sustainablySourced", "pregnancySafe", "nursingSafe", "madeInUSA", "countryOfOrigin"]}
                  />
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {editedData.warnings.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Warnings</label>
              <div className="space-y-1">
                {editedData.warnings.map((warning, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        {/* Footer */}
        <div className="border-t p-4 flex gap-3 shrink-0 bg-gray-50">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(editedData)}
            className="flex-1"
            disabled={!editedData.name || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Supplement
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Helper component for adding other ingredients
function OtherIngredientInput({ onAdd }: { onAdd: (value: string) => void }) {
  const [value, setValue] = useState("");

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value);
      setValue("");
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add other ingredient"
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
      />
      <Button size="sm" onClick={handleAdd} disabled={!value.trim()}>
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}

// Helper component for displaying dietary attribute groups
function DietaryAttributeGroup({
  title,
  attributes,
  keys,
}: {
  title: string;
  attributes: DietaryAttributes;
  keys: (keyof DietaryAttributes)[];
}) {
  // Filter to only show attributes that have values
  const displayedAttributes = keys.filter((key) => {
    const value = attributes[key];
    if (value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });

  if (displayedAttributes.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {displayedAttributes.map((key) => {
          const value = attributes[key];
          const label = formatAttributeName(key);

          // Handle different value types
          if (typeof value === "boolean") {
            return (
              <Badge
                key={key}
                variant={value ? "success" : "secondary"}
                className="text-xs"
              >
                {value ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                {label}
              </Badge>
            );
          }

          if (Array.isArray(value)) {
            return (
              <Badge key={key} variant="outline" className="text-xs">
                {label}: {value.join(", ")}
              </Badge>
            );
          }

          if (typeof value === "string") {
            return (
              <Badge key={key} variant="outline" className="text-xs">
                {label}: {value}
              </Badge>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

export default ScannedSupplementReview;
