# Migration Strategy & Organization

## Overview
This document outlines the strategy for keeping Supabase migrations clean, organized, and maintainable while preserving complete visibility into schema evolution.

## Current State (November 2025)

### Migration Organization
```
supabase/migrations/
├── 20251101000000_fix_progress_tracking.sql                    # Phase 1: Database optimization
├── 20251101000001_fix_cv_job_comparisons_rls.sql              # Attempted RLS fix (had issues)
├── 20251116000000_fix_cv_job_comparisons_service_role.sql     # Service role policies (partial)
├── 20251116000001_ensure_cv_job_comparisons_select_policy.sql # SELECT policies (incomplete)
├── 20251116000002_fix_cv_job_comparisons_policies.sql         # (would be the next attempt)
└── 20251116000003_consolidate_cv_job_comparisons_rls.sql      # FINAL: Consolidates all fixes
```

### Why Multiple cv_job_comparisons RLS Migrations?
The RLS policy issue required three migration attempts because:

1. **Migration 20251116000000**: Created service role INSERT/UPDATE policies
   - Problem: Didn't include SELECT policy for frontend queries
   - Resulted in: Partial policy set (3 policies)

2. **Migration 20251116000001**: Added SELECT/DELETE policies
   - Problem: Duplicated previous policies, didn't clean up conflicts
   - Resulted in: 10 total policies (6 old + 4 new, with duplicates)

3. **Migration 20251116000003**: Final consolidation
   - Solution: Dropped all 10, created clean minimal set (7 policies)
   - Clear documentation of problem history and solution

## Key Principles

### 1. **Single Migration Per Issue** (Preferred)
When a fix is needed, ideally it should be a single, complete migration:

```sql
-- BAD: Multiple migrations for same issue
20251116000000_fix_part1.sql
20251116000001_fix_part2.sql
20251116000002_fix_part3.sql

-- GOOD: Single comprehensive migration
20251116000003_consolidate_and_fix_issue.sql
```

### 2. **Consolidation Migrations**
When multiple attempts have created conflicts, create a consolidation migration that:

1. **Documents the problem** - Clear comments explaining why this migration exists
2. **Lists all problematic policies/objects** - What was created before that's causing issues
3. **Drops everything** - Removes all conflicting/duplicate objects
4. **Recreates correctly** - Creates the final, correct state
5. **Includes verification notes** - How to verify the fix worked

Example (from 20251116000003):
```sql
-- Problem History
-- - Previous attempts created 10 conflicting policies
-- - PostgREST returns 406 when multiple policies exist for same operation

-- Solution
-- Drop ALL existing policies
DROP POLICY IF EXISTS "...old policy 1...";
DROP POLICY IF EXISTS "...old policy 2...";
-- ... etc ...

-- Recreate correctly with clear comments
CREATE POLICY "Users can view their own CV comparisons"
  ON public.cv_job_comparisons FOR SELECT
  USING (auth.uid() = user_id);
-- ... etc ...

-- Verification Notes
-- After this migration:
-- 1. SELECT queries should return 200
-- 2. NO MORE 406 ERRORS
-- ...
```

### 3. **Schema Snapshot as Source of Truth**
Keep `supabase/schema.sql` updated after every migration:

```bash
# After applying migrations:
npx supabase db pull --db-url "$SUPABASE_DATABASE_URL" > supabase/schema.sql
git add supabase/schema.sql
git commit -m "Update schema snapshot after [change description]"
```

This provides developers with:
- **Current state**: What the database looks like right now
- **Evolution history**: What changed and why (via git log of migrations/)
- **Quick reference**: No need to manually trace through 10 migrations

### 4. **Migration Naming Convention**
Use timestamps and descriptive names:

```
20251116000000_fix_cv_job_comparisons_service_role.sql
│            │    │
│            │    └─ Clear description of what's being fixed
│            └────── Incrementing number for same day (000, 001, 002...)
└─────────────────── Timestamp (YYYYMMDD HHmmss format, but omitted for readability)
```

### 5. **Comment-Heavy Migrations**
When multiple attempts led to consolidation, be explicit:

```sql
-- This migration resolves the 406 error caused by 10 conflicting RLS policies
--
-- PROBLEM HISTORY:
-- - Migration A created incomplete policies
-- - Migration B tried to fix but duplicated instead
-- - Result: Conflicting policies that broke queries
--
-- SOLUTION:
-- [Clear explanation of what's being fixed]
--
-- VERIFICATION NOTES:
-- [How to verify the fix worked]
```

## Migration Cleanup Guidelines

### When to Create a Consolidation Migration
Create a consolidation migration when:
- ✅ Multiple previous migrations attempted to fix the same issue
- ✅ Conflicting or duplicate objects were created
- ✅ PostgREST/API errors indicate policy conflicts
- ✅ The fixes didn't work and need a clean slate

### When NOT to Create a Consolidation Migration
- ❌ First attempt at a fix (wait to see if it works)
- ❌ Multiple independent fixes (e.g., changing column AND fixing RLS unrelated)
- ❌ Just cleaning up naming (minor cosmetic changes)

### How to Create a Consolidation Migration

1. **Identify all problematic objects**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'table_name';
   -- List all policies that need fixing
   ```

2. **Document the problem** (see examples above)

3. **Drop everything** that's causing conflicts
   ```sql
   DROP POLICY IF EXISTS "policy 1" ON table;
   DROP POLICY IF EXISTS "policy 2" ON table;
   ```

4. **Recreate the correct state** with clear names and comments
   ```sql
   CREATE POLICY "Clear, descriptive name" ON table ...
   ```

5. **Include verification notes** at the end of the file

## Current Recommendations

### For cv_job_comparisons RLS (RESOLVED)
✅ **Status**: Consolidated with migration 20251116000003
- All 10 conflicting policies dropped
- 7 clean policies created (1 behavior set for each operation)
- Schema snapshot updated

### For Future RLS Changes
If you need to modify RLS policies on cv_job_comparisons in the future:

1. **Verify current state**: Check `supabase/schema.sql` for current policies
2. **Make ONE migration**: Create a new, complete migration (don't partial fixes)
3. **Document thoroughly**: Explain why policies are changing
4. **Update schema snapshot**: Run `supabase db pull` after migration
5. **Commit together**: Migration + schema snapshot in same commit

## File Structure Going Forward

### Keep
- `supabase/migrations/` - Complete history of all changes
- `supabase/schema.sql` - Current database state (updated after each migration)
- Migration comments - Explain why each change was needed

### Update Regularly
- `supabase/schema.sql` - After every database change
- CLAUDE.md - Reference consolidation pattern if it becomes common

### Never Delete
- Old migration files - They're your audit trail
- Comments in migrations - Future developers need to understand decisions

## Example: Properly Documented Migration

```sql
-- Fix: [Issue description]
-- =========================================================
-- Addresses: [GitHub issue number or problem description]
--
-- PROBLEM:
-- - [What was broken]
-- - [Why it happened]
-- - [User impact]
--
-- SOLUTION:
-- - [What's being fixed]
-- - [How it's being fixed]
--
-- MIGRATION STRATEGY:
-- - [Any special handling needed during migration]
--
-- VERIFICATION:
-- After this migration, verify with:
-- SELECT * FROM pg_policies WHERE tablename = 'table_name';
-- -- Should show exactly these policies:
-- -- - Policy A [SELECT]
-- -- - Policy B [INSERT]
-- -- etc.

-- Implementation
DROP POLICY IF EXISTS ...;
CREATE POLICY ...;
```

## Summary

The goal is:
1. **Minimal migrations** - One complete fix, not multiple attempts
2. **Clear documentation** - Future developers understand why changes exist
3. **Single source of truth** - `schema.sql` shows current state
4. **Complete history** - `migrations/` shows how we got here
5. **Consolidation when needed** - Clean up conflicts with a definitive migration

This balance preserves developer visibility while keeping the migration directory clean and maintainable.
