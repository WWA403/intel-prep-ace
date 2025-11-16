-- Fix RLS policies for cv_job_comparisons to allow service role inserts
-- The previous policies blocked service role from inserting because they only checked auth.uid() = user_id
-- Service role has auth.uid() = NULL, so we need to explicitly allow it

-- Drop the problematic policies that block service role
DROP POLICY IF EXISTS "Users can create CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can update CV comparisons" ON public.cv_job_comparisons;

-- Create policies that allow BOTH authenticated users AND service role

-- Service role insert policy (for interview-research function upserts)
CREATE POLICY "Service role can insert CV comparisons"
  ON public.cv_job_comparisons FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Service role update policy (for interview-research function upserts)
CREATE POLICY "Service role can update CV comparisons"
  ON public.cv_job_comparisons FOR UPDATE
  USING (auth.role() = 'service_role');

-- Keep user-based INSERT policy for direct user inserts (if any)
CREATE POLICY "Users can create their CV comparisons"
  ON public.cv_job_comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Keep user-based UPDATE policy for direct user updates
CREATE POLICY "Users can update their CV comparisons"
  ON public.cv_job_comparisons FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
