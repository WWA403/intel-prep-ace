# Testing

## Structure

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
        ├── test_07_cv_job_comparison.ts        📋 Next
        └── test_08_complete_workflow.ts        📋 Next
```

**Total**: 25 tests, 100% passing

---

## Commands

```bash
make test           # Run all tests
make test-unit      # Run unit tests
```

---

## Test 07: CV-Job Comparison (Unit)

**Module**: `cv-job-comparison` Edge Function

**Scenarios**:
1. Generate comparison with CV + job requirements
2. Validate gap analysis structure
3. Test skill matching percentage
4. Handle missing data

---

## Test 08: Complete Workflow (Integration)

**Flow**:
```
Create search → Company/Job/CV research (parallel)
→ CV-Job comparison → Question generation
→ Verify database consistency
```

**Assertions**:
- Search status: pending → processing → completed
- All 6 Edge Functions executed
- 120-150 questions generated
- No orphaned data
