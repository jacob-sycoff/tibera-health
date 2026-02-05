"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Mic, Send, Sparkles, X, Volume2, MessageSquare, Utensils, Activity, Pill, Moon, ShoppingCart, Trash2 } from "lucide-react";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import { conversationV3, type AssistantV3Response } from "@/lib/api/assistant-v3";
import { classifyIntent } from "@/lib/api/classify-intent";
import { getFoodDetails, smartSearchFoods } from "@/lib/api/usda";
import { rerankUsdaCandidates } from "@/lib/api/usda-rerank";
import { localDateISO } from "@/lib/utils/dates";
import { OZ_TO_G, amountFromGrams, gramsFromAmount, roundTo1Decimal } from "@/lib/utils/units";
import { FoodSearch } from "@/components/food/food-search";
import { events } from "@/lib/events/client";
import { getFoodResolutionOverride, getMealLogById, upsertFoodResolutionOverride } from "@/lib/supabase/queries";
import { insertFoodMatchAudit } from "@/lib/supabase/queries";
import {
  useCreateCustomSymptom,
  useCreateMealLog,
  useAddMealItem,
  useUpdateMealLog,
  useDeleteMealLog,
  useDeleteMealItem,
  useCreateSupplementLog,
  useUpdateSupplementLog,
  useDeleteSupplementLog,
  useCreateSymptomLog,
  useUpdateSymptomLog,
  useDeleteSymptomLog,
  useUpsertSleepLog,
  useUpdateSleepLog,
  useDeleteSleepLog,
  useActiveShoppingList,
  useCreateShoppingList,
  useAddShoppingItem,
  useUpdateShoppingItem,
  useDeleteShoppingItem,
  useSupplementsList,
  useSymptomsList,
  useTodaysMeals,
  useTodaysSymptoms,
  useTodaysSupplements,
  useLastNightsSleep,
} from "@/lib/hooks";
import type { RecentEntry } from "@/lib/assistant/action-schemas";
import type { Food, FoodNutrient, FoodSearchResult, MealType } from "@/types";

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; receiptIds?: string[] };
type VoicePhase = "idle" | "dictating" | "speaking" | "awaiting_consent" | "applying";
type RealtimeStatus = "disconnected" | "connecting" | "connected" | "error";

type UiMealItem = {
  key: string;
  label: string;
  usdaQuery: string;
  gramsConsumed: number | null;
  amountUnit: "g" | "oz";
  servings: number;
  quantityCount: number | null;
  quantityUnit: string | null;
  candidates: FoodSearchResult[];
  selectedCandidate: FoodSearchResult | null;
  matchedFood: Food | null;
  matchedByUser: boolean;
  isResolving: boolean;
  resolveError?: string;
  expanded: boolean;
};

type UiActionBase = {
  id: string;
  selected: boolean;
  title: string;
  confidence: number;
  status: "ready" | "applying" | "applied" | "error";
  error?: string;
  operation: "create" | "edit" | "delete";
  entryId?: string;
};

type UiMealAction = UiActionBase & {
  type: "log_meal" | "edit_meal";
  data: {
    date: string | null;
    mealType: MealType | null;
    notes?: string;
    items: UiMealItem[];
  };
};

type UiSymptomAction = UiActionBase & {
  type: "log_symptom" | "edit_symptom";
  data: {
    symptom: string;
    severity: number | null;
    date: string | null;
    time: string | null;
    notes?: string;
  };
};

type UiSupplementAction = UiActionBase & {
  type: "log_supplement" | "edit_supplement";
  data: {
    supplement: string;
    dosage: number | null;
    unit: string | null;
    doseCount?: number | null;
    doseUnit?: string | null;
    strengthAmount?: number | null;
    strengthUnit?: string | null;
    date: string | null;
    time: string | null;
    notes?: string;
  };
};

type UiSleepAction = UiActionBase & {
  type: "log_sleep" | "edit_sleep";
  data: {
    date: string | null;
    bedtime: string | null;
    wake_time: string | null;
    quality: number | null;
    factors: string[] | null;
    notes?: string;
  };
};

type UiShoppingItemAction = UiActionBase & {
  type: "add_shopping_item" | "edit_shopping_item";
  data: {
    name: string;
    quantity: number | null;
    unit: string | null;
    category: string | null;
    is_checked?: boolean;
    notes?: string;
  };
};

type UiDeleteAction = UiActionBase & {
  type: "delete_entry";
  data: {
    entryType: "meal" | "symptom" | "supplement" | "sleep" | "shopping_item";
  };
};

type UiAction = UiMealAction | UiSymptomAction | UiSupplementAction | UiSleepAction | UiShoppingItemAction | UiDeleteAction;

type ApplySelectedResult =
  | { ok: true; appliedIds: string[] }
  | { ok: false; appliedIds: string[]; error: string };

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function roundServings(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const rounded = Math.round(value * 100) / 100;
  return Math.max(0.01, Math.min(500, rounded));
}

function servingsFromGrams(food: Food | null, grams: number | null): number | null {
  if (!food || grams == null || !Number.isFinite(grams) || grams <= 0) return null;
  const servingUnit = (food.servingSizeUnit || "").toLowerCase();
  const servingSize = food.servingSize || 0;
  if (servingSize <= 0) return null;
  if (servingUnit === "g" || servingUnit === "gram" || servingUnit === "grams" || servingUnit === "ml") {
    return grams / servingSize;
  }
  return null;
}

function displayAmountFromGrams(grams: number | null, unit: "g" | "oz"): number | null {
  const v = amountFromGrams(grams, unit);
  return v == null ? null : roundTo1Decimal(v);
}

function formatImperialWeightFromGrams(grams: number): string {
  const oz = grams / 28.349523125;
  if (!Number.isFinite(oz) || oz <= 0) return "";
  if (oz < 16) return `${roundTo1Decimal(oz)} oz`;
  const lbs = Math.floor(oz / 16);
  const rem = oz - lbs * 16;
  const remText = rem >= 0.05 ? ` ${roundTo1Decimal(rem)} oz` : "";
  return `${lbs} lb${lbs === 1 ? "" : "s"}${remText}`.trim();
}

function formatDualWeight(grams: number): string {
  const g = Math.round(grams);
  const imperial = formatImperialWeightFromGrams(grams);
  return imperial ? `${g}g (${imperial})` : `${g}g`;
}

function transformNutrients(nutrients: FoodNutrient[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const n of nutrients) result[n.nutrientId] = n.amount;
  return result;
}

async function resolveFirstValidFood(candidates: FoodSearchResult[]): Promise<{
  selectedCandidate: FoodSearchResult | null;
  food: Food | null;
}> {
  if (candidates.length === 0) return { selectedCandidate: null, food: null };

  // Fetch a few in parallel to reduce perceived latency.
  const head = candidates.slice(0, 3);
  const headFoods = await Promise.all(head.map((c) => getFoodDetails(c.fdcId).catch(() => null)));
  for (let i = 0; i < head.length; i++) {
    const food = headFoods[i];
    if (food) return { selectedCandidate: head[i], food };
  }

  for (const candidate of candidates.slice(3)) {
    const food = await getFoodDetails(candidate.fdcId);
    if (food) return { selectedCandidate: candidate, food };
  }
  return { selectedCandidate: null, food: null };
}

function defaultMealTypeFromClock(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  if (hour < 14) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

function buildLoggedAtIso(args: { date: string | null; time: string | null }): string {
  if (args.date && args.time) {
    const dt = new Date(`${args.date}T${args.time}:00`);
    if (Number.isFinite(dt.getTime())) return dt.toISOString();
  }
  if (args.date && !args.time) {
    const dt = new Date(`${args.date}T12:00:00`);
    if (Number.isFinite(dt.getTime())) return dt.toISOString();
  }
  return new Date().toISOString();
}

function normalizeName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ");
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  half: 0.5,
  quarter: 0.25,
  couple: 2,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function parseCountToken(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;
  if (NUMBER_WORDS[t] != null) return NUMBER_WORDS[t];
  if (/^\d+\/\d+$/.test(t)) {
    const [a, b] = t.split("/");
    const num = Number(a);
    const den = Number(b);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      const v = num / den;
      if (Number.isFinite(v) && v > 0) return v;
    }
  }
  const n = Number(t);
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

function normalizeQuantityUnit(raw: string): string | null {
  const n = normalizeName(raw);
  if (!n) return null;

  if (n === "tbsp" || n === "tbsps") return "tablespoon";
  if (n === "tsp" || n === "tsps") return "teaspoon";
  if (n === "pcs" || n === "pc") return "piece";
  if (n === "fl oz" || n === "floz" || n === "fluid oz" || n === "fluid ounce" || n === "fluid ounces") return "fluid ounce";

  // Singularize a few common plurals.
  if (n === "eggs") return "egg";
  if (n === "pancakes") return "pancake";
  if (n === "waffles") return "waffle";
  if (n === "muffins") return "muffin";
  if (n === "donuts") return "donut";
  if (n === "bagels") return "bagel";
  if (n === "rolls") return "roll";
  if (n === "buns") return "bun";
  if (n === "tortillas") return "tortilla";
  if (n === "tacos") return "taco";
  if (n === "burritos") return "burrito";
  if (n === "sandwiches") return "sandwich";
  if (n === "burgers") return "burger";
  if (n === "sausages") return "sausage";
  if (n === "wings") return "wing";
  if (n === "drumsticks") return "drumstick";
  if (n === "slices") return "slice";
  if (n === "pieces") return "piece";
  if (n === "cookies") return "cookie";
  if (n === "crackers") return "cracker";
  if (n === "chips") return "chip";
  if (n === "pretzels") return "pretzel";
  if (n === "gummies") return "gummy";
  if (n === "nuggets") return "nugget";
  if (n === "strips") return "strip";
  if (n === "links") return "link";
  if (n === "patties") return "patty";
  if (n === "bars") return "bar";
  if (n === "sticks") return "stick";
  if (n === "cups") return "cup";
  if (n === "scoops") return "scoop";
  if (n === "packets") return "packet";
  if (n === "cans") return "can";
  if (n === "bottles") return "bottle";
  if (n === "tablespoons") return "tablespoon";
  if (n === "teaspoons") return "teaspoon";

  return n;
}

function canonicalUnitForMatch(raw: string | null | undefined): string {
  if (!raw) return "";
  const canonical = normalizeQuantityUnit(raw);
  if (!canonical) return "";
  // Collapse multiword units to their key noun for comparison when helpful.
  if (canonical.includes("tablespoon")) return "tablespoon";
  if (canonical.includes("teaspoon")) return "teaspoon";
  if (canonical.includes("scoop")) return "scoop";
  if (canonical.includes("cup")) return "cup";
  if (canonical.includes("egg")) return "egg";
  if (canonical.includes("pancake")) return "pancake";
  if (canonical.includes("waffle")) return "waffle";
  if (canonical.includes("muffin")) return "muffin";
  if (canonical.includes("donut")) return "donut";
  if (canonical.includes("bagel")) return "bagel";
  if (canonical.includes("roll")) return "roll";
  if (canonical.includes("bun")) return "bun";
  if (canonical.includes("tortilla")) return "tortilla";
  if (canonical.includes("taco")) return "taco";
  if (canonical.includes("burrito")) return "burrito";
  if (canonical.includes("sandwich")) return "sandwich";
  if (canonical.includes("burger")) return "burger";
  if (canonical.includes("sausage")) return "sausage";
  if (canonical.includes("wing")) return "wing";
  if (canonical.includes("drumstick")) return "drumstick";
  if (canonical.includes("slice")) return "slice";
  if (canonical.includes("piece")) return "piece";
  if (canonical.includes("cookie")) return "cookie";
  if (canonical.includes("cracker")) return "cracker";
  if (canonical.includes("chip")) return "chip";
  if (canonical.includes("pretzel")) return "pretzel";
  if (canonical.includes("gummy")) return "gummy";
  if (canonical.includes("nugget")) return "nugget";
  if (canonical.includes("strip")) return "strip";
  if (canonical.includes("link")) return "link";
  if (canonical.includes("patty")) return "patty";
  if (canonical.includes("bar")) return "bar";
  if (canonical.includes("stick")) return "stick";
  if (canonical.includes("packet")) return "packet";
  if (canonical.includes("can")) return "can";
  if (canonical.includes("bottle")) return "bottle";
  return canonical;
}

function pluralizeUnit(unit: string, count: number): string {
  if (count === 1) return unit;
  if (unit.endsWith("y")) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
}

type UnitMention =
  | { kind: "count"; count: number; unit: string; hint: string | null; start: number; end: number }
  | { kind: "mass"; count: number; unit: "g" | "oz" | "lb" | "kg"; hint: string | null; start: number; end: number };

function truncateHint(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return "";
  const cut = cleaned.search(/\b(and|with|plus|then|after|before)\b/i);
  return (cut === -1 ? cleaned : cleaned.slice(0, cut)).trim();
}

function normalizeMassUnit(raw: string): "g" | "oz" | "lb" | "kg" | null {
  const n = normalizeName(raw);
  if (!n) return null;
  if (n === "g" || n === "gram" || n === "grams" || n === "gramme" || n === "grammes") return "g";
  if (n === "oz" || n === "ounce" || n === "ounces") return "oz";
  if (n === "lb" || n === "lbs" || n === "pound" || n === "pounds") return "lb";
  if (n === "kg" || n === "kilogram" || n === "kilograms") return "kg";
  return null;
}

function gramsFromMassAmount(amount: number, unit: "g" | "oz" | "lb" | "kg"): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === "g") return amount;
  if (unit === "oz") return amount * OZ_TO_G;
  if (unit === "lb") return amount * (16 * OZ_TO_G);
  if (unit === "kg") return amount * 1000;
  return null;
}

function extractUnitMentionsFromText(text: string): UnitMention[] {
  const t = text.toLowerCase();

  // Keep this list practical and aligned with common USDA household serving language.
  const COUNT = "(\\d+\\/\\d+|\\d+(?:\\.\\d+)?|a|an|half|quarter|couple|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
  const UNIT = "(eggs?|pancakes?|waffles?|muffins?|donuts?|bagels?|rolls?|buns?|tortillas?|tacos?|burritos?|sandwich(?:es)?|burgers?|sausages?|wings?|drumsticks?|slices?|pieces?|pcs|cookies?|crackers?|chips?|pretzels?|gummies?|nuggets?|strips?|links?|patt(?:y|ies)|bars?|sticks?|cups?|tablespoons?|tbsp|teaspoons?|tsp|scoops?|packets?|cans?|bottles?)";
  const MASS_UNIT = "(oz|ounces?|lb|lbs|pounds?|g|grams?|kg|kilograms?)";

  const mentions: UnitMention[] = [];
  const used: Array<{ start: number; end: number }> = [];
  const overlapsUsed = (start: number, end: number) => used.some((u) => Math.max(u.start, start) < Math.min(u.end, end));

  // "2x8 oz steak", "2 x 8oz steak"
  const rxMultMass = new RegExp(`\\b(\\d+)\\s*[x×]\\s*${COUNT}\\s*${MASS_UNIT}\\b\\s+(?:of\\s+)?([^.,;]+)`, "gi");
  let mMass: RegExpExecArray | null;
  while ((mMass = rxMultMass.exec(t))) {
    const start = mMass.index;
    const end = start + mMass[0].length;
    if (overlapsUsed(start, end)) continue;
    const mult = Number(mMass[1]);
    const base = parseCountToken(mMass[2]);
    const unit = normalizeMassUnit(mMass[3] || "");
    if (!Number.isFinite(mult) || mult <= 0) continue;
    if (!base || !unit) continue;
    const count = mult * base;
    const hint = truncateHint(mMass[4] || "") || null;
    used.push({ start, end });
    mentions.push({ kind: "mass", count, unit, hint, start, end });
  }

  // "16 oz steak", "16oz of steak"
  const rxMassOf = new RegExp(`\\b${COUNT}\\s*${MASS_UNIT}\\b\\s+(?:of\\s+)?([^.,;]+)`, "gi");
  while ((mMass = rxMassOf.exec(t))) {
    const start = mMass.index;
    const end = start + mMass[0].length;
    if (overlapsUsed(start, end)) continue;
    const count = parseCountToken(mMass[1]);
    const unit = normalizeMassUnit(mMass[2] || "");
    if (!count || !unit) continue;
    const hint = truncateHint(mMass[3] || "") || null;
    used.push({ start, end });
    mentions.push({ kind: "mass", count, unit, hint, start, end });
  }

  const rxOf = new RegExp(`\\b${COUNT}\\s+${UNIT}\\s+(?:of\\s+)?([^.,;]+)`, "gi");
  let m: RegExpExecArray | null;
  while ((m = rxOf.exec(t))) {
    const start = m.index;
    const end = start + m[0].length;
    if (overlapsUsed(start, end)) continue;
    const count = parseCountToken(m[1]);
    const unit = normalizeQuantityUnit(m[2] || "") ?? null;
    if (!count || !unit) continue;
    const hint = truncateHint(m[3] || "") || null;
    used.push({ start, end });
    mentions.push({ kind: "count", count, unit, hint, start, end });
  }

  // "3 simple mills protein pancakes" (count + descriptors + unit)
  const rxAdj = new RegExp(`\\b${COUNT}\\s+((?:[a-z][a-z0-9'-]*\\s+){0,6})${UNIT}\\b`, "gi");
  while ((m = rxAdj.exec(t))) {
    const start = m.index;
    const end = start + m[0].length;
    if (overlapsUsed(start, end)) continue;
    const count = parseCountToken(m[1]);
    const unit = normalizeQuantityUnit(m[3] || "") ?? null;
    if (!count || !unit) continue;
    const hint = truncateHint(`${m[2] || ""}${m[3] || ""}`) || null;
    used.push({ start, end });
    mentions.push({ kind: "count", count, unit, hint, start, end });
  }

  // "3 pancakes" (count + unit)
  const rxSimple = new RegExp(`\\b${COUNT}\\s+${UNIT}\\b`, "gi");
  while ((m = rxSimple.exec(t))) {
    const start = m.index;
    const end = start + m[0].length;
    if (overlapsUsed(start, end)) continue;
    const count = parseCountToken(m[1]);
    const unit = normalizeQuantityUnit(m[2] || "") ?? null;
    if (!count || !unit) continue;
    used.push({ start, end });
    mentions.push({ kind: "count", count, unit, hint: unit, start, end });
  }

  mentions.sort((a, b) => a.start - b.start);
  return mentions;
}

function tokenizeHint(text: string | null): string[] {
  if (!text) return [];
  const stop = new Set(["a", "an", "the", "of", "and", "with", "to", "for"]);
  return normalizeName(text)
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !stop.has(x));
}

function applyUnitCountsToMealActions(nextActions: UiAction[], userText: string): UiAction[] {
  const mentions = extractUnitMentionsFromText(userText);
  if (mentions.length === 0) return nextActions;

  return nextActions.map((a) => {
    if (a.type !== "log_meal" && a.type !== "edit_meal") return a;

    const updatedItems = a.data.items.map((it) => ({ ...it }));

    for (const mention of mentions) {
      const primaryTokens = tokenizeHint(mention.hint);
      const hintTokens = primaryTokens.length > 0 ? primaryTokens : tokenizeHint(mention.unit);
      if (hintTokens.length === 0) continue;

      let bestIdx = -1;
      let bestScore = 0;

      for (let i = 0; i < updatedItems.length; i++) {
        const item = updatedItems[i];
        const hay = normalizeName(`${item.label} ${item.usdaQuery}`);
        let score = hintTokens.reduce((acc, tok) => (hay.includes(tok) ? acc + 1 : acc), 0);
        if (item.quantityUnit && canonicalUnitForMatch(item.quantityUnit) === canonicalUnitForMatch(mention.unit)) score += 0.5;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestIdx === -1 || bestScore === 0) continue;

      const target = updatedItems[bestIdx];
      if (mention.kind === "mass") {
        const grams = gramsFromMassAmount(mention.count, mention.unit);
        if (!grams) continue;
        const nextGrams = (target.gramsConsumed ?? 0) + grams;
        updatedItems[bestIdx] = {
          ...target,
          gramsConsumed: nextGrams,
          amountUnit: mention.unit === "oz" || mention.unit === "lb" ? "oz" : "g",
        };
        continue;
      }
      const nextCount =
        target.quantityUnit && canonicalUnitForMatch(target.quantityUnit) === canonicalUnitForMatch(mention.unit)
          ? (target.quantityCount ?? target.servings) + mention.count
          : mention.count;
      updatedItems[bestIdx] = {
        ...target,
        quantityCount: nextCount,
        quantityUnit: mention.unit,
        servings: roundServings(nextCount),
      };
    }

    return { ...a, data: { ...a.data, items: updatedItems } };
  });
}

type SupplementMention =
  | {
      kind: "combo";
      doseCount: number;
      doseUnit: string | null;
      strengthAmount: number;
      strengthUnit: string;
      hint: string | null;
    }
  | { kind: "count"; doseCount: number; doseUnit: string | null; hint: string | null }
  | { kind: "strength"; strengthAmount: number; strengthUnit: string; hint: string | null };

function normalizeDoseUnit(raw: string): string | null {
  const n = normalizeName(raw);
  if (!n) return null;
  if (n === "pill" || n === "pills") return "tablet";
  if (n === "tablet" || n === "tablets" || n === "tab" || n === "tabs") return "tablet";
  if (n === "capsule" || n === "capsules" || n === "cap" || n === "caps") return "capsule";
  if (n === "softgel" || n === "softgels") return "softgel";
  if (n === "gummy" || n === "gummies") return "gummy";
  if (n === "scoop" || n === "scoops") return "scoop";
  if (n === "drop" || n === "drops") return "drop";
  if (n === "spray" || n === "sprays") return "spray";
  if (n === "puff" || n === "puffs") return "puff";
  return n;
}

function normalizeStrengthUnit(raw: string): string | null {
  const n = normalizeName(raw);
  if (!n) return null;
  if (n === "ug" || n === "µg" || n === "μg") return "mcg";
  if (n === "mcg" || n === "microgram" || n === "micrograms") return "mcg";
  if (n === "mg" || n === "milligram" || n === "milligrams") return "mg";
  if (n === "g" || n === "gram" || n === "grams") return "g";
  if (n === "iu") return "iu";
  if (n === "cfu") return "cfu";
  return n;
}

function parseServingSizeText(raw: string | null | undefined): { count: number; unit: string } | null {
  if (!raw) return null;
  const trimmed = raw.split("(")[0].replace(/serving size[:]?/i, "").trim();
  if (!trimmed) return null;
  const m = trimmed.match(/(\d+(?:\.\d+)?)\s*([a-zA-Zµμ][a-zA-Zµμ\s-]{0,24})/);
  if (!m) return null;
  const count = Number(m[1]);
  if (!Number.isFinite(count) || count <= 0) return null;
  const unit = normalizeDoseUnit(m[2]) || "";
  if (!unit) return null;
  return { count, unit };
}

function extractSupplementMentionsFromText(text: string): SupplementMention[] {
  const t = text.toLowerCase();
  const COUNT = "(\\d+\\/\\d+|\\d+(?:\\.\\d+)?|a|an|half|quarter|couple|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
  const DOSE_UNIT = "(pills?|tablets?|tabs?|capsules?|caps?|softgels?|gummies?|scoops?|drops?|sprays?|puffs?)";
  const STRENGTH_UNIT = "(mg|mcg|µg|μg|ug|g|iu|cfu)";

  const out: SupplementMention[] = [];

  // "2x200mg ibuprofen"
  const rxCombo = new RegExp(`\\b${COUNT}\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)\\s*${STRENGTH_UNIT}\\b\\s+(?:of\\s+)?([^.,;]+)`, "gi");
  let m: RegExpExecArray | null;
  while ((m = rxCombo.exec(t))) {
    const doseCount = parseCountToken(m[1]);
    const strengthAmount = Number(m[2]);
    const strengthUnit = normalizeStrengthUnit(m[3] || "");
    const hint = truncateHint(m[4] || "") || null;
    if (!doseCount) continue;
    if (!Number.isFinite(strengthAmount) || strengthAmount <= 0) continue;
    if (!strengthUnit) continue;
    out.push({ kind: "combo", doseCount, doseUnit: null, strengthAmount, strengthUnit, hint });
  }

  // "3 tablets of vitamin c"
  const rxCountUnit = new RegExp(`\\b${COUNT}\\s*${DOSE_UNIT}\\b\\s*(?:of\\s+)?([^.,;]+)?`, "gi");
  while ((m = rxCountUnit.exec(t))) {
    const doseCount = parseCountToken(m[1]);
    const doseUnit = normalizeDoseUnit(m[2] || "");
    const hint = truncateHint(m[3] || "") || null;
    if (!doseCount || !doseUnit) continue;
    out.push({ kind: "count", doseCount, doseUnit, hint });
  }

  // "400mg advil"
  const rxStrength = new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${STRENGTH_UNIT}\\b\\s*(?:of\\s+)?([^.,;]+)?`, "gi");
  while ((m = rxStrength.exec(t))) {
    const strengthAmount = Number(m[1]);
    const strengthUnit = normalizeStrengthUnit(m[2] || "");
    const hint = truncateHint(m[3] || "") || null;
    if (!Number.isFinite(strengthAmount) || strengthAmount <= 0) continue;
    if (!strengthUnit) continue;
    out.push({ kind: "strength", strengthAmount, strengthUnit, hint });
  }

  // "3 advils" (bare brand medication count)
  const rxMedBrands = new RegExp(`\\b${COUNT}\\s+(advils?|tylenols?|ibuprofens?|acetaminophens?|naproxens?|aleves?)\\b`, "gi");
  while ((m = rxMedBrands.exec(t))) {
    const doseCount = parseCountToken(m[1]);
    const hint = truncateHint(m[2] || "") || null;
    if (!doseCount) continue;
    out.push({ kind: "count", doseCount, doseUnit: "tablet", hint });
  }

  return out;
}

function applySupplementMentionsToActions(
  nextActions: UiAction[],
  userText: string,
  supplementsList?: Array<{ id: string; name: string; serving_size?: string | null }> | null
): UiAction[] {
  const mentions = extractSupplementMentionsFromText(userText);
  if (mentions.length === 0) return nextActions;
  const supplementActionCount = nextActions.filter((a) => a.type === "log_supplement" || a.type === "edit_supplement").length;

  const findServingUnit = (supplementName: string): { count: number; unit: string } | null => {
    const normalized = normalizeName(supplementName);
    const match = (supplementsList ?? []).find((s) => normalizeName(s.name) === normalized);
    return parseServingSizeText((match as any)?.serving_size ?? null);
  };

  const defaultDoseUnit = (supplementName: string): string | null => {
    const byServing = findServingUnit(supplementName);
    if (byServing?.unit) return byServing.unit;
    const n = normalizeName(supplementName);
    if (/\b(advil|tylenol|ibuprofen|acetaminophen|naproxen|aleve)\b/.test(n)) return "tablet";
    return null;
  };

  return nextActions.map((a) => {
    if (a.type !== "log_supplement" && a.type !== "edit_supplement") return a;

    const hay = normalizeName(`${a.data.supplement} ${a.title}`);
    let best: { mention: SupplementMention; score: number } | null = null;
    for (const mention of mentions) {
      const hintTokens = tokenizeHint(mention.hint);
      const tokens = hintTokens.length ? hintTokens : [];
      const score = tokens.length === 0 ? 0 : tokens.reduce((acc, tok) => (hay.includes(tok) ? acc + 1 : acc), 0);
      if (!best || score > best.score) best = { mention, score };
    }
    if (!best) return a;
    if (best.score === 0 && !(supplementActionCount === 1 && mentions.length === 1)) return a;

    const mention = best.mention;
    const serving = findServingUnit(a.data.supplement);
    const chooseDoseUnit = (preferred: string | null): string | null => {
      if (preferred) return preferred;
      if (serving?.unit) return serving.unit;
      return defaultDoseUnit(a.data.supplement);
    };

    if (mention.kind === "strength") {
      return {
        ...a,
        data: {
          ...a.data,
          dosage: mention.strengthAmount,
          unit: mention.strengthUnit,
          strengthAmount: mention.strengthAmount,
          strengthUnit: mention.strengthUnit,
          doseCount: a.data.doseCount ?? null,
          doseUnit: a.data.doseUnit ?? null,
        },
      } as UiSupplementAction;
    }

    if (mention.kind === "count") {
      const unit = chooseDoseUnit(mention.doseUnit);
      return {
        ...a,
        data: {
          ...a.data,
          dosage: mention.doseCount,
          unit: unit ?? (mention.doseUnit ?? "serving"),
          doseCount: mention.doseCount,
          doseUnit: unit ?? mention.doseUnit ?? null,
        },
      } as UiSupplementAction;
    }

    const unit = chooseDoseUnit(mention.doseUnit);
    const strengthNote = `Strength: ${mention.strengthAmount} ${mention.strengthUnit}`;
    const nextNotes =
      a.data.notes && a.data.notes.trim()
        ? a.data.notes.includes(strengthNote)
          ? a.data.notes
          : `${a.data.notes}\n${strengthNote}`
        : strengthNote;
    return {
      ...a,
      data: {
        ...a.data,
        dosage: mention.doseCount,
        unit: unit ?? mention.doseUnit ?? "serving",
        doseCount: mention.doseCount,
        doseUnit: unit ?? mention.doseUnit ?? null,
        strengthAmount: mention.strengthAmount,
        strengthUnit: mention.strengthUnit,
        notes: nextNotes,
      },
    } as UiSupplementAction;
  });
}

function parseHouseholdServing(text: string | undefined): { count: number; unit: string } | null {
  if (!text) return null;
  const trimmed = text.split("(")[0].trim();
  if (!trimmed) return null;
  const m = trimmed.toLowerCase().match(/^(\d+(?:\.\d+)?)\s+([a-z][a-z\s-]*)$/i);
  if (!m) return null;
  const count = Number(m[1]);
  if (!Number.isFinite(count) || count <= 0) return null;
  const unit = m[2].replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (!unit) return null;
  return { count, unit };
}

function inferGramsConsumedFromQuantity(item: UiMealItem): number | null {
  if (item.gramsConsumed != null && Number.isFinite(item.gramsConsumed) && item.gramsConsumed > 0) return item.gramsConsumed;
  if (!item.matchedFood) return null;
  if (item.quantityCount == null || !Number.isFinite(item.quantityCount) || item.quantityCount <= 0) return null;
  if (!item.quantityUnit) return null;
  const household = parseHouseholdServing(item.matchedFood.householdServingFullText);
  if (!household) return null;
  const unitNorm = canonicalUnitForMatch(household.unit);
  const qtyNorm = canonicalUnitForMatch(item.quantityUnit);
  if (!unitNorm || !qtyNorm) return null;
  if (!(unitNorm.includes(qtyNorm) || qtyNorm.includes(unitNorm))) return null;
  const servingUnit = (item.matchedFood.servingSizeUnit || "").toLowerCase();
  if (!(servingUnit === "g" || servingUnit === "gram" || servingUnit === "grams")) return null;
  const servingSize = item.matchedFood.servingSize || 0;
  if (!Number.isFinite(servingSize) || servingSize <= 0) return null;
  const gramsPerUnit = household.count > 0 ? servingSize / household.count : servingSize;
  const grams = item.quantityCount * gramsPerUnit;
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

function parseSupplementSummary(summary: string): { name: string; dosage: number | null; unit: string | null } {
  const trimmed = summary.trim();
  if (!trimmed) return { name: "", dosage: null, unit: null };
  const m = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?)([a-zA-Zµμ][^\s]*)?$/);
  if (!m) return { name: trimmed, dosage: null, unit: null };
  const name = m[1].trim();
  const dosage = Number(m[2]);
  const unit = (m[3] ?? "").trim() || null;
  return { name, dosage: Number.isFinite(dosage) ? dosage : null, unit };
}

function dedupeMealItems(items: UiMealItem[]): UiMealItem[] {
  const byKey = new Map<string, UiMealItem>();
  for (const item of items) {
    const key = normalizeName(item.usdaQuery || item.label);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    const merged: UiMealItem = {
      ...existing,
      label: existing.label || item.label,
      usdaQuery: existing.usdaQuery || item.usdaQuery,
      gramsConsumed:
        existing.gramsConsumed != null && item.gramsConsumed != null
          ? existing.gramsConsumed + item.gramsConsumed
          : existing.gramsConsumed ?? item.gramsConsumed ?? null,
      servings: roundServings((existing.servings || 0) + (item.servings || 0)),
      quantityCount:
        existing.quantityCount != null && item.quantityCount != null
          ? existing.quantityCount + item.quantityCount
          : existing.quantityCount ?? item.quantityCount ?? null,
      quantityUnit: existing.quantityUnit ?? item.quantityUnit ?? null,
      candidates: existing.candidates.length ? existing.candidates : item.candidates,
      selectedCandidate: existing.selectedCandidate ?? item.selectedCandidate,
      matchedFood: existing.matchedFood ?? item.matchedFood,
      isResolving: existing.isResolving || item.isResolving,
      resolveError: existing.resolveError || item.resolveError,
      expanded: existing.expanded || item.expanded,
      amountUnit: existing.amountUnit || item.amountUnit,
    };
    byKey.set(key, merged);
  }
  return Array.from(byKey.values());
}

function deriveOperation(type: string): "create" | "edit" | "delete" {
  if (type.startsWith("edit_")) return "edit";
  if (type === "delete_entry") return "delete";
  return "create";
}

function planToUiActions(plan: AssistantV3Response): UiAction[] {
  const today = localDateISO();
  return plan.actions.map((action: any) => {
    const operation = deriveOperation(action.type);
    const base: UiActionBase = {
      id: uuid(),
      selected: true,
      title: action.title,
      confidence: Number.isFinite(action.confidence) ? action.confidence : 0.6,
      status: "ready",
      operation,
      entryId: action.entryId ?? undefined,
    };

    if (action.type === "log_meal" || action.type === "edit_meal") {
      const mealType = action.data.mealType ?? null;
      const date = action.type === "log_meal" ? (action.data.date ?? today) : (action.data.date ?? null);
      const rawItems = action.data.items ?? [];
      const items: UiMealItem[] = rawItems.map((item: any) => ({
        key: uuid(),
        label: item.label,
        usdaQuery: item.usdaQuery,
        gramsConsumed: item.gramsConsumed ?? null,
        amountUnit: "g" as const,
        servings: roundServings(item.servings ?? 1),
        quantityCount: null,
        quantityUnit: null,
        candidates: [],
        selectedCandidate: null,
        matchedFood: null,
        matchedByUser: false,
        isResolving: false,
        expanded: false,
      }));
      const deduped = dedupeMealItems(items);
      return { ...base, type: action.type, data: { date, mealType, items: deduped, notes: action.data.notes ?? undefined } } as UiMealAction;
    }

    if (action.type === "log_symptom" || action.type === "edit_symptom") {
      const severity = action.type === "log_symptom" ? (action.data.severity ?? 5) : (action.data.severity ?? null);
      return {
        ...base,
        type: action.type,
        data: {
          symptom: action.data.symptom ?? "",
          severity,
          date: action.data.date ?? null,
          time: action.data.time ?? null,
          notes: action.data.notes ?? undefined,
        },
      } as UiSymptomAction;
    }

    if (action.type === "log_supplement" || action.type === "edit_supplement") {
      const dosage = action.type === "log_supplement" ? (action.data.dosage ?? 1) : (action.data.dosage ?? null);
      const unit = action.type === "log_supplement" ? (action.data.unit ?? "serving") : (action.data.unit ?? null);
      return {
        ...base,
        type: action.type,
        data: {
          supplement: action.data.supplement ?? "",
          dosage,
          unit,
          doseCount: null,
          doseUnit: null,
          strengthAmount: null,
          strengthUnit: null,
          date: action.data.date ?? null,
          time: action.data.time ?? null,
          notes: action.data.notes ?? undefined,
        },
      } as UiSupplementAction;
    }

    if (action.type === "log_sleep" || action.type === "edit_sleep") {
      const isEdit = action.type === "edit_sleep";
      return {
        ...base,
        type: action.type,
        data: {
          date: isEdit ? (action.data.date ?? null) : (action.data.date ?? today),
          bedtime: action.data.bedtime ?? null,
          wake_time: action.data.wake_time ?? null,
          quality: isEdit ? (action.data.quality ?? null) : (action.data.quality ?? 3),
          factors: isEdit ? (action.data.factors ?? null) : (action.data.factors ?? []),
          notes: action.data.notes ?? undefined,
        },
      } as UiSleepAction;
    }

    if (action.type === "add_shopping_item" || action.type === "edit_shopping_item") {
      const category = action.type === "add_shopping_item" ? (action.data.category ?? "other") : (action.data.category ?? null);
      return {
        ...base,
        type: action.type,
        data: {
          name: action.data.name ?? "",
          quantity: action.data.quantity ?? null,
          unit: action.data.unit ?? null,
          category,
          is_checked: action.data.is_checked ?? undefined,
          notes: action.data.notes ?? undefined,
        },
      } as UiShoppingItemAction;
    }

    if (action.type === "delete_entry") {
      return {
        ...base,
        type: "delete_entry",
        data: {
          entryType: action.data.entryType ?? "meal",
        },
      } as UiDeleteAction;
    }

    // Fallback: treat unknown types as supplement (original default)
    return {
      ...base,
      type: "log_supplement",
      operation: "create" as const,
      data: {
        supplement: action.data?.supplement ?? "",
        dosage: action.data?.dosage ?? 1,
        unit: action.data?.unit ?? "serving",
        date: action.data?.date ?? null,
        time: action.data?.time ?? null,
        notes: action.data?.notes ?? undefined,
      },
    } as UiSupplementAction;
  });
}

function uiActionsToPlanActions(actions: UiAction[]): any[] {
  return actions
    .filter((a) => a.status !== "applied")
    .map((a): any => {
      const base = { type: a.type, title: a.title, confidence: a.confidence, ...(a.entryId ? { entryId: a.entryId } : {}) };

      if (a.type === "log_meal" || a.type === "edit_meal") {
        return {
          ...base,
          data: {
            date: a.data.date ?? null,
            mealType: a.data.mealType ?? null,
            items: a.data.items.map((it) => ({
              label: it.label,
              usdaQuery: it.usdaQuery,
              gramsConsumed: it.gramsConsumed ?? null,
              servings: it.servings ?? null,
              notes: undefined,
            })),
            notes: a.data.notes,
          },
        };
      }
      if (a.type === "log_symptom" || a.type === "edit_symptom") {
        return {
          ...base,
          data: {
            symptom: a.data.symptom,
            severity: a.data.severity ?? null,
            date: a.data.date ?? null,
            time: a.data.time ?? null,
            notes: a.data.notes,
          },
        };
      }
      if (a.type === "log_supplement" || a.type === "edit_supplement") {
        return {
          ...base,
          data: {
            supplement: a.data.supplement,
            dosage: a.data.dosage ?? null,
            unit: a.data.unit ?? null,
            date: a.data.date ?? null,
            time: a.data.time ?? null,
            notes: a.data.notes,
          },
        };
      }
      if (a.type === "log_sleep" || a.type === "edit_sleep") {
        return {
          ...base,
          data: {
            date: a.data.date ?? null,
            bedtime: a.data.bedtime ?? null,
            wake_time: a.data.wake_time ?? null,
            quality: a.data.quality ?? null,
            factors: a.operation === "edit" ? (a.data.factors ?? null) : (a.data.factors ?? []),
            notes: a.data.notes,
          },
        };
      }
      if (a.type === "add_shopping_item" || a.type === "edit_shopping_item") {
        return {
          ...base,
          data: {
            name: a.data.name,
            quantity: a.data.quantity ?? null,
            unit: a.data.unit ?? null,
            category: a.data.category ?? null,
            is_checked: a.data.is_checked ?? null,
            notes: a.data.notes,
          },
        };
      }
      if (a.type === "delete_entry") {
        return { ...base, data: { entryType: a.data.entryType } };
      }
      return base;
    });
}

/* ───── Receipt Card (editable, auto-saves on blur) ───── */

const rcInput = "h-7 rounded-md border-transparent bg-transparent px-1.5 text-xs focus:border-slate-300 dark:focus:border-slate-600 focus:bg-white/80 dark:focus:bg-slate-900/50 transition-colors text-slate-900 dark:text-slate-100";
const rcLabel = "text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500";
const rcChanged = "bg-yellow-50/90 dark:bg-yellow-950/35 ring-1 ring-yellow-300/70 dark:ring-yellow-700/60";

type ReceiptSectionProps = {
  action: UiAction;
  setActions: React.Dispatch<React.SetStateAction<UiAction[]>>;
  onSave: (action: UiAction) => void;
  referenceEntry?: RecentEntry;
  referenceAction?: UiAction;
};

function ReceiptMealSection({ action, setActions, onSave, referenceEntry, referenceAction }: ReceiptSectionProps) {
  const a = action as UiMealAction;
  const d = a.data;
  const isEdit = a.operation === "edit";
  const changedDate = isEdit && d.date != null;
  const changedMealType = isEdit && d.mealType != null;
  const changedItems = isEdit && d.items.some((it) => Boolean(it.label.trim() || it.usdaQuery.trim()));
  const refAction = referenceAction as UiMealAction | undefined;
  const refSummary =
    referenceEntry?.type === "meal" && typeof referenceEntry.summary === "string" ? referenceEntry.summary : "";
  const parsedMealTypeFromSummary = (() => {
    const head = (refSummary.split(":")[0] || "").trim().toLowerCase();
    if (head === "breakfast" || head === "lunch" || head === "dinner" || head === "snack") return head as MealType;
    return null;
  })();
  const parsedItemsFromSummary = (() => {
    const parts = refSummary.split(":");
    if (parts.length < 2) return [];
    const tail = parts.slice(1).join(":");
    return tail
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
  })();

  const displayDate = d.date ?? referenceEntry?.date ?? refAction?.data.date ?? "";
  const displayMealType = d.mealType ?? refAction?.data.mealType ?? parsedMealTypeFromSummary ?? null;
  const mealLabel = displayMealType ? displayMealType.charAt(0).toUpperCase() + displayMealType.slice(1) : "Meal";
  const displayItems = d.items.length > 0 ? d.items : (refAction?.data.items?.length ? refAction.data.items : []);
  const update = (patch: Partial<UiMealAction["data"]>) =>
    setActions((prev) => prev.map((x) => (x.id === a.id && (x.type === "log_meal" || x.type === "edit_meal") ? { ...x, data: { ...x.data, ...patch } } : x)));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
        <Utensils className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{a.operation === "edit" ? "Updated" : "Logged"} {mealLabel}</span>
      </div>
      <div className="ml-5.5 grid grid-cols-2 gap-1.5">
        <div><div className={rcLabel}>Date</div><input type="date" className={cn(rcInput, "w-full", changedDate && rcChanged)} value={displayDate} onChange={(e) => update({ date: e.target.value || null })} onBlur={() => onSave(a)} /></div>
        <div>
          <div className={rcLabel}>Type</div>
          <select className={cn(rcInput, "w-full", changedMealType && rcChanged)} value={displayMealType || ""} onChange={(e) => { update({ mealType: (e.target.value || null) as MealType | null }); setTimeout(() => onSave(a), 0); }}>
            <option value="">Auto</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option>
          </select>
        </div>
      </div>
      {displayItems.length > 0 ? (
        displayItems.map((item, i) => (
          <div
            key={item.key || i}
            className={cn(
              "ml-5.5 flex items-baseline gap-2 text-xs text-slate-600 dark:text-slate-300",
              changedItems && "rounded px-1.5 py-0.5 bg-yellow-50/60 dark:bg-yellow-950/25"
            )}
          >
            <span className="font-medium">{item.label || item.usdaQuery}</span>
            {item.gramsConsumed != null && <span className={cn("text-slate-400", changedItems && "rounded px-1 bg-yellow-50/70 dark:bg-yellow-950/30")}>{formatDualWeight(item.gramsConsumed)}</span>}
            {item.quantityUnit ? (
              <span className={cn("text-slate-400", changedItems && "rounded px-1 bg-yellow-50/70 dark:bg-yellow-950/30")}>
                {item.servings} {pluralizeUnit(item.quantityUnit, item.servings)}
              </span>
            ) : (
              <span className={cn("text-slate-400", changedItems && "rounded px-1 bg-yellow-50/70 dark:bg-yellow-950/30")}>×{item.servings}</span>
            )}
          </div>
        ))
      ) : parsedItemsFromSummary.length > 0 ? (
        parsedItemsFromSummary.map((label, i) => (
          <div key={`${label}-${i}`} className="ml-5.5 flex items-baseline gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-medium">{label}</span>
          </div>
        ))
      ) : null}
    </div>
  );
}

function ReceiptSymptomSection({ action, setActions, onSave, referenceEntry, referenceAction }: ReceiptSectionProps) {
  const a = action as UiSymptomAction;
  const d = a.data;
  const isEdit = a.operation === "edit";
  const changedSeverity = isEdit && d.severity != null;
  const changedDate = isEdit && d.date != null;
  const changedTime = isEdit && d.time != null;
  const refSymptomName =
    referenceEntry?.type === "symptom" && typeof referenceEntry.summary === "string"
      ? referenceEntry.summary.split(",")[0]?.trim()
      : undefined;
  const refAction = referenceAction as UiSymptomAction | undefined;
  const symptomName = (d.symptom || refAction?.data.symptom || refSymptomName || "").trim() || "Symptom";
  const displayDate = d.date ?? referenceEntry?.date ?? refAction?.data.date ?? "";
  const displayTime = d.time ?? referenceEntry?.time ?? refAction?.data.time ?? "";
  const displaySeverity = d.severity ?? refAction?.data.severity ?? null;
  const update = (patch: Partial<UiSymptomAction["data"]>) =>
    setActions((prev) => prev.map((x) => (x.id === a.id && (x.type === "log_symptom" || x.type === "edit_symptom") ? { ...x, data: { ...x.data, ...patch } } : x)));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
        <Activity className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>{a.operation === "edit" ? "Updated" : "Logged"} {symptomName}</span>
      </div>
      <div className="ml-5.5 grid grid-cols-3 gap-1.5">
        <div><div className={rcLabel}>Severity</div><input type="number" min={1} max={10} className={cn(rcInput, "w-full", changedSeverity && rcChanged)} value={displaySeverity ?? ""} onChange={(e) => update({ severity: e.target.value ? Number(e.target.value) : null })} onBlur={() => onSave(a)} /></div>
        <div><div className={rcLabel}>Date</div><input type="date" className={cn(rcInput, "w-full", changedDate && rcChanged)} value={displayDate} onChange={(e) => update({ date: e.target.value || null })} onBlur={() => onSave(a)} /></div>
        <div><div className={rcLabel}>Time</div><input type="time" className={cn(rcInput, "w-full", changedTime && rcChanged)} value={displayTime} onChange={(e) => update({ time: e.target.value || null })} onBlur={() => onSave(a)} /></div>
      </div>
    </div>
  );
}

function ReceiptSupplementSection({ action, setActions, onSave, referenceEntry, referenceAction }: ReceiptSectionProps) {
  const a = action as UiSupplementAction;
  const d = a.data;
  const isEdit = a.operation === "edit";
  const changedDosage = isEdit && d.dosage != null;
  const changedUnit = isEdit && d.unit != null && d.unit.trim() !== "";
  const changedDate = isEdit && d.date != null;
  const changedTime = isEdit && d.time != null;

  const refAction = referenceAction as UiSupplementAction | undefined;
  const refFromSummary =
    referenceEntry?.type === "supplement" && typeof referenceEntry.summary === "string"
      ? parseSupplementSummary(referenceEntry.summary)
      : null;

  const supplementName = (d.supplement || refAction?.data.supplement || refFromSummary?.name || "").trim() || "Supplement";
  const displayDosage = d.dosage ?? refAction?.data.dosage ?? refFromSummary?.dosage ?? null;
  const displayUnit = d.unit ?? refAction?.data.unit ?? refFromSummary?.unit ?? "";
  const displayDate = d.date ?? referenceEntry?.date ?? refAction?.data.date ?? "";
  const displayTime = d.time ?? referenceEntry?.time ?? refAction?.data.time ?? "";

  const update = (patch: Partial<UiSupplementAction["data"]>) =>
    setActions((prev) => prev.map((x) => (x.id === a.id && (x.type === "log_supplement" || x.type === "edit_supplement") ? { ...x, data: { ...x.data, ...patch } } : x)));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
        <Pill className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
        <span>{a.operation === "edit" ? "Updated" : "Logged"} {supplementName}</span>
      </div>
      <div className="ml-5.5 grid grid-cols-4 gap-1.5">
        <div><div className={rcLabel}>Dosage</div><input type="number" step="any" className={cn(rcInput, "w-full", changedDosage && rcChanged)} value={displayDosage ?? ""} onChange={(e) => update({ dosage: e.target.value ? Number(e.target.value) : null })} onBlur={() => onSave(a)} /></div>
        <div><div className={rcLabel}>Unit</div><input className={cn(rcInput, "w-full", changedUnit && rcChanged)} value={displayUnit || ""} onChange={(e) => update({ unit: e.target.value || null })} onBlur={() => onSave(a)} /></div>
        <div><div className={rcLabel}>Date</div><input type="date" className={cn(rcInput, "w-full", changedDate && rcChanged)} value={displayDate} onChange={(e) => update({ date: e.target.value || null })} onBlur={() => onSave(a)} /></div>
        <div><div className={rcLabel}>Time</div><input type="time" className={cn(rcInput, "w-full", changedTime && rcChanged)} value={displayTime} onChange={(e) => update({ time: e.target.value || null })} onBlur={() => onSave(a)} /></div>
      </div>
    </div>
  );
}

function ReceiptSleepSection({ action, setActions, onSave, referenceEntry, referenceAction }: ReceiptSectionProps) {
  const a = action as UiSleepAction;
  const d = a.data;
  const isEdit = a.operation === "edit";
  const changedBedtime = isEdit && d.bedtime != null;
  const changedWake = isEdit && d.wake_time != null;
  const changedQuality = isEdit && d.quality != null;
  const changedFactors = isEdit && d.factors != null;
  const refAction = referenceAction as UiSleepAction | undefined;
  const parsedFromSummary = (() => {
    const summary = referenceEntry?.type === "sleep" && typeof referenceEntry.summary === "string" ? referenceEntry.summary : "";
    const m = summary.match(/sleep\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}).*?quality\s+(\d)/i);
    if (!m) return { bedtime: "", wake_time: "", quality: null as number | null };
    return {
      bedtime: m[1] || "",
      wake_time: m[2] || "",
      quality: m[3] ? Number(m[3]) : null,
    };
  })();
  const displayBedtime = d.bedtime ?? refAction?.data.bedtime ?? parsedFromSummary.bedtime ?? "";
  const displayWake = d.wake_time ?? refAction?.data.wake_time ?? parsedFromSummary.wake_time ?? "";
  const displayQuality = d.quality ?? refAction?.data.quality ?? parsedFromSummary.quality ?? null;
  const referenceFactors = Array.isArray(refAction?.data.factors) ? (refAction?.data.factors as string[]) : [];
  const factorValues = Array.isArray(d.factors) ? d.factors : referenceFactors;
  const update = (patch: Partial<UiSleepAction["data"]>) =>
    setActions((prev) => prev.map((x) => (x.id === a.id && (x.type === "log_sleep" || x.type === "edit_sleep") ? { ...x, data: { ...x.data, ...patch } } : x)));
  const toggleFactor = (f: string, checked: boolean) => {
    const base = Array.isArray(d.factors) ? d.factors : factorValues;
    const factors = checked ? [...base, f] : base.filter((x) => x !== f);
    update({ factors });
    setTimeout(() => onSave(a), 0);
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
        <Moon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span>{a.operation === "edit" ? "Updated" : "Logged"} Sleep</span>
      </div>
      <div className="ml-5.5 grid grid-cols-3 gap-1.5">
        <div><div className={rcLabel}>Bedtime</div><input type="time" className={cn(rcInput, "w-full", changedBedtime && rcChanged)} value={displayBedtime} onChange={(e) => update({ bedtime: e.target.value || null })} onBlur={() => onSave(a)} /></div>
        <div><div className={rcLabel}>Wake</div><input type="time" className={cn(rcInput, "w-full", changedWake && rcChanged)} value={displayWake} onChange={(e) => update({ wake_time: e.target.value || null })} onBlur={() => onSave(a)} /></div>
        <div><div className={rcLabel}>Quality</div><input type="number" min={1} max={5} className={cn(rcInput, "w-full", changedQuality && rcChanged)} value={displayQuality ?? ""} onChange={(e) => update({ quality: e.target.value ? Number(e.target.value) : null })} onBlur={() => onSave(a)} /></div>
      </div>
      {(!isEdit || d.factors != null || referenceFactors.length > 0) && (
        <div className={cn("ml-5.5 flex flex-wrap gap-x-3 gap-y-1 rounded-md px-1.5 py-1", changedFactors && "bg-yellow-50/60 dark:bg-yellow-950/25")}>
          {["caffeine", "alcohol", "exercise", "stress", "screen_time", "late_meal", "medication", "late_night_chores"].map((f) => (
            <label key={f} className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
              <input type="checkbox" className="h-3 w-3" checked={factorValues.includes(f)} onChange={(e) => toggleFactor(f, e.target.checked)} />
              {f.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ReceiptShoppingSection({ actions, setActions, onSave }: { actions: UiAction[]; setActions: React.Dispatch<React.SetStateAction<UiAction[]>>; onSave: (action: UiAction) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
        <ShoppingCart className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
        <span>Shopping items</span>
      </div>
      {actions.map((action) => {
        const a = action as UiShoppingItemAction;
        const d = a.data;
        const isEdit = a.operation === "edit";
        const changedName = isEdit && Boolean(d.name && d.name.trim());
        const changedQty = isEdit && d.quantity != null;
        const changedUnit = isEdit && d.unit != null && d.unit.trim() !== "";
        const update = (patch: Partial<UiShoppingItemAction["data"]>) =>
          setActions((prev) => prev.map((x) => (x.id === a.id && (x.type === "add_shopping_item" || x.type === "edit_shopping_item") ? { ...x, data: { ...x.data, ...patch } } : x)));
        return (
          <div key={a.id} className="ml-5.5 grid grid-cols-4 gap-1.5">
            <div className="col-span-2"><div className={rcLabel}>Name</div><input className={cn(rcInput, "w-full", changedName && rcChanged)} value={d.name || ""} onChange={(e) => update({ name: e.target.value })} onBlur={() => onSave(a)} /></div>
            <div><div className={rcLabel}>Qty</div><input type="number" step="any" className={cn(rcInput, "w-full", changedQty && rcChanged)} value={d.quantity ?? ""} onChange={(e) => update({ quantity: e.target.value ? Number(e.target.value) : null })} onBlur={() => onSave(a)} /></div>
            <div><div className={rcLabel}>Unit</div><input className={cn(rcInput, "w-full", changedUnit && rcChanged)} value={d.unit || ""} onChange={(e) => update({ unit: e.target.value || null })} onBlur={() => onSave(a)} /></div>
          </div>
        );
      })}
    </div>
  );
}

function ReceiptDeleteSection({ action }: { action: UiAction }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
      <Trash2 className="h-3.5 w-3.5 text-red-500 dark:text-red-400 shrink-0" />
      <span className="line-through text-slate-500 dark:text-slate-400">{action.title}</span>
    </div>
  );
}

function ReceiptCard({ actionIds, allActions, setActions, actionsRef, onSave, recentEntries }: {
  actionIds: string[];
  allActions: UiAction[];
  setActions: React.Dispatch<React.SetStateAction<UiAction[]>>;
  actionsRef: React.RefObject<UiAction[]>;
  onSave: (actionId: string) => void;
  recentEntries: RecentEntry[];
}) {
  const receiptActions = actionIds.map((id) => allActions.find((a) => a.id === id)).filter(Boolean) as UiAction[];
  if (receiptActions.length === 0) return null;

  const meals = receiptActions.filter((a) => (a.type === "log_meal" || a.type === "edit_meal") && a.operation !== "delete");
  const symptoms = receiptActions.filter((a) => (a.type === "log_symptom" || a.type === "edit_symptom") && a.operation !== "delete");
  const supplements = receiptActions.filter((a) => (a.type === "log_supplement" || a.type === "edit_supplement") && a.operation !== "delete");
  const sleeps = receiptActions.filter((a) => (a.type === "log_sleep" || a.type === "edit_sleep") && a.operation !== "delete");
  const shopping = receiptActions.filter((a) => (a.type === "add_shopping_item" || a.type === "edit_shopping_item") && a.operation !== "delete");
  const deletes = receiptActions.filter((a) => a.operation === "delete");

  // onSave wrapper: reads latest from ref to avoid stale closures
  const handleSave = (action: UiAction) => onSave(action.id);

  const findReferenceEntry = (action: UiAction): RecentEntry | undefined => {
    if (!action.entryId) return undefined;
    const entryType =
      action.type === "log_meal" || action.type === "edit_meal"
        ? "meal"
        : action.type === "log_symptom" || action.type === "edit_symptom"
          ? "symptom"
          : action.type === "log_supplement" || action.type === "edit_supplement"
            ? "supplement"
            : action.type === "log_sleep" || action.type === "edit_sleep"
              ? "sleep"
              : action.type === "add_shopping_item" || action.type === "edit_shopping_item"
                ? "shopping_item"
                : undefined;
    if (!entryType) return undefined;
    return recentEntries.find((e) => e.id === action.entryId && e.type === entryType);
  };

  const findReferenceAction = (action: UiAction): UiAction | undefined => {
    if (!action.entryId) return undefined;
    const candidates = allActions.filter((a) => a.id !== action.id && a.status === "applied" && a.entryId === action.entryId);
    return candidates[candidates.length - 1];
  };

  return (
    <div
      className={cn(
        "mr-auto max-w-[92%] rounded-[var(--radius-xl)] p-4 space-y-3",
        "backdrop-blur-xl bg-[var(--glass-bg)] border border-[color:var(--glass-border)] shadow-[var(--glass-shadow)]",
        "animate-spring-in"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" />
        Applied
      </div>

      {meals.map((a) => <ReceiptMealSection key={a.id} action={a} setActions={setActions} onSave={handleSave} referenceEntry={findReferenceEntry(a)} referenceAction={findReferenceAction(a)} />)}
      {symptoms.map((a) => <ReceiptSymptomSection key={a.id} action={a} setActions={setActions} onSave={handleSave} referenceEntry={findReferenceEntry(a)} referenceAction={findReferenceAction(a)} />)}
      {supplements.map((a) => <ReceiptSupplementSection key={a.id} action={a} setActions={setActions} onSave={handleSave} referenceEntry={findReferenceEntry(a)} referenceAction={findReferenceAction(a)} />)}
      {sleeps.map((a) => <ReceiptSleepSection key={a.id} action={a} setActions={setActions} onSave={handleSave} referenceEntry={findReferenceEntry(a)} referenceAction={findReferenceAction(a)} />)}
      {shopping.length > 0 && <ReceiptShoppingSection actions={shopping} setActions={setActions} onSave={handleSave} />}
      {deletes.map((a) => <ReceiptDeleteSection key={a.id} action={a} />)}
    </div>
  );
}

export function AssistantLauncher() {
  const toast = useToast();

  const createMealLog = useCreateMealLog();
  const addMealItem = useAddMealItem();
  const deleteMealItem = useDeleteMealItem();
  const updateMealLog = useUpdateMealLog();
  const deleteMealLog = useDeleteMealLog();
  const createSymptomLog = useCreateSymptomLog();
  const updateSymptomLog = useUpdateSymptomLog();
  const deleteSymptomLog = useDeleteSymptomLog();
  const createCustomSymptom = useCreateCustomSymptom();
  const createSupplementLog = useCreateSupplementLog();
  const updateSupplementLog = useUpdateSupplementLog();
  const deleteSupplementLog = useDeleteSupplementLog();
  const upsertSleepLog = useUpsertSleepLog();
  const updateSleepLog = useUpdateSleepLog();
  const deleteSleepLog = useDeleteSleepLog();
  const activeShoppingList = useActiveShoppingList();
  const createShoppingList = useCreateShoppingList();
  const addShoppingItem = useAddShoppingItem();
  const updateShoppingItem = useUpdateShoppingItem();
  const deleteShoppingItem = useDeleteShoppingItem();

  const symptomsList = useSymptomsList();
  const supplementsList = useSupplementsList();

  const todaysMeals = useTodaysMeals();
  const todaysSymptoms = useTodaysSymptoms();
  const todaysSupplements = useTodaysSupplements();
  const lastNightsSleep = useLastNightsSleep();

  const recentEntries = useMemo((): RecentEntry[] => {
    const entries: RecentEntry[] = [];
    for (const m of (todaysMeals.data ?? []) as any[]) {
      const mealItems = ((m as any).meal_items ?? (m as any).items ?? []) as any[];
      const itemNames = mealItems.map((i: any) => i.custom_food_name || "item").join(", ");
      entries.push({ id: m.id, type: "meal", summary: `${m.meal_type || "meal"}: ${itemNames}`.slice(0, 200), date: m.date });
    }
    for (const s of (todaysSymptoms.data ?? []) as any[]) {
      const name = s.symptom?.name ?? s.symptom_name ?? "symptom";
      entries.push({ id: s.id, type: "symptom", summary: `${name}, severity ${s.severity}`, date: s.logged_at?.slice(0, 10), time: s.logged_at?.slice(11, 16) });
    }
    for (const s of (todaysSupplements.data ?? []) as any[]) {
      const doseText =
        s.dose_count != null && s.dose_unit
          ? `${s.dose_count} ${s.dose_unit}`
          : `${s.dosage} ${s.unit}`.trim();
      const strengthText =
        s.strength_amount != null && s.strength_unit ? ` (${s.strength_amount} ${s.strength_unit})` : "";
      entries.push({ id: s.id, type: "supplement", summary: `${s.supplement_name} ${doseText}${strengthText}`.trim(), date: s.logged_at?.slice(0, 10), time: s.logged_at?.slice(11, 16) });
    }
    const sleep = lastNightsSleep.data as any;
    if (sleep?.id) {
      entries.push({ id: sleep.id, type: "sleep", summary: `Sleep ${sleep.bedtime || "?"}-${sleep.wake_time || "?"}, quality ${sleep.quality || "?"}`, date: sleep.date });
    }
    for (const item of ((activeShoppingList.data as any)?.items ?? []) as any[]) {
      if (item.is_checked) continue;
      entries.push({ id: item.id, type: "shopping_item", summary: item.name });
    }
    return entries.slice(0, 30);
  }, [todaysMeals.data, todaysSymptoms.data, todaysSupplements.data, lastNightsSleep.data, activeShoppingList.data]);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"chat" | "conversation_v3">("conversation_v3");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [actions, setActions] = useState<UiAction[]>([]);
  const actionsRef = useRef<UiAction[]>([]);

  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const voicePhaseRef = useRef<VoicePhase>("idle");
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const handsFree = mode !== "chat";

  const [isListening, setIsListening] = useState(false);
  const speechRef = useRef<any>(null);
  const listeningDesiredRef = useRef(false);
  const dictationFinalRef = useRef<string>("");
  const restartBackoffMsRef = useRef<number>(150);
  const listeningPurposeRef = useRef<"dictation" | "consent">("dictation");
  const silenceTimerRef = useRef<number | null>(null);
  const lastTranscriptAtRef = useRef<number>(0);
  const consentBufferRef = useRef<string>("");
  const handleConsentTextRef = useRef<(text: string) => void>(() => {});
  const pendingVoiceConfirmRef = useRef(false);
  const skipConsentInterceptRef = useRef(false);
  // Lock that prevents new submissions while an apply flow is in progress.
  // Unlike voicePhase, this ref is NOT overwritten by speak() or barge-in.
  const applyFlowActiveRef = useRef(false);
  const speakEnabledRef = useRef(true);
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});
  const submitRef = useRef<(text?: string, source?: "typed" | "speech") => void>(() => {});
  const inputRef = useRef(input);
  const assistantSessionIdRef = useRef<string | null>(null);
  const assistantTurnIdRef = useRef<string | null>(null);
  const assistantCorrelationIdRef = useRef<string | null>(null);

  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("disconnected");
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [remoteAudioStream, setRemoteAudioStream] = useState<MediaStream | null>(null);
  const [needsAudioTap, setNeedsAudioTap] = useState(false);
  const audioTapNotifiedRef = useRef(false);
  const realtimeVoiceRef = useRef<string>("marin");
  const rtcPeerRef = useRef<RTCPeerConnection | null>(null);
  const rtcDataChannelRef = useRef<RTCDataChannel | null>(null);
  const rtcLocalStreamRef = useRef<MediaStream | null>(null);
  const rtcRemoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const realtimeTranscribePendingRef = useRef(false);
  const realtimeTranscribeTextRef = useRef<string>("");
  const realtimeTranscribeTimerRef = useRef<number | null>(null);
  const realtimeTranscriptionDeltaByItemRef = useRef<Record<string, string>>({});

  const hasAnySelected = useMemo(() => actions.some((a) => a.selected), [actions]);
  const hasAnyActions = actions.some((a) => a.status !== "applied");
  const actionsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  // Auto-scroll to actions section when new non-applied actions appear.
  useEffect(() => {
    if (actions.some((a) => a.status === "ready")) {
      actionsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [actions]);

  useEffect(() => {
    voicePhaseRef.current = voicePhase;
  }, [voicePhase]);

  useEffect(() => {
    speakEnabledRef.current = speechEnabled;
  }, [speechEnabled]);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const supportsTts = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      typeof window.speechSynthesis !== "undefined" &&
      typeof (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance !== "undefined"
    );
  }, []);

  const supportsRealtime = useMemo(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as { RTCPeerConnection?: unknown };
    return Boolean(w.RTCPeerConnection && navigator.mediaDevices?.getUserMedia);
  }, []);

  useEffect(() => {
    events.init();
    if (typeof window === "undefined") return;
    events.setBaseContext({
      app: "tibera-health",
      path: window.location.pathname,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!assistantSessionIdRef.current) return;
    events.emit("ui.assistant.mode_changed", { mode }, { session_id: assistantSessionIdRef.current });
  }, [mode, open]);

  useEffect(() => {
    if (!open) {
      const sessionId = assistantSessionIdRef.current;
      if (sessionId) {
        events.emit("ui.assistant.close", { mode }, { session_id: sessionId });
      }
      assistantSessionIdRef.current = null;
      assistantTurnIdRef.current = null;
      assistantCorrelationIdRef.current = null;
      events.setSessionId(null);
      return;
    }

    // Reset conversation state on fresh open
    setMessages([]);
    setPlanMessage(null);
    setActions([]);
    setInput("");
    setIsPlanning(false);
    setVoicePhase("idle");
    actionsRef.current = [];

    const sessionId = uuid();
    assistantSessionIdRef.current = sessionId;
    events.setSessionId(sessionId);
    events.emit("ui.assistant.open", { mode }, { session_id: sessionId });
  }, [open]);

  useEffect(() => {
    if (!remoteAudioStream) return;
    const audioEl = rtcRemoteAudioRef.current;
    if (!audioEl) return;
    try {
      audioEl.srcObject = remoteAudioStream;
      audioEl.muted = false;
      audioEl.volume = 1.0;
      void audioEl
        .play()
        .then(() => {
          audioTapNotifiedRef.current = false;
          setNeedsAudioTap(false);
        })
        .catch(() => {
          setNeedsAudioTap(true);
          if (!audioTapNotifiedRef.current) {
            audioTapNotifiedRef.current = true;
            toast.error("Audio is blocked by the browser. Click “Enable audio”.");
          }
        });
    } catch {
      setNeedsAudioTap(true);
    }
  }, [remoteAudioStream, toast]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current != null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearRealtimeTranscribeTimer = useCallback(() => {
    if (realtimeTranscribeTimerRef.current != null) {
      window.clearTimeout(realtimeTranscribeTimerRef.current);
      realtimeTranscribeTimerRef.current = null;
    }
  }, []);

  const sendRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    const dc = rtcDataChannelRef.current;
    if (!dc || dc.readyState !== "open") return false;
    const eventId =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `evt_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    dc.send(JSON.stringify({ event_id: eventId, ...event }));
    return true;
  }, []);

  const stopSpeaking = useCallback(() => {
    // Stop in-flight TTS fetch
    try {
      ttsAbortRef.current?.abort();
      ttsAbortRef.current = null;
    } catch { /* ignore */ }

    // Stop TTS audio playback
    const audio = ttsAudioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
        if (audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
      } catch { /* ignore */ }
      ttsAudioRef.current = null;
    }

    // Also cancel browser speechSynthesis fallback
    if (typeof window === "undefined") return;
    if (!supportsTts) return;
    try {
      window.speechSynthesis.cancel();
    } catch { /* ignore */ }
  }, [supportsTts]);

  const disconnectRealtime = useCallback(() => {
    // Stop any in-progress TTS audio
    try {
      ttsAbortRef.current?.abort();
      ttsAbortRef.current = null;
    } catch { /* ignore */ }
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
        if (ttsAudioRef.current.src.startsWith("blob:")) URL.revokeObjectURL(ttsAudioRef.current.src);
      } catch { /* ignore */ }
      ttsAudioRef.current = null;
    }

    realtimeTranscribePendingRef.current = false;
    realtimeTranscribeTextRef.current = "";
    setRemoteAudioStream(null);
    setNeedsAudioTap(false);
    audioTapNotifiedRef.current = false;
    if (realtimeTranscribeTimerRef.current != null) {
      try {
        window.clearTimeout(realtimeTranscribeTimerRef.current);
      } catch {
        // ignore
      }
      realtimeTranscribeTimerRef.current = null;
    }

    try {
      rtcDataChannelRef.current?.close();
    } catch {
      // ignore
    }
    rtcDataChannelRef.current = null;

    try {
      rtcPeerRef.current?.getSenders().forEach((sender) => sender.track?.stop());
      rtcPeerRef.current?.close();
    } catch {
      // ignore
    }
    rtcPeerRef.current = null;

    try {
      rtcLocalStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    rtcLocalStreamRef.current = null;

    setRealtimeStatus("disconnected");
    setRealtimeError(null);
    events.emit("voice.realtime.disconnected", {}, { session_id: assistantSessionIdRef.current });
    listeningDesiredRef.current = false;
    setIsListening(false);
  }, []);

  const handleRealtimeTranscript = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      clearRealtimeTranscribeTimer();
      lastTranscriptAtRef.current = Date.now();

      if (voicePhaseRef.current === "awaiting_consent") {
        handleConsentTextRef.current(text);
        return;
      }

      // Ignore transcripts while an apply flow is in progress — the lock survives
      // across voicePhase changes (speak sets "speaking", barge-in sets "dictating")
      if (applyFlowActiveRef.current) {
        return;
      }

      pendingVoiceConfirmRef.current = true;
      setVoicePhase("dictating");
      submitRef.current(text, "speech");
    },
    []
  );

  const handleRealtimeEvent = useCallback(
    (event: any) => {
      const type = typeof event?.type === "string" ? event.type : "";

      if (type === "input_audio_buffer.speech_started") {
        // Allow barge-in during speaking, but NOT during applying (protect the auto-apply flow)
        if (voicePhaseRef.current === "speaking") {
          stopSpeaking();
          setVoicePhase("dictating");
        }
        return;
      }

      if (type === "input_audio_buffer.speech_stopped") {
        // If the session doesn't emit transcription events, request a text-only transcript for the last utterance.
        clearRealtimeTranscribeTimer();
        realtimeTranscribeTimerRef.current = window.setTimeout(() => {
          if (voicePhaseRef.current === "speaking") return;
          const recently = Date.now() - lastTranscriptAtRef.current < 800;
          if (recently) return;
          if (realtimeTranscribePendingRef.current) return;
          realtimeTranscribePendingRef.current = true;
          realtimeTranscribeTextRef.current = "";
          sendRealtimeEvent({
            type: "response.create",
            response: {
              output_modalities: ["text"],
              max_output_tokens: 256,
              instructions:
                "Transcribe the user's last spoken utterance verbatim. Return only the transcript text with no extra commentary.",
            },
          });
        }, 600);
        return;
      }

      // Prefer built-in transcription events when available.
      if (type === "conversation.item.input_audio_transcription.delta" && typeof event?.delta === "string") {
        clearRealtimeTranscribeTimer();
        lastTranscriptAtRef.current = Date.now();

        const itemId = typeof event?.item_id === "string" ? event.item_id : "unknown";
        const next = (realtimeTranscriptionDeltaByItemRef.current[itemId] || "") + event.delta;
        realtimeTranscriptionDeltaByItemRef.current[itemId] = next;

        if (voicePhaseRef.current === "dictating") setInput(next.trim());
        return;
      }

      if (type === "conversation.item.input_audio_transcription.completed" && typeof event?.transcript === "string") {
        const itemId = typeof event?.item_id === "string" ? event.item_id : "unknown";
        delete realtimeTranscriptionDeltaByItemRef.current[itemId];
          handleRealtimeTranscript(event.transcript);
        return;
      }

      // Fallback path: when we explicitly ask for a text-only response for transcription.
      if (realtimeTranscribePendingRef.current) {
        if (type === "response.text.delta" && typeof event?.delta === "string") {
          realtimeTranscribeTextRef.current += event.delta;
          return;
        }
        if (type === "response.text.done" && typeof event?.text === "string") {
          realtimeTranscribePendingRef.current = false;
          const transcript = event.text;
          realtimeTranscribeTextRef.current = "";
          handleRealtimeTranscript(transcript);
          return;
        }
      }

      if (type === "response.done") {
        // Safety net for transcription fallback path
        if (realtimeTranscribePendingRef.current) {
          realtimeTranscribePendingRef.current = false;
          const fallbackText = realtimeTranscribeTextRef.current.trim();
          realtimeTranscribeTextRef.current = "";
          if (fallbackText) handleRealtimeTranscript(fallbackText);
        }
      }
    },
    [clearRealtimeTranscribeTimer, handleRealtimeTranscript, sendRealtimeEvent, stopSpeaking]
  );

  const connectRealtime = useCallback(async () => {
    if (!supportsRealtime) {
      toast.error("Realtime voice not supported in this browser");
      return;
    }
    if (realtimeStatus === "connecting" || realtimeStatus === "connected") return;

    setRealtimeStatus("connecting");
    setRealtimeError(null);

    try {
      const tokenResp = await fetch("/api/openai/realtime-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const tokenJson = (await tokenResp.json()) as any;
      if (!tokenJson?.success) throw new Error(tokenJson?.error || "Failed to get realtime token");

      const key = tokenJson?.data?.value as string;
      const model = (tokenJson?.data?.model as string) || "gpt-realtime";
      const voice = (tokenJson?.data?.voice as string) || "marin";
      realtimeVoiceRef.current = voice;

      const pc = new RTCPeerConnection();
      rtcPeerRef.current = pc;

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "failed" || state === "disconnected" || state === "closed") {
          setRealtimeStatus("error");
          setRealtimeError(`Realtime connection ${state}`);
          listeningDesiredRef.current = false;
          setIsListening(false);
        }
      };

      pc.ontrack = (e) => {
        const stream = e.streams?.[0];
        if (stream) setRemoteAudioStream(stream);
      };

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as any,
      });
      rtcLocalStreamRef.current = localStream;
      for (const track of localStream.getTracks()) {
        track.enabled = listeningDesiredRef.current;
        pc.addTrack(track, localStream);
      }

      const dc = pc.createDataChannel("oai-events");
      rtcDataChannelRef.current = dc;

      dc.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          handleRealtimeEvent(msg);
        } catch {
          // ignore
        }
      };

      dc.onopen = () => {
        setRealtimeStatus("connected");
        if (listeningDesiredRef.current) setIsListening(true);
        events.emit("voice.realtime.connected", { voice, model }, { session_id: assistantSessionIdRef.current });

        // Keep the realtime model silent by default; the app explicitly requests spoken responses.
        setNeedsAudioTap(false);
        sendRealtimeEvent({
          type: "session.update",
          session: {
            type: "realtime",
            audio: {
              input: {
                transcription: { model: "gpt-4o-transcribe", language: "en" },
                noise_reduction: { type: "near_field" },
                turn_detection: {
                  type: "server_vad",
                  create_response: false,
                  interrupt_response: true,
                  silence_duration_ms: 650,
                },
              },
            },
            instructions:
              "You are a transcription-only session. Do not generate any responses unless explicitly requested via the data channel.",
          },
        });
      };

      dc.onclose = () => {
        setRealtimeStatus("disconnected");
        listeningDesiredRef.current = false;
        setIsListening(false);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`,
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/sdp",
          },
        }
      );
      const sdp = await sdpResponse.text();
      if (!sdpResponse.ok) {
        throw new Error(`OpenAI Realtime SDP error: ${sdpResponse.status}${sdp ? `: ${sdp}` : ""}`);
      }

      await pc.setRemoteDescription({ type: "answer", sdp });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start realtime voice";
      events.emit("voice.realtime.error", { error: message }, { session_id: assistantSessionIdRef.current, privacy_level: "sensitive" });
      disconnectRealtime();
      setRealtimeStatus("error");
      setRealtimeError(message);
      toast.error(message);
    }
  }, [disconnectRealtime, handleRealtimeEvent, realtimeStatus, sendRealtimeEvent, supportsRealtime, toast]);

  const speak = useCallback(
    async (text: string) => {
      if (mode === "chat") return;
      if (!speakEnabledRef.current) return;

      stopSpeaking();
      setVoicePhase("speaking");

      // Path 1: OpenAI TTS API
      try {
        const abort = new AbortController();
        ttsAbortRef.current = abort;

        const resp = await fetch("/api/openai/text-to-speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: abort.signal,
        });

        if (!resp.ok) throw new Error(`TTS failed: ${resp.status}`);

        const blob = await resp.blob();
        if (abort.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        ttsAudioRef.current = audio;

        await new Promise<void>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(url);
            ttsAudioRef.current = null;
            ttsAbortRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            ttsAudioRef.current = null;
            ttsAbortRef.current = null;
            resolve();
          };
          audio.play().catch(() => {
            URL.revokeObjectURL(url);
            ttsAudioRef.current = null;
            ttsAbortRef.current = null;
            resolve();
          });
        });

        if (voicePhaseRef.current === "speaking") setVoicePhase("idle");
        return;
      } catch (err) {
        ttsAbortRef.current = null;
        ttsAudioRef.current = null;
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Fall through to browser speechSynthesis
      }

      // Path 2: Browser speechSynthesis fallback
      if (!supportsTts) {
        if (voicePhaseRef.current === "speaking") setVoicePhase("idle");
        return;
      }
      stopListeningRef.current();

      await new Promise<void>((resolve) => {
        try {
          const Utter = (window as unknown as { SpeechSynthesisUtterance: any }).SpeechSynthesisUtterance;
          const utter = new Utter(text);
          utter.rate = 1.02;
          utter.pitch = 1.0;
          utter.onend = () => resolve();
          utter.onerror = () => resolve();
          window.speechSynthesis.speak(utter);
        } catch {
          resolve();
        }
      });

      if (voicePhaseRef.current === "speaking") setVoicePhase("idle");
    },
    [mode, stopSpeaking, supportsTts]
  );

  const describeActionsForSpeech = useCallback((plannedActions: UiAction[]) => {
    const parts: string[] = [];
    for (const a of plannedActions) {
      if (!a.selected) continue;
      const verb = a.operation === "edit" ? "Update" : a.operation === "delete" ? "Delete" : "Log";

      if (a.type === "log_meal" || a.type === "edit_meal") {
        const mealType = a.data.mealType || defaultMealTypeFromClock();
        const items = a.data.items
          .map((it) => it.label.trim() || it.usdaQuery.trim())
          .filter(Boolean)
          .slice(0, 6)
          .join(", ");
        parts.push(`${verb} ${mealType}: ${items}.`);
      } else if (a.type === "log_symptom" || a.type === "edit_symptom") {
        parts.push(`${verb} symptom: ${a.data.symptom}.`);
      } else if (a.type === "log_supplement" || a.type === "edit_supplement") {
        const dose =
          a.data.dosage != null && a.data.unit
            ? `${a.data.dosage} ${a.data.unit}`
            : undefined;
        parts.push(`${verb} ${a.data.supplement}${dose ? `, ${dose}` : ""}.`);
      } else if (a.type === "log_sleep" || a.type === "edit_sleep") {
        const times = `${a.data.bedtime || "?"} to ${a.data.wake_time || "?"}`;
        const qual = a.data.quality ? `, quality ${a.data.quality}` : "";
        parts.push(`${verb} sleep: ${times}${qual}.`);
      } else if (a.type === "add_shopping_item" || a.type === "edit_shopping_item") {
        const qty = a.data.quantity != null && a.data.unit ? `${a.data.quantity} ${a.data.unit} ` : "";
        parts.push(`${verb} shopping item: ${qty}${a.data.name}.`);
      } else if (a.type === "delete_entry") {
        parts.push(`Delete ${a.data.entryType} entry.`);
      }
    }
    return parts.join(" ");
  }, []);

  const hasUnresolvedMealMatches = useCallback((plannedActions: UiAction[]) => {
    return plannedActions.some((a) => {
      if (!a.selected) return false;
      if (a.type !== "log_meal" && a.type !== "edit_meal") return false;
      return a.data.items.some((it) => !it.matchedFood);
    });
  }, []);

  const waitForMealMatches = useCallback(
    async (timeoutMs: number) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (!hasUnresolvedMealMatches(actionsRef.current)) return true;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 250));
      }
      return !hasUnresolvedMealMatches(actionsRef.current);
    },
    [hasUnresolvedMealMatches]
  );

  const replaceMealItems = useCallback(
    async (mealLogId: string, uiItems: UiMealItem[]) => {
      const existing = await getMealLogById(mealLogId);
      const existingIds = (existing?.meal_items ?? []).map((it: any) => it.id).filter(Boolean) as string[];

      for (const id of existingIds) {
        // eslint-disable-next-line no-await-in-loop
        await deleteMealItem.mutateAsync(id);
      }

      for (const item of uiItems) {
        const servings = item.servings;
        const baseName = item.label.trim() || item.matchedFood?.description || "Unknown food";
        const custom_food_name = baseName;
        const household = parseHouseholdServing(item.matchedFood?.householdServingFullText);
        const unitNorm = household ? canonicalUnitForMatch(household.unit) : "";
        const qtyNorm = item.quantityUnit ? canonicalUnitForMatch(item.quantityUnit) : "";
        let custom_food_nutrients = item.matchedFood ? transformNutrients(item.matchedFood.nutrients) : undefined;
        if (custom_food_nutrients && qtyNorm && item.quantityUnit && household && household.count > 1 && (unitNorm.includes(qtyNorm) || qtyNorm.includes(unitNorm))) {
          custom_food_nutrients = Object.fromEntries(
            Object.entries(custom_food_nutrients).map(([k, v]) => [k, typeof v === "number" ? v / household.count : v])
          ) as Record<string, number>;
        }

        // eslint-disable-next-line no-await-in-loop
        await addMealItem.mutateAsync({
          mealLogId,
          item: {
            custom_food_name,
            original_food_name: custom_food_name,
            custom_food_nutrients,
            servings,
            grams_consumed: inferGramsConsumedFromQuantity(item),
            quantity_count: item.quantityCount ?? null,
            quantity_unit: item.quantityUnit ?? null,
            matched_fdc_id: item.matchedFood?.fdcId ?? null,
            matched_food_name: item.matchedFood?.description ?? null,
            matched_data_type: item.selectedCandidate?.dataType ?? null,
            matched_brand_owner: item.selectedCandidate?.brandOwner ?? item.matchedFood?.brandOwner ?? null,
            match_method: item.matchedByUser ? "assistant_override" : "assistant_auto",
            match_confidence: null,
            match_context: {
              usdaQuery: item.usdaQuery,
              label: item.label,
              selectedCandidate: item.selectedCandidate ?? null,
            },
            match_updated_at: new Date().toISOString(),
          },
        });
      }
    },
    [addMealItem, deleteMealItem]
  );

  const startConsentListening = useCallback(() => {
    if (mode === "chat") return;
    listeningPurposeRef.current = "consent";
    consentBufferRef.current = "";
    setVoicePhase("awaiting_consent");
    startListeningRef.current();
  }, [mode]);

  const resolveMealItem = useCallback(async (actionId: string, itemKey: string) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== actionId || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
        return {
          ...a,
          data: {
            ...a.data,
            items: a.data.items.map((it) =>
              it.key === itemKey ? { ...it, isResolving: true, resolveError: undefined } : it
            ),
          },
        };
      })
    );

    const action = actionsRef.current.find((a) => a.id === actionId);
    if (!action || (action.type !== "log_meal" && action.type !== "edit_meal")) return;
    const item = action.data.items.find((i) => i.key === itemKey);
    if (!item) return;

    try {
      const overrideQuery = item.usdaQuery.trim() || item.label.trim();
      if (overrideQuery) {
        const overrideFdcId = await getFoodResolutionOverride(overrideQuery).catch(() => null);
        if (overrideFdcId) {
          const food = await getFoodDetails(overrideFdcId).catch(() => null);
          if (food) {
            setActions((prev) =>
              prev.map((a) => {
                if (a.id !== actionId || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
                return {
                  ...a,
                  data: {
                    ...a.data,
                    items: a.data.items.map((it) => {
                      if (it.key !== itemKey) return it;
                      const servingsAuto = servingsFromGrams(food, it.gramsConsumed);
                      const candidate: FoodSearchResult = { fdcId: food.fdcId, description: food.description, score: 1 };
                      return {
                        ...it,
                        candidates: [candidate, ...it.candidates.filter((c) => c.fdcId !== candidate.fdcId)],
                        selectedCandidate: candidate,
                        matchedFood: food,
                        servings: servingsAuto != null ? roundServings(servingsAuto) : it.servings,
                        matchedByUser: false,
                        isResolving: false,
                        resolveError: undefined,
                      };
                    }),
                  },
                };
              })
            );
            return;
          }
        }
      }

      const sorted = await smartSearchFoods(item.usdaQuery, 18);
      let candidates = sorted;
      if (overrideQuery && sorted.length >= 2) {
        const nano = await rerankUsdaCandidates({
          query: overrideQuery,
          candidates: sorted.map((c) => ({
            fdcId: c.fdcId,
            description: c.description,
            dataType: c.dataType,
            brandOwner: c.brandOwner,
          })),
        }).catch(() => null);
        if (nano?.fdcId && sorted.some((c) => c.fdcId === nano.fdcId)) {
          candidates = [sorted.find((c) => c.fdcId === nano.fdcId)!, ...sorted.filter((c) => c.fdcId !== nano.fdcId)];
        }
      }

      const { selectedCandidate, food } = await resolveFirstValidFood(candidates);

      setActions((prev) =>
        prev.map((a) => {
          if (a.id !== actionId || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
          return {
            ...a,
            data: {
              ...a.data,
              items: a.data.items.map((it) => {
                if (it.key !== itemKey) return it;
                const servingsAuto = servingsFromGrams(food, it.gramsConsumed);
                return {
                  ...it,
                  candidates: sorted,
                  selectedCandidate,
                  matchedFood: food,
                  servings: servingsAuto != null ? roundServings(servingsAuto) : it.servings,
                  matchedByUser: false,
                  isResolving: false,
                  resolveError: food ? undefined : "No USDA match found",
                };
              }),
            },
          };
        })
      );
    } catch (err) {
      setActions((prev) =>
        prev.map((a) => {
          if (a.id !== actionId || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
          return {
            ...a,
            data: {
              ...a.data,
              items: a.data.items.map((it) =>
                it.key === itemKey
                  ? {
                      ...it,
                      isResolving: false,
                      resolveError: err instanceof Error ? err.message : "Failed to search USDA",
                    }
                  : it
              ),
            },
          };
        })
      );
    }
  }, []);

  const resolveAllMeals = useCallback(async (nextActions: UiAction[]) => {
    const work: Array<{ actionId: string; itemKey: string }> = [];
    for (const a of nextActions) {
      if (a.type !== "log_meal" && a.type !== "edit_meal") continue;
      for (const item of a.data.items) {
        if (!item.usdaQuery.trim()) continue;
        work.push({ actionId: a.id, itemKey: item.key });
      }
    }

    const concurrency = 3;
    let index = 0;

    const workers = Array.from({ length: Math.min(concurrency, work.length) }).map(async () => {
      while (true) {
        const i = index;
        index += 1;
        const job = work[i];
        if (!job) break;
        // eslint-disable-next-line no-await-in-loop
        await resolveMealItem(job.actionId, job.itemKey);
      }
    });

    await Promise.all(workers);
  }, [resolveMealItem]);

  const stopListening = useCallback(() => {
    listeningDesiredRef.current = false;
    clearSilenceTimer();

    if (mode !== "chat") {
      clearRealtimeTranscribeTimer();
      try {
        rtcLocalStreamRef.current?.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
      } catch {
        // ignore
      }
      setIsListening(false);
      if (voicePhaseRef.current === "dictating") setVoicePhase("idle");
      return;
    }

    if (speechRef.current) {
      try {
        speechRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    speechRef.current = null;
    if (voicePhaseRef.current === "dictating") setVoicePhase("idle");
  }, [clearRealtimeTranscribeTimer, clearSilenceTimer, mode]);

  const startListening = useCallback(() => {
    if (mode !== "chat") {
      if (!supportsRealtime) {
        toast.error("Realtime voice not supported in this browser");
        return;
      }

      if (listeningDesiredRef.current) return;
      listeningDesiredRef.current = true;
      setIsListening(true);

      if (listeningPurposeRef.current === "dictation") {
        setVoicePhase("dictating");
      } else {
        setVoicePhase("awaiting_consent");
      }

      void connectRealtime();
      try {
        rtcLocalStreamRef.current?.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
      } catch {
        // ignore
      }
      return;
    }

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Dictation not supported in this browser");
      return;
    }

    if (listeningDesiredRef.current) return;
    listeningDesiredRef.current = true;
    setIsListening(true);
    restartBackoffMsRef.current = 150;

    if (listeningPurposeRef.current === "dictation") {
      const cur = inputRef.current;
      dictationFinalRef.current = cur.trim() ? `${cur.trim()} ` : "";
      lastTranscriptAtRef.current = Date.now();
      setVoicePhase("dictating");
    } else {
      consentBufferRef.current = "";
    }

    const recognition = new SpeechRecognition();
    speechRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          if (listeningPurposeRef.current === "consent") consentBufferRef.current += transcript;
          else dictationFinalRef.current += transcript;
        } else interim += transcript;
      }

      lastTranscriptAtRef.current = Date.now();

      if (listeningPurposeRef.current === "consent") {
        const merged = `${consentBufferRef.current}${interim}`.trim();
        const lastIsFinal = Boolean(event.results?.[event.results.length - 1]?.isFinal);
        if (lastIsFinal && merged) handleConsentTextRef.current(merged);
        return;
      }

      const merged = `${dictationFinalRef.current}${interim}`.trim();
      if (merged) setInput(merged);

      if (handsFree) {
        clearSilenceTimer();
        silenceTimerRef.current = window.setTimeout(() => {
          if (!handsFree) return;
          if (voicePhaseRef.current !== "dictating") return;
          const elapsed = Date.now() - lastTranscriptAtRef.current;
          if (elapsed < 1000) return;
          const text = (dictationFinalRef.current || inputRef.current).trim();
          if (!text) return;
          pendingVoiceConfirmRef.current = true;
          stopListening();
          submitRef.current(text, "speech");
        }, 1250);
      }
    };

    recognition.onerror = (event: any) => {
      const err = (event?.error as string | undefined) || "unknown";
      if (err === "not-allowed" || err === "service-not-allowed" || err === "audio-capture") {
        listeningDesiredRef.current = false;
        setIsListening(false);
        speechRef.current = null;
        toast.error("Mic unavailable for dictation");
      }
      // For transient errors, allow onend to auto-restart if still desired.
    };

    recognition.onend = () => {
      speechRef.current = null;
      if (!listeningDesiredRef.current) {
        setIsListening(false);
        return;
      }

      // Web Speech often ends unexpectedly; auto-restart while the user wants to keep listening.
      const backoff = restartBackoffMsRef.current;
      restartBackoffMsRef.current = Math.min(1500, Math.round(backoff * 1.6));

      window.setTimeout(() => {
        if (!listeningDesiredRef.current) return;
        try {
          const r = new SpeechRecognition();
          speechRef.current = r;
          r.continuous = true;
          r.interimResults = true;
          r.lang = "en-US";
          r.onresult = recognition.onresult;
          r.onerror = recognition.onerror;
          r.onend = recognition.onend;
          r.start();
        } catch {
          listeningDesiredRef.current = false;
          setIsListening(false);
          speechRef.current = null;
        }
      }, backoff);
    };

    try {
      recognition.start();
    } catch {
      listeningDesiredRef.current = false;
      setIsListening(false);
      speechRef.current = null;
    }
  }, [clearSilenceTimer, connectRealtime, handsFree, mode, stopListening, supportsRealtime, toast]);

  useEffect(() => {
    startListeningRef.current = startListening;
    stopListeningRef.current = stopListening;
  }, [startListening, stopListening]);

  useEffect(() => {
    if (!open) {
      stopListening();
      stopSpeaking();
      disconnectRealtime();
      setVoicePhase("idle");
      return;
    }

    if (mode !== "chat") {
      // Voice-first: start listening as soon as the modal opens (gesture already occurred).
      if (handsFree && voicePhaseRef.current === "idle" && !isListening) {
        listeningPurposeRef.current = "dictation";
        startListening();
      }
    } else {
      // Chat mode should never auto-start listening.
      stopListening();
      disconnectRealtime();
      setVoicePhase("idle");
    }
  }, [disconnectRealtime, handsFree, isListening, mode, open, startListening, stopListening, stopSpeaking]);

  const applySelected = useCallback(async (): Promise<ApplySelectedResult> => {
    const selectedActions = actionsRef.current.filter((a) => a.selected);
    if (selectedActions.length === 0) return { ok: true, appliedIds: [] };

    const sessionId = assistantSessionIdRef.current;
    events.emit(
      "assistant.apply.start",
      { turn_id: assistantTurnIdRef.current, selected_count: selectedActions.length },
      { session_id: sessionId }
    );

    setActions((prev) => prev.map((a) => (a.selected ? { ...a, status: "applying", error: undefined } : a)));

    const captureEntryId = (actionId: string, entryId: string) => {
      setActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, entryId } : a)));
      // Keep ref in sync for downstream reads
      const idx = actionsRef.current.findIndex((a) => a.id === actionId);
      if (idx !== -1) actionsRef.current[idx] = { ...actionsRef.current[idx], entryId };
    };

    const appliedIds: string[] = [];
    try {
      for (const action of selectedActions) {
        if ((action.operation === "edit" || action.operation === "delete") && !action.entryId) {
          throw new Error(`Missing entry reference for: ${action.title}`);
        }

        // ── Create: meals ──
        if (action.type === "log_meal") {
          const date = action.data.date || localDateISO();
          const mealType = action.data.mealType || defaultMealTypeFromClock();

          const result = await createMealLog.mutateAsync({
            date,
            meal_type: mealType,
            notes: action.data.notes,
            items: action.data.items.map((item) => {
              const servings = item.servings;
              const baseName = item.label.trim() || item.matchedFood?.description || "Unknown food";
              const custom_food_name = baseName;
              const household = parseHouseholdServing(item.matchedFood?.householdServingFullText);
              const unitNorm = household ? canonicalUnitForMatch(household.unit) : "";
              const qtyNorm = item.quantityUnit ? canonicalUnitForMatch(item.quantityUnit) : "";
              let custom_food_nutrients = item.matchedFood ? transformNutrients(item.matchedFood.nutrients) : undefined;
              if (custom_food_nutrients && qtyNorm && item.quantityUnit && household && household.count > 1 && (unitNorm.includes(qtyNorm) || qtyNorm.includes(unitNorm))) {
                custom_food_nutrients = Object.fromEntries(
                  Object.entries(custom_food_nutrients).map(([k, v]) => [k, typeof v === "number" ? v / household.count : v])
                ) as Record<string, number>;
              }
              return {
                custom_food_name,
                original_food_name: custom_food_name,
                custom_food_nutrients,
                servings,
                grams_consumed: inferGramsConsumedFromQuantity(item),
                quantity_count: item.quantityCount ?? null,
                quantity_unit: item.quantityUnit ?? null,
                matched_fdc_id: item.matchedFood?.fdcId ?? null,
                matched_food_name: item.matchedFood?.description ?? null,
                matched_data_type: item.selectedCandidate?.dataType ?? null,
                matched_brand_owner: item.selectedCandidate?.brandOwner ?? item.matchedFood?.brandOwner ?? null,
                match_method: item.matchedByUser ? "assistant_override" : "assistant_auto",
                match_confidence: null,
                match_context: {
                  usdaQuery: item.usdaQuery,
                  label: item.label,
                  selectedCandidate: item.selectedCandidate ?? null,
                },
                match_updated_at: new Date().toISOString(),
              };
            }),
          });
          const entryId = (result as any)?.id as string | undefined;
          if (!entryId) throw new Error("Meal log did not return an id");
          captureEntryId(action.id, entryId);

          // Best-effort: write match audits for each inserted meal item.
          const dbItems = ((result as any)?.meal_items ?? []) as Array<any>;
          if (Array.isArray(dbItems) && dbItems.length > 0) {
            const uiItems = action.data.items;
            for (let i = 0; i < Math.min(dbItems.length, uiItems.length); i++) {
              const dbItem = dbItems[i];
              const uiItem = uiItems[i];
              if (!dbItem?.id) continue;
              void insertFoodMatchAudit({
                mealItemId: dbItem.id,
                source: "assistant",
                queryText: uiItem.usdaQuery || uiItem.label,
                queryNorm: null,
                candidates: uiItem.candidates ?? null,
                selected: uiItem.matchedFood
                  ? {
                      fdcId: uiItem.matchedFood.fdcId,
                      description: uiItem.matchedFood.description,
                      dataType: uiItem.selectedCandidate?.dataType ?? null,
                      brandOwner: uiItem.selectedCandidate?.brandOwner ?? uiItem.matchedFood.brandOwner ?? null,
                    }
                  : null,
                model: null,
              }).catch(() => {});
            }
          }
        }

        // ── Edit: meals ──
        if (action.type === "edit_meal") {
          if (!action.entryId) throw new Error("Missing meal id to edit");
          const updates: any = {};
          if (action.data.date) updates.date = action.data.date;
          if (action.data.mealType) updates.meal_type = action.data.mealType;
          if (action.data.notes !== undefined) updates.notes = action.data.notes;
          await updateMealLog.mutateAsync({ id: action.entryId, updates });

          const hasItemEdits = action.data.items.some((it) => Boolean(it.label.trim() || it.usdaQuery.trim()));
          if (hasItemEdits) {
            await replaceMealItems(action.entryId, action.data.items);
          }
        }

        // ── Create: symptoms ──
        if (action.type === "log_symptom") {
          const list = symptomsList.data ?? [];
          const target = normalizeName(action.data.symptom);
          const match = list.find((s: any) => normalizeName((s as any).name) === target) as any | undefined;
          const symptomId =
            match?.id ??
            (await createCustomSymptom.mutateAsync({ name: action.data.symptom.trim(), category: "other" })).id;

          const result = await createSymptomLog.mutateAsync({
            symptom_id: symptomId,
            severity: Math.max(1, Math.min(10, Math.round(action.data.severity ?? 5))),
            logged_at: buildLoggedAtIso({ date: action.data.date, time: action.data.time }),
            notes: action.data.notes,
          });
          const entryId = (result as any)?.id as string | undefined;
          if (!entryId) throw new Error("Symptom log did not return an id");
          captureEntryId(action.id, entryId);
        }

        // ── Edit: symptoms ──
        if (action.type === "edit_symptom") {
          if (!action.entryId) throw new Error("Missing symptom log id to edit");
          const updates: any = {};
          if (action.data.severity != null) updates.severity = Math.max(1, Math.min(10, Math.round(action.data.severity)));
          if (action.data.date || action.data.time) updates.logged_at = buildLoggedAtIso({ date: action.data.date, time: action.data.time });
          if (action.data.notes !== undefined) updates.notes = action.data.notes;
          await updateSymptomLog.mutateAsync({ id: action.entryId, updates });
        }

        // ── Create: supplements ──
        if (action.type === "log_supplement") {
          const list = supplementsList.data ?? [];
          const target = normalizeName(action.data.supplement);
          const match = list.find((s: any) => normalizeName((s as any).name) === target) as any | undefined;

          const unitRaw = (action.data.unit || "serving").trim();
          const unitStrengthNorm = normalizeStrengthUnit(unitRaw) || "";
          const unitDoseNorm = normalizeDoseUnit(unitRaw) || "";
          const strengthUnit =
            action.data.strengthUnit ??
            (unitStrengthNorm && ["mg", "mcg", "g", "iu", "cfu"].includes(unitStrengthNorm) ? unitStrengthNorm : null);
          const doseUnit =
            action.data.doseUnit ??
            (unitDoseNorm && !["mg", "mcg", "g", "iu", "cfu"].includes(unitDoseNorm) ? unitDoseNorm : null);
          const strengthAmount =
            action.data.strengthAmount ??
            (strengthUnit && Number.isFinite(action.data.dosage) ? (action.data.dosage as number) : null);
          const doseCount =
            action.data.doseCount ??
            (doseUnit && Number.isFinite(action.data.dosage) ? (action.data.dosage as number) : null);

          const result = await createSupplementLog.mutateAsync({
            supplement_id: match?.id,
            supplement_name: action.data.supplement.trim(),
            dosage: Number.isFinite(action.data.dosage) ? (action.data.dosage as number) : 1,
            unit: unitRaw,
            dose_count: doseCount,
            dose_unit: doseUnit,
            strength_amount: strengthAmount,
            strength_unit: strengthUnit,
            logged_at: buildLoggedAtIso({ date: action.data.date, time: action.data.time }),
            notes: action.data.notes,
          });
          const entryId = (result as any)?.id as string | undefined;
          if (!entryId) throw new Error("Supplement log did not return an id");
          captureEntryId(action.id, entryId);
        }

        // ── Edit: supplements ──
        if (action.type === "edit_supplement") {
          if (!action.entryId) throw new Error("Missing supplement log id to edit");
          const updates: any = {};
          if (action.data.dosage != null) updates.dosage = action.data.dosage;
          if (action.data.unit) updates.unit = action.data.unit;
          if (action.data.doseCount != null) updates.dose_count = action.data.doseCount;
          if (action.data.doseUnit) updates.dose_unit = action.data.doseUnit;
          if (action.data.strengthAmount != null) updates.strength_amount = action.data.strengthAmount;
          if (action.data.strengthUnit) updates.strength_unit = action.data.strengthUnit;
          if (action.data.date || action.data.time) updates.logged_at = buildLoggedAtIso({ date: action.data.date, time: action.data.time });
          if (action.data.notes !== undefined) updates.notes = action.data.notes;
          await updateSupplementLog.mutateAsync({ id: action.entryId, updates });
        }

        // ── Create: sleep ──
        if (action.type === "log_sleep") {
          const result = await upsertSleepLog.mutateAsync({
            date: action.data.date || localDateISO(),
            bedtime: action.data.bedtime || "23:00",
            wake_time: action.data.wake_time || "07:00",
            quality: String(Math.max(1, Math.min(5, Math.round(action.data.quality ?? 3)))) as "1" | "2" | "3" | "4" | "5",
            factors: action.data.factors ?? [],
            notes: action.data.notes,
          });
          const entryId = (result as any)?.id as string | undefined;
          if (!entryId) throw new Error("Sleep log did not return an id");
          captureEntryId(action.id, entryId);
        }

        // ── Edit: sleep ──
        if (action.type === "edit_sleep") {
          if (!action.entryId) throw new Error("Missing sleep log id to edit");
          const updates: any = {};
          if (action.data.bedtime) updates.bedtime = action.data.bedtime;
          if (action.data.wake_time) updates.wake_time = action.data.wake_time;
          if (action.data.quality != null) updates.quality = String(Math.max(1, Math.min(5, Math.round(action.data.quality))));
          if (action.data.factors != null) updates.factors = action.data.factors;
          if (action.data.notes !== undefined) updates.notes = action.data.notes;
          await updateSleepLog.mutateAsync({ id: action.entryId, updates });
        }

        // ── Create: shopping item ──
        if (action.type === "add_shopping_item") {
          let listId = (activeShoppingList.data as any)?.id;
          if (!listId) {
            const newList = await createShoppingList.mutateAsync({ name: "Shopping List", setActive: true });
            listId = (newList as any)?.id;
          }
          if (!listId) throw new Error("Could not find or create a shopping list");

          const result = await addShoppingItem.mutateAsync({
            listId,
            item: {
              name: action.data.name,
              quantity: action.data.quantity ?? undefined,
              unit: action.data.unit ?? undefined,
              category: action.data.category ?? "other",
            },
          });
          const entryId = (result as any)?.id as string | undefined;
          if (!entryId) throw new Error("Shopping item did not return an id");
          captureEntryId(action.id, entryId);
        }

        // ── Edit: shopping item ──
        if (action.type === "edit_shopping_item") {
          if (!action.entryId) throw new Error("Missing shopping item id to edit");
          const updates: any = {};
          if (action.data.name) updates.name = action.data.name;
          if (action.data.quantity != null) updates.quantity = action.data.quantity;
          if (action.data.unit) updates.unit = action.data.unit;
          if (action.data.category) updates.category = action.data.category;
          if (action.data.is_checked != null) updates.is_checked = action.data.is_checked;
          await updateShoppingItem.mutateAsync({ id: action.entryId, updates });
        }

        // ── Delete ──
        if (action.type === "delete_entry") {
          if (!action.entryId) throw new Error("Missing entry id to delete");
          switch (action.data.entryType) {
            case "meal": await deleteMealLog.mutateAsync(action.entryId); break;
            case "symptom": await deleteSymptomLog.mutateAsync(action.entryId); break;
            case "supplement": await deleteSupplementLog.mutateAsync(action.entryId); break;
            case "sleep": await deleteSleepLog.mutateAsync(action.entryId); break;
            case "shopping_item": await deleteShoppingItem.mutateAsync(action.entryId); break;
          }
        }

        appliedIds.push(action.id);
        setActions((prev) =>
          prev.map((a) => (a.id === action.id ? { ...a, status: "applied", selected: false } : a))
        );
      }

      events.emit(
        "assistant.apply.success",
        { turn_id: assistantTurnIdRef.current, applied_count: selectedActions.length },
        { session_id: sessionId }
      );
      events.flushSoon();
      if (assistantTurnIdRef.current) {
        void fetch("/api/assistant/turn/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turnId: assistantTurnIdRef.current, applied: true }),
        });
      }
      toast.success("Applied actions");

      // Push receipt card into messages (stores action IDs, not data snapshot)
      if (appliedIds.length > 0) {
        const summary = describeActionsForSpeech(selectedActions);
        const doneText = `Done — ${summary.replace(/\b(Log|Update|Delete)\b/g, (v) => v === "Log" ? "logged" : v === "Update" ? "updated" : "deleted")}`;
        setMessages((prev) => [...prev, { role: "assistant" as const, text: doneText, receiptIds: appliedIds }]);
      }

      return { ok: true, appliedIds };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply actions";
      events.emit(
        "assistant.apply.error",
        { turn_id: assistantTurnIdRef.current, error: message },
        { session_id: sessionId, privacy_level: "sensitive" }
      );
      events.flushSoon();
      if (assistantTurnIdRef.current) {
        void fetch("/api/assistant/turn/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turnId: assistantTurnIdRef.current, applied: false, applyError: message }),
        });
      }
      toast.error(message);
      setActions((prev) =>
        prev.map((a) => (a.selected && a.status === "applying" ? { ...a, status: "error", error: message } : a))
      );

      return { ok: false, appliedIds, error: message };
    }
  }, [
    activeShoppingList.data, addShoppingItem, createCustomSymptom, createMealLog, createShoppingList,
    createSupplementLog, createSymptomLog, deleteMealLog, deleteShoppingItem, deleteSleepLog,
    deleteSupplementLog, deleteSymptomLog, describeActionsForSpeech, replaceMealItems, supplementsList.data, symptomsList.data, toast,
    updateMealLog, updateShoppingItem, updateSleepLog, updateSupplementLog, updateSymptomLog, upsertSleepLog,
  ]);

  const handleReceiptSave = useCallback(async (actionId: string) => {
    const action = actionsRef.current.find((a) => a.id === actionId);
    if (!action || !action.entryId) return;
    try {
      if (action.type === "log_meal" || action.type === "edit_meal") {
        await updateMealLog.mutateAsync({
          id: action.entryId,
          updates: {
            date: action.data.date || undefined,
            meal_type: action.data.mealType || undefined,
            notes: action.data.notes,
          },
        });

        const hasItemEdits = action.data.items.some((it) => Boolean(it.label.trim() || it.usdaQuery.trim()));
        if (hasItemEdits) {
          await replaceMealItems(action.entryId, action.data.items);
        }
      } else if (action.type === "log_symptom" || action.type === "edit_symptom") {
        await updateSymptomLog.mutateAsync({
          id: action.entryId,
          updates: {
            severity: action.data.severity != null ? Math.max(1, Math.min(10, Math.round(action.data.severity))) : undefined,
            logged_at: (action.data.date || action.data.time) ? buildLoggedAtIso({ date: action.data.date, time: action.data.time }) : undefined,
            notes: action.data.notes,
          },
        });
      } else if (action.type === "log_supplement" || action.type === "edit_supplement") {
        await updateSupplementLog.mutateAsync({
          id: action.entryId,
          updates: {
            dosage: action.data.dosage ?? undefined,
            unit: action.data.unit || undefined,
            logged_at: (action.data.date || action.data.time) ? buildLoggedAtIso({ date: action.data.date, time: action.data.time }) : undefined,
            notes: action.data.notes,
          },
        });
      } else if (action.type === "log_sleep" || action.type === "edit_sleep") {
        await updateSleepLog.mutateAsync({
          id: action.entryId,
          updates: {
            bedtime: action.data.bedtime || undefined,
            wake_time: action.data.wake_time || undefined,
            quality: action.data.quality != null ? String(Math.max(1, Math.min(5, Math.round(action.data.quality)))) as "1" | "2" | "3" | "4" | "5" : undefined,
            factors: action.data.factors ?? undefined,
            notes: action.data.notes,
          },
        });
      } else if (action.type === "add_shopping_item" || action.type === "edit_shopping_item") {
        await updateShoppingItem.mutateAsync({
          id: action.entryId,
          updates: {
            name: action.data.name || undefined,
            quantity: action.data.quantity ?? undefined,
            unit: action.data.unit || undefined,
            category: action.data.category || undefined,
          },
        });
      }
    } catch {
      toast.error("Failed to save change");
    }
  }, [replaceMealItems, toast, updateMealLog, updateShoppingItem, updateSleepLog, updateSupplementLog, updateSymptomLog]);

  const submit = useCallback(
    async (overrideText?: string, source: "typed" | "speech" = "typed") => {
      const text = (overrideText ?? input).trim();
      if (!text || isPlanning) return;

      // Don't allow new submissions while an apply flow is in progress
      if (applyFlowActiveRef.current) return;

      // ── Consent interception: catch "apply it" / "cancel" before hitting the API ──
      const hasPendingActions = actionsRef.current.some((a) => a.selected && a.status === "ready");
      const shouldIntercept = hasPendingActions && !skipConsentInterceptRef.current;
      skipConsentInterceptRef.current = false;
      if (shouldIntercept) {
        const t = text.toLowerCase();
        // Tier 1: High-confidence regex — only obvious, unambiguous words + common phrases
        const isConfirmRegex = /\b(yes|yeah|ok|okay|confirm|apply|sure|yep|yup)\b/.test(t) ||
                               /\b(log|save|do|submit)\s+(it|that)\b/.test(t) ||
                               /\bgo\s+ahead\b/.test(t);
        const isCancelRegex = /\b(no|nope|cancel|stop|never\s*mind)\b/.test(t);

        // Helper: apply pending actions
        const doApply = () => {
          setMessages((prev) => [...prev, { role: "user", text }]);
          setInput("");
          void (async () => {
            try {
              applyFlowActiveRef.current = true;
              setVoicePhase("applying");
              await waitForMealMatches(5000);
              const appliedSummary = describeActionsForSpeech(actionsRef.current.filter((a) => a.status !== "applied"));
              const res = await applySelected();
              if (!res.ok) {
                await speak("Sorry — I couldn't save that. Please check the screen and try again.");
                applyFlowActiveRef.current = false;
                setVoicePhase("idle");
                if (handsFree && open) {
                  listeningPurposeRef.current = "dictation";
                  startListeningRef.current();
                }
                return;
              }
              const msg = `Done — ${appliedSummary.replace(/\b(Log|Update|Delete)\b/g, (v) => v === "Log" ? "logged" : v === "Update" ? "updated" : "deleted")}`;
              await speak(msg);
              applyFlowActiveRef.current = false;
              setVoicePhase("idle");
              if (handsFree && open) {
                listeningPurposeRef.current = "dictation";
                startListeningRef.current();
              }
            } catch (err) {
              applyFlowActiveRef.current = false;
              console.error("Consent-intercept apply failed:", err);
              toast.error(err instanceof Error ? err.message : "Failed to apply actions");
              setVoicePhase("idle");
              if (handsFree && open) {
                listeningPurposeRef.current = "dictation";
                startListeningRef.current();
              }
            }
          })();
        };

        // Helper: cancel pending actions
        const doCancel = () => {
          setMessages((prev) => [...prev, { role: "user", text }]);
          setInput("");
          setActions((prev) => prev.filter((a) => a.status === "applied"));
          setPlanMessage(null);
          void (async () => {
            const msg = "Okay, I won't apply those.";
            setMessages((prev) => [...prev, { role: "assistant", text: msg }]);
            await speak(msg);
            setVoicePhase("idle");
            if (handsFree && open) {
              listeningPurposeRef.current = "dictation";
              startListeningRef.current();
            }
          })();
        };

        // Fast path: unambiguous regex match (both can't be true for single words like "yes"/"no")
        if (isConfirmRegex && !isCancelRegex) {
          console.log("[Consent intercept] Regex CONFIRM:", JSON.stringify(text));
          doApply();
          return;
        }
        if (isCancelRegex && !isConfirmRegex) {
          console.log("[Consent intercept] Regex CANCEL:", JSON.stringify(text));
          doCancel();
          return;
        }

        // Tier 2: Ambiguous or no regex match — ask the nano model
        // (short utterances ≤6 words are likely consent-related, not new instructions)
        const wordCount = t.split(/\s+/).length;
        if (wordCount <= 6) {
          console.log("[Consent intercept] Nano classify:", JSON.stringify(text), "words:", wordCount);
          setInput("");
          void (async () => {
            try {
              applyFlowActiveRef.current = true;
              setVoicePhase("applying");
              const intent = await classifyIntent(text);
              console.log("[Consent intercept] Nano result:", intent, "for:", JSON.stringify(text));
              if (intent === "confirm") {
                setMessages((prev) => [...prev, { role: "user", text }]);
                await waitForMealMatches(5000);
                const appliedSummary = describeActionsForSpeech(actionsRef.current.filter((a) => a.status !== "applied"));
                const res = await applySelected();
                if (!res.ok) {
                  await speak("Sorry — I couldn't save that. Please check the screen and try again.");
                  applyFlowActiveRef.current = false;
                  setVoicePhase("idle");
                  if (handsFree && open) {
                    listeningPurposeRef.current = "dictation";
                    startListeningRef.current();
                  }
                  return;
                }
                const msg = `Done — ${appliedSummary.replace(/\b(Log|Update|Delete)\b/g, (v) => v === "Log" ? "logged" : v === "Update" ? "updated" : "deleted")}`;
                await speak(msg);
              } else if (intent === "cancel") {
                setMessages((prev) => [...prev, { role: "user", text }]);
                setActions((prev) => prev.filter((a) => a.status === "applied"));
                setPlanMessage(null);
                await speak("Okay, I won't apply those.");
              } else {
                // new_instruction — skip consent intercept and send to the API
                console.log("[Consent intercept] Nano says new_instruction, re-submitting to API");
                applyFlowActiveRef.current = false;
                setVoicePhase("idle");
                skipConsentInterceptRef.current = true;
                submitRef.current(text, source);
                return;
              }
              applyFlowActiveRef.current = false;
              setVoicePhase("idle");
              if (handsFree && open) {
                listeningPurposeRef.current = "dictation";
                startListeningRef.current();
              }
            } catch {
              // Nano model failed — skip consent intercept and send to the API
              applyFlowActiveRef.current = false;
              setVoicePhase("idle");
              skipConsentInterceptRef.current = true;
              submitRef.current(text, source);
            }
          })();
          return;
        }
      }
      // ── End consent interception ──

      const hadExistingActions = actionsRef.current.some((a) => a.status !== "applied");

      const sessionId = assistantSessionIdRef.current ?? uuid();
      if (!assistantSessionIdRef.current) {
        assistantSessionIdRef.current = sessionId;
        events.setSessionId(sessionId);
      }
      const correlationId = uuid();
      assistantCorrelationIdRef.current = correlationId;

      events.emit(
        "assistant.turn.submit",
        {
          correlation_id: correlationId,
          input_source: source,
          input_chars: text.length,
          had_existing_actions: hadExistingActions,
        },
        { session_id: sessionId, privacy_level: "sensitive" }
      );

      setIsPlanning(true);
      setMessages((prev) => [...prev, { role: "user", text }]);
      setInput("");

      const history = [...messages, { role: "user" as const, text }].slice(-8).map((m) => ({ role: m.role, text: m.text }));
      const existingActions = uiActionsToPlanActions(actionsRef.current);

      const result = await conversationV3({
        text,
        history,
        existingActions: existingActions as unknown as AssistantV3Response["actions"],
        recentEntries,
        sessionId,
        correlationId,
        inputSource: source,
        mode,
      });
      if (!result.success) {
        toast.error(result.error);
        const msg = hadExistingActions
          ? `I couldn't update the suggested actions just now (${result.error}). I kept your existing suggestions below.`
          : `I couldn't process that just now (${result.error}). If you repeat it, I’ll try again—or you can type just the foods/symptoms and I’ll log with defaults.`;
        setMessages((prev) => [...prev, { role: "assistant", text: msg }]);
        if (mode !== "chat" && (handsFree || pendingVoiceConfirmRef.current)) {
          pendingVoiceConfirmRef.current = false;
          void speak(msg);
        }
        setIsPlanning(false);
        return;
      }

      const v3Data = result.data;
      assistantTurnIdRef.current = result.meta?.turnId ?? null;
      events.emit(
        "assistant.v3.received",
        {
          correlation_id: correlationId,
          turn_id: assistantTurnIdRef.current,
          actions_count: v3Data.actions.length,
          intent: v3Data.decision.intent,
          apply: v3Data.decision.apply,
        },
        { session_id: sessionId }
      );

      const nextActions = applySupplementMentionsToActions(
        applyUnitCountsToMealActions(planToUiActions(v3Data), text),
        text,
        (supplementsList.data ?? null) as any
      );
      const applied = actionsRef.current.filter((a) => a.status === "applied");
      const rawHandling = v3Data.decision.action_handling;
      const handling = rawHandling === "keep" && nextActions.length > 0 ? "replace" : rawHandling;

      console.log("[Assistant V3] decision:", JSON.stringify(v3Data.decision), "| actions:", v3Data.actions.length, "| handling:", handling, "| handsFree:", handsFree, "| mode:", mode);

      if (handling === "keep") {
        setMessages((prev) => [...prev, { role: "assistant", text: v3Data.message }]);
        setPlanMessage(v3Data.message);
        setActions(actionsRef.current);
        setIsPlanning(false);
        if (mode !== "chat" && v3Data.decision.apply === "auto" && (handsFree || pendingVoiceConfirmRef.current)) {
          pendingVoiceConfirmRef.current = false;
          void (async () => {
            try {
              const pendingCount = actionsRef.current.filter((a) => a.selected && a.status !== "applied").length;
              if (pendingCount === 0) {
                await speak("What should I log?");
                setVoicePhase("idle");
                if (handsFree && open) { listeningPurposeRef.current = "dictation"; startListeningRef.current(); }
                return;
              }
              applyFlowActiveRef.current = true;
              setVoicePhase("applying");
              await speak(v3Data.message);
              await waitForMealMatches(8000);
              const res = await applySelected();
              if (!res.ok) {
                await speak("Sorry — I couldn't save that. Please check the screen and try again.");
                applyFlowActiveRef.current = false;
                setVoicePhase("idle");
                if (handsFree && open) { listeningPurposeRef.current = "dictation"; startListeningRef.current(); }
                return;
              }
              const appliedSummary = describeActionsForSpeech(actionsRef.current.filter((a) => a.status !== "applied"));
              const doneMsg = `Done — ${appliedSummary.replace(/\b(Log|Update|Delete)\b/g, (v) => v === "Log" ? "logged" : v === "Update" ? "updated" : "deleted")}`;
              await speak(doneMsg);
              applyFlowActiveRef.current = false;
              setVoicePhase("idle");
              if (handsFree && open) { listeningPurposeRef.current = "dictation"; startListeningRef.current(); }
            } catch (err) {
              applyFlowActiveRef.current = false;
              console.error("Auto-apply (keep) failed:", err);
              toast.error(err instanceof Error ? err.message : "Failed to auto-apply actions");
              setVoicePhase("idle");
              if (handsFree && open) { listeningPurposeRef.current = "dictation"; startListeningRef.current(); }
            }
          })();
        } else if (handsFree) {
          void (async () => {
            await speak(v3Data.message);
            listeningPurposeRef.current = "dictation";
            startListeningRef.current();
          })();
        } else {
          setVoicePhase("idle");
        }
        return;
      }

      if (handling === "clear") {
        setMessages((prev) => [...prev, { role: "assistant", text: v3Data.message }]);
        setPlanMessage(v3Data.message);
        setActions([...applied]);
        actionsRef.current = [...applied];
        setIsPlanning(false);
        if (handsFree) {
          void (async () => {
            await speak(v3Data.message);
            listeningPurposeRef.current = "dictation";
            startListeningRef.current();
          })();
        } else {
          setVoicePhase("idle");
        }
        return;
      }

      // "replace": if the model returned no actions, treat it as "no suggestions right now".
      if (nextActions.length === 0) {
        const shouldAsk = v3Data.decision.intent !== "chat" && applied.length === 0;
        const msg = shouldAsk ? "What should I log?" : v3Data.message;
        setMessages((prev) => [...prev, { role: "assistant", text: msg }]);
        setPlanMessage(msg);
        setActions([...applied]);
        actionsRef.current = [...applied];
        setIsPlanning(false);
        if (handsFree) {
          void (async () => {
            await speak(msg);
            listeningPurposeRef.current = "dictation";
            startListeningRef.current();
          })();
        } else {
          setVoicePhase("idle");
        }
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", text: v3Data.message }]);
      setPlanMessage(v3Data.message);
      const merged = [...applied, ...nextActions];
      setActions(merged);
      actionsRef.current = merged;
      void resolveAllMeals(nextActions);
      setIsPlanning(false);

      if (mode !== "chat" && (handsFree || pendingVoiceConfirmRef.current)) {
        pendingVoiceConfirmRef.current = false;
        void (async () => {
          try {
            if (v3Data.decision.apply === "auto") {
              console.log("[Voice flow] AUTO-APPLY: starting");
              applyFlowActiveRef.current = true;
              setVoicePhase("applying");
              await speak(v3Data.message);
              await waitForMealMatches(8000);
              const appliedSummary = describeActionsForSpeech(actionsRef.current.filter((a) => a.status !== "applied"));
              console.log("[Voice flow] AUTO-APPLY: calling applySelected, actions:", actionsRef.current.filter(a => a.status !== "applied").length);
              const res = await applySelected();
              if (!res.ok) {
                console.log("[Voice flow] AUTO-APPLY: applySelected failed:", res.error);
                await speak("Sorry — I couldn't save that. Please check the screen and try again.");
                applyFlowActiveRef.current = false;
                setVoicePhase("idle");
                if (handsFree && open) {
                  listeningPurposeRef.current = "dictation";
                  startListeningRef.current();
                }
                return;
              }
              console.log("[Voice flow] AUTO-APPLY: applySelected succeeded");
              const doneMsg = `Done — ${appliedSummary.replace(/\b(Log|Update|Delete)\b/g, (v) => v === "Log" ? "logged" : v === "Update" ? "updated" : "deleted")}`;
              await speak(doneMsg);
              applyFlowActiveRef.current = false;
              setVoicePhase("idle");
              if (handsFree && open) {
                listeningPurposeRef.current = "dictation";
                startListeningRef.current();
              }
              return;
            }

            if (v3Data.decision.apply === "none") {
              console.log("[Voice flow] NONE: speaking message, no apply");
              await speak(v3Data.message);
              setVoicePhase("idle");
              if (handsFree && open) {
                listeningPurposeRef.current = "dictation";
                startListeningRef.current();
              }
              return;
            }

            // apply === "confirm": speak model message + consent suffix, then listen
            console.log("[Voice flow] CONFIRM: speaking message + consent prompt");
            applyFlowActiveRef.current = true;
            await speak(`${v3Data.message} Say yes to confirm, or no to cancel.`);
            applyFlowActiveRef.current = false;
            startConsentListening();
          } catch (err) {
            applyFlowActiveRef.current = false;
            console.error("Auto-apply failed:", err);
            toast.error(err instanceof Error ? err.message : "Failed to auto-apply actions");
            setVoicePhase("idle");
            if (handsFree && open) {
              listeningPurposeRef.current = "dictation";
              startListeningRef.current();
            }
          }
        })();
      } else {
        setVoicePhase("idle");
      }
    },
    [
      actionsRef,
      describeActionsForSpeech,
      handsFree,
      input,
      isPlanning,
      messages,
      mode,
      recentEntries,
      resolveAllMeals,
      speak,
      startConsentListening,
      toast,
    ]
  );

  // Keep submitRef stable for voice flows.
  useEffect(() => {
    submitRef.current = (overrideText?: string, source?: "typed" | "speech") => {
      void submit(overrideText, source ?? "typed");
    };
  }, [submit]);

  // Sync consent handler ref — runs every render so closures are always fresh.
  // No dependency array to avoid React Compiler producing variable-length deps.
  useEffect(() => {
    handleConsentTextRef.current = (text: string) => {
      const t = text.trim().toLowerCase();
      if (!t) return;
      if (voicePhaseRef.current !== "awaiting_consent") return;

      // Tier 1: High-confidence regex — only obvious, unambiguous words + common phrases
      const isConfirmRegex = /\b(yes|yeah|ok|okay|confirm|apply|sure|yep|yup)\b/.test(t) ||
                             /\b(log|save|do|submit)\s+(it|that)\b/.test(t) ||
                             /\bgo\s+ahead\b/.test(t);
      const isCancelRegex = /\b(no|nope|cancel|stop|never\s*mind)\b/.test(t);
      const isRepeat = /\b(repeat|again|say that again)\b/.test(t);

      // Helper: carry out confirm
      const doConsentApply = () => {
        events.emit(
          "assistant.consent.yes",
          { turn_id: assistantTurnIdRef.current, correlation_id: assistantCorrelationIdRef.current },
          { session_id: assistantSessionIdRef.current }
        );
        stopListeningRef.current();
        void (async () => {
          try {
            applyFlowActiveRef.current = true;
            setVoicePhase("applying");
            await waitForMealMatches(5000);
            const appliedSummary = describeActionsForSpeech(actionsRef.current.filter((a) => a.status !== "applied"));
            const res = await applySelected();
            if (!res.ok) {
              await speak("Sorry — I couldn't save that. Please check the screen and try again.");
              applyFlowActiveRef.current = false;
              setVoicePhase("idle");
              if (handsFree && open) {
                listeningPurposeRef.current = "dictation";
                startListeningRef.current();
              }
              return;
            }
            const doneMsg = `Done — ${appliedSummary.replace(/\b(Log|Update|Delete)\b/g, (v) => v === "Log" ? "logged" : v === "Update" ? "updated" : "deleted")}`;
            await speak(doneMsg);
            applyFlowActiveRef.current = false;
            setVoicePhase("idle");
            if (handsFree && open) {
              listeningPurposeRef.current = "dictation";
              startListeningRef.current();
            }
          } catch (err) {
            applyFlowActiveRef.current = false;
            console.error("Consent apply failed:", err);
            toast.error(err instanceof Error ? err.message : "Failed to apply actions");
            setVoicePhase("idle");
            if (handsFree && open) {
              listeningPurposeRef.current = "dictation";
              startListeningRef.current();
            }
          }
        })();
      };

      // Helper: carry out cancel
      const doConsentCancel = () => {
        events.emit(
          "assistant.consent.no",
          { turn_id: assistantTurnIdRef.current, correlation_id: assistantCorrelationIdRef.current },
          { session_id: assistantSessionIdRef.current }
        );
        stopListeningRef.current();
        void (async () => {
          await speak("Okay. I won't add anything.");
          setVoicePhase("idle");
          if (handsFree && open) {
            listeningPurposeRef.current = "dictation";
            startListeningRef.current();
          }
        })();
      };

      // Fast path: unambiguous regex match
      if (isConfirmRegex && !isCancelRegex) {
        doConsentApply();
        return;
      }
      if (isCancelRegex && !isConfirmRegex) {
        doConsentCancel();
        return;
      }
      if (isRepeat) {
        events.emit(
          "assistant.consent.repeat",
          { turn_id: assistantTurnIdRef.current, correlation_id: assistantCorrelationIdRef.current },
          { session_id: assistantSessionIdRef.current }
        );
        stopListeningRef.current();
        void (async () => {
          const summary = describeActionsForSpeech(actionsRef.current.filter((a) => a.status !== "applied"));
          await speak(`${summary} Say yes to confirm, or no to cancel.`);
          startConsentListening();
        })();
        return;
      }

      // Tier 2: No regex match — ask the nano model
      stopListeningRef.current();
      void (async () => {
        try {
          const intent = await classifyIntent(t);
          if (intent === "confirm") {
            doConsentApply();
          } else if (intent === "cancel") {
            doConsentCancel();
          } else {
            // new_instruction — treat as unrelated, re-prompt for consent
            await speak("It sounds like you want to do something else. Say yes to apply, or no to cancel.");
            startConsentListening();
          }
        } catch {
          // Nano model failed — re-prompt
          await speak("Sorry, I didn't catch that. Say yes to apply, or no to cancel.");
          startConsentListening();
        }
      })();
    };
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-40 right-4 bottom-24 lg:bottom-6",
          "h-12 w-12 rounded-full",
          "bg-primary-600 text-white shadow-lg shadow-black/15",
          "hover:bg-primary-700 active:scale-[0.98]",
          "border border-white/20"
        )}
        aria-label="Open Assistant"
      >
        <Sparkles className="w-5 h-5 mx-auto" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="xl" position="responsive">
        <ModalHeader>
          <div className="flex items-start justify-between gap-4 pr-10">
            <div>
              <ModalTitle>Assistant</ModalTitle>
              <ModalDescription>Describe what happened. Review the suggested logs and apply them.</ModalDescription>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="inline-flex items-center rounded-[var(--radius-lg)] bg-slate-100 p-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-all",
                  mode === "chat"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50"
                )}
                onClick={() => {
                  stopListening();
                  disconnectRealtime();
                  setMode("chat");
                }}
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-all",
                  mode === "conversation_v3"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50"
                )}
                onClick={() => {
                  stopListening();
                  setMode("conversation_v3");
                }}
              >
                <Sparkles className="w-4 h-4" />
                Conversation
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSpeechEnabled((v) => !v)}
              aria-label={speechEnabled ? "Mute voice" : "Unmute voice"}
              title={speechEnabled ? "Mute voice" : "Unmute voice"}
            >
              <Volume2 className={cn("w-4 h-4 mr-2", !speechEnabled && "opacity-40")} />
              {speechEnabled ? "Voice on" : "Voice off"}
            </Button>
          </div>
        </ModalHeader>

        <ModalContent className="space-y-4">
          <audio
            ref={rtcRemoteAudioRef}
            autoPlay
            playsInline
            // Avoid `display: none` which can prevent playback on some browsers.
            className="absolute w-0 h-0 opacity-0 pointer-events-none"
          />

          <div className="rounded-[var(--radius-lg)] border border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-950/30 p-4">
            <div className="space-y-3 pr-1">
              {messages.length === 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Example: “I ate lunch: chicken breast and a cup of broccoli. I had a headache at 2pm and took magnesium.”
                </div>
              ) : (
                messages.map((m, idx) => {
                  if (m.role === "assistant" && "receiptIds" in m && m.receiptIds?.length) {
                    return (
                      <ReceiptCard
                        key={`receipt-${idx}`}
                        actionIds={m.receiptIds}
                        allActions={actions}
                        setActions={setActions}
                        actionsRef={actionsRef}
                        onSave={handleReceiptSave}
                        recentEntries={recentEntries}
                      />
                    );
                  }
                  return (
                    <div
                      key={`${m.role}-${idx}`}
                      className={cn(
                        "text-sm leading-relaxed rounded-[var(--radius-lg)] px-3 py-2 border",
                        m.role === "user"
                          ? "ml-auto max-w-[85%] bg-primary-600/10 border-primary-600/20 text-slate-900 dark:text-slate-100"
                          : "mr-auto max-w-[85%] bg-white/80 dark:bg-slate-900/40 border-black/10 dark:border-white/10 text-slate-900 dark:text-slate-100"
                      )}
                    >
                      {m.text}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {hasAnyActions && (
            <div ref={actionsSectionRef} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Suggested actions</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMessages([]);
                      setPlanMessage(null);
                      setActions([]);
                      setInput("");
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
              {planMessage && (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {planMessage}
                </div>
              )}

              <div className="space-y-3">
                {actions.filter((a) => a.status !== "applied").map((action) => (
                  <Card key={action.id} className={cn(action.status === "error" ? "border-red-200" : undefined)}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={action.selected}
                          onChange={(e) =>
                            setActions((prev) => prev.map((a) => (a.id === action.id ? { ...a, selected: e.target.checked } : a)))
                          }
                          className="mt-1 h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{action.title}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {action.operation === "edit" && <span className="text-amber-600 dark:text-amber-400 font-medium mr-1">EDIT</span>}
                                {action.operation === "delete" && <span className="text-red-600 dark:text-red-400 font-medium mr-1">DELETE</span>}
                                Confidence: {Math.round(action.confidence * 100)}%
                                {action.status === "applied" ? " • Applied" : action.status === "applying" ? " • Applying…" : ""}
                              </div>
                            </div>
                            {(action.type === "log_meal" || action.type === "edit_meal") && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label={action.data.items.some((i) => i.expanded) ? "Collapse items" : "Expand items"}
                                  onClick={() =>
                                    setActions((prev) =>
                                      prev.map((a) => {
                                        if (a.id !== action.id || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
                                        const anyExpanded = a.data.items.some((i) => i.expanded);
                                        return {
                                          ...a,
                                          data: {
                                            ...a.data,
                                            items: a.data.items.map((it) => ({ ...it, expanded: !anyExpanded })),
                                          },
                                        };
                                      })
                                    )
                                  }
                                >
                                  {action.data.items.some((i) => i.expanded) ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>

                          {action.status === "error" && action.error && (
                            <div className="mt-2 text-xs text-red-600">{action.error}</div>
                          )}

                          {(action.type === "log_meal" || action.type === "edit_meal") && (
                            <div className="mt-3 space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                  <label className="text-xs text-slate-500">Date</label>
                                  <Input
                                    type="date"
                                    value={action.data.date || ""}
                                    onChange={(e) =>
                                      setActions((prev) =>
                                        prev.map((a) =>
                                          a.id === action.id && a.type === "log_meal"
                                            ? { ...a, data: { ...a.data, date: e.target.value } }
                                            : a
                                        )
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-slate-500">Meal</label>
                                  <select
                                    value={action.data.mealType || ""}
                                    onChange={(e) =>
                                      setActions((prev) =>
                                        prev.map((a) =>
                                          a.id === action.id && a.type === "log_meal"
                                            ? { ...a, data: { ...a.data, mealType: (e.target.value as MealType) || null } }
                                            : a
                                        )
                                      )
                                    }
                                    className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                                  >
                                    <option value="">Auto</option>
                                    <option value="breakfast">Breakfast</option>
                                    <option value="lunch">Lunch</option>
                                    <option value="dinner">Dinner</option>
                                    <option value="snack">Snack</option>
                                  </select>
                                </div>
                                <div className="flex items-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void resolveAllMeals([action])}
                                    disabled={action.data.items.every((i) => i.isResolving)}
                                  >
                                    Refresh matches
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {action.data.items.map((item) => (
                                  <div
                                    key={item.key}
                                    className={cn(
                                      "rounded-[var(--radius-lg)] border border-black/10 dark:border-white/10",
                                      "bg-white/70 dark:bg-slate-950/20 p-3"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1">
                                        <Input
                                          value={item.label}
                                          onChange={(e) =>
                                            setActions((prev) =>
                                              prev.map((a) => {
                                                if (a.id !== action.id || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
                                                return {
                                                  ...a,
                                                  data: {
                                                    ...a.data,
                                                    items: a.data.items.map((it) => (it.key === item.key ? { ...it, label: e.target.value } : it)),
                                                  },
                                                };
                                              })
                                            )
                                          }
                                        />
                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                          <div className="sm:col-span-2">
                                            <label className="text-xs text-slate-500">USDA query</label>
                                            <Input
                                              value={item.usdaQuery}
                                              onChange={(e) =>
                                                setActions((prev) =>
                                                  prev.map((a) => {
                                                    if (a.id !== action.id || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
                                                    return {
                                                      ...a,
                                                      data: {
                                                        ...a.data,
                                                        items: a.data.items.map((it) =>
                                                          it.key === item.key ? { ...it, usdaQuery: e.target.value } : it
                                                        ),
                                                      },
                                                    };
                                                  })
                                                )
                                              }
                                            />
                                          </div>
                                          <div>
                                            <label className="text-xs text-slate-500">Amount eaten</label>
                                            <div className="flex items-center gap-2">
                                              <Input
                                                inputMode="decimal"
                                                value={displayAmountFromGrams(item.gramsConsumed, item.amountUnit) ?? ""}
                                                onChange={(e) => {
                                                  const raw = e.target.value.trim();
                                                  const v = raw === "" ? null : Number(raw);
                                                  const grams = gramsFromAmount(v != null && Number.isFinite(v) ? v : null, item.amountUnit);
                                                  setActions((prev) =>
                                                    prev.map((a) => {
                                                      if (a.id !== action.id || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
                                                      return {
                                                        ...a,
                                                        data: {
                                                          ...a.data,
                                                          items: a.data.items.map((it) => {
                                                            if (it.key !== item.key) return it;
                                                            const auto = servingsFromGrams(it.matchedFood, grams);
                                                            return {
                                                              ...it,
                                                              gramsConsumed: grams,
                                                              servings: auto != null ? roundServings(auto) : it.servings,
                                                            };
                                                          }),
                                                        },
                                                      };
                                                    })
                                                  );
                                                }}
                                              />
                                              <button
                                                type="button"
                                                className={cn(
                                                  "h-10 rounded-md border px-2 text-xs font-medium transition-colors",
                                                  "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                                                  "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/30"
                                                )}
                                                onClick={() => {
                                                  setActions((prev) =>
                                                    prev.map((a) => {
                                                      if (a.id !== action.id || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
                                                      return {
                                                        ...a,
                                                        data: {
                                                          ...a.data,
                                                          items: a.data.items.map((it) => {
                                                            if (it.key !== item.key) return it;
                                                            return { ...it, amountUnit: it.amountUnit === "g" ? "oz" : "g" };
                                                          }),
                                                        },
                                                      };
                                                    })
                                                  );
                                                }}
                                                aria-label={item.amountUnit === "g" ? "Switch to ounces" : "Switch to grams"}
                                                title={item.amountUnit === "g" ? "Switch to oz" : "Switch to g"}
                                              >
                                                {item.amountUnit}
                                              </button>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                          <span>
                                            Qty:{" "}
                                            <input
                                              className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-950"
                                              inputMode="decimal"
                                              value={item.servings}
                                              onChange={(e) => {
                                                const v = Number(e.target.value);
                                                setActions((prev) =>
                                                  prev.map((a) => {
                                                    if (a.id !== action.id || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
                                                    return {
                                                      ...a,
                                                      data: {
                                                        ...a.data,
                                                        items: a.data.items.map((it) => {
                                                          if (it.key !== item.key) return it;
                                                          return {
                                                            ...it,
                                                            servings: Number.isFinite(v) && v > 0 ? roundServings(v) : it.servings,
                                                          };
                                                        }),
                                                      },
                                                    };
                                                  })
                                                );
                                              }}
                                            />
                                          </span>
                                          <span className="opacity-70">•</span>
                                          <span>
                                            Match:{" "}
                                            {item.matchedFood ? (
                                              <span className="text-slate-700 dark:text-slate-200">
                                                {item.matchedFood.description}
                                              </span>
                                            ) : item.isResolving ? (
                                              <span>Resolving…</span>
                                            ) : (
                                              <span className="text-red-600">Needs match</span>
                                            )}
                                          </span>
                                        </div>
                                      </div>

                                      <Button
                                        variant="outline"
                                        size="icon-sm"
                                        aria-label={item.expanded ? "Collapse item" : "Expand item"}
                                        onClick={() =>
                                          setActions((prev) =>
                                            prev.map((a) => {
                                              if (a.id !== action.id || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
                                              return {
                                                ...a,
                                                data: {
                                                  ...a.data,
                                                  items: a.data.items.map((it) =>
                                                    it.key === item.key ? { ...it, expanded: !it.expanded } : it
                                                  ),
                                                },
                                              };
                                            })
                                          )
                                        }
                                      >
                                        {item.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                      </Button>
                                    </div>

                                    {item.resolveError && !item.isResolving && (
                                      <div className="mt-2 text-xs text-red-600">{item.resolveError}</div>
                                    )}

                                    {item.expanded && (
                                      <div className="mt-3 space-y-2 border-l-2 border-primary-600/30 pl-3">
                                        <div className="flex items-center justify-between">
                                          <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                            Top matches
                                          </div>
                                          <Button
                                            variant="outline"
                                            size="icon-sm"
                                            aria-label="Refresh match"
                                            onClick={() => void resolveMealItem(action.id, item.key)}
                                          >
                                            {item.isResolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                          </Button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                          {(item.candidates || []).slice(0, 5).map((c) => (
                                            <button
                                              key={c.fdcId}
                                              type="button"
                                              className={cn(
                                                "text-left rounded-md border px-2 py-1 text-xs transition-colors",
                                                item.selectedCandidate?.fdcId === c.fdcId
                                                  ? "border-primary-600/40 bg-primary-600/10"
                                                  : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                                              )}
                                          onClick={async () => {
                                                const food = await getFoodDetails(c.fdcId);
                                                const overrideQuery = item.usdaQuery.trim() || item.label.trim();
                                                if (overrideQuery) {
                                                  void upsertFoodResolutionOverride(overrideQuery, c.fdcId).catch(() => {});
                                                }
                                              setActions((prev) =>
                                                prev.map((a) => {
                                                  if (a.id !== action.id || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
                                                  return {
                                                    ...a,
                                                    data: {
                                                      ...a.data,
                                                      items: a.data.items.map((it) => {
                                                        if (it.key !== item.key) return it;
                                                        const auto = servingsFromGrams(food, it.gramsConsumed);
                                                        return {
                                                          ...it,
                                                          selectedCandidate: c,
                                                          matchedFood: food,
                                                          servings: auto != null ? roundServings(auto) : it.servings,
                                                          matchedByUser: true,
                                                          resolveError: food ? undefined : "No details for that USDA item",
                                                        };
                                                      }),
                                                    },
                                                  };
                                                })
                                              );
                                              }}
                                            >
                                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{c.description}</div>
                                              <div className="text-slate-500 truncate">
                                                {c.dataType || "Unknown"} {c.brandOwner ? `• ${c.brandOwner}` : ""}
                                              </div>
                                            </button>
                                          ))}
                                        </div>

                                        <div className="pt-1">
                                          <div className="text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                                            Override match
                                          </div>
                                          <FoodSearch
                                            onSelect={async (selected) => {
                                              const food = await getFoodDetails(selected.fdcId);
                                              const overrideQuery = item.usdaQuery.trim() || item.label.trim();
                                              if (overrideQuery) {
                                                void upsertFoodResolutionOverride(overrideQuery, selected.fdcId).catch(() => {});
                                              }
                                              setActions((prev) =>
                                                prev.map((a) => {
                                                  if (a.id !== action.id || (a.type !== "log_meal" && a.type !== "edit_meal")) return a;
                                                  return {
                                                    ...a,
                                                    data: {
                                                      ...a.data,
                                                      items: a.data.items.map((it) => {
                                                        if (it.key !== item.key) return it;
                                                        const auto = servingsFromGrams(food, it.gramsConsumed);
                                                        return {
                                                          ...it,
                                                          selectedCandidate: selected,
                                                          matchedFood: food,
                                                          candidates: [selected, ...it.candidates.filter((c) => c.fdcId !== selected.fdcId)],
                                                          servings: auto != null ? roundServings(auto) : it.servings,
                                                          matchedByUser: true,
                                                          resolveError: food ? undefined : "No details for that USDA item",
                                                        };
                                                      }),
                                                    },
                                                  };
                                                })
                                              );
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(action.type === "log_symptom" || action.type === "edit_symptom") && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2">
                                <label className="text-xs text-slate-500">Symptom</label>
                                <Input
                                  value={action.data.symptom}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) => (a.id === action.id && (a.type === "log_symptom" || a.type === "edit_symptom") ? { ...a, data: { ...a.data, symptom: e.target.value } } : a))
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Severity (1-10)</label>
                                <Input
                                  inputMode="numeric"
                                  value={action.data.severity ?? 5}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "log_symptom" || a.type === "edit_symptom")
                                          ? { ...a, data: { ...a.data, severity: Number.isFinite(v) ? v : a.data.severity } }
                                          : a
                                      )
                                    );
                                  }}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Date</label>
                                <Input
                                  type="date"
                                  value={action.data.date || ""}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "log_symptom" || a.type === "edit_symptom") ? { ...a, data: { ...a.data, date: e.target.value } } : a
                                      )
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Time</label>
                                <Input
                                  type="time"
                                  value={action.data.time || ""}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "log_symptom" || a.type === "edit_symptom")
                                          ? { ...a, data: { ...a.data, time: e.target.value || null } }
                                          : a
                                      )
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                          {(action.type === "log_supplement" || action.type === "edit_supplement") && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <div className="sm:col-span-2">
                                <label className="text-xs text-slate-500">Supplement</label>
                                <Input
                                  value={action.data.supplement}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) => (a.id === action.id && (a.type === "log_supplement" || a.type === "edit_supplement") ? { ...a, data: { ...a.data, supplement: e.target.value } } : a))
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Dosage</label>
                                <Input
                                  inputMode="decimal"
                                  value={action.data.dosage ?? 1}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "log_supplement" || a.type === "edit_supplement")
                                          ? { ...a, data: { ...a.data, dosage: Number.isFinite(v) ? v : a.data.dosage } }
                                          : a
                                      )
                                    );
                                  }}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Unit</label>
                                <Input
                                  value={action.data.unit ?? "serving"}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "log_supplement" || a.type === "edit_supplement")
                                          ? { ...a, data: { ...a.data, unit: e.target.value } }
                                          : a
                                      )
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Date</label>
                                <Input
                                  type="date"
                                  value={action.data.date || ""}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "log_supplement" || a.type === "edit_supplement") ? { ...a, data: { ...a.data, date: e.target.value } } : a
                                      )
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Time</label>
                                <Input
                                  type="time"
                                  value={action.data.time || ""}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "log_supplement" || a.type === "edit_supplement")
                                          ? { ...a, data: { ...a.data, time: e.target.value || null } }
                                          : a
                                      )
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                          {(action.type === "log_sleep" || action.type === "edit_sleep") && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <div>
                                <label className="text-xs text-slate-500">Date</label>
                                <Input
                                  type="date"
                                  value={action.data.date || ""}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "log_sleep" || a.type === "edit_sleep")
                                          ? { ...a, data: { ...a.data, date: e.target.value } }
                                          : a
                                      )
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Bedtime</label>
                                <Input
                                  type="time"
                                  value={action.data.bedtime || ""}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "log_sleep" || a.type === "edit_sleep")
                                          ? { ...a, data: { ...a.data, bedtime: e.target.value || null } }
                                          : a
                                      )
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Wake time</label>
                                <Input
                                  type="time"
                                  value={action.data.wake_time || ""}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "log_sleep" || a.type === "edit_sleep")
                                          ? { ...a, data: { ...a.data, wake_time: e.target.value || null } }
                                          : a
                                      )
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Quality (1-5)</label>
                                <Input
                                  inputMode="numeric"
                                  value={action.data.quality ?? ""}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "log_sleep" || a.type === "edit_sleep")
                                          ? { ...a, data: { ...a.data, quality: Number.isFinite(v) ? Math.max(1, Math.min(5, Math.round(v))) : a.data.quality } }
                                          : a
                                      )
                                    );
                                  }}
                                />
                              </div>
                              <div className="sm:col-span-4">
                                <label className="text-xs text-slate-500 mb-1 block">Factors</label>
                                <div className="flex flex-wrap gap-2">
                                  {["caffeine", "alcohol", "exercise", "stress", "screen_time", "late_meal", "medication", "late_night_chores"].map((f) => (
                                    <label key={f} className="inline-flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300">
                                      <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5"
                                        checked={(Array.isArray(action.data.factors) ? action.data.factors : []).includes(f)}
                                        onChange={(e) =>
                                          setActions((prev) =>
                                            prev.map((a) => {
                                              if (a.id !== action.id || (a.type !== "log_sleep" && a.type !== "edit_sleep")) return a;
                                              const base = Array.isArray(a.data.factors) ? a.data.factors : [];
                                              const factors = e.target.checked
                                                ? Array.from(new Set([...base, f]))
                                                : base.filter((x) => x !== f);
                                              return { ...a, data: { ...a.data, factors } };
                                            })
                                          )
                                        }
                                      />
                                      {f.replace(/_/g, " ")}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {(action.type === "add_shopping_item" || action.type === "edit_shopping_item") && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <div className="sm:col-span-2">
                                <label className="text-xs text-slate-500">Item name</label>
                                <Input
                                  value={action.data.name}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "add_shopping_item" || a.type === "edit_shopping_item")
                                          ? { ...a, data: { ...a.data, name: e.target.value } }
                                          : a
                                      )
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Quantity</label>
                                <Input
                                  inputMode="decimal"
                                  value={action.data.quantity ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value.trim() === "" ? null : Number(e.target.value);
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "add_shopping_item" || a.type === "edit_shopping_item")
                                          ? { ...a, data: { ...a.data, quantity: v != null && Number.isFinite(v) ? v : null } }
                                          : a
                                      )
                                    );
                                  }}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Unit</label>
                                <Input
                                  value={action.data.unit ?? ""}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "add_shopping_item" || a.type === "edit_shopping_item")
                                          ? { ...a, data: { ...a.data, unit: e.target.value || null } }
                                          : a
                                      )
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Category</label>
                                <select
                                  value={action.data.category || "other"}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) =>
                                        a.id === action.id && (a.type === "add_shopping_item" || a.type === "edit_shopping_item")
                                          ? { ...a, data: { ...a.data, category: e.target.value } }
                                          : a
                                      )
                                    )
                                  }
                                  className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                                >
                                  <option value="produce">Produce</option>
                                  <option value="dairy">Dairy</option>
                                  <option value="meat">Meat</option>
                                  <option value="grains">Grains</option>
                                  <option value="frozen">Frozen</option>
                                  <option value="canned">Canned</option>
                                  <option value="snacks">Snacks</option>
                                  <option value="beverages">Beverages</option>
                                  <option value="household">Household</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                            </div>
                          )}

                          {action.type === "delete_entry" && (
                            <div className="mt-3 text-sm text-red-600 dark:text-red-400">
                              This will permanently delete the {action.data.entryType.replace(/_/g, " ")} entry.
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[var(--radius-lg)] border border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-950/30 p-4">
            <div className="space-y-2">
              {mode !== "chat" && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {realtimeStatus === "connecting"
                    ? "Connecting voice…"
                    : realtimeStatus === "error"
                    ? `Voice error: ${realtimeError || "failed to start"}`
                    : voicePhase === "awaiting_consent"
                    ? "Listening for \u201cyes\u201d to confirm or \u201cno\u201d to cancel…"
                    : voicePhase === "speaking"
                    ? "Speaking… (you can interrupt)"
                    : isListening
                    ? "Listening…"
                    : "Ready."}
                </div>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
                  placeholder={mode !== "chat" ? "Speak or type…" : "Type or dictate…"}
                />
                <Button
                  variant={isListening ? "destructive" : "outline"}
                  onClick={() => {
                    listeningPurposeRef.current = mode !== "chat" && voicePhase === "awaiting_consent" ? "consent" : "dictation";
                    if (isListening) stopListening();
                    else startListening();
                  }}
                  size="icon"
                  aria-label={isListening ? "Stop listening" : "Start listening"}
                >
                  {isListening ? <X className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                {mode !== "chat" && needsAudioTap && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const audioEl = rtcRemoteAudioRef.current;
                      if (!audioEl) return;
                      void audioEl.play()
                        .then(() => setNeedsAudioTap(false))
                        .catch(() => {
                          toast.error("Click again to enable audio output");
                        });
                    }}
                    size="sm"
                  >
                    Enable audio
                  </Button>
                )}
                {mode !== "chat" && speechEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void speak("Test. Can you hear me?");
                    }}
                  >
                    Test voice
                  </Button>
                )}
                <Button
                  onClick={() => {
                    pendingVoiceConfirmRef.current = mode !== "chat";
                    void submit();
                  }}
                  disabled={isPlanning || !input.trim()}
                  size="icon"
                  aria-label="Send"
                >
                  {isPlanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </ModalContent>

        <ModalFooter className="justify-between">
          <div className="text-xs text-slate-500">
            {hasAnyActions ? `${actions.filter((a) => a.selected).length} selected` : ""}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={applySelected} disabled={!hasAnySelected || actions.some((a) => a.status === "applying")}>
              {actions.some((a) => a.status === "applying") ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Apply selected
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </>
  );
}
