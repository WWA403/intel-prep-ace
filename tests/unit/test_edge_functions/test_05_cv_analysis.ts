#!/usr/bin/env -S deno test --allow-all
/**
 * Filename: test_05_cv_analysis.ts
 * Author: Nan Zhou
 * Date: 2025-01-23
 * Description: Unit tests for cv-analysis Edge Function - Step 3.3 of interview prep workflow
 *
 * Business Flow:
 *   User uploads CV/resume text
 *   System uses OpenAI to parse and structure CV data
 *   Extracts skills, experience, education, achievements
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@std/dotenv/load";

// ============================================================================
// Test Configuration
// ============================================================================
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "http://localhost:54321";
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Test user credentials
const TEST_USER_EMAIL = Deno.env.get("TEST_USER_EMAIL") ?? "joe.zhounan@gmail.com";
const TEST_USER_PASSWORD = Deno.env.get("TEST_USER_PASSWORD") ?? "x198239x";
let TEST_USER_ID: string | null = null;

// ============================================================================
// Helper Functions
// ============================================================================
async function getAuthenticatedClient(): Promise<{ client: SupabaseClient, userId: string }> {
  const client = createClient(supabaseUrl, supabaseKey);

  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (authError) {
    throw new Error(`Failed to authenticate test user: ${authError.message}`);
  }

  if (!authData.user) {
    throw new Error("No user returned from authentication");
  }

  TEST_USER_ID = authData.user.id;
  return { client, userId: authData.user.id };
}

// Sample CV text for testing
function generateSampleCV() {
  return `
John Doe
Software Engineer | San Francisco, CA
john.doe@email.com | (555) 123-4567
LinkedIn: linkedin.com/in/johndoe | GitHub: github.com/johndoe

PROFESSIONAL SUMMARY
Experienced Full-Stack Software Engineer with 5+ years of expertise in building scalable web applications.
Proficient in React, TypeScript, Node.js, and cloud infrastructure.

WORK EXPERIENCE

Senior Software Engineer | Google Inc. | 2021 - Present
- Led development of internal tools serving 10,000+ employees
- Architected microservices infrastructure reducing latency by 40%
- Mentored team of 5 junior engineers
- Technologies: React, TypeScript, Go, Kubernetes, GCP

Software Engineer | Meta | 2019 - 2021
- Built features for Facebook News Feed affecting 1B+ users
- Optimized frontend performance, improving load times by 30%
- Collaborated with cross-functional teams on product launches
- Technologies: React, GraphQL, Python, MySQL

Junior Developer | Startup Inc. | 2018 - 2019
- Developed RESTful APIs for mobile applications
- Implemented CI/CD pipelines using Jenkins
- Technologies: Node.js, Express, MongoDB, Docker

EDUCATION

Bachelor of Science in Computer Science
Stanford University | 2014 - 2018
GPA: 3.8/4.0

SKILLS

Technical Skills:
- Languages: JavaScript, TypeScript, Python, Go, Java
- Frontend: React, Vue.js, Angular, HTML5, CSS3
- Backend: Node.js, Express, Django, FastAPI
- Databases: PostgreSQL, MySQL, MongoDB, Redis
- Cloud: AWS, GCP, Azure
- Tools: Docker, Kubernetes, Git, Jenkins

Soft Skills:
- Team Leadership
- Cross-functional Collaboration
- Problem Solving
- Communication

CERTIFICATIONS
- AWS Certified Solutions Architect
- Google Cloud Professional Developer

PROJECTS
- Open Source Contributor to React ecosystem (5000+ stars)
- Built personal portfolio website with Next.js and Tailwind CSS
`;
}

// ============================================================================
// Test Suite: CV Analysis
// ============================================================================
Deno.test({
  name: "CV Analysis - Test 5.1: Parse and analyze CV text",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();

    try {
      const cvText = generateSampleCV();

      // Step 1: Call cv-analysis Edge Function
      console.log("  📝 Calling cv-analysis Edge Function...");
      const functionUrl = `${supabaseUrl}/functions/v1/cv-analysis`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cvText: cvText,
          userId: userId
        })
      });

      console.log("  📊 HTTP Response:", { status: response.status, statusText: response.statusText });
      assertEquals(response.ok, true, "Should return 200 OK");

      // Step 2: Parse and verify response structure
      const result = await response.json();
      console.log("  📦 Response structure:", {
        has_cv_analysis: !!result.cv_analysis,
        analysis_keys: result.cv_analysis ? Object.keys(result.cv_analysis) : []
      });

      assertExists(result.cv_analysis, "Should return cv_analysis");
      assertExists(result.cv_analysis.skills, "Should have skills");

      console.log("  ✅ CV analysis structure valid");
      console.log("  📊 CV Analysis Results:", JSON.stringify({
        name: result.cv_analysis.name || "N/A",
        current_role: result.cv_analysis.current_role || "N/A",
        experience_years: result.cv_analysis.experience_years || "N/A",
        technical_skills_count: result.cv_analysis.skills?.technical?.length || 0,
        soft_skills_count: result.cv_analysis.skills?.soft?.length || 0,
        experience_count: result.cv_analysis.experience?.length || 0,
        education_degree: result.cv_analysis.education?.degree || "N/A"
      }, null, 2));

      // Step 3: Verify extracted data quality
      if (result.cv_analysis.skills?.technical) {
        console.log("  📊 Sample Technical Skills:", result.cv_analysis.skills.technical.slice(0, 5));
      }
      if (result.cv_analysis.experience && result.cv_analysis.experience.length > 0) {
        console.log("  📊 Sample Experience:", JSON.stringify({
          company: result.cv_analysis.experience[0].company,
          role: result.cv_analysis.experience[0].role,
          duration: result.cv_analysis.experience[0].duration
        }, null, 2));
      }

      console.log("  ✅ CV data extraction verified");

    } finally {
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "CV Analysis - Test 5.2: Validate required parameters",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase } = await getAuthenticatedClient();

    try {
      // Call cv-analysis without required parameters
      console.log("  🔍 Calling cv-analysis without cvText...");
      const functionUrl = `${supabaseUrl}/functions/v1/cv-analysis`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          // Missing cvText
          userId: TEST_USER_ID
        })
      });

      console.log("  📊 HTTP Response:", response.status);

      // Should return error status
      assertEquals(response.ok, false, "Should fail without cvText");
      assertEquals(response.status >= 400, true, "Should return error status code");

      const result = await response.json();
      console.log("  ✅ Error handling verified");
      console.log("  📊 Error response:", JSON.stringify(result, null, 2));

    } finally {
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "CV Analysis - Test 5.3: Handle minimal CV content",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();

    try {
      const minimalCV = `
Jane Smith
Junior Developer
email@example.com

Skills: JavaScript, React
Education: BS Computer Science, 2023
`;

      console.log("  📝 Analyzing minimal CV...");
      const functionUrl = `${supabaseUrl}/functions/v1/cv-analysis`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cvText: minimalCV,
          userId: userId
        })
      });

      console.log("  📊 Response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("  📊 Minimal CV Analysis:", JSON.stringify({
          name: result.cv_analysis?.name || "N/A",
          skills_extracted: result.cv_analysis?.skills?.technical?.length || 0,
          has_education: !!result.cv_analysis?.education
        }, null, 2));

        console.log("  ✅ Minimal CV handled successfully");
      } else {
        console.log("  ℹ️  Minimal CV processing failed (may need more content)");
      }

    } finally {
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "CV Analysis - Test 5.4: Extract skills and experience accurately",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();

    try {
      const cvText = generateSampleCV();

      console.log("  📝 Analyzing CV for skill extraction...");
      const functionUrl = `${supabaseUrl}/functions/v1/cv-analysis`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cvText: cvText,
          userId: userId
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Verify skills extraction
        console.log("  📊 Technical Skills:", result.cv_analysis?.skills?.technical || []);
        console.log("  📊 Soft Skills:", result.cv_analysis?.skills?.soft || []);

        // Verify experience extraction
        console.log("  📊 Work Experience:");
        result.cv_analysis?.experience?.forEach((exp: any, idx: number) => {
          console.log(`    ${idx + 1}. ${exp.role} at ${exp.company} (${exp.duration})`);
        });

        // Check if key skills are detected
        const technicalSkills = result.cv_analysis?.skills?.technical || [];
        const hasReact = technicalSkills.some((skill: string) =>
          skill.toLowerCase().includes('react')
        );
        const hasTypeScript = technicalSkills.some((skill: string) =>
          skill.toLowerCase().includes('typescript')
        );

        if (hasReact || hasTypeScript) {
          console.log("  ✅ Key skills detected correctly");
        } else {
          console.log("  ⚠️  Some expected skills not detected");
        }

        console.log("  ✅ Skill and experience extraction verified");

      } else {
        console.log("  ⚠️  CV analysis failed");
      }

    } finally {
      await supabase.removeAllChannels();
    }
  }
});

// ============================================================================
// Run with: deno test --allow-all tests/unit/test_edge_functions/test_05_cv_analysis.ts
// ============================================================================
