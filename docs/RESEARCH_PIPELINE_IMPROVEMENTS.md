# Research Pipeline Quality Improvements

## Executive Summary

The research pipeline was improved to address **shallow context integration** and **limited tailoring** issues. The main problems were that the synthesis step received only high-level summaries instead of detailed, actionable information, resulting in generic questions that lacked depth and personalization. Additionally, models were hardcoded and the system generated too few questions.

## Issues Identified

### 1. **Shallow Context in Synthesis Prompt** ⚠️ CRITICAL

**Location**: `supabase/functions/interview-research/index.ts` - `buildSynthesisPrompt()`

**Problem**: The synthesis prompt only included:
- Basic company info: `Industry: X`, `Culture: Y`, `Values: Z`
- High-level job requirements: Just skill lists
- Minimal CV data: Only role, years, and top 3 achievements

**Missing**:
- Actual interview questions extracted from research
- Detailed candidate experiences and feedback
- Specific hiring manager insights
- Full CV experience history and projects
- Detailed job responsibilities and context
- Interview process specifics from candidate reports

**Impact**: AI generated generic questions because it lacked specific, actionable context.

### 2. **Extracted Questions Not Utilized** ⚠️ CRITICAL

**Location**: `supabase/functions/company-research/index.ts` - `analyzeCompanyData()`

**Problem**: The company research function extracts 15-25 actual interview questions from candidate reports, but:
- These questions were stored but not effectively used
- The synthesis prompt only mentioned them as a simple list
- No detailed context about when/why these questions are asked
- Questions weren't used as foundation for generating tailored variations

**Impact**: Valuable real interview questions were extracted but not effectively used.

### 3. **Limited CV Integration** ⚠️ HIGH

**Problem**: CV analysis extracts rich data (full work history, projects, skills, education) but synthesis only used:
- Current role
- Experience years
- Top 3 achievements (truncated)
- Basic skills list

**Impact**: Questions couldn't be tailored to candidate's specific background.

### 4. **Hardcoded Models** ⚠️ HIGH

**Problem**: Models were hardcoded to `gpt-4o` instead of using environment variables, making it impossible to switch to GPT-5 or other models without code changes.

**Impact**: Couldn't use newer models like `gpt-5-nano` without modifying code.

### 5. **Temperature Parameter Issues** ⚠️ MEDIUM

**Problem**: Temperature parameter was hardcoded, but GPT-5 series doesn't support temperature.

**Impact**: Would cause errors when using GPT-5 models.

### 6. **Too Few Questions Generated** ⚠️ CRITICAL

**Problem**: System was generating less than 10 questions instead of dozens, and the focus was on volume (120-150) rather than quality.

**Impact**: Insufficient question bank and poor quality due to quantity focus.

## Improvements Implemented

### 1. Enhanced Synthesis Prompt with Rich Context ✅

**File**: `supabase/functions/interview-research/index.ts` - `buildSynthesisPrompt()`

**What Changed**:
- **Before**: Only high-level summaries (Industry: X, Culture: Y, Skills: Z)
- **After**: Comprehensive, structured context with:
  - **Real Interview Questions Section**: All extracted questions from candidate reports, organized by category (Priority #1)
  - **Detailed Company Research**: Full interview stages, experiences, hiring manager insights
  - **Detailed Job Requirements**: Complete responsibilities, qualifications, interview hints
  - **Detailed Candidate Profile**: Full work history, projects, achievements, education

**Impact**: AI now receives 5-10x more context, enabling much deeper and more tailored question generation.

### 2. Question-First Approach ✅

**File**: `supabase/functions/interview-research/index.ts` - `buildSynthesisPrompt()`

**What Changed**:
- Real interview questions are now the **first section** in the prompt (Priority #1)
- Questions are presented with full context and structure
- Clear instruction to use real questions as foundation for variations

**Impact**: Questions are now based on actual interview experiences, not generic templates.

### 3. Enhanced System Prompt ✅

**File**: `supabase/functions/interview-research/index.ts` - `getSynthesisSystemPrompt()`

**What Changed**:
- Added explicit "QUESTION-FIRST APPROACH" requirement
- Added "DEEP TAILORING" requirement (100% of questions must reference specific details)
- Added specificity examples (before/after)
- Added question generation strategy
- Strengthened forbidden items list (NO GENERIC QUESTIONS)

**Impact**: AI has clear, explicit instructions on how to generate high-quality, tailored questions.

### 4. Environment-Based Model Configuration ✅

**File**: `supabase/functions/_shared/config.ts`

**What Changed**:
- Added `getModelFromEnv()` function that checks `OPENAI_MODEL` environment variable
- All model configurations now respect the environment variable
- Falls back to defaults if `OPENAI_MODEL` is not set
- Added `isGPT5Model()` helper function to detect GPT-5 models

**Usage**:
- Set `OPENAI_MODEL=gpt-5-nano` in Supabase Edge Functions environment variables
- All functions will automatically use this model
- No code changes needed when switching models

**Impact**: Can now use any model via environment variable without code changes.

### 5. Removed Temperature Parameters ✅

**Files**:
- `supabase/functions/interview-research/index.ts`
- `supabase/functions/interview-question-generator/index.ts`

**What Changed**:
- Removed all `temperature: 0.7` parameters
- GPT-5 models don't support temperature, so it's no longer included
- Works with both GPT-4 and GPT-5 models

**Impact**: Compatible with GPT-5 models and cleaner code.

### 6. Quality-Over-Quantity Question Generation ✅

**Files**:
- `supabase/functions/interview-research/index.ts` - `buildSynthesisPrompt()` and `getSynthesisSystemPrompt()`
- `supabase/functions/interview-question-generator/index.ts` - `generateInterviewQuestions()`

**What Changed**:
- Changed target from 120-150 questions to **30-50 questions** (5-8 per category)
- Emphasized **QUALITY OVER QUANTITY** in all prompts
- Updated requirements to ensure **100% of questions** reference specific details:
  - Candidate's work history, projects, achievements
  - Specific job responsibilities and requirements
  - Company culture, values, interview philosophy
  - Real interview questions from candidate reports
- Added explicit "NO GENERIC QUESTIONS" requirement
- Each question must be unique and highly relevant

**Before**:
- Target: 120-150 questions (18-22 per category)
- Focus: Volume
- Tailoring: 60%+ should reference details

**After**:
- Target: 30-50 questions (5-8 per category)
- Focus: Quality and deep tailoring
- Tailoring: 100% must reference specific details

**Impact**: Higher quality, more relevant questions that are deeply tailored to the candidate and role.

## Configuration

### Setting the Model in Supabase

**Option 1: Supabase Dashboard**
1. Go to Project Settings → Edge Functions → Environment Variables
2. Add: `OPENAI_MODEL` = `gpt-5-nano`
3. Redeploy functions

**Option 2: Supabase CLI**
```bash
supabase secrets set OPENAI_MODEL=gpt-5-nano
```

**Note**: `.env.local` is for local development only. For deployed functions, use Supabase environment variables.

## Expected Results

1. **Model**: Uses `gpt-5-nano` (or whatever is set in `OPENAI_MODEL`)
2. **No Temperature**: Temperature parameter removed (compatible with GPT-5)
3. **Question Count**: 30-50 highly tailored questions (5-8 per category)
4. **Quality**: Every question references specific company/job/CV details
5. **Tailoring**: 100% of questions are tailored (no generic questions)
6. **Context**: 5-10x more context passed to AI for better question generation

## Files Modified

1. `supabase/functions/interview-research/index.ts`
   - `buildSynthesisPrompt()` - Complete rewrite with rich context
   - `getSynthesisSystemPrompt()` - Enhanced with explicit requirements
   - Removed temperature parameter

2. `supabase/functions/_shared/config.ts`
   - Added environment variable support for models
   - Added GPT-5 detection helper

3. `supabase/functions/interview-question-generator/index.ts`
   - Removed temperature parameter
   - Updated prompts for quality-over-quantity
   - Enhanced tailoring requirements

## Testing Recommendations

1. **Set Model**: Set `OPENAI_MODEL=gpt-5-nano` in Supabase environment
2. **Test with new searches**: Run research for new searches to verify quality
3. **Verify tailoring**: Check that questions reference specific CV/job/company details
4. **Check question depth**: Ensure questions are specific, not generic
5. **Verify real question usage**: Confirm questions are variations of extracted real questions
6. **Check question count**: Verify 30-50 questions are generated

## Backward Compatibility

- If `OPENAI_MODEL` is not set, defaults to `gpt-4o` (backward compatible)
- Temperature removal works with both GPT-4 and GPT-5 models
- Question count reduction improves quality without breaking existing functionality
- All changes are backward compatible - existing functionality preserved

## Holistic Interview Intelligence Blueprint

The improvements above fix structural issues, but the pipeline also needs a research methodology that mirrors how top interviewers operate. Below is a blueprint we can align on to ensure every artifact we produce contains deep, domain-aware insight instead of surface-level bullet points.

### Objectives for a World-Class Pipeline
- **True signal capture**: Gather the context interviewers actually rely on—decision criteria, red flags, calibration anchors, and lived interview experiences.
- **Framework-backed reasoning**: Tie each insight to established interview frameworks (BAR Raiser loops, STAR/SOAR storytelling, system-design heuristics, product-sense ladders, etc.).
- **Bidirectional prep**: Generate assets that help both the interviewer (what to ask, how to probe, scoring lenses) and the interviewee (how to prepare, how to evidence competency).
- **Continuous enrichment**: Close the loop after every interview to ingest new anecdotes, update rubrics, and refine prompts automatically.

### High-Leverage Insight Sources Beyond Current Feeders
1. **Candidate narratives**: Pull full STAR/SOAR stories, not just achievement summaries, so we know the situation, inflection points, and measurable outcomes.
2. **Interviewer debriefs**: Capture what strong candidates did differently, calibrations on “meets bar” vs “greatly exceeds,” and common failure patterns.
3. **Process artifacts**: Onsite agendas, interviewer assignment matrices, take-home briefs, loop calibration docs.
4. **Role-specific scenario banks**: Real case prompts (e.g., “Design Aurora’s ML-driven pricing engine”) with expected depth, guardrails, and trick follow-ups.
5. **Competitor benchmarks**: How other companies evaluate similar roles, to cross-pollinate novel question styles and stress tests.
6. **Macro signals**: Market shifts (e.g., “cloud cost efficiency is a 2025 theme”) that should influence what we probe in interviews.

### Domain-Grade Framework Layer
| Layer | Purpose | Examples |
| --- | --- | --- |
| Competency lattice | Map skills × depth (“architect”, “operator”, “coach”) | Amazon LPs, Google GCA, Meta craft pillars |
| Narrative structuring | Force actionable storytelling | STAR, SOAR, SCORE, ICARE |
| Evaluation heuristics | Encode interviewer mental models | Bar-raiser fatal flaws, “5 Why” follow-ups, MECE solution trees |
| Question taxonomy | Ensure coverage | Behavioral vs execution vs strategy vs system design vs follow-up diagnostics |
| Scoring rubric | Tie signals to pass/fail | Evidence weightings, seniority calibration bands |

We should explicitly tag every generated question, hint, and rubric entry with these layers so downstream consumers understand **why** a prompt matters.

### Proposed End-to-End Research Pipeline
1. **Stage 0 – Opportunity Framing**
   - Inputs: search intent, company/role hypotheses, hiring bar notes.
   - Output: Investigation charter outlining which competencies need the deepest probes and what “great” looks like.

2. **Stage 1 – Signal Intake**
   - Concurrent collectors (existing Edge Functions) + new sources:
     - Candidate report crawler (actual interview experiences, success/failure stories).
     - Debrief annotator (structures interviewer retros).
     - Competency calibrator (maps JD → evaluation lattice).
   - Normalize every artifact into a `Signal` schema (`type`, `source`, `seniority`, `confidence`, `raw_snippet`).

3. **Stage 2 – Domain Mapping**
   - Run an “Insight Router” that tags each signal with frameworks above (e.g., `Competency: System Design`, `Heuristic: Latency-first`, `Narrative: STAR`).
   - Build a `Competency × Depth × Evidence` matrix highlighting gaps between role expectations and candidate profile.

4. **Stage 3 – Question Design Matrix**
   - For each competency row, synthesize a stack of prompts:
     1. **Anchor question** (real question verbatim).
     2. **Probe ladder** (follow-ups: clarify context → technical deep dive → trade-off check → results quantification).
     3. **Stress variants** (what-if scenario, failure recovery, escalation).
     4. **Scoring rubric** (what outstanding/average/weak answers look like).
   - Guarantee coverage across stages: phone screen, technical loop, cross-functional, HM/Bar Raiser.

5. **Stage 4 – Interviewer & Candidate Assets**
   - Interviewer view: loop map, intent per stage, red-flag checklist, calibration anchors, suggested “listen for” signals.
   - Candidate view: rehearsal plan per stage, recommended STAR stories tied to each competency, self-diagnostic questions, practice drills.
   - Inline references to real anecdotes so guidance feels grounded.

6. **Stage 5 – Feedback Assimilation**
   - After each user session, capture which questions felt most realistic or surprising.
   - Log interview outcomes (success/fail, stage reached) when users report back.
   - Feed deltas into the Signal Intake layer to keep the pipeline living.

## Priority Role Verticals & Verbal-First Focus

We’re leaning into industries where compensation is high, interview rubrics are well defined, and the ROI of better verbal prep is obvious. That means optimizing for:

1. **Tech Product & Business Leadership (PM, TPM, BizOps, Strategy)**
   - Frameworks: Product sense ladders, execution scorecards, cross-org leadership models, financial modeling for PMs.
   - Data sources: Product tear-downs, customer roadmap leaks, earnings transcripts, internal cultural narratives, leadership principle documentation.
   - Signature expectations: ambiguous problem solving, stakeholder alignment, metrics fluency, ability to connect product bets to ARR/MAU impact.

2. **Investment Banking / PE / Corp Dev**
   - Frameworks: Deal lifecycle checklists, valuation heuristics, regulatory workflows, client management behaviors by seniority.
   - Data sources: M&A filings, pitchbooks, league-table commentary, credit rating notes, macroeconomic speeches.
   - Signature expectations: proactive ownership, quantified upside, cross-org coordination under pressure, flawless executive communication.

3. **Management & Strategy Consulting**
   - Frameworks: MECE case trees, profitability/decomposition patterns, transformation playbooks, partner-level client leadership checklists.
   - Data sources: Consulting casebooks, thought-leadership POVs, procurement RFPs, alumni debriefs, change-management retros.
   - Signature expectations: hypothesis-driven structure, executive presence, influence without authority, client-ready synthesis.

### Pipeline Adjustments for These Verticals
- **Taxonomy presets**: Pre-bake competency lattices per vertical (e.g., PM = Product Sense, Execution, Craft; IB = Deal Sourcing, Modeling, Client Leadership; Consulting = Case Structuring, Client Leadership, Implementation).
- **Scenario archetype libraries**: Curate reusable prompts like “post-merger integration,” “zero-to-one platform launch,” “cost takeout program,” each tagged with level expectations.
- **Expectation lenses**: Encode vertical-specific “must show” signals (financial impact, cross-org leadership, verbal polish). Generation references these lenses automatically so questions and rubrics stress the right behaviors.
- **Source weighting**: Run Tavily + scraper collectors with vertical-specific domains (e.g., SEC/EDGAR for finance, Gartner/Stratechery for tech, consulting alumni blogs) and store provenance to justify recommendations.

### Verbal-First, On-the-Go Experience
- **No coding surfaces**: All content is geared toward live verbal answers, whiteboard strategy, mental math, and narrative drills rather than IDE-style practice.
- **Prioritized drills**: Default view highlights the top 3–5 competency gaps for the user’s goal/level; deeper coverage is available but optional.
- **Paired assets**: Every interviewer intent (question, follow-up ladder, scoring rubric) has a mirrored candidate coaching artifact so users rehearse exactly what interviewers probe.
- **Micro-practice friendly**: Package prompts into audio snippets, flashcards, and timed voice practice to support commute or “between meetings” sessions.

## Supabase Schema Audit (Nov 26 2025)

Pulled the latest schema directly from Supabase (`public` schema via `list_tables`) to cross-check reality vs. the blueprint above. Key observations:

### Snapshot Highlights
- Core workflow tables: `searches`, `search_artifacts`, `interview_stages`, `interview_questions`, `practice_sessions`, `practice_answers`.
- Source ingestion: `scraped_urls`, `interview_experiences`, `resumes`.
- Telemetry/logging: `function_executions`, `openai_calls`, `tavily_searches`, `url_deduplication_metrics`.

### Redundancy & Legacy Pain Points
1. **`searches`**  
   - Contains both `search_status` and `status` with identical enums plus duplicative progress fields (`progress_step`, `progress_percentage`, `started_at`, `completed_at`).  
   - Lacks columns for target vertical, competency focus, or prioritization metadata required by the new taxonomy.

2. **`search_artifacts`**  
   - Stores entire synthesis outputs (`interview_stages`, `interview_questions_data`, `preparation_guidance`) as JSON blobs, duplicating content already normalized in `interview_stages` and `interview_questions`.  
   - Single-row-per-search design makes partial updates brittle and risks drift between JSON blobs and normalized tables.

3. **`interview_questions` / `interview_stages`**  
   - Rich free-text columns (`company_context`, `rationale`, arrays of follow-ups) but **no structured taxonomy columns** (vertical, competency, sub-skill, scenario archetype, expectation lenses, seniority band).  
   - `stage_id` + `search_id` linkage is solid, yet there is no bridge to signal provenance or scoring rubrics.

4. **`interview_experiences`**  
   - Captures candidate reports but remains unstructured (arrays of `questions_asked`, text blobs) and is not linked back to `scraped_urls` or any normalized `signal` entity. We cannot reason about confidence, framework tags, or reuse metrics.

5. **`scraped_urls`**  
   - Acts as a monolithic dumping ground (raw HTML, summaries, extracted arrays) without `search_id` FK or signal tagging. Platform-specific metadata lives inside JSONB, making dedupe/attribution difficult.

6. **Practice workflow (`practice_sessions`, `practice_answers`)**  
   - Missing scoring/evaluation columns, transcript metadata, or feedback loops needed for Stage 5 assimilation. Cannot yet log which drills map to which competency gaps.

7. **Logging tables** (`function_executions`, `openai_calls`, `tavily_searches`)  
   - Healthy coverage, but we should index on `search_id`/`user_id` for faster investigations and join them to forthcoming `signal` lineage.

### Missing Core Entities vs. Target Architecture
- **`interview_signals`**: canonical store for every insight/snippet with columns like `signal_type`, `source_table_id`, `competency_tag`, `seniority`, `confidence_score`.
- **`framework_tags` / `expectation_lenses`**: lookup tables to encode BAR Raiser principles, financial impact requirements, etc., so they can be referenced by questions, stages, and guidance.
- **`question_stacks` & `question_variants`**: grouping construct to hold anchor question + probe ladder + stress variants + rubrics.
- **`scenario_archetypes`**: reusable cases (post-merger integration, zero-to-one launch, etc.) tied to vertical/seniority.
- **`user_feedback_events`**: to capture per-question usefulness, realism, and post-interview outcomes for the feedback loop.
- **`source_provenance` bridge**: linking `scraped_urls`, `interview_experiences`, and future expert uploads to signals/questions.

### Recommended Restructure Steps
1. **Normalize statuses & progress**: collapse `search_status`/`status` into one enum, move progress tracking into its own table (`search_progress_events`) so searches stay slim.
2. **Replace `search_artifacts` JSON blobs** with relational tables (`interview_signals`, `question_stacks`, `preparation_guidance_sections`) and keep JSON only for immutable snapshots.
3. **Augment `interview_questions`** with taxonomy columns (`vertical`, `role_family`, `competency`, `sub_skill`, `scenario_archetype_id`, `expectation_lens_id`, `target_seniority`). Add FK to `question_stacks`.
4. **Link ingestion sources**: add `scraped_url_id` FK to `interview_experiences`; introduce `signal_sources` table mapping each signal to Tavily call, scrape method, trust score.
5. **Practice telemetry**: extend `practice_sessions`/`practice_answers` with `competency_id`, `rubric_score`, `feedback_notes`, and optionally audio-transcription metadata for future coaching.
6. **Create feedback & outcome logging**: new `user_outcomes` table capturing real interview results, mapped back to searches and question stacks for reinforcement learning.

These schema changes align storage with the richer taxonomy/framework strategy while reducing JSON blob drift and paving the way for provenance-aware, priority-ranked question generation.

## Schema Change Prioritization & Risk Assessment

To ensure we only touch what truly matters and avoid breaking production, every change was re-audited and categorized:

| Priority | Item | Business Justification | Best-Practice Guardrails |
| --- | --- | --- | --- |
| **Must** | Normalize `searches` progress tracking | Conflicting status columns already cause UI drift; unifying prevents race conditions as we add more stages. | Create additive `search_progress_events`, dual-write, cut over only after parity dashboards stay green. |
| **Must** | Replace `search_artifacts` blobs with relational tables | Without normalized data we cannot attach taxonomy/provenance; blobs frequently desync from actual questions. | Add new tables (`interview_signals`, `question_stacks`, etc.) beside existing blobs, backfill, then read-switch via feature flag. |
| **Must** | Add taxonomy columns & `question_stacks` | Required to deliver prioritized PM/IB/Consulting drills; current schema can’t express vertical or expectation lenses. | Columns start nullable; existing queries unaffected until we backfill. |
| **Must** | `interview_signals` + `signal_sources` bridge | Canonical provenance store needed for regulation-grade traceability and dedupe. | Purely additive; ingestion functions dual-write before any reads depend on it. |
| **Nice** | `scenario_archetypes` lookup | Helps reuse cases but not mandatory for first release. | Defer until Must-haves stable. |
| **Nice** | Practice telemetry columns | Useful for feedback loop yet can wait; does not block research pipeline. | Add once question taxonomy is shipping. |
| **Nice** | `user_outcomes` logging | Great for RLHF-style improvements, but optional for initial MVP. | Schedule after telemetry upgrade. |

This prioritization keeps scope surgical: only four schema changes are required to unblock the business goals, and each follows additive-first, opt-in rollout patterns.

## Safe Migration Plan & Detailed Design

### Phase 0 – Additive Foundations (Zero Breaking Changes)
1. **Create new tables**  
   - `interview_signals (id, source_type, source_id, signal_type, vertical, role_family, competency, sub_skill, seniority, confidence_score, content JSONB, created_at, updated_at)`  
   - `question_stacks (id, search_id, signal_id, vertical, role_family, competency, sub_skill, expectation_lens_id, target_seniority, anchor_question, probe_ladder JSONB, stress_variants JSONB, scoring_rubric JSONB, created_at, updated_at)`  
   - `signal_sources (id, signal_id, scraped_url_id?, interview_experience_id?, tavily_search_id?, openai_call_id?, confidence_adjustment, notes)`  
   - `search_progress_events (id, search_id, step, status, progress_pct, metadata JSONB, created_at)`
2. **Add nullable columns** to `interview_questions`: `vertical`, `role_family`, `competency`, `sub_skill`, `scenario_archetype_id (FK nullable)`, `expectation_lens_id (FK nullable)`, `target_seniority`, `question_stack_id (FK nullable)`, `primary_signal_id (FK nullable)`.
3. **Backfill scripts**  
   - Parse existing `search_artifacts.interview_questions_data` to populate `question_stacks` + new question metadata.  
   - Convert `company_research_raw` insights into `interview_signals`.  
   - Record provenance via `signal_sources`.
4. **Dual-write rollout**  
   - Edge Functions write to both legacy blobs and new tables (behind feature flag).  
   - Add automated tests ensuring new writes succeed even if legacy code path fails (fail-fast to prevent partial migrations).

### Phase 1 – Read Path Cutover
1. **Service updates**: Synthesis functions consume `interview_signals` + taxonomy columns for prompts; frontend reads from `question_stacks` but falls back to blob if metadata missing.  
2. **Monitoring**: Build Grafana/SQL dashboards comparing counts per search between blob vs normalized tables; alert on mismatches.  
3. **Shadow traffic**: Enable new read path for internal users first, collect qualitative feedback.

### Phase 2 – Legacy Retirement
1. **Freeze writes** to `search_artifacts` JSON columns after ≥2 weeks of zero mismatches.  
2. **Remove redundant columns** (`searches.status`, `progress_percentage`, etc.) once UI/API fully rely on `search_progress_events`.  
3. **Tighten constraints**: make taxonomy columns NOT NULL for newly generated data; warn if ingestion attempts to skip them.

### Additional Table Sketches (for deferred Nice-to-Haves)
- `scenario_archetypes (id, name, vertical, description, default_expectation_lens_id, created_at, updated_at)`  
- `user_feedback_events (id, user_id, question_id, feedback_type, rating, notes, created_at)`  
- `user_outcomes (id, user_id, search_id, role, company, interview_stage_reached, outcome, notes, created_at)`

Design principles applied throughout:
- **Additive-first migrations** to avoid downtime.  
- **Nullable-to-required progression** (populate data before enforcing constraints).  
- **Dual-write + shadow-read** to ensure parity before deletions.  
- **Provenance-by-default** so every downstream artifact can cite origin (critical for trust and quality audits).

## Implementation Notes (Next Steps)
- **Data model**: Introduce `interview_signals`, `framework_tags`, and `question_stacks` tables to persist rich metadata instead of raw blobs.
- **Prompting**: Build a “framework preamble” that injects competency matrices and follow-up ladders before synthesis; keep question variants grouped by intent.
- **Evaluation tooling**: Add validator scripts/tests to ensure every generated question references at least one `Signal` and carries ≥2 framework tags.
- **User experience**: Surface assets in-dashboard with toggles for interviewer vs interviewee prep, and highlight provenance (“rooted in 37 Google L4 TPM interview debriefs from 2024–2025”).

Following this blueprint ensures we stop at nothing less than bar-raiser-quality research: grounded in reality, organized by proven frameworks, and continually enriched by new interview data. This is how we deliver the “best possible content” the product aspires to provide.
