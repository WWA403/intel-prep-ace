import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";
import { getOpenAIModel } from "../_shared/config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuestionGenerationRequest {
  searchId: string;
  userId: string;
  companyInsights: any;
  jobRequirements: any;
  cvAnalysis: any;
  interviewStage: string;
  stageDetails: any;
  targetSeniority?: 'junior' | 'mid' | 'senior';
}

interface GeneratedQuestion {
  question: string;
  type: string;
  difficulty: string;
  rationale: string;
  suggested_answer_approach: string;
  evaluation_criteria: string[];
  follow_up_questions: string[];
  star_story_fit: boolean;
  company_context: string;
}

interface QuestionBank {
  behavioral_questions: GeneratedQuestion[];
  technical_questions: GeneratedQuestion[];
  situational_questions: GeneratedQuestion[];
  company_specific_questions: GeneratedQuestion[];
  role_specific_questions: GeneratedQuestion[];
  experience_based_questions: GeneratedQuestion[];
  cultural_fit_questions: GeneratedQuestion[];
}

// AI-powered interview question generation based on all gathered data
async function generateInterviewQuestions(
  companyInsights: any,
  jobRequirements: any,
  cvAnalysis: any,
  interviewStage: string,
  stageDetails: any,
  targetSeniority: 'junior' | 'mid' | 'senior' | undefined,
  openaiApiKey: string
): Promise<QuestionBank> {
  
  let questionContext = `Interview Question Generation Context:\n\n`;
  
  questionContext += `INTERVIEW STAGE: ${interviewStage}\n`;
  if (stageDetails) {
    questionContext += `Stage Details: ${JSON.stringify(stageDetails)}\n`;
  }
  
  // Build company context
  if (companyInsights) {
    questionContext += `\nCOMPANY INSIGHTS:\n`;
    questionContext += `Company: ${companyInsights.name}\n`;
    questionContext += `Industry: ${companyInsights.industry}\n`;
    questionContext += `Culture: ${companyInsights.culture}\n`;
    questionContext += `Values: ${companyInsights.values?.join(', ')}\n`;
    questionContext += `Interview Philosophy: ${companyInsights.interview_philosophy}\n`;
    
    if (companyInsights.interview_questions_bank) {
      questionContext += `\nACTUAL QUESTIONS FROM REVIEWS:\n`;
      questionContext += `Behavioral: ${companyInsights.interview_questions_bank.behavioral?.join(', ')}\n`;
      questionContext += `Technical: ${companyInsights.interview_questions_bank.technical?.join(', ')}\n`;
      questionContext += `Situational: ${companyInsights.interview_questions_bank.situational?.join(', ')}\n`;
      questionContext += `Company Specific: ${companyInsights.interview_questions_bank.company_specific?.join(', ')}\n`;
    }
    
    if (companyInsights.hiring_manager_insights) {
      questionContext += `\nHIRING MANAGER INSIGHTS:\n`;
      questionContext += `What They Look For: ${companyInsights.hiring_manager_insights.what_they_look_for?.join(', ')}\n`;
      questionContext += `Red Flags: ${companyInsights.hiring_manager_insights.red_flags?.join(', ')}\n`;
      questionContext += `Success Factors: ${companyInsights.hiring_manager_insights.success_factors?.join(', ')}\n`;
    }
  }
  
  // Build job requirements context
  if (jobRequirements) {
    questionContext += `\nJOB REQUIREMENTS:\n`;
    questionContext += `Technical Skills: ${jobRequirements.technical_skills?.join(', ')}\n`;
    questionContext += `Soft Skills: ${jobRequirements.soft_skills?.join(', ')}\n`;
    questionContext += `Experience Level: ${jobRequirements.experience_level}\n`;
    questionContext += `Key Responsibilities: ${jobRequirements.responsibilities?.join(', ')}\n`;
    questionContext += `Qualifications: ${jobRequirements.qualifications?.join(', ')}\n`;
    questionContext += `Interview Process Hints: ${jobRequirements.interview_process_hints?.join(', ')}\n`;
  }
  
  // Determine experience level with fallback logic:
  // 1. Use targetSeniority if provided (user's explicit choice)
  // 2. Fall back to CV-inferred level
  // 3. Default to 'mid' if neither exists
  let experienceLevel = 'mid'; // Default
  let experienceYears = 0;
  
  if (targetSeniority) {
    // User explicitly set target seniority - use it
    experienceLevel = targetSeniority;
    console.log(`Using user-specified target seniority: ${experienceLevel}`);
  } else if (cvAnalysis) {
    // Infer from CV experience
    experienceYears = cvAnalysis.experience_years || 0;
    if (experienceYears >= 8) experienceLevel = 'senior';
    else if (experienceYears >= 3) experienceLevel = 'mid';
    else experienceLevel = 'junior';
    console.log(`Inferred seniority from CV: ${experienceLevel} (${experienceYears} years)`);
  } else {
    console.log('No seniority information available, defaulting to mid-level');
  }
  
  // Build candidate context
  if (cvAnalysis) {
    questionContext += `\nCANDIDATE PROFILE:\n`;
    questionContext += `Current Role: ${cvAnalysis.current_role}\n`;
    questionContext += `Experience: ${experienceYears} years (${experienceLevel} level)\n`;
    questionContext += `Experience Level: ${experienceLevel.toUpperCase()} - Adjust question difficulty and quantity accordingly\n`;
    questionContext += `Technical Skills: ${cvAnalysis.skills?.technical?.join(', ')}\n`;
    questionContext += `Key Achievements: ${cvAnalysis.key_achievements?.join(', ')}\n`;
    questionContext += `Experience History: ${cvAnalysis.experience?.map(exp => `${exp.role} at ${exp.company}`).join(', ')}\n`;
  } else {
    questionContext += `\nCANDIDATE PROFILE:\n`;
    questionContext += `Experience Level: ${experienceLevel.toUpperCase()} - Adjust question difficulty and quantity accordingly\n`;
  }
  
  // Add specific guidance based on experience level - SAME VOLUME, DIFFERENT COMPLEXITY
  questionContext += `\nTARGET: Generate 18-22 questions per category for TOTAL 120-150 questions regardless of experience level.\n`;
  
  if (experienceLevel === 'junior') {
    questionContext += `\nFOCUS FOR JUNIOR CANDIDATE: Fundamentals, learning ability, potential, adaptability. Questions should focus on basic concepts, learning scenarios, and growth mindset.\n`;
  } else if (experienceLevel === 'mid') {
    questionContext += `\nFOCUS FOR MID-LEVEL CANDIDATE: Execution, problem-solving, leadership potential, project management. Questions should focus on project ownership, technical depth, and team collaboration.\n`;
  } else {
    questionContext += `\nFOCUS FOR SENIOR CANDIDATE: Strategic thinking, mentorship, complex problem-solving, system design, team leadership. Questions should focus on architecture, business impact, and organizational influence.\n`;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getOpenAIModel('questionGeneration'),
      messages: [
        {
          role: 'system',
          content: `You are an expert interview preparation specialist with deep knowledge of hiring practices across major companies. Generate comprehensive, realistic interview questions based on the provided context.

Focus on:
1. RESEARCH-FIRST APPROACH: Prioritize questions derived from actual company interview experiences and research
2. CONSISTENT VOLUME: Generate 18-22 questions per category (120-150 total) regardless of experience level
3. ADAPTIVE COMPLEXITY: Same volume but different complexity/focus based on candidate's experience level
4. COMPANY-SPECIFIC: At least 60% of questions must reference company-specific information, culture, or research findings
5. REAL QUESTIONS: Use actual questions from interview reviews when available, then generate variations
6. STAGE-APPROPRIATE: Questions must align with the specific interview stage and interviewer type
7. EXPERIENCE-MATCHED: Question complexity and focus must match candidate's experience level

MANDATORY REQUIREMENTS:
- TOTAL: 120-150 questions across all categories (consistent for all experience levels)
- RESEARCH INTEGRATION: Use actual questions from company research as foundation
- QUESTION DIVERSITY: Include situational, behavioral, technical, and company-specific variations
- COMPLEXITY ADAPTATION: Adjust question sophistication to match experience level, not quantity

For each question, provide:
- The specific question
- Question type and difficulty (adjust difficulty based on candidate experience)
- Rationale for why this question would be asked
- Suggested answer approach
- Evaluation criteria interviewers would use
- Potential follow-up questions
- Whether it's suitable for STAR method
- Company-specific context

CRITICAL REQUIREMENTS - STRICTLY ENFORCE:
- CONSISTENT VOLUME: Generate 18-22 questions per category for ALL experience levels (120-150 total)
- RESEARCH-DRIVEN: If company research contains actual interview questions, use them as foundation and generate variations
- EXPERIENCE ADAPTATION: Adjust question complexity and focus, NOT quantity:
  * Junior (0-2 years): Focus on fundamentals, learning scenarios, basic problem-solving
  * Mid-level (3-7 years): Focus on project ownership, technical depth, team collaboration  
  * Senior (8+ years): Focus on strategy, architecture, organizational impact
- COMPANY CONTEXT: 60%+ of questions must reference specific company information, culture, or research findings
- QUALITY DISTRIBUTION: 30% Easy, 50% Medium, 20% Hard (adjust complexity based on experience level)
- NO SHORTCUTS: Generate the full 120-150 questions with proper research integration

You MUST return ONLY valid JSON in this exact structure - no markdown, no additional text:

{
  "behavioral_questions": [
    {
      "question": "specific question",
      "type": "behavioral",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context"
    }
  ],
  "technical_questions": [
    {
      "question": "specific question",
      "type": "technical",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context"
    }
  ],
  "situational_questions": [
    {
      "question": "specific question",
      "type": "situational",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context"
    }
  ],
  "company_specific_questions": [
    {
      "question": "specific question",
      "type": "company_specific",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context"
    }
  ],
  "role_specific_questions": [
    {
      "question": "specific question",
      "type": "role_specific",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context"
    }
  ],
  "experience_based_questions": [
    {
      "question": "specific question",
      "type": "experience_based",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context"
    }
  ],
  "cultural_fit_questions": [
    {
      "question": "specific question",
      "type": "cultural_fit",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context"
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Generate comprehensive interview questions based on this context:\n\n${questionContext}`
        }
      ],
      max_tokens: 12000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Question generation failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const questionResult = data.choices[0].message.content;
  
  try {
    return JSON.parse(questionResult);
  } catch (parseError) {
    console.error("Failed to parse question generation JSON:", parseError);
    
    // Return fallback structure
    return {
      behavioral_questions: [],
      technical_questions: [],
      situational_questions: [],
      company_specific_questions: [],
      role_specific_questions: [],
      experience_based_questions: [],
      cultural_fit_questions: []
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchId, userId, companyInsights, jobRequirements, cvAnalysis, interviewStage, stageDetails, targetSeniority } = await req.json() as QuestionGenerationRequest;

    if (!searchId || !userId) {
      throw new Error("Missing required parameters: searchId and userId");
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("Missing OpenAI API key");
    }

    console.log("Starting interview question generation for search:", searchId, "stage:", interviewStage, "targetSeniority:", targetSeniority);

    // Generate comprehensive question bank
    const questionBank = await generateInterviewQuestions(
      companyInsights,
      jobRequirements,
      cvAnalysis,
      interviewStage,
      stageDetails,
      targetSeniority,
      openaiApiKey
    );

    console.log("Interview question generation completed successfully");

    return new Response(
      JSON.stringify({ 
        status: "success", 
        message: "Interview questions generated successfully",
        question_bank: questionBank,
        total_questions: Object.values(questionBank).reduce((sum, questions) => sum + questions.length, 0)
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error processing interview question generation:", error);

    return new Response(
      JSON.stringify({ 
        status: "error", 
        message: error.message || "Failed to generate interview questions"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});