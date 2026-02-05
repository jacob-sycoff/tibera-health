import { z } from "zod";

export type RerankCandidate = {
  fdcId: string;
  description: string;
  dataType?: string;
  brandOwner?: string;
};

const ResponseSchema = z.object({
  success: z.boolean(),
  pick: z
    .object({
      fdcId: z.string().nullable(),
      confidence: z.number(),
      needs_user_confirmation: z.boolean(),
    })
    .optional(),
});

export async function rerankUsdaCandidates(args: {
  query: string;
  candidates: RerankCandidate[];
}): Promise<{ fdcId: string | null; confidence: number; needsUserConfirmation: boolean } | null> {
  const query = args.query.trim();
  if (!query) return null;
  if (!args.candidates || args.candidates.length < 2) return null;

  const res = await fetch("/api/usda/rerank", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, candidates: args.candidates.slice(0, 18) }),
  });

  const json = (await res.json().catch(() => null)) as unknown;
  const parsed = ResponseSchema.safeParse(json);
  if (!parsed.success) return null;
  if (!parsed.data.success) return null;

  const pick = parsed.data.pick;
  if (!pick) return null;
  return {
    fdcId: pick.fdcId ?? null,
    confidence: Number.isFinite(pick.confidence) ? pick.confidence : 0,
    needsUserConfirmation: Boolean(pick.needs_user_confirmation),
  };
}

