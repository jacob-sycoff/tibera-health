-- Add flexible JSONB attributes for supplement/product-specific metadata.
-- This supports richer filtering (e.g., omega-3 form, third-party testing, pregnancy notes)
-- without constantly changing the schema.

ALTER TABLE public.supplements
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Helpful for querying/filtering on JSON keys.
CREATE INDEX IF NOT EXISTS idx_supplements_attributes_gin
  ON public.supplements
  USING GIN (attributes);

