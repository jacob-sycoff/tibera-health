import type { DatabaseSupplement } from "@/lib/supabase/queries/reference";

export type YesNoUnknown = "yes" | "no" | "unknown";

export type OmegaOilForm =
  | "fish_oil"
  | "algal_oil"
  | "krill_oil"
  | "flaxseed_oil"
  | "other"
  | "unknown";

export type OmegaSource = "fish" | "algae" | "plant" | "unknown";
export type GelatinType = "animal" | "fish" | "plant" | "none" | "unknown";
export type PregnancySafety = "generally_safe" | "caution" | "avoid" | "unknown";

export interface Omega3Attributes {
  oilForm?: OmegaOilForm;
  source?: OmegaSource;
  gelatin?: GelatinType;
  thirdPartyTested?: YesNoUnknown;
  heavyMetalsTested?: YesNoUnknown;
  pregnancySafety?: PregnancySafety;
}

export interface Omega3Metrics {
  epaMg: number | null;
  dhaMg: number | null;
  dpaMg: number | null;
  alaMg: number | null;
  epaPlusDhaMg: number | null;
  epaToDhaRatio: number | null;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s\-\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toMg(amount: number, unit: string): number | null {
  const normalizedUnit = normalizeText(unit);
  if (Number.isNaN(amount)) return null;

  if (normalizedUnit.startsWith("mg")) return amount;
  if (normalizedUnit === "g" || normalizedUnit.startsWith("gram")) return amount * 1000;
  if (normalizedUnit.startsWith("mcg") || normalizedUnit.startsWith("ug")) return amount / 1000;

  return null;
}

function ingredientMatchesOmegaKey(ingredientName: string, key: "epa" | "dha" | "dpa" | "ala"): boolean {
  const name = normalizeText(ingredientName);
  if (key === "epa") return /\bepa\b/.test(name) || /eicosapentaenoic/.test(name);
  if (key === "dha") return /\bdha\b/.test(name) || /docosahexaenoic/.test(name);
  if (key === "dpa") return /\bdpa\b/.test(name) || /docosapentaenoic/.test(name);
  return /\bala\b/.test(name) || /alpha[\s\-]?linolenic/.test(name);
}

export function getOmega3Metrics(supplement: DatabaseSupplement): Omega3Metrics {
  let epa = 0;
  let dha = 0;
  let dpa = 0;
  let ala = 0;

  let hasEpa = false;
  let hasDha = false;
  let hasDpa = false;
  let hasAla = false;

  for (const ingredient of supplement.supplement_ingredients ?? []) {
    const amountMg = toMg(Number(ingredient.amount), ingredient.unit);
    if (amountMg == null) continue;

    if (ingredientMatchesOmegaKey(ingredient.nutrient_name, "epa")) {
      epa += amountMg;
      hasEpa = true;
      continue;
    }
    if (ingredientMatchesOmegaKey(ingredient.nutrient_name, "dha")) {
      dha += amountMg;
      hasDha = true;
      continue;
    }
    if (ingredientMatchesOmegaKey(ingredient.nutrient_name, "dpa")) {
      dpa += amountMg;
      hasDpa = true;
      continue;
    }
    if (ingredientMatchesOmegaKey(ingredient.nutrient_name, "ala")) {
      ala += amountMg;
      hasAla = true;
      continue;
    }
  }

  const epaMg = hasEpa ? epa : null;
  const dhaMg = hasDha ? dha : null;
  const dpaMg = hasDpa ? dpa : null;
  const alaMg = hasAla ? ala : null;

  const epaPlusDhaMg =
    (epaMg ?? 0) + (dhaMg ?? 0) > 0 ? (epaMg ?? 0) + (dhaMg ?? 0) : null;

  const epaToDhaRatio =
    epaMg != null && dhaMg != null && dhaMg > 0 ? epaMg / dhaMg : null;

  return {
    epaMg,
    dhaMg,
    dpaMg,
    alaMg,
    epaPlusDhaMg,
    epaToDhaRatio,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getOmega3Attributes(supplement: DatabaseSupplement): Omega3Attributes {
  const rawAttributes = supplement.attributes;
  if (!isRecord(rawAttributes)) return {};

  const omega3 = rawAttributes.omega3;
  if (!isRecord(omega3)) return {};

  const getString = (key: string): string | undefined => {
    const value = omega3[key];
    return typeof value === "string" ? value : undefined;
  };

  return {
    oilForm: getString("oilForm") as OmegaOilForm | undefined,
    source: getString("source") as OmegaSource | undefined,
    gelatin: getString("gelatin") as GelatinType | undefined,
    thirdPartyTested: getString("thirdPartyTested") as YesNoUnknown | undefined,
    heavyMetalsTested: getString("heavyMetalsTested") as YesNoUnknown | undefined,
    pregnancySafety: getString("pregnancySafety") as PregnancySafety | undefined,
  };
}

export function supplementLooksLikeOmega3(supplement: DatabaseSupplement): boolean {
  if (supplement.type === "omega") return true;
  const metrics = getOmega3Metrics(supplement);
  return (
    metrics.epaMg != null ||
    metrics.dhaMg != null ||
    metrics.dpaMg != null ||
    metrics.alaMg != null
  );
}

