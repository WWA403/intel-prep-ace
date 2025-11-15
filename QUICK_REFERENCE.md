# Hireo - Quick Reference Guide

## Critical Findings

### 1. PORT CONFIGURATION ERROR
- **CLAUDE.md says**: Port 8080
- **Actual vite.config.ts**: Port 5173
- **Action needed**: Update CLAUDE.md line 13, 64, 115 to reflect port 5173

### 2. LOGGER IMPORTS SUMMARY
| File | Module | Status | Lines |
|------|--------|--------|-------|
| interview-research/index.ts | logger.ts | Active | 3 |
| company-research/index.ts | logger.ts | Active | 7 |
| cv-analysis/index.ts | logging.ts | Disabled (Dead Code) | 3 |

### 3. DEAD CODE LOCATIONS
1. **logging.ts** - Completely disabled, all methods console-only
2. **cv-analysis/index.ts** - Creates Logger instance but never uses it
3. **CLAUDE.md** - References port 8080 (3 locations)

### 4. STATUS FIELD NAMING
- Database field: `search_status` (not `status`)
- Values: 'pending', 'processing', 'completed', 'failed'
- Frontend hook maps: `search_status` → `status` in SearchProgress interface

### 5. TIMEOUT CONFIGURATION (Phase 4)
```
companyResearch: 20s (external APIs)
jobAnalysis: 20s (large descriptions)
cvAnalysis: 15s (reliable parsing)
questionGeneration: 40s (OpenAI complex JSON)
totalOperation: 60s (hard timeout)
```

## Key Files to Know

### Frontend (Most Important)
- `src/hooks/useSearchProgress.ts` - Adaptive polling logic
- `src/services/searchService.ts` - Two-phase search creation
- `src/components/ProgressDialog.tsx` - Progress UI with stall detection
- `src/pages/Practice.tsx` - Largest component (60KB)

### Backend (Critical)
- `supabase/functions/interview-research/index.ts` - Main orchestrator (1244 lines)
- `supabase/functions/_shared/progress-tracker.ts` - Timeout management
- `supabase/functions/_shared/logger.ts` - Active logging (SearchLogger)
- `supabase/functions/_shared/logging.ts` - DISABLED (don't use)

### Configuration
- `vite.config.ts` - Port 5173 (NOT 8080)
- `tsconfig.json` - Relaxed strict checking
- `supabase/schema.sql` - Latest schema snapshot
- `supabase/migrations/` - 16 migration files

## Codebase Statistics
- Frontend files: 75+ (including 51 shadcn/ui components)
- Backend files: 16 edge function files
- Total lines of code: 3,511 (edge functions only)
- Database migrations: 16 (13 focused on cv_job_comparisons fixes)
- Active logging systems: 1 (SearchLogger)
- Disabled logging systems: 1 (Logger)

## Architecture Overview

### Async Processing Pipeline
1. Frontend: `createSearchRecord()` → synchronous, returns searchId
2. Frontend: `startProcessing()` → fire-and-forget edge function
3. Backend: Concurrent parallel processing (3 services in Promise.all)
4. Frontend: Polls progress with adaptive intervals (2s→5s→10s)
5. Backend: Updates database with real-time progress
6. Frontend: Real-time subscription as fallback to polling

### Edge Function Chain
```
interview-research (orchestrator)
├─ company-research (Tavily + DuckDuckGo fallback)
├─ job-analysis (URL parsing)
├─ cv-analysis (CV extraction)
├─ [All run in parallel with Promise.all]
└─ Synthesize with OpenAI
   └─ Generate interview questions
```

## Dependencies Version Overview

### Frontend
- React: 18.3.1
- TypeScript: 5.5.3
- Vite: 5.4.1
- Supabase: 2.52.0
- TanStack Query: 5.56.2
- Tailwind: 3.4.11

### Backend
- Deno std: 0.177.0 (most) / 0.168.0 (cv-analysis)
- Supabase JS: 2.43.2 (most) / 2.39.3 (progress-tracker) / 2.7.1 (cv-analysis)

## Recent Changes (November 2025)

### Phase 1-3: Completed
- Async job processing (fire-and-forget)
- Adaptive polling (30s aggressive, then back off)
- Timeout optimization (20s per service, 60s total)
- Stall detection (no updates >30s)
- Progress tracking with RPC updates

### Phase 4: Completed
- Increased AI synthesis timeout to 40s
- Better handling of complex OpenAI JSON responses

### RLS Fixes: 7 migrations
- Multiple cv_job_comparisons access pattern fixes
- Data integrity checks and verification

## Common Gotchas

1. Don't use `logging.ts` Logger class - it's disabled
2. Don't confuse `status` with `search_status` - always use `search_status` in DB
3. Port is 5173, not 8080 - update mental model and docs
4. cv-analysis imports Logger but never uses it - remove or ignore
5. All Edge Functions have different Supabase JS versions - be careful with updates

## Next Steps for Developers

1. Update CLAUDE.md port references (3 locations)
2. Remove Logger from cv-analysis (dead code)
3. Remove or consolidate logging.ts
4. Test timeout handling with slow APIs
5. Verify RLS policies work across all user patterns
6. Implement TODO items (PDF upload, etc.)

