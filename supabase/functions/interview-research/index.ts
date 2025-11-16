import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";
import { SearchLogger } from "../_shared/logger.ts";
import { RESEARCH_CONFIG, getOpenAIModel, getMaxTokens, getTemperature } from "../_shared/config.ts";
import { ProgressTracker, PROGRESS_STEPS, CONCURRENT_TIMEOUTS, executeWithTimeout } from "../_shared/progress-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InterviewResearchRequest {
  company: string;
  role?: string;
  country?: string;
  roleLinks?: string[];
  cv?: string;
  targetSeniority?: 'junior' | 'mid' | 'senior';
  userId: string;
  searchId: string;
}

interface RawResearchData {
  company_research_raw?: any;
  job_analysis_raw?: any;
  cv_analysis_raw?: any;
}

interface UnifiedSynthesisOutput {
  interview_stages: any[];
  comparison_analysis: any;
  interview_questions_data: any;
  preparation_guidance: any;
  synthesis_metadata: any;
}

// ============================================================
// PHASE 1: Data Gathering (concurrent calls to microservices)
// ============================================================

async function gatherCompanyData(company: string, role?: string, country?: string, searchId?: string) {
  try {
    console.log("📊 Gathering company research data...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONCURRENT_TIMEOUTS.companyResearch);

    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/company-research`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ company, role, country, searchId }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Company research complete");
      return result.company_insights || null;
    }

    console.warn(`⚠️ Company research failed with status ${response.status}`);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`⏱️ Company research timed out after ${CONCURRENT_TIMEOUTS.companyResearch}ms`);
    } else {
      console.error("❌ Company research error:", error);
    }
    return null;
  }
}

async function gatherJobData(roleLinks: string[], searchId: string, company?: string, role?: string) {
  if (!roleLinks || roleLinks.length === 0) {
    console.log("⏭️ No role links provided, skipping job analysis");
    return null;
  }

  try {
    console.log("📋 Gathering job analysis data...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONCURRENT_TIMEOUTS.jobAnalysis);

    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/job-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ roleLinks, searchId, company, role }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Job analysis complete");
      return result.job_requirements || null;
    }

    console.warn(`⚠️ Job analysis failed with status ${response.status}`);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`⏱️ Job analysis timed out after ${CONCURRENT_TIMEOUTS.jobAnalysis}ms`);
    } else {
      console.error("❌ Job analysis error:", error);
    }
    return null;
  }
}

async function gatherCVData(cv: string, userId: string) {
  if (!cv) {
    console.log("⏭️ No CV provided, skipping CV analysis");
    return null;
  }

  try {
    console.log("📄 Gathering CV analysis data...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONCURRENT_TIMEOUTS.cvAnalysis);

    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/cv-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ cvText: cv, userId }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      console.log("✅ CV analysis complete");
      return result;
    }

    console.warn(`⚠️ CV analysis failed with status ${response.status}`);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`⏱️ CV analysis timed out after ${CONCURRENT_TIMEOUTS.cvAnalysis}ms`);
    } else {
      console.error("❌ CV analysis error:", error);
    }
    return null;
  }
}

// ============================================================
// PHASE 2: UNIFIED SYNTHESIS
// Consolidates all data sources into single OpenAI call
// Generates: interview stages + comparison analysis + all questions in one prompt
// ============================================================

async function unifiedSynthesis(
  company: string,
  role: string | undefined,
  country: string | undefined,
  targetSeniority: 'junior' | 'mid' | 'senior' | undefined,
  companyInsights: any,
  jobRequirements: any,
  cvAnalysis: any,
  openaiApiKey: string
): Promise<UnifiedSynthesisOutput | null> {

  try {
    console.log("🔄 Starting unified synthesis with all data sources...");

    // Build comprehensive synthesis prompt
    const synthesisPrompt = buildSynthesisPrompt(
      company, role, country, targetSeniority,
      companyInsights, jobRequirements, cvAnalysis
    );

    const model = getOpenAIModel('interviewSynthesis');
    const maxTokens = getMaxTokens('interviewSynthesis');
    const temperature = getTemperature('synthesis');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: 'system',
            content: getSynthesisSystemPrompt()
          },
          {
            role: 'user',
            content: synthesisPrompt
          }
        ],
        max_tokens: maxTokens,
        temperature
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenAI synthesis error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const synthesisResult = JSON.parse(data.choices[0].message.content);

    console.log("✅ Unified synthesis complete");

    return {
      interview_stages: synthesisResult.interview_stages || [],
      comparison_analysis: synthesisResult.comparison_analysis || {},
      interview_questions_data: synthesisResult.interview_questions_data || {},
      preparation_guidance: synthesisResult.preparation_guidance || {},
      synthesis_metadata: {
        model,
        max_tokens: maxTokens,
        temperature,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error("❌ Synthesis error:", error);
    return null;
  }
}

function getSynthesisSystemPrompt(): string {
  return `You are an expert interview preparation consultant with deep knowledge of hiring practices across major companies and technical roles.

Your task is to create a COMPREHENSIVE, UNIFIED interview preparation guide based on company research, job requirements, and candidate profile.

CRITICAL REQUIREMENTS:
1. Generate 4 realistic interview stages based on company hiring process
2. Create a detailed CV-to-Job comparison analysis
3. Generate 120-150 interview questions across 7 categories
4. Provide personalized preparation guidance

QUALITY REQUIREMENTS:
- All questions must be SPECIFIC and ACTIONABLE (NO generic placeholders)
- Interview stages must match actual company processes (use company research data)
- Questions must reference company-specific information when available
- Difficulty must adapt to candidate seniority level
- All data must be grounded in provided research

FORBIDDEN:
- Generic placeholders like "coding problem", "behavioral question", "solve this"
- Vague questions without context
- Questions not aligned with company culture or job requirements

You MUST return ONLY valid JSON in the exact structure specified - no markdown, no additional text.`;
}

function buildSynthesisPrompt(
  company: string,
  role: string | undefined,
  country: string | undefined,
  targetSeniority: 'junior' | 'mid' | 'senior' | undefined,
  companyInsights: any,
  jobRequirements: any,
  cvAnalysis: any
): string {
  let prompt = `Create a comprehensive interview preparation guide for:\n`;
  prompt += `Company: ${company}\n`;
  if (role) prompt += `Role: ${role}\n`;
  if (country) prompt += `Country: ${country}\n`;
  if (targetSeniority) prompt += `Candidate Seniority: ${targetSeniority}\n`;
  prompt += `\n`;

  if (companyInsights) {
    prompt += `COMPANY RESEARCH:\n`;
    prompt += `Industry: ${companyInsights.industry}\n`;
    prompt += `Culture: ${companyInsights.culture}\n`;
    prompt += `Values: ${companyInsights.values?.join(', ')}\n`;
    prompt += `Interview Philosophy: ${companyInsights.interview_philosophy}\n`;
    if (companyInsights.interview_stages?.length > 0) {
      prompt += `\nInterview Process (from candidate reports):\n`;
      companyInsights.interview_stages.forEach((stage: any) => {
        prompt += `- Stage: ${stage.name} (${stage.duration})\n`;
        prompt += `  Interviewer: ${stage.interviewer}\n`;
        if (stage.common_questions?.length > 0) {
          prompt += `  Common Questions: ${stage.common_questions.join(', ')}\n`;
        }
      });
    }
    prompt += `\n`;
  }

  if (jobRequirements) {
    prompt += `JOB REQUIREMENTS:\n`;
    prompt += `Technical Skills: ${jobRequirements.technical_skills?.join(', ')}\n`;
    prompt += `Soft Skills: ${jobRequirements.soft_skills?.join(', ')}\n`;
    prompt += `Experience Level: ${jobRequirements.experience_level}\n`;
    if (jobRequirements.responsibilities?.length > 0) {
      prompt += `Key Responsibilities: ${jobRequirements.responsibilities.join(', ')}\n`;
    }
    prompt += `\n`;
  }

  if (cvAnalysis) {
    const analysisData = cvAnalysis.aiAnalysis || cvAnalysis;
    prompt += `CANDIDATE PROFILE:\n`;
    prompt += `Current Role: ${analysisData.current_role || 'Not specified'}\n`;
    prompt += `Experience: ${analysisData.experience_years || 0} years\n`;
    prompt += `Technical Skills: ${analysisData.skills?.technical?.join(', ') || 'Not specified'}\n`;
    prompt += `Key Achievements: ${analysisData.key_achievements?.slice(0, 3).join(', ') || 'Not specified'}\n`;
    prompt += `\n`;
  }

  prompt += `Return this exact JSON structure:\n`;
  prompt += JSON.stringify(getUnifiedSynthesisSchema(), null, 2);

  return prompt;
}

function getUnifiedSynthesisSchema(): any {
  return {
    interview_stages: [
      {
        name: "Stage Name",
        order_index: 1,
        duration: "Duration estimate",
        interviewer: "Who conducts",
        content: "What to expect",
        guidance: "How to approach",
        preparation_tips: ["tip1", "tip2"],
        common_questions: ["question1", "question2"],
        red_flags_to_avoid: ["flag1", "flag2"]
      }
    ],
    comparison_analysis: {
      skill_gap_analysis: {
        matching_skills: {
          technical: ["skill1"],
          soft: ["skill1"],
          certifications: ["cert1"]
        },
        missing_skills: {
          technical: ["skill1"],
          soft: ["skill1"]
        },
        skill_match_percentage: {
          technical: 0,
          soft: 0,
          overall: 0
        }
      },
      experience_gap_analysis: {
        relevant_experience: [
          { experience: "Experience", relevance_score: 0.8, how_to_highlight: "How to present" }
        ],
        missing_experience: [
          { requirement: "Requirement", severity: "low|medium|high", mitigation_strategy: "How to address" }
        ]
      },
      personalized_story_bank: {
        stories: [
          { situation: "S", task: "T", action: "A", result: "R", applicable_questions: [], impact_quantified: "Impact" }
        ]
      },
      interview_prep_strategy: {
        strengths_to_emphasize: ["strength1"],
        weaknesses_to_address: ["weakness1"],
        competitive_positioning: { unique_value_proposition: "USP", differentiation_points: [] }
      },
      overall_fit_score: 0
    },
    interview_questions_data: {
      behavioral: [
        {
          question: "Specific behavioral question",
          category: "behavioral",
          difficulty: "easy|medium|hard",
          star_story_fit: true,
          company_context: "How it relates to company",
          confidence_score: 0.9
        }
      ],
      technical: [],
      situational: [],
      company_specific: [],
      role_specific: [],
      experience_based: [],
      cultural_fit: []
    },
    preparation_guidance: {
      preparation_timeline: {
        weeks_before: ["task1"],
        week_before: ["task1"],
        day_before: ["task1"],
        day_of: ["task1"]
      },
      preparation_priorities: ["priority1"],
      personalized_guidance: {
        strengths_to_highlight: ["strength1"],
        areas_to_improve: ["area1"],
        suggested_stories: ["story1"]
      }
    }
  };
}

// ============================================================
// PHASE 3: Database Operations with Timeout Protection
// ============================================================

async function withDbTimeout<T>(
  operation: () => Promise<T>,
  label: string,
  timeoutMs: number = 30000
): Promise<T | null> {
  try {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error(`Database timeout: ${label}`)), timeoutMs)
    );
    return await Promise.race([operation(), timeoutPromise as Promise<T>]);
  } catch (error) {
    console.error(`❌ DB operation failed (${label}):`, error);
    return null;
  }
}

async function saveToDatabase(
  supabase: any,
  searchId: string,
  userId: string,
  rawData: RawResearchData,
  synthesis: UnifiedSynthesisOutput
) {
  try {
    console.log("💾 Saving to database...");

    // CHECKPOINT 1: Save raw research data to search_artifacts
    console.log("  → Saving raw research data...");
    const rawSaveResult = await withDbTimeout(
      async () => {
        const { data, error } = await supabase
          .from('search_artifacts')
          .insert({
            search_id: searchId,
            user_id: userId,
            company_research_raw: rawData.company_research_raw,
            job_analysis_raw: rawData.job_analysis_raw,
            cv_analysis_raw: rawData.cv_analysis_raw,
            processing_status: 'raw_data_saved',
            processing_raw_save_at: new Date().toISOString()
          });

        if (error) throw error;
        return data;
      },
      'Save raw data to search_artifacts'
    );

    if (!rawSaveResult) {
      console.warn("⚠️ Raw data save failed, continuing...");
    } else {
      console.log("✅ Raw data saved");
    }

    // CHECKPOINT 2: Save synthesis results to search_artifacts
    console.log("  → Saving synthesis results...");
    const synthesisSaveResult = await withDbTimeout(
      async () => {
        const { data, error } = await supabase
          .from('search_artifacts')
          .update({
            interview_stages: synthesis.interview_stages,
            synthesis_metadata: synthesis.synthesis_metadata,
            comparison_analysis: synthesis.comparison_analysis,
            interview_questions_data: synthesis.interview_questions_data,
            preparation_guidance: synthesis.preparation_guidance,
            processing_status: 'complete',
            processing_synthesis_end_at: new Date().toISOString(),
            processing_completed_at: new Date().toISOString()
          })
          .eq('search_id', searchId);

        if (error) throw error;
        return data;
      },
      'Save synthesis to search_artifacts'
    );

    if (!synthesisSaveResult) {
      console.warn("⚠️ Synthesis save failed, continuing...");
    } else {
      console.log("✅ Synthesis saved");
    }

    // CHECKPOINT 3: Insert interview stages for UI display
    console.log("  → Saving interview stages...");
    await withDbTimeout(
      async () => {
        const stagesToInsert = (synthesis.interview_stages || []).map((stage: any, index: number) => ({
          search_id: searchId,
          name: stage.name,
          order_index: stage.order_index || index + 1,
          duration: stage.duration,
          interviewer: stage.interviewer,
          content: stage.content,
          guidance: stage.guidance,
          preparation_tips: stage.preparation_tips || [],
          common_questions: stage.common_questions || [],
          red_flags_to_avoid: stage.red_flags_to_avoid || []
        }));

        if (stagesToInsert.length === 0) return null;

        const { data, error } = await supabase
          .from('interview_stages')
          .insert(stagesToInsert);

        if (error) throw error;
        return data;
      },
      'Insert interview stages'
    );

    console.log("✅ Interview stages saved");

    // CHECKPOINT 4: Insert interview questions
    console.log("  → Saving interview questions...");
    await withDbTimeout(
      async () => {
        const questionsToInsert: any[] = [];

        if (synthesis.interview_questions_data) {
          Object.entries(synthesis.interview_questions_data).forEach(([category, questions]: [string, any]) => {
            if (Array.isArray(questions)) {
              questions.forEach((q: any) => {
                questionsToInsert.push({
                  search_id: searchId,
                  question: q.question,
                  category: category,
                  question_type: 'synthesized',
                  difficulty: q.difficulty || 'medium',
                  rationale: q.rationale || '',
                  suggested_answer_approach: q.suggested_answer_approach || '',
                  evaluation_criteria: q.evaluation_criteria || [],
                  follow_up_questions: q.follow_up_questions || [],
                  star_story_fit: q.star_story_fit || false,
                  company_context: q.company_context || '',
                  confidence_score: q.confidence_score || 0.8
                });
              });
            }
          });
        }

        if (questionsToInsert.length === 0) return null;

        const { data, error } = await supabase
          .from('interview_questions')
          .insert(questionsToInsert);

        if (error) throw error;
        return data;
      },
      'Insert interview questions'
    );

    console.log(`✅ Interview questions saved (${Object.values(synthesis.interview_questions_data || {}).flat().length} questions)`);

    // CHECKPOINT 5: Update search status
    console.log("  → Updating search status...");
    await withDbTimeout(
      async () => {
        const { data, error } = await supabase
          .from('searches')
          .update({
            search_status: 'completed',
            overall_fit_score: synthesis.comparison_analysis?.overall_fit_score || 0,
            preparation_priorities: synthesis.preparation_guidance?.preparation_priorities || [],
            cv_job_comparison: synthesis.comparison_analysis
          })
          .eq('id', searchId);

        if (error) throw error;
        return data;
      },
      'Update searches table'
    );

    console.log("✅ Search status updated");
    console.log("✅ All data saved successfully!");

  } catch (error) {
    console.error("❌ Database save error:", error);
    throw error;
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const tracker = new ProgressTracker("");
  let searchId = "";
  let userId = "";

  try {
    const requestData: InterviewResearchRequest = await req.json();

    searchId = requestData.searchId;
    userId = requestData.userId;
    tracker.searchId = searchId;

    console.log(`\n🚀 Starting interview research for search: ${searchId}`);
    console.log(`   Company: ${requestData.company}`);
    console.log(`   Role: ${requestData.role || 'Not specified'}`);
    console.log(`   Seniority: ${requestData.targetSeniority || 'Not specified'}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || "";

    // ============================================================
    // PHASE 1: Concurrent Data Gathering (20-30 seconds)
    // ============================================================

    console.log("\n📊 PHASE 1: Gathering research data...");
    await tracker.updateStep(PROGRESS_STEPS.DATA_GATHERING_START);

    const [companyInsights, jobRequirements, cvAnalysis] = await Promise.allSettled([
      gatherCompanyData(requestData.company, requestData.role, requestData.country, searchId),
      gatherJobData(requestData.roleLinks || [], searchId, requestData.company, requestData.role),
      gatherCVData(requestData.cv || "", userId)
    ]).then(results => [
      results[0].status === 'fulfilled' ? results[0].value : null,
      results[1].status === 'fulfilled' ? results[1].value : null,
      results[2].status === 'fulfilled' ? results[2].value : null
    ]);

    console.log("\n✅ PHASE 1 Complete");
    await tracker.updateStep(PROGRESS_STEPS.DATA_GATHERING_COMPLETE);

    // ============================================================
    // Save raw data immediately to search_artifacts
    // ============================================================

    console.log("\n💾 PHASE 2: Saving raw research data...");

    const rawData: RawResearchData = {
      company_research_raw: companyInsights,
      job_analysis_raw: jobRequirements,
      cv_analysis_raw: cvAnalysis
    };

    await withDbTimeout(
      async () => {
        const { error } = await supabase
          .from('search_artifacts')
          .insert({
            search_id: searchId,
            user_id: userId,
            ...rawData,
            processing_status: 'raw_data_saved',
            processing_started_at: new Date().toISOString(),
            processing_raw_save_at: new Date().toISOString()
          });

        if (error) {
          console.warn("⚠️ Failed to save raw data:", error.message);
          return null;
        }
        return true;
      },
      'Save raw data'
    );

    console.log("✅ Raw data saved to database");

    // ============================================================
    // PHASE 3: Unified Synthesis (20-30 seconds)
    // ============================================================

    console.log("\n🔄 PHASE 3: Unified synthesis...");
    await tracker.updateStep(PROGRESS_STEPS.AI_SYNTHESIS_START);

    const synthesis = await unifiedSynthesis(
      requestData.company,
      requestData.role,
      requestData.country,
      requestData.targetSeniority,
      companyInsights,
      jobRequirements,
      cvAnalysis,
      openaiApiKey
    );

    if (!synthesis) {
      throw new Error("Synthesis failed");
    }

    console.log("✅ PHASE 3 Complete");
    await tracker.updateStep(PROGRESS_STEPS.AI_SYNTHESIS_COMPLETE);

    // ============================================================
    // PHASE 4: Save all results to database
    // ============================================================

    console.log("\n💾 PHASE 4: Saving all results to database...");
    await tracker.updateStep(PROGRESS_STEPS.QUESTION_GENERATION_START);

    await saveToDatabase(supabase, searchId, userId, rawData, synthesis);

    console.log("✅ PHASE 4 Complete");
    await tracker.updateStep(PROGRESS_STEPS.QUESTION_GENERATION_COMPLETE);

    // ============================================================
    // Success response
    // ============================================================

    console.log(`\n✅ Interview research complete for search: ${searchId}`);

    await tracker.markComplete();

    return new Response(
      JSON.stringify({
        success: true,
        searchId,
        status: 'completed',
        message: 'Interview research completed successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("❌ Error in interview-research:", error);

    if (searchId && userId) {
      // Mark search as failed in database
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      );

      await supabase
        .from('searches')
        .update({
          search_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', searchId)
        .catch(err => console.error("Failed to mark search as failed:", err));
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
