import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";
import { RESEARCH_CONFIG, getOpenAIModel, getMaxTokens, getTemperature } from "../_shared/config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CVJobComparisonRequest {
  searchId: string;
  userId: string;
  cvAnalysis: any;
  jobRequirements: any;
  companyInsights: any;
}

interface SkillGapAnalysis {
  matching_skills: {
    technical: string[];
    soft: string[];
    certifications: string[];
  };
  missing_skills: {
    technical: string[];
    soft: string[];
    certifications: string[];
  };
  transferable_skills: {
    skill: string;
    relevance: string;
    how_to_position: string;
  }[];
  skill_match_percentage: {
    technical: number;
    soft: number;
    overall: number;
  };
}

interface ExperienceGapAnalysis {
  relevant_experience: {
    experience: string;
    relevance_score: number;
    how_to_highlight: string;
  }[];
  missing_experience: {
    requirement: string;
    severity: string;
    mitigation_strategy: string;
  }[];
  experience_level_match: {
    required_years: number;
    candidate_years: number;
    level_match: string;
    gap_analysis: string;
  };
}

interface PersonalizedStoryBank {
  stories: {
    situation: string;
    task: string;
    action: string;
    result: string;
    applicable_questions: string[];
    impact_quantified: string;
  }[];
  achievement_highlights: {
    achievement: string;
    quantified_impact: string;
    relevance_to_role: string;
    story_angle: string;
  }[];
}

interface InterviewPrepStrategy {
  strengths_to_emphasize: {
    strength: string;
    supporting_evidence: string;
    how_to_present: string;
  }[];
  weaknesses_to_address: {
    weakness: string;
    mitigation_strategy: string;
    improvement_plan: string;
  }[];
  competitive_positioning: {
    unique_value_proposition: string;
    differentiation_points: string[];
    positioning_strategy: string;
  };
  question_preparation_matrix: {
    question_type: string;
    priority: string;
    preparation_approach: string;
    sample_questions: string[];
  }[];
}

interface CVJobComparisonOutput {
  skill_gap_analysis: SkillGapAnalysis;
  experience_gap_analysis: ExperienceGapAnalysis;
  personalized_story_bank: PersonalizedStoryBank;
  interview_prep_strategy: InterviewPrepStrategy;
  overall_fit_score: number;
  preparation_priorities: string[];
}

// AI-powered CV vs Job comparison and strategy generation
async function generateCVJobComparison(
  cvAnalysis: any,
  jobRequirements: any,
  companyInsights: any,
  openaiApiKey: string
): Promise<CVJobComparisonOutput> {
  
  let comparisonContext = "CV vs Job Requirements Analysis:\n\n";
  
  // Build CV context
  if (cvAnalysis) {
    comparisonContext += `CANDIDATE PROFILE:\n`;
    comparisonContext += `Current Role: ${cvAnalysis.current_role || 'Not specified'}\n`;
    comparisonContext += `Experience: ${cvAnalysis.experience_years || 'Not specified'} years\n`;
    comparisonContext += `Technical Skills: ${cvAnalysis.skills?.technical?.join(', ') || 'None listed'}\n`;
    comparisonContext += `Soft Skills: ${cvAnalysis.skills?.soft?.join(', ') || 'None listed'}\n`;
    comparisonContext += `Key Achievements: ${cvAnalysis.key_achievements?.join(', ') || 'None listed'}\n`;
    comparisonContext += `Experience History: ${cvAnalysis.experience?.map(exp => `${exp.role} at ${exp.company} (${exp.duration}): ${exp.achievements.join(', ')}`).join('; ') || 'None provided'}\n\n`;
  }
  
  // Build job requirements context
  if (jobRequirements) {
    comparisonContext += `JOB REQUIREMENTS:\n`;
    comparisonContext += `Technical Skills Required: ${jobRequirements.technical_skills?.join(', ') || 'None specified'}\n`;
    comparisonContext += `Soft Skills Required: ${jobRequirements.soft_skills?.join(', ') || 'None specified'}\n`;
    comparisonContext += `Experience Level: ${jobRequirements.experience_level || 'Not specified'}\n`;
    comparisonContext += `Key Responsibilities: ${jobRequirements.responsibilities?.join(', ') || 'None specified'}\n`;
    comparisonContext += `Qualifications: ${jobRequirements.qualifications?.join(', ') || 'None specified'}\n`;
    comparisonContext += `Nice to Have: ${jobRequirements.nice_to_have?.join(', ') || 'None specified'}\n\n`;
  }
  
  // Build company insights context
  if (companyInsights) {
    comparisonContext += `COMPANY INSIGHTS:\n`;
    comparisonContext += `Interview Philosophy: ${companyInsights.interview_philosophy || 'Not available'}\n`;
    comparisonContext += `What They Look For: ${companyInsights.hiring_manager_insights?.what_they_look_for?.join(', ') || 'Not available'}\n`;
    comparisonContext += `Red Flags: ${companyInsights.hiring_manager_insights?.red_flags?.join(', ') || 'Not available'}\n`;
    comparisonContext += `Success Factors: ${companyInsights.hiring_manager_insights?.success_factors?.join(', ') || 'Not available'}\n\n`;
  }

  const model = getOpenAIModel('cvJobComparison');
  const maxTokens = getMaxTokens('cvJobComparison');
  const temperature = getTemperature('comparison');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert career coach and interview preparation specialist. Analyze the CV against job requirements and company insights to create a comprehensive interview preparation strategy.

Focus on:
1. Detailed skill gap analysis with specific recommendations
2. Experience matching and positioning strategies
3. Personalized STAR stories based on candidate's background
4. Strategic interview preparation tailored to the company's preferences
5. Competitive positioning and unique value proposition

Return ONLY valid JSON - no markdown code blocks, no text before or after the JSON:

{
  "skill_gap_analysis": {
    "matching_skills": {
      "technical": ["array of matching technical skills"],
      "soft": ["array of matching soft skills"],
      "certifications": ["array of matching certifications"]
    },
    "missing_skills": {
      "technical": ["array of missing technical skills"],
      "soft": ["array of missing soft skills"],
      "certifications": ["array of missing certifications"]
    },
    "transferable_skills": [
      {
        "skill": "skill name",
        "relevance": "how it relates to job",
        "how_to_position": "how to present it"
      }
    ],
    "skill_match_percentage": {
      "technical": number,
      "soft": number,
      "overall": number
    }
  },
  "experience_gap_analysis": {
    "relevant_experience": [
      {
        "experience": "specific experience",
        "relevance_score": number,
        "how_to_highlight": "positioning strategy"
      }
    ],
    "missing_experience": [
      {
        "requirement": "missing requirement",
        "severity": "Low/Medium/High",
        "mitigation_strategy": "how to address"
      }
    ],
    "experience_level_match": {
      "required_years": number,
      "candidate_years": number,
      "level_match": "Under/Match/Over qualified",
      "gap_analysis": "detailed analysis"
    }
  },
  "personalized_story_bank": {
    "stories": [
      {
        "situation": "situation description",
        "task": "task description",
        "action": "action taken",
        "result": "result achieved",
        "applicable_questions": ["questions this story can answer"],
        "impact_quantified": "quantified impact"
      }
    ],
    "achievement_highlights": [
      {
        "achievement": "specific achievement",
        "quantified_impact": "measurable impact",
        "relevance_to_role": "how it relates",
        "story_angle": "how to present"
      }
    ]
  },
  "interview_prep_strategy": {
    "strengths_to_emphasize": [
      {
        "strength": "specific strength",
        "supporting_evidence": "evidence from CV",
        "how_to_present": "presentation strategy"
      }
    ],
    "weaknesses_to_address": [
      {
        "weakness": "specific weakness",
        "mitigation_strategy": "how to address",
        "improvement_plan": "development plan"
      }
    ],
    "competitive_positioning": {
      "unique_value_proposition": "what makes candidate unique",
      "differentiation_points": ["array of differentiators"],
      "positioning_strategy": "overall positioning approach"
    },
    "question_preparation_matrix": [
      {
        "question_type": "type of question",
        "priority": "High/Medium/Low",
        "preparation_approach": "how to prepare",
        "sample_questions": ["sample questions"]
      }
    ]
  },
  "overall_fit_score": number,
  "preparation_priorities": ["array of preparation priorities"]
}`
        },
        {
          role: 'user',
          content: `Analyze this CV against job requirements and company insights to create a comprehensive interview preparation strategy:\n\n${comparisonContext}`
        }
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    throw new Error(`CV-Job comparison failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  let analysisResult = data.choices[0].message.content;

  try {
    // Clean markdown code blocks if present (OpenAI sometimes wraps JSON in ```json ... ```)
    analysisResult = analysisResult.trim();
    if (analysisResult.startsWith('```json')) {
      analysisResult = analysisResult.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
    } else if (analysisResult.startsWith('```')) {
      analysisResult = analysisResult.replace(/^```\n/, '').replace(/\n```$/, '').trim();
    }

    return JSON.parse(analysisResult);
  } catch (parseError) {
    console.error("Failed to parse CV-Job comparison JSON:", parseError);
    console.error("Raw response (first 500 chars):", analysisResult.substring(0, 500));
    
    // Return fallback structure with proper object/array types
    return {
      skill_gap_analysis: {
        matching_skills: { technical: [], soft: [], certifications: [] },
        missing_skills: { technical: [], soft: [], certifications: [] },
        transferable_skills: [
          // Ensure proper structure for frontend: array of objects with skill, relevance, how_to_position
        ],
        skill_match_percentage: { technical: 0, soft: 0, overall: 0 }
      },
      experience_gap_analysis: {
        relevant_experience: [],
        missing_experience: [],
        experience_level_match: {
          required_years: 0,
          candidate_years: 0,
          level_match: "Unknown",
          gap_analysis: "Analysis not available"
        }
      },
      personalized_story_bank: {
        stories: [],
        achievement_highlights: []
      },
      interview_prep_strategy: {
        strengths_to_emphasize: [],
        weaknesses_to_address: [],
        competitive_positioning: {
          unique_value_proposition: "Analysis not available",
          differentiation_points: [],
          positioning_strategy: "Strategy not available"
        },
        question_preparation_matrix: []
      },
      overall_fit_score: 0,
      preparation_priorities: []
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchId, userId, cvAnalysis, jobRequirements, companyInsights } = await req.json() as CVJobComparisonRequest;

    if (!searchId || !userId) {
      throw new Error("Missing required parameters: searchId and userId");
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("Missing OpenAI API key");
    }

    console.log("Starting CV-Job comparison for search:", searchId);

    // Generate comprehensive comparison and strategy
    const comparisonResult = await generateCVJobComparison(
      cvAnalysis,
      jobRequirements,
      companyInsights,
      openaiApiKey
    );

    console.log("CV-Job comparison completed successfully");

    return new Response(
      JSON.stringify({ 
        status: "success", 
        message: "CV-Job comparison completed",
        comparison_result: comparisonResult,
        overall_fit_score: comparisonResult.overall_fit_score,
        preparation_priorities: comparisonResult.preparation_priorities
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error processing CV-Job comparison:", error);

    return new Response(
      JSON.stringify({ 
        status: "error", 
        message: error.message || "Failed to process CV-Job comparison"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});