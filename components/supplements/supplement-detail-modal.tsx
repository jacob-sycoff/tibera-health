"use client";

import React from "react";
import { X, Plus, Check, Shield, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  supplement_ingredients: SupplementIngredient[];
}

// Helper to get category label
function getCategoryLabel(type: string): string {
  const category = SUPPLEMENT_CATEGORIES.find((c) => c.value === type);
  return category?.label || type;
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
  // Group attributes by category
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

interface SupplementDetailModalProps {
  supplement: Supplement;
  onClose: () => void;
  onLog: () => void;
  isLogging: boolean;
}

export function SupplementDetailModal({
  supplement,
  onClose,
  onLog,
  isLogging,
}: SupplementDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center z-50 animate-fade-in">
      <Card className="w-full max-w-lg mx-4 mb-4 lg:mb-0 max-h-[85vh] overflow-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              {supplement.brand && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {supplement.brand}
                </p>
              )}
              <CardTitle>{supplement.name}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {/* Log Button */}
          <Button className="w-full" disabled={isLogging} onClick={onLog}>
            {isLogging ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Log This Supplement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
