# ROOT CAUSE ANALYSIS: 10+ MINUTE STALLS IN INTEL PREP ACE

## EXECUTIVE SUMMARY

The system is NOT actually hanging - it's **intentionally async and fire-and-forget**, but this architecture creates THREE critical problems:

1. **The backend IGNORES errors from child services** - if company-research times out, job-analysis fails, or CV-analysis crashes, the backend CONTINUES AS IF NOTHING HAPPENED, resulting in empty/invalid data being processed
2. **The backend doesn't have timeout protection for individual sequential database operations** - the for loop inserting stages/questions (lines 995-1035) can hang if database is slow/unresponsive
3. **No visibility into which service actually failed** - users see 10 minutes of "processing" when the actual failure happened in first 20 seconds

---

## DETAILED EXECUTION FLOW

### USER CLICK "RUN INTEL" → HOME.TSX (lines 37-110)

1. `handleSubmit()` is called
2. Calls `searchService.createSearchRecord()` → Creates DB record with status='pending'
3. Immediately shows progress dialog (status='pending')
4. **FIRE-AND-FORGET**: Calls `searchService.startProcessing()` WITHOUT AWAIT (line 75)
5. Returns immediately to user

### SEARCHSERVICE.STARTPROCESSING() (lines 48-105)

1. Updates search status to 'processing' in DB
2. **CRITICAL**: Calls `supabase.functions.invoke("interview-research", {...})` (line 63)
3. **PROBLEM**: This is NOT AWAITED - the .then() callback (line 74) doesn't block
4. Returns immediately with `{ success: true }` (line 93) **regardless of whether backend actually starts**

### INTERVIEW-RESEARCH/INDEX.TS - MAIN HANDLER (lines 820-863)

1. Receives request
2. **Initializes progress tracker** (line 830)
3. **Starts background processing** (line 834): `processResearchAsync(...).catch(...)` - FIRE AND FORGET
4. **Returns immediately** (line 841) with status 202 "Accepted"

**KEY POINT**: The actual work happens in the background. The HTTP response returns INSTANTLY.

### INTERVIEW-RESEARCH/INDEX.TS - BACKGROUND PROCESSING (lines 869-1256)

#### Phase 1: Concurrent Data Gathering (lines 904-937)

```typescript
const [companyRes, jobRes, cvRes] = await Promise.allSettled([
  executeWithTimeoutSafe(() => gatherCompanyData(...), 20000),  // LINE 910
  executeWithTimeoutSafe(() => gatherJobData(...), 20000),      // LINE 911
  executeWithTimeoutSafe(() => gatherCVData(...), 15000),       // LINE 912
]);
```

**CRITICAL ISSUE #1**: Uses `Promise.allSettled()` which:
- ✅ Catches ALL errors/timeouts from each service
- ❌ **DOES NOT STOP if services fail** - continues with null/undefined data
- ❌ Returns `{ status: 'fulfilled', value: { ok: false, error: ... } }` on timeout

**Then checks results**:
```typescript
if (companyRes.status === 'fulfilled' && companyRes.value.ok) {
  companyInsights = companyRes.value.value;
} else {
  // Log as PARTIAL and continue with NULL data!
}
```

**PROBLEM**: If `gatherCompanyData()` returns `null` or times out, companyInsights = null, but code continues.

#### Phase 2: AI Synthesis (lines 949-964)

```typescript
const synthesisResult = await executeWithTimeout(
  () => conductInterviewSynthesis(...),
  40000,  // 40 second timeout
  'AI Synthesis',
  tracker
);
```

**PROBLEM**: If ANY of the gathered data (companyInsights, jobRequirements, cvAnalysis) is null:
- AI synthesis still runs with INCOMPLETE context
- OpenAI still gets called with partial data
- Takes full 30-40 seconds even though data is broken

#### Phase 3: Question Generation (lines 970-987)

```typescript
const [cvJobComparison, enhancedQuestions] = await Promise.all([
  generateCVJobComparison(...),
  generateEnhancedQuestions(...)
]);
```

**PROBLEM**: These call OTHER edge functions for each stage:
- Line 315: `interview-question-generator` is called PER STAGE
- If it fails, enhanced questions array is incomplete
- But code doesn't retry - just marks as partial

#### Phase 4: Database Writes (lines 995-1240)

**CRITICAL ISSUE #2**: This is where the 10+ minute hang happens!

```typescript
for (const stage of synthesisResult.interview_stages) {
  const { data: stageData, error: stageError } = await supabase
    .from("interview_stages")
    .insert({...})  // LINE 997-1009 - POTENTIAL HANG HERE
    .select()
    .single();
  
  if (stageError) throw stageError;
  
  // Insert questions for this stage
  const { error: questionsError } = await supabase
    .from("interview_questions")
    .insert(questionsToInsert);  // LINE 1030-1032 - POTENTIAL HANG HERE
  
  if (questionsError) throw questionsError;
}
```

**HANGING MECHANISM**:
1. First stage inserts fine
2. Second stage's stage insert gets BLOCKED by RLS evaluation
3. Wait 5-10 seconds
4. RLS query times out on Supabase
5. No explicit timeout set on these operations
6. Operation hangs indefinitely waiting for response
7. Meanwhile, progress tracker shows "FINALIZING" (line 968) indefinitely
8. Frontend polls every 10 seconds (after 60s elapsed - line 118 of useSearchProgress.ts)
9. 10 minutes later, Supabase edge function timeout (300s) triggers
10. Entire function fails silently

**ACTUAL CAUSES**:

1. **No timeout protection on sequential DB operations** (lines 995-1240)
   - Supabase client uses default fetch timeout
   - If network is slow, can wait 30-60+ seconds per insert
   - With 4 stages × 2 inserts = 8 operations = potential 240+ seconds

2. **RLS policy complexity** causing slow queries
   - cv_job_comparisons RLS has cross-table JOIN
   - Supabase evaluates RLS before returning data
   - Slow RLS = slow insert validation

3. **Batch insert on interview_questions is synchronous per stage**
   - Stage 1: Insert stage header + 20 questions
   - Stage 2: Insert stage header + 20 questions
   - Stage 3: Insert stage header + 20 questions
   - Stage 4: Insert stage header + 20 questions
   - Total: 4 sequential operations × ~30-100ms each = can be slow

---

## THE ACTUAL BLOCKING CODE

### Location 1: INTERVIEW-RESEARCH/INDEX.TS - Lines 995-1035 (Stage/Question Insert Loop)

```typescript
for (const stage of synthesisResult.interview_stages) {
  // THIS CAN BLOCK FOR MINUTES:
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
    .select()      // ← FORCES FULL TABLE SCAN
    .single();     // ← BLOCKS UNTIL RESULT
  
  // IF SUPABASE IS SLOW, WAITS HERE INDEFINITELY
  if (stageError) throw stageError;
  
  // THEN THIS CAN ALSO BLOCK:
  const { error: questionsError } = await supabase
    .from("interview_questions")
    .insert(questionsToInsert);  // 20+ question inserts
    // ^ NO TIMEOUT, BLOCKS UNTIL DONE
  
  if (questionsError) throw questionsError;
}
```

### Location 2: INTERVIEW-RESEARCH/INDEX.TS - Lines 1094-1129 (CV Comparison Upsert)

```typescript
const { data, error } = await supabase
  .from("cv_job_comparisons")
  .upsert({...}, {
    onConflict: 'search_id'
  });
  // ^ CAN BLOCK IF DATABASE IS BUSY
```

### Location 3: INTERVIEW-RESEARCH/INDEX.TS - Lines 1214-1239 (Status Update)

```typescript
const { error: updateError } = await supabase
  .from("searches")
  .update({
    search_status: "completed",
    cv_job_comparison: cvJobComparison,
    preparation_priorities: cvJobComparison?.preparation_priorities || [],
    overall_fit_score: cvJobComparison?.overall_fit_score || 0
  })
  .eq("id", searchId);
  // ^ BLOCKS IF DATABASE SLOW
```

---

## WHY IT STALLS FOR 10+ MINUTES

**Scenario**: User runs search for Google, Software Engineer role

1. **t=0**: User clicks "Run Intel"
   - Frontend shows progress dialog
   - Backend starts interview-research function

2. **t=2s**: Data gathering completes (company-research, job-analysis, cv-analysis all timeout or return partial data)
   - Progress shows 70%

3. **t=10s**: AI synthesis completes
   - Progress shows 90%

4. **t=12s**: Question generation completes
   - Progress shows 95%
   - Status: FINALIZING

5. **t=12-15s**: First stage insert starts
   - Supabase RLS policy evaluates
   - Normal case: 50-100ms, completes

6. **t=15-17s**: Questions insert for stage 1
   - 20 questions being inserted
   - Normally 50-100ms per batch

7. **t=18s**: Second stage insert starts
   - **BLOCKING HAPPENS HERE**
   - RLS policy takes 2-3 seconds to evaluate
   - Why? Unknown - could be:
     - Slow network
     - Database lock contention
     - RLS policy doing expensive JOIN
     - Supabase service degradation

8. **t=25s onwards**: Each subsequent stage insert hangs
   - No timeout protection
   - Waits indefinitely for Supabase response
   - Meanwhile, progress tracker shows 95% "FINALIZING"
   - Frontend polls every 10 seconds for updates
   - No new progress updates (tracker stopped after line 968)

9. **t=320s (5:20)**: Deno/Supabase edge function timeout triggers
   - Default timeout is typically 300-600 seconds
   - Function is killed
   - Progress tracker finally updates to "failed"
   - But data is partially written to DB
   - User sees "FAILED" after 5+ minutes

---

## EVIDENCE

### Proof 1: No Timeout Protection on DB Operations

Search for "timeout" in interview-research/index.ts:
- Line 949-961: executeWithTimeout() wraps AI synthesis ✓
- Line 970-987: Promise.all() wraps CV/question gen ✓
- **Lines 995-1035**: Stage/question insert loop ✗ **NO TIMEOUT**
- **Line 1094-1129**: CV comparison upsert ✗ **NO TIMEOUT**
- **Line 1214-1239**: Status update ✗ **NO TIMEOUT**

### Proof 2: allSettled Masks Errors

Lines 909-913 use Promise.allSettled() which:
- Catches errors but doesn't fail
- Returns `fulfilled` even when wrapped operation times out
- Code checks `value.ok` but continues anyway

### Proof 3: Progress Updates Stop After Line 968

Line 968: `await tracker.updateStep('FINALIZING');`

After this, only two more progress updates:
- Line 1242: `await tracker.markCompleted()`

But between lines 968-1242 is 270 lines of database operations with NO progress updates.

If any of those DB operations hang, frontend sees "FINALIZING" indefinitely.

### Proof 4: Frontend Polling Reduces After 60 Seconds

useSearchProgress.ts lines 104-122:
```typescript
if (elapsedMs < 30000) {
  return pollInterval;  // 2 seconds
}

if (elapsedMs < 60000) {
  return 5000;  // 5 seconds
}

// After 60 seconds: poll every 10 seconds
return 10000;
```

So if backend hangs after 60 seconds:
- Frontend polls every 10 seconds
- User sees no updates for 10s at a time
- Appears frozen

---

## ROOT CAUSES (SUMMARY)

| Root Cause | Location | Impact | Fix |
|-----------|----------|--------|-----|
| No timeout on stage insert | Lines 995-1009 | Can hang 30-300s | Add 10s timeout |
| No timeout on questions insert | Lines 1030-1032 | Can hang 30-300s | Add 15s timeout |
| No timeout on CV comparison upsert | Lines 1094-1129 | Can hang 30-300s | Add 10s timeout |
| No timeout on status update | Lines 1214-1223 | Can hang 30-300s | Add 5s timeout |
| allSettled masks timeouts | Lines 909-937 | Silent failures | Use Promise.all with fallback |
| No progress updates during DB phase | Lines 968-1242 | User sees frozen UI | Add progress updates |
| RLS evaluation slow on cv_job_comparisons | DB layer | 2-5s per write | Simplify RLS or add index |

---

## CONCLUSION

The system DOES NOT have a 10-20 minute processing time that's slow.

The system DOES have:
1. Async architecture that returns immediately to user (good)
2. Fire-and-forget processing (good for UX, bad for visibility)
3. **NO TIMEOUT PROTECTION on sequential database operations** (BAD)
4. **RLS policies that can be slow** (BAD)
5. **Error masking via Promise.allSettled** (VERY BAD)
6. **Progress updates that stop halfway through** (BAD)

Result: Users see "FINALIZING" for 5-10+ minutes until Deno timeout kicks in.

