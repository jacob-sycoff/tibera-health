-- Expand assistant session mode check constraint to support v2.
-- Idempotent and safe to re-run.

DO $$
BEGIN
  IF to_regclass('public.assistant_sessions') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assistant_sessions_mode_check'
      AND conrelid = 'public.assistant_sessions'::regclass
  ) THEN
    ALTER TABLE public.assistant_sessions DROP CONSTRAINT assistant_sessions_mode_check;
  END IF;

  BEGIN
    ALTER TABLE public.assistant_sessions
      ADD CONSTRAINT assistant_sessions_mode_check
      CHECK (mode IN ('chat', 'conversation', 'conversation_v2'));
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;
