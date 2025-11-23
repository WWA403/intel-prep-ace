-- OPTION B REDESIGN: Create search_artifacts table
-- This is the central table for storing all research data (raw + synthesis results)
-- Replaces the complex multi-table approach with a single source of truth

-- Drop cv_job_comparisons table (functionality moves into synthesis)
DROP TABLE IF EXISTS public.cv_job_comparisons CASCADE;

-- Create search_artifacts table: stores raw data + all synthesis results
CREATE TABLE IF NOT EXISTS public.search_artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_id UUID NOT NULL REFERENCES public.searches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ============================================================
  -- PHASE 1: Raw data from external services (saved immediately)
  -- ============================================================

  company_research_raw JSONB,                    -- Full companyInsights from company-research service
  job_analysis_raw JSONB,                        -- Full jobRequirements from job-analysis service
  cv_analysis_raw JSONB,                         -- Full cvAnalysis from cv-analysis service

  -- ============================================================
  -- PHASE 2: Synthesis results from OpenAI (unified synthesis)
  -- ============================================================

  -- Interview stages (4 stages structured by interview process)
  interview_stages JSONB NOT NULL,               -- All 4 stages in single structure

  -- All synthesis metadata
  synthesis_metadata JSONB,                      -- synthesis_result, final_prompt, model used, tokens

  -- CV-Job comparison analysis (moved from separate table)
  comparison_analysis JSONB,                     -- skill_gaps, experience_gaps, stories, strategy

  -- All interview questions (consolidated from synthesis)
  interview_questions_data JSONB,                -- questions structured by category

  -- Preparation guidance
  preparation_guidance JSONB,                    -- Timeline, priorities, personalized guidance

  -- ============================================================
  -- PHASE 3: Processing metadata
  -- ============================================================

  processing_status TEXT NOT NULL DEFAULT 'initialized',  -- 'initialized', 'raw_data_saved', 'synthesizing', 'synthesis_complete', 'complete', 'failed'
  processing_error_message TEXT,                          -- Error if any phase fails

  processing_started_at TIMESTAMP DEFAULT NOW(),
  processing_raw_save_at TIMESTAMP,              -- When raw data was saved
  processing_synthesis_start_at TIMESTAMP,       -- When synthesis started
  processing_synthesis_end_at TIMESTAMP,         -- When synthesis completed
  processing_completed_at TIMESTAMP,             -- When all processing done

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================

-- Fast lookup by search
CREATE INDEX IF NOT EXISTS idx_search_artifacts_search_id ON public.search_artifacts(search_id);

-- Fast lookup by user
CREATE INDEX IF NOT EXISTS idx_search_artifacts_user_id ON public.search_artifacts(user_id);

-- Fast lookup by status
CREATE INDEX IF NOT EXISTS idx_search_artifacts_status ON public.search_artifacts(processing_status);

-- Composite index for user's active searches
CREATE INDEX IF NOT EXISTS idx_search_artifacts_user_status ON public.search_artifacts(user_id, processing_status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.search_artifacts ENABLE ROW LEVEL SECURITY;

-- Clean existing policies to avoid duplicates on re-run
DROP POLICY IF EXISTS "Users can view their own search artifacts" ON public.search_artifacts;
DROP POLICY IF EXISTS "Users can create search artifacts" ON public.search_artifacts;
DROP POLICY IF EXISTS "Users can update their own search artifacts" ON public.search_artifacts;
DROP POLICY IF EXISTS "Users can delete their own search artifacts" ON public.search_artifacts;
DROP POLICY IF EXISTS "Service role can access search artifacts" ON public.search_artifacts;

-- Users can only see their own search artifacts
CREATE POLICY "Users can view their own search artifacts"
  ON public.search_artifacts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create search artifacts
CREATE POLICY "Users can create search artifacts"
  ON public.search_artifacts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own search artifacts (for progress updates)
CREATE POLICY "Users can update their own search artifacts"
  ON public.search_artifacts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own search artifacts
CREATE POLICY "Users can delete their own search artifacts"
  ON public.search_artifacts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can access everything
CREATE POLICY "Service role can access search artifacts"
  ON public.search_artifacts
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- SCHEMA NOTES
-- ============================================================
--
-- interview_stages structure:
-- {
--   stages: [
--     {
--       name: string,
--       order_index: number,
--       duration: string,
--       interviewer: string,
--       content: string,
--       guidance: string,
--       preparation_tips: string[],
--       common_questions: string[],
--       red_flags_to_avoid: string[]
--     }
--   ]
-- }
--
-- comparison_analysis structure:
-- {
--   skill_gap_analysis: {
--     matching_skills: { technical: [], soft: [], certifications: [] },
--     missing_skills: { technical: [], soft: [], certifications: [] },
--     transferable_skills: [{ skill, relevance, how_to_position }],
--     skill_match_percentage: { technical: #, soft: #, overall: # }
--   },
--   experience_gap_analysis: {
--     relevant_experience: [{ experience, relevance_score, how_to_highlight }],
--     missing_experience: [{ requirement, severity, mitigation_strategy }],
--     experience_level_match: { required_years: #, candidate_years: #, level_match, gap_analysis }
--   },
--   personalized_story_bank: {
--     stories: [{ situation, task, action, result, applicable_questions: [], impact_quantified }],
--     achievement_highlights: [{ achievement, quantified_impact, relevance_to_role, story_angle }]
--   },
--   interview_prep_strategy: {
--     strengths_to_emphasize: [{ strength, supporting_evidence, how_to_present }],
--     weaknesses_to_address: [{ weakness, mitigation_strategy, improvement_plan }],
--     competitive_positioning: { unique_value_proposition, differentiation_points: [], positioning_strategy },
--     question_preparation_matrix: [{ question_type, priority, preparation_approach, sample_questions: [] }]
--   },
--   overall_fit_score: number (0-100)
-- }
--
-- interview_questions_data structure:
-- {
--   common_questions: [
--     {
--       stage_id: uuid (from interview_stages),
--       question: string,
--       category: string,
--       question_type: "common",
--       difficulty: string,
--       rationale: string,
--       suggested_answer_approach: string,
--       evaluation_criteria: [],
--       follow_up_questions: [],
--       star_story_fit: boolean,
--       company_context: string,
--       confidence_score: float
--     }
--   ],
--   enhanced_questions: [
--     ... similar structure ...
--   ]
-- }
--
-- preparation_guidance structure:
-- {
--   preparation_timeline: {
--     weeks_before: [],
--     week_before: [],
--     day_before: [],
--     day_of: []
--   },
--   preparation_priorities: [],
--   personalized_guidance: {
--     strengths_to_highlight: [],
--     areas_to_improve: [],
--     suggested_stories: [],
--     skill_gaps: [],
--     competitive_advantages: []
--   }
-- }
