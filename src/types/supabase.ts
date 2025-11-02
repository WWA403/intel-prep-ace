export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cv_job_comparisons: {
        Row: {
          created_at: string
          experience_gap_analysis: Json
          id: string
          interview_prep_strategy: Json
          overall_fit_score: number
          personalized_story_bank: Json
          preparation_priorities: string[] | null
          search_id: string | null
          skill_gap_analysis: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          experience_gap_analysis: Json
          id?: string
          interview_prep_strategy: Json
          overall_fit_score?: number
          personalized_story_bank: Json
          preparation_priorities?: string[] | null
          search_id?: string | null
          skill_gap_analysis: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          experience_gap_analysis?: Json
          id?: string
          interview_prep_strategy?: Json
          overall_fit_score?: number
          personalized_story_bank?: Json
          preparation_priorities?: string[] | null
          search_id?: string | null
          skill_gap_analysis?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cv_job_comparisons_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_job_comparisons_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "stalled_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      function_executions: {
        Row: {
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          function_name: string
          id: string
          openai_call_ids: string[] | null
          processed_outputs: Json | null
          raw_inputs: Json
          raw_outputs: Json | null
          search_id: string | null
          status: string | null
          tavily_call_ids: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          function_name: string
          id?: string
          openai_call_ids?: string[] | null
          processed_outputs?: Json | null
          raw_inputs: Json
          raw_outputs?: Json | null
          search_id?: string | null
          status?: string | null
          tavily_call_ids?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          function_name?: string
          id?: string
          openai_call_ids?: string[] | null
          processed_outputs?: Json | null
          raw_inputs?: Json
          raw_outputs?: Json | null
          search_id?: string | null
          status?: string | null
          tavily_call_ids?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "function_executions_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "function_executions_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "stalled_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_experiences: {
        Row: {
          company_name: string
          created_at: string
          difficulty_rating: string | null
          experience_text: string | null
          experience_type: string | null
          id: string
          interviewer_feedback: string | null
          process_duration: string | null
          questions_asked: string[] | null
          role_title: string | null
          search_id: string | null
          source_platform: string | null
          source_url: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          difficulty_rating?: string | null
          experience_text?: string | null
          experience_type?: string | null
          id?: string
          interviewer_feedback?: string | null
          process_duration?: string | null
          questions_asked?: string[] | null
          role_title?: string | null
          search_id?: string | null
          source_platform?: string | null
          source_url?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          difficulty_rating?: string | null
          experience_text?: string | null
          experience_type?: string | null
          id?: string
          interviewer_feedback?: string | null
          process_duration?: string | null
          questions_asked?: string[] | null
          role_title?: string | null
          search_id?: string | null
          source_platform?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_experiences_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_experiences_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "stalled_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_questions: {
        Row: {
          category: string
          company_context: string | null
          confidence_score: number | null
          created_at: string
          difficulty: string
          evaluation_criteria: string[] | null
          follow_up_questions: string[] | null
          id: string
          question: string
          question_type: string
          rationale: string | null
          search_id: string | null
          stage_id: string
          star_story_fit: boolean | null
          suggested_answer_approach: string | null
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          category?: string
          company_context?: string | null
          confidence_score?: number | null
          created_at?: string
          difficulty?: string
          evaluation_criteria?: string[] | null
          follow_up_questions?: string[] | null
          id?: string
          question: string
          question_type?: string
          rationale?: string | null
          search_id?: string | null
          stage_id: string
          star_story_fit?: boolean | null
          suggested_answer_approach?: string | null
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          category?: string
          company_context?: string | null
          confidence_score?: number | null
          created_at?: string
          difficulty?: string
          evaluation_criteria?: string[] | null
          follow_up_questions?: string[] | null
          id?: string
          question?: string
          question_type?: string
          rationale?: string | null
          search_id?: string | null
          stage_id?: string
          star_story_fit?: boolean | null
          suggested_answer_approach?: string | null
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_questions_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "stalled_searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_questions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "interview_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_stages: {
        Row: {
          content: string | null
          created_at: string
          duration: string | null
          guidance: string | null
          id: string
          interviewer: string | null
          name: string
          order_index: number
          search_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          duration?: string | null
          guidance?: string | null
          id?: string
          interviewer?: string | null
          name: string
          order_index: number
          search_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          duration?: string | null
          guidance?: string | null
          id?: string
          interviewer?: string | null
          name?: string
          order_index?: number
          search_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_stages_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_stages_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "stalled_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      openai_calls: {
        Row: {
          completion_tokens: number | null
          created_at: string
          endpoint_url: string
          error_message: string | null
          function_name: string
          id: string
          model: string
          prompt_tokens: number | null
          request_duration_ms: number | null
          request_payload: Json
          response_payload: Json | null
          response_status: number
          search_id: string | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          endpoint_url: string
          error_message?: string | null
          function_name: string
          id?: string
          model: string
          prompt_tokens?: number | null
          request_duration_ms?: number | null
          request_payload: Json
          response_payload?: Json | null
          response_status: number
          search_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          endpoint_url?: string
          error_message?: string | null
          function_name?: string
          id?: string
          model?: string
          prompt_tokens?: number | null
          request_duration_ms?: number | null
          request_payload?: Json
          response_payload?: Json | null
          response_status?: number
          search_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "openai_calls_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "openai_calls_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "stalled_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_answers: {
        Row: {
          answer_time_seconds: number | null
          audio_url: string | null
          created_at: string
          id: string
          question_id: string
          session_id: string
          text_answer: string | null
        }
        Insert: {
          answer_time_seconds?: number | null
          audio_url?: string | null
          created_at?: string
          id?: string
          question_id: string
          session_id: string
          text_answer?: string | null
        }
        Update: {
          answer_time_seconds?: number | null
          audio_url?: string | null
          created_at?: string
          id?: string
          question_id?: string
          session_id?: string
          text_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "interview_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          completed_at: string | null
          id: string
          search_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          search_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          search_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sessions_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "stalled_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          seniority: Database["public"]["Enums"]["seniority_level"] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          seniority?: Database["public"]["Enums"]["seniority_level"] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          seniority?: Database["public"]["Enums"]["seniority_level"] | null
          updated_at?: string
        }
        Relationships: []
      }
      resumes: {
        Row: {
          content: string
          created_at: string
          id: string
          parsed_data: Json | null
          search_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parsed_data?: Json | null
          search_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parsed_data?: Json | null
          search_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumes_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resumes_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "stalled_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_urls: {
        Row: {
          ai_summary: string | null
          company_name: string
          content_quality_score: number | null
          content_source: string | null
          content_staleness_days: number | null
          content_summary: string | null
          content_type: string | null
          country: string | null
          created_at: string
          domain: string
          experience_metadata: Json | null
          extracted_insights: string[] | null
          extracted_questions: string[] | null
          extraction_method: string | null
          first_scraped_at: string
          full_content: string | null
          id: string
          language: string | null
          last_reused_at: string | null
          last_validated_at: string
          platform_specific_data: Json | null
          processing_status: string | null
          raw_html: string | null
          role_title: string | null
          scraping_method: string | null
          structured_data: Json | null
          times_reused: number | null
          title: string | null
          updated_at: string
          url: string
          url_hash: string
          word_count: number | null
        }
        Insert: {
          ai_summary?: string | null
          company_name: string
          content_quality_score?: number | null
          content_source?: string | null
          content_staleness_days?: number | null
          content_summary?: string | null
          content_type?: string | null
          country?: string | null
          created_at?: string
          domain: string
          experience_metadata?: Json | null
          extracted_insights?: string[] | null
          extracted_questions?: string[] | null
          extraction_method?: string | null
          first_scraped_at?: string
          full_content?: string | null
          id?: string
          language?: string | null
          last_reused_at?: string | null
          last_validated_at?: string
          platform_specific_data?: Json | null
          processing_status?: string | null
          raw_html?: string | null
          role_title?: string | null
          scraping_method?: string | null
          structured_data?: Json | null
          times_reused?: number | null
          title?: string | null
          updated_at?: string
          url: string
          url_hash: string
          word_count?: number | null
        }
        Update: {
          ai_summary?: string | null
          company_name?: string
          content_quality_score?: number | null
          content_source?: string | null
          content_staleness_days?: number | null
          content_summary?: string | null
          content_type?: string | null
          country?: string | null
          created_at?: string
          domain?: string
          experience_metadata?: Json | null
          extracted_insights?: string[] | null
          extracted_questions?: string[] | null
          extraction_method?: string | null
          first_scraped_at?: string
          full_content?: string | null
          id?: string
          language?: string | null
          last_reused_at?: string | null
          last_validated_at?: string
          platform_specific_data?: Json | null
          processing_status?: string | null
          raw_html?: string | null
          role_title?: string | null
          scraping_method?: string | null
          structured_data?: Json | null
          times_reused?: number | null
          title?: string | null
          updated_at?: string
          url?: string
          url_hash?: string
          word_count?: number | null
        }
        Relationships: []
      }
      searches: {
        Row: {
          company: string
          completed_at: string | null
          country: string | null
          created_at: string
          cv_job_comparison: Json | null
          error_message: string | null
          id: string
          overall_fit_score: number | null
          preparation_priorities: string[] | null
          progress_percentage: number | null
          progress_step: string | null
          role: string | null
          role_links: string | null
          search_status: string
          started_at: string | null
          status: string | null
          target_seniority:
            | Database["public"]["Enums"]["seniority_level"]
            | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company: string
          completed_at?: string | null
          country?: string | null
          created_at?: string
          cv_job_comparison?: Json | null
          error_message?: string | null
          id?: string
          overall_fit_score?: number | null
          preparation_priorities?: string[] | null
          progress_percentage?: number | null
          progress_step?: string | null
          role?: string | null
          role_links?: string | null
          search_status?: string
          started_at?: string | null
          status?: string | null
          target_seniority?:
            | Database["public"]["Enums"]["seniority_level"]
            | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company?: string
          completed_at?: string | null
          country?: string | null
          created_at?: string
          cv_job_comparison?: Json | null
          error_message?: string | null
          id?: string
          overall_fit_score?: number | null
          preparation_priorities?: string[] | null
          progress_percentage?: number | null
          progress_step?: string | null
          role?: string | null
          role_links?: string | null
          search_status?: string
          started_at?: string | null
          status?: string | null
          target_seniority?:
            | Database["public"]["Enums"]["seniority_level"]
            | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tavily_searches: {
        Row: {
          api_type: string
          created_at: string
          credits_used: number | null
          error_message: string | null
          id: string
          query_text: string
          request_duration_ms: number | null
          response_payload: Json | null
          response_status: number
          results_count: number | null
          search_id: string | null
          user_id: string | null
        }
        Insert: {
          api_type: string
          created_at?: string
          credits_used?: number | null
          error_message?: string | null
          id?: string
          query_text: string
          request_duration_ms?: number | null
          response_payload?: Json | null
          response_status: number
          results_count?: number | null
          search_id?: string | null
          user_id?: string | null
        }
        Update: {
          api_type?: string
          created_at?: string
          credits_used?: number | null
          error_message?: string | null
          id?: string
          query_text?: string
          request_duration_ms?: number | null
          response_payload?: Json | null
          response_status?: number
          results_count?: number | null
          search_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tavily_searches_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tavily_searches_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "stalled_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      url_deduplication_metrics: {
        Row: {
          api_calls_saved: number | null
          cache_hit_count: number | null
          created_at: string | null
          id: string
          response_time_ms: number | null
          search_id: string | null
          total_urls_needed: number | null
        }
        Insert: {
          api_calls_saved?: number | null
          cache_hit_count?: number | null
          created_at?: string | null
          id?: string
          response_time_ms?: number | null
          search_id?: string | null
          total_urls_needed?: number | null
        }
        Update: {
          api_calls_saved?: number | null
          cache_hit_count?: number | null
          created_at?: string | null
          id?: string
          response_time_ms?: number | null
          search_id?: string | null
          total_urls_needed?: number | null
        }
        Relationships: []
      }
      user_question_flags: {
        Row: {
          created_at: string | null
          flag_type: string
          id: string
          question_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          flag_type: string
          id?: string
          question_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          flag_type?: string
          id?: string
          question_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_question_flags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "interview_questions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      stalled_searches: {
        Row: {
          company: string | null
          id: string | null
          progress_percentage: number | null
          progress_step: string | null
          role: string | null
          search_status: string | null
          seconds_since_update: number | null
          started_at: string | null
          total_elapsed_seconds: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company?: string | null
          id?: string | null
          progress_percentage?: number | null
          progress_step?: string | null
          role?: string | null
          search_status?: string | null
          seconds_since_update?: never
          started_at?: string | null
          total_elapsed_seconds?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company?: string | null
          id?: string | null
          progress_percentage?: number | null
          progress_step?: string | null
          role?: string | null
          search_status?: string | null
          seconds_since_update?: never
          started_at?: string | null
          total_elapsed_seconds?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_openai_cost: {
        Args: {
          completion_tokens: number
          model: string
          prompt_tokens: number
        }
        Returns: number
      }
      find_reusable_urls_fast: {
        Args: {
          p_company: string
          p_country?: string
          p_max_age_days?: number
          p_min_quality_score?: number
          p_role?: string
        }
        Returns: {
          content_quality_score: number
          content_type: string
          domain: string
          times_reused: number
          title: string
          url: string
        }[]
      }
      find_reusable_urls_simple: {
        Args: {
          p_company_name: string
          p_max_age_days?: number
          p_min_quality_score?: number
          p_role_title?: string
        }
        Returns: {
          ai_summary: string
          content_quality_score: number
          id: string
          title: string
          url: string
        }[]
      }
      get_cached_content_simple: {
        Args: { p_urls: string[] }
        Returns: {
          content: string
          content_type: string
          title: string
          url: string
        }[]
      }
      get_enhanced_search_results: {
        Args: { p_search_id: string }
        Returns: {
          cv_job_comparison: Json
          enhanced_questions: Json
          interview_experiences: Json
          interview_questions: Json
          interview_stages: Json
          search_data: Json
        }[]
      }
      get_search_progress: {
        Args: { search_uuid: string }
        Returns: {
          company: string
          completed_at: string
          error_message: string
          id: string
          is_stalled: boolean
          progress_percentage: number
          progress_step: string
          role: string
          search_status: string
          started_at: string
          updated_at: string
          user_id: string
        }[]
      }
      increment_url_reuse_count: {
        Args: { url_id: string }
        Returns: undefined
      }
      update_search_progress: {
        Args: {
          error_msg?: string
          new_percentage?: number
          new_status: string
          new_step?: string
          search_uuid: string
        }
        Returns: undefined
      }
    }
    Enums: {
      seniority_level: "junior" | "mid" | "senior"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      seniority_level: ["junior", "mid", "senior"],
    },
  },
} as const
A new version of Supabase CLI is available: v2.54.11 (currently installed v2.20.12)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
