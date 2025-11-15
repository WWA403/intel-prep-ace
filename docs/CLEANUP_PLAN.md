# Hireo - Comprehensive Cleanup Plan

**Document Status**: Final Plan (November 14, 2025)
**Target Scope**: 2-3 week cleanup sprint
**Expected Impact**: ~40% reduction in technical debt, improved maintainability

---

## Executive Summary

The Hireo codebase is production-ready with good architectural patterns, but has accumulated technical debt from iterative development by multiple team members. This plan addresses duplication, inconsistencies, and code organization issues while preserving the system's core functionality.

**Current State Assessment**:
- **Code Quality**: 7/10 - Good patterns, but organizational issues
- **Technical Debt**: Moderate (removable without major refactors)
- **Critical Issues**: 3 high-priority, 4 medium-priority
- **Estimated Effort**: 15-20 hours total
- **Team Impact**: High (affects developer experience and onboarding)

---

## Part 1: CRITICAL TECHNICAL DEBT (HIGH PRIORITY)

### 1.1 Remove Duplicate Logging System

**Current State**:
- **Active**: `supabase/functions/_shared/logger.ts` (217 lines, SearchLogger class)
- **Disabled**: `supabase/functions/_shared/logging.ts` (102 lines, stub implementations)
- **Usage**:
  - `logger.ts` active in 2 functions (interview-research, company-research)
  - `logging.ts` dead import in 1 function (cv-analysis)
  - `logging.ts` completely disabled ("Temporarily disabled to fix 409 constraint errors")

**Why This Matters**:
- Dead code creates confusion (developers don't know which to use)
- cv-analysis has import but never uses Logger (dead code)
- Disabled code suggests incomplete debugging/migration

**Action Items**:

1. **Remove logging.ts**
   ```bash
   rm supabase/functions/_shared/logging.ts
   ```

2. **Update cv-analysis/index.ts** - Remove dead logger import
   - Line 3: Delete `import { Logger } from '../_shared/logging.ts';`
   - Remove any unused logger instances/references

3. **Document logger.ts usage**
   - Add comment to logger.ts explaining it's the active system
   - Update docs with logging best practices

4. **Audit imports** across all functions
   - Verify only interview-research and company-research use logging
   - Ensure no other functions accidentally import logging.ts

**Files to Modify**:
- `supabase/functions/_shared/logging.ts` - DELETE
- `supabase/functions/cv-analysis/index.ts` - Remove import
- `docs/DEVELOPMENT_GUIDE.md` - Update logging section

**Effort**: 30 minutes
**Risk**: Low (logging.ts is disabled, safe to remove)
**Testing**: Verify cv-analysis still works without logger

---

### 1.2 Consolidate Database Status Columns

**Current State**:
```sql
-- In searches table (lines 37-38 of schema.sql):
search_status TEXT DEFAULT 'pending' NOT NULL,  -- ACTIVE
status TEXT DEFAULT 'pending',                   -- REDUNDANT
```

**Analysis**:
- Both columns track the same state (pending → processing → completed → failed)
- `search_status` is the active column used in all queries
- `status` appears to be technical debt from earlier refactoring
- Both have CHECK constraints enforcing same values
- Code consistently uses `search_status` (not `status`)

**Why This Matters**:
- Data redundancy increases storage and query complexity
- Developers must understand which column to use
- RLS policies must cover both columns
- Potential for sync issues if both aren't updated together

**Action Plan**:

**Phase 1: Audit & Document** (now)
- [x] Confirm all code references use `search_status` only
- [x] Check all RLS policies use `search_status` only
- [x] Verify migrations never reference `status` column

**Phase 2: Create Consolidation Migration**
```sql
-- File: supabase/migrations/20251120000000_consolidate_status_column.sql

BEGIN;

-- Step 1: Verify both columns have same values (safety check)
-- Add assertion query here

-- Step 2: Drop unused status column
ALTER TABLE public.searches DROP COLUMN IF EXISTS status;

-- Step 3: Update CHECK constraint to be cleaner
ALTER TABLE public.searches
  DROP CONSTRAINT IF EXISTS searches_status_check,
  DROP CONSTRAINT IF EXISTS searches_search_status_check;

ALTER TABLE public.searches
  ADD CONSTRAINT check_search_status
    CHECK (search_status IN ('pending', 'processing', 'completed', 'failed'));

COMMIT;
```

**Phase 3: Verify & Deploy**
- Create migration locally (use provided SQL)
- Test on branch against remote database
- Verify all existing data migrates correctly
- Update schema.sql snapshot
- Deploy to production

**Files to Modify**:
- Create new migration: `supabase/migrations/20251120000000_consolidate_status_column.sql`
- Update `supabase/schema.sql` after applying migration

**Effort**: 1.5-2 hours
**Risk**: Medium (schema change, requires testing)
**Testing Required**:
1. Verify migration applies without errors
2. Check all existing searches still query correctly
3. Verify RLS policies still work
4. Test progress updates still work
5. Check TypeScript types regenerate correctly

**Rollback Plan**:
- Keep backup of current schema
- Can re-add status column if needed
- Never delete the migration file

---

### 1.3 Document & Consolidate RLS Policy History

**Current State**:
- 5 sequential migrations (Nov 1-2, 2025) attempted to fix cv_job_comparisons RLS
  - `20251101000001` - Initial RLS policy fix
  - `20251101000002` - "Robust" fix
  - `20251101000003` - Schema fix
  - `20251102000000` - Query fix
  - `20251102000001` - "Fundamental" fix
- Each migration suggests iterative debugging rather than planned approach
- Root cause: PostgREST limitations with complex RLS policies using subqueries

**Why This Matters**:
- Creates confusion about what the "correct" policy is
- Makes it hard to understand RLS requirements going forward
- Suggests incomplete knowledge transfer in the team
- Future developers won't know how to add similar complex policies

**Root Cause Analysis** (from migration review):
PostgREST doesn't support complex RLS policies with subqueries efficiently:
```sql
-- PostgREST struggles with this pattern:
auth.uid() IN (SELECT user_id FROM searches WHERE id = cv_job_comparisons.search_id)
```
Instead, requires:
```sql
-- Simple direct match works best:
auth.uid() = user_id  -- Direct foreign key relationship
```

**Action Plan**:

**Phase 1: Create Documentation** (1 hour)
Create `docs/RLS_STRATEGY.md` with:

```markdown
# Row Level Security Strategy

## Overview
RLS policies control which rows users can access in PostgreSQL.

## Key Principles
1. **Direct User Match Preferred**: Use `auth.uid() = user_id` when possible
2. **Avoid Subquery Joins**: PostgREST has limitations with complex subqueries
3. **Foreign Key Relations**: Use foreign keys to filter by related tables
4. **Test with PostgREST**: All policies must work with Supabase REST API

## cv_job_comparisons Policy (Case Study)
### Problem
- Frontend needed to access comparisons by search_id
- PostgREST couldn't apply RLS with search_id subquery
- Result: 406 Not Acceptable errors

### Solution
Use both direct user_id AND search_id relationship:
```sql
CREATE POLICY "User access with search relationship"
  ON public.cv_job_comparisons FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT user_id FROM searches WHERE id = search_id)
  );
```

### Why This Works
- Direct `user_id` match satisfies PostgREST
- Subquery evaluated by PostgreSQL (not PostgREST)
- Result: 200 OK responses

## Guidelines for New Policies
1. Always include direct user_id check if possible
2. Test RLS changes against actual PostgREST API
3. Use frontend-side search by ID with proper RLS
4. Document complex policies with comments

## Common RLS Errors
- **406 Not Acceptable**: Policy too complex for PostgREST, simplify
- **403 Forbidden**: Policy correct but user doesn't have access
- **Empty results**: Policy working but user has no data
```

**Phase 2: Clean Up Migration Comments** (30 min)
- Add clear comments to final RLS migration (20251102000001)
- Document why multiple attempts were needed
- Explain the solution for future reference

**Phase 3: Update CLAUDE.md** (30 min)
- Add reference to `docs/RLS_STRATEGY.md`
- Link critical implementation patterns
- Note PostgREST limitations

**Files to Create/Modify**:
- Create: `docs/RLS_STRATEGY.md` (new, ~200 lines)
- Modify: `CLAUDE.md` (add RLS reference)
- Modify: Latest RLS migration (add better comments)

**Effort**: 2 hours total
**Risk**: Low (documentation only, no code changes)
**Benefit**: Prevents future RLS confusion, improves onboarding

---

### 1.4 Fix Port Configuration Inconsistency

**Current Discrepancy**:
- **CLAUDE.md states**: Port 8080 (mentioned in lines ~13, ~64, ~115)
- **Actual vite.config.ts**: Port 5173
- **Package.json script**: `vite` (which uses vite.config.ts port)

**Verification**:
```bash
# Check vite.config.ts line 10:
port: 5173
```

**Why This Matters**:
- Developers following CLAUDE.md will try port 8080
- Dev server runs on 5173, causing confusion
- New team members waste time debugging non-existent server
- Documentation becomes unreliable reference

**Action Items**:

**Option A: Update CLAUDE.md to port 5173** (Recommended)
- Search CLAUDE.md for all "8080" references
- Replace with "5173"
- Verify no other documentation mentions 8080

**Option B: Update vite.config.ts to port 8080**
- Change vite.config.ts line 10: `port: 8080`
- Less recommended (8080 is non-standard for Vite)

**Recommended**: Use Option A (correct documentation to match implementation)

**Files to Modify**:
- `CLAUDE.md` - Replace all "8080" with "5173" (if Option A)

**Effort**: 15 minutes
**Risk**: Very Low (documentation only)
**Verification**: Run `npm run dev` and confirm server starts on correct port

---

## Part 2: CODE ORGANIZATION IMPROVEMENTS (MEDIUM PRIORITY)

### 2.1 Refactor Practice.tsx (Oversized Component)

**Current State**:
- **File**: `src/pages/Practice.tsx`
- **Size**: 1,543 lines (extremely large for a single component)
- **Responsibilities**:
  - Question display with audio playback
  - Swipe gestures (left/right/up/down)
  - Timer management
  - Question filtering and sorting
  - Practice session tracking
  - User answer recording
  - Session metrics display

**Why This Matters**:
- Difficult to test (1500+ lines of logic)
- Hard to maintain (changes affect entire component)
- Difficult to reuse parts (e.g., QuestionCard elsewhere)
- Poor cognitive load for developers
- Industry standard: Components should be 200-400 lines max

**Recommended Split**:

```
src/pages/Practice.tsx (300 lines) - Main orchestrator
├── src/components/PracticeCard.tsx (200 lines) - Question display + audio
├── src/components/PracticeControls.tsx (150 lines) - Play/pause/reset/submit
├── src/components/PracticeFilters.tsx (120 lines) - Filter/sort UI
├── src/components/SessionMetrics.tsx (100 lines) - Score display + stats
└── src/hooks/usePracticeSession.ts (150 lines) - Session logic extraction
```

**Detailed Breakdown**:

**Component 1: PracticeCard.tsx** (200 lines)
- Displays current question
- Shows audio controls and playback
- Handles difficulty display
- Shows company context if available
- Integrates with audio playback service

**Component 2: PracticeControls.tsx** (150 lines)
- Play/Pause/Reset buttons
- Skip button logic
- Submit answer button
- Timer display (using custom hook)
- Navigation buttons (previous/next)

**Component 3: PracticeFilters.tsx** (120 lines)
- Difficulty filter checkboxes
- Category filter dropdown
- Search/keyword input
- Sort dropdown (difficulty, category, random)
- Apply filters button

**Component 4: SessionMetrics.tsx** (100 lines)
- Current score display
- Session progress bar
- Answered/skipped/flagged counts
- Time elapsed
- Estimated time remaining

**Custom Hook: usePracticeSession.ts** (150 lines)
- Session state management
- Question filtering logic
- Score calculation
- Answer tracking
- Timer management

**Action Plan**:

**Phase 1: Prepare** (30 min)
- [ ] Create new component files
- [ ] Copy Practice.tsx as backup
- [ ] Set up component structure

**Phase 2: Extract Components** (2 hours)
- [ ] Extract PracticeCard (audio + display)
- [ ] Extract PracticeControls (buttons)
- [ ] Extract PracticeFilters (filters)
- [ ] Extract SessionMetrics (stats)

**Phase 3: Create Custom Hook** (1 hour)
- [ ] Create usePracticeSession.ts
- [ ] Move session logic from Practice.tsx
- [ ] Move score calculation logic
- [ ] Move timer logic

**Phase 4: Update Practice.tsx** (1 hour)
- [ ] Import new components
- [ ] Import custom hook
- [ ] Refactor to orchestrator pattern
- [ ] Remove extracted logic

**Phase 5: Test & Verify** (1.5 hours)
- [ ] Test question display
- [ ] Test audio playback
- [ ] Test filtering
- [ ] Test scoring
- [ ] Test timer
- [ ] Test gesture controls
- [ ] Test session persistence

**Effort**: 6-7 hours total
**Risk**: Medium (large refactor, high test coverage needed)
**Testing Strategy**:
- Use existing component in branch
- Test all features work as before
- Verify gesture controls still respond
- Check audio playback works
- Validate scoring is accurate
- Test session persistence

**Benefits**:
- Each component is testable (200-300 lines)
- Easier to fix bugs (isolated components)
- Reusable components (PracticeCard could be used elsewhere)
- Better code organization
- Reduced cognitive load

---

### 2.2 Split Monolithic config.ts

**Current State**:
- **File**: `supabase/functions/_shared/config.ts`
- **Size**: 340+ lines
- **Responsibilities**:
  - OpenAI settings (model, API key, timeouts)
  - Tavily API settings
  - Search domains and exclusions
  - Company ticker mappings
  - Timeout configurations
  - Feature flags

**Why This Matters**:
- Hard to find specific configuration
- Changes to one area might affect others
- Unclear which configs are related
- Future configs hard to add
- Testing requires full config import

**Recommended Split**:

```
supabase/functions/_shared/
├── config.ts (50 lines) - Main export + validation
├── models/openai-config.ts (80 lines) - GPT-4o settings
├── models/openai-prompt-templates.ts (100 lines) - Prompt templates
├── search/tavily-config.ts (60 lines) - Tavily API settings
├── search/domain-config.ts (50 lines) - Domains, exclusions
├── search/company-mappings.ts (30 lines) - Company tickers
└── timeout-config.ts (40 lines) - Concurrent timeouts
```

**New config.ts** (50 lines):
```typescript
// Central export with validation
export { OpenAIConfig } from './models/openai-config.ts';
export { TavilyConfig } from './search/tavily-config.ts';
export { DomainConfig } from './search/domain-config.ts';
export { TimeoutConfig } from './timeout-config.ts';

// Validation function
export function validateConfig(): boolean {
  // Verify required env vars
  // Check config consistency
  // Return true if valid
}
```

**Files to Create**:
- `supabase/functions/_shared/models/openai-config.ts`
- `supabase/functions/_shared/models/openai-prompt-templates.ts`
- `supabase/functions/_shared/search/tavily-config.ts`
- `supabase/functions/_shared/search/domain-config.ts`
- `supabase/functions/_shared/search/company-mappings.ts`
- `supabase/functions/_shared/timeout-config.ts`

**Files to Modify**:
- `supabase/functions/_shared/config.ts` (simplify to exports)
- All function imports (update paths, minimal change)

**Effort**: 1.5-2 hours
**Risk**: Low (refactoring only, no logic changes)
**Benefits**:
- Easier to understand each subsystem
- Smaller, more focused config files
- Easier to override per-environment
- Better testing (can mock individual configs)

---

### 2.3 Audit & Remove Unused Code

**Identified Unused Code**:

1. **config.example.ts** (111 lines)
   - Example configuration file
   - Not used in actual code
   - Can be removed (use environment variables instead)

2. **tavilyAnalyticsService.ts** (7.3 KB)
   - Analytics tracking service
   - Imported but never used
   - Can be removed or archived

3. **sessionSampler.ts** (1.4 KB)
   - Session sampling utility
   - Used once in Practice.tsx
   - Could be inlined or extracted as hook

4. **TODO comments** throughout code
   - PDF upload feature (commented out)
   - History display (commented out)
   - CV extraction features (commented out)

**Action Plan**:

**Phase 1: Document Dead Code** (30 min)
- [ ] Verify config.example.ts is truly unused
- [ ] Confirm tavilyAnalyticsService has no imports
- [ ] Check sessionSampler is only used in Practice
- [ ] List all TODO items

**Phase 2: Remove/Archive** (1 hour)
- [ ] Remove config.example.ts
- [ ] Archive tavilyAnalyticsService (or remove)
- [ ] Inline sessionSampler into Practice.tsx hook
- [ ] Replace TODO comments with GitHub issues

**Phase 3: Cleanup Imports** (30 min)
- [ ] Remove any imports of deleted files
- [ ] Update package.json if needed
- [ ] Verify no broken imports

**Effort**: 2 hours total
**Risk**: Low (removing unused code)
**Verification**:
- Run build: `npm run build`
- Run linter: `npm run lint`
- Run tests (if available)
- Verify no import errors

---

## Part 3: DOCUMENTATION & KNOWLEDGE TRANSFER (MEDIUM PRIORITY)

### 3.1 Create Edge Function Maintenance Guide

**Purpose**: Help developers understand edge function patterns and conventions

**File**: `docs/EDGE_FUNCTIONS_GUIDE.md` (new, ~400 lines)

**Contents**:

1. **Architecture Overview**
   - Microservices pattern (6 functions)
   - Interview-research as orchestrator
   - Async job processing pattern
   - Fire-and-forget pattern with progress tracking

2. **Shared Utilities Reference**
   - When to use logger.ts (logging searches)
   - When to use progress-tracker.ts (progress updates)
   - When to use url-deduplication.ts (caching)
   - When to use tavily-client.ts (company research)
   - Timeout configuration and why it matters

3. **Adding New Edge Functions**
   - File structure requirements
   - Dependencies setup
   - Timeout management
   - Error handling patterns
   - Logging best practices
   - Testing approach

4. **Common Patterns**
   - Async job processing example
   - Concurrent execution with Promise.all
   - Graceful fallback handling
   - Error message formatting

5. **Debugging**
   - Supabase function logs location
   - Common error patterns
   - Timeout troubleshooting
   - Database connection issues

6. **Performance Considerations**
   - Timeout settings per service
   - Concurrent vs sequential execution
   - Database query optimization
   - API rate limiting

**Effort**: 2-3 hours
**Risk**: Low (documentation)
**Benefit**: Faster onboarding, fewer mistakes, clearer patterns

---

### 3.2 Update CLAUDE.md with Current Best Practices

**Changes**:
1. **Section 1: Port Configuration**
   - Update 8080 → 5173
   - Verify all references updated

2. **Section 2: Logging**
   - Document active logging system (logger.ts only)
   - Provide examples of when/how to log

3. **Section 3: Component Size Guidelines**
   - Add recommendation: 200-400 line limit
   - List Practice.tsx refactoring as example

4. **Section 4: Configuration Strategy**
   - Document new split config approach
   - Explain why monolithic config isn't ideal
   - Show how to add new configs

5. **Section 5: Database Best Practices**
   - Add RLS guidelines (link to RLS_STRATEGY.md)
   - Document status column consolidation
   - Add migration patterns

**Effort**: 1-1.5 hours
**Risk**: Very Low (documentation)
**Benefit**: Single source of truth for best practices

---

### 3.3 Create Cleanup Summary Document

**File**: `docs/CLEANUP_SUMMARY.md` (after cleanup complete)

**Contents**:
- Issues identified
- Actions taken
- Results and metrics
- Before/after comparison
- Lessons learned

---

## Part 4: OPTIONAL LONG-TERM IMPROVEMENTS

### 4.1 Tighten TypeScript Configuration

**Current State**: Very loose for rapid development
```json
{
  "noImplicitAny": false,
  "strictNullChecks": false,
  "skipLibCheck": true
}
```

**Recommended**: Gradually tighten
```json
{
  "noImplicitAny": true,
  "strictNullChecks": true,
  "skipLibCheck": true,
  "strict": true
}
```

**Effort**: 2-3 hours (to fix resulting errors)
**Risk**: Medium (many type errors to fix)
**Benefit**: Catch errors at compile time instead of runtime

---

### 4.2 Add Test Infrastructure

**Recommended Setup**:
- Framework: Vitest (lighter than Jest, works with Vite)
- Component Testing: React Testing Library
- Coverage Target: 60%+ on critical paths

**Initial Test Coverage**:
1. Navigation.tsx (auth integration)
2. ProgressDialog.tsx (progress polling)
3. useSearchProgress hook (core async logic)
4. searchService.ts (API calls)

**Effort**: 4-6 hours initial setup
**Benefit**: Catch regressions, enable refactoring with confidence

---

### 4.3 Extract Gesture Handling

**Current State**: Gesture logic embedded in Practice.tsx

**Action**: Create `src/hooks/useGestureControls.ts`
- Handles swipe gestures (left, right, up, down)
- Swipe threshold and debouncing
- Configurable gesture handlers
- Touch event binding

**Effort**: 1-2 hours
**Benefit**: Reusable gesture control, testable logic

---

### 4.4 Create Reusable Practice Components Library

**Extracted Components Can Be Used For**:
- Quiz components (other areas)
- Card-based UI patterns
- Timer components
- Filter UI patterns

**Effort**: 1-2 hours (after Practice.tsx refactor)

---

## Execution Timeline

### Week 1: Critical Cleanup (High Priority)

**Monday - Tuesday** (4 hours):
1. Remove logging duplication (30 min)
   - Delete logging.ts
   - Remove import from cv-analysis
   - Test cv-analysis still works

2. Fix port configuration (30 min)
   - Update CLAUDE.md (8080 → 5173)
   - Verify all references updated

3. Consolidate status columns (1.5 hours)
   - Review migration approach
   - Test migration locally
   - Plan production deployment

4. Document RLS strategy (1.5 hours)
   - Create RLS_STRATEGY.md
   - Update CLAUDE.md with reference
   - Document cv_job_comparisons case study

**Expected Time**: 4 hours
**Expected PRs**: 2 (logging cleanup, documentation)

**Wednesday** (2 hours):
- Deploy RLS documentation PR
- Apply status column migration on branch
- Test status column consolidation
- Prepare migration deployment

---

### Week 2: Code Organization (Medium Priority)

**Monday - Tuesday** (4 hours):
1. Audit and remove unused code (2 hours)
   - Document all unused code
   - Remove config.example.ts
   - Archive tavilyAnalyticsService
   - Clean up TODO comments

2. Split config.ts (2 hours)
   - Create new domain-specific config files
   - Update imports in functions
   - Test function still work

**Wednesday - Friday** (6-8 hours):
- Refactor Practice.tsx into smaller components (6-8 hours)
  - Extract PracticeCard
  - Extract PracticeControls
  - Extract PracticeFilters
  - Extract SessionMetrics
  - Create usePracticeSession hook
  - Comprehensive testing

**Expected Time**: 10-12 hours
**Expected PRs**: 2-3 (cleanup, config split, Practice refactor)

---

### Week 3: Documentation & Verification (Medium Priority)

**Monday - Wednesday** (4-5 hours):
1. Create Edge Function Maintenance Guide (2-3 hours)
2. Update CLAUDE.md (1-1.5 hours)
3. Create migration summary (30 min)

**Thursday - Friday**:
- Code review and feedback
- Fix any issues found
- Merge cleanup PRs

**Expected Time**: 4-5 hours
**Expected PRs**: 1-2 (documentation updates)

---

## Implementation Checklist

### Phase 1: Critical Cleanup

- [ ] Remove logging.ts and update cv-analysis import
- [ ] Fix port configuration (8080 → 5173)
- [ ] Create RLS_STRATEGY.md documentation
- [ ] Create status column consolidation migration
- [ ] Test status column migration
- [ ] Update CLAUDE.md with port fix and RLS reference

### Phase 2: Code Organization

- [ ] Document all unused code
- [ ] Remove config.example.ts
- [ ] Archive/remove tavilyAnalyticsService
- [ ] Split config.ts into domain-specific files
- [ ] Update all function imports for new config structure
- [ ] Test all functions work with new config
- [ ] Extract Practice.tsx components
- [ ] Create usePracticeSession hook
- [ ] Test Practice page thoroughly

### Phase 3: Documentation

- [ ] Create EDGE_FUNCTIONS_GUIDE.md
- [ ] Update CLAUDE.md with best practices
- [ ] Create component size guidelines
- [ ] Document new config strategy
- [ ] Create CLEANUP_SUMMARY.md

---

## Success Metrics

### Code Quality Improvements

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Largest component | 1,543 lines | <400 lines | ✓ |
| Config files | 1 (340 lines) | 4 (avg 85 lines) | ✓ |
| Dead code | ~300 lines | 0 lines | ✓ |
| Database duplicates | 2 columns | 0 | ✓ |
| RLS clarity | Confusing | Well-documented | ✓ |
| Documentation files | 10 files | 12 files | ✓ |

### Developer Experience

- **Onboarding Time**: Reduced by ~30% (clearer docs, smaller files)
- **Bug Fix Time**: Reduced by ~25% (focused components, clearer code)
- **Feature Add Time**: Reduced by ~20% (split config, better patterns)
- **Code Review Time**: Reduced by ~15% (smaller PRs, clearer intent)

---

## Risk Assessment

### High-Risk Items
1. **Status Column Consolidation** - Schema change, requires careful testing
   - Mitigation: Test on branch, keep backup, clear rollback plan

2. **Practice.tsx Refactoring** - Large component with complex logic
   - Mitigation: Extract gradually, test after each extraction, keep backup

### Medium-Risk Items
1. **Config.ts Split** - Many imports might break
   - Mitigation: Update all imports carefully, test build

2. **Logging Cleanup** - Might have cascading effects
   - Mitigation: Search all imports before deletion, test all functions

### Low-Risk Items
1. **Documentation Updates** - No code impact
2. **Unused Code Removal** - Code is already unused
3. **Port Configuration** - Documentation only

---

## Dependencies & Prerequisites

### Tools Required
- `git` (for branching and commits)
- `npm` (for build/test)
- `npx supabase` (for migrations)
- Text editor with TypeScript support

### Knowledge Required
- React component patterns
- TypeScript basics
- SQL migrations
- RLS policies (basic understanding)
- Edge Functions architecture

### Environment Setup
- Remote Supabase project access (for testing migrations)
- Git branch creation permissions
- TypeScript compiler available locally

---

## Rollback Strategy

### For Each Change

**Logging Cleanup**:
- Rollback: Add logging.ts back, restore cv-analysis import
- Risk: Low (can be done in 5 minutes)

**Status Column**:
- Rollback: Don't apply migration, keep both columns
- Risk: Medium (migration already deployed affects rollback)
- Backup: Keep pre-migration schema snapshot

**Config Split**:
- Rollback: Revert imports, restore config.ts
- Risk: Low (can be done in 10 minutes)

**Practice.tsx Refactor**:
- Rollback: Keep original Practice.tsx backup, revert imports
- Risk: Low (keep branch for reference)

---

## Communication Plan

### Team Notifications
1. **Pre-Sprint**: Share this plan with team
   - Schedule kickoff meeting
   - Explain rationale for each change
   - Gather feedback

2. **During Sprint**: Daily standups
   - Share blockers
   - Coordinate on dependent tasks
   - Update progress

3. **Post-Sprint**: Retrospective
   - Lessons learned
   - Process improvements
   - Celebrate improvements

### Documentation Updates
1. Update README.md with cleanup results
2. Add "Maintenance" section to CLAUDE.md
3. Create "Recent Changes" section in docs

---

## Long-Term Maintenance

### After Cleanup
1. **Code Review Standards**
   - Enforce component size limit (400 lines max)
   - Require tests for new components
   - Document architectural decisions

2. **Documentation Maintenance**
   - Keep CLAUDE.md up-to-date
   - Link to relevant docs in code
   - Update when patterns change

3. **Debt Prevention**
   - Regular code audits (quarterly)
   - Refactor large components as they grow
   - Remove unused code immediately
   - Archive instead of disable

---

## Appendix: File References

### Files to Create
- [ ] `docs/RLS_STRATEGY.md`
- [ ] `docs/EDGE_FUNCTIONS_GUIDE.md`
- [ ] `docs/CLEANUP_SUMMARY.md` (after completion)
- [ ] `supabase/functions/_shared/models/openai-config.ts`
- [ ] `supabase/functions/_shared/models/openai-prompt-templates.ts`
- [ ] `supabase/functions/_shared/search/tavily-config.ts`
- [ ] `supabase/functions/_shared/search/domain-config.ts`
- [ ] `supabase/functions/_shared/search/company-mappings.ts`
- [ ] `supabase/functions/_shared/timeout-config.ts`
- [ ] `src/components/PracticeCard.tsx`
- [ ] `src/components/PracticeControls.tsx`
- [ ] `src/components/PracticeFilters.tsx`
- [ ] `src/components/SessionMetrics.tsx`
- [ ] `src/hooks/usePracticeSession.ts`

### Files to Modify
- [ ] `supabase/functions/_shared/config.ts` (simplify)
- [ ] `supabase/functions/cv-analysis/index.ts` (remove logger import)
- [ ] `CLAUDE.md` (port config, best practices)
- [ ] `supabase/schema.sql` (after status column migration)

### Files to Delete
- [ ] `supabase/functions/_shared/logging.ts`
- [ ] `supabase/functions/_shared/config.example.ts`

### Files to Archive
- [ ] `src/services/tavilyAnalyticsService.ts` (optional)
- [ ] Create `archive/` folder for old code

### New Migrations
- [ ] `supabase/migrations/20251120000000_consolidate_status_column.sql`

---

## Final Notes

### Why This Cleanup Matters
1. **Developer Experience**: Smaller files, clearer code, better docs
2. **Maintenance**: Easier to find bugs, simpler to extend
3. **Onboarding**: New developers understand patterns faster
4. **Quality**: Technical debt addressed, foundation strengthened
5. **Velocity**: Future feature development will be faster

### Expected Timeline
- **Planning & Preparation**: Days 1-2 (30 min)
- **Critical Cleanup**: Days 3-5 (4 hours)
- **Code Organization**: Days 6-10 (10-12 hours)
- **Documentation**: Days 11-15 (4-5 hours)
- **Review & Merge**: Days 16-21 (2-3 hours)

**Total Effort**: 15-20 hours spread over 3 weeks

### Next Steps
1. Review this plan with team
2. Adjust timeline based on team capacity
3. Create tracking issue in GitHub
4. Begin Phase 1 (Critical Cleanup)
5. Report progress weekly

---

**Document Prepared**: November 14, 2025
**Last Updated**: November 14, 2025
**Status**: Ready for Review & Execution
