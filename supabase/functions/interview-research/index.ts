import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";
import { SearchLogger } from "../_shared/logger.ts";
import { RESEARCH_CONFIG } from "../_shared/config.ts";
import { ProgressTracker, PROGRESS_STEPS, CONCURRENT_TIMEOUTS, executeWithTimeout, executeWithTimeoutSafe, isValidData, validateFetchResponse } from "../_shared/progress-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SynthesisRequest {
  company: string;
  role?: string;
  country?: string;
  roleLinks?: string[];
  cv?: string;
  targetSeniority?: 'junior' | 'mid' | 'senior';
  userId: string;
  searchId: string;
}

// Interfaces for final outputs that users see
interface CompanyInsights {
  name: string;
  industry: string;
  culture: string;
  values: string[];
  interview_philosophy: string;
  recent_hiring_trends: string;
  interview_stages?: InterviewStageStructured[];
  interview_experiences: {
    positive_feedback: string[];
    negative_feedback: string[];
    common_themes: string[];
    difficulty_rating: string;
    process_duration: string;
  };
  interview_questions_bank: {
    behavioral: string[];
    technical: string[];
    situational: string[];
    company_specific: string[];
  };
  hiring_manager_insights: {
    what_they_look_for: string[];
    red_flags: string[];
    success_factors: string[];
  };
}

interface InterviewStageStructured {
  name: string;
  order_index: number;
  duration: string;
  interviewer: string;
  content: string;
  guidance: string;
  preparation_tips: string[];
  common_questions: string[];
  red_flags_to_avoid: string[];
}

interface PersonalizedGuidance {
  strengths_to_highlight: string[];
  areas_to_improve: string[];
  suggested_stories: string[];
  skill_gaps: string[];
  competitive_advantages: string[];
}

interface AIResearchOutput {
  company_insights: CompanyInsights;
  interview_stages: InterviewStageStructured[];
  personalized_guidance: PersonalizedGuidance;
  preparation_timeline: {
    weeks_before: string[];
    week_before: string[];
    day_before: string[];
    day_of: string[];
  };
  cv_job_comparison: any;
  enhanced_question_bank: any;
  preparation_priorities: string[];
}

// Call other microservices for data gathering with timeout handling and validation
async function gatherCompanyData(company: string, role?: string, country?: string, searchId?: string) {
  try {
    console.log("Calling company-research function...");

    // Set a timeout for the company research call (using updated CONCURRENT_TIMEOUTS)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONCURRENT_TIMEOUTS.companyResearch);

    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/company-research`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        company,
        role,
        country,
        searchId
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      const companyInsights = result.company_insights;

      // Validate we got actual data, not empty response
      if (isValidData(companyInsights)) {
        console.log("✓ Company research returned valid data");
        return companyInsights;
      } else {
        console.warn("Company research returned empty data");
        return null;
      }
    }

    console.warn(`Company research failed with status ${response.status}, continuing without data`);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`Company research timed out after ${CONCURRENT_TIMEOUTS.companyResearch}ms, continuing without data`);
    } else {
      console.error("Error calling company-research:", error);
    }
    return null;
  }
}

async function gatherJobData(roleLinks: string[], searchId: string, company?: string, role?: string) {
  if (!roleLinks || roleLinks.length === 0) {
    console.log("No role links provided, skipping job analysis");
    return null;
  }

  try {
    console.log("Calling job-analysis function...");

    // Set a timeout for the job analysis call (using updated CONCURRENT_TIMEOUTS)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONCURRENT_TIMEOUTS.jobAnalysis);

    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/job-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        roleLinks,
        searchId,
        company,
        role
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      const jobRequirements = result.job_requirements;

      // Validate we got actual data, not empty response
      if (isValidData(jobRequirements)) {
        console.log("✓ Job analysis returned valid data");
        return jobRequirements;
      } else {
        console.warn("Job analysis returned empty data");
        return null;
      }
    }

    console.warn(`Job analysis failed with status ${response.status}, continuing without data`);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`Job analysis timed out after ${CONCURRENT_TIMEOUTS.jobAnalysis}ms, continuing without data`);
    } else {
      console.error("Error calling job-analysis:", error);
    }
    return null;
  }
}

async function gatherCVData(cv: string, userId: string) {
  if (!cv) {
    console.log("No CV provided, skipping CV analysis");
    return null;
  }

  try {
    console.log("Calling cv-analysis function...");

    // Set a timeout for the CV analysis call (using updated CONCURRENT_TIMEOUTS)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONCURRENT_TIMEOUTS.cvAnalysis);

    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/cv-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        cvText: cv,
        userId
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();

      // Validate we got actual data, not empty response
      if (isValidData(result)) {
        console.log("✓ CV analysis returned valid data");
        return result; // Return the full result with both aiAnalysis and parsedData
      } else {
        console.warn("CV analysis returned empty data");
        return null;
      }
    }

    console.warn(`CV analysis failed with status ${response.status}, continuing without data`);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`CV analysis timed out after ${CONCURRENT_TIMEOUTS.cvAnalysis}ms, continuing without data`);
    } else {
      console.error("Error calling cv-analysis:", error);
    }
    return null;
  }
}

async function generateCVJobComparison(
  searchId: string,
  userId: string,
  cvAnalysis: any,
  jobRequirements: any,
  companyInsights: any
) {
  if (!cvAnalysis || !jobRequirements) {
    console.log("Insufficient data for CV-Job comparison");
    return null;
  }

  try {
    console.log("Calling cv-job-comparison function...");
    
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/cv-job-comparison`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        searchId,
        userId,
        cvAnalysis,
        jobRequirements,
        companyInsights
      }),
    });

    if (response.ok) {
      const result = await response.json();
      return result.comparison_result;
    }
    
    console.warn("CV-Job comparison failed, continuing without data");
    return null;
  } catch (error) {
    console.error("Error calling cv-job-comparison:", error);
    return null;
  }
}

async function generateEnhancedQuestions(
  searchId: string,
  userId: string,
  companyInsights: any,
  jobRequirements: any,
  cvAnalysis: any,
  interviewStages: any[],
  targetSeniority?: 'junior' | 'mid' | 'senior'
) {
  try {
    console.log("Calling interview-question-generator function...");
    
    const questionPromises = interviewStages.map(async (stage) => {
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/interview-question-generator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          searchId,
          userId,
          companyInsights,
          jobRequirements,
          cvAnalysis,
          interviewStage: stage.name,
          stageDetails: stage,
          targetSeniority
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return { stage: stage.name, questions: result.question_bank };
      }
      return null;
    });

    const results = await Promise.all(questionPromises);
    return results.filter(r => r !== null);
  } catch (error) {
    console.error("Error calling interview-question-generator:", error);
    return [];
  }
}

// Main AI synthesis function - generates all final user outputs
async function conductInterviewSynthesis(
  company: string, 
  role: string | undefined, 
  country: string | undefined,
  companyInsights: any,
  jobRequirements: any,
  cvAnalysis: any,
  openaiApiKey: string
): Promise<AIResearchOutput> {
  
  // Build comprehensive context from all gathered data
  let synthesisContext = `Company: ${company}`;
  if (role) synthesisContext += `\nRole: ${role}`;
  if (country) synthesisContext += `\nCountry: ${country}`;
  
  if (companyInsights) {
    synthesisContext += `\n\nCompany Insights:\n`;
    synthesisContext += `Industry: ${companyInsights.industry}\n`;
    synthesisContext += `Culture: ${companyInsights.culture}\n`;
    synthesisContext += `Values: ${companyInsights.values?.join(', ')}\n`;
    synthesisContext += `Interview Philosophy: ${companyInsights.interview_philosophy}\n`;
    synthesisContext += `Hiring Trends: ${companyInsights.recent_hiring_trends}\n`;
    
    // Include interview stages if available from company research
    if (companyInsights.interview_stages && companyInsights.interview_stages.length > 0) {
      synthesisContext += `\nInterview Stages (from candidate reports):\n`;
      companyInsights.interview_stages.forEach((stage: any, index: number) => {
        synthesisContext += `Stage ${index + 1}: ${stage.name}\n`;
        synthesisContext += `Duration: ${stage.duration}\n`;
        synthesisContext += `Interviewer: ${stage.interviewer}\n`;
        synthesisContext += `Content: ${stage.content}\n`;
        if (stage.common_questions && stage.common_questions.length > 0) {
          synthesisContext += `Common Questions: ${stage.common_questions.join(', ')}\n`;
        }
        if (stage.success_tips && stage.success_tips.length > 0) {
          synthesisContext += `Success Tips: ${stage.success_tips.join(', ')}\n`;
        }
        synthesisContext += `\n`;
      });
    }
  }
  
  if (jobRequirements) {
    synthesisContext += `\n\nJob Requirements:\n`;
    synthesisContext += `Technical Skills: ${jobRequirements.technical_skills?.join(', ')}\n`;
    synthesisContext += `Soft Skills: ${jobRequirements.soft_skills?.join(', ')}\n`;
    synthesisContext += `Experience Level: ${jobRequirements.experience_level}\n`;
    synthesisContext += `Responsibilities: ${jobRequirements.responsibilities?.join(', ')}\n`;
    synthesisContext += `Qualifications: ${jobRequirements.qualifications?.join(', ')}\n`;
  }
  
  if (cvAnalysis) {
    // Use aiAnalysis for processing context (raw data structure)
    const analysisData = cvAnalysis.aiAnalysis || cvAnalysis;
    synthesisContext += `\n\nCandidate Profile:\n`;
    synthesisContext += `Current Role: ${analysisData.current_role || 'Not specified'}\n`;
    synthesisContext += `Experience: ${analysisData.experience_years || 'Not specified'} years\n`;
    synthesisContext += `Technical Skills: ${analysisData.skills?.technical?.join(', ')}\n`;
    synthesisContext += `Key Achievements: ${analysisData.key_achievements?.join(', ')}\n`;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: RESEARCH_CONFIG.openai.model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'system',
          content: `You are an expert interview preparation consultant with deep knowledge of hiring practices across major companies. 

Based on the provided research context, create a comprehensive, personalized interview preparation guide. Use the interview stages from company research if available, otherwise create appropriate stages.

CRITICAL REQUIREMENTS:
1. Use interview stages from company research data if provided
2. Generate personalized guidance based on candidate's CV and job requirements
3. Create SPECIFIC, actionable interview questions - NO generic placeholders like "coding problem", "behavioural question", "solve this", etc.
4. Create specific preparation strategies that align with company culture and values
5. Provide actionable timeline for interview preparation

FORBIDDEN: Do NOT use generic placeholders in questions. Every question must be specific and actionable.
EXAMPLES OF BAD QUESTIONS: "Solve this coding problem", "Tell me about a behavioural question", "Explain your approach"
EXAMPLES OF GOOD QUESTIONS: "How would you design a real-time notification system for 1M users?", "Describe a time when you had to refactor legacy code while maintaining backward compatibility"

You MUST return ONLY valid JSON in this exact structure - no markdown, no additional text:

{
  "company_insights": {
    "name": "string",
    "industry": "string", 
    "culture": "string",
    "values": ["array of company values"],
    "interview_philosophy": "string",
    "recent_hiring_trends": "string"
  },
  "interview_stages": [
    {
      "name": "string",
      "order_index": number,
      "duration": "string",
      "interviewer": "string", 
      "content": "string",
      "guidance": "string",
      "preparation_tips": ["array of specific tips"],
      "common_questions": ["array of 4-6 questions"],
      "red_flags_to_avoid": ["array of things to avoid"]
    }
  ],
  "personalized_guidance": {
    "strengths_to_highlight": ["array based on candidate profile"],
    "areas_to_improve": ["array of improvement areas"],
    "suggested_stories": ["array of stories to prepare"],
    "skill_gaps": ["array of gaps to address"],
    "competitive_advantages": ["array of advantages"]
  },
  "preparation_timeline": {
    "weeks_before": ["array of tasks"],
    "week_before": ["array of tasks"],
    "day_before": ["array of tasks"], 
    "day_of": ["array of tasks"]
  }
}`
        },
        {
          role: 'user',
          content: `Based on this research context, create a comprehensive interview preparation guide:\n\n${synthesisContext}`
        }
      ],
      max_tokens: RESEARCH_CONFIG.openai.maxTokens.interviewSynthesis,
      temperature: RESEARCH_CONFIG.openai.temperature.synthesis,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    throw new Error(`AI synthesis failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const synthesisResult = data.choices[0].message.content;
  
  try {
    const parsedResult = JSON.parse(synthesisResult);
    
    // Validate that we have quality content, not generic fallbacks
    if (parsedResult.interview_stages?.some((stage: any) => 
      stage.common_questions?.some((q: string) => 
        q.includes("coding problem") || q.includes("behavioural question") || q.toLowerCase().includes("solve this")
      )
    )) {
      console.warn("AI returned generic placeholder questions, marking for improvement");
    }
    
    // Use interview stages from company research if available
    if (companyInsights?.interview_stages && companyInsights.interview_stages.length > 0) {
      parsedResult.interview_stages = companyInsights.interview_stages.map((stage: any, index: number) => ({
        name: stage.name,
        order_index: stage.order_index || index + 1,
        duration: stage.duration,
        interviewer: stage.interviewer,
        content: stage.content,
        guidance: `Based on candidate reports: ${stage.content}`,
        preparation_tips: stage.success_tips || [],
        common_questions: stage.common_questions || [],
        red_flags_to_avoid: []
      }));
    }
    
    return parsedResult;
  } catch (parseError) {
    console.error("Failed to parse AI synthesis JSON:", parseError);
    console.error("Raw response:", synthesisResult);
    console.log("Attempting to create enhanced fallback structure with available data...");
    
    // Return fallback structure with basic interview stages
    return {
      company_insights: {
        name: company,
        industry: "Unknown",
        culture: "Research in progress",
        values: [],
        interview_philosophy: "Standard interview process",
        recent_hiring_trends: "Information not available"
      },
      interview_stages: [
        {
          name: "Initial Phone/Video Screening",
          order_index: 1,
          duration: "30-45 minutes",
          interviewer: "HR Recruiter or Talent Acquisition",
          content: "Resume review, basic qualifications check, and cultural fit assessment",
          guidance: "Prepare your elevator pitch, research the company thoroughly, and be ready to discuss your career motivations",
          preparation_tips: ["Practice 2-minute elevator pitch", "Research company mission and values", "Prepare 3-5 STAR stories", "Review job description thoroughly"],
          common_questions: ["Tell me about yourself", "Why are you interested in this role?", "Why this company?", "Walk me through your resume", "What are your salary expectations?"],
          red_flags_to_avoid: ["Lack of company knowledge", "Unclear career goals", "Negative comments about previous employers", "Unrealistic salary expectations"]
        },
        {
          name: "Technical Assessment",
          order_index: 2,
          duration: "60-90 minutes",
          interviewer: "Senior Developer or Technical Lead",
          content: "Technical skills evaluation, coding challenges, and problem-solving assessment",
          guidance: "Review core technical concepts, practice coding problems, and prepare to explain your thought process clearly",
          preparation_tips: ["Practice coding problems on relevant platforms", "Review system design concepts", "Prepare technical questions to ask", "Practice explaining code verbally"],
          common_questions: [
            "Walk me through how you would design a scalable web application",
            "What's your experience with [relevant technology from job description]?",
            "How do you approach debugging a complex production issue?",
            "Describe a time when you had to optimize slow-performing code",
            "What are the trade-offs between different database types for this use case?",
            "How do you ensure code quality in a team environment?"
          ],
          red_flags_to_avoid: ["Unable to explain reasoning", "Poor coding practices", "Giving up too quickly on problems", "Not asking clarifying questions"]
        },
        {
          name: "Team/Behavioral Interview",
          order_index: 3,
          duration: "45-60 minutes",
          interviewer: "Hiring Manager and/or Team Members",
          content: "Behavioral questions, team fit assessment, and leadership scenarios",
          guidance: "Focus on demonstrating collaboration skills, leadership experience, and alignment with team culture",
          preparation_tips: ["Prepare detailed STAR stories for each core competency", "Research team structure and dynamics", "Think of examples showing leadership and collaboration", "Prepare thoughtful questions about team processes"],
          common_questions: [
            "Tell me about a time you had to collaborate with a difficult team member",
            "Describe a situation where you had to adapt to significant changes",
            "How do you prioritize tasks when everything seems urgent?",
            "Give me an example of when you took initiative on a project",
            "Tell me about a time when you had to learn a new technology quickly",
            "Describe a situation where you had to give constructive feedback to a colleague"
          ],
          red_flags_to_avoid: ["Inability to give specific examples", "Blaming others for failures", "Showing poor communication skills", "Lack of self-awareness"]
        },
        {
          name: "Final Round/Executive Interview",
          order_index: 4,
          duration: "30-45 minutes",
          interviewer: "Senior Manager or Director",
          content: "Strategic thinking, long-term vision, and final cultural fit assessment",
          guidance: "Demonstrate strategic thinking, show understanding of business context, and articulate your long-term career vision",
          preparation_tips: ["Research company strategy and industry trends", "Prepare vision for role and career growth", "Think about strategic challenges the company faces", "Prepare executive-level questions"],
          common_questions: [
            "How do you see this role evolving in the next 2-3 years?",
            "What would you accomplish in your first 90 days in this position?",
            "How do you balance innovation with maintaining existing systems?",
            "What questions do you have about our company's strategic direction?",
            "How do you stay updated with industry trends and best practices?",
            "What do you think are the biggest challenges facing our industry right now?"
          ],
          red_flags_to_avoid: ["Lack of strategic thinking", "No questions for interviewer", "Unclear long-term goals", "Insufficient business awareness"]
        }
      ],
      personalized_guidance: {
        strengths_to_highlight: [],
        areas_to_improve: [],
        suggested_stories: [],
        skill_gaps: [],
        competitive_advantages: []
      },
      preparation_timeline: {
        weeks_before: ["Research company and role"],
        week_before: ["Practice common questions"],
        day_before: ["Review notes"],
        day_of: ["Arrive early"]
      }
    };
  }
}

// Helper functions for dynamic question analysis and categorization
function categorizeQuestion(question: string, stageName: string): string {
  const questionLower = question.toLowerCase();
  
  // Behavioral indicators
  if (questionLower.includes('tell me about') || questionLower.includes('describe a time') || 
      questionLower.includes('give me an example') || questionLower.includes('walk me through')) {
    return 'behavioral';
  }
  
  // Technical indicators
  if (questionLower.includes('algorithm') || questionLower.includes('code') || questionLower.includes('system design') ||
      questionLower.includes('technical') || questionLower.includes('programming') || questionLower.includes('database')) {
    return 'technical';
  }
  
  // Company-specific indicators
  if (questionLower.includes('company') || questionLower.includes('culture') || questionLower.includes('values') ||
      questionLower.includes('why us') || questionLower.includes('why here')) {
    return 'company_specific';
  }
  
  // Situational indicators
  if (questionLower.includes('what would you do') || questionLower.includes('how would you handle') ||
      questionLower.includes('if you were') || questionLower.includes('scenario')) {
    return 'situational';
  }
  
  // Role-specific based on stage
  if (stageName.toLowerCase().includes('technical') || stageName.toLowerCase().includes('coding')) {
    return 'technical';
  }
  
  return 'general';
}

function determineDifficulty(question: any, jobRequirements: any, cvAnalysis: any): string {
  // If question already has difficulty, use it
  if (question.difficulty && question.difficulty !== 'Medium') {
    return question.difficulty;
  }
  
  // Determine from job requirements
  if (jobRequirements?.experience_level) {
    const expLevel = jobRequirements.experience_level.toLowerCase();
    if (expLevel.includes('senior') || expLevel.includes('lead') || expLevel.includes('principal')) {
      return 'Hard';
    }
    if (expLevel.includes('junior') || expLevel.includes('entry')) {
      return 'Easy';
    }
  }
  
  // Determine from CV analysis
  if (cvAnalysis?.aiAnalysis?.experience_years || cvAnalysis?.experience_years) {
    const years = cvAnalysis.aiAnalysis?.experience_years || cvAnalysis.experience_years;
    if (years >= 8) return 'Hard';
    if (years <= 2) return 'Easy';
  }
  
  return 'Medium';
}

function determineDifficultyFromContext(question: string, jobRequirements: any, cvAnalysis: any, stageName: string): string {
  const questionLower = question.toLowerCase();
  
  // Technical questions are generally harder
  if (questionLower.includes('system design') || questionLower.includes('architecture')) {
    return 'Hard';
  }
  
  // Basic behavioral questions
  if (questionLower.includes('tell me about yourself')) {
    return 'Easy';
  }
  
  // Use job requirements and CV analysis
  return determineDifficulty({ difficulty: null }, jobRequirements, cvAnalysis);
}

function generateAnswerApproach(question: string, category: string): string {
  const questionLower = question.toLowerCase();
  
  if (category === 'behavioral') {
    return 'Use the STAR method (Situation, Task, Action, Result) to structure your response with specific examples from your experience';
  }
  
  if (category === 'technical') {
    if (questionLower.includes('system design')) {
      return 'Start with requirements gathering, then discuss high-level architecture, dive into components, and address scalability concerns';
    }
    return 'Explain your thought process clearly, discuss trade-offs, and provide concrete examples or pseudocode when relevant';
  }
  
  if (category === 'company_specific') {
    return 'Demonstrate knowledge of the company\'s values, recent developments, and how your goals align with their mission';
  }
  
  if (category === 'situational') {
    return 'Outline your problem-solving approach, consider multiple perspectives, and explain your reasoning for the chosen solution';
  }
  
  return 'Provide a clear, structured response with specific examples that demonstrate your relevant skills and experience';
}

function generateEvaluationCriteria(category: string, companyInsights: any, jobRequirements: any): string[] {
  const baseCriteria = ['Clarity of communication', 'Relevance to role'];
  
  if (category === 'behavioral') {
    return [...baseCriteria, 'Specific examples provided', 'Leadership and problem-solving skills', 'Self-awareness and growth mindset'];
  }
  
  if (category === 'technical') {
    return [...baseCriteria, 'Technical accuracy', 'Problem-solving approach', 'Code quality and best practices', 'System thinking'];
  }
  
  if (category === 'company_specific') {
    const culturalFit = companyInsights?.values?.length > 0 ? 'Alignment with company values' : 'Cultural fit assessment';
    return [...baseCriteria, 'Company knowledge', culturalFit, 'Genuine interest in role'];
  }
  
  if (category === 'situational') {
    return [...baseCriteria, 'Critical thinking', 'Decision-making process', 'Consideration of stakeholders'];
  }
  
  return [...baseCriteria, 'Confidence', 'Professional experience'];
}

function isStarStoryFit(question: string): boolean {
  const questionLower = question.toLowerCase();
  const starIndicators = [
    'tell me about', 'describe a time', 'give me an example', 'walk me through',
    'when have you', 'how did you handle', 'share an experience'
  ];
  
  return starIndicators.some(indicator => questionLower.includes(indicator));
}

function generateCompanyContext(question: string, company: string, role: string, companyInsights: any): string {
  const category = categorizeQuestion(question, '');
  
  if (category === 'company_specific' && companyInsights?.culture) {
    return `This question assesses fit with ${company}'s culture: ${companyInsights.culture}`;
  }
  
  if (category === 'technical' && role) {
    return `Technical question relevant to ${role} position at ${company}`;
  }
  
  if (category === 'behavioral') {
    const values = companyInsights?.values?.length > 0 ? 
      ` Values they look for: ${companyInsights.values.slice(0, 3).join(', ')}` : '';
    return `Behavioral question for ${company} interview.${values}`;
  }
  
  return `Standard interview question for ${role || 'this position'} at ${company}`;
}

function calculateConfidenceScore(question: any, companyInsights: any, category: string): number {
  let score = 0.6; // Base score
  
  // Higher confidence for questions with research backing
  if (question.rationale && question.rationale.length > 50) {
    score += 0.2;
  }
  
  // Company-specific questions with insights get higher score
  if (category === 'company_specific' && companyInsights?.interview_questions_bank) {
    score += 0.15;
  }
  
  // Technical questions from comprehensive analysis
  if (category === 'technical' && question.suggested_answer_approach) {
    score += 0.1;
  }
  
  return Math.min(0.95, score);
}

function calculateStageQuestionConfidence(question: string, companyInsights: any, stageName: string): number {
  let score = 0.6; // Base score for stage questions
  
  // Higher confidence if we have company insights
  if (companyInsights?.interview_stages?.length > 0) {
    score += 0.15;
  }
  
  // Standard questions get reasonable confidence
  const questionLower = question.toLowerCase();
  if (questionLower.includes('tell me about yourself') || questionLower.includes('why this company')) {
    score += 0.1;
  }
  
  return Math.min(0.85, score);
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company, role, country, roleLinks, cv, targetSeniority, userId, searchId } = await req.json() as SynthesisRequest;

    // Validate required fields
    if (!company || !userId || !searchId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: company, userId, searchId' }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Start background processing immediately (true fire-and-forget)
    // Do NOT await anything before returning response
    processResearchAsync(company, role, country, roleLinks, cv, targetSeniority, userId, searchId)
      .catch((error) => {
        console.error('Background processing failed:', error);
        // Error handling happens inside processResearchAsync
      });

    // Return immediate response (202 Accepted) - no database operations before this!
    return new Response(
      JSON.stringify({
        searchId,
        status: 'accepted',
        message: 'Research request accepted and processing started',
        estimatedTime: '20-30 seconds'
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error parsing request:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request format' }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Background processing function for async job execution
 * Implements concurrent processing pattern for optimal performance
 */
async function processResearchAsync(
  company: string,
  role: string | undefined,
  country: string | undefined,
  roleLinks: string[] | undefined,
  cv: string | undefined,
  targetSeniority: 'junior' | 'mid' | 'senior' | undefined,
  userId: string,
  searchId: string
) {
  // Initialize progress tracker inside async function (not in main handler)
  const tracker = new ProgressTracker(searchId);

  try {
    // Initialize tracker and logger
    await tracker.updateStep('INITIALIZING');

    const logger = new SearchLogger(searchId, 'interview-research', userId);
    logger.log('REQUEST_INPUT', 'VALIDATION', { company, role, country, roleLinks: roleLinks?.length, hasCv: !!cv, userId });

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("Missing OpenAI API key");
    }

    console.log("Starting concurrent research for", company, role || "");
    logger.log('STEP_START', 'CONCURRENT_PROCESSING', { step: 1, description: 'Starting concurrent data gathering' });
    
    // Step 1: Execute all research operations concurrently with soft-fail and partial progress handling
    await tracker.updateStep('COMPANY_RESEARCH_START');
    await tracker.updateStep('JOB_ANALYSIS_START');
    await tracker.updateStep('CV_ANALYSIS_START');

    const [companyRes, jobRes, cvRes] = await Promise.allSettled([
      executeWithTimeoutSafe(() => gatherCompanyData(company, role, country, searchId), CONCURRENT_TIMEOUTS.companyResearch),
      executeWithTimeoutSafe(() => gatherJobData(roleLinks || [], searchId, company, role), CONCURRENT_TIMEOUTS.jobAnalysis),
      executeWithTimeoutSafe(() => gatherCVData(cv || "", userId), CONCURRENT_TIMEOUTS.cvAnalysis),
    ]);

    let companyInsights: any = null;
    if (companyRes.status === 'fulfilled' && companyRes.value.ok) {
      companyInsights = companyRes.value.value;
      await tracker.updateStep('COMPANY_RESEARCH_COMPLETE');
    } else {
      await tracker.updateStep('COMPANY_RESEARCH_PARTIAL', 'Company research timed out, continuing with available data');
    }

    let jobRequirements: any = null;
    if (jobRes.status === 'fulfilled' && jobRes.value.ok) {
      jobRequirements = jobRes.value.value;
      await tracker.updateStep('JOB_ANALYSIS_COMPLETE');
    } else {
      await tracker.updateStep('JOB_ANALYSIS_PARTIAL', 'Job analysis timed out, continuing with available data');
    }

    let cvAnalysis: any = null;
    if (cvRes.status === 'fulfilled' && cvRes.value.ok) {
      cvAnalysis = cvRes.value.value;
      await tracker.updateStep('CV_ANALYSIS_COMPLETE');
    } else {
      await tracker.updateStep('CV_ANALYSIS_PARTIAL', 'CV analysis timed out, continuing with available data');
    }
    
    logger.log('DATA_GATHERING_COMPLETE', 'CONCURRENT_SUCCESS', { 
      companyInsightsFound: !!companyInsights,
      jobRequirements: !!jobRequirements,
      cvAnalysisFound: !!cvAnalysis,
      companyInterviewStages: companyInsights?.interview_stages?.length || 0
    });

    // Step 2: Generate questions and conduct synthesis
    await tracker.updateStep('QUESTION_GENERATION_START');
    
    const synthesisResult = await executeWithTimeout(
      () => conductInterviewSynthesis(
        company, 
        role, 
        country, 
        companyInsights,
        jobRequirements,
        cvAnalysis,
        openaiApiKey
      ),
      CONCURRENT_TIMEOUTS.questionGeneration,
      'AI Synthesis',
      tracker
    );

    await tracker.updateStep('QUESTION_GENERATION_COMPLETE');

    // Step 3: Run comparison and question generation in parallel (optional enhancements)
    console.log("Generating enhanced analysis...");
    await tracker.updateStep('FINALIZING');
    
    const [cvJobComparison, enhancedQuestions] = await Promise.all([
      generateCVJobComparison(
        searchId,
        userId,
        cvAnalysis?.aiAnalysis || cvAnalysis,
        jobRequirements,
        companyInsights
      ),
      generateEnhancedQuestions(
        searchId,
        userId,
        companyInsights,
        jobRequirements,
        cvAnalysis?.aiAnalysis || cvAnalysis,
        synthesisResult.interview_stages,
        targetSeniority
      )
    ]);

    console.log("Storing final results...");

    // CHECKPOINT 1: Save interview stages immediately after synthesis
    console.log("💾 CHECKPOINT 1: Saving interview stages and questions...");

    // Step 5: Store interview stages and questions in database
    for (const stage of synthesisResult.interview_stages) {
      // Insert stage
      const { data: stageData, error: stageError } = await supabase
        .from("interview_stages")
        .insert({
          search_id: searchId,
          name: stage.name,
          duration: stage.duration,
          interviewer: stage.interviewer,
          content: stage.content,
          guidance: `${stage.guidance}\n\nPreparation Tips:\n${stage.preparation_tips.join('\n')}\n\nRed Flags to Avoid:\n${stage.red_flags_to_avoid.join('\n')}`,
          order_index: stage.order_index
        })
        .select()
        .single();
      
      if (stageError) throw stageError;
      
      // Insert enhanced questions for this stage with dynamic categorization
      const questionsToInsert = stage.common_questions.map((question, index) => ({
        stage_id: stageData.id,
        search_id: searchId,
        question,
        category: categorizeQuestion(question, stage.name),
        question_type: 'common',
        difficulty: determineDifficultyFromContext(question, jobRequirements, cvAnalysis, stage.name),
        rationale: `${categorizeQuestion(question, stage.name)} question for ${stage.name} based on company research and industry standards`,
        suggested_answer_approach: generateAnswerApproach(question, categorizeQuestion(question, stage.name)),
        evaluation_criteria: generateEvaluationCriteria(categorizeQuestion(question, stage.name), companyInsights, jobRequirements),
        follow_up_questions: [],
        star_story_fit: isStarStoryFit(question),
        company_context: generateCompanyContext(question, company, role, companyInsights),
        confidence_score: calculateStageQuestionConfidence(question, companyInsights, stage.name)
      }));
      
      const { error: questionsError } = await supabase
        .from("interview_questions")
        .insert(questionsToInsert);
      
      if (questionsError) throw questionsError;
    }

    // CHECKPOINT 2: Save CV analysis immediately
    console.log("💾 CHECKPOINT 2: Saving CV analysis...");

    // Step 6: Save CV analysis if provided
    if (cv && cvAnalysis) {
      try {
        console.log("Saving CV analysis to resumes table...");
        console.log("CV Analysis structure:", Object.keys(cvAnalysis));
        
        const resumeData = {
          user_id: userId,
          search_id: searchId,
          content: cv,
          parsed_data: cvAnalysis.parsedData || cvAnalysis // Use parsedData if available, otherwise fallback to cvAnalysis
        };
        
        console.log("Resume data to save:", {
          user_id: userId,
          search_id: searchId,
          content_length: cv.length,
          has_parsed_data: !!(cvAnalysis.parsedData || cvAnalysis)
        });
        
        const { data: resumeResult, error: resumeError } = await supabase
          .from("resumes")
          .insert(resumeData)
          .select()
          .single();
          
        if (resumeError) {
          console.error("Error saving resume:", resumeError);
          throw resumeError;
        }
        
        console.log("Successfully saved resume with ID:", resumeResult.id);
        logger.log('CV_SAVED', 'DATABASE', { 
          resumeId: resumeResult.id,
          userId,
          searchId,
          hasStructuredData: !!resumeResult.full_name
        });
        
      } catch (error) {
        console.error("Failed to save CV analysis:", error);
        logger.log('CV_SAVE_ERROR', 'DATABASE', { error: error.message, userId, searchId });
        // Continue processing even if CV save fails
      }
    } else {
      console.log("Skipping CV save - cv:", !!cv, "cvAnalysis:", !!cvAnalysis);
    }

    // CHECKPOINT 3: Save enhanced analysis
    console.log("💾 CHECKPOINT 3: Saving enhanced analysis and comparisons...");

    // Step 7: Store enhanced question bank and comparison data
    if (cvJobComparison) {
      try {
        const { data, error } = await supabase
          .from("cv_job_comparisons")
          .upsert({
            search_id: searchId,
            user_id: userId,
            skill_gap_analysis: cvJobComparison.skill_gap_analysis,
            experience_gap_analysis: cvJobComparison.experience_gap_analysis,
            personalized_story_bank: cvJobComparison.personalized_story_bank,
            interview_prep_strategy: cvJobComparison.interview_prep_strategy,
            overall_fit_score: cvJobComparison.overall_fit_score,
            preparation_priorities: cvJobComparison.preparation_priorities
          }, {
            onConflict: 'search_id'
          });

        if (error) {
          console.error("❌ CV Job Comparison upsert error:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          throw error;
        }

        console.log("✅ Successfully saved CV job comparison");
      } catch (dbError) {
        console.error("Failed to save CV job comparison:", dbError);
        // Log but continue - comparison save failure shouldn't block completion
        logger.log('CV_COMPARISON_SAVE_ERROR', 'DATABASE', {
          error: dbError.message,
          userId,
          searchId
        });
      }
    }

    // Store enhanced questions in the consolidated interview_questions table
    if (enhancedQuestions && enhancedQuestions.length > 0) {
      for (const stageQuestions of enhancedQuestions) {
        try {
          // Get the stage_id for this stage name
          const { data: stage, error: stageError } = await supabase
            .from("interview_stages")
            .select("id")
            .eq("search_id", searchId)
            .eq("name", stageQuestions.stage)
            .single();

          if (stageError || !stage) {
            console.warn(`Stage not found for ${stageQuestions.stage}, skipping enhanced questions`);
            continue;
          }

          // Prepare all questions for batch insert
          const questionsToInsert = [];
          
          // Helper function to add questions from a category with dynamic values
          const addQuestionsFromCategory = (questions: any[], category: string) => {
            questions.forEach((q: any) => {
              questionsToInsert.push({
                stage_id: stage.id,
                search_id: searchId,
                question: q.question,
                category: category,
                question_type: q.type || category,
                difficulty: determineDifficulty(q, jobRequirements, cvAnalysis),
                rationale: q.rationale || `${category} question for ${stage.name} stage`,
                suggested_answer_approach: q.suggested_answer_approach || generateAnswerApproach(q.question, category),
                evaluation_criteria: q.evaluation_criteria || generateEvaluationCriteria(category, companyInsights, jobRequirements),
                follow_up_questions: q.follow_up_questions || [],
                star_story_fit: q.star_story_fit || isStarStoryFit(q.question),
                company_context: q.company_context || `${category} question for ${company} ${role || ''} interview`,
                confidence_score: calculateConfidenceScore(q, companyInsights, category)
              });
            });
          };

          // Add questions from all categories
          if (stageQuestions.questions.behavioral_questions) {
            addQuestionsFromCategory(stageQuestions.questions.behavioral_questions, 'behavioral');
          }
          if (stageQuestions.questions.technical_questions) {
            addQuestionsFromCategory(stageQuestions.questions.technical_questions, 'technical');
          }
          if (stageQuestions.questions.situational_questions) {
            addQuestionsFromCategory(stageQuestions.questions.situational_questions, 'situational');
          }
          if (stageQuestions.questions.company_specific_questions) {
            addQuestionsFromCategory(stageQuestions.questions.company_specific_questions, 'company_specific');
          }
          if (stageQuestions.questions.role_specific_questions) {
            addQuestionsFromCategory(stageQuestions.questions.role_specific_questions, 'role_specific');
          }
          if (stageQuestions.questions.experience_based_questions) {
            addQuestionsFromCategory(stageQuestions.questions.experience_based_questions, 'experience_based');
          }
          if (stageQuestions.questions.cultural_fit_questions) {
            addQuestionsFromCategory(stageQuestions.questions.cultural_fit_questions, 'cultural_fit');
          }

          // Batch insert all questions
          if (questionsToInsert.length > 0) {
            const { error: insertError } = await supabase
              .from("interview_questions")
              .insert(questionsToInsert);

            if (insertError) {
              console.warn(`Failed to save enhanced questions for stage ${stageQuestions.stage}:`, insertError);
            } else {
              console.log(`Saved ${questionsToInsert.length} enhanced questions for stage ${stageQuestions.stage}`);
            }
          }
        } catch (dbError) {
          console.warn(`Failed to save enhanced questions for stage ${stageQuestions.stage}:`, dbError);
        }
      }
    }

    // Step 8: Update search status to completed
    try {
      const { error: updateError } = await supabase
        .from("searches")
        .update({
          search_status: "completed",
          cv_job_comparison: cvJobComparison,
          preparation_priorities: cvJobComparison?.preparation_priorities || [],
          overall_fit_score: cvJobComparison?.overall_fit_score || 0
        })
        .eq("id", searchId);

      if (updateError) {
        console.error("❌ Status update error:", {
          code: updateError.code,
          message: updateError.message,
          details: updateError.details
        });
        throw updateError;
      }

      console.log("✅ Successfully updated search status to completed");
    } catch (updateError) {
      console.error("Failed to update search status:", updateError);
      // Even if status update fails, still mark as completed in progress tracker
      // so frontend knows research is done
    }

    // Mark research as completed
    await tracker.markCompleted('Research completed successfully!');
    
    logger.log('RESEARCH_COMPLETE', 'SUCCESS', { 
      totalQuestions: enhancedQuestions?.length || 0,
      processingTimeMs: Date.now() - (new Date().getTime())
    });
    
    console.log('✅ Research completed successfully for', company);

  } catch (error) {
    console.error('❌ Research processing failed:', error);
    await tracker.markFailed(error.message);
    throw error;
  }
}

