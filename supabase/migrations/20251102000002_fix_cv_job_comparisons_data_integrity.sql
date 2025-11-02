-- Fix cv_job_comparisons data integrity - Backfill NULL user_ids
-- Issue: Some cv_job_comparisons records may have NULL user_id from earlier migrations
-- Solution: Backfill using the FK relationship to searches, then enforce NOT NULL

-- Step 1: Backfill any NULL user_ids from the search relationship
UPDATE public.cv_job_comparisons cjc
SET user_id = s.user_id
FROM public.searches s
WHERE cjc.search_id = s.id
  AND cjc.user_id IS NULL;

-- Step 2: Enforce that user_id is always set
-- This ensures all future inserts/updates must have user_id
ALTER TABLE public.cv_job_comparisons
ALTER COLUMN user_id SET NOT NULL;

-- Step 3: Add a check constraint to ensure data consistency
-- (Optional: ensures user_id matches the search owner - but this is complex in PostgreSQL)
-- For now, the NOT NULL constraint combined with the RLS policy is sufficient
