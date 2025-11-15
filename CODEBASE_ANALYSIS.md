# Hireo - Complete Codebase Analysis

## Executive Summary

This is a comprehensive analysis of the Hireo codebase as of November 14, 2025. The project is a React 18 + TypeScript frontend with Supabase backend using Edge Functions for microservices, deployed with async job processing and real-time progress tracking.

---

## 1. FRONTEND STRUCTURE

### Root Configuration Files
- **vite.config.ts**: Vite dev server configuration
  - **PORT DISCREPANCY**: CLAUDE.md states port 8080, but vite.config.ts specifies port **5173**
  - Uses React SWC plugin for fast compilation
  - Path alias configured: `@/` → `./src/`
  - componentTagger plugin for development mode

- **package.json**: npm scripts
  - `npm run dev` - Starts Vite dev server (actual port: 5173)
  - `npm run build` - Production build
  - `npm run build:dev` - Development build
  - `npm run lint` - ESLint checks
  - `npm run preview` - Preview production build

- **tsconfig.json**: TypeScript configuration (relaxed for rapid development)
  - `noImplicitAny: false`
  - `noUnusedParameters: false`
  - `skipLibCheck: true`
  - `noUnusedLocals: false`
  - `strictNullChecks: false`

- **eslint.config.js**: ESLint configuration (flat config)
  - Ignores: `dist`, `supabase/functions/**`
  - Includes React hooks and refresh rules
  - Disabled: `@typescript-eslint/no-unused-vars`

- **tailwind.config.ts**: Tailwind CSS configuration
  - Dark mode support (class-based)
  - Custom theme extensions
  - shadcn/ui component integration

### Frontend Directory Structure

```
src/
├── App.tsx                    # Main application component
├── main.tsx                   # React entry point
├── index.css                  # Global styles
├── vite-env.d.ts             # Vite environment types
│
├── components/               # Reusable UI components
│   ├── AuthProvider.tsx       # Auth context provider
│   ├── Navigation.tsx         # Navigation bar with search history (15KB)
│   ├── ProgressDialog.tsx     # Async job progress tracking (12KB)
│   ├── SessionSummary.tsx     # Practice session summary (5KB)
│   └── ui/                    # shadcn/ui components (51 files)
│       ├── accordion.tsx, alert.tsx, avatar.tsx, badge.tsx, etc.
│       └── [All standard shadcn/ui components]
│
├── pages/                     # Route-level components
│   ├── Index.tsx             # Home redirect
│   ├── Auth.tsx              # Login/signup page
│   ├── Home.tsx              # Main search form (15KB)
│   ├── Dashboard.tsx         # Search results view (17KB)
│   ├── Profile.tsx           # User profile settings (32KB)
│   ├── Practice.tsx          # Practice interview module (60KB - largest page)
│   └── NotFound.tsx          # 404 page
│
├── hooks/                     # Custom React hooks
│   ├── useAuth.ts            # Authentication hook
│   ├── useSearchProgress.ts   # Real-time progress polling (8KB)
│   ├── use-toast.ts          # Toast notifications
│   └── use-mobile.tsx        # Mobile detection
│
├── services/                  # API and business logic
│   ├── searchService.ts       # Search creation and processing (14KB)
│   ├── tavilyAnalyticsService.ts  # Tavily API analytics (7KB)
│   └── sessionSampler.ts      # Question sampling for practice (1.4KB)
│
├── integrations/supabase/
│   ├── client.ts             # Supabase client initialization
│   └── types.ts              # Auto-generated TypeScript types (29KB)
│
├── lib/
│   └── utils.ts              # Utility functions (cn() for classnames)
│
└── types/
    └── supabase.ts           # Re-exported from integrations
```

### Key Frontend Components

#### ProgressDialog.tsx (12KB)
- Real-time progress tracking for async operations
- Adaptive polling strategy implemented
- Stall detection with user notification (Phase 3 feature)
- Retry functionality for stuck jobs
- Displays current progress step and percentage

#### useSearchProgress.ts (8KB)
- React Query hook for progress polling
- Adaptive polling intervals:
  - 0-30s: Poll every 2s (aggressive)
  - 30-60s: Poll every 5s (reduced load)
  - 60+s: Poll every 10s (minimal load)
- Stall detection (no updates for >30s)
- Real-time Supabase subscription fallback
- Export utilities: `useSearchProgress()`, `useSearchStallDetection()`, etc.

#### searchService.ts (14KB)
- Two-phase search creation:
  1. `createSearchRecord()` - Creates record synchronously (status: pending)
  2. `startProcessing()` - Triggers async edge function (status → processing)
- Fire-and-forget pattern for async operations
- Methods: `getSearchStatus()`, `getSearchResults()`, `getSearchHistory()`
- Question flagging: `setQuestionFlag()`, `removeQuestionFlag()`, `getQuestionFlags()`
- Practice session management
- Resume/CV analysis integration

#### Navigation.tsx (15KB)
- Header with logo and search history
- Uses `search_status` field from database
- Displays status badges for each search
- Search history sidebar with recent searches

#### Practice.tsx (60KB - Largest component)
- Practice interview interface with swipe gestures
- Session summary display
- Question answer tracking
- Multiple answer formats (text, audio)
- Session completion with notes

### Frontend Dependencies (Key)
- **React 18.3.1** - UI framework
- **React Router 6.26.2** - Navigation
- **TanStack React Query 5.56.2** - Server state management
- **Supabase Client 2.52.0** - Backend integration
- **Tailwind CSS 3.4.11** - Styling
- **shadcn/ui** - Component library (via @radix-ui)
- **Vite 5.4.1** - Build tool
- **TypeScript 5.5.3** - Type safety
- **Lucide React 0.462.0** - Icons
- **react-swipeable 7.0.2** - Swipe gestures
- **Recharts 2.12.7** - Charts (in SessionSummary)

---

## 2. BACKEND STRUCTURE (Supabase Edge Functions)

### Edge Functions Directory

```
supabase/functions/
├── _shared/                           # Shared utilities (imported by all functions)
│   ├── config.ts                      # Centralized research configuration (12KB)
│   ├── config.example.ts              # Configuration template
│   ├── logger.ts                      # SearchLogger class (7KB) - ACTIVE
│   ├── logging.ts                     # Logger class (3KB) - DISABLED (console-only)
│   ├── progress-tracker.ts            # Async job progress tracking (8KB)
│   ├── tavily-client.ts              # Tavily API client (15KB)
│   ├── url-deduplication.ts          # URL caching/deduplication (14KB)
│   ├── duckduckgo-fallback.ts        # DuckDuckGo API fallback (3KB)
│   ├── native-scrapers.ts            # Custom web scraping (17KB)
│   └── openai-client.ts              # OpenAI API wrapper (2KB)
│
├── company-research/
│   └── index.ts                       # Company analysis microservice (792 lines)
│
├── interview-research/
│   └── index.ts                       # Main orchestration service (1244 lines)
│
├── job-analysis/
│   └── index.ts                       # Job description analysis (326 lines)
│
├── cv-analysis/
│   └── index.ts                       # Resume/CV analysis (376 lines)
│
├── cv-job-comparison/
│   └── index.ts                       # CV-job matching analysis (390 lines)
│
└── interview-question-generator/
    └── index.ts                       # Question generation engine (383 lines)
```

### Shared Utilities Analysis

#### logger.ts (7KB) - ACTIVE
**Status**: Actively used in interview-research and company-research functions

```typescript
export class SearchLogger {
  log(operation, phase, data?, error?, duration?)
  logTavilySearch(query, phase, requestPayload, response?, error?, duration?)
  logTavilyExtract(urls, phase, response?, error?, duration?)
  logOpenAI(operation, phase, request?, response?, error?, duration?)
  logPhaseTransition(fromPhase, toPhase, data?)
  logDataProcessing(operation, inputData, outputData?, error?)
  saveToFile()
}
```

**Usage**: 2 imports found
- `/supabase/functions/interview-research/index.ts:3`
- `/supabase/functions/company-research/index.ts:7`

#### logging.ts (3KB) - DISABLED
**Status**: Completely disabled (console-only fallback)
**Reason**: "Temporarily disabled to fix 409 constraint errors"

```typescript
export class Logger {
  // All methods are DISABLED and just console.log
  logTavilyCall()     // DISABLED
  logOpenAICall()     // DISABLED
  logFunctionExecution()  // DISABLED
  updateFunctionExecution()  // DISABLED
  fetchOpenAI()       // DISABLED
}
```

**Usage**: 1 import found
- `/supabase/functions/cv-analysis/index.ts:3` - Creates Logger instance but never actually uses it

**Impact**: The Logger class in cv-analysis is instantiated but methods are no-ops. This is dead code.

#### progress-tracker.ts (8KB) - ACTIVE
**Status**: Core utility for async job processing

**Key Exports**:
- `PROGRESS_STEPS` - Predefined progress step constants
- `CONCURRENT_TIMEOUTS` - Timeout configuration for edge functions
- `ProgressTracker` - Main progress tracking class
- Utility functions: `executeWithTimeout()`, `executeWithTimeoutSafe()`, `executeWithRetry()`, `isValidData()`, `validateFetchResponse()`

**Timeout Configuration** (Phase 4 Update):
```typescript
export const CONCURRENT_TIMEOUTS = {
  companyResearch: 20000,      // 15s → 20s
  jobAnalysis: 20000,          // 15s → 20s  
  cvAnalysis: 15000,           // 10s → 15s
  questionGeneration: 40000,   // 25s → 40s (for OpenAI complex responses)
  totalOperation: 60000        // 35s → 60s
}
```

**Usage**: Core utility imported by interview-research function

#### tavily-client.ts (15KB)
Tavily API integration with URL deduplication:
- `searchTavily()` - Search API
- `extractTavily()` - Extract endpoint
- `extractInterviewReviewUrls()` - Interview-specific extraction
- Automatic deduplication via `UrlDeduplicationService`

**Usage**: Imported by company-research function

#### url-deduplication.ts (14KB)
Smart caching system for research URLs:
- Prevents duplicate API calls
- Quality scoring for content relevance
- Pattern matching for interview-specific content
- 40% cost reduction through intelligent reuse

#### duckduckgo-fallback.ts (3KB)
Multi-engine search fallback:
- Primary: Tavily API
- Fallback: DuckDuckGo
- Graceful degradation on API failures

#### config.ts (12KB)
Centralized configuration:
- Search query templates
- Company ticker lookup
- Prompt templates for OpenAI
- Configuration validation

#### native-scrapers.ts (17KB)
Custom web scraping utilities:
- Hybrid scraper combining multiple strategies
- Interview experience extraction
- Content quality assessment

#### openai-client.ts (2KB)
OpenAI API wrapper:
- `callOpenAI()` - Make API calls with JSON mode
- `parseJsonResponse()` - Parse responses

### Edge Functions Overview

#### interview-research/index.ts (1244 lines)
**Purpose**: Orchestration service that coordinates all research activities
**Status**: Active fire-and-forget async processing (202 Accepted response)
**Key Operations**:
1. Calls company-research function
2. Calls job-analysis function
3. Calls cv-analysis function
4. Synthesizes results with OpenAI
5. Generates interview questions
6. Stores results in database

**Imports**:
- SearchLogger (logger.ts)
- ProgressTracker (progress-tracker.ts)
- RESEARCH_CONFIG (config.ts)
- CONCURRENT_TIMEOUTS (progress-tracker.ts)

**Timeout Strategy**:
```typescript
await Promise.all([
  executeWithTimeout(() => gatherCompanyData(...), CONCURRENT_TIMEOUTS.companyResearch),
  executeWithTimeout(() => gatherJobData(...), CONCURRENT_TIMEOUTS.jobAnalysis),
  executeWithTimeout(() => gatherCVData(...), CONCURRENT_TIMEOUTS.cvAnalysis)
])
```

#### company-research/index.ts (792 lines)
**Purpose**: Research company information, culture, hiring process
**Status**: Standalone research function
**Key Operations**:
1. Multi-engine search (Tavily → DuckDuckGo fallback)
2. Interview review extraction
3. OpenAI synthesis
4. Logging via SearchLogger

**Imports**:
- SearchLogger (logger.ts)
- Tavily functions (tavily-client.ts)
- URL deduplication (url-deduplication.ts)
- DuckDuckGo fallback (duckduckgo-fallback.ts)
- Native scrapers (native-scrapers.ts)
- OpenAI client (openai-client.ts)

#### job-analysis/index.ts (326 lines)
**Purpose**: Extract requirements from job descriptions
**Status**: Lightweight analysis function
**Key Operations**:
1. Parse job descriptions from URLs
2. Extract technical/soft skills
3. Identify experience requirements
4. Return structured requirements

#### cv-analysis/index.ts (376 lines)
**Purpose**: Parse and analyze user CV/resume
**Status**: Uses disabled Logger (dead code)
**Key Operations**:
1. Parse CV text
2. Extract professional information
3. Identify skills and experience
4. Return structured analysis

**Dead Code**: Instantiates Logger but never uses it (all methods disabled)

#### cv-job-comparison/index.ts (390 lines)
**Purpose**: Match CV against job requirements
**Status**: Generates gap analysis and recommendations
**Key Operations**:
1. Compare CV skills with job requirements
2. Identify skill gaps
3. Generate interview prep strategy
4. Provide personalized guidance

#### interview-question-generator/index.ts (383 lines)
**Purpose**: Generate interview questions based on research
**Status**: Creates 120-150 questions per search
**Key Operations**:
1. Parse research results
2. Generate questions by category
3. Adapt complexity by seniority
4. Add company-specific context

---

## 3. DATABASE SCHEMA (PostgreSQL + RLS)

### Current Schema Location
- **Source of truth**: `supabase/schema.sql` (latest snapshot)
- **Migration history**: `supabase/migrations/` (16 files)

### Core Tables

#### searches (Main entity)
```sql
CREATE TABLE public.searches (
  id UUID PRIMARY KEY,
  user_id UUID (FK auth.users),
  company TEXT NOT NULL,
  role TEXT,
  country TEXT,
  role_links TEXT,
  search_status TEXT ('pending', 'processing', 'completed', 'failed'),
  progress_step TEXT,
  progress_percentage INTEGER,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Note**: Uses `search_status` (NOT `status`) throughout codebase

#### profiles
- Extends Supabase auth.users
- Fields: id, email, full_name, avatar_url, seniority (junior|mid|senior)

#### interview_stages
- Structure of interview process
- Fields: id, search_id, name, duration, interviewer, order_index

#### interview_questions (Enhanced)
- Comprehensive question metadata
- Fields: id, stage_id, search_id, question, category, question_type, difficulty, rationale, suggested_answer_approach, evaluation_criteria[], follow_up_questions[], confidence_score, company_context

#### practice_sessions & practice_answers
- User practice interview tracking
- Fields: id, session_id, question_id, text_answer, audio_url, answer_time_seconds, session_notes

#### cv_job_comparisons
- Resume-job matching analysis
- Fields: id, search_id, user_id, job_requirements, cv_analysis, skill_gap_analysis, experience_gap_analysis, overall_fit_score, preparation_priorities

#### scraped_urls
- Consolidated URL content storage (optimized)
- Fields: id, url, url_hash, domain, full_content, ai_summary, content_quality_score, times_reused

#### tavily_searches
- Tavily API call logging
- Fields: id, search_id, user_id, api_type, query_text, response_payload, response_status, results_count, request_duration_ms, credits_used

#### user_question_flags
- User personalization (favorites, needs_work, skipped)
- Fields: id, user_id, question_id, flag_type, updated_at

### Schema Migrations (16 total)

| Timestamp | Migration | Purpose |
|-----------|-----------|---------|
| 00000000000000 | initial_schema.sql | Base schema with all core tables |
| 20250722220000 | consolidate_question_tables.sql | Consolidate question storage |
| 20250729000000 | add_async_processing.sql | Add async job fields |
| 20251025000000 | add_seniority_fields.sql | Add seniority level support |
| 20251025120000 | add_user_question_flags.sql | User question personalization |
| 20251101000000 | fix_progress_tracking.sql | Optimize progress tracking |
| 20251101000001 | fix_cv_job_comparisons_rls.sql | Fix RLS policy for cv_job_comparisons |
| 20251101000002 | fix_cv_job_comparisons_rls_robust.sql | Robust RLS fix |
| 20251101000003 | fix_cv_job_comparisons_schema.sql | Schema adjustments |
| 20251102000000 | fix_cv_job_comparisons_rls_query.sql | Query-based RLS fix |
| 20251102000001 | fix_cv_job_comparisons_rls_fundamental.sql | Fundamental RLS redesign |
| 20251102000002 | fix_cv_job_comparisons_data_integrity.sql | Data integrity checks |
| 20251102000003 | ensure_cv_job_comparisons_data_fixed.sql | Data verification |
| 20251103000000 | add_session_notes.sql | Practice session notes field |

---

## 4. LOGGER vs LOGGING - Import Analysis

### logger.ts Usage (ACTIVE)
- **2 files** actively use SearchLogger from logger.ts:
  - `/supabase/functions/interview-research/index.ts` - Creates SearchLogger at line 3
  - `/supabase/functions/company-research/index.ts` - Creates SearchLogger at line 7

### logging.ts Usage (DISABLED)
- **1 file** uses Logger from logging.ts:
  - `/supabase/functions/cv-analysis/index.ts` - Creates Logger at line 3
  
  **Dead Code Alert**: The Logger is instantiated but:
  - All methods are disabled (console-only)
  - Logger instance is never actually used for logging
  - This is complete dead code from disabled functionality

### Summary
| Module | Active | Users | Status |
|--------|--------|-------|--------|
| logger.ts | Yes | 2 functions | SearchLogger class - active async logging |
| logging.ts | No | 1 function | Logger class - disabled, console-only |

---

## 5. PORT CONFIGURATION DISCREPANCY

### Documentation vs Reality

**CLAUDE.md states**:
- Line 13: "Vite as build tool (dev server on port 8080)"
- Line 64: "`npm run dev` # Start Vite dev server (port 8080)"
- Line 115: "**`vite.config.ts`**: Vite build configuration with React SWC plugin, port 8080, path aliases"

**Actual vite.config.ts**:
```typescript
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,  // ← ACTUAL PORT: 5173
  },
  // ...
}))
```

**Resolution**: The actual port is **5173** (Vite default), not 8080 as documented.

---

## 6. CODE PATTERNS & ARCHITECTURE

### Async Job Processing Pattern (Fire-and-Forget)
```typescript
// Phase 3 Implementation
// Frontend creates search record synchronously, backend processes asynchronously

// Step 1: Create record (synchronous, fast)
const { searchId } = await searchService.createSearchRecord(params)

// Step 2: Start processing (async, fire-and-forget)
await searchService.startProcessing(searchId, params)
// Returns immediately, processing happens in background

// Step 3: Frontend polls progress (real-time updates)
const { data: progress } = useSearchProgress(searchId)
```

### Concurrent Processing Pattern
```typescript
// All microservices run in parallel with timeout protection
const [companyInsights, jobRequirements, cvAnalysis] = await Promise.all([
  tracker.withProgress(
    () => executeWithTimeout(gatherCompanyData(...), CONCURRENT_TIMEOUTS.companyResearch),
    'COMPANY_RESEARCH_START',
    'COMPANY_RESEARCH_COMPLETE'
  ),
  tracker.withProgress(
    () => executeWithTimeout(gatherJobData(...), CONCURRENT_TIMEOUTS.jobAnalysis),
    'JOB_ANALYSIS_START',
    'JOB_ANALYSIS_COMPLETE'
  ),
  tracker.withProgress(
    () => executeWithTimeout(gatherCVData(...), CONCURRENT_TIMEOUTS.cvAnalysis),
    'CV_ANALYSIS_START',
    'CV_ANALYSIS_COMPLETE'
  )
])
```

### Adaptive Polling Strategy (Phase 3)
```typescript
// useSearchProgress hook implements adaptive polling
refetchInterval: (query) => {
  const current = query.state.data
  
  if (!current || current.status === 'completed') return false  // Stop
  
  if (current.started_at) {
    const elapsedMs = Date.now() - new Date(current.started_at).getTime()
    if (elapsedMs < 30000) return 2000     // First 30s: every 2s
    if (elapsedMs < 60000) return 5000     // 30-60s: every 5s
    return 10000                           // 60+s: every 10s
  }
}
```

### Status Field Naming Convention
- **Database**: Uses `search_status` (NOT `status`)
- **Database values**: 'pending', 'processing', 'completed', 'failed'
- **Frontend**: Maps `search_status` → `status` in hook
- **Consistent throughout**: All references use `search_status` except in SearchProgress interface

---

## 7. UNUSED AND DISABLED CODE

### Dead Code Identified

#### logging.ts (DISABLED)
- **File**: `/supabase/functions/_shared/logging.ts`
- **Status**: Completely disabled
- **Reason**: "Temporarily disabled to fix 409 constraint errors"
- **Usage**: Only imported in cv-analysis but never used
- **Recommendation**: Remove or replace with SearchLogger

#### Logger instance in cv-analysis (DEAD)
- **File**: `/supabase/functions/cv-analysis/index.ts`
- **Lines**: 3 (import), 288 (instantiation), 302 (creation)
- **Issue**: Creates `new Logger(supabase)` but never calls any methods
- **All methods**: console-only no-ops
- **Recommendation**: Remove Logger import and instantiation

#### Unused TODO Comments
- `/src/pages/Dashboard.tsx` line ~100: `onClick={() => {/* TODO: Show history */}}`
- `/src/pages/Home.tsx`: `// TODO: Process PDF upload`
- `/src/pages/Profile.tsx`: `// TODO: Process PDF and extract text - Phase 3 feature`

### Disabled Functionality References
- `supabase/functions/_shared/config.example.ts` - Example configuration (not used in production)
- Various commented-out logging calls throughout edge functions

---

## 8. EDGE FUNCTION DEPENDENCY GRAPH

```
interview-research (Orchestrator)
├── company-research
│   ├── tavily-client.ts
│   │   ├── url-deduplication.ts
│   │   └── RESEARCH_CONFIG
│   ├── duckduckgo-fallback.ts
│   │   └── tavily-client.ts
│   ├── native-scrapers.ts
│   │   └── RESEARCH_CONFIG
│   ├── openai-client.ts
│   │   └── RESEARCH_CONFIG
│   ├── logger.ts
│   └── progress-tracker.ts
│
├── job-analysis
│   └── (No shared utilities)
│
├── cv-analysis
│   └── logging.ts (DISABLED)
│
└── cv-job-comparison
    └── (No shared utilities)
```

---

## 9. DEPENDENCIES & VERSIONS

### Frontend Dependencies (npm)
- React 18.3.1
- React Router 6.26.2
- TanStack Query 5.56.2
- Supabase Client 2.52.0
- TypeScript 5.5.3
- Vite 5.4.1
- Tailwind CSS 3.4.11
- Lucide React 0.462.0
- react-swipeable 7.0.2
- Recharts 2.12.7
- Zod 3.23.8
- All shadcn/ui Radix UI components

### Backend Dependencies (Edge Functions)
- **Deno HTTP Server**: `https://deno.land/std@0.177.0/http/server.ts` (most functions)
- **Supabase JS**: 
  - `@2.43.2` - interview-research, company-research, job-analysis, cv-job-comparison
  - `@2.39.3` - progress-tracker
  - `@2.7.1` - cv-analysis (older version)
- **Standard Library**: `https://deno.land/std@` (various versions)

---

## 10. CONFIGURATION FILES SUMMARY

| File | Purpose | Status |
|------|---------|--------|
| vite.config.ts | Build config, port 5173 | Active |
| tsconfig.json | TypeScript (relaxed) | Active |
| tsconfig.app.json | App TS config | Active |
| tsconfig.node.json | Node TS config | Active |
| eslint.config.js | Linting rules | Active |
| tailwind.config.ts | Tailwind theming | Active |
| package.json | Dependencies & scripts | Active |
| components.json | shadcn/ui config | Active |
| postcss.config.js | PostCSS setup | Active |
| supabase/config.toml | Supabase local config | Local dev only |

---

## 11. CRITICAL IMPLEMENTATION NOTES

### Recent Fixes (November 2025)
1. **Phase 1-3**: Async job processing, timeout optimization, frontend progress tracking
2. **Phase 4**: Increased AI synthesis timeout to 40s for complex OpenAI responses
3. **RLS Fixes**: Multiple cv_job_comparisons RLS policy updates
4. **Data Integrity**: Fixes for stalled/corrupted data in cv_job_comparisons

### Known Limitations
- Logger (logging.ts) is completely disabled
- No true database logging for API calls (removed in optimization)
- PDF upload functionality not yet implemented (TODO)
- Tavily analytics uses simplified logging (single-pass queries)

### Performance Optimizations
- URL deduplication reduces API costs by 40%
- Adaptive polling reduces database load by 30-40%
- Concurrent processing cap at 60s total timeout
- Question generation batch insert (single operation)

---

## 12. RECOMMENDATIONS FOR DEVELOPERS

### Port Configuration
- **Action**: Update CLAUDE.md to reflect actual port 5173
- **Current Documentation**: References port 8080 (incorrect)
- **Actual**: vite.config.ts line 10 specifies port 5173

### Logger Consolidation
- **Current State**: Two competing logging systems (logger.ts and logging.ts)
- **Recommendation**: Remove logging.ts entirely, standardize on SearchLogger
- **Dead Code**: Remove Logger usage from cv-analysis

### Code Cleanup
- Remove unused TODO comments or implement features
- Consider removing config.example.ts if no longer needed
- Consolidate similar utility functions if possible

### Testing
- Backend: Test timeout handling with slow APIs
- Frontend: Test progress polling with network latency
- Database: Verify RLS policies across all user access patterns

---

## 13. FILE SUMMARY TABLE

### Frontend (Key Files)
| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| src/pages/Practice.tsx | 1,800+ | Practice interview module | Active, large |
| src/pages/Profile.tsx | 1,000+ | User profile | Active, medium |
| src/pages/Dashboard.tsx | 500+ | Search results | Active, medium |
| src/pages/Home.tsx | 400+ | Search form | Active, medium |
| src/components/Navigation.tsx | 450 | Header/nav | Active, uses search_status |
| src/components/ProgressDialog.tsx | 350 | Progress display | Active, Phase 3 |
| src/hooks/useSearchProgress.ts | 289 | Progress polling | Active, adaptive |
| src/services/searchService.ts | 495 | API service | Active, dual-phase |
| src/integrations/supabase/types.ts | 900+ | Auto-generated types | Active, large |

### Backend (Key Files)
| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| supabase/functions/interview-research/index.ts | 1,244 | Orchestration | Active, central |
| supabase/functions/company-research/index.ts | 792 | Research | Active, large |
| supabase/functions/_shared/progress-tracker.ts | 266 | Progress tracking | Active, critical |
| supabase/functions/_shared/tavily-client.ts | 356 | API client | Active, critical |
| supabase/functions/_shared/config.ts | 340+ | Configuration | Active, critical |
| supabase/functions/_shared/logger.ts | 217 | Logging | Active, used by 2 functions |
| supabase/functions/_shared/logging.ts | 102 | Logging (disabled) | Disabled, dead |

---

## Summary Statistics

- **Total Frontend Files**: 75+ (including 51 shadcn/ui components)
- **Total Backend Files**: 16 (6 functions + 10 shared utilities)
- **Total Migrations**: 16 (with 13 RLS/cv_job_comparisons focused)
- **Active Logging Systems**: 1 (SearchLogger)
- **Disabled Systems**: 1 (Logger from logging.ts)
- **Dead Code**: Logger instantiation in cv-analysis
- **Port Discrepancy**: CLAUDE.md says 8080, actual is 5173
- **Schema Field Inconsistency**: Uses search_status (not status)
- **LOC in Functions**: 3,511 total lines
- **Active Imports of logger.ts**: 2
- **Active Imports of logging.ts**: 1 (but unused)

