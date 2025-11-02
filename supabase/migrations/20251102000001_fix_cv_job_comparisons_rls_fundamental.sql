-- Fix 406 Error on cv_job_comparisons - Fundamental RLS Design Fix
--
-- **Root Cause Analysis:**
-- PostgREST cannot properly evaluate RLS policies containing subqueries when those subqueries
-- reference the filtered column. This is a known limitation:
-- - Query: GET /cv_job_comparisons?search_id=eq.XXX
-- - Policy: USING (...OR auth.uid() IN (SELECT user_id FROM searches WHERE id = cv_job_comparisons.search_id))
-- - Problem: PostgREST can't statically verify if search_id filter satisfies the policy
-- - Result: 406 Not Acceptable (defensive failure - better safe than sorry)
--
-- **Why The Subquery Approach Fails:**
-- PostgREST's policy evaluation has two modes:
-- 1. Simple equality checks (e.g., auth.uid() = user_id) - Works with any column filter
-- 2. Subqueries - Only work if they don't reference the filtered column
--
-- When filtering by search_id AND the policy has a subquery on search_id, PostgREST
-- cannot determine if the policy will be satisfied, so it fails defensively.
--
-- **The Proper Solution:**
-- Since `user_id` is already populated in every cv_job_comparisons record by the backend,
-- we can use a SIMPLE policy that works with PostgREST's evaluation engine.
--
-- How it works:
-- 1. Frontend queries by search_id: GET /cv_job_comparisons?search_id=eq.XXX
-- 2. PostgREST applies policy: WHERE auth.uid() = user_id
-- 3. User MUST own the search to have created the cv_job_comparison (enforced by backend)
-- 4. Security is maintained because:
--    - Backend ensures user_id is set to current_user when record is created
--    - Backend ensures cv_job_comparison is only created for searches the user owns
--    - Frontend can filter by search_id, and the RLS policy will correctly restrict results
--
-- **Why This Design Works:**
-- - cv_job_comparisons.user_id is always set by the backend to the current user
-- - cv_job_comparisons.search_id references a search that belongs to that user
-- - Therefore: user_id in cv_job_comparisons == user who owns the search
-- - The simple policy works because PostgREST CAN evaluate it regardless of filters

-- Drop all previous policies (including the subquery-based one)
DROP POLICY IF EXISTS "Users can view their CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can view CV comparisons for their searches" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can create CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can create CV comparisons for their own user" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can update their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can update CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can delete their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can delete CV comparisons" ON public.cv_job_comparisons;

-- Create a SIMPLE SELECT policy - no subqueries, works with all filter patterns
-- PostgREST can evaluate this regardless of whether filtering by user_id, search_id, or anything else
CREATE POLICY "Users can view their own CV comparisons"
  ON public.cv_job_comparisons FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT policy: Only allow if creating for your own user_id
CREATE POLICY "Users can create CV comparisons"
  ON public.cv_job_comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy: Only allow if updating your own comparisons
CREATE POLICY "Users can update CV comparisons"
  ON public.cv_job_comparisons FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy: Only allow if deleting your own comparisons
CREATE POLICY "Users can delete CV comparisons"
  ON public.cv_job_comparisons FOR DELETE
  USING (auth.uid() = user_id);

-- **Security Model:**
-- The frontend queries by search_id, but the RLS policy checks user_id.
-- This works because:
-- 1. Backend always sets user_id = current user when creating record
-- 2. Backend only creates record for searches owned by current user
-- 3. Transitive property: If you own the search, and user_id points to you, RLS passes
--
-- **Query Flow Example:**
-- Frontend: SELECT * FROM cv_job_comparisons WHERE search_id = '52dc5975...'
-- PostgREST applies RLS: ... AND auth.uid() = user_id
-- Result: Only returns records where user_id = current_user
-- This is secure because user only owns searches they created, and user_id is set to creator

COMMENT ON POLICY "Users can view their own CV comparisons" ON public.cv_job_comparisons IS
'Simple RLS policy that allows users to view only their own CV comparisons. This works with any filter (user_id, search_id, etc.) because PostgREST can evaluate the simple equality check regardless of the filter pattern. Subquery-based policies would fail with 406 Not Acceptable when filtering by search_id.';
