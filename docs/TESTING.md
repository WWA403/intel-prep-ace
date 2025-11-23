# Testing Documentation

## Overview

Comprehensive unit testing for all Edge Functions with database cross-verification.

**Total Coverage**: 6 modules, 25 tests, 100% passing

---

## Current Test Coverage

### ✅ Test 01: Search Creation (5 tests)
**Module**: Database operations
**Scenarios**:
- Basic search creation (with/without CV)
- Multiple searches per user
- Required field validation
- Status enumeration

### ✅ Test 02: Interview Research (4 tests)
**Module**: `interview-research` Edge Function
**Scenarios**:
- Fire-and-forget async processing (202 response)
- Request acceptance without waiting for completion
- Required parameter validation
- Error handling

### ✅ Test 03: Company Research (4 tests)
**Module**: `company-research` Edge Function
**Scenarios**:
- Tavily API integration for company insights
- Interview questions bank extraction
- Database cross-verification (tavily_searches, scraped_urls)
- Invalid company handling

### ✅ Test 04: Job Analysis (4 tests)
**Module**: `job-analysis` Edge Function
**Scenarios**:
- Tavily Extract API for job posting URLs
- Multiple URL processing
- Technical/soft skills extraction
- Empty input handling

### ✅ Test 05: CV Analysis (4 tests)
**Module**: `cv-analysis` Edge Function
**Scenarios**:
- OpenAI-powered CV parsing
- Skills and experience extraction
- Minimal CV content handling
- Response structure validation

### ✅ Test 06: Question Generator (4 tests)
**Module**: `interview-question-generator` Edge Function
**Scenarios**:
- Experience-level adaptation (junior/mid/senior)
- Question bank structure validation (7 categories)
- Mock data generation
- Required parameter validation

---

## Test Infrastructure

### Commands
```bash
make test           # Run all tests
make test-unit      # Run unit tests only
```

### Test Pattern
- **Framework**: Deno test
- **Auth**: Real user authentication
- **Database**: Cross-verification with Supabase
- **Cleanup**: Automatic test data removal
- **API Calls**: Real Edge Function invocations

### Key Features
- Database state verification after each operation
- Real API integration (no mocking)
- Comprehensive error handling validation
- Cleanup guarantees (finally blocks)

---

## Next Steps

### Phase 1: Integration Testing
**Objective**: End-to-end workflow validation

**Scenarios**:
- Complete interview prep flow (search → research → questions)
- Multi-stage processing coordination
- Progress tracking across services
- Failure recovery and retry logic

**Key Tests**:
- User creates search with CV
- System triggers company research, job analysis, CV analysis (parallel)
- System generates 120-150 interview questions
- User accesses questions via frontend
- Database consistency throughout workflow

### Phase 2: Performance Testing
**Objective**: Validate system under load

**Scenarios**:
- Concurrent user searches
- Large CV processing (10+ pages)
- Multiple job URL analysis (10+ URLs)
- Question generation timeout validation

**Metrics**:
- Response times (target: <30s for full flow)
- Database query performance
- API rate limit handling
- Memory usage under load

### Phase 3: Frontend Testing
**Objective**: UI/UX validation

**Tools**: Playwright or Cypress

**Scenarios**:
- Search form submission
- Progress dialog real-time updates
- Question card interactions
- Practice session flow
- Error state handling

### Phase 4: Error Scenarios
**Objective**: Resilience validation

**Scenarios**:
- API failures (Tavily, OpenAI timeout)
- Invalid user input (malformed URLs, corrupt CV)
- Database connection issues
- Partial data scenarios (missing company insights)
- Concurrent request conflicts

---

## Test Execution

### Run All Unit Tests
```bash
make test-unit
```

**Expected Duration**: ~3-5 minutes
**Expected Result**: 25/25 tests passing

### Individual Test Runs
```bash
# Run specific test file
deno test --allow-all tests/unit/test_edge_functions/test_01_search_creation.ts
```

---

## Test Maintenance

### Adding New Tests
1. Create test file: `tests/unit/test_edge_functions/test_XX_module_name.ts`
2. Follow existing pattern (auth, database verification, cleanup)
3. Add 4+ scenarios per module
4. Run and verify: `make test-unit`

### Environment Setup
Required in `.env`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`

### Common Issues
- **Database cross-verification failures**: Check RLS policies
- **Timeout errors**: Increase Deno test timeout (--timeout flag)
- **Authentication failures**: Verify test user exists in Supabase Auth

---

## Success Metrics

**Current Status**: ✅ All core modules covered

**Target Coverage**:
- ✅ Unit tests: 100% (6/6 modules)
- 🔄 Integration tests: 0% (planned)
- 🔄 Frontend tests: 0% (planned)
- 🔄 Performance tests: 0% (planned)

**Quality Gates**:
- All unit tests must pass before merge to main
- Database consistency validated in every test
- Cleanup verified (no orphaned test data)
