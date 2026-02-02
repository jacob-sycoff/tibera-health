export const OZ_TO_G = 28.349523125;

export function gramsFromAmount(amount: number | null, unit: "g" | "oz"): number | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  return unit === "oz" ? amount * OZ_TO_G : amount;
}

export function amountFromGrams(grams: number | null, unit: "g" | "oz"): number | null {
  if (grams == null || !Number.isFinite(grams) || grams <= 0) return null;
  return unit === "oz" ? grams / OZ_TO_G : grams;
}

export function roundTo1Decimal(value: number): number {
  return Math.round(value * 10) / 10;
}

