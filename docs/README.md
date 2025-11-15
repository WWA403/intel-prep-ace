# Cleanup Plan Documentation

This folder contains the cleanup plan for the Hireo codebase.

## Start Here

- **[CLEANUP_QUICK_START.md](CLEANUP_QUICK_START.md)** — 10-minute overview
  - 5 critical issues to fix
  - 3-week timeline
  - Expected improvements
  - Quick action checklist

## Complete Roadmap

- **[CLEANUP_PLAN.md](CLEANUP_PLAN.md)** — Full implementation guide (1,028 lines)
  - Detailed task breakdown
  - Week-by-week timeline
  - Risk assessment
  - Success metrics
  - Rollback procedures

## Implementation Guide

- **[CLEANUP_CODE_TEMPLATES.md](CLEANUP_CODE_TEMPLATES.md)** — Ready-to-use code
  - SQL migration for status column consolidation
  - Component refactoring examples (Practice.tsx split)
  - Config file templates
  - Hook implementation examples
  - Test templates
  - Deployment checklists

## Quick Reference

- **[CLEANUP_SUMMARY.md](CLEANUP_SUMMARY.md)** — 5-minute executive summary
  - What's being fixed
  - Why it matters
  - Next steps for your team

---

## Which Document Should I Read?

**I have 5 minutes**: Read CLEANUP_QUICK_START.md

**I have 15 minutes**: Read CLEANUP_SUMMARY.md + CLEANUP_QUICK_START.md

**I need to implement**: Read CLEANUP_PLAN.md + use CLEANUP_CODE_TEMPLATES.md

**I'm a team lead**: Read CLEANUP_QUICK_START.md, then share with team

**I'm assigned a task**: Read relevant section in CLEANUP_PLAN.md, reference CLEANUP_CODE_TEMPLATES.md

---

## The 5 Issues Being Addressed

1. **Duplicate logging system** (30 min to fix)
   - Delete `supabase/functions/_shared/logging.ts`
   - Update cv-analysis import

2. **Redundant database columns** (1.5-2 hours)
   - Drop `status` column from searches table
   - SQL migration provided

3. **Port configuration mismatch** (30 min)
   - Update CLAUDE.md: 8080 → 5173

4. **Oversized component** (6-8 hours)
   - Split Practice.tsx (1,543 lines) into 5 components
   - Templates provided

5. **Monolithic config file** (2 hours)
   - Split config.ts into domain-specific files
   - Templates provided

---

## Timeline

- **Week 1**: Critical fixes (4-5 hours)
- **Week 2**: Code organization (10-12 hours)
- **Week 3**: Documentation (4-5 hours)
- **Total**: 15-20 hours over 3 weeks

---

## Expected Improvements

- 30% faster onboarding
- 25% faster bug fixes
- 20% faster feature development
- Practice.tsx: 1,543 lines → 5 focused components (<400 lines each)

---

## Next Steps

Start with [CLEANUP_QUICK_START.md](CLEANUP_QUICK_START.md)
