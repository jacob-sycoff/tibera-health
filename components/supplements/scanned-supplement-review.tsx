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
import type { ScannedSupplement, ScannedIngredient } from "@/lib/api/supplement-scanner";
import { cn } from "@/lib/utils/cn";

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
  const [editedData, setEditedData] = useState<ScannedSupplement>(data);
  const [expandedSections, setExpandedSections] = useState({
    ingredients: true,
    otherIngredients: false,
    allergens: false,
    warnings: false,
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

            <div>
              <label className="text-sm font-medium">Servings Per Container</label>
              <Input
                type="number"
                value={editedData.servingsPerContainer || ""}
                onChange={(e) =>
                  updateField("servingsPerContainer", e.target.value ? parseInt(e.target.value) : null)
                }
                placeholder="Number of servings"
                className="mt-1 w-40"
              />
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

export default ScannedSupplementReview;
