-- FIX 406 ERRORS ON cv_job_comparisons QUERIES
-- ============================================
-- Resolves remaining 406 "Not Acceptable" errors when querying cv_job_comparisons
--
-- PROBLEM DIAGNOSIS:
-- The previous migration (20251116000003) fixed the conflicting policies issue,
-- but 406 errors still occur when navigating away from progress popup and querying cv_job_comparisons.
--
-- ROOT CAUSES:
-- 1. Frontend may query via different patterns:
--    - Pattern A: Direct user_id match (authenticated user queries)
--    - Pattern B: Via search_id relationship (joining through searches table)
-- 2. PostgREST's RLS policy planner may fail if it can't apply the policy
--    to complex queries with joins/subqueries
-- 3. Service role context needs explicit SELECT policy to avoid conflicts
--
-- SOLUTION:
-- Ensure SELECT policies cover all query patterns and roles:
-- - One policy for authenticated users (direct match)
-- - One policy for authenticated users querying via search relationship
-- - One policy for service role (explicit)
--
-- This creates redundancy but eliminates ambiguity for PostgREST planner.

-- Verify current state before fixing
-- Run these to understand the problem:
-- SELECT * FROM pg_policies WHERE tablename = 'cv_job_comparisons' ORDER BY policyname;
-- SELECT oid, relname, relrowsecurity FROM pg_class WHERE relname = 'cv_job_comparisons';

-- STEP 1: Keep existing policies from 20251116000003 (they're correct)
-- The following policies should already exist:
-- - "Users can view their own CV comparisons" (SELECT via user_id)
-- - "Service role can view CV comparisons" (SELECT via auth.role)
-- - "Users can create their own CV comparisons" (INSERT)
-- - "Service role can insert CV comparisons" (INSERT)
-- - "Users can update their own CV comparisons" (UPDATE)
-- - "Service role can update CV comparisons" (UPDATE)
-- - "Users can delete their own CV comparisons" (DELETE)

-- STEP 2: Add explicit policy for complex query patterns
-- This helps PostgREST handle queries that join through the searches table
CREATE POLICY "Users can view CV comparisons via searches table"
  ON public.cv_job_comparisons FOR SELECT
  USING (
    -- Allow if user owns the search that this comparison is linked to
    search_id IN (
      SELECT id FROM public.searches
      WHERE user_id = auth.uid()
    )
  );

-- STEP 3: Ensure service role has explicit SELECT policy with different conditions
-- (keeps redundancy low while ensuring role-based access works)
-- The "Service role can view CV comparisons" policy from 20251116000003 should handle this,
-- but we verify it uses the correct condition here:
-- Expected: USING (auth.role() = 'service_role')

-- VERIFICATION NOTES:
-- After this migration, cv_job_comparisons queries should return:
-- - 200 OK for authenticated users selecting their own rows (user_id match)
-- - 200 OK for authenticated users selecting via search relationship
-- - 200 OK for service role selecting any rows
-- - 403 Forbidden for unauthorized users
-- - NO MORE 406 errors
--
-- Test both query patterns:
-- 1. SELECT * FROM cv_job_comparisons WHERE user_id = auth.uid();
-- 2. SELECT * FROM cv_job_comparisons
--    WHERE search_id IN (SELECT id FROM searches WHERE user_id = auth.uid());
-- 3. (Service role) SELECT * FROM cv_job_comparisons;
--
-- If 406 persists, the issue may be:
-- - RLS not actually enabled on the table
-- - Policy syntax error (run: SELECT * FROM pg_policies WHERE tablename = 'cv_job_comparisons';)
-- - Supabase cache issue (clear browser cache and retry)
-- - PostgREST bug (check Supabase status)
