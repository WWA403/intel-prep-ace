-- Fix 406 Error on cv_job_comparisons - Robust RLS Policy Replacement
-- Issue: Frontend queries cv_job_comparisons by search_id, but RLS policies don't allow this
-- This causes PostgREST to return 406 Not Acceptable
--
-- Solution: Replace ALL policies on cv_job_comparisons table with ones that support search_id access

-- Drop ALL existing policies on cv_job_comparisons (both SELECT and INSERT)
DROP POLICY IF EXISTS "Users can view their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can create CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can view CV comparisons for their searches" ON public.cv_job_comparisons;

-- Create new SELECT policy that supports BOTH query patterns:
-- 1. Filtering by user_id (direct ownership check)
-- 2. Filtering by search_id (relationship-based check - what frontend uses)
CREATE POLICY "Users can view CV comparisons for their searches"
  ON public.cv_job_comparisons FOR SELECT
  USING (
    -- Allow viewing if:
    -- 1. User is the direct owner (user_id matches)
    auth.uid() = user_id
    OR
    -- 2. User owns the search this comparison belongs to (search_id relationship)
    auth.uid() IN (SELECT user_id FROM public.searches WHERE id = cv_job_comparisons.search_id)
  );

-- Create INSERT policy (users can only insert their own comparisons)
CREATE POLICY "Users can create CV comparisons for their own user"
  ON public.cv_job_comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create UPDATE policy (users can update their own comparisons)
CREATE POLICY "Users can update their own CV comparisons"
  ON public.cv_job_comparisons FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create DELETE policy (users can delete their own comparisons)
CREATE POLICY "Users can delete their own CV comparisons"
  ON public.cv_job_comparisons FOR DELETE
  USING (auth.uid() = user_id);
