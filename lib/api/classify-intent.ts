/**
 * Client-side helper for the intent classification API.
 * Calls GPT-4.1 Nano to classify a voice utterance as confirm/cancel/new_instruction.
 */

export type IntentClass = "confirm" | "cancel" | "new_instruction";

export async function classifyIntent(
  text: string,
  options?: { signal?: AbortSignal }
): Promise<IntentClass> {
  const response = await fetch("/api/assistant/classify-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: options?.signal,
  });

  const json = (await response.json()) as {
    success: boolean;
    intent?: IntentClass;
    error?: string;
  };

  if (!json.success || !json.intent) {
    throw new Error(json.error ?? "Classification failed");
  }

  return json.intent;
}
