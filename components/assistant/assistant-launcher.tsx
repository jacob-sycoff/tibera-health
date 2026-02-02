"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Mic, Send, Sparkles, X, Volume2, MessageSquare } from "lucide-react";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import { planAssistantActions, type AssistantPlan } from "@/lib/api/assistant";
import { getFoodDetails, smartSearchFoods } from "@/lib/api/usda";
import { amountFromGrams, gramsFromAmount, roundTo1Decimal } from "@/lib/utils/units";
import { FoodSearch } from "@/components/food/food-search";
import {
  useCreateCustomSymptom,
  useCreateMealLog,
  useCreateSupplementLog,
  useCreateSymptomLog,
  useSupplementsList,
  useSymptomsList,
} from "@/lib/hooks";
import type { Food, FoodNutrient, FoodSearchResult, MealType } from "@/types";

type ChatMessage = { role: "user" | "assistant"; text: string };
type VoicePhase = "idle" | "dictating" | "speaking" | "awaiting_consent" | "applying";

type UiMealItem = {
  key: string;
  label: string;
  usdaQuery: string;
  gramsConsumed: number | null;
  amountUnit: "g" | "oz";
  servings: number;
  candidates: FoodSearchResult[];
  selectedCandidate: FoodSearchResult | null;
  matchedFood: Food | null;
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
};

type UiMealAction = UiActionBase & {
  type: "log_meal";
  data: {
    date: string | null;
    mealType: MealType | null;
    notes?: string;
    items: UiMealItem[];
  };
};

type UiSymptomAction = UiActionBase & {
  type: "log_symptom";
  data: {
    symptom: string;
    severity: number | null;
    date: string | null;
    time: string | null;
    notes?: string;
  };
};

type UiSupplementAction = UiActionBase & {
  type: "log_supplement";
  data: {
    supplement: string;
    dosage: number | null;
    unit: string | null;
    date: string | null;
    time: string | null;
    notes?: string;
  };
};

type UiAction = UiMealAction | UiSymptomAction | UiSupplementAction;

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function roundServings(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const rounded = Math.round(value * 4) / 4;
  return Math.max(0.25, Math.min(50, rounded));
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

function transformNutrients(nutrients: FoodNutrient[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const n of nutrients) result[n.nutrientId] = n.amount;
  return result;
}

function candidateRank(candidate: FoodSearchResult): number {
  const dt = (candidate.dataType || "").toLowerCase();
  if (dt.includes("foundation")) return 0;
  if (dt.includes("sr legacy") || dt.includes("sr")) return 1;
  if (dt.includes("survey")) return 2;
  if (dt.includes("branded")) return 3;
  return 4;
}

function sortCandidates(candidates: FoodSearchResult[]): FoodSearchResult[] {
  return [...candidates].sort((a, b) => {
    const ra = candidateRank(a);
    const rb = candidateRank(b);
    if (ra !== rb) return ra - rb;
    return (b.score || 0) - (a.score || 0);
  });
}

async function resolveFirstValidFood(candidates: FoodSearchResult[]): Promise<{
  selectedCandidate: FoodSearchResult | null;
  food: Food | null;
}> {
  for (const candidate of candidates) {
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

function planToUiActions(plan: AssistantPlan): UiAction[] {
  const today = new Date().toISOString().slice(0, 10);
  return plan.actions.map((action) => {
    const base: UiActionBase = {
      id: uuid(),
      selected: true,
      title: action.title,
      confidence: Number.isFinite(action.confidence) ? action.confidence : 0.6,
      status: "ready",
    };

    if (action.type === "log_meal") {
      const mealType = action.data.mealType ?? null;
      const date = action.data.date ?? today;
      const items: UiMealItem[] = action.data.items.map((item) => ({
        key: uuid(),
        label: item.label,
        usdaQuery: item.usdaQuery,
        gramsConsumed: item.gramsConsumed ?? null,
        amountUnit: "g",
        servings: roundServings(item.servings ?? 1),
        candidates: [],
        selectedCandidate: null,
        matchedFood: null,
        isResolving: false,
        expanded: false,
      }));
      const deduped = dedupeMealItems(items);
      return { ...base, type: "log_meal", data: { date, mealType, items: deduped, notes: action.data.notes } };
    }

    if (action.type === "log_symptom") {
      return {
        ...base,
        type: "log_symptom",
        data: {
          symptom: action.data.symptom,
          severity: action.data.severity ?? 5,
          date: action.data.date ?? null,
          time: action.data.time ?? null,
          notes: action.data.notes,
        },
      };
    }

    return {
      ...base,
      type: "log_supplement",
      data: {
        supplement: action.data.supplement,
        dosage: action.data.dosage ?? 1,
        unit: action.data.unit ?? "serving",
        date: action.data.date ?? null,
        time: action.data.time ?? null,
        notes: action.data.notes,
      },
    };
  });
}

function uiActionsToPlanActions(actions: UiAction[]): AssistantPlan["actions"] {
  return actions
    .filter((a) => a.status !== "applied")
    .map((a) => {
      if (a.type === "log_meal") {
        return {
          type: "log_meal" as const,
          title: a.title,
          confidence: a.confidence,
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
      if (a.type === "log_symptom") {
        return {
          type: "log_symptom" as const,
          title: a.title,
          confidence: a.confidence,
          data: {
            symptom: a.data.symptom,
            severity: a.data.severity ?? null,
            date: a.data.date ?? null,
            time: a.data.time ?? null,
            notes: a.data.notes,
          },
        };
      }
      return {
        type: "log_supplement" as const,
        title: a.title,
        confidence: a.confidence,
        data: {
          supplement: a.data.supplement,
          dosage: a.data.dosage ?? null,
          unit: a.data.unit ?? null,
          date: a.data.date ?? null,
          time: a.data.time ?? null,
          notes: a.data.notes,
        },
      };
    });
}

export function AssistantLauncher() {
  const toast = useToast();

  const createMealLog = useCreateMealLog();
  const createSymptomLog = useCreateSymptomLog();
  const createCustomSymptom = useCreateCustomSymptom();
  const createSupplementLog = useCreateSupplementLog();

  const symptomsList = useSymptomsList();
  const supplementsList = useSupplementsList();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"chat" | "conversation">("conversation");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [actions, setActions] = useState<UiAction[]>([]);
  const actionsRef = useRef<UiAction[]>([]);

  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const voicePhaseRef = useRef<VoicePhase>("idle");
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const handsFree = mode === "conversation";

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
  const speakEnabledRef = useRef(true);
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});
  const submitRef = useRef<() => void>(() => {});

  const hasAnySelected = useMemo(() => actions.some((a) => a.selected), [actions]);
  const hasAnyActions = actions.length > 0;

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    voicePhaseRef.current = voicePhase;
  }, [voicePhase]);

  useEffect(() => {
    speakEnabledRef.current = speechEnabled;
  }, [speechEnabled]);

  const supportsTts = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      typeof window.speechSynthesis !== "undefined" &&
      typeof (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance !== "undefined"
    );
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current != null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!supportsTts) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }, [supportsTts]);

  const speak = useCallback(
    async (text: string) => {
      if (!supportsTts) return;
      if (mode !== "conversation") return;
      if (!speakEnabledRef.current) return;

      stopSpeaking();
      // Avoid feedback loops: don't listen while speaking.
      stopListeningRef.current();
      setVoicePhase("speaking");

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
    },
    [mode, stopSpeaking, supportsTts]
  );

  const describeActionsForSpeech = useCallback((plannedActions: UiAction[]) => {
    const parts: string[] = [];
    for (const a of plannedActions) {
      if (!a.selected) continue;
      if (a.type === "log_meal") {
        const mealType = a.data.mealType || defaultMealTypeFromClock();
        const items = a.data.items
          .map((it) => it.label.trim() || it.usdaQuery.trim())
          .filter(Boolean)
          .slice(0, 6)
          .join(", ");
        parts.push(`Log ${mealType}: ${items}.`);
      } else if (a.type === "log_symptom") {
        parts.push(`Log symptom: ${a.data.symptom}.`);
      } else if (a.type === "log_supplement") {
        const dose =
          a.data.dosage != null && a.data.unit
            ? `${a.data.dosage} ${a.data.unit}`
            : undefined;
        parts.push(`Log ${a.data.supplement}${dose ? `, ${dose}` : ""}.`);
      }
    }
    return parts.join(" ");
  }, []);

  const hasUnresolvedMealMatches = useCallback((plannedActions: UiAction[]) => {
    return plannedActions.some((a) => {
      if (!a.selected) return false;
      if (a.type !== "log_meal") return false;
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

  const startConsentListening = useCallback(() => {
    if (mode !== "conversation") return;
    listeningPurposeRef.current = "consent";
    consentBufferRef.current = "";
    setVoicePhase("awaiting_consent");
    startListeningRef.current();
  }, [mode]);

  const resolveMealItem = useCallback(async (actionId: string, itemKey: string) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== actionId || a.type !== "log_meal") return a;
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
    if (!action || action.type !== "log_meal") return;
    const item = action.data.items.find((i) => i.key === itemKey);
    if (!item) return;

    try {
      const candidates = await smartSearchFoods(item.usdaQuery, 12);
      const sorted = sortCandidates(candidates);
      const { selectedCandidate, food } = await resolveFirstValidFood(sorted);

      setActions((prev) =>
        prev.map((a) => {
          if (a.id !== actionId || a.type !== "log_meal") return a;
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
          if (a.id !== actionId || a.type !== "log_meal") return a;
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
      if (a.type !== "log_meal") continue;
      for (const item of a.data.items) {
        if (!item.usdaQuery.trim()) continue;
        work.push({ actionId: a.id, itemKey: item.key });
      }
    }

    for (const job of work) {
      // eslint-disable-next-line no-await-in-loop
      await resolveMealItem(job.actionId, job.itemKey);
    }
  }, [resolveMealItem]);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || isPlanning) return;

    const hadExistingActions = actionsRef.current.some((a) => a.status !== "applied");

    setIsPlanning(true);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");

    const history = [...messages, { role: "user" as const, text }].slice(-8);
    const existingActions = uiActionsToPlanActions(actionsRef.current);

    const result = await planAssistantActions({ text, history, existingActions });
    if (!result.success) {
      toast.error(result.error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: hadExistingActions
            ? "I couldn't update the suggested actions right now, so I kept your existing suggestions below."
            : "Sorry, I had trouble with that. Could you tell me a bit more? For example, what meal was it, or roughly how much of each item?",
        },
      ]);
      setIsPlanning(false);
      return;
    }

    const nextActions = planToUiActions(result.data);
    const applied = actionsRef.current.filter((a) => a.status === "applied");

    if (nextActions.length > 0) {
      setMessages((prev) => [...prev, { role: "assistant", text: result.data.message }]);
      setPlanMessage(result.data.message);
      const merged = [...applied, ...nextActions];
      setActions(merged);
      actionsRef.current = merged;
      // Background resolve USDA matches for meal items
      void resolveAllMeals(nextActions);
      setIsPlanning(false);

      if (mode === "conversation" && (handsFree || pendingVoiceConfirmRef.current)) {
        pendingVoiceConfirmRef.current = false;
        void (async () => {
          const ok = await waitForMealMatches(7000);
          if (!ok) {
            await speak("I need you to confirm a food match on screen before I can log this.");
            setVoicePhase("idle");
            return;
          }
          const summary = describeActionsForSpeech(actionsRef.current.filter((a) => a.status !== "applied"));
          await speak(`${summary} Say yes to confirm, or no to cancel.`);
          startConsentListening();
        })();
      } else {
        setVoicePhase("idle");
      }
      return;
    }

    // If we had existing suggestions, treat an empty action list as "no change" and keep the list.
    if (hadExistingActions) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Got it. I kept your existing suggestions below—edit any item details and apply." },
      ]);
      setPlanMessage("Updated details. Review and apply the suggested logs below.");
      setActions(actionsRef.current);
      setIsPlanning(false);
      setVoicePhase("idle");
      return;
    }

    setMessages((prev) => [...prev, { role: "assistant", text: result.data.message }]);
    setPlanMessage(result.data.message);
    setActions([...applied]);
    setIsPlanning(false);
    if (mode === "conversation" && handsFree) {
      void (async () => {
        await speak(result.data.message);
        listeningPurposeRef.current = "dictation";
        startListeningRef.current();
      })();
    }
  }, [
    actionsRef,
    describeActionsForSpeech,
    handsFree,
    input,
    isPlanning,
    messages,
    mode,
    resolveAllMeals,
    speak,
    startConsentListening,
    toast,
    waitForMealMatches,
  ]);

  useEffect(() => {
    submitRef.current = () => {
      void submit();
    };
  }, [submit]);

  const stopListening = useCallback(() => {
    listeningDesiredRef.current = false;
    clearSilenceTimer();
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
  }, [clearSilenceTimer]);

  const startListening = useCallback(() => {
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
      dictationFinalRef.current = input.trim() ? `${input.trim()} ` : "";
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
          const text = (dictationFinalRef.current || input).trim();
          if (!text) return;
          pendingVoiceConfirmRef.current = true;
          stopListening();
          submitRef.current();
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
  }, [clearSilenceTimer, handsFree, input, stopListening, toast]);

  useEffect(() => {
    startListeningRef.current = startListening;
    stopListeningRef.current = stopListening;
  }, [startListening, stopListening]);

  useEffect(() => {
    if (!open) {
      stopListening();
      stopSpeaking();
      setVoicePhase("idle");
      return;
    }

    if (mode === "conversation") {
      // Voice-first: start listening as soon as the modal opens (gesture already occurred).
      if (handsFree && voicePhaseRef.current === "idle" && !isListening) {
        listeningPurposeRef.current = "dictation";
        startListening();
      }
    } else {
      // Chat mode should never auto-start listening.
      stopListening();
      setVoicePhase("idle");
    }
  }, [handsFree, isListening, mode, open, startListening, stopListening, stopSpeaking]);

  const applySelected = useCallback(async () => {
    const selectedActions = actions.filter((a) => a.selected);
    if (selectedActions.length === 0) return;

    setActions((prev) => prev.map((a) => (a.selected ? { ...a, status: "applying", error: undefined } : a)));

    try {
      for (const action of selectedActions) {
        if (action.type === "log_meal") {
          const date = action.data.date || new Date().toISOString().slice(0, 10);
          const mealType = action.data.mealType || defaultMealTypeFromClock();

          const unresolved = action.data.items.filter((i) => !i.matchedFood);
          if (unresolved.length > 0) {
            throw new Error(`Pick USDA matches for: ${unresolved.map((u) => u.label).join(", ")}`);
          }

          await createMealLog.mutateAsync({
            date,
            meal_type: mealType,
            notes: action.data.notes,
            items: action.data.items.map((item) => ({
              custom_food_name: item.label.trim() || item.matchedFood?.description || "Unknown food",
              custom_food_nutrients: item.matchedFood ? transformNutrients(item.matchedFood.nutrients) : undefined,
              servings: item.servings,
            })),
          });
        }

        if (action.type === "log_symptom") {
          const list = symptomsList.data ?? [];
          const target = normalizeName(action.data.symptom);
          const match = list.find((s) => normalizeName((s as any).name) === target) as any | undefined;
          const symptomId =
            match?.id ??
            (await createCustomSymptom.mutateAsync({ name: action.data.symptom.trim(), category: "other" })).id;

          await createSymptomLog.mutateAsync({
            symptom_id: symptomId,
            severity: Math.max(1, Math.min(10, Math.round(action.data.severity ?? 5))),
            logged_at: buildLoggedAtIso({ date: action.data.date, time: action.data.time }),
            notes: action.data.notes,
          });
        }

        if (action.type === "log_supplement") {
          const list = supplementsList.data ?? [];
          const target = normalizeName(action.data.supplement);
          const match = list.find((s) => normalizeName((s as any).name) === target) as any | undefined;

          await createSupplementLog.mutateAsync({
            supplement_id: match?.id,
            supplement_name: action.data.supplement.trim(),
            dosage: Number.isFinite(action.data.dosage) ? (action.data.dosage as number) : 1,
            unit: (action.data.unit || "serving").trim(),
            logged_at: buildLoggedAtIso({ date: action.data.date, time: action.data.time }),
            notes: action.data.notes,
          });
        }

        setActions((prev) =>
          prev.map((a) => (a.id === action.id ? { ...a, status: "applied", selected: false } : a))
        );
      }

      toast.success("Applied actions");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply actions";
      toast.error(message);
      setActions((prev) =>
        prev.map((a) => (a.selected && a.status === "applying" ? { ...a, status: "error", error: message } : a))
      );
    }
  }, [actions, createCustomSymptom, createMealLog, createSupplementLog, createSymptomLog, supplementsList.data, symptomsList.data, toast]);

  useEffect(() => {
    handleConsentTextRef.current = (text: string) => {
      const t = text.trim().toLowerCase();
      if (!t) return;
      if (voicePhaseRef.current !== "awaiting_consent") return;

      if (/\b(yes|yep|yeah|confirm|go ahead|do it|apply|sounds good)\b/.test(t)) {
        stopListening();
        void (async () => {
          setVoicePhase("applying");
          await applySelected();
          await speak("Done.");
          setVoicePhase("idle");
          if (handsFree && open && mode === "conversation") {
            listeningPurposeRef.current = "dictation";
            startListeningRef.current();
          }
        })();
        return;
      }

      if (/\b(no|nope|cancel|stop|never mind|nevermind)\b/.test(t)) {
        stopListening();
        void (async () => {
          await speak("Okay. I won't add anything.");
          setVoicePhase("idle");
          if (handsFree && open && mode === "conversation") {
            listeningPurposeRef.current = "dictation";
            startListeningRef.current();
          }
        })();
        return;
      }

      if (/\b(repeat|again|say that again)\b/.test(t)) {
        stopListening();
        void (async () => {
          const summary = describeActionsForSpeech(actionsRef.current.filter((a) => a.status !== "applied"));
          await speak(`${summary} Say yes to confirm, or no to cancel.`);
          startConsentListening();
        })();
      }
    };
  }, [applySelected, describeActionsForSpeech, handsFree, mode, open, speak, startConsentListening, stopListening]);

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
                onClick={() => setMode("chat")}
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-all",
                  mode === "conversation"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50"
                )}
                onClick={() => setMode("conversation")}
              >
                <Volume2 className="w-4 h-4" />
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
          <div className="rounded-[var(--radius-lg)] border border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-950/30 p-4">
            <div className="space-y-3 max-h-[34vh] overflow-auto pr-1">
              {messages.length === 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Example: “I ate lunch: chicken breast and a cup of broccoli. I had a headache at 2pm and took magnesium.”
                </div>
              ) : (
                messages.map((m, idx) => (
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
                ))
              )}
            </div>

            <div className="mt-3 space-y-2">
              {mode === "conversation" && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {voicePhase === "awaiting_consent"
                    ? "Listening for “yes” to confirm or “no” to cancel…"
                    : voicePhase === "speaking"
                    ? "Speaking…"
                    : isListening
                    ? "Listening… (pause to submit)"
                    : "Ready."}
                </div>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
                  placeholder={mode === "conversation" ? "Speak or type…" : "Type or dictate…"}
                />
                <Button
                  variant={isListening ? "destructive" : "outline"}
                  onClick={() => {
                    listeningPurposeRef.current = mode === "conversation" && voicePhase === "awaiting_consent" ? "consent" : "dictation";
                    if (isListening) stopListening();
                    else startListening();
                  }}
                  size="icon"
                  aria-label={isListening ? "Stop listening" : "Start listening"}
                >
                  {isListening ? <X className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button
                  onClick={() => {
                    pendingVoiceConfirmRef.current = mode === "conversation";
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

          {hasAnyActions && (
            <div className="space-y-3">
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
                {actions.map((action) => (
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
                                Confidence: {Math.round(action.confidence * 100)}%
                                {action.status === "applied" ? " • Applied" : action.status === "applying" ? " • Applying…" : ""}
                              </div>
                            </div>
                            {action.type === "log_meal" && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label={action.data.items.some((i) => i.expanded) ? "Collapse items" : "Expand items"}
                                  onClick={() =>
                                    setActions((prev) =>
                                      prev.map((a) => {
                                        if (a.id !== action.id || a.type !== "log_meal") return a;
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

                          {action.type === "log_meal" && (
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
                                                if (a.id !== action.id || a.type !== "log_meal") return a;
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
                                                    if (a.id !== action.id || a.type !== "log_meal") return a;
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
                                                      if (a.id !== action.id || a.type !== "log_meal") return a;
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
                                                      if (a.id !== action.id || a.type !== "log_meal") return a;
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
                                            Servings:{" "}
                                            <input
                                              className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-950"
                                              inputMode="decimal"
                                              value={item.servings}
                                              onChange={(e) => {
                                                const v = Number(e.target.value);
                                                setActions((prev) =>
                                                  prev.map((a) => {
                                                    if (a.id !== action.id || a.type !== "log_meal") return a;
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
                                              if (a.id !== action.id || a.type !== "log_meal") return a;
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
                                                setActions((prev) =>
                                                  prev.map((a) => {
                                                    if (a.id !== action.id || a.type !== "log_meal") return a;
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
                                              setActions((prev) =>
                                                prev.map((a) => {
                                                  if (a.id !== action.id || a.type !== "log_meal") return a;
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

                          {action.type === "log_symptom" && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2">
                                <label className="text-xs text-slate-500">Symptom</label>
                                <Input
                                  value={action.data.symptom}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) => (a.id === action.id && a.type === "log_symptom" ? { ...a, data: { ...a.data, symptom: e.target.value } } : a))
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
                                        a.id === action.id && a.type === "log_symptom"
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
                                        a.id === action.id && a.type === "log_symptom" ? { ...a, data: { ...a.data, date: e.target.value } } : a
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
                                        a.id === action.id && a.type === "log_symptom"
                                          ? { ...a, data: { ...a.data, time: e.target.value || null } }
                                          : a
                                      )
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                          {action.type === "log_supplement" && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <div className="sm:col-span-2">
                                <label className="text-xs text-slate-500">Supplement</label>
                                <Input
                                  value={action.data.supplement}
                                  onChange={(e) =>
                                    setActions((prev) =>
                                      prev.map((a) => (a.id === action.id && a.type === "log_supplement" ? { ...a, data: { ...a.data, supplement: e.target.value } } : a))
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
                                        a.id === action.id && a.type === "log_supplement"
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
                                        a.id === action.id && a.type === "log_supplement"
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
                                        a.id === action.id && a.type === "log_supplement" ? { ...a, data: { ...a.data, date: e.target.value } } : a
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
                                        a.id === action.id && a.type === "log_supplement"
                                          ? { ...a, data: { ...a.data, time: e.target.value || null } }
                                          : a
                                      )
                                    )
                                  }
                                />
                              </div>
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
