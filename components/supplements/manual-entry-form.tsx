"use client";

import { useState } from "react";
import { Plus, X, Loader2, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateUserSupplement } from "@/lib/hooks";
import { useToast } from "@/components/ui/toast";
import {
  FORM_LABELS,
  SOURCE_LABELS,
  type NutrientForm,
  type NutrientSource,
} from "@/types/supplements";

// Supplement type options
const SUPPLEMENT_TYPES = [
  { value: "multivitamin", label: "Multivitamin" },
  { value: "single", label: "Single Nutrient" },
  { value: "mineral", label: "Mineral" },
  { value: "herbal", label: "Herbal" },
  { value: "amino", label: "Amino Acid" },
  { value: "probiotic", label: "Probiotic" },
  { value: "omega", label: "Omega/Fish Oil" },
  { value: "other", label: "Other" },
];

// Unit options
const UNIT_OPTIONS = ["mg", "mcg", "g", "IU", "CFU", "billion CFU"];

// Form options for dropdown
const FORM_OPTIONS = Object.entries(FORM_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// Source options for dropdown
const SOURCE_OPTIONS = Object.entries(SOURCE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

type YesNoUnknown = "yes" | "no" | "unknown";
type OmegaOilForm =
  | "fish_oil"
  | "algal_oil"
  | "krill_oil"
  | "flaxseed_oil"
  | "other"
  | "unknown";

type OmegaSource = "fish" | "algae" | "plant" | "unknown";
type GelatinType = "animal" | "fish" | "plant" | "none" | "unknown";
type PregnancySafety = "generally_safe" | "caution" | "avoid" | "unknown";

interface Ingredient {
  nutrientName: string;
  amount: number;
  unit: string;
  dailyValuePercent: number | null;
  form: NutrientForm;
  source: NutrientSource;
  notes: string;
}

interface ManualEntryFormProps {
  onSuccess?: () => void;
}

export function ManualEntryForm({ onSuccess }: ManualEntryFormProps) {
  // Supplement metadata
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [type, setType] = useState("other");
  const [servingSize, setServingSize] = useState("");
  const [servingsPerContainer, setServingsPerContainer] = useState("");
  const [otherIngredients, setOtherIngredients] = useState("");
  const [allergens, setAllergens] = useState("");
  const [certifications, setCertifications] = useState("");

  // Optional omega-3 metadata (used by research filters)
  const [omegaOilForm, setOmegaOilForm] = useState<OmegaOilForm>("unknown");
  const [omegaSource, setOmegaSource] = useState<OmegaSource>("unknown");
  const [omegaGelatin, setOmegaGelatin] = useState<GelatinType>("unknown");
  const [omegaThirdPartyTested, setOmegaThirdPartyTested] =
    useState<YesNoUnknown>("unknown");
  const [omegaHeavyMetalsTested, setOmegaHeavyMetalsTested] =
    useState<YesNoUnknown>("unknown");
  const [omegaPregnancySafety, setOmegaPregnancySafety] =
    useState<PregnancySafety>("unknown");

  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    {
      nutrientName: "",
      amount: 0,
      unit: "mg",
      dailyValuePercent: null,
      form: "unknown",
      source: "unknown",
      notes: "",
    },
  ]);

  // UI state
  const [expandedIngredient, setExpandedIngredient] = useState<number | null>(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const createSupplement = useCreateUserSupplement();
  const toast = useToast();

  const addIngredient = () => {
    setIngredients([
      ...ingredients,
      {
        nutrientName: "",
        amount: 0,
        unit: "mg",
        dailyValuePercent: null,
        form: "unknown",
        source: "unknown",
        notes: "",
      },
    ]);
    setExpandedIngredient(ingredients.length);
  };

  const updateIngredient = (
    index: number,
    field: keyof Ingredient,
    value: string | number | null
  ) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
      if (expandedIngredient === index) {
        setExpandedIngredient(null);
      } else if (expandedIngredient !== null && expandedIngredient > index) {
        setExpandedIngredient(expandedIngredient - 1);
      }
    }
  };

  const handleSubmit = () => {
    if (!name || !servingSize) return;

    // Parse comma-separated fields into arrays
    const parseList = (str: string): string[] =>
      str
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    const omega3Attributes =
      type === "omega"
        ? {
            omega3: {
              oilForm: omegaOilForm,
              source: omegaSource,
              gelatin: omegaGelatin,
              thirdPartyTested: omegaThirdPartyTested,
              heavyMetalsTested: omegaHeavyMetalsTested,
              pregnancySafety: omegaPregnancySafety,
            },
          }
        : undefined;

    const supplementName = brand ? `${brand} ${name}` : name;

    createSupplement.mutate(
      {
        name,
        brand: brand || undefined,
        type,
        serving_size: servingSize,
        servings_per_container: servingsPerContainer
          ? parseInt(servingsPerContainer)
          : undefined,
        other_ingredients: parseList(otherIngredients),
        allergens: parseList(allergens),
        certifications: parseList(certifications),
        attributes: omega3Attributes,
        ingredients: ingredients
          .filter((i) => i.nutrientName.trim())
          .map((i) => ({
            nutrient_name: i.nutrientName,
            amount: i.amount,
            unit: i.unit,
            daily_value_percent: i.dailyValuePercent ?? undefined,
            form: i.form,
            source: i.source,
            notes: i.notes || undefined,
          })),
      },
      {
        onSuccess: () => {
          // Show success toast
          toast.success(`${supplementName} added to your database`);

          // Reset form
          setName("");
          setBrand("");
          setType("other");
          setServingSize("");
          setServingsPerContainer("");
          setOtherIngredients("");
          setAllergens("");
          setCertifications("");
          setOmegaOilForm("unknown");
          setOmegaSource("unknown");
          setOmegaGelatin("unknown");
          setOmegaThirdPartyTested("unknown");
          setOmegaHeavyMetalsTested("unknown");
          setOmegaPregnancySafety("unknown");
          setIngredients([
            {
              nutrientName: "",
              amount: 0,
              unit: "mg",
              dailyValuePercent: null,
              form: "unknown",
              source: "unknown",
              notes: "",
            },
          ]);
          setExpandedIngredient(0);
          setShowAdvanced(false);
          onSuccess?.();
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to add supplement. Please try again."
          );
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">
            Supplement Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Vitamin D3"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Brand</label>
          <Input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g., NOW Foods"
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
          >
            {SUPPLEMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">
            Serving Size <span className="text-red-500">*</span>
          </label>
          <Input
            value={servingSize}
            onChange={(e) => setServingSize(e.target.value)}
            placeholder="e.g., 1 softgel"
            className="mt-1"
          />
        </div>
      </div>

      {type === "omega" && (
        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">
              Omega-3 details (optional)
            </p>
            <p className="text-xs text-gray-500">
              Used by research filters
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Oil form</label>
              <select
                value={omegaOilForm}
                onChange={(e) => setOmegaOilForm(e.target.value as OmegaOilForm)}
                className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="unknown">Unknown</option>
                <option value="fish_oil">Fish oil</option>
                <option value="algal_oil">Algal oil</option>
                <option value="krill_oil">Krill oil</option>
                <option value="flaxseed_oil">Flaxseed oil (ALA)</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Source</label>
              <select
                value={omegaSource}
                onChange={(e) => setOmegaSource(e.target.value as OmegaSource)}
                className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="unknown">Unknown</option>
                <option value="fish">Fish</option>
                <option value="algae">Algae</option>
                <option value="plant">Plant</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Gelatin / capsule</label>
              <select
                value={omegaGelatin}
                onChange={(e) => setOmegaGelatin(e.target.value as GelatinType)}
                className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="unknown">Unknown</option>
                <option value="animal">Animal gelatin</option>
                <option value="fish">Fish gelatin</option>
                <option value="plant">Plant-based</option>
                <option value="none">No gelatin</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Pregnancy safety</label>
              <select
                value={omegaPregnancySafety}
                onChange={(e) =>
                  setOmegaPregnancySafety(e.target.value as PregnancySafety)
                }
                className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="unknown">Unknown</option>
                <option value="generally_safe">Generally safe</option>
                <option value="caution">Use caution</option>
                <option value="avoid">Avoid</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Third-party tested</label>
              <select
                value={omegaThirdPartyTested}
                onChange={(e) =>
                  setOmegaThirdPartyTested(e.target.value as YesNoUnknown)
                }
                className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Heavy metals tested</label>
              <select
                value={omegaHeavyMetalsTested}
                onChange={(e) =>
                  setOmegaHeavyMetalsTested(e.target.value as YesNoUnknown)
                }
                className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Ingredients Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Ingredients</label>
          <Button variant="ghost" size="sm" onClick={addIngredient}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>

        <div className="space-y-2">
          {ingredients.map((ingredient, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* Ingredient Header */}
              <div
                className="flex items-center justify-between p-3 bg-gray-100/50 cursor-pointer"
                onClick={() =>
                  setExpandedIngredient(expandedIngredient === idx ? null : idx)
                }
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">
                    {ingredient.nutrientName || `Ingredient ${idx + 1}`}
                  </span>
                  {ingredient.amount > 0 && (
                    <span className="text-xs text-gray-500">
                      {ingredient.amount} {ingredient.unit}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {ingredients.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeIngredient(idx);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                  {expandedIngredient === idx ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedIngredient === idx && (
                <div className="p-3 space-y-3 border-t border-gray-200">
                  {/* Row 1: Name, Amount, Unit */}
                  <div className="grid grid-cols-6 gap-2">
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500">Name</label>
                      <Input
                        placeholder="e.g., Vitamin D3"
                        value={ingredient.nutrientName}
                        onChange={(e) =>
                          updateIngredient(idx, "nutrientName", e.target.value)
                        }
                        className="mt-1"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Amount</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={ingredient.amount || ""}
                        onChange={(e) =>
                          updateIngredient(
                            idx,
                            "amount",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Unit</label>
                      <select
                        value={ingredient.unit}
                        onChange={(e) =>
                          updateIngredient(idx, "unit", e.target.value)
                        }
                        className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-2 text-sm"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Daily Value %, Form, Source */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">% DV</label>
                      <Input
                        type="number"
                        placeholder="e.g., 100"
                        value={ingredient.dailyValuePercent ?? ""}
                        onChange={(e) =>
                          updateIngredient(
                            idx,
                            "dailyValuePercent",
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Form</label>
                      <select
                        value={ingredient.form}
                        onChange={(e) =>
                          updateIngredient(
                            idx,
                            "form",
                            e.target.value as NutrientForm
                          )
                        }
                        className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-2 text-sm"
                      >
                        {FORM_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Source</label>
                      <select
                        value={ingredient.source}
                        onChange={(e) =>
                          updateIngredient(
                            idx,
                            "source",
                            e.target.value as NutrientSource
                          )
                        }
                        className="mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-2 text-sm"
                      >
                        {SOURCE_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Notes */}
                  <div>
                    <label className="text-xs text-gray-500">
                      Notes (optional)
                    </label>
                    <Input
                      placeholder="e.g., as cholecalciferol from lichen"
                      value={ingredient.notes}
                      onChange={(e) =>
                        updateIngredient(idx, "notes", e.target.value)
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        {showAdvanced ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        Advanced Options
      </button>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="space-y-3 p-3 bg-gray-100/50 rounded-lg">
          <div>
            <label className="text-sm font-medium">Servings Per Container</label>
            <Input
              type="number"
              value={servingsPerContainer}
              onChange={(e) => setServingsPerContainer(e.target.value)}
              placeholder="e.g., 60"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              Other Ingredients{" "}
              <span className="text-xs text-gray-500">(comma-separated)</span>
            </label>
            <Input
              value={otherIngredients}
              onChange={(e) => setOtherIngredients(e.target.value)}
              placeholder="e.g., cellulose, silicon dioxide"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              Allergens{" "}
              <span className="text-xs text-gray-500">(comma-separated)</span>
            </label>
            <Input
              value={allergens}
              onChange={(e) => setAllergens(e.target.value)}
              placeholder="e.g., soy, fish"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              Certifications{" "}
              <span className="text-xs text-gray-500">(comma-separated)</span>
            </label>
            <Input
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              placeholder="e.g., NSF Certified, GMP"
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={!name || !servingSize || createSupplement.isPending}
      >
        {createSupplement.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Plus className="w-4 h-4 mr-2" />
        )}
        Add Supplement
      </Button>
    </div>
  );
}
