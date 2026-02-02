"use client";

import React, { useState } from "react";
import { X, Plus, Check, Shield, Loader2, AlertTriangle, Pencil, Trash2, PenLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { IngredientList } from "./ingredient-list";
import { SUPPLEMENT_CATEGORIES } from "@/lib/api/supplement-scanner";

interface SupplementIngredient {
  id: string;
  nutrient_name: string;
  amount: number;
  unit: string;
  daily_value_percent: number | null;
  form: string | null;
  source: string | null;
  notes: string | null;
}

interface EditableIngredient {
  nutrient_name: string;
  amount: number;
  unit: string;
  daily_value_percent: number | null;
  form: string;
}

interface DietaryAttributes {
  thirdPartyTested?: boolean;
  thirdPartyTesters?: string[];
  cgmpCertified?: boolean;
  heavyMetalsTested?: boolean;
  vegetarian?: boolean;
  vegan?: boolean;
  meatFree?: boolean;
  porkFree?: boolean;
  shellfishFree?: boolean;
  fishFree?: boolean;
  gelatinFree?: boolean;
  animalGelatinFree?: boolean;
  usesVegetarianCapsule?: boolean;
  usesFishGelatin?: boolean;
  usesPorkGelatin?: boolean;
  usesBeefGelatin?: boolean;
  capsuleType?: string;
  kosher?: boolean;
  kosherCertifier?: string;
  halal?: boolean;
  halalCertifier?: string;
  glutenFree?: boolean;
  dairyFree?: boolean;
  soyFree?: boolean;
  nutFree?: boolean;
  eggFree?: boolean;
  cornFree?: boolean;
  nonGMO?: boolean;
  organic?: boolean;
  organicCertifier?: string;
  sustainablySourced?: boolean;
  pregnancySafe?: boolean;
  nursingSafe?: boolean;
  madeInUSA?: boolean;
  countryOfOrigin?: string;
}

interface Supplement {
  id: string;
  name: string;
  brand: string | null;
  type: string;
  serving_size: string | null;
  servings_per_container: number | null;
  other_ingredients: string[] | null;
  allergens: string[] | null;
  certifications: string[] | null;
  attributes?: DietaryAttributes | null;
  is_verified: boolean;
  user_edited?: boolean;
  supplement_ingredients: SupplementIngredient[];
}

// Helper to format attribute names
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

// Dietary attributes display component
function DietaryAttributesSection({ attributes }: { attributes: DietaryAttributes }) {
  const groups = {
    "Testing & Quality": ["thirdPartyTested", "thirdPartyTesters", "cgmpCertified", "heavyMetalsTested"],
    "Dietary": ["vegetarian", "vegan", "meatFree", "porkFree", "shellfishFree", "fishFree"],
    "Capsule Type": ["gelatinFree", "animalGelatinFree", "usesVegetarianCapsule", "usesFishGelatin", "usesPorkGelatin", "usesBeefGelatin", "capsuleType"],
    "Religious": ["kosher", "kosherCertifier", "halal", "halalCertifier"],
    "Allergen-Free": ["glutenFree", "dairyFree", "soyFree", "nutFree", "eggFree", "cornFree"],
    "Other": ["nonGMO", "organic", "organicCertifier", "sustainablySourced", "pregnancySafe", "nursingSafe", "madeInUSA", "countryOfOrigin"],
  };

  const renderValue = (key: string, value: unknown): React.ReactNode => {
    if (value === true) return <Check className="w-4 h-4 text-green-500" />;
    if (value === false) return <X className="w-4 h-4 text-slate-400" />;
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  };

  const hasAnyInGroup = (groupKeys: string[]) => {
    return groupKeys.some(key => {
      const value = attributes[key as keyof DietaryAttributes];
      return value !== undefined && value !== null && value !== false &&
             !(Array.isArray(value) && value.length === 0);
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Dietary & Quality Attributes</h3>
      {Object.entries(groups).map(([groupName, keys]) => {
        if (!hasAnyInGroup(keys)) return null;

        return (
          <div key={groupName} className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
            <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
              {groupName}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {keys.map(key => {
                const value = attributes[key as keyof DietaryAttributes];
                if (value === undefined || value === null ||
                    (typeof value === 'boolean' && !value) ||
                    (Array.isArray(value) && value.length === 0)) {
                  return null;
                }
                return (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      {formatAttributeName(key)}
                    </span>
                    <span className="font-medium">
                      {renderValue(key, value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface SupplementDetailModalProps {
  supplement: Supplement;
  onClose: () => void;
  onLog: () => void;
  isLogging: boolean;
  onSave?: (data: {
    name: string;
    brand?: string;
    type: string;
    serving_size: string;
    servings_per_container?: number;
    other_ingredients?: string[];
    allergens?: string[];
    certifications?: string[];
    attributes?: Record<string, unknown>;
    ingredients: Array<{
      nutrient_name: string;
      amount: number;
      unit: string;
      daily_value_percent?: number;
      form?: string;
    }>;
  }) => void;
  onDelete?: () => void;
  isSaving?: boolean;
  isDeleting?: boolean;
}

export function SupplementDetailModal({
  supplement,
  onClose,
  onLog,
  isLogging,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: SupplementDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Editable form state
  const [name, setName] = useState(supplement.name);
  const [brand, setBrand] = useState(supplement.brand ?? "");
  const [type, setType] = useState(supplement.type);
  const [servingSize, setServingSize] = useState(supplement.serving_size ?? "");
  const [servingsPerContainer, setServingsPerContainer] = useState(
    supplement.servings_per_container?.toString() ?? ""
  );
  const [ingredients, setIngredients] = useState<EditableIngredient[]>(
    (supplement.supplement_ingredients || []).map((ing) => ({
      nutrient_name: ing.nutrient_name,
      amount: ing.amount,
      unit: ing.unit,
      daily_value_percent: ing.daily_value_percent,
      form: ing.form ?? "",
    }))
  );
  const [otherIngredients, setOtherIngredients] = useState(
    (supplement.other_ingredients ?? []).join(", ")
  );
  const [allergens, setAllergens] = useState(
    (supplement.allergens ?? []).join(", ")
  );
  const [certifications, setCertifications] = useState(
    (supplement.certifications ?? []).join(", ")
  );

  const handleStartEdit = () => {
    // Reset form to current supplement values
    setName(supplement.name);
    setBrand(supplement.brand ?? "");
    setType(supplement.type);
    setServingSize(supplement.serving_size ?? "");
    setServingsPerContainer(supplement.servings_per_container?.toString() ?? "");
    setIngredients(
      (supplement.supplement_ingredients || []).map((ing) => ({
        nutrient_name: ing.nutrient_name,
        amount: ing.amount,
        unit: ing.unit,
        daily_value_percent: ing.daily_value_percent,
        form: ing.form ?? "",
      }))
    );
    setOtherIngredients((supplement.other_ingredients ?? []).join(", "));
    setAllergens((supplement.allergens ?? []).join(", "));
    setCertifications((supplement.certifications ?? []).join(", "));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!onSave) return;

    const parseCommaSeparated = (s: string) =>
      s.split(",").map((v) => v.trim()).filter(Boolean);

    onSave({
      name: name.trim(),
      brand: brand.trim() || undefined,
      type,
      serving_size: servingSize.trim() || "1 serving",
      servings_per_container: servingsPerContainer ? Number(servingsPerContainer) : undefined,
      other_ingredients: otherIngredients.trim() ? parseCommaSeparated(otherIngredients) : undefined,
      allergens: allergens.trim() ? parseCommaSeparated(allergens) : undefined,
      certifications: certifications.trim() ? parseCommaSeparated(certifications) : undefined,
      attributes: (supplement.attributes ?? {}) as Record<string, unknown>,
      ingredients: ingredients.map((ing) => ({
        nutrient_name: ing.nutrient_name,
        amount: ing.amount,
        unit: ing.unit,
        daily_value_percent: ing.daily_value_percent ?? undefined,
        form: ing.form || undefined,
      })),
    });
  };

  const updateIngredient = (index: number, field: keyof EditableIngredient, value: string | number | null) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing))
    );
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const addIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      { nutrient_name: "", amount: 0, unit: "mg", daily_value_percent: null, form: "" },
    ]);
  };

  const inputClasses =
    "w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center z-50 animate-fade-in">
      <Card className="w-full max-w-lg mx-4 mb-4 lg:mb-0 max-h-[85vh] overflow-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Brand (optional)"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Supplement name"
                    className="h-9 font-semibold"
                  />
                </div>
              ) : (
                <>
                  {supplement.brand && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {supplement.brand}
                    </p>
                  )}
                  <CardTitle>{supplement.name}</CardTitle>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              {!isEditing && onSave && (
                <Button variant="ghost" size="icon" onClick={handleStartEdit}>
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            /* ===== EDIT MODE ===== */
            <>
              {/* Type + Serving Size */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className={inputClasses}
                  >
                    {SUPPLEMENT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                    Serving Size
                  </label>
                  <Input
                    value={servingSize}
                    onChange={(e) => setServingSize(e.target.value)}
                    placeholder="e.g. 1 capsule"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                  Servings Per Container
                </label>
                <Input
                  type="number"
                  value={servingsPerContainer}
                  onChange={(e) => setServingsPerContainer(e.target.value)}
                  placeholder="e.g. 60"
                  className="h-8 text-sm w-32"
                />
              </div>

              {/* Editable Ingredients */}
              <div>
                <h3 className="font-medium mb-2">
                  Ingredients ({ingredients.length})
                </h3>
                <div className="space-y-2">
                  {ingredients.map((ing, idx) => (
                    <div
                      key={idx}
                      className="border rounded-lg p-2 bg-slate-50 dark:bg-slate-800/50 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          value={ing.nutrient_name}
                          onChange={(e) => updateIngredient(idx, "nutrient_name", e.target.value)}
                          placeholder="Nutrient name"
                          className="h-7 text-sm flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-500 shrink-0"
                          onClick={() => removeIngredient(idx)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <Input
                          type="number"
                          value={ing.amount}
                          onChange={(e) => updateIngredient(idx, "amount", Number(e.target.value))}
                          placeholder="Amount"
                          className="h-7 text-xs"
                        />
                        <Input
                          value={ing.unit}
                          onChange={(e) => updateIngredient(idx, "unit", e.target.value)}
                          placeholder="Unit"
                          className="h-7 text-xs"
                        />
                        <Input
                          type="number"
                          value={ing.daily_value_percent ?? ""}
                          onChange={(e) =>
                            updateIngredient(
                              idx,
                              "daily_value_percent",
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          placeholder="% DV"
                          className="h-7 text-xs"
                        />
                        <Input
                          value={ing.form}
                          onChange={(e) => updateIngredient(idx, "form", e.target.value)}
                          placeholder="Form"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={addIngredient}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Ingredient
                  </Button>
                </div>
              </div>

              {/* Other Ingredients */}
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                  Other Ingredients (comma-separated)
                </label>
                <textarea
                  value={otherIngredients}
                  onChange={(e) => setOtherIngredients(e.target.value)}
                  rows={2}
                  className={inputClasses}
                  placeholder="e.g. Gelatin capsule, Rice flour, Magnesium stearate"
                />
              </div>

              {/* Allergens */}
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                  Allergens (comma-separated)
                </label>
                <textarea
                  value={allergens}
                  onChange={(e) => setAllergens(e.target.value)}
                  rows={2}
                  className={inputClasses}
                  placeholder="e.g. Fish, Soy, Tree nuts"
                />
              </div>

              {/* Certifications */}
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                  Certifications (comma-separated)
                </label>
                <textarea
                  value={certifications}
                  onChange={(e) => setCertifications(e.target.value)}
                  rows={2}
                  className={inputClasses}
                  placeholder="e.g. NSF Certified, GMP, Non-GMO Project Verified"
                />
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!name.trim() || isSaving}
                  onClick={handleSave}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            /* ===== VIEW MODE ===== */
            <>
              {/* Metadata */}
              <div className="flex flex-wrap gap-2">
                <Badge>{supplement.type}</Badge>
                <Badge variant="outline">{supplement.serving_size}</Badge>
                {supplement.is_verified && (
                  <Badge variant="secondary">
                    <Check className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
                {supplement.user_edited && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                    <PenLine className="w-3 h-3 mr-1" />
                    Edited
                  </Badge>
                )}
              </div>

              {/* Ingredients */}
              <div>
                <h3 className="font-medium mb-2">
                  Supplement Facts ({supplement.supplement_ingredients?.length || 0} nutrients)
                </h3>
                <IngredientList
                  ingredients={supplement.supplement_ingredients || []}
                  showDetails
                />
              </div>

              {/* Other Ingredients */}
              {supplement.other_ingredients && supplement.other_ingredients.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Other Ingredients</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {supplement.other_ingredients.join(", ")}
                  </p>
                </div>
              )}

              {/* Allergens */}
              {supplement.allergens && supplement.allergens.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Allergen Warnings
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {supplement.allergens.map((allergen) => (
                      <Badge key={allergen} variant="destructive">
                        {allergen}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications */}
              {supplement.certifications && supplement.certifications.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Certifications</h3>
                  <div className="flex flex-wrap gap-2">
                    {supplement.certifications.map((cert) => (
                      <Badge key={cert} variant="outline">
                        <Shield className="w-3 h-3 mr-1" />
                        {cert}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Dietary Attributes */}
              {supplement.attributes && Object.keys(supplement.attributes).length > 0 && (
                <DietaryAttributesSection attributes={supplement.attributes} />
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button className="w-full" disabled={isLogging} onClick={onLog}>
                  {isLogging ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Log This Supplement
                </Button>

                {onDelete && (
                  <>
                    {showDeleteConfirm ? (
                      <div className="border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50 dark:bg-red-950/30">
                        <p className="text-sm text-red-700 dark:text-red-400 mb-2">
                          Are you sure? This cannot be undone.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1"
                            disabled={isDeleting}
                            onClick={onDelete}
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 mr-1" />
                            )}
                            Confirm Delete
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled={isDeleting}
                            onClick={() => setShowDeleteConfirm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Supplement
                      </Button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
