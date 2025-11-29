# Testing

Single reference for how we test intel-prep-ace: what already exists, how to run it, and what still needs to be covered.

## Quick Start
- `make test` – run everything (Deno + Node).
- `make test-unit` – fast unit sweep (current suite).
- Edge Functions stay in Deno under `tests/unit/test_edge_functions`.
- Frontend code should use Vitest + React Testing Library (planned; add `vitest run` npm script when suites land).

## Latest Run – November 29, 2025
- `pnpm test` → **26 tests passed** in ~48s covering all edge-function suites plus the updated practice experience helpers.

## Suite Layout
```
tests/
├── unit/
│   └── test_edge_functions/
│       ├── test_01_search_creation.ts          ✅ (5 tests)
│       ├── test_02_interview_research.ts       ✅ (4 tests)
│       ├── test_03_company_research.ts         ✅ (4 tests)
│       ├── test_04_job_analysis.ts             ✅ (4 tests)
│       ├── test_05_cv_analysis.ts              ✅ (4 tests)
│       └── test_06_question_generator.ts       ✅ (4 tests)
└── integration/
    └── test_workflows/
        ├── test_07_cv_job_comparison.ts        📋 Planned
        └── test_08_complete_workflow.ts        📋 Planned
```

**Current coverage:** 26 automated tests (edge functions + practice helpers) and all are passing. Integration slots are outlined below and should be implemented before major feature work ships.

## Key Scenarios (Next Up)
- **Test 07 – CV/Job comparison unit**: validate gap analysis structure, skill match %, fallback when CV or job data is missing, and database writes inside the `cv-job-comparison` edge function.
- **Test 08 – Complete workflow integration**: `Create search → research fan-out → CV/Job comparison → question generation`, asserting search status transitions, all six edge invocations, 120–150 generated questions, and no orphaned records.

## Backlog & Priorities
Treat **P0** as blockers, **P1** as near-term, **P2** as nice-to-have if timelines allow.

| Priority | Focus | What to prove |
| --- | --- | --- |
| P0 | Search artifacts persist | `supabase/functions/interview-research` writes artifacts + comparison data, falls back on zero-row updates. |
| P0 | Progress + stall UI | `ProgressDialog`, `useSearchProgress`, and stall detection animate correctly and recover from retries. |
| P0 | Search creation flow | Authenticated submissions create searches, invoke edge workflows, and show accurate polling. |
| P1 | Practice session pipeline | `sessionSampler`, favorites filters, and session persistence remain stable. |
| P2 | Tavily analytics math | Metrics/credit math in `tavilyAnalyticsService` stays accurate on empty + happy paths. |

### P0 Details
- **Search artifact persistence & CV-job comparison**
  - Files: `supabase/functions/interview-research/index.ts`, `_shared/progress-tracker.ts`, `src/services/searchService.ts`, related migrations.
  - Tests: Deno unit for `saveToDatabase` (update/insert/upsert paths, progress timestamps) plus integration assertion that `search_artifacts` + `cv_job_comparisons` stay in sync with `searchService.getSearchResults`.
- **Progress & stall detection UI**
  - Files: `src/components/ProgressDialog.tsx`, `src/hooks/useSearchProgress.ts`, `src/pages/Home.tsx`.
  - Tests: Vitest/RTL states (`pending`, `processing`, `completed`, `failed`, stalled >45s), adaptive polling intervals with fake timers, retry CTA toggles, toast usage mocked.
- **Search creation & polling flow**
  - Files: `src/pages/Home.tsx`, `src/services/searchService.ts`.
  - Tests: form submission happy/error paths, Supabase client mocks for `createSearchRecord/startProcessing/getSearchStatus`, polling timeouts (warnings at 2.5m, fail at 8m).

### P1 – Practice pipeline
- Files: `src/pages/Practice.tsx`, `src/services/sessionSampler.ts`, `src/services/searchService.ts` practice helpers.
- Tests: sampler sizing + randomness (seeded RNG), UI filters (favorites-only, stage toggles), persistence helpers with mocked Supabase + localStorage.

### P2 – Tavily analytics
- Files: `src/services/tavilyAnalyticsService.ts`.
- Tests: Supabase call mocks covering totals, averages, ranking, cost conversions, and graceful empty results.

## Tooling Notes
- Keep Deno-based suites under `tests/` and run with `deno test --allow-all`.
- New frontend suites should add `"test": "vitest run"` plus `vitest`, `@testing-library/react`, `@testing-library/user-event`, and `@testing-library/jest-dom`.
- Prefer lightweight Supabase client mocks; only hit the hosted project for end-to-end checks when necessary.
