-- INT - Interview Prep Tool Database Schema
-- This is a snapshot of the current schema state as of the latest migrations
-- Generated from: supabase/migrations/
-- For detailed evolution history, see: supabase/migrations/
-- Last updated: November 2, 2025
--
-- NOTE: This file is a REFERENCE ONLY
-- - Use supabase/migrations/ for version control
-- - Update this file after ANY database changes: npx supabase db pull --linked > supabase/schema.sql
-- - This keeps developers synchronized on current schema state

-- ==============================================
-- CORE APPLICATION TABLES
-- ==============================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  seniority seniority_level,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- User searches (main entity for research sessions)
CREATE TABLE public.searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  role TEXT,
  country TEXT,
  role_links TEXT,
  target_seniority seniority_level,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  search_status TEXT DEFAULT 'pending' NOT NULL,
  status TEXT DEFAULT 'pending',
  progress_step TEXT DEFAULT 'Initializing...',
  progress_percentage INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CHECK (search_status IN ('pending', 'processing', 'completed', 'failed')),
  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

-- CV/Resume storage
CREATE TABLE public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  search_id UUID REFERENCES public.searches(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parsed_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Interview stages (structure of interview process)
CREATE TABLE public.interview_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES public.searches(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  duration TEXT,
  interviewer TEXT,
  content TEXT,
  guidance TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Interview questions (enhanced with comprehensive metadata)
CREATE TABLE public.interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID REFERENCES public.interview_stages(id) ON DELETE CASCADE NOT NULL,
  search_id UUID REFERENCES public.searches(id) ON DELETE CASCADE NOT NULL,
  
  -- Question content and metadata
  question TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('behavioral', 'technical', 'situational', 'company_specific', 'role_specific', 'experience_based', 'cultural_fit')),
  question_type TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  
  -- Enhanced guidance and context
  rationale TEXT,
  suggested_answer_approach TEXT,
  evaluation_criteria TEXT[],
  follow_up_questions TEXT[],
  star_story_fit BOOLEAN DEFAULT false,
  company_context TEXT,
  
  -- Usage and quality metrics
  usage_count INTEGER DEFAULT 0,
  confidence_score FLOAT DEFAULT 0.0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- User practice sessions
CREATE TABLE public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  search_id UUID REFERENCES public.searches(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Practice answers (user responses to questions)
CREATE TABLE public.practice_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.practice_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.interview_questions(id) ON DELETE CASCADE NOT NULL,
  text_answer TEXT,
  audio_url TEXT,
  answer_time_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- User question flags (favoriting, marking for review)
CREATE TABLE public.user_question_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('favorite', 'needs_work', 'skipped')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, question_id)
);

-- ==============================================
-- RESEARCH AND SCRAPING TABLES
-- ==============================================

-- Consolidated scraped URLs and content
CREATE TABLE public.scraped_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES public.searches(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  url_hash TEXT UNIQUE,
  domain TEXT,
  title TEXT,
  description TEXT,
  
  -- Content fields (consolidated from scraped_content)
  full_content TEXT,
  raw_html TEXT,
  structured_data JSONB DEFAULT '{}'::jsonb,
  extracted_questions TEXT[],
  extracted_insights TEXT[],
  word_count INTEGER DEFAULT 0,
  language TEXT DEFAULT 'en',
  content_source TEXT,
  processing_status TEXT DEFAULT 'raw' CHECK (processing_status IN ('raw', 'processed', 'analyzed', 'failed')),
  ai_summary TEXT,
  
  -- Research context
  company_name TEXT,
  role_title TEXT,
  
  -- Quality and usage metrics
  content_quality_score FLOAT DEFAULT 0.0,
  content_staleness_days INTEGER DEFAULT 0,
  times_reused INTEGER DEFAULT 0,
  
  -- Timestamps
  first_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_reused_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT unique_url_hash_company UNIQUE(url_hash, company_name),
  CHECK (content_quality_score >= 0.0 AND content_quality_score <= 1.0)
);

-- CV-Job comparison results
CREATE TABLE public.cv_job_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES public.searches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES public.resumes(id) ON DELETE CASCADE,
  
  -- Original comparison data
  job_requirements JSONB,
  cv_analysis JSONB,
  comparison_results JSONB,
  recommendations JSONB,
  overall_match_score FLOAT,
  
  -- Enhanced analysis fields (added 20251101000003)
  skill_gap_analysis JSONB,
  experience_gap_analysis JSONB,
  personalized_story_bank JSONB,
  interview_prep_strategy JSONB,
  overall_fit_score FLOAT,
  preparation_priorities TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CHECK (overall_fit_score >= 0.0 AND overall_fit_score <= 1.0)
);

-- ==============================================
-- API LOGGING TABLES
-- ==============================================

-- Tavily API call logging (simplified)
CREATE TABLE public.tavily_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES public.searches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- API call details
  api_type TEXT NOT NULL CHECK (api_type IN ('search', 'extract')),
  query_text TEXT NOT NULL,
  
  -- Response data
  response_payload JSONB,
  response_status INTEGER NOT NULL,
  results_count INTEGER DEFAULT 0,
  
  -- Performance and cost
  request_duration_ms INTEGER,
  credits_used INTEGER DEFAULT 1,
  
  -- Error handling
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- ==============================================
-- ENUMS AND TYPES
-- ==============================================

-- Seniority level enum
CREATE TYPE seniority_level AS ENUM ('junior', 'mid', 'senior');

-- ==============================================
-- FUNCTIONS
-- ==============================================

-- Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update search progress for async job processing
CREATE OR REPLACE FUNCTION public.update_search_progress(
  search_uuid UUID,
  new_status TEXT,
  new_step TEXT DEFAULT NULL,
  new_percentage INTEGER DEFAULT NULL,
  error_msg TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE public.searches
  SET
    search_status = CASE WHEN new_status IS NOT NULL THEN new_status ELSE search_status END,
    progress_step = CASE WHEN new_step IS NOT NULL THEN new_step ELSE progress_step END,
    progress_percentage = CASE WHEN new_percentage IS NOT NULL THEN new_percentage ELSE progress_percentage END,
    error_message = error_msg,
    started_at = CASE
      WHEN new_status = 'processing' AND started_at IS NULL THEN now()
      ELSE started_at
    END,
    completed_at = CASE
      WHEN new_status IN ('completed', 'failed') THEN now()
      ELSE completed_at
    END,
    updated_at = now()
  WHERE id = search_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get search progress (for frontend polling)
CREATE OR REPLACE FUNCTION public.get_search_progress(search_uuid UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  company TEXT,
  role TEXT,
  search_status TEXT,
  progress_step TEXT,
  progress_percentage INTEGER,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_stalled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.company,
    s.role,
    s.search_status,
    s.progress_step,
    s.progress_percentage,
    s.error_message,
    s.started_at,
    s.completed_at,
    s.updated_at,
    (s.search_status = 'processing' AND s.updated_at < now() - INTERVAL '30 seconds')::BOOLEAN as is_stalled
  FROM public.searches s
  WHERE s.id = search_uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- Find reusable URLs for research
CREATE OR REPLACE FUNCTION public.find_reusable_urls_simple(
  p_company_name TEXT,
  p_role_title TEXT DEFAULT NULL,
  p_max_age_days INTEGER DEFAULT 30,
  p_min_quality_score FLOAT DEFAULT 0.3
)
RETURNS TABLE(
  id UUID,
  url TEXT,
  title TEXT,
  content_quality_score FLOAT,
  ai_summary TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.id,
    su.url,
    su.title,
    su.content_quality_score,
    su.ai_summary
  FROM public.scraped_urls su
  WHERE 
    su.company_name ILIKE p_company_name
    AND (p_role_title IS NULL OR su.role_title ILIKE '%' || p_role_title || '%')
    AND su.content_quality_score >= p_min_quality_score
    AND su.first_scraped_at > (NOW() - (p_max_age_days || ' days')::INTERVAL)
  ORDER BY 
    su.content_quality_score DESC,
    su.times_reused DESC NULLS LAST
  LIMIT 20;
END;
$$;

-- Increment URL reuse counter
CREATE OR REPLACE FUNCTION public.increment_url_reuse_count(url_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.scraped_urls 
  SET 
    times_reused = times_reused + 1,
    last_reused_at = NOW(),
    updated_at = NOW()
  WHERE id = url_id;
END;
$$;

-- Update scraped URLs metadata
CREATE OR REPLACE FUNCTION public.update_scraped_urls_metadata()
RETURNS TRIGGER AS $$
BEGIN
  NEW.url_hash := encode(sha256(NEW.url::bytea), 'hex');
  NEW.domain := CASE 
    WHEN NEW.url ~ '^https?://([^/]+)' THEN 
      substring(NEW.url from '^https?://([^/]+)')
    ELSE 
      'unknown'
  END;
  
  NEW.content_staleness_days := EXTRACT(days FROM (now() - NEW.first_scraped_at))::INTEGER;
  NEW.updated_at := now();
  
  IF NEW.full_content IS NOT NULL THEN
    NEW.word_count := array_length(string_to_array(NEW.full_content, ' '), 1);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- TRIGGERS
-- ==============================================

-- Create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Update timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_searches_updated_at
  BEFORE UPDATE ON public.searches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scraped_urls_metadata_trigger
  BEFORE INSERT OR UPDATE ON public.scraped_urls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_scraped_urls_metadata();

CREATE TRIGGER update_user_question_flags_updated_at
  BEFORE UPDATE ON user_question_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Search queries
CREATE INDEX idx_searches_id_status
ON public.searches(id, search_status, updated_at)
INCLUDE (progress_percentage, progress_step);

CREATE INDEX idx_searches_user_active
ON public.searches(user_id, search_status, updated_at DESC)
WHERE search_status IN ('pending', 'processing');

CREATE INDEX idx_searches_updated_at
ON public.searches(updated_at DESC)
WHERE search_status = 'processing';

CREATE INDEX idx_searches_created_status
ON public.searches(created_at DESC, search_status)
WHERE search_status IN ('completed', 'failed');

CREATE INDEX idx_searches_target_seniority 
ON public.searches(target_seniority);

-- Interview questions
CREATE INDEX idx_interview_questions_search_id 
ON public.interview_questions(search_id);

CREATE INDEX idx_interview_questions_category 
ON public.interview_questions(category);

CREATE INDEX idx_interview_questions_difficulty 
ON public.interview_questions(difficulty);

-- Scraped URLs
CREATE INDEX idx_scraped_urls_company_name_role 
ON public.scraped_urls(company_name, role_title);

CREATE INDEX idx_scraped_urls_quality_reused 
ON public.scraped_urls(content_quality_score DESC, times_reused DESC);

CREATE INDEX idx_scraped_urls_processing_status 
ON public.scraped_urls(processing_status) 
WHERE processing_status IN ('processed', 'analyzed');

CREATE INDEX idx_scraped_urls_content_search 
ON public.scraped_urls 
USING gin(to_tsvector('english', COALESCE(full_content, ai_summary, title, '')));

-- Tavily searches
CREATE INDEX idx_tavily_searches_performance 
ON public.tavily_searches(user_id, api_type, created_at DESC);

-- User question flags
CREATE INDEX idx_user_question_flags_user_id 
ON user_question_flags(user_id);

CREATE INDEX idx_user_question_flags_question_id 
ON user_question_flags(question_id);

CREATE INDEX idx_user_question_flags_flag_type 
ON user_question_flags(flag_type);

-- CV comparisons
CREATE INDEX idx_cv_job_comparisons_search_id 
ON public.cv_job_comparisons(search_id);

CREATE INDEX idx_cv_job_comparisons_user_id 
ON public.cv_job_comparisons(user_id);

-- ==============================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_job_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tavily_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_question_flags ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- RLS POLICIES
-- ==============================================

-- Profile policies
CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Search policies
CREATE POLICY "Users can view their own searches" 
  ON public.searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create searches" 
  ON public.searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own search progress" 
  ON public.searches FOR UPDATE USING (auth.uid() = user_id);

-- Resume policies
CREATE POLICY "Users can view their own resumes" 
  ON public.resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create resumes" 
  ON public.resumes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Interview stages policies
CREATE POLICY "Users can view interview stages for their searches" 
  ON public.interview_stages FOR SELECT 
  USING (auth.uid() IN (SELECT user_id FROM public.searches WHERE id = interview_stages.search_id));

-- Interview questions policies
CREATE POLICY "Users can view questions for their interview stages" 
  ON public.interview_questions FOR SELECT 
  USING (auth.uid() IN (
    SELECT s.user_id FROM public.searches s
    JOIN public.interview_stages st ON s.id = st.search_id
    WHERE st.id = interview_questions.stage_id
  ));

CREATE POLICY "Users can view questions for their searches" 
  ON public.interview_questions FOR SELECT 
  USING (auth.uid() IN (SELECT user_id FROM public.searches WHERE id = interview_questions.search_id));

-- Practice session policies
CREATE POLICY "Users can view their own practice sessions" 
  ON public.practice_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create practice sessions" 
  ON public.practice_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Practice answers policies
CREATE POLICY "Users can view their own practice answers" 
  ON public.practice_answers FOR SELECT 
  USING (auth.uid() IN (SELECT user_id FROM public.practice_sessions WHERE id = practice_answers.session_id));
CREATE POLICY "Users can create practice answers" 
  ON public.practice_answers FOR INSERT 
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.practice_sessions WHERE id = practice_answers.session_id));

-- Scraped URLs policies
CREATE POLICY "Service role can manage scraped URLs" 
  ON public.scraped_urls FOR ALL USING (auth.uid() IS NULL);
CREATE POLICY "Authenticated users can view scraped URLs" 
  ON public.scraped_urls FOR SELECT USING (auth.uid() IS NOT NULL);

-- CV job comparisons policies
CREATE POLICY "Users can view their CV comparisons" 
  ON public.cv_job_comparisons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create CV comparisons" 
  ON public.cv_job_comparisons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update CV comparisons" 
  ON public.cv_job_comparisons FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete CV comparisons" 
  ON public.cv_job_comparisons FOR DELETE USING (auth.uid() = user_id);

-- Tavily searches policies
CREATE POLICY "Users can view their own Tavily searches" 
  ON public.tavily_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage Tavily searches" 
  ON public.tavily_searches FOR ALL USING (auth.uid() IS NULL);

-- User question flags policies
CREATE POLICY "Users can view their own question flags"
  ON user_question_flags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own question flags"
  ON user_question_flags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own question flags"
  ON user_question_flags FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own question flags"
  ON user_question_flags FOR DELETE USING (auth.uid() = user_id);

-- ==============================================
-- VIEWS FOR MONITORING
-- ==============================================

-- View to identify stalled jobs
CREATE VIEW public.stalled_searches AS
SELECT
  id,
  user_id,
  company,
  role,
  search_status,
  progress_percentage,
  progress_step,
  started_at,
  updated_at,
  EXTRACT(EPOCH FROM (now() - updated_at)) as seconds_since_update,
  EXTRACT(EPOCH FROM (now() - started_at)) as total_elapsed_seconds
FROM public.searches
WHERE search_status = 'processing'
  AND updated_at < now() - INTERVAL '30 seconds'
ORDER BY updated_at ASC;

-- ==============================================
-- PERMISSIONS
-- ==============================================

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_search_progress TO service_role;
GRANT EXECUTE ON FUNCTION public.get_search_progress(UUID) TO authenticated, service_role;
GRANT SELECT ON public.stalled_searches TO service_role;

-- ==============================================
-- DOCUMENTATION
-- ==============================================

COMMENT ON TABLE public.searches IS 'User search sessions with async job processing support. Core entity for research workflow.';
COMMENT ON TABLE public.interview_questions IS 'Interview questions with comprehensive metadata. Consolidated from multiple sources for each search.';
COMMENT ON TABLE public.scraped_urls IS 'Consolidated table storing all scraped URLs and their content with intelligent reuse tracking.';
COMMENT ON TABLE public.tavily_searches IS 'Simplified logging for Tavily API calls for cost tracking and fallback analysis.';
COMMENT ON TABLE public.user_question_flags IS 'User-specific question flags for personalization (favorites, needs_work, skipped).';
COMMENT ON TABLE public.cv_job_comparisons IS 'CV-job matching analysis with skill gaps and preparation strategies.';
COMMENT ON COLUMN public.scraped_urls.full_content IS 'Complete extracted content from the URL';
COMMENT ON COLUMN public.scraped_urls.ai_summary IS 'AI-generated summary of the content';
COMMENT ON COLUMN public.scraped_urls.processing_status IS 'Current processing status: raw, processed, analyzed, failed';
COMMENT ON FUNCTION public.update_search_progress IS 'Updates search progress for async job processing. Used by Edge Functions to provide real-time status updates.';
COMMENT ON FUNCTION public.get_search_progress IS 'Returns current progress for a specific search, including a stall detection flag. Frontend polls this to get real-time status updates.';
COMMENT ON VIEW public.stalled_searches IS 'Identifies searches that have been processing for >30s without updates. Useful for detecting jobs that may have crashed or hung.';
