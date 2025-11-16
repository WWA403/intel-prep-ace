-- Ensure all cv_job_comparisons RLS policies are in place
-- This migration verifies that SELECT policy exists (required for frontend queries)
-- and complements the service role policies from previous migration

-- Ensure SELECT policy for authenticated users (required for frontend)
DROP POLICY IF EXISTS "Users can view their own CV comparisons" ON public.cv_job_comparisons;
CREATE POLICY "Users can view their own CV comparisons"
  ON public.cv_job_comparisons FOR SELECT
  USING (auth.uid() = user_id);

-- Ensure DELETE policy for users exists
DROP POLICY IF EXISTS "Users can delete CV comparisons" ON public.cv_job_comparisons;
CREATE POLICY "Users can delete CV comparisons"
  ON public.cv_job_comparisons FOR DELETE
  USING (auth.uid() = user_id);
