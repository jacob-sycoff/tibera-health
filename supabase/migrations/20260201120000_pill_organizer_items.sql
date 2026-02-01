-- Pill Organizer Items
-- Stores which supplements a user has placed in their pill organizer grid,
-- along with display order.

CREATE TABLE IF NOT EXISTS public.pill_organizer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  supplement_id UUID NOT NULL REFERENCES public.supplements(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, supplement_id)
);

-- Index for fast lookup by user, ordered by sort_order
CREATE INDEX IF NOT EXISTS idx_pill_organizer_user_order
  ON public.pill_organizer_items(user_id, sort_order);

-- RLS
ALTER TABLE public.pill_organizer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own organizer items" ON public.pill_organizer_items
  FOR ALL USING (auth.uid() = user_id);

-- Disable for dev (matches current dev setup in 006_disable_rls_for_dev.sql)
ALTER TABLE public.pill_organizer_items DISABLE ROW LEVEL SECURITY;
