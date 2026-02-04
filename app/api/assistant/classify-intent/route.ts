/**
 * Intent Classification API Route
 *
 * Uses GPT-4.1 Nano to classify a short voice utterance as
 * "confirm", "cancel", or "new_instruction".
 *
 * POST /api/assistant/classify-intent
 * Body: { text: string }
 * Returns: { success: true, intent: "confirm" | "cancel" | "new_instruction" }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { OPENAI_MODELS } from "@/lib/openai/models";

const RequestSchema = z.object({
  text: z.string().min(1).max(500),
});

const SYSTEM_PROMPT = `You classify short voice transcriptions. The user was asked to confirm or cancel a set of pending health log actions (meals, symptoms, supplements, sleep). Respond with exactly one word:
- "confirm" if the user is agreeing, saying yes, or wants to proceed/apply/save/log it (e.g. "yes", "ok", "log it", "save it", "do it", "go ahead", "sure", "sounds good", "perfect")
- "cancel" if the user is refusing, saying no, or wants to stop/discard (e.g. "no", "cancel", "stop", "never mind")
- "new_instruction" if the user is giving a completely new, unrelated command (e.g. "I had eggs for breakfast", "what's my weight?", "edit the time to 3pm")

IMPORTANT: "log it", "save it", "do it", "submit it" all mean CONFIRM — the user wants to save the pending actions. Do NOT classify these as new_instruction.

Common speech-recognition errors to account for: "buy it" often means "do it", "dew it" means "do it", "by it" means "do it", "lock it" means "log it". Respond with only one word.`;

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "AI service not configured" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_MODELS.intentClassifier,
          temperature: 0,
          max_tokens: 3,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: parsed.data.text },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI ${response.status}: ${errBody}`);
    }

    const json = await response.json();
    const raw = (json.choices?.[0]?.message?.content ?? "")
      .trim()
      .toLowerCase();

    const intent =
      raw === "confirm" || raw === "cancel" || raw === "new_instruction"
        ? raw
        : "new_instruction"; // default to new_instruction if model returns something unexpected

    return NextResponse.json({ success: true, intent });
  } catch (error) {
    console.error("classify-intent error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Classification failed",
      },
      { status: 502 }
    );
  }
}
