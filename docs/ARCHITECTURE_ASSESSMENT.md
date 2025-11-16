# Architecture Assessment: Current Design vs Real-World Constraints

## Executive Summary

You're absolutely correct: **the current architecture is fundamentally misaligned with actual processing times**. The system is architected for jobs completing in 30-45 seconds, but real-world processing takes **10-15 minutes**. This document analyzes the mismatch and proposes a redesign.

---

## Current Architecture Analysis

### How It Works Now

```
Frontend                          Backend (Edge Function)
─────────────                     ──────────────────────
  │
  ├─ User triggers search
  │                                  ├─ Start interview-research function
  │                                  ├─ (Sequential/Concurrent API calls)
  │                                  │  ├─ Company Research: 20-30s
  │                                  │  ├─ Job Analysis: 15-20s
  │                                  │  ├─ CV Analysis: 10-15s
  │                                  │  ├─ Question Generation: 30-40s
  │                                  │  └─ Interview Synthesis: 20-30s
  │                                  ├─ Save all data to DB
  │                                  └─ Return 200 response
  │
  └─ Poll every 2-10 seconds
     for job completion
```

### The Problem: Supabase Edge Function Timeout

```
┌─────────────────────────────────────────────────────┐
│ Supabase Edge Function Execution Model              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Total Execution Time Limit: 600 seconds             │
│ (Most functions timeout after 5-10 minutes)         │
│                                                     │
│ Current Setup:                                      │
│ • Company Research: 20-30s                          │
│ • Job Analysis: 15-20s                              │
│ • CV Analysis: 10-15s                               │
│ • Question Generation: 30-40s                       │
│ • Interview Synthesis: 20-30s                       │
│ ────────────────────────────────────────            │
│ • Total: ~3-5 minutes (FITS!)                       │
│ • Database saves: +1-2 minutes                      │
│ • **ACTUAL: 4-7 minutes**                           │
│                                                     │
│ BUT: Adding multiple concurrent calls increases:    │
│ • Memory pressure (creates multiple connections)   │
│ • Network latency (multiple parallel requests)      │
│ • Timeout risk when APIs are slow                   │
│                                                     │
│ When timeout occurs:                                │
│ • Function terminates abruptly                      │
│ • Partial data may be saved                         │
│ • Frontend has no clear failure signal              │
│ • User sees "stalled" or "timed out" message        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Root Causes of Current Issues

### Issue 1: Unrealistic 30-45 Second Expectations

**The System Assumes:**
```typescript
// Current progress expectations (UNREALISTIC)
PROGRESS_STEPS = {
  INITIALIZING: 5%,                    // 0-3s
  COMPANY_RESEARCH_COMPLETE: 30%,      // Expects ~5s
  JOB_ANALYSIS_COMPLETE: 50%,          // Expects ~5s
  CV_ANALYSIS_COMPLETE: 70%,           // Expects ~5s
  QUESTION_GENERATION_COMPLETE: 90%,   // Expects ~10s
  FINALIZING: 95%,                     // Expects ~2s
  COMPLETED: 100%                      // Total: ~35s
}
```

**Reality:**
```typescript
// Actual processing times (5-15 MINUTES)
ACTUAL_TIMES = {
  INITIALIZING: 5%,                    // 0-3s
  COMPANY_RESEARCH_COMPLETE: 30%,      // ~20-30s (Tavily + OpenAI)
  JOB_ANALYSIS_COMPLETE: 50%,          // ~15-20s (URL extraction + OpenAI)
  CV_ANALYSIS_COMPLETE: 70%,           // ~10-15s (OpenAI parsing)
  QUESTION_GENERATION_COMPLETE: 90%,   // ~30-40s (Concurrent for stages)
  INTERVIEW_SYNTHESIS: 95%,            // ~20-30s (Complex AI synthesis)
  FINALIZING: 100%,                    // ~1-2 minutes of DB writes

  // Breakdown:
  // Fastest case: ~2-3 minutes (cached results, fast APIs)
  // Normal case: ~10-15 minutes (fresh research)
  // Slow case: ~20+ minutes (API timeouts, retries)
}
```

### Issue 2: Stall Detection Too Aggressive

```typescript
// Current stall detection (useSearchStallDetection)
const STALL_THRESHOLD = 30 * 1000;  // 30 seconds

// For 10-minute jobs, this means:
// - Job completes in 600 seconds
// - Progress updated every 5-30 seconds
// - At minute 1: 0 stalls
// - At minute 2: 1 stall (progress at 0:35s)
// - At minute 3: 2 stalls
// ....
// User sees ~18 "stalled" notifications!
// This is WRONG for long-running jobs
```

### Issue 3: Frontend Polling Not Scaled

```typescript
// Current polling strategy
refetchInterval = {
  0-30s: 2s (aggressive),
  30-60s: 5s (reduced),
  60s+: 10s (minimal)
}

// Problem: Job takes 10 minutes (600s)
// After 60s: Only polling every 10 seconds
// If something goes wrong at minute 3:
// - User doesn't get notified for 10 seconds
// - Then waits another 10s for realtime update to trigger
// - Total delay: 20 seconds
// - For 10-minute jobs, this polling schedule makes sense
```

### Issue 4: No Long-Running Job Infrastructure

Current assumptions:
- Single function call completes everything
- Progress tracked in `searches.progress_step`
- No sub-task breakdown
- No recovery from partial failures
- No way to resume interrupted jobs

What's missing:
- Job queue with priority/retry logic
- Sub-task tracking (which stages completed?)
- Checkpoint system (resume from failure point)
- Distributed processing (break into smaller functions)

---

## Is Current Architecture "Fit for Purpose"?

### ✅ What Works Well

1. **Supabase Edge Functions are good for:**
   - Short-running operations (<5 minutes)
   - Fire-and-forget async jobs (with polling)
   - Stateless API orchestration
   - Database-backed progress tracking

2. **Real-time polling works for:**
   - User feedback during processing
   - Graceful stall detection
   - Interrupt/retry mechanisms
   - Session persistence

3. **Concurrent API execution is efficient:**
   - Reduces total wall-clock time
   - Company + Job + CV research run in parallel
   - Only adds ~2 minutes vs sequential

### ❌ What Doesn't Work

1. **10-15 minute jobs with 30s stall detection**
   - User sees constant "stalled" warnings
   - Stall threshold (30s) is unrealistic for long jobs
   - Creates false sense of failure

2. **Single monolithic function doing everything**
   - If any step fails halfway through, restart entire process
   - No recovery from partial completion
   - Wastes time re-doing successful steps

3. **Polling frequency doesn't match job duration**
   - After 60s, only polling every 10 seconds
   - Fine for 2-minute jobs, problematic for 10-minute jobs
   - Users feel left in the dark

4. **Progress percentage is misleading**
   - Assumes linear progress: 10% per minute
   - Reality: Company research (5 min) = 30%, Job analysis (5 min) = 20%
   - Frontend estimate ("2 min remaining") is wildly inaccurate

---

## Recommended Architecture Redesign

### Option 1: Current Architecture (Optimized)
**Keep monolithic function, fix expectations**

**Changes:**
```
✅ Keep:  Single interview-research function
✅ Keep:  Real-time polling for progress
✅ Keep:  Async job processing pattern

❌ Fix:
   - Stall threshold: 30s → 3 minutes
   - Progress polling: More aggressive throughout
   - Progress percentages: Reflect actual timing
   - UI messaging: "Processing (6 min elapsed, ~4 min remaining)"
```

**Pros:**
- Minimal code changes
- Keeps current architecture
- Works for 10-15 minute jobs
- Simple to understand and debug

**Cons:**
- Still no recovery from partial failures
- No ability to resume interrupted jobs
- Single point of failure
- Can't pause/resume

**Timeline:** 10-15 minutes ✓

---

### Option 2: Distributed Task Queue (Recommended)
**Break processing into independent tasks**

```
Frontend
   │
   └─ POST /interview-research (create job)
      │
      ├─ Job ID: abc-123
      └─ Status: QUEUED

Backend (Job Queue)
   │
   ├─ Task 1: company-research
   │   └─ Save results to DB
   │
   ├─ Task 2: job-analysis (waits for Task 1)
   │   └─ Save results to DB
   │
   ├─ Task 3: cv-analysis (parallel with 1 & 2)
   │   └─ Save results to DB
   │
   ├─ Task 4: question-generation (waits for 1 & 2)
   │   └─ Save results to DB
   │
   └─ Task 5: interview-synthesis (waits for all)
       └─ Save results to DB

Frontend (Real-time Updates)
   └─ Subscribe to job events
      ├─ company-research: COMPLETED (with %)
      ├─ job-analysis: COMPLETED (with %)
      ├─ cv-analysis: COMPLETED (with %)
      ├─ question-generation: COMPLETED (with %)
      └─ interview-synthesis: COMPLETED
```

**Implementation:**

1. **Create job queue table:**
```sql
CREATE TABLE job_queue (
  id UUID PRIMARY KEY,
  search_id UUID REFERENCES searches(id),
  user_id UUID REFERENCES auth.users(id),
  status ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'),
  tasks JSONB,  -- Array of task statuses
  created_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE task_logs (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES job_queue(id),
  task_name VARCHAR,
  status ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED'),
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

2. **Create worker functions:**
```
supabase/functions/
├── interview-research-queue/      # Creates job, queues tasks
├── task-company-research/         # Runs independently
├── task-job-analysis/
├── task-cv-analysis/
├── task-question-generation/
├── task-interview-synthesis/
└── task-worker/                   # Processes job queue
```

3. **Job execution flow:**
```
interview-research-queue (10s)
  ├─ Create job record
  ├─ Queue tasks (company, job, cv analysis in parallel)
  └─ Return immediately with job ID

task-worker (runs periodically, every 5s)
  ├─ Check for QUEUED tasks
  ├─ Execute eligible tasks (respecting dependencies)
  ├─ Update task status in DB
  └─ Frontend polls job_queue for progress

Frontend polling
  ├─ /api/job-status/abc-123
  ├─ Returns: { tasks: [...], completion: 45%, elapsed: "3:20" }
  └─ Realtime updates via subscriptions
```

**Pros:**
- ✅ Long-running jobs (no timeout risk)
- ✅ Partial failure recovery (restart specific tasks)
- ✅ Scalable (multiple workers can process queue)
- ✅ Better resource utilization
- ✅ Pause/resume capability
- ✅ Accurate progress tracking
- ✅ Can add priority jobs

**Cons:**
- ❌ More complex infrastructure
- ❌ Need job queue + task tables
- ❌ Worker function needs polling/scheduling
- ❌ More code to maintain

**Timeline:** 10-15 minutes ✓

**Cost:** Same (same API calls, just orchestrated differently)

---

### Option 3: Pub/Sub with External Job Processor (Enterprise)
**Use message queue for job orchestration**

```
Frontend → Create Job → Firebase Pub/Sub
              ↓
           Job Queue
              ↓
         [Worker Pool]
    ├─ task-company-research
    ├─ task-job-analysis
    ├─ task-cv-analysis
    └─ task-question-generation
              ↓
         Update Job Status (DB)
              ↓
        Frontend (Real-time via subscriptions)
```

**Pros:**
- Best scalability
- Perfect for distributed systems
- Enterprise-grade reliability
- Auto-recovery from failures

**Cons:**
- Requires external service (Firebase, RabbitMQ, AWS SQS, etc.)
- Higher infrastructure complexity
- Higher costs
- Overkill for current scale

**Not recommended unless:** You expect 1000+ concurrent jobs

---

## My Recommendation

### Short Term: Option 1 (Optimized Current Architecture)

**Rationale:**
- Minimal changes required
- Fixes the immediate UX problem
- Keeps architecture simple
- Works well for current scale

**Changes:**

1. **Update stall detection:**
```typescript
// Old
const STALL_THRESHOLD = 30 * 1000;  // 30 seconds

// New
const STALL_THRESHOLD = 3 * 60 * 1000;  // 3 minutes
```

2. **Update progress polling:**
```typescript
// Old
refetchInterval = {
  0-30s: 2s,
  30-60s: 5s,
  60s+: 10s
}

// New - for 10-15 minute jobs
refetchInterval = {
  0-2min: 2s,
  2-5min: 5s,
  5-10min: 10s,
  10min+: 15s
}
```

3. **Realistic progress percentages:**
```typescript
PROGRESS_STEPS = {
  INITIALIZING: 1%,                       // 0-3s
  COMPANY_RESEARCH_START: 10%,            // ~20-30s
  COMPANY_RESEARCH_COMPLETE: 20%,
  JOB_ANALYSIS_START: 25%,                // ~15-20s
  JOB_ANALYSIS_COMPLETE: 35%,
  CV_ANALYSIS_START: 40%,                 // ~10-15s
  CV_ANALYSIS_COMPLETE: 50%,
  QUESTION_GENERATION_START: 55%,         // ~30-40s
  QUESTION_GENERATION_COMPLETE: 75%,
  INTERVIEW_SYNTHESIS_START: 80%,         // ~20-30s
  INTERVIEW_SYNTHESIS_COMPLETE: 90%,
  SAVING_TO_DATABASE: 95%,                // ~1-2 minutes
  COMPLETED: 100%
}
```

4. **Better UI messaging:**
```typescript
// Current
"Taking longer than expected, retrying..."

// Better
"Processing Interview Research (Step 3/5): Analyzing job requirements"
"Elapsed: 4m 23s | Estimated remaining: 6m 15s"
"✓ Company Research (2m 14s)"
"✓ Job Analysis (1m 52s)"
"⏳ CV Analysis (in progress...)"
"⏸ Question Generation (waiting)"
"⏸ Interview Synthesis (waiting)"
```

**Effort:** 2-3 hours
**Risk:** Low
**Benefits:** Better UX, accurate expectations

---

### Medium Term: Option 2 (Distributed Tasks)

**When to implement:**
- If you hit Edge Function timeout limits
- If you need partial failure recovery
- If you want to scale to 100+ concurrent users
- If you need to pause/resume jobs

**Effort:** 20-30 hours
**Risk:** Medium (requires careful task dependency management)
**Benefits:** Reliability, scalability, recovery

---

## Actual Processing Time Breakdown

Based on current API performance:

```
┌─────────────────────────────────────┐
│ FRESH RESEARCH (No Cached Results)  │
├─────────────────────────────────────┤
│ Company Research         ~5-7 min    │
│   ├─ Tavily searches     ~30-45s     │
│   ├─ URL extraction      ~1-2 min    │
│   └─ OpenAI synthesis    ~2-3 min    │
│                                     │
│ Job Analysis             ~3-4 min    │
│   ├─ URL extraction      ~1-2 min    │
│   └─ OpenAI analysis     ~1-2 min    │
│                                     │
│ CV Analysis              ~2-3 min    │
│   └─ OpenAI parsing      ~2-3 min    │
│                                     │
│ Question Generation      ~4-5 min    │
│   ├─ Interviews                 │
│   ├─ Per-stage generation       │
│   └─ Synthesis           ~2-3 min    │
│                                     │
│ Interview Synthesis      ~2-3 min    │
│   └─ Complex AI synthesis         │
│                                     │
│ Database Writes          ~1-2 min    │
│   ├─ Questions (~150)    ~30-45s     │
│   ├─ Stages              ~10-15s     │
│   ├─ CV data             ~10-15s     │
│   └─ Comparison data     ~10-15s     │
│                                     │
├─────────────────────────────────────┤
│ TOTAL (Fresh Research):  10-15 min   │
│ TOTAL (Cached Results):  2-3 min     │
└─────────────────────────────────────┘
```

---

## Environment Variables for Configuration

All configurable values are in `.env.example`:

**Key variables:**
- `OPENAI_*_MODEL`: Which OpenAI model to use per operation
- `OPENAI_*_MAX_TOKENS`: Response length limits
- `CONCURRENT_TIMEOUT_*`: Timeout for each API call
- `TAVILY_*`: Search configuration and limits
- `FEATURE_*`: Feature flags for behavior control
- `LOG_*`: Logging configuration

See `.env.example` for complete documentation.

---

## Next Steps

### Immediate (This Week)
1. ✅ Create `.env.example` with all variables
2. ⏳ Update stall detection threshold to 3 minutes
3. ⏳ Update progress polling for 10-15 minute jobs
4. ⏳ Realistic progress percentages
5. ⏳ Better UI messaging

### Short Term (Next 2-4 Weeks)
- Monitor actual processing times
- Collect user feedback on 10-minute wait time
- Optimize slowest steps (usually Tavily/OpenAI)

### Medium Term (Next 2-3 Months)
- Implement distributed task queue (Option 2) if needed
- Add job pause/resume capability
- Implement partial failure recovery

---

## Conclusion

**The current architecture IS fit for purpose** with optimizations:

1. **Realistic expectations:** 10-15 minutes for fresh research
2. **Smart stall detection:** 3-minute threshold instead of 30 seconds
3. **Proper polling:** Adjusted for long-running jobs
4. **Clear messaging:** Show actual progress, not misleading percentages

**No need for redesign today**, but keep Option 2 (distributed tasks) in mind for scaling.

