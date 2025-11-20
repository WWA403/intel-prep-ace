# Research Debugging Implementation Log

This document tracks which changes are pure debugging aids (temporary) versus structural fixes (permanent) as we stabilize the research pipeline. Update the tables as we experiment so we always know what needs to be rolled back after the root cause is resolved.

## Temporary Instrumentation

| Date       | Change                                                                 | Purpose                                                 | Removal Criteria |
|------------|-------------------------------------------------------------------------|---------------------------------------------------------|------------------|
| 2025-11-16 | Added `SearchLogger` lifecycle instrumentation inside `interview-research` (phase markers + log persistence). | Capture a deterministic trace for each execution and make Step/phase failures obvious. | Remove once pipeline is stable and Supabase logs are sufficient. |

## Permanent Fixes

| Date       | Change                                                                 | Rationale                                              | Follow-up |
|------------|-------------------------------------------------------------------------|--------------------------------------------------------|-----------|
| 2025-11-16 | Added `Access-Control-Allow-Methods` to edge function CORS headers.     | Ensure browser preflight succeeds and prevent false CORS errors. | None. |
| 2025-11-16 | Corrected `ProgressTracker` usage to call `markCompleted()` (existing method) instead of the non-existent `markComplete()`. | Prevent runtime `TypeError` that aborted the function at the end of execution. | Monitor next run to confirm the tracker reaches 100%. |
| 2025-11-18 | Populate `interview_stages` with safe defaults when inserting into `search_artifacts`. | Avoid Postgres NOT NULL violations that were crashing the edge function before synthesis completed. | Verify next deployment successfully writes raw rows without errors. |
| 2025-11-18 | Added uniqueness/backfill migration for `search_artifacts` and switched edge function writes to use upsert/update semantics. | Prevent duplicate rows per `search_id` and make retries idempotent. | Run new migration + redeploy function before next test. |

## Notes for Future Updates

- When we introduce new diagnostics, note them in the Temporary table with intent and removal signal.
- When we land a code or configuration change that should stick, add it to the Permanent table with a short justification.
- Once the incident is resolved, review all temporary entries and ensure they are removed or promoted to permanent fixes where appropriate.
