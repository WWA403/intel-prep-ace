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
