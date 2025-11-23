-- FINAL DEFINITIVE RLS POLICY FIX FOR cv_job_comparisons
-- Guarded to no-op if table no longer exists (idempotent on re-runs)

DO $$
BEGIN
  IF to_regclass('public.cv_job_comparisons') IS NULL THEN
    RAISE NOTICE 'cv_job_comparisons table missing, skipping RLS migration 20251117000000';
    RETURN;
  END IF;

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
END
$$;
