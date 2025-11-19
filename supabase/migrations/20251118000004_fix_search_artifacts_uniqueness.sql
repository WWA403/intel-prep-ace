-- Ensure search_artifacts rows are unique per search and have valid defaults
-- Date: 2025-11-18

BEGIN;

-- 1. Backfill missing interview_stages with empty arrays
UPDATE public.search_artifacts
SET interview_stages = '[]'::jsonb
WHERE interview_stages IS NULL;

-- 2. Set a safe default for future inserts
ALTER TABLE public.search_artifacts
  ALTER COLUMN interview_stages SET DEFAULT '[]'::jsonb;

-- 3. Remove duplicate rows, keeping the earliest per search_id
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY search_id
      ORDER BY created_at ASC NULLS FIRST, id ASC
    ) AS rn
  FROM public.search_artifacts
)
DELETE FROM public.search_artifacts
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- 4. Enforce uniqueness on search_id
ALTER TABLE public.search_artifacts
  ADD CONSTRAINT search_artifacts_search_id_key UNIQUE (search_id);

COMMIT;
