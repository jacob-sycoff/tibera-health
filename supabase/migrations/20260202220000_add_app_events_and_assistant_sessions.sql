-- Unified app event log + assistant session/turn persistence
-- Idempotent and safe to re-run.

-- ============================================
-- 1) APP EVENTS (append-only)
-- ============================================

CREATE TABLE IF NOT EXISTS public.app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id UUID NULL,
  correlation_id UUID NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'client' CHECK (source IN ('client', 'server', 'db')),
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
  schema_version INT NOT NULL DEFAULT 1,
  privacy_level TEXT NOT NULL DEFAULT 'standard' CHECK (privacy_level IN ('standard', 'sensitive', 'redacted')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_events_user_ts ON public.app_events(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_session_ts ON public.app_events(session_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_type_ts ON public.app_events(event_type, ts DESC);

-- If this migration is re-run after an older version created a nullable idempotency_key,
-- repair it to ensure deterministic upserts from clients.
UPDATE public.app_events
SET idempotency_key = gen_random_uuid()::text
WHERE idempotency_key IS NULL;

ALTER TABLE public.app_events
  ALTER COLUMN idempotency_key SET DEFAULT (gen_random_uuid()::text),
  ALTER COLUMN idempotency_key SET NOT NULL;

DROP INDEX IF EXISTS public.ux_app_events_user_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS ux_app_events_user_idempotency
  ON public.app_events(user_id, idempotency_key);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_events'
      AND policyname = 'Users can read own app events'
  ) THEN
    CREATE POLICY "Users can read own app events" ON public.app_events
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_events'
      AND policyname = 'Users can insert own app events'
  ) THEN
    CREATE POLICY "Users can insert own app events" ON public.app_events
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_events'
      AND policyname = 'demo_app_events_all'
  ) THEN
    CREATE POLICY "demo_app_events_all" ON public.app_events
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- 2) ASSISTANT SESSIONS + TURNS
-- ============================================

CREATE TABLE IF NOT EXISTS public.assistant_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'conversation' CHECK (mode IN ('chat', 'conversation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_session_key TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_assistant_sessions_user_last_active ON public.assistant_sessions(user_id, last_active_at DESC);

ALTER TABLE public.assistant_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assistant_sessions'
      AND policyname = 'Users can manage own assistant sessions'
  ) THEN
    CREATE POLICY "Users can manage own assistant sessions" ON public.assistant_sessions
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assistant_sessions'
      AND policyname = 'demo_assistant_sessions_all'
  ) THEN
    CREATE POLICY "demo_assistant_sessions_all" ON public.assistant_sessions
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.assistant_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.assistant_sessions(id) ON DELETE CASCADE,
  correlation_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  input_text TEXT NOT NULL,
  input_source TEXT NOT NULL DEFAULT 'typed' CHECK (input_source IN ('typed', 'speech')),
  plan_json JSONB NULL,
  plan_message TEXT NULL,
  plan_actions_count INT NULL,
  plan_model TEXT NULL,
  plan_latency_ms INT NULL,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  applied_at TIMESTAMPTZ NULL,
  apply_error TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_assistant_turns_user_created_at ON public.assistant_turns(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_turns_session_created_at ON public.assistant_turns(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_turns_correlation_id ON public.assistant_turns(correlation_id);

ALTER TABLE public.assistant_turns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assistant_turns'
      AND policyname = 'Users can manage own assistant turns'
  ) THEN
    CREATE POLICY "Users can manage own assistant turns" ON public.assistant_turns
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assistant_turns'
      AND policyname = 'demo_assistant_turns_all'
  ) THEN
    CREATE POLICY "demo_assistant_turns_all" ON public.assistant_turns
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- 3) DB TRIGGERS -> APP EVENTS
-- ============================================

CREATE OR REPLACE FUNCTION public.tibera_insert_app_event(
  _user_id UUID,
  _event_type TEXT,
  _source TEXT,
  _payload JSONB,
  _context JSONB DEFAULT '{}'::jsonb,
  _ts TIMESTAMPTZ DEFAULT NOW(),
  _session_id UUID DEFAULT NULL,
  _correlation_id UUID DEFAULT NULL,
  _idempotency_key TEXT DEFAULT NULL,
  _privacy_level TEXT DEFAULT 'standard',
  _schema_version INT DEFAULT 1
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.app_events (
    user_id,
    session_id,
    correlation_id,
    event_type,
    source,
    ts,
    idempotency_key,
    schema_version,
    privacy_level,
    payload,
    context
  )
  VALUES (
    _user_id,
    _session_id,
    _correlation_id,
    _event_type,
    COALESCE(_source, 'db'),
    COALESCE(_ts, NOW()),
    COALESCE(_idempotency_key, gen_random_uuid()::text),
    COALESCE(_schema_version, 1),
    COALESCE(_privacy_level, 'standard'),
    COALESCE(_payload, '{}'::jsonb),
    COALESCE(_context, '{}'::jsonb)
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tibera_insert_app_event(UUID, TEXT, TEXT, JSONB, JSONB, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tibera_insert_app_event(UUID, TEXT, TEXT, JSONB, JSONB, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT, INT) TO service_role;

-- Meal logs
CREATE OR REPLACE FUNCTION public.tibera_emit_meal_logs_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_payload JSONB;
  v_type TEXT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_user_id := NEW.user_id;
    v_type := 'db.meal_logs.insert';
    v_payload := jsonb_build_object('table', 'meal_logs', 'op', TG_OP, 'new', to_jsonb(NEW));
  ELSIF (TG_OP = 'UPDATE') THEN
    v_user_id := NEW.user_id;
    v_type := 'db.meal_logs.update';
    v_payload := jsonb_build_object('table', 'meal_logs', 'op', TG_OP, 'new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSE
    v_user_id := OLD.user_id;
    v_type := 'db.meal_logs.delete';
    v_payload := jsonb_build_object('table', 'meal_logs', 'op', TG_OP, 'old', to_jsonb(OLD));
  END IF;

  PERFORM public.tibera_insert_app_event(v_user_id, v_type, 'db', v_payload, '{}'::jsonb, NOW(), NULL, NULL, NULL, 'sensitive', 1);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_tibera_meal_logs_event ON public.meal_logs;
CREATE TRIGGER trg_tibera_meal_logs_event
AFTER INSERT OR UPDATE OR DELETE ON public.meal_logs
FOR EACH ROW EXECUTE FUNCTION public.tibera_emit_meal_logs_event();

-- Meal items (join through meal_logs for user_id)
CREATE OR REPLACE FUNCTION public.tibera_emit_meal_items_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meal_log_id UUID;
  v_user_id UUID;
  v_payload JSONB;
  v_type TEXT;
BEGIN
  v_meal_log_id := COALESCE(NEW.meal_log_id, OLD.meal_log_id);
  SELECT user_id INTO v_user_id FROM public.meal_logs WHERE id = v_meal_log_id;

  IF (TG_OP = 'INSERT') THEN
    v_type := 'db.meal_items.insert';
    v_payload := jsonb_build_object('table', 'meal_items', 'op', TG_OP, 'new', to_jsonb(NEW));
  ELSIF (TG_OP = 'UPDATE') THEN
    v_type := 'db.meal_items.update';
    v_payload := jsonb_build_object('table', 'meal_items', 'op', TG_OP, 'new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSE
    v_type := 'db.meal_items.delete';
    v_payload := jsonb_build_object('table', 'meal_items', 'op', TG_OP, 'old', to_jsonb(OLD));
  END IF;

  PERFORM public.tibera_insert_app_event(v_user_id, v_type, 'db', v_payload, '{}'::jsonb, NOW(), NULL, NULL, NULL, 'sensitive', 1);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_tibera_meal_items_event ON public.meal_items;
CREATE TRIGGER trg_tibera_meal_items_event
AFTER INSERT OR UPDATE OR DELETE ON public.meal_items
FOR EACH ROW EXECUTE FUNCTION public.tibera_emit_meal_items_event();

-- Symptom logs
CREATE OR REPLACE FUNCTION public.tibera_emit_symptom_logs_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_payload JSONB;
  v_type TEXT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_user_id := NEW.user_id;
    v_type := 'db.symptom_logs.insert';
    v_payload := jsonb_build_object('table', 'symptom_logs', 'op', TG_OP, 'new', to_jsonb(NEW));
  ELSIF (TG_OP = 'UPDATE') THEN
    v_user_id := NEW.user_id;
    v_type := 'db.symptom_logs.update';
    v_payload := jsonb_build_object('table', 'symptom_logs', 'op', TG_OP, 'new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSE
    v_user_id := OLD.user_id;
    v_type := 'db.symptom_logs.delete';
    v_payload := jsonb_build_object('table', 'symptom_logs', 'op', TG_OP, 'old', to_jsonb(OLD));
  END IF;

  PERFORM public.tibera_insert_app_event(v_user_id, v_type, 'db', v_payload, '{}'::jsonb, NOW(), NULL, NULL, NULL, 'sensitive', 1);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_tibera_symptom_logs_event ON public.symptom_logs;
CREATE TRIGGER trg_tibera_symptom_logs_event
AFTER INSERT OR UPDATE OR DELETE ON public.symptom_logs
FOR EACH ROW EXECUTE FUNCTION public.tibera_emit_symptom_logs_event();

-- Supplement logs
CREATE OR REPLACE FUNCTION public.tibera_emit_supplement_logs_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_payload JSONB;
  v_type TEXT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_user_id := NEW.user_id;
    v_type := 'db.supplement_logs.insert';
    v_payload := jsonb_build_object('table', 'supplement_logs', 'op', TG_OP, 'new', to_jsonb(NEW));
  ELSIF (TG_OP = 'UPDATE') THEN
    v_user_id := NEW.user_id;
    v_type := 'db.supplement_logs.update';
    v_payload := jsonb_build_object('table', 'supplement_logs', 'op', TG_OP, 'new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSE
    v_user_id := OLD.user_id;
    v_type := 'db.supplement_logs.delete';
    v_payload := jsonb_build_object('table', 'supplement_logs', 'op', TG_OP, 'old', to_jsonb(OLD));
  END IF;

  PERFORM public.tibera_insert_app_event(v_user_id, v_type, 'db', v_payload, '{}'::jsonb, NOW(), NULL, NULL, NULL, 'sensitive', 1);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_tibera_supplement_logs_event ON public.supplement_logs;
CREATE TRIGGER trg_tibera_supplement_logs_event
AFTER INSERT OR UPDATE OR DELETE ON public.supplement_logs
FOR EACH ROW EXECUTE FUNCTION public.tibera_emit_supplement_logs_event();
