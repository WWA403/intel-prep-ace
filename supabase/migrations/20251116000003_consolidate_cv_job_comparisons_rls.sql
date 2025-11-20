-- CONSOLIDATE AND FIX cv_job_comparisons RLS POLICIES
-- =====================================================
-- This migration resolves the 406 error caused by 10 conflicting RLS policies
--
-- PROBLEM HISTORY:
-- - 20251116000000 created service role policies (INSERT/UPDATE with auth.role() = 'service_role')
-- - 20251116000001 created user SELECT/DELETE policies
-- - Multiple previous attempts created duplicate/conflicting policies
-- - Result: 10 total policies including duplicates and conflicts
-- - PostgREST returns 406 when multiple policies exist for same operation
--
-- SOLUTION:
-- Drop ALL existing policies and create a clean, minimal set:
-- - One SELECT policy for authenticated users
-- - One SELECT policy for service role (if needed for admin access)
-- - One INSERT policy for authenticated users
-- - One INSERT policy for service role
-- - One UPDATE policy for authenticated users
-- - One UPDATE policy for service role
-- - One DELETE policy for authenticated users
--
-- This is the DEFINITIVE policy set - no more changes needed.

-- Step 1: Drop ALL existing policies on cv_job_comparisons
-- This removes all 10 conflicting policies at once
DROP POLICY IF EXISTS "Service role can insert CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Service role can manage CV job comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Service role can update CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can create CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can create their CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can delete CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can insert their own CV job comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can update CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can update their CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can view CV comparisons for their searches" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can view CV job comparisons via search" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can view their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can view their own CV job comparisons" ON public.cv_job_comparisons;

-- Step 2: Create the CORRECT, MINIMAL policy set
-- ==================================================

-- Policy 1: SELECT - Authenticated users can view their own CV comparisons
CREATE POLICY "Users can view their own CV comparisons"
  ON public.cv_job_comparisons FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: SELECT - Service role can view all (for backend operations)
CREATE POLICY "Service role can view CV comparisons"
  ON public.cv_job_comparisons FOR SELECT
  USING (auth.role() = 'service_role');

-- Policy 3: INSERT - Authenticated users can create their own
CREATE POLICY "Users can create their own CV comparisons"
  ON public.cv_job_comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: INSERT - Service role can insert (for interview-research function)
CREATE POLICY "Service role can insert CV comparisons"
  ON public.cv_job_comparisons FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Policy 5: UPDATE - Authenticated users can update their own
CREATE POLICY "Users can update their own CV comparisons"
  ON public.cv_job_comparisons FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 6: UPDATE - Service role can update (for interview-research function)
CREATE POLICY "Service role can update CV comparisons"
  ON public.cv_job_comparisons FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy 7: DELETE - Authenticated users can delete their own
CREATE POLICY "Users can delete their own CV comparisons"
  ON public.cv_job_comparisons FOR DELETE
  USING (auth.uid() = user_id);

-- VERIFICATION NOTES:
-- After this migration:
-- 1. SELECT queries should return 200 for authenticated users (only their data)
-- 2. SELECT queries should return 200 for service role (all data)
-- 3. INSERT should work for both users (auth.uid() = user_id) and service role
-- 4. UPDATE should work for both users and service role
-- 5. DELETE should work for authenticated users only
-- 6. NO MORE 406 ERRORS on cv_job_comparisons queries
--
-- If you still see 406 errors after this migration:
-- - Verify RLS is enabled: SELECT oid, relname, relrowsecurity FROM pg_class WHERE relname = 'cv_job_comparisons';
-- - Check policies: SELECT * FROM pg_policies WHERE tablename = 'cv_job_comparisons';
-- - Ensure migration was applied: SELECT * FROM _supabase_migrations;
