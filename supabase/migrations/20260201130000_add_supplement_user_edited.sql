-- Track whether a supplement has been manually edited by a user after creation.
-- Helps distinguish AI scan errors from user corrections when reviewing data.

ALTER TABLE public.supplements
  ADD COLUMN IF NOT EXISTS user_edited BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_edited_at TIMESTAMPTZ;
