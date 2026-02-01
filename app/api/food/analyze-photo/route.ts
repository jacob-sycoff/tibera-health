/**
 * Meal Photo Analysis API Route
 *
 * Uses Claude Vision to identify foods in a meal photo and estimate portions.
 *
 * POST /api/food/analyze-photo
 * Body: { image: string (base64), mimeType: string, note?: string }
 * Returns: { success: boolean, data?: AnalysisResult, error?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

async function tryExtraction(args: {
  model: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  imageBase64: string;
  note?: string;
}): Promise<AnalysisResult | null> {
  const noteText = args.note?.trim();
  const userNoteBlock = noteText
    ? `\n\nUser note (applies to what was actually eaten):\n${noteText}`
    : "";

  const response = await anthropic.messages.create({
    model: args.model,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: args.mediaType,
              data: args.imageBase64,
            },
          },
          {
            type: "text",
            text: `${EXTRACTION_PROMPT}${userNoteBlock}`,
          },
        ],
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") return null;

  try {
    const data = JSON.parse(cleanJson(textContent.text)) as unknown;
    const parsed = AnalysisResultSchema.safeParse(data);
    if (!parsed.success) return null;
    return normalizeResult(parsed.data);
  } catch {
    return null;
  }
}

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
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "AI service not configured. Please add ANTHROPIC_API_KEY to environment variables.",
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

    const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
    const mediaType = (validMimeTypes.includes(mimeType as (typeof validMimeTypes)[number])
      ? mimeType
      : "image/jpeg") as (typeof validMimeTypes)[number];

    let extracted = await tryExtraction({
      model: "claude-haiku-4-5-20251001",
      mediaType,
      imageBase64: image,
      note,
    });

    if (!extracted) {
      extracted = await tryExtraction({
        model: "claude-sonnet-4-20250514",
        mediaType,
        imageBase64: image,
        note,
      });
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

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { success: false, error: "Invalid API key. Please check ANTHROPIC_API_KEY." },
          { status: 500 }
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { success: false, error: "Rate limit exceeded. Please try again in a moment." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "Failed to analyze image. Please try again." },
      { status: 500 }
    );
  }
}

