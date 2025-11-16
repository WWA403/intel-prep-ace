-- FIX cv_job_comparisons RLS PROPERLY
-- ===================================
-- The previous attempts had subqueries in USING clauses which confuse PostgREST
-- This migration removes all problematic policies and creates a minimal, correct set
--
-- PROBLEM: Subqueries in RLS policies cause:
-- 1. 406 errors on PostgREST queries
-- 2. Timeouts/hangs on INSERT/UPDATE (policy evaluation loops)
-- 3. Silent failures in backend processing
--
-- SOLUTION: Simplify to direct column matches only (no subqueries)
-- - Users can only access rows where user_id matches their ID
-- - Service role has full access
-- - Query by search_id? Must be owned by user (user_id match ensures this)

-- Step 1: Drop ALL policies on cv_job_comparisons (clean slate)
DROP POLICY IF EXISTS "Users can view their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Service role can view CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can create their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Service role can insert CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can update their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Service role can update CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can delete their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can view CV comparisons via searches table" ON public.cv_job_comparisons;

-- Step 2: Create simple, correct policies (no subqueries)
-- All policies use direct column matches only

-- SELECT: Users can view their own data (by user_id)
CREATE POLICY "Users can view CV comparisons"
  ON public.cv_job_comparisons FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can insert their own data
CREATE POLICY "Users can create CV comparisons"
  ON public.cv_job_comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own data
CREATE POLICY "Users can update CV comparisons"
  ON public.cv_job_comparisons FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own data
CREATE POLICY "Users can delete CV comparisons"
  ON public.cv_job_comparisons FOR DELETE
  USING (auth.uid() = user_id);

-- Service role policies: Full access with simple checks
CREATE POLICY "Service role insert CV comparisons"
  ON public.cv_job_comparisons FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role update CV comparisons"
  ON public.cv_job_comparisons FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role select CV comparisons"
  ON public.cv_job_comparisons FOR SELECT
  USING (auth.role() = 'service_role');

-- Step 3: Verify the table state
-- Run these to verify policies are correct:
-- SELECT * FROM pg_policies WHERE tablename = 'cv_job_comparisons' ORDER BY policyname;
-- SELECT oid, relname, relrowsecurity FROM pg_class WHERE relname = 'cv_job_comparisons';

-- NOTES:
-- - No subqueries in policies (eliminates 406 errors and hangs)
-- - Direct column matches only (PostgREST can optimize these)
-- - Frontend must filter by user_id or search_id where appropriate
-- - Service role can access any row for backend operations
-- - This is the minimal correct set: 8 policies (one per operation + role combo)
