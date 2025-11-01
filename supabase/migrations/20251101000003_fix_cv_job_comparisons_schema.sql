-- Fix cv_job_comparisons schema to match what the backend is trying to insert
-- Issue: Backend tries to insert columns that don't exist, causing silent failures

-- Add missing columns to cv_job_comparisons
ALTER TABLE public.cv_job_comparisons
ADD COLUMN IF NOT EXISTS skill_gap_analysis JSONB,
ADD COLUMN IF NOT EXISTS experience_gap_analysis JSONB,
ADD COLUMN IF NOT EXISTS personalized_story_bank JSONB,
ADD COLUMN IF NOT EXISTS interview_prep_strategy JSONB,
ADD COLUMN IF NOT EXISTS overall_fit_score FLOAT,
ADD COLUMN IF NOT EXISTS preparation_priorities TEXT[];

-- Keep the old columns for backward compatibility (they exist but won't be used)
-- job_requirements JSONB - already exists
-- cv_analysis JSONB - already exists
-- comparison_results JSONB - already exists
-- recommendations JSONB - already exists
-- overall_match_score FLOAT - already exists

-- Add updated_at timestamp for tracking when data changes
ALTER TABLE public.cv_job_comparisons
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add index for search_id queries (frontend queries by this)
CREATE INDEX IF NOT EXISTS idx_cv_job_comparisons_search_id ON public.cv_job_comparisons(search_id);

-- Add index for user_id queries (RLS checks by this)
CREATE INDEX IF NOT EXISTS idx_cv_job_comparisons_user_id ON public.cv_job_comparisons(user_id);

-- Simplify RLS policies - remove dangerous subqueries
DROP POLICY IF EXISTS "Users can view CV comparisons for their searches" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can create CV comparisons for their own user" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can update their own CV comparisons" ON public.cv_job_comparisons;
DROP POLICY IF EXISTS "Users can delete their own CV comparisons" ON public.cv_job_comparisons;

-- Backend operations (service role) bypass RLS, but frontend needs to be able to query by search_id
-- Since the backend always sets user_id = current user, we can use a simple policy

CREATE POLICY "Users can view their CV comparisons"
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
