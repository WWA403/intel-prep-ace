# Fixes Applied - November 22, 2025

## Issues Fixed

### 1. JSON Parsing Errors ✅

**Problem**: AI was returning markdown-wrapped JSON (```json ... ```) instead of pure JSON, causing parsing errors in:
- `cv-analysis` function
- `job-analysis` function

**Fix**: Added `stripMarkdownCodeBlocks()` function to remove markdown code blocks before parsing JSON.

**Files Modified**:
- `supabase/functions/_shared/openai-client.ts` - Added helper function
- `supabase/functions/cv-analysis/index.ts` - Added markdown stripping
- `supabase/functions/job-analysis/index.ts` - Added markdown stripping
- `supabase/functions/interview-research/index.ts` - Added markdown stripping

### 2. Logger File System Error ✅

**Problem**: Logger was trying to create `./logs` directory in edge functions, which isn't allowed.

**Fix**: Made file logging conditional - only runs in development or when `ENABLE_FILE_LOGGING=true`. Fails gracefully in production.

**Files Modified**:
- `supabase/functions/_shared/logger.ts` - Added environment check

### 3. Model Detection ✅

**Problem**: Unsure which OpenAI model is being used.

**Fix**: Added logging to show which model is being used and where it comes from (env var or default).

**Files Modified**:
- `supabase/functions/interview-research/index.ts` - Added model logging

### 4. Question Count Logging ✅

**Problem**: Only 7 questions being generated, but no visibility into why.

**Fix**: Added detailed logging:
- Log question counts after synthesis
- Log question breakdown by category
- Log warning if less than 20 questions saved
- Log question counts before database insertion

**Files Modified**:
- `supabase/functions/interview-research/index.ts` - Added question count logging

### 5. Unused Functions

**Status**: `interview-question-generator` and `cv-job-comparison` are not being used.

**Analysis**:
- `cv-job-comparison` was removed in Option B redesign (consolidated into `interview-research`)
- `interview-question-generator` is not called from anywhere - questions are generated directly in `interview-research` unified synthesis

**Recommendation**: These functions can be removed if not needed, or kept for potential future use.

## Next Steps

1. **Deploy fixes** and test
2. **Monitor logs** to see:
   - Which model is being used
   - How many questions are generated
   - If JSON parsing errors are resolved
3. **Investigate low question count**: If still only 7 questions, check:
   - Is the AI following the prompt?
   - Are there token limits being hit?
   - Is the response being truncated?
4. **Consider removing unused functions** if confirmed not needed

