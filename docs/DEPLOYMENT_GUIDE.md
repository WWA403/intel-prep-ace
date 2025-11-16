# Option B Redesign - Deployment Guide

**Status:** Code Ready for Deployment
**Target:** Full system deployment with zero downtime

---

## Quick Start Checklist

- [ ] **Step 1:** Deploy database migration to Supabase
- [ ] **Step 2:** Regenerate TypeScript types
- [ ] **Step 3:** Deploy edge functions
- [ ] **Step 4:** Test 3-5 searches
- [ ] **Step 5:** Monitor for 24 hours

---

## Step 1: Deploy Database Migration

### Option A: Via Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://app.supabase.com
   - Select project: `xjjjvefsrkcszhuwtoss`

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy Migration SQL**
   - Open file: `supabase/migrations/20251116_redesign_option_b_search_artifacts.sql`
   - Copy the entire contents

4. **Execute Migration**
   - Paste SQL into the query editor
   - Click "Run"
   - Wait for completion (should be < 5 seconds)
   - Verify message: "Success" or similar

5. **Verify in Database**
   - Click "Table Editor" in left sidebar
   - Should see new table: `search_artifacts`
   - Verify columns exist
   - Verify RLS is enabled
   - Verify indexes created

### Option B: Via CLI (Once Connection Fixed)

```bash
npx supabase db push --linked
```

---

## Step 2: Regenerate TypeScript Types

After database migration is deployed, generate new types:

```bash
npx supabase gen types typescript --project-id xjjjvefsrkcszhuwtoss > src/types/supabase.ts
```

This updates `src/types/supabase.ts` to include:
- `search_artifacts` table type
- All new columns
- Proper TypeScript definitions

---

## Step 3: Deploy Edge Functions

### Deploy All Functions

```bash
npm run functions:deploy
```

This deploys:
- `company-research` (unchanged)
- `job-analysis` (unchanged)
- `cv-analysis` (unchanged)
- `interview-research` (UPDATED - redesigned)
- `interview-question-generator` (unchanged - still used elsewhere)

### Deploy Only interview-research (If Needed)

```bash
npx supabase functions deploy interview-research --project-ref xjjjvefsrkcszhuwtoss
```

### Verify Deployment

1. **Via Supabase Dashboard:**
   - Click "Functions" in left sidebar
   - Should see `interview-research` listed
   - Click it to verify code updated
   - Check recent invocations for errors

2. **Via CLI:**
   ```bash
   npx supabase functions list --project-ref xjjjvefsrkcszhuwtoss
   ```

---

## Step 4: Test End-to-End Searches

### Test 1: Basic Search (No CV)

```bash
# Via application UI or API:

POST /api/interview-research
{
  "company": "Google",
  "role": "Software Engineer",
  "country": "USA",
  "userId": "<test-user-id>",
  "searchId": "<test-search-id>"
}

# Expected response:
{
  "success": true,
  "searchId": "<test-search-id>",
  "status": "completed",
  "message": "Interview research completed successfully"
}

# Expected results:
# - search_artifacts created
# - company_research_raw populated
# - interview_stages created (4 stages)
# - interview_questions created (120+)
# - searches status = 'completed'
# - No errors in logs
```

### Test 2: Full Search (With CV)

```bash
POST /api/interview-research
{
  "company": "Microsoft",
  "role": "Product Manager",
  "country": "USA",
  "cv": "<full CV text>",
  "targetSeniority": "mid",
  "userId": "<test-user-id>",
  "searchId": "<test-search-id>"
}

# Verify:
# - cv_analysis_raw populated
# - Comparison analysis includes skill/experience gaps
# - Questions personalized for seniority
```

### Test 3: Multiple Concurrent Searches

Run 3-5 searches simultaneously:

```bash
# Open 3-5 terminal tabs and run:
POST /api/interview-research (with different companies)

# Verify:
# - All complete within 60 seconds each
# - No race conditions
# - All data saved correctly
```

### Test 4: Error Handling

```bash
# If OpenAI fails:
# - Verify search_artifacts has raw data saved
# - Error logged in database
# - User can retry

# If database fails:
# - Verify timeout protection triggers
# - Function fails gracefully
# - Status updated to 'failed'
```

---

## Step 5: Monitoring

### Real-Time Logs

**Via Supabase Dashboard:**
1. Click "Functions" in sidebar
2. Click "interview-research"
3. Check "Recent Invocations"
4. Click any search to see detailed logs

**Expected log patterns:**

```
🚀 Starting interview research for search: <id>
📊 PHASE 1: Gathering research data...
✅ PHASE 1 Complete
💾 PHASE 2: Saving raw research data...
✅ Raw data saved to database
🔄 PHASE 3: Unified synthesis...
✅ PHASE 3 Complete
💾 PHASE 4: Saving all results to database...
✅ Interview research complete for search: <id>
```

### Error Patterns to Watch For

**Good sign:** No errors in logs
```
✅ All phases complete
✅ All data saved successfully
```

**Warning sign:** Phase timeouts
```
⏱️ Database timeout after XXXms
❌ Operation failed: [operation name]
```

**Bad sign:** RLS errors
```
406 Not Acceptable
400 Bad Request
```

**Bad sign:** OpenAI errors
```
❌ OpenAI synthesis error: 429 (rate limit)
❌ OpenAI synthesis error: 401 (invalid key)
```

### Metrics to Track (24 Hours)

| Metric | Target | Warning | Alert |
|--------|--------|---------|-------|
| Success rate | 95%+ | < 90% | < 80% |
| Avg completion time | 50-65s | > 90s | > 120s |
| Error rate | < 1% | > 2% | > 5% |
| 406 errors | 0 | Any | Any |
| Database timeouts | 0 | Any | Any |
| Raw data saved | 100% | < 99% | < 95% |

---

## Rollback Procedure

If critical issues discovered:

### Option 1: Restore Backup (Recommended)

```bash
# Restore database from before migration
# Via Supabase Dashboard:
# Settings → Backups → Restore from backup before 20251116

# Restore old code
git checkout HEAD~1 supabase/functions/interview-research/index.ts

# Redeploy
npm run functions:deploy
```

### Option 2: Disable New System (Minimal)

```bash
# Revert to old interview-research code
cp supabase/functions/interview-research/index.ts.backup \
   supabase/functions/interview-research/index.ts

# Note: This won't work because cv_job_comparisons table is dropped
# Use Option 1 (full restore) instead
```

---

## Known Limitations

### Feature Removed

- `cv-job-comparison` microservice no longer exists
- `interview-question-generator` still exists but not called directly by interview-research
- Any code calling cv-job-comparison function will fail

### New Dependencies

- `search_artifacts` table (required)
- Unified synthesis in interview-research (required)
- Frontend must query search_artifacts for comparison data (updated)

---

## Troubleshooting

### Issue: 406 Errors on search_artifacts Query

**Cause:** RLS policy not applied or user ID mismatch

**Fix:**
1. Verify migration ran successfully
2. Check user_id in search_artifacts matches authenticated user
3. Verify RLS policies exist (check Supabase Dashboard)

```bash
# Check policies
SELECT * FROM pg_policies WHERE tablename = 'search_artifacts';
```

### Issue: search_artifacts Table Not Found

**Cause:** Migration didn't run

**Fix:**
1. Re-run migration via Supabase Dashboard
2. Verify in Table Editor that table exists
3. Regenerate types: `npx supabase gen types typescript --project-id xjjjvefsrkcszhuwtoss > src/types/supabase.ts`

### Issue: Function Hangs or Times Out

**Cause:** Database operations taking > 30 seconds

**Fix:**
1. Check database performance (slow queries)
2. Check network connectivity
3. Verify indexes created
4. Increase timeout (if acceptable)

### Issue: Synthesis Quality Poor

**Cause:** OpenAI prompt not optimized

**Fix:**
1. Review synthesis prompt in interview-research/index.ts
2. Check OpenAI tokens and temperature settings
3. Verify raw data quality being passed to OpenAI

---

## Success Criteria

✅ Deployment complete when:

1. **Database ready:**
   - search_artifacts table created
   - RLS policies working
   - Indexes created
   - Zero migration errors

2. **Functions deployed:**
   - interview-research function updated
   - No syntax errors
   - Recent invocations show success

3. **Searches working:**
   - Can run full search start-to-finish
   - Completes in 50-65 seconds
   - All data saved correctly
   - No 406 errors

4. **Data integrity:**
   - search_artifacts populated with raw data
   - interview_stages created
   - interview_questions created
   - searches.search_status = 'completed'

5. **Monitoring stable:**
   - 10+ successful searches
   - 95%+ success rate
   - < 1% error rate
   - Zero 406 errors

---

## Post-Deployment

### Next 24 Hours

- Monitor logs continuously
- Check for any 406 or timeout errors
- Verify data quality in search_artifacts
- Get feedback from first users

### Next 7 Days

- Monitor success metrics
- Check for edge cases
- Review database performance
- Plan optimization if needed

### Next 30 Days

- Complete confidence in system
- Consider deprecating old code
- Plan documentation updates
- Optimize further if needed

---

## Contact & Support

If deployment issues occur:

1. Check logs in Supabase Dashboard
2. Review troubleshooting section above
3. Check OPTION_B_REDESIGN_COMPLETE.md for details
4. Consider rollback if critical

---

## Deployment History

| Date | Step | Status | Notes |
|------|------|--------|-------|
| 2025-11-16 | Code changes | ✅ Complete | Interview-research redesigned |
| 2025-11-16 | Frontend updates | ✅ Complete | Search service updated |
| TBD | Database migration | ⏳ Pending | Waiting for deployment |
| TBD | Function deployment | ⏳ Pending | Waiting for DB first |
| TBD | Testing | ⏳ Pending | After functions deployed |
| TBD | Monitoring | ⏳ Pending | After testing passes |

---

## Ready to Deploy

The system is code-complete and ready for database migration deployment.

**Next Action:** Run Step 1 (Deploy database migration) when ready.

