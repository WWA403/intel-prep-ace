# Testing Backlog

Detailed design notes for the high-level items tracked in the README “🧪 Testing Backlog” section. Each initiative is scoped to keep the suite lean but trustworthy. Additions should extend existing suites (prefer Deno for Edge Functions, Vitest/RTL for React) and reuse live Supabase fixtures only when we truly need end-to-end signals.

## Priority & Rationale Overview

| Priority | Initiative | Why it matters now | Impact if skipped |
| --- | --- | --- | --- |
| **P0** | Search artifact persistence | Core research output; missing writes leave users with blank dashboards and no alert. | Silent data loss, impossible to trust results. |
| **P0** | Progress & stall UI | Long-running workflows hinge on accurate progress + retry UX. | Users stuck in “processing” forever, churn. |
| **P0** | Search creation flow | First mile of product; ensures authenticated submissions, async invocation, and polling stability. | Research can’t start or fails silently, blocking revenue. |
| **P1** | Practice session pipeline | Second marquee workflow; protects sampling, favorites, and session persistence. | Practice breaks or gives wrong question sets, undermining value. |
| **P2** | Tavily analytics math | Keeps usage/credit dashboards honest; supports ops + cost control. | Misreported costs/usage; harder to budget and optimize. |

Treat P0 items as production blockers. P1 should follow quickly after launch, and P2 can trail if timelines are tight.

---

## 1. Search Artifact Persistence & CV-Job Comparison (P0)
- **Objective:** Guarantee the orchestration inside `supabase/functions/interview-research/index.ts` writes raw + synthesized payloads to `search_artifacts`, falls back correctly when updates touch zero rows, and keeps `cv_job_comparisons`/comparison analysis in sync with `searchService.getSearchResults`.
- **Files of interest:** `supabase/functions/interview-research/index.ts`, `supabase/functions/_shared/progress-tracker.ts`, `supabase/migrations/20251116_redesign_option_b_search_artifacts.sql`, `src/services/searchService.ts`.
- **Test design:**
  - Build a focused Deno test that stubs the Supabase client (use `deno test` + fake fetch) to exercise `saveToDatabase`: successful update, insert fallback, upsert, and stage/question inserts. Assert `processing_status` transitions and timestamps.
  - Extend `tests/integration/test_workflows/test_07_complete_workflow.ts` (or add `test_08_cv_job_comparison.ts`) to assert `search_artifacts.comparison_analysis` and `preparation_guidance` are populated, plus `searchService.getSearchResults` returns them.
  - Add a unit test for `ProgressTracker.updateStep` (via RPC mock) to avoid silent regressions in the progress UI.
- **Dependencies:** Supabase RPC `update_search_progress`, tables `search_artifacts`, `cv_job_comparisons`, `interview_stages`, `interview_questions`.

## 2. Progress & Stall Detection UI (P0)
- **Objective:** Lock down the UX contract of `ProgressDialog`, `useSearchProgress`, and stall detection logic so regressions in adaptive polling or stalled-job messaging are caught without manual QA.
- **Files of interest:** `src/components/ProgressDialog.tsx`, `src/hooks/useSearchProgress.ts`, `src/pages/Home.tsx` (ProgressDialog integration).
- **Test design:**
  - Introduce Vitest + React Testing Library and add component tests for `ProgressDialog`: `pending`, `processing`, `completed`, `failed`, and `stalled > 45s` states. Mock `useSearchProgress`, `useEstimatedCompletionTime`, and `useSearchStallDetection`.
  - Unit test `useSearchProgress`’s adaptive `refetchInterval` logic using fake timers to cover <30s, 30–60s, >60s, and completion/failed stop conditions.
  - Verify the retry CTA toggles after stall detection and that partial-results button remains disabled while `pending`.
- **Dependencies:** React Query, Supabase realtime channel, `Progress` component, `useToast` side-effects (mock).

## 3. Search Creation & Polling Flow (P0)
- **Objective:** Validate the core business flow where users submit the research form, `searchService` persists state, and the app keeps them informed until completion/failure.
- **Files of interest:** `src/pages/Home.tsx`, `src/services/searchService.ts`, `src/components/ProgressDialog.tsx`.
- **Test design:**
  - Component test: given an authenticated user, submitting the form calls `searchService.createSearchRecord` with trimmed payloads, shows the progress dialog, and starts status polling. Cover failure paths (no auth, Supabase error, creation failure).
  - Service unit tests: mock Supabase client to ensure `createSearchRecord`, `startProcessing`, and `getSearchStatus` handle success/fail states and update `searches.search_status` appropriately when the edge function call rejects.
  - Poller test: verify `startStatusPolling` escalates toast warnings after 2.5 minutes and forces timeout to `failed` at 8 minutes.
- **Dependencies:** Supabase auth/session, `supabase.functions.invoke`, `toast` helper, timers (use fake timers).

## 4. Practice Session Pipeline & Sampler (P1)
- **Objective:** Protect the practice MVP—stage selection, question filtering, `sessionSampler`, favorites-only mode, and persistence of sessions/answers.
- **Files of interest:** `src/pages/Practice.tsx`, `src/services/sessionSampler.ts`, `src/services/searchService.ts` (`createPracticeSession`, `savePracticeAnswer`, `getQuestionFlags`).
- **Test design:**
  - Unit-test `sessionSampler.sampleQuestions` (exact sampling when count <= N, randomness when > N using seeded RNG mocks) and `validateSampleSize`.
  - Component test: mock `searchService.getSearchResults` to return deterministic stages/questions; assert stage checkboxes toggle selections, favorites-only filter hides others, and sampling/shuffle flags change counts.
  - Service tests: ensure `createPracticeSession` requires auth and writes `practice_sessions`, `savePracticeAnswer` persists answers, and flag getters/updaters behave.
- **Dependencies:** Supabase tables `practice_sessions`, `practice_answers`, `user_question_flags`, `localStorage` (mock for persisting presets).

## 5. Tavily Analytics Aggregation (P2)
- **Objective:** Prevent silent errors in `tavilyAnalyticsService` metrics that power usage dashboards and budgeting.
- **Files of interest:** `src/services/tavilyAnalyticsService.ts`, `tavily_searches` table, `searches` table (company lookups).
- **Test design:**
  - Pure unit tests that mock `supabase.auth.getUser`, `.from().select()` calls, and return canned records to assert:
    - `totalCreditsUsed`, `totalSearches`, `totalExtracts`, `averageResponseTime`, and `successRate` math.
    - Company frequency ranking and error breakdown ordering.
    - `getCostEstimate` conversion from credits → dollars and average cost per search.
  - Negative path when queries return no rows—service should return `{ success: true, analytics: { ...0 } }` rather than throwing.
- **Dependencies:** Supabase client mocks, Node timers for averaging logic, floating-point rounding helpers.

---

### Tooling Notes
- Add `"test": "vitest run"` (plus `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`) to `package.json` for React-side coverage.
- Keep Deno-based tests under `tests/` for edge functions; leverage `deno test --allow-all`.
- Prefer mocking Supabase with lightweight helpers instead of spinning real databases; only run integration tests against the remote project when absolutely necessary.

