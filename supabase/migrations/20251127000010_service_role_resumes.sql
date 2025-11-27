-- Ensure service role (used by Edge Functions) can read/write resumes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'resumes'
      AND policyname = 'Service role can manage resumes'
  ) THEN
    EXECUTE '
      CREATE POLICY "Service role can manage resumes"
      ON public.resumes
      FOR ALL
      USING (auth.role() = ''service_role'')
      WITH CHECK (auth.role() = ''service_role'');
    ';
  END IF;
END $$;

-- Automatically attach the latest profile resume to each new search
CREATE OR REPLACE FUNCTION public.copy_latest_resume_to_search()
RETURNS TRIGGER AS $$
DECLARE
  latest_resume RECORD;
BEGIN
  SELECT r.*
  INTO latest_resume
  FROM public.resumes r
  WHERE r.user_id = NEW.user_id
  ORDER BY r.created_at DESC
  LIMIT 1;

  IF latest_resume IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.resumes WHERE search_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.resumes (user_id, search_id, content, parsed_data, created_at)
  VALUES (
    NEW.user_id,
    NEW.id,
    latest_resume.content,
    latest_resume.parsed_data,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS copy_latest_resume_on_search_insert ON public.searches;

CREATE TRIGGER copy_latest_resume_on_search_insert
AFTER INSERT ON public.searches
FOR EACH ROW
EXECUTE FUNCTION public.copy_latest_resume_to_search();

