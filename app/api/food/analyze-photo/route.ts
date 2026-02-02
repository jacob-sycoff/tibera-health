/**
 * Meal Photo Analysis API Route
 *
 * Uses OpenAI Vision to identify foods in a meal photo and estimate portions.
 *
 * POST /api/food/analyze-photo
 * Body: { image: string (base64), mimeType: string, note?: string }
 * Returns: { success: boolean, data?: AnalysisResult, error?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  image: z.string().min(1),
  mimeType: z.string().optional(),
  note: z.string().optional(),
});

const AnalysisItemSchema = z.object({
  name: z.string().min(1),
  usdaQuery: z.string().min(1),
  servedGrams: z.number().positive().nullable().optional(),
  consumedGrams: z.number().positive().nullable().optional(),
  consumedFraction: z.number().min(0).max(1).nullable().optional(),
  confidence: z.number().min(0).max(1),
});

const AnalysisResultSchema = z.object({
  items: z.array(AnalysisItemSchema).min(1),
  assumptions: z.array(z.string()).default([]),
  overallConfidence: z.number().min(0).max(1),
});

type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

function cleanJson(text: string): string {
  let jsonText = text.trim();
  if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
  if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
  if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);
  return jsonText.trim();
}

function normalizeMimeType(mimeType: string | undefined): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
  return (validMimeTypes.includes(mimeType as (typeof validMimeTypes)[number]) ? mimeType : "image/jpeg") as (typeof validMimeTypes)[number];
}

async function tryOpenAiExtraction(args: {
  model: string;
  imageBase64: string;
  mimeType: string;
  note?: string;
}): Promise<AnalysisResult | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const noteText = args.note?.trim();
  const userNoteBlock = noteText
    ? `\n\nUser note (applies to what was actually eaten):\n${noteText}`
    : "";

  const prompt = `${EXTRACTION_PROMPT}${userNoteBlock}`;
  const imageUrl = `data:${args.mimeType};base64,${args.imageBase64}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.2,
      max_tokens: 1400,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = json.choices?.[0]?.message?.content;
  if (!text) return null;

  try {
    const data = JSON.parse(cleanJson(text)) as unknown;
    const parsed = AnalysisResultSchema.safeParse(data);
    if (!parsed.success) return null;
    return normalizeResult(parsed.data);
  } catch {
    return null;
  }
}

const EXTRACTION_PROMPT = `You are an expert nutritionist and meal photo analyst.

Goal: identify the foods in the image and estimate portions so the user can log what they ate.

IMPORTANT:
- If the user provides a note like "I ate half the chicken but finished the rice", incorporate that into "consumedFraction" and/or "consumedGrams".
- Prefer splitting composite dishes into components when obvious (e.g., chicken + rice + vegetables + sauce).
- Provide conservative estimates and lower confidence when uncertain.
- Use grams when possible. If grams are not possible, set servedGrams/consumedGrams to null.
- "usdaQuery" should be a short search query suitable for USDA FoodData Central (e.g., "grilled chicken breast", "white rice cooked", "broccoli steamed").

Return ONLY valid JSON with this EXACT structure:
{
  "items": [
    {
      "name": "string",
      "usdaQuery": "string",
      "servedGrams": number | null,
      "consumedGrams": number | null,
      "consumedFraction": number | null,
      "confidence": number
    }
  ],
  "assumptions": ["string"],
  "overallConfidence": number
}

Rules:
- confidence and overallConfidence must be between 0 and 1
- If consumedGrams is provided, it should reflect what was eaten (not just served)
- If consumedFraction is provided, it should reflect the fraction eaten (0-1)
- Do not include any extra keys.`;

function normalizeResult(result: AnalysisResult): AnalysisResult {
  const items = result.items
    .map((item) => {
      const servedGrams = item.servedGrams ?? null;
      const consumedGrams = item.consumedGrams ?? null;
      const consumedFraction = item.consumedFraction ?? null;

      return {
        ...item,
        servedGrams: Number.isFinite(servedGrams) ? servedGrams : null,
        consumedGrams: Number.isFinite(consumedGrams) ? consumedGrams : null,
        consumedFraction: Number.isFinite(consumedFraction) ? consumedFraction : null,
        confidence: Number.isFinite(item.confidence) ? item.confidence : 0.3,
      };
    })
    .filter((item) => item.name.trim().length > 0 && item.usdaQuery.trim().length > 0);

  const overallConfidence = Number.isFinite(result.overallConfidence)
    ? result.overallConfidence
    : calculateOverallConfidence(items);

  return {
    items: items.length > 0 ? items : result.items,
    assumptions: Array.isArray(result.assumptions) ? result.assumptions : [],
    overallConfidence,
  };
}

function calculateOverallConfidence(items: Array<z.infer<typeof AnalysisItemSchema>>): number {
  if (items.length === 0) return 0.2;
  const avg = items.reduce((sum, item) => sum + (Number.isFinite(item.confidence) ? item.confidence : 0.3), 0) / items.length;
  return Math.max(0, Math.min(1, Math.round(avg * 100) / 100));
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI service not configured. Please add OPENAI_API_KEY to environment variables.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const parsedBody = RequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    const { image, mimeType, note } = parsedBody.data;

    const mediaType = normalizeMimeType(mimeType);
    const openAiModels = {
      cheap: process.env.OPENAI_MEAL_PHOTO_MODEL_CHEAP || "gpt-4o-mini",
      strong: process.env.OPENAI_MEAL_PHOTO_MODEL_STRONG || "gpt-4o",
    };

    let extracted: AnalysisResult | null = null;
    extracted = await tryOpenAiExtraction({ model: openAiModels.cheap, imageBase64: image, mimeType: mediaType, note });
    if (!extracted) {
      extracted = await tryOpenAiExtraction({ model: openAiModels.strong, imageBase64: image, mimeType: mediaType, note });
    }

    if (!extracted) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not identify foods from the photo. Try a clearer image with better lighting.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, data: extracted });
  } catch (error) {
    console.error("Meal photo analysis error:", error);

    return NextResponse.json(
      { success: false, error: "Failed to analyze image. Please try again." },
      { status: 500 }
    );
  }
}
