# Test Plan

## Current Coverage

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

---

## Test 07: CV-Job Comparison (Unit)

**Module**: `cv-job-comparison` Edge Function

**Scenarios**:
1. Generate comparison with CV + job requirements
2. Validate gap analysis structure (strengths, gaps, recommendations)
3. Test skill matching percentage calculation
4. Handle missing CV or job data

**Expected Output**:
```json
{
  "comparison": {
    "overall_match_percentage": 75,
    "strengths": [...],
    "gaps": [...],
    "recommendations": [...]
  }
}
```

---

## Test 08: Complete Workflow (Integration)

**Module**: End-to-end interview prep flow

**Scenarios**:
1. Full flow: Create search → Research (company/job/cv) → Generate questions → Access results
2. Verify database consistency across all tables (searches, interview_questions, cv_job_comparisons)
3. Test progress tracking during async processing
4. Validate final question count (120-150 questions)

**Flow**:
```
User creates search with CV
  → interview-research triggered (202)
  → company-research + job-analysis + cv-analysis (parallel)
  → cv-job-comparison generated
  → interview-question-generator runs
  → All data stored in database
  → Frontend can query results
```

**Assertions**:
- Search status changes: pending → processing → completed
- All 6 Edge Functions called successfully
- Database has: company insights, job requirements, CV analysis, comparison, 120-150 questions
- No orphaned data (all linked to search_id)

---

## Next Steps After 08

### Test 09: Error Recovery (Integration)
- API timeout handling (Tavily, OpenAI)
- Partial failure recovery
- Retry logic validation

### Test 10: Performance (Load)
- Concurrent user searches
- Large CV processing
- Question generation under load
