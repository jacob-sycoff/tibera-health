// Enhanced supplement types

export type NutrientForm =
  | "d3_cholecalciferol"
  | "d2_ergocalciferol"
  | "methylcobalamin"
  | "cyanocobalamin"
  | "methylfolate"
  | "folic_acid"
  | "ascorbic_acid"
  | "sodium_ascorbate"
  | "citrate"
  | "oxide"
  | "glycinate"
  | "chelated"
  | "picolinate"
  | "sulfate"
  | "gluconate"
  | "carbonate"
  | "bisglycinate"
  | "threonate"
  | "malate"
  | "taurate"
  | "orotate"
  | "ferrous_sulfate"
  | "ferrous_gluconate"
  | "ferrous_bisglycinate"
  | "heme_iron"
  | "retinyl_palmitate"
  | "beta_carotene"
  | "mixed_tocopherols"
  | "d_alpha_tocopherol"
  | "dl_alpha_tocopherol"
  | "k1_phylloquinone"
  | "k2_mk4"
  | "k2_mk7"
  | "thiamine_hcl"
  | "benfotiamine"
  | "riboflavin"
  | "riboflavin_5_phosphate"
  | "niacinamide"
  | "nicotinic_acid"
  | "pyridoxine_hcl"
  | "pyridoxal_5_phosphate"
  | "other"
  | "unknown";

export type NutrientSource =
  | "synthetic"
  | "natural"
  | "fermented"
  | "whole_food"
  | "algae"
  | "fish"
  | "plant"
  | "animal"
  | "mineral"
  | "yeast"
  | "bacterial"
  | "unknown";

export interface SupplementIngredient {
  nutrientId: string;
  nutrientName: string;
  amount: number;
  unit: string;
  dailyValuePercent?: number;
  form?: NutrientForm;
  source?: NutrientSource;
  notes?: string;
}

export interface DetailedSupplement {
  id: string;
  name: string;
  brand?: string;
  type: "multivitamin" | "single" | "mineral" | "herbal" | "amino" | "probiotic" | "omega" | "other";
  servingSize: string;
  servingsPerContainer?: number;
  ingredients: SupplementIngredient[];
  otherIngredients?: string[];
  allergens?: string[];
  certifications?: string[];
  imageUrl?: string;
  productUrl?: string;
  barcode?: string;
  isVerified: boolean;
  createdBy: "system" | "user" | "ai";
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplementDatabase {
  supplements: DetailedSupplement[];
  lastUpdated: Date;
}

// Form labels for display
export const FORM_LABELS: Record<NutrientForm, string> = {
  d3_cholecalciferol: "D3 (Cholecalciferol)",
  d2_ergocalciferol: "D2 (Ergocalciferol)",
  methylcobalamin: "Methylcobalamin",
  cyanocobalamin: "Cyanocobalamin",
  methylfolate: "Methylfolate (5-MTHF)",
  folic_acid: "Folic Acid",
  ascorbic_acid: "Ascorbic Acid",
  sodium_ascorbate: "Sodium Ascorbate",
  citrate: "Citrate",
  oxide: "Oxide",
  glycinate: "Glycinate",
  chelated: "Chelated",
  picolinate: "Picolinate",
  sulfate: "Sulfate",
  gluconate: "Gluconate",
  carbonate: "Carbonate",
  bisglycinate: "Bisglycinate",
  threonate: "Threonate",
  malate: "Malate",
  taurate: "Taurate",
  orotate: "Orotate",
  ferrous_sulfate: "Ferrous Sulfate",
  ferrous_gluconate: "Ferrous Gluconate",
  ferrous_bisglycinate: "Ferrous Bisglycinate",
  heme_iron: "Heme Iron",
  retinyl_palmitate: "Retinyl Palmitate",
  beta_carotene: "Beta-Carotene",
  mixed_tocopherols: "Mixed Tocopherols",
  d_alpha_tocopherol: "d-Alpha Tocopherol",
  dl_alpha_tocopherol: "dl-Alpha Tocopherol",
  k1_phylloquinone: "K1 (Phylloquinone)",
  k2_mk4: "K2 (MK-4)",
  k2_mk7: "K2 (MK-7)",
  thiamine_hcl: "Thiamine HCl",
  benfotiamine: "Benfotiamine",
  riboflavin: "Riboflavin",
  riboflavin_5_phosphate: "Riboflavin 5'-Phosphate",
  niacinamide: "Niacinamide",
  nicotinic_acid: "Nicotinic Acid",
  pyridoxine_hcl: "Pyridoxine HCl",
  pyridoxal_5_phosphate: "Pyridoxal 5'-Phosphate (P5P)",
  other: "Other",
  unknown: "Unknown",
};

export const SOURCE_LABELS: Record<NutrientSource, string> = {
  synthetic: "Synthetic",
  natural: "Natural",
  fermented: "Fermented",
  whole_food: "Whole Food",
  algae: "Algae-derived",
  fish: "Fish-derived",
  plant: "Plant-derived",
  animal: "Animal-derived",
  mineral: "Mineral",
  yeast: "Yeast-derived",
  bacterial: "Bacterial",
  unknown: "Unknown",
};
