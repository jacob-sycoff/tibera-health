-- Add a new sleep factor option for logging.
-- Idempotent across environments (handles already-added values).

DO $$
BEGIN
  ALTER TYPE public.sleep_factor ADD VALUE 'late_night_chores';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

