# Hireo Enhancement Plan

**Date:** February 12, 2026
**Scope:** Comprehensive codebase audit, cleanup, and enhancement roadmap
**Status:** Active

---

## Executive Summary

This document consolidates findings from a full codebase scan, identifying legacy content for cleanup, outstanding bugs, and a prioritized enhancement roadmap. The goal is to reduce technical debt, improve code quality, and establish a clear path forward.

---

## Table of Contents

1. [Documentation Cleanup](#1-documentation-cleanup)
2. [Outstanding Bugs & Issues](#2-outstanding-bugs--issues)
3. [Code Quality Issues](#3-code-quality-issues)
4. [Database & Schema Issues](#4-database--schema-issues)
5. [Enhancement Roadmap](#5-enhancement-roadmap)
6. [Quick Wins](#6-quick-wins)

---

## 1. Documentation Cleanup

### 1.1 Missing Documentation (Referenced but Not Found)

The README.md references several documentation files that **do not exist**:

| Referenced File | Location Referenced | Action |
|----------------|---------------------|--------|
| `docs/PRODUCT_DESIGN.md` | README.md line 527 | Create or remove reference |
| `docs/TECHNICAL_DESIGN.md` | README.md line 528 | Create or remove reference |
| `docs/DEVELOPMENT_GUIDE.md` | README.md lines 529, 533-536 | Create or remove reference |
| `docs/IMPLEMENTATION_CHANGES.md` | README.md lines 147, 530, 555 | Create or remove reference |
| `docs/TESTING_BACKLOG.md` | README.md line 138 | Consolidate into TESTING.md |
| `docs/DEPLOYMENT_GUIDE.md` | README.md line 57, CLAUDE.md | Create minimal guide |

**Recommendation:** Remove broken references from README.md and consolidate testing backlog into existing TESTING.md.

### 1.2 Redundant/Overlapping Documentation

| File | Issue | Action |
|------|-------|--------|
| `docs/IMPLEMENTATION_ROADMAP.md` | Duplicates content from UI_UX_REDESIGN_ANALYSIS.md; 37KB of detailed future planning | Archive or consolidate |
| `docs/UI_UX_REDESIGN_ANALYSIS.md` | 43KB detailed comparison document; largely informational, not actionable | Archive after extracting key decisions |
| Both above files | Untracked in git (per git status) | Review if intended for commit |

### 1.3 Empty/Stale Files

| File | Issue | Action |
|------|-------|--------|
| `supabase/schema.sql` | Empty (1 line) but CLAUDE.md says it should contain schema snapshot | Run `npx supabase db pull --linked > supabase/schema.sql` |

### 1.4 Documentation to Keep

| File | Purpose | Status |
|------|---------|--------|
| `CLAUDE.md` | Developer playbook | Good - keep updated |
| `README.md` | Project overview | Needs cleanup of broken links |
| `docs/TESTING.md` | Testing guidance | Good - expand with backlog items |
| `docs/UI_UX_ENHANCEMENT_PLAN.md` | UX backlog | Good - primary UX reference |
| `docs/RESEARCH_PIPELINE_IMPROVEMENTS.md` | Pipeline optimization | Good - technical reference |

---

## 2. Outstanding Bugs & Issues

### 2.1 Critical (P0) - Blocking Issues

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| B1 | **Guest onboarding blocked** - Form stays interactive for logged-out users, error only surfaces at submit | `src/pages/Home.tsx:88-101` | Users type long briefs only to be blocked |
| B2 | **File upload non-functional** - Upload buttons exist but handlers log TODO | `src/pages/Home.tsx:265-271`, `src/pages/Profile.tsx:163-170` | Users believe uploads work; trust drops |
| B3 | **Global glyph bug** - Letter "s/S" fails to render (font issue) | CSS/Font configuration | All strings appear corrupted |
| B4 | **Navigation disappears for guests** - No nav on `/auth` page | `src/components/Navigation.tsx`, page layouts | Users can't reach docs/support |

### 2.2 High Priority (P1) - User Experience

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| B5 | **Auth tab data leakage** - Sign-in/sign-up share form state | `src/pages/Auth.tsx:16-24` | Password bleed between tabs |
| B6 | **Missing "Forgot Password"** | `src/pages/Auth.tsx` | No recovery path |
| B7 | **Dashboard hard-coded placeholders** - Static "3-4 weeks / Technical + Behavioral" | `src/pages/Dashboard.tsx:349-378` | Fake data reduces credibility |
| B8 | **Profile Delete CV only clears local state** | `src/pages/Profile.tsx:213-223` | Users think CV deleted when it isn't |
| B9 | **History access inconsistent** - Navigation history is conditional | `src/components/Navigation.tsx` | Can't access previous research |
| B10 | **Show history button is TODO** | `src/pages/Dashboard.tsx:233` | Non-functional button |

### 2.3 Medium Priority (P2) - Polish

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| B11 | Practice swipe conflicts with scroll | `src/pages/Practice.tsx` | Accidental navigation |
| B12 | Bottom nav overlays content on mobile | `src/pages/Practice.tsx`, CSS | Hidden input fields |
| B13 | Missing redirect context on auth | `src/pages/Auth.tsx` | Users don't know why redirected |
| B14 | Z-index conflicts (nav vs dialogs) | Various components | Content peeking through |

---

## 3. Code Quality Issues

### 3.1 Console Logging (50+ instances)

Production code contains excessive console.log statements that should be:
- Removed for info/debug logs
- Replaced with proper error tracking for errors

**Affected files:**
- `src/services/searchService.ts` - 18 console calls
- `src/services/tavilyAnalyticsService.ts` - 3 console calls
- `src/pages/Profile.tsx` - 12 console calls (mostly debug logs)
- `src/pages/Practice.tsx` - 10 console calls
- `src/pages/Home.tsx` - 2 console calls
- `src/pages/Dashboard.tsx` - 1 console call
- `src/pages/NotFound.tsx` - 1 console call

**Recommendation:**
1. Remove all `console.log` calls used for debugging
2. Keep `console.error` but consider error tracking service
3. Add proper logging utility with log levels

### 3.2 TODO Comments

| Location | TODO Description | Action |
|----------|-----------------|--------|
| `src/pages/Profile.tsx:167` | "Process PDF and extract text - Phase 3 feature" | Disable button or implement |
| `src/pages/Home.tsx:268` | "Process PDF upload" | Disable button or implement |
| `src/pages/Dashboard.tsx:233` | Show history button onClick | Implement or remove |

### 3.3 Type Safety

The codebase uses relaxed TypeScript settings per `tsconfig.json`. While intentional for rapid development, consider:
- Enabling `strict: true` incrementally
- Adding proper null checks in critical paths
- Improving type definitions for Supabase responses

---

## 4. Database & Schema Issues

### 4.1 Schema Snapshot Missing

`supabase/schema.sql` is empty but should contain the current database schema per CLAUDE.md instructions.

**Fix:**
```bash
npx supabase db pull --linked > supabase/schema.sql
git add supabase/schema.sql
git commit -m "chore: populate schema snapshot"
```

### 4.2 Redundant Status Columns

Per `docs/RESEARCH_PIPELINE_IMPROVEMENTS.md`, the `searches` table has:
- Both `search_status` and `status` columns with identical enums
- Duplicative progress fields (`progress_step`, `progress_percentage`, `started_at`, `completed_at`)

**Recommendation:** Consolidate in future migration after verifying no code depends on duplicates.

### 4.3 Legacy Tables

| Table | Status | Notes |
|-------|--------|-------|
| `cv_job_comparisons` | DEPRECATED | Functionality moved to `search_artifacts` |
| `interview_stages` | Being phased out | Data moving to `search_artifacts` |
| `interview_questions` (legacy columns) | Partial migration | Some columns deprecated |

---

## 5. Enhancement Roadmap

### Phase 1: Cleanup & Stabilization (1-2 weeks)

**Goal:** Remove technical debt and fix critical bugs

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P0 | Fix guest onboarding (B1) - Gate form behind auth | 2h | High |
| P0 | Disable file upload buttons until implemented (B2) | 1h | High |
| P0 | Fix font/glyph issue (B3) | 2h | High |
| P0 | Show navigation for all users (B4) | 1h | High |
| P0 | Populate `supabase/schema.sql` | 15min | Medium |
| P1 | Remove broken documentation references | 30min | Low |
| P1 | Clean up console.log statements | 2h | Medium |

### Phase 2: UX Improvements (2-3 weeks)

**Goal:** Address P1 bugs and improve user experience

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P1 | Fix auth tab state leakage (B5) | 1h | Medium |
| P1 | Add "Forgot Password" flow (B6) | 4h | Medium |
| P1 | Remove/fix Dashboard placeholders (B7) | 2h | High |
| P1 | Wire Profile Delete CV to Supabase (B8) | 2h | High |
| P1 | Implement cross-page history sheet (B9, B10) | 8h | High |
| P1 | Add redirect context on auth (B13) | 1h | Medium |

### Phase 3: Polish & Refinement (2-3 weeks)

**Goal:** Address P2 issues and improve code quality

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P2 | Fix practice swipe/scroll conflicts (B11) | 4h | Medium |
| P2 | Fix mobile bottom nav overlap (B12) | 2h | Medium |
| P2 | Establish z-index scale (B14) | 2h | Low |
| P2 | Implement proper error logging | 4h | Medium |
| P2 | Enable stricter TypeScript checks | 8h | Medium |

### Phase 4: Feature Enhancements (Ongoing)

Based on `docs/IMPLEMENTATION_ROADMAP.md`:

| Feature | Description | Effort |
|---------|-------------|--------|
| Gap Analysis System | Match scoring, visual gauges | 30-40h |
| Enhanced Dashboard | Card-based layout, visualizations | 40-50h |
| AI Feedback System | Real-time answer evaluation | 50-60h |
| Practice Mode Selection | Deep Dive vs Mock Interview | 30-40h |
| Onboarding Flow | Welcome screen, feature tour | 20-30h |

---

## 6. Quick Wins

**Tasks that can be completed in ≤1 day with high impact:**

1. **Gate Home form for guests** (B1)
   - Add auth check before form renders
   - Show "Sign in to start research" CTA

2. **Disable upload buttons** (B2)
   - Add "Coming Soon" badge
   - Add privacy copy explaining roadmap

3. **Always show navigation** (B4)
   - Render nav on `/auth` page
   - Include Logo + Docs + Support + Sign In links

4. **Populate schema.sql**
   - Run db pull command
   - Commit to repository

5. **Remove broken doc references**
   - Clean up README.md
   - Remove references to non-existent files

6. **Fix font-sans stack** (B3)
   - Revert to Tailwind default font
   - Test across auth screens

---

## Appendix: File Reference

### Files to Modify (Priority Order)

1. `src/pages/Home.tsx` - Guest gating, upload disable
2. `src/pages/Auth.tsx` - Tab state, forgot password, redirect context
3. `src/components/Navigation.tsx` - Always render, history access
4. `src/pages/Profile.tsx` - Delete CV wiring, upload disable
5. `src/pages/Dashboard.tsx` - Remove placeholders, history button
6. `README.md` - Remove broken documentation links
7. `supabase/schema.sql` - Populate with current schema

### Files to Archive/Delete

1. `docs/IMPLEMENTATION_ROADMAP.md` - Consolidate into this document
2. `docs/UI_UX_REDESIGN_ANALYSIS.md` - Archive after extracting decisions

### Files to Create

1. `docs/ENHANCEMENT_PLAN.md` - This document (created)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-12 | Initial creation from codebase audit | Claude |

---

**Next Steps:**
1. Review this plan with stakeholders
2. Create tickets for P0 items
3. Begin Phase 1 cleanup work
4. Schedule regular progress reviews
