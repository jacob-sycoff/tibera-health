# Image-Based Food Logger (Design + MVP in this repo)

## Product goal
Let a user log a meal by taking a photo, then refine the result with optional text or voice (“I ate half the chicken but finished the rice”). The system should:

- Identify foods/components in the photo
- Estimate consumed amounts (with uncertainty)
- Map items to a nutrition database (USDA FoodData Central in this repo)
- Keep the user in control via a fast review/edit step

## Recommended UX (human-in-the-loop)
1. **Capture**: Take/select a photo.
2. **Context (optional)**: Add a text note or dictate a note.
3. **AI draft**: Show detected items + estimated amounts + confidence.
4. **Review**: User edits servings, removes/renames items, confirms.
5. **Save**: Persist to the existing meal log schema; show calories/macros immediately.

Key UX best practices:
- Always show uncertainty (confidence + assumptions).
- Make editing faster than re-trying (servings stepper, quick delete).
- Don’t block on “perfect” portion estimation; the user can correct.

## AI pipeline (best practice)
### 1) Vision → candidates
Use a vision-capable model to propose a structured list of meal components:
- `name` (human label)
- `usdaQuery` (query text for nutrition lookup)
- `servedGrams`, `consumedGrams`, `consumedFraction` (nullable)
- `confidence` per item + `overallConfidence`
- `assumptions` (e.g., “assumed standard plate size”)

### 2) Multimodal correction
- **Text note**: Parse note and apply deltas to each component (“half chicken”, “no sauce”).
- **Voice note**: Transcribe to text, then apply the same logic.
  - Option A (fast, client-side): Web Speech API dictation (browser-dependent)
  - Option B (robust, server-side): Whisper/ASR service (store + transcribe audio)

### 3) Nutrition mapping
Map each component to a nutrition entry:
- Search USDA FoodData Central with `usdaQuery`
- Select best match (automatic for MVP; user-select for higher accuracy)
- Convert `consumedGrams` → `servings` when the USDA serving unit is grams
- Store nutrients in `meal_items.custom_food_nutrients` (already supported)

### 4) Guardrails + reliability
- Never claim precision you don’t have: keep grams nullable.
- Clamp/round servings to reasonable values.
- If lookup fails, still log the item name so the user has a record.
- Rate-limit and cache where possible (USDA client already caches for 15 min).

## Data + privacy (recommended)
If storing images/audio:
- Use Supabase Storage with per-user paths and strict RLS policies.
- Store only what you need; support “don’t store media” mode (analyze then discard).
- Keep an `analysis_json` record for debugging and iterative prompt improvements.

## Evaluation (what to measure)
- **Edit rate**: how often users change items/servings (proxy for accuracy).
- **Time-to-log**: median seconds from photo → saved log.
- **Top-1 match rate**: USDA mapping correctness (sampled/labelled).
- **Portion error**: optional (if you run a user study with weighed foods).

## MVP implementation included in this repo
- Server analysis endpoint: `app/api/food/analyze-photo/route.ts` (Claude Vision → structured JSON)
- Client helper: `lib/api/meal-photo-logger.ts`
- UI flow: `app/food/log/photo/page.tsx`
- Entry points:
  - `app/food/page.tsx` includes a “Photo” button
  - `app/food/log/page.tsx` includes “Log from Photo”

Environment variables:
- `ANTHROPIC_API_KEY` (optional; enables Anthropic vision)
- `OPENAI_API_KEY` (optional; enables OpenAI vision)
- `AI_PROVIDER` (optional): `auto` (default) | `openai` | `anthropic`
- Model overrides (optional):
  - `OPENAI_VISION_MODEL_CHEAP` (default: `gpt-4o-mini`)
  - `OPENAI_VISION_MODEL_STRONG` (default: `gpt-4o`)
  - `ANTHROPIC_VISION_MODEL_CHEAP` (default: `claude-haiku-4-5-20251001`)
  - `ANTHROPIC_VISION_MODEL_STRONG` (default: `claude-sonnet-4-20250514`)
- `NEXT_PUBLIC_USDA_API_KEY` (optional, improves USDA lookup; demo key still works with limits)

## Next improvements (highest ROI)
1. Add “pick best match” UI for USDA results when confidence is low.
2. Store analysis + optional media in Supabase for later review and model tuning.
3. Add multi-photo meals and “before/after” plates for better consumption estimates.
4. Add portion aids: reference object prompt (“fork/hand”), depth (LiDAR), or segmentation (SAM).
