-- Ensure cv_job_comparisons data integrity - Final verification and fix
-- This migration ensures all previous fixes were applied correctly
--
-- Previous migrations may not have been fully successful due to:
-- 1. Policy conflicts not being properly cleaned up
-- 2. NOT NULL constraint not being applied
-- 3. NULL user_ids not being backfilled

-- Step 1: Verify and complete backfill of NULL user_ids
-- This is idempotent - if already fixed, it does nothing
UPDATE public.cv_job_comparisons cjc
SET user_id = s.user_id
FROM public.searches s
WHERE cjc.search_id = s.id
  AND cjc.user_id IS NULL;

-- Step 2: Ensure NOT NULL constraint exists
-- First, try to alter (may fail if already done, which is fine)
ALTER TABLE public.cv_job_comparisons
ALTER COLUMN user_id SET NOT NULL;

-- Step 3: Verify all policies are in place with correct names
-- Drop any incorrectly named or conflicting policies first
DROP POLICY IF EXISTS "Users can view CV comparisons for their searches" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can view their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can create CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can update CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can delete CV comparisons" ON public.cv_job_comparisons;

-- Ensure we have the correct SELECT policy (simple, PostgREST-compatible)
CREATE POLICY "Users can view their own CV comparisons"
  ON public.cv_job_comparisons FOR SELECT
  USING (auth.uid() = user_id);

-- Ensure INSERT policy exists
CREATE POLICY "Users can create CV comparisons"
  ON public.cv_job_comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Ensure UPDATE policy exists
CREATE POLICY "Users can update CV comparisons"
  ON public.cv_job_comparisons FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure DELETE policy exists
CREATE POLICY "Users can delete CV comparisons"
  ON public.cv_job_comparisons FOR DELETE
  USING (auth.uid() = user_id);
