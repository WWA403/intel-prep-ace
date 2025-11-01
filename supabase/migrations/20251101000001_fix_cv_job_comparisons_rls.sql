-- Fix 406 Error on cv_job_comparisons RLS Policy
-- Issue: Frontend queries cv_job_comparisons by search_id, but RLS policy only checks user_id
-- This causes PostgREST to return 406 Not Acceptable because it can't apply the policy to this query pattern
--
-- Solution: Add a policy that allows viewing cv_job_comparisons through the search_id relationship

-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "Users can view their own CV comparisons" ON public.cv_job_comparisons;

-- Re-create with a more flexible policy that checks via search_id relationship
-- This allows users to view cv_job_comparisons for searches they own
CREATE POLICY "Users can view CV comparisons for their searches"
  ON public.cv_job_comparisons FOR SELECT
  USING (
    -- Option 1: Direct user_id match (backward compatibility)
    auth.uid() = user_id
    OR
    -- Option 2: Access through search_id relationship (what the frontend uses)
    auth.uid() IN (SELECT user_id FROM public.searches WHERE id = cv_job_comparisons.search_id)
  );

-- Keep the INSERT policy as is (requires user_id to be set)
-- Users can create CV comparisons for their own user_id
-- The user_id will be set by the frontend based on auth context
CREATE POLICY "Users can create CV comparisons"
  ON public.cv_job_comparisons FOR INSERT WITH CHECK (auth.uid() = user_id);
