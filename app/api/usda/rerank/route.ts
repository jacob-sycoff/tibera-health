/**
 * USDA Candidate Rerank API Route
 *
 * Uses a nano model to pick the best USDA FDC candidate for a short query.
 *
 * POST /api/usda/rerank
 * Body: { query: string, candidates: Array<{ fdcId: string, description: string, dataType?: string, brandOwner?: string }> }
 * Returns: { success: true, pick: { fdcId: string | null, confidence: number, needs_user_confirmation: boolean } }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { OPENAI_MODELS } from "@/lib/openai/models";

const CandidateSchema = z.object({
  fdcId: z.string().min(1),
  description: z.string().min(1),
  dataType: z.string().optional(),
  brandOwner: z.string().optional(),
});

const RequestSchema = z.object({
  query: z.string().min(1).max(160),
  candidates: z.array(CandidateSchema).min(2).max(18),
});

const ModelResponseSchema = z.object({
  fdcId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  needs_user_confirmation: z.boolean(),
});

const SYSTEM_PROMPT = `You choose the best USDA food database candidate for a user's short food query.

Rules:
- Output ONLY valid JSON with keys: fdcId, confidence, needs_user_confirmation.
- fdcId must be one of the provided candidate fdcIds, or null if none match.
- confidence: 0 to 1.
- needs_user_confirmation: true if the query is ambiguous or multiple plausible matches exist.

Important matching guidance:
- Prefer generic Foundation/SR Legacy entries over branded unless the query includes a brand.
- Do not choose egg whites/yolks if the query is just "egg" or "eggs" (prefer whole egg).
- Avoid introducing extra major ingredients or processed forms not mentioned (oil, powder, concentrate, etc.).
- If the query is very generic (e.g. "yogurt"), set needs_user_confirmation=true unless one candidate is clearly the generic base item.
`;

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ success: true, pick: { fdcId: null, confidence: 0, needs_user_confirmation: true } });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });

  const { query, candidates } = parsed.data;
  const candidateBlock = candidates
    .map((c) => ({
      fdcId: c.fdcId,
      description: c.description,
      dataType: c.dataType ?? null,
      brandOwner: c.brandOwner ?? null,
    }))
    .slice(0, 18);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODELS.usdaReranker,
        temperature: 0,
        max_tokens: 120,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({ query, candidates: candidateBlock }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      return NextResponse.json(
        { success: true, pick: { fdcId: null, confidence: 0, needs_user_confirmation: true }, error: `OpenAI ${response.status}: ${errBody.slice(0, 200)}` },
        { status: 200 }
      );
    }

    const json = await response.json();
    const raw = (json.choices?.[0]?.message?.content ?? "").trim();

    let parsedPick: unknown = null;
    try {
      parsedPick = JSON.parse(raw);
    } catch {
      // fall through
    }

    const out = ModelResponseSchema.safeParse(parsedPick);
    if (!out.success) {
      return NextResponse.json({ success: true, pick: { fdcId: null, confidence: 0, needs_user_confirmation: true } }, { status: 200 });
    }

    const pick = out.data;
    const valid = pick.fdcId ? candidates.some((c) => c.fdcId === pick.fdcId) : true;
    if (!valid) {
      return NextResponse.json({ success: true, pick: { fdcId: null, confidence: 0, needs_user_confirmation: true } }, { status: 200 });
    }

    return NextResponse.json({ success: true, pick }, { status: 200 });
  } catch {
    return NextResponse.json({ success: true, pick: { fdcId: null, confidence: 0, needs_user_confirmation: true } }, { status: 200 });
  }
}

