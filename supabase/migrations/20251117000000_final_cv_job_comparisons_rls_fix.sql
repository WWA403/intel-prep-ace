-- FINAL DEFINITIVE RLS POLICY FIX FOR cv_job_comparisons
-- This is the ONLY RLS migration you need. All previous ones are superseded.
--
-- Issue: Multiple conflicting RLS policies confused PostgREST, causing 406 errors
-- Solution: One simple, correct policy set with NO subqueries

-- Drop ALL existing policies (clean slate)
DROP POLICY IF EXISTS "Users can view their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Service role can view CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can create their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Service role can insert CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can update their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Service role can update CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can delete their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can view CV comparisons via searches table" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can create CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can update CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can delete CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Service role insert CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Service role update CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Service role select CV comparisons" ON public.cv_job_comparisons;

-- Create the FINAL policy set: simple, direct column matches only
CREATE POLICY "Users can view CV comparisons"
  ON public.cv_job_comparisons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create CV comparisons"
  ON public.cv_job_comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update CV comparisons"
  ON public.cv_job_comparisons FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete CV comparisons"
  ON public.cv_job_comparisons FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can access CV comparisons"
  ON public.cv_job_comparisons FOR ALL
  USING (auth.role() = 'service_role');
