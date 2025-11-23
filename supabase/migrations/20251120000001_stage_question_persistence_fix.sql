-- Ensure stage/question data can be persisted with the new synthesis payload
-- Date: 2025-11-20

DO $$
BEGIN
  IF to_regclass('public.interview_stages') IS NULL THEN
    RAISE NOTICE 'interview_stages table missing, skipping migration 20251120000001';
    RETURN;
  END IF;

  -- Add structured fields to interview_stages to match synthesis payload
  ALTER TABLE public.interview_stages
    ADD COLUMN IF NOT EXISTS preparation_tips JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS common_questions JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS red_flags_to_avoid JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
END
$$;
