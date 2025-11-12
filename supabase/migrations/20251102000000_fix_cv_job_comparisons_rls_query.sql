-- Fix 406 Error on cv_job_comparisons RLS Policy - Query Pattern Support
-- Issue: Frontend queries cv_job_comparisons by search_id, but simple RLS policy only checks user_id
-- PostgREST returns 406 Not Acceptable because it can't verify security without evaluating the relationship
--
-- Root Cause:
-- - Simple policy: USING (auth.uid() = user_id)
-- - Frontend query: .eq("search_id", searchId)
-- - PostgREST doesn't know that current user owns the search being filtered
-- - PostgREST returns 406 rather than silently failing (defensive)
--
-- Solution: Add a policy that explicitly handles search_id-based queries
-- This policy allows reading a cv_job_comparison if the user owns the associated search

-- Drop the simple policy that doesn't work with search_id filters
DROP POLICY IF EXISTS "Users can view their CV comparisons" ON public.cv_job_comparisons;

-- Create a new SELECT policy that supports BOTH query patterns:
-- 1. Direct user_id match: WHERE user_id = current_user (simple, efficient)
-- 2. Through search relationship: WHERE search_id = X AND user owns search X (what frontend uses)
CREATE POLICY "Users can view CV comparisons for their searches"
  ON public.cv_job_comparisons FOR SELECT
  USING (
    -- Allow if user is the direct owner
    auth.uid() = user_id
    OR
    -- Allow if user owns the search this comparison belongs to
    auth.uid() IN (SELECT user_id FROM public.searches WHERE id = cv_job_comparisons.search_id)
  );

-- Keep the INSERT, UPDATE, DELETE policies as they were (only check direct user_id ownership for writes)
-- These don't need to change because:
-- 1. Backend (service role) always bypasses RLS
-- 2. Frontend only creates/updates/deletes with direct user_id checks
-- 3. No frontend mutations filter by search_id

COMMENT ON POLICY "Users can view CV comparisons for their searches" ON public.cv_job_comparisons IS
'Allows users to view CV comparisons in two ways: (1) if they are the direct owner (user_id), or (2) if they own the search that the comparison belongs to. This supports both query patterns: filtering by user_id (direct) or by search_id (relationship-based).';
