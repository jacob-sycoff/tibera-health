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
import { conversationV2, type AssistantV2Response } from "@/lib/api/assistant-v2";
import { conversationV3, type AssistantV3Response } from "@/lib/api/assistant-v3";
import { getFoodDetails, smartSearchFoods } from "@/lib/api/usda";
import { amountFromGrams, gramsFromAmount, roundTo1Decimal } from "@/lib/utils/units";
import { FoodSearch } from "@/components/food/food-search";
import { events } from "@/lib/events/client";
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
type RealtimeStatus = "disconnected" | "connecting" | "connected" | "error";

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
  const [mode, setMode] = useState<"chat" | "conversation" | "conversation_v2" | "conversation_v3">("conversation");
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
  const realtimeSpeakingResolveRef = useRef<(() => void) | null>(null);
  const realtimeSpeakingPendingRef = useRef(false);
  const realtimeTranscribePendingRef = useRef(false);
  const realtimeTranscribeTextRef = useRef<string>("");
  const realtimeTranscribeTimerRef = useRef<number | null>(null);
  const realtimeTranscriptionDeltaByItemRef = useRef<Record<string, string>>({});

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
    if (mode !== "chat" && rtcDataChannelRef.current?.readyState === "open") {
      if (realtimeSpeakingPendingRef.current) {
        sendRealtimeEvent({ type: "response.cancel" });
        realtimeSpeakingPendingRef.current = false;
        realtimeSpeakingResolveRef.current?.();
        realtimeSpeakingResolveRef.current = null;
      }
      return;
    }

    if (typeof window === "undefined") return;
    if (!supportsTts) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }, [mode, sendRealtimeEvent, supportsTts]);

  const disconnectRealtime = useCallback(() => {
    realtimeSpeakingPendingRef.current = false;
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
    realtimeSpeakingResolveRef.current?.();
    realtimeSpeakingResolveRef.current = null;

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
        if (realtimeSpeakingPendingRef.current) {
          realtimeSpeakingPendingRef.current = false;
          realtimeSpeakingResolveRef.current?.();
          realtimeSpeakingResolveRef.current = null;
          if (voicePhaseRef.current === "speaking") setVoicePhase("idle");
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
                transcription: { model: "gpt-4o-mini-transcribe", language: "en" },
                noise_reduction: { type: "near_field" },
                turn_detection: {
                  type: "server_vad",
                  // We only want turn events + transcription; the app explicitly requests spoken responses.
                  create_response: false,
                  interrupt_response: true,
                  silence_duration_ms: 650,
                },
              },
              output: { voice },
            },
            instructions:
              "You are the Tibera Health voice interface. Do not proactively respond. Only speak when the client explicitly requests a response.",
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

      if (rtcDataChannelRef.current?.readyState === "open") {
        stopSpeaking();
        setVoicePhase("speaking");
        realtimeSpeakingPendingRef.current = true;

        await new Promise<void>((resolve) => {
          realtimeSpeakingResolveRef.current = resolve;
          sendRealtimeEvent({
            type: "response.create",
            response: {
              output_modalities: ["audio"],
              max_output_tokens: 256,
              audio: { output: { voice: realtimeVoiceRef.current } },
              instructions: `Say this to the user, verbatim:\n\n${text}`,
            },
          });
        });

        return;
      }

      if (!supportsTts) return;
      stopSpeaking();
      // Avoid feedback loops in the fallback path.
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
    [mode, sendRealtimeEvent, stopSpeaking, supportsTts]
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
    if (mode === "chat") return;
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
      const sorted = await smartSearchFoods(item.usdaQuery, 18);
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

  const applySelected = useCallback(async () => {
    const selectedActions = actionsRef.current.filter((a) => a.selected);
    if (selectedActions.length === 0) return;

    const sessionId = assistantSessionIdRef.current;
    events.emit(
      "assistant.apply.start",
      { turn_id: assistantTurnIdRef.current, selected_count: selectedActions.length },
      { session_id: sessionId }
    );

    setActions((prev) => prev.map((a) => (a.selected ? { ...a, status: "applying", error: undefined } : a)));

    try {
      for (const action of selectedActions) {
        if (action.type === "log_meal") {
          const date = action.data.date || new Date().toISOString().slice(0, 10);
          const mealType = action.data.mealType || defaultMealTypeFromClock();

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
          const match = list.find((s: any) => normalizeName((s as any).name) === target) as any | undefined;
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
          const match = list.find((s: any) => normalizeName((s as any).name) === target) as any | undefined;

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
    }
  }, [createCustomSymptom, createMealLog, createSupplementLog, createSymptomLog, supplementsList.data, symptomsList.data, toast]);

  const submit = useCallback(
    async (overrideText?: string, source: "typed" | "speech" = "typed") => {
      const text = (overrideText ?? input).trim();
      if (!text || isPlanning) return;

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

      const history = [...messages, { role: "user" as const, text }].slice(-8);
      const existingActions = uiActionsToPlanActions(actionsRef.current);

      const isV2 = mode === "conversation_v2";
      const isV3 = mode === "conversation_v3";
      const result = isV2
        ? await conversationV2({
            text,
            history,
            existingActions: existingActions as unknown as AssistantV2Response["actions"],
            sessionId,
            correlationId,
            inputSource: source,
            mode,
          })
        : isV3
        ? await conversationV3({
            text,
            history,
            existingActions: existingActions as unknown as AssistantV3Response["actions"],
            sessionId,
            correlationId,
            inputSource: source,
            mode,
          })
        : await planAssistantActions({
            text,
            history,
            existingActions,
            sessionId,
            correlationId,
            inputSource: source,
            mode: mode === "conversation" ? "conversation" : "chat",
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

      const v2Data = (isV2 ? (result.data as any) : null) as AssistantV2Response | null;
      const v3Data = (isV3 ? (result.data as any) : null) as AssistantV3Response | null;
      assistantTurnIdRef.current = result.meta?.turnId ?? null;
      events.emit(
        isV2 ? "assistant.v2.received" : isV3 ? "assistant.v3.received" : "assistant.plan.received",
        {
          correlation_id: correlationId,
          turn_id: assistantTurnIdRef.current,
          actions_count: (result.data as any).actions.length,
          ...(isV2 ? { intent: v2Data?.decision.intent, apply: v2Data?.decision.apply } : {}),
          ...(isV3 ? { intent: v3Data?.decision.intent, apply: v3Data?.decision.apply } : {}),
        },
        { session_id: sessionId }
      );

      const nextActions = planToUiActions(result.data);
      const applied = actionsRef.current.filter((a) => a.status === "applied");

      const structured = (isV2 ? v2Data : isV3 ? v3Data : null) as (AssistantV2Response | AssistantV3Response) | null;
      if ((isV2 || isV3) && structured) {
        const handling = structured.decision.action_handling;

        if (handling === "keep") {
          setMessages((prev) => [...prev, { role: "assistant", text: structured.message }]);
          setPlanMessage(structured.message);
          setActions(actionsRef.current);
          setIsPlanning(false);
          if (handsFree) {
            void (async () => {
              await speak(structured.message);
              listeningPurposeRef.current = "dictation";
              startListeningRef.current();
            })();
          } else {
            setVoicePhase("idle");
          }
          return;
        }

        if (handling === "clear") {
          setMessages((prev) => [...prev, { role: "assistant", text: structured.message }]);
          setPlanMessage(structured.message);
          setActions([...applied]);
          actionsRef.current = [...applied];
          setIsPlanning(false);
          if (handsFree) {
            void (async () => {
              await speak(structured.message);
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
          setMessages((prev) => [...prev, { role: "assistant", text: structured.message }]);
          setPlanMessage(structured.message);
          setActions([...applied]);
          actionsRef.current = [...applied];
          setIsPlanning(false);
          if (handsFree) {
            void (async () => {
              await speak(structured.message);
              listeningPurposeRef.current = "dictation";
              startListeningRef.current();
            })();
          } else {
            setVoicePhase("idle");
          }
          return;
        }
      }

      if (nextActions.length > 0) {
        setMessages((prev) => [...prev, { role: "assistant", text: result.data.message }]);
        setPlanMessage(result.data.message);
        const merged = [...applied, ...nextActions];
        setActions(merged);
        actionsRef.current = merged;
        // Background resolve USDA matches for meal items
        void resolveAllMeals(nextActions);
        setIsPlanning(false);

        if (mode !== "chat" && (handsFree || pendingVoiceConfirmRef.current)) {
          pendingVoiceConfirmRef.current = false;
          void (async () => {
            if ((isV2 && v2Data?.decision.apply === "auto") || (isV3 && v3Data?.decision.apply === "auto")) {
              setVoicePhase("applying");
              await speak(result.data.message);
              await applySelected();
              await speak("Done.");
              setVoicePhase("idle");
              if (handsFree && open) {
                listeningPurposeRef.current = "dictation";
                startListeningRef.current();
              }
              return;
            }

            if ((isV2 && v2Data?.decision.apply === "none") || (isV3 && v3Data?.decision.apply === "none")) {
              await speak(result.data.message);
              setVoicePhase("idle");
              if (handsFree && open) {
                listeningPurposeRef.current = "dictation";
                startListeningRef.current();
              }
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
      if (mode !== "chat" && handsFree) {
        void (async () => {
          await speak(result.data.message);
          listeningPurposeRef.current = "dictation";
          startListeningRef.current();
        })();
      } else setVoicePhase("idle");
    },
    [
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

      if (/\b(yes|yep|yeah|confirm|go ahead|do it|apply|sounds good)\b/.test(t)) {
        events.emit(
          "assistant.consent.yes",
          { turn_id: assistantTurnIdRef.current, correlation_id: assistantCorrelationIdRef.current },
          { session_id: assistantSessionIdRef.current }
        );
        stopListeningRef.current();
        void (async () => {
          setVoicePhase("applying");
          await applySelected();
          await speak("Done.");
          setVoicePhase("idle");
          if (handsFree && open) {
            listeningPurposeRef.current = "dictation";
            startListeningRef.current();
          }
        })();
        return;
      }

      if (/\b(no|nope|cancel|stop|never mind|nevermind)\b/.test(t)) {
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
        return;
      }

      if (/\b(repeat|again|say that again)\b/.test(t)) {
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
      }
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
                  mode === "conversation"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50"
                )}
                onClick={() => {
                  stopListening();
                  setMode("conversation");
                }}
              >
                <Volume2 className="w-4 h-4" />
                Conversation v1
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-all",
                  mode === "conversation_v2"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50"
                )}
                onClick={() => {
                  stopListening();
                  setMode("conversation_v2");
                }}
              >
                <Sparkles className="w-4 h-4" />
                Conversation v2
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
                Conversation v3
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
              {mode !== "chat" && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {realtimeStatus === "connecting"
                    ? "Connecting voice…"
                    : realtimeStatus === "error"
                    ? `Voice error: ${realtimeError || "failed to start"}`
                    : voicePhase === "awaiting_consent"
                    ? "Listening for “yes” to confirm or “no” to cancel…"
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
