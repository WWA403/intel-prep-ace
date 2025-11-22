import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";
import { SearchLogger } from "../_shared/logger.ts";
import { RESEARCH_CONFIG, getOpenAIModel, getMaxTokens } from "../_shared/config.ts";
import { ProgressTracker, PROGRESS_STEPS, CONCURRENT_TIMEOUTS, executeWithTimeout } from "../_shared/progress-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    
    // Log which model is being used
    console.log(`🤖 Using OpenAI model: ${model} (from ${Deno.env.get("OPENAI_MODEL") ? "OPENAI_MODEL env var" : "default config"})`);
    console.log(`📊 Max tokens: ${maxTokens}`);

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
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenAI synthesis error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    // Use shared JSON parsing utility that handles markdown code blocks
    const { parseJsonResponse } = await import("../_shared/openai-client.ts");
    const synthesisResult = parseJsonResponse(rawContent, {
      interview_stages: [],
      comparison_analysis: {},
      interview_questions_data: {},
      preparation_guidance: {}
    });
    
    // Log question counts
    const questionCounts: Record<string, number> = {};
    if (synthesisResult.interview_questions_data) {
      Object.entries(synthesisResult.interview_questions_data).forEach(([category, questions]: [string, any]) => {
        questionCounts[category] = Array.isArray(questions) ? questions.length : 0;
      });
    }
    const totalQuestions = Object.values(questionCounts).reduce((sum, count) => sum + count, 0);
    
    console.log("✅ Unified synthesis complete");
    console.log(`📊 Questions generated: ${totalQuestions} total`);
    console.log(`📋 Question breakdown:`, questionCounts);

    return {
      interview_stages: synthesisResult.interview_stages || [],
      comparison_analysis: synthesisResult.comparison_analysis || {},
      interview_questions_data: synthesisResult.interview_questions_data || {},
      preparation_guidance: synthesisResult.preparation_guidance || {},
      synthesis_metadata: {
        model,
        max_tokens: maxTokens,
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

Your task is to create a COMPREHENSIVE, DEEPLY TAILORED interview preparation guide based on company research, job requirements, and candidate profile.

CRITICAL REQUIREMENTS:
1. Generate 4 realistic interview stages based on ACTUAL company hiring process from candidate reports
2. Create a detailed CV-to-Job comparison analysis with specific skill gaps and experience mapping
3. Generate 30-50 HIGHLY TAILORED interview questions across 7 categories (5-8 per category) - QUALITY OVER QUANTITY
4. Provide personalized preparation guidance based on candidate's specific background

QUALITY REQUIREMENTS - STRICTLY ENFORCE:
- QUALITY OVER QUANTITY: Generate fewer questions (30-50 total) but ensure EVERY question is deeply tailored and highly relevant
- QUESTION-FIRST APPROACH: Use the REAL interview questions provided as the foundation. Generate variations, extensions, and context-specific versions of these actual questions.
- DEEP TAILORING: 100% of questions must reference specific details from:
  * Candidate's work history, projects, and achievements
  * Specific job responsibilities and requirements
  * Company culture, values, and interview philosophy
  * Real interview questions extracted from candidate reports
- SPECIFICITY: All questions must be SPECIFIC and ACTIONABLE (NO generic placeholders)
  * Instead of "Tell me about a challenge" → "Tell me about a time you optimized a system at scale, similar to what we do at [Company Name]"
  * Instead of "Solve a coding problem" → "Design a distributed caching system for our product recommendation engine"
- INTERVIEW STAGES: Must match ACTUAL company processes from candidate reports (not generic assumptions)
- DIFFICULTY ADAPTATION: Questions must match candidate's seniority level in complexity, not just quantity
- RESEARCH GROUNDING: All data must be grounded in provided research - cite specific sources when possible

FORBIDDEN:
- Generic placeholders like "coding problem", "behavioral question", "solve this"
- Vague questions without context or company/job/CV references
- Questions not aligned with company culture, job requirements, or candidate background
- Repeating the same question structure without variation
- Ignoring the real interview questions provided as foundation

QUESTION GENERATION STRATEGY:
1. Start with REAL questions from candidate reports - use these as templates
2. Generate 5-8 HIGHLY TAILORED questions per category (30-50 total) - focus on quality, not quantity
3. Each question MUST reference specific details from candidate's background, job requirements, or company research
4. Create variations tailored to the specific role and candidate background
5. Create extensions that probe deeper into candidate's experiences
6. Align questions with job responsibilities and company values
7. Ensure questions reference specific technologies, projects, or achievements from CV
8. Match question complexity to candidate's experience level
9. NO GENERIC QUESTIONS: Every question must be unique and reference specific context details

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
  let prompt = `Create a comprehensive, deeply tailored interview preparation guide for:\n`;
  prompt += `Company: ${company}\n`;
  if (role) prompt += `Role: ${role}\n`;
  if (country) prompt += `Country: ${country}\n`;
  if (targetSeniority) prompt += `Candidate Seniority: ${targetSeniority}\n`;
  prompt += `\n`;

  // ============================================================
  // SECTION 1: REAL INTERVIEW QUESTIONS (PRIORITY #1)
  // ============================================================
  if (companyInsights?.interview_questions_bank) {
    prompt += `=== REAL INTERVIEW QUESTIONS FROM CANDIDATE REPORTS ===\n`;
    prompt += `These are ACTUAL questions asked in interviews at ${company}. Use these as the foundation for generating tailored questions.\n\n`;
    
    const qBank = companyInsights.interview_questions_bank;
    if (qBank.behavioral?.length > 0) {
      prompt += `BEHAVIORAL QUESTIONS (${qBank.behavioral.length} found):\n`;
      qBank.behavioral.forEach((q: string, idx: number) => {
        prompt += `${idx + 1}. "${q}"\n`;
      });
      prompt += `\n`;
    }
    
    if (qBank.technical?.length > 0) {
      prompt += `TECHNICAL QUESTIONS (${qBank.technical.length} found):\n`;
      qBank.technical.forEach((q: string, idx: number) => {
        prompt += `${idx + 1}. "${q}"\n`;
      });
      prompt += `\n`;
    }
    
    if (qBank.situational?.length > 0) {
      prompt += `SITUATIONAL QUESTIONS (${qBank.situational.length} found):\n`;
      qBank.situational.forEach((q: string, idx: number) => {
        prompt += `${idx + 1}. "${q}"\n`;
      });
      prompt += `\n`;
    }
    
    if (qBank.company_specific?.length > 0) {
      prompt += `COMPANY-SPECIFIC QUESTIONS (${qBank.company_specific.length} found):\n`;
      qBank.company_specific.forEach((q: string, idx: number) => {
        prompt += `${idx + 1}. "${q}"\n`;
      });
      prompt += `\n`;
    }
    
    prompt += `CRITICAL: Generate variations and extensions of these real questions, tailored to the candidate's background and the specific role.\n\n`;
  }

  // ============================================================
  // SECTION 2: DETAILED COMPANY RESEARCH
  // ============================================================
  if (companyInsights) {
    prompt += `=== COMPANY RESEARCH & INTERVIEW INSIGHTS ===\n`;
    prompt += `Industry: ${companyInsights.industry || 'Not specified'}\n`;
    prompt += `Culture: ${companyInsights.culture || 'Not specified'}\n`;
    prompt += `Values: ${companyInsights.values?.join(', ') || 'Not specified'}\n`;
    prompt += `Interview Philosophy: ${companyInsights.interview_philosophy || 'Not specified'}\n`;
    prompt += `Recent Hiring Trends: ${companyInsights.recent_hiring_trends || 'Not specified'}\n\n`;
    
    // Detailed interview stages
    if (companyInsights.interview_stages?.length > 0) {
      prompt += `INTERVIEW PROCESS (from actual candidate reports):\n`;
      companyInsights.interview_stages.forEach((stage: any) => {
        prompt += `\nStage ${stage.order_index}: ${stage.name}\n`;
        prompt += `  Duration: ${stage.duration || 'Not specified'}\n`;
        prompt += `  Interviewer: ${stage.interviewer || 'Not specified'}\n`;
        prompt += `  What to Expect: ${stage.content || 'Not specified'}\n`;
        if (stage.common_questions?.length > 0) {
          prompt += `  Common Questions in This Stage:\n`;
          stage.common_questions.forEach((q: string) => {
            prompt += `    - "${q}"\n`;
          });
        }
        if (stage.success_tips?.length > 0) {
          prompt += `  Success Tips:\n`;
          stage.success_tips.forEach((tip: string) => {
            prompt += `    - ${tip}\n`;
          });
        }
        if (stage.difficulty_level) {
          prompt += `  Difficulty: ${stage.difficulty_level}\n`;
        }
      });
      prompt += `\n`;
    }
    
    // Interview experiences
    if (companyInsights.interview_experiences) {
      const exp = companyInsights.interview_experiences;
      prompt += `INTERVIEW EXPERIENCES FROM CANDIDATES:\n`;
      if (exp.difficulty_rating) {
        prompt += `Difficulty Rating: ${exp.difficulty_rating}\n`;
      }
      if (exp.process_duration) {
        prompt += `Typical Process Duration: ${exp.process_duration}\n`;
      }
      if (exp.positive_feedback?.length > 0) {
        prompt += `Positive Feedback Themes:\n`;
        exp.positive_feedback.forEach((fb: string) => {
          prompt += `  - ${fb}\n`;
        });
      }
      if (exp.negative_feedback?.length > 0) {
        prompt += `Common Challenges:\n`;
        exp.negative_feedback.forEach((fb: string) => {
          prompt += `  - ${fb}\n`;
        });
      }
      if (exp.common_themes?.length > 0) {
        prompt += `Recurring Themes:\n`;
        exp.common_themes.forEach((theme: string) => {
          prompt += `  - ${theme}\n`;
        });
      }
      prompt += `\n`;
    }
    
    // Hiring manager insights
    if (companyInsights.hiring_manager_insights) {
      const hm = companyInsights.hiring_manager_insights;
      prompt += `HIRING MANAGER INSIGHTS:\n`;
      if (hm.what_they_look_for?.length > 0) {
        prompt += `What They Look For:\n`;
        hm.what_they_look_for.forEach((item: string) => {
          prompt += `  - ${item}\n`;
        });
      }
      if (hm.success_factors?.length > 0) {
        prompt += `Success Factors:\n`;
        hm.success_factors.forEach((factor: string) => {
          prompt += `  - ${factor}\n`;
        });
      }
      if (hm.red_flags?.length > 0) {
        prompt += `Red Flags (Avoid These):\n`;
        hm.red_flags.forEach((flag: string) => {
          prompt += `  - ${flag}\n`;
        });
      }
      prompt += `\n`;
    }
  }

  // ============================================================
  // SECTION 3: DETAILED JOB REQUIREMENTS
  // ============================================================
  if (jobRequirements) {
    prompt += `=== JOB REQUIREMENTS & RESPONSIBILITIES ===\n`;
    if (jobRequirements.experience_level) {
      prompt += `Required Experience Level: ${jobRequirements.experience_level}\n`;
    }
    
    if (jobRequirements.technical_skills?.length > 0) {
      prompt += `\nTechnical Skills Required:\n`;
      jobRequirements.technical_skills.forEach((skill: string) => {
        prompt += `  - ${skill}\n`;
      });
    }
    
    if (jobRequirements.soft_skills?.length > 0) {
      prompt += `\nSoft Skills Required:\n`;
      jobRequirements.soft_skills.forEach((skill: string) => {
        prompt += `  - ${skill}\n`;
      });
    }
    
    if (jobRequirements.responsibilities?.length > 0) {
      prompt += `\nKey Responsibilities:\n`;
      jobRequirements.responsibilities.forEach((resp: string) => {
        prompt += `  - ${resp}\n`;
      });
    }
    
    if (jobRequirements.qualifications?.length > 0) {
      prompt += `\nRequired Qualifications:\n`;
      jobRequirements.qualifications.forEach((qual: string) => {
        prompt += `  - ${qual}\n`;
      });
    }
    
    if (jobRequirements.nice_to_have?.length > 0) {
      prompt += `\nNice to Have:\n`;
      jobRequirements.nice_to_have.forEach((item: string) => {
        prompt += `  - ${item}\n`;
      });
    }
    
    if (jobRequirements.interview_process_hints?.length > 0) {
      prompt += `\nInterview Process Hints from Job Posting:\n`;
      jobRequirements.interview_process_hints.forEach((hint: string) => {
        prompt += `  - ${hint}\n`;
      });
    }
    
    prompt += `\n`;
  }

  // ============================================================
  // SECTION 4: DETAILED CANDIDATE PROFILE
  // ============================================================
  if (cvAnalysis) {
    const analysisData = cvAnalysis.aiAnalysis || cvAnalysis;
    prompt += `=== CANDIDATE PROFILE (TAILOR QUESTIONS TO THIS BACKGROUND) ===\n`;
    prompt += `Current Role: ${analysisData.current_role || 'Not specified'}\n`;
    prompt += `Total Experience: ${analysisData.experience_years || 0} years\n`;
    prompt += `Target Seniority Level: ${targetSeniority || 'mid'}\n\n`;
    
    // Full work history
    if (analysisData.experience?.length > 0) {
      prompt += `WORK HISTORY:\n`;
      analysisData.experience.forEach((exp: any, idx: number) => {
        prompt += `${idx + 1}. ${exp.role} at ${exp.company} (${exp.duration || 'Duration not specified'})\n`;
        if (exp.achievements?.length > 0) {
          prompt += `   Key Achievements:\n`;
          exp.achievements.forEach((ach: string) => {
            prompt += `     - ${ach}\n`;
          });
        }
      });
      prompt += `\n`;
    }
    
    // Technical skills breakdown
    if (analysisData.skills) {
      if (analysisData.skills.technical?.length > 0) {
        prompt += `TECHNICAL SKILLS:\n`;
        analysisData.skills.technical.forEach((skill: string) => {
          prompt += `  - ${skill}\n`;
        });
        prompt += `\n`;
      }
      
      if (analysisData.skills.soft?.length > 0) {
        prompt += `SOFT SKILLS:\n`;
        analysisData.skills.soft.forEach((skill: string) => {
          prompt += `  - ${skill}\n`;
        });
        prompt += `\n`;
      }
      
      if (analysisData.skills.certifications?.length > 0) {
        prompt += `CERTIFICATIONS:\n`;
        analysisData.skills.certifications.forEach((cert: string) => {
          prompt += `  - ${cert}\n`;
        });
        prompt += `\n`;
      }
    }
    
    // Projects
    if (analysisData.projects?.length > 0) {
      prompt += `NOTABLE PROJECTS:\n`;
      analysisData.projects.forEach((project: string, idx: number) => {
        prompt += `${idx + 1}. ${project}\n`;
      });
      prompt += `\n`;
    }
    
    // Key achievements
    if (analysisData.key_achievements?.length > 0) {
      prompt += `KEY ACHIEVEMENTS:\n`;
      analysisData.key_achievements.forEach((ach: string, idx: number) => {
        prompt += `${idx + 1}. ${ach}\n`;
      });
      prompt += `\n`;
    }
    
    // Education
    if (analysisData.education) {
      prompt += `EDUCATION:\n`;
      prompt += `  Degree: ${analysisData.education.degree || 'Not specified'}\n`;
      prompt += `  Institution: ${analysisData.education.institution || 'Not specified'}\n`;
      if (analysisData.education.graduation_year) {
        prompt += `  Graduation Year: ${analysisData.education.graduation_year}\n`;
      }
      prompt += `\n`;
    }
    
    prompt += `CRITICAL: Generate questions that reference specific experiences, projects, and achievements from this candidate's background.\n\n`;
  }

  // ============================================================
  // SECTION 5: SYNTHESIS INSTRUCTIONS
  // ============================================================
  prompt += `=== SYNTHESIS REQUIREMENTS ===\n`;
  prompt += `CRITICAL: QUALITY OVER QUANTITY - Generate fewer but HIGHLY TAILORED questions\n`;
  prompt += `1. Use the REAL interview questions above as the foundation - generate tailored variations and extensions\n`;
  prompt += `2. Tailor EVERY question to the candidate's specific background (work history, projects, achievements)\n`;
  prompt += `3. Align EVERY question with the specific job responsibilities and requirements\n`;
  prompt += `4. Reference company culture, values, and interview philosophy in EVERY question\n`;
  prompt += `5. Generate 5-8 questions per category (30-50 total) - focus on QUALITY and TAILORING\n`;
  prompt += `6. Ensure 100% of questions reference specific company/job/CV details (NO generic questions)\n`;
  prompt += `7. Match question complexity to ${targetSeniority || 'mid'}-level candidate\n`;
  prompt += `8. Include rationale explaining why each question would be asked at ${company} (reference specific details)\n`;
  prompt += `9. Provide company-specific context for each question (must include specific company information)\n`;
  prompt += `10. Map candidate's experiences to potential STAR stories for behavioral questions\n`;
  prompt += `11. NO GENERIC QUESTIONS: Every question must be unique and reference specific details from the context\n\n`;

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
    throw error;
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
          .update({
            company_research_raw: rawData.company_research_raw,
            job_analysis_raw: rawData.job_analysis_raw,
            cv_analysis_raw: rawData.cv_analysis_raw,
            processing_status: 'raw_data_saved',
            processing_raw_save_at: new Date().toISOString()
          })
          .eq('search_id', searchId)
          .select();

        if (error) throw error;
        return data;
      },
      'Update raw data in search_artifacts'
    );

    if (!rawSaveResult || rawSaveResult.length === 0) {
      console.warn("⚠️ Raw data update touched no rows, attempting insert fallback...");
      await withDbTimeout(
        async () => {
          const { error } = await supabase
            .from('search_artifacts')
            .insert({
              search_id: searchId,
              user_id: userId,
              company_research_raw: rawData.company_research_raw,
              job_analysis_raw: rawData.job_analysis_raw,
              cv_analysis_raw: rawData.cv_analysis_raw,
              interview_stages: synthesis.interview_stages || [],
              processing_status: 'raw_data_saved',
              processing_raw_save_at: new Date().toISOString()
            });

          if (error) throw error;
          return true;
        },
        'Insert raw data fallback'
      );
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
    const stageRecords = await withDbTimeout(
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

        if (stagesToInsert.length === 0) return [];

        const { data, error } = await supabase
          .from('interview_stages')
          .insert(stagesToInsert)
          .select();

        if (error) throw error;
        return data;
      },
      'Insert interview stages'
    );

    const stageIdByOrder: Record<number, string> = {};
    (stageRecords || []).forEach((stage: any) => {
      if (stage.order_index) stageIdByOrder[stage.order_index] = stage.id;
    });

    console.log(`✅ Interview stages saved (${(stageRecords || []).length})`);

    // CHECKPOINT 4: Insert interview questions
    console.log("  → Saving interview questions...");
    
    // Calculate total questions count before insertion
    let totalQuestionsCount = 0;
    if (synthesis.interview_questions_data) {
      Object.values(synthesis.interview_questions_data).forEach((questions: any) => {
        if (Array.isArray(questions)) {
          totalQuestionsCount += questions.length;
        }
      });
    }
    
    await withDbTimeout(
      async () => {
        if (!stageRecords || stageRecords.length === 0) {
          throw new Error("No interview stages were inserted; cannot attach questions");
        }

        const questionsToInsert: any[] = [];

        const getStageIdForCategory = (category: string) => {
          if (stageIdByOrder[1] && ['behavioral', 'cultural_fit'].includes(category)) return stageIdByOrder[1];
          if (stageIdByOrder[2] && ['technical', 'role_specific'].includes(category)) return stageIdByOrder[2];
          if (stageIdByOrder[3] && ['situational', 'experience_based'].includes(category)) return stageIdByOrder[3];
          if (stageIdByOrder[4]) return stageIdByOrder[4];
          return Object.values(stageIdByOrder)[0] || null;
        };

        const normalizeDifficulty = (difficulty?: string) => {
          if (!difficulty) return 'Medium';
          const d = difficulty.toLowerCase();
          if (d === 'easy' || d === 'medium' || d === 'hard') {
            return d.charAt(0).toUpperCase() + d.slice(1);
          }
          return 'Medium';
        };

        if (synthesis.interview_questions_data) {
          // Log question counts before inserting
          const questionCounts: Record<string, number> = {};
          Object.entries(synthesis.interview_questions_data).forEach(([category, questions]: [string, any]) => {
            questionCounts[category] = Array.isArray(questions) ? questions.length : 0;
          });
          const totalQuestions = Object.values(questionCounts).reduce((sum, count) => sum + count, 0);
          console.log(`📝 Preparing to insert ${totalQuestions} questions:`, questionCounts);
          
          Object.entries(synthesis.interview_questions_data).forEach(([category, questions]: [string, any]) => {
            if (Array.isArray(questions)) {
              questions.forEach((q: any) => {
                const stageId = getStageIdForCategory(category);
                if (!stageId) {
                  throw new Error(`Missing stage_id when inserting questions for category ${category}`);
                }
                questionsToInsert.push({
                  search_id: searchId,
                  stage_id: stageId,
                  question: q.question,
                  category: category,
                  question_type: 'synthesized',
                  difficulty: normalizeDifficulty(q.difficulty),
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

    console.log(`✅ Interview questions saved: ${totalQuestionsCount} questions`);
    if (totalQuestionsCount < 20) {
      console.warn(`⚠️ WARNING: Only ${totalQuestionsCount} questions were saved. Expected 30-50 questions.`);
    }

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
  let logger: SearchLogger | null = null;

  try {
    const requestData: InterviewResearchRequest = await req.json();

    searchId = requestData.searchId;
    userId = requestData.userId;
    tracker.searchId = searchId;
    logger = new SearchLogger(searchId, "interview-research", userId);

    logger.log("REQUEST_RECEIVED", "INIT", {
      company: requestData.company,
      role: requestData.role,
      country: requestData.country,
      targetSeniority: requestData.targetSeniority,
      roleLinkCount: requestData.roleLinks?.length || 0,
    });

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
    logger?.log("PHASE_START", "DATA_GATHERING");
    await tracker.updateStep('DATA_GATHERING_START');

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
    logger?.log("PHASE_COMPLETE", "DATA_GATHERING", {
      hasCompanyInsights: !!companyInsights,
      hasJobRequirements: !!jobRequirements,
      hasCvAnalysis: !!cvAnalysis
    });
    await tracker.updateStep('DATA_GATHERING_COMPLETE');

    // ============================================================
    // Save raw data immediately to search_artifacts
    // ============================================================

    console.log("\n💾 PHASE 2: Saving raw research data...");
    logger?.log("PHASE_START", "RAW_DATA_SAVE");

    const rawData: RawResearchData = {
      company_research_raw: companyInsights,
      job_analysis_raw: jobRequirements,
      cv_analysis_raw: cvAnalysis
    };

    await withDbTimeout(
      async () => {
        const { error } = await supabase
          .from('search_artifacts')
          .upsert({
            search_id: searchId,
            user_id: userId,
            ...rawData,
            interview_stages: [],
            processing_status: 'raw_data_saved',
            processing_started_at: new Date().toISOString(),
            processing_raw_save_at: new Date().toISOString()
          }, { onConflict: 'search_id' });

        if (error) {
          console.warn("⚠️ Failed to save raw data:", error.message);
          return null;
        }
        return true;
      },
      'Save raw data'
    );

    console.log("✅ Raw data saved to database");
    logger?.log("PHASE_COMPLETE", "RAW_DATA_SAVE");

    // ============================================================
    // PHASE 3: Unified Synthesis (20-30 seconds)
    // ============================================================

    console.log("\n🔄 PHASE 3: Unified synthesis...");
    logger?.log("PHASE_START", "UNIFIED_SYNTHESIS");
    await tracker.updateStep('AI_SYNTHESIS_START');

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
      logger?.log("PHASE_FAILED", "UNIFIED_SYNTHESIS", null, "Synthesis returned null");
      throw new Error("Synthesis failed");
    }

    console.log("✅ PHASE 3 Complete");
    logger?.log("PHASE_COMPLETE", "UNIFIED_SYNTHESIS", {
      stageCount: synthesis.interview_stages?.length || 0,
      questionCategories: Object.keys(synthesis.interview_questions_data || {})
    });
    await tracker.updateStep('AI_SYNTHESIS_COMPLETE');

    // ============================================================
    // PHASE 4: Save all results to database
    // ============================================================

    console.log("\n💾 PHASE 4: Saving all results to database...");
    logger?.log("PHASE_START", "DATABASE_SAVE");
    await tracker.updateStep('QUESTION_GENERATION_START');

    await saveToDatabase(supabase, searchId, userId, rawData, synthesis);

    console.log("✅ PHASE 4 Complete");
    logger?.log("PHASE_COMPLETE", "DATABASE_SAVE");
    await tracker.updateStep('QUESTION_GENERATION_COMPLETE');

    // ============================================================
    // Success response
    // ============================================================

    console.log(`\n✅ Interview research complete for search: ${searchId}`);
    logger?.log("FUNCTION_SUCCESS", "COMPLETE");

    await tracker.markCompleted();

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
    logger?.log(
      "FUNCTION_ERROR",
      "GLOBAL",
      null,
      error instanceof Error ? error.message : String(error)
    );

    if (searchId && userId) {
      // Mark search as failed in database
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      );

      try {
        await supabase
          .from('searches')
          .update({
            search_status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', searchId);
      } catch (markError) {
        console.error("Failed to mark search as failed:", markError);
      }
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
  } finally {
    if (logger) {
      try {
        await logger.saveToFile();
      } catch (logError) {
        console.error("Failed to persist search logger output:", logError);
      }
    }
  }
});
