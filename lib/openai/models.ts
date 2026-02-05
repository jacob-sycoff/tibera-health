export const OPENAI_MODELS = {
  assistant: {
    cheap: "gpt-5-mini-2025-08-07",
    strong: "gpt-5.2-2025-12-11",
  },
  assistantV2: "gpt-5-mini-2025-08-07",
  mealPhoto: {
    cheap: "gpt-5-mini-2025-08-07",
    strong: "gpt-5.2-2025-12-11",
  },
  realtime: {
    model: "gpt-realtime",
    voice: "marin",
  },
  tts: {
    model: "tts-1",
    voice: "shimmer",
  },
  intentClassifier: "gpt-4.1-nano-2025-04-14",
  usdaReranker: "gpt-4.1-nano-2025-04-14",
} as const;
