# Cleanup Implementation Templates

This document contains ready-to-use code templates, SQL migrations, and examples for the cleanup tasks.

---

## 1. Status Column Consolidation Migration

### SQL Migration File
**File**: `supabase/migrations/20251120000000_consolidate_status_column.sql`

```sql
-- Migration: Consolidate redundant status column
-- Purpose: Remove duplicate 'status' column, keep active 'search_status'
-- Reason: Both columns track the same state, causing data redundancy
-- Backward Compatibility: No breaking changes - code uses search_status

BEGIN;

-- Step 1: Verify data integrity
-- All rows should have same values in both columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.searches
    WHERE search_status != status AND status IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Data mismatch detected: search_status and status have different values';
  END IF;
END $$;

-- Step 2: Drop unused status column
-- This is safe because:
-- - All code uses search_status (verified via grep)
-- - Both columns have identical CHECK constraints
-- - No foreign keys reference the status column
ALTER TABLE public.searches DROP COLUMN IF EXISTS status;

-- Step 3: Update CHECK constraint to be cleaner
-- Remove any old multi-column constraints
ALTER TABLE public.searches
  DROP CONSTRAINT IF EXISTS searches_status_check;

-- Step 4: Add updated constraint (if needed)
-- Note: search_status constraint may already exist, this ensures it's present
ALTER TABLE public.searches
  ADD CONSTRAINT check_search_status_valid
    CHECK (search_status IN ('pending', 'processing', 'completed', 'failed'));

-- Step 5: Verify schema
-- Double-check the table structure is correct
DO $$
DECLARE
  v_has_status BOOLEAN;
  v_has_search_status BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'searches' AND column_name = 'status'
  ) INTO v_has_status;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'searches' AND column_name = 'search_status'
  ) INTO v_has_search_status;

  IF v_has_status THEN
    RAISE EXCEPTION 'Status column still exists after migration!';
  END IF;

  IF NOT v_has_search_status THEN
    RAISE EXCEPTION 'search_status column missing after migration!';
  END IF;
END $$;

COMMIT;
```

### Testing the Migration

**1. Local Testing (before production)**:
```bash
# Apply migration to local database
npx supabase db push

# Run verification queries
npx supabase db query
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'searches' AND column_name IN ('status', 'search_status')

# Verify no 'status' column exists
```

**2. Production Testing (on branch)**:
```bash
# Create branch
git checkout -b fix/consolidate-status-column

# Commit migration
git add supabase/migrations/20251120000000_consolidate_status_column.sql
git commit -m "feat(db): consolidate search status column"

# Deploy to remote (preview if available)
npx supabase functions deploy

# Test backend still works
npm run dev
# Run manual tests in UI
```

**3. Verification Queries**:
```sql
-- Verify column no longer exists
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'searches'
ORDER BY column_name;
-- Expected: search_status, NOT status

-- Verify data integrity
SELECT COUNT(*) FROM public.searches;
-- Should return all searches

-- Verify RLS still works
SELECT count(*) FROM public.searches
WHERE user_id = current_user_id;
-- Should work if user authenticated
```

---

## 2. Remove Logging.ts

### Step 1: Verify No Other Imports

```bash
# Find all imports of logging.ts
grep -r "from.*logging\|import.*logging" supabase/functions/ --include="*.ts"

# Expected output (only cv-analysis should show):
# cv-analysis/index.ts:import { Logger } from '../_shared/logging.ts';
```

### Step 2: Remove from cv-analysis

**File**: `supabase/functions/cv-analysis/index.ts`

Find and remove (around line 3):
```typescript
// DELETE THIS LINE:
import { Logger } from '../_shared/logging.ts';

// And DELETE any usage like:
// const logger = new Logger(searchId);
// logger.log(...) - if any exists
```

**Updated section** (example):
```typescript
// BEFORE
import { Deno } from 'https://deno.land/std@0.208.0/mod.ts';
import { Logger } from '../_shared/logging.ts';
import { getAnalysis } from '...';

// AFTER
import { Deno } from 'https://deno.land/std@0.208.0/mod.ts';
import { getAnalysis } from '...';
```

### Step 3: Delete the File

```bash
# Delete logging.ts
rm supabase/functions/_shared/logging.ts

# Verify it's gone
ls supabase/functions/_shared/logging.ts
# Should show: "No such file or directory"
```

### Step 4: Verify No Broken Imports

```bash
# Search for any remaining logging imports
grep -r "logging" supabase/functions/ --include="*.ts" | grep -v "// "

# Should return: 0 results
```

### Step 5: Test

```bash
# Deploy cv-analysis function
npx supabase functions deploy cv-analysis

# Run a CV analysis in the app
# Should work without errors
```

---

## 3. Fix Port Configuration

### Update CLAUDE.md

**Find all references to 8080**:
```bash
grep -n "8080" docs/CLAUDE.md
```

**Replace with 5173**:
```bash
# Using sed (macOS/Linux)
sed -i '' 's/8080/5173/g' docs/CLAUDE.md

# Or manually edit each line:
# Line 13: port: 8080 → port: 5173
# Line 64: http://localhost:8080 → http://localhost:5173
# Line 115: port 8080 → port 5173
```

**Verify the change**:
```bash
grep -n "5173" docs/CLAUDE.md
# Should show multiple lines with 5173

grep -n "8080" docs/CLAUDE.md
# Should show: 0 results
```

### Verify vite.config.ts Uses 5173

```bash
grep -n "port:" vite.config.ts
# Should show: port: 5173
```

---

## 4. Create RLS_STRATEGY.md

**File**: `docs/RLS_STRATEGY.md`

```markdown
# Row Level Security (RLS) Strategy

## Overview

Row Level Security is PostgreSQL's built-in authorization system. It controls which rows each user can access from their Supabase application.

## Key Principles

### 1. Direct User Match Preferred
Always prefer direct `user_id` checks when possible:
```sql
CREATE POLICY "User can access their own data"
  ON public.table_name
  USING (auth.uid() = user_id);
```

### 2. Avoid Complex Subqueries in PostgREST
PostgREST (Supabase's REST API layer) has limitations with complex RLS policies:
```sql
-- ❌ AVOID: PostgREST struggles with this
CREATE POLICY "Complex join"
  ON public.cv_job_comparisons
  USING (
    auth.uid() IN (SELECT user_id FROM searches WHERE id = search_id)
  );

-- ✅ BETTER: Split into simpler policies
CREATE POLICY "Direct user match"
  ON public.cv_job_comparisons
  USING (auth.uid() = user_id);

CREATE POLICY "Via search relationship"
  ON public.cv_job_comparisons
  USING (
    search_id IN (SELECT id FROM searches WHERE user_id = auth.uid())
  );
```

### 3. Test Policies with Actual API
Always test RLS policies against your actual Supabase API endpoint, not just psql:
```bash
# Use your frontend or curl to test
curl -H "Authorization: Bearer $TOKEN" \
  'https://PROJECT.supabase.co/rest/v1/cv_job_comparisons?select=*'

# Should return 200 OK with user's data, not 406
```

## Case Study: cv_job_comparisons RLS Issue

### The Problem
Your team tried 5 sequential migrations to fix RLS for cv_job_comparisons.

**Migration Attempts**:
1. `20251101000001` - Initial fix attempt
2. `20251101000002` - "Robust" fix
3. `20251101000003` - Schema fix
4. `20251102000000` - Query fix
5. `20251102000001` - "Fundamental" fix

**Symptom**: 406 Not Acceptable errors when accessing cv_job_comparisons by search_id

### Root Cause
PostgREST has limitations filtering with complex JOIN subqueries in RLS policies.

When you tried:
```sql
CREATE POLICY "Access via search"
  ON public.cv_job_comparisons
  USING (
    auth.uid() IN (SELECT user_id FROM searches WHERE id = search_id)
  );
```

PostgREST couldn't apply this complex filter to REST API requests.

### The Solution
Use BOTH direct user_id match AND the relationship:
```sql
CREATE POLICY "User can access their comparisons"
  ON public.cv_job_comparisons FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT user_id FROM searches WHERE id = search_id
    )
  );
```

**Why it works**:
- Direct `user_id` match satisfies PostgREST
- The OR clause is evaluated by PostgreSQL (not constrained by PostgREST)
- Result: 200 OK responses with correct data

## Guidelines for New RLS Policies

### When Adding RLS to a New Table

1. **Identify User Relationship**
   ```sql
   -- Does table have direct user_id?
   ALTER TABLE new_table ADD COLUMN user_id UUID REFERENCES auth.users(id);
   ```

2. **Create Simple Policy First**
   ```sql
   -- Direct user match
   CREATE POLICY "User access"
     ON public.new_table
     USING (auth.uid() = user_id);
   ```

3. **Test with REST API**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     'https://PROJECT.supabase.co/rest/v1/new_table?select=*'

   # If you get 406: Policy is too complex
   # If you get 403: User doesn't have data
   # If you get 200: Success!
   ```

4. **Add Relationship Queries if Needed**
   ```sql
   -- Only if necessary:
   CREATE POLICY "Via related table"
     ON public.new_table
     USING (
       some_id IN (SELECT id FROM related_table WHERE user_id = auth.uid())
     );
   ```

## Common RLS Error Patterns

### 406 Not Acceptable
**Cause**: RLS policy too complex for PostgREST
**Solution**: Simplify policy, remove complex subqueries
**Example Fix**: Add direct user_id column, use it in policy

### 403 Forbidden
**Cause**: Policy is correct, but user doesn't have access
**Solution**: Verify user_id matches, check related table data
**Debug**: Query directly in psql to confirm data exists

### Empty Results (200 OK, but no rows)
**Cause**: Policy is working, user just has no data
**Solution**: Check if data should exist, verify filter logic
**Debug**: Add test data and retry

## Best Practices

### DO ✅
- Keep policies simple and testable
- Test policies with actual API calls
- Use direct user_id columns when possible
- Document complex policies with comments
- Create policies one at a time, test each

### DON'T ❌
- Create overly complex policies
- Test only with psql (test with REST API)
- Use policies as data filters (use queries instead)
- Create circular policy dependencies
- Assume PostgREST supports all SQL constructs

## Reference

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgREST Limitations](https://postgrest.org/en/v10/)

---

**Last Updated**: November 14, 2025
**Reviewed By**: [Your Team]
```

---

## 5. Split config.ts

### New Config Files

**File**: `supabase/functions/_shared/models/openai-config.ts`
```typescript
// OpenAI Configuration
export interface OpenAIConfig {
  model: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  topP: number;
}

export const openaiConfig: OpenAIConfig = {
  model: 'gpt-4o',
  apiKey: Deno.env.get('OPENAI_API_KEY') || '',
  maxTokens: 8000,
  temperature: 0.7,
  topP: 1.0,
};

export function validateOpenAIConfig(): void {
  if (!openaiConfig.apiKey) {
    throw new Error('OPENAI_API_KEY environment variable not set');
  }
}
```

**File**: `supabase/functions/_shared/search/tavily-config.ts`
```typescript
// Tavily API Configuration
export interface TavilyConfig {
  apiKey: string;
  maxResults: number;
  includeImages: boolean;
  searchDepth: 'basic' | 'advanced';
}

export const tavilyConfig: TavilyConfig = {
  apiKey: Deno.env.get('TAVILY_API_KEY') || '',
  maxResults: 10,
  includeImages: false,
  searchDepth: 'advanced',
};

export function validateTavilyConfig(): void {
  if (!tavilyConfig.apiKey) {
    throw new Error('TAVILY_API_KEY environment variable not set');
  }
}
```

**File**: `supabase/functions/_shared/timeout-config.ts`
```typescript
// Timeout Configuration for Concurrent Operations
export interface TimeoutConfig {
  companyResearch: number;
  jobAnalysis: number;
  cvAnalysis: number;
  questionGeneration: number;
  totalOperation: number;
}

export const timeoutConfig: TimeoutConfig = {
  companyResearch: 20000,    // 20s for external APIs
  jobAnalysis: 20000,        // 20s for large job descriptions
  cvAnalysis: 15000,         // 15s for reliable CV parsing
  questionGeneration: 40000, // 40s for OpenAI complex JSON
  totalOperation: 60000,     // 60s hard timeout limit
};

export function validateTimeoutConfig(): void {
  if (
    timeoutConfig.totalOperation <
    Math.max(
      timeoutConfig.companyResearch,
      timeoutConfig.jobAnalysis,
      timeoutConfig.cvAnalysis,
      timeoutConfig.questionGeneration
    )
  ) {
    throw new Error('Total operation timeout must exceed individual service timeouts');
  }
}
```

**File**: `supabase/functions/_shared/config.ts` (simplified)
```typescript
// Central configuration export and validation
export { openaiConfig, validateOpenAIConfig } from './models/openai-config.ts';
export { tavilyConfig, validateTavilyConfig } from './search/tavily-config.ts';
export { timeoutConfig, validateTimeoutConfig } from './timeout-config.ts';
// ... other exports

// Validate all config on startup
export function validateAllConfig(): void {
  try {
    validateOpenAIConfig();
    validateTavilyConfig();
    validateTimeoutConfig();
    // ... other validations
  } catch (error) {
    console.error('Configuration validation failed:', error.message);
    throw error;
  }
}
```

### Update Imports in Functions

**Before**:
```typescript
import { timeoutConfig } from '../_shared/config.ts';
```

**After**:
```typescript
import { timeoutConfig } from '../_shared/timeout-config.ts';
```

---

## 6. Practice.tsx Component Extraction

### New Component: PracticeCard.tsx

**File**: `src/components/PracticeCard.tsx`
```typescript
import React, { useEffect, useRef } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface PracticeCardProps {
  question: {
    id: string;
    question: string;
    category: string;
    difficulty: string;
    company_context?: string;
    suggested_answer_approach?: string;
  };
  onPlayAudio?: () => void;
  isPlaying?: boolean;
}

export function PracticeCard({
  question,
  onPlayAudio,
  isPlaying,
}: PracticeCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-2xl font-semibold">{question.question}</h2>
        <div className="flex gap-2">
          <Badge>{question.category}</Badge>
          <Badge variant="outline">{question.difficulty}</Badge>
        </div>
      </div>

      {question.company_context && (
        <div className="bg-blue-50 p-3 rounded mb-4">
          <p className="text-sm text-blue-900">
            <strong>Company Context:</strong> {question.company_context}
          </p>
        </div>
      )}

      {question.suggested_answer_approach && (
        <div className="bg-green-50 p-3 rounded mb-4">
          <p className="text-sm text-green-900">
            <strong>Approach:</strong> {question.suggested_answer_approach}
          </p>
        </div>
      )}

      {onPlayAudio && (
        <Button
          onClick={onPlayAudio}
          variant="outline"
          disabled={isPlaying}
        >
          {isPlaying ? 'Playing...' : 'Play Audio'}
        </Button>
      )}

      <audio ref={audioRef} />
    </Card>
  );
}
```

### New Hook: usePracticeSession.ts

**File**: `src/hooks/usePracticeSession.ts`
```typescript
import { useState, useCallback, useEffect } from 'react';

interface PracticeSessionState {
  currentIndex: number;
  answeredCount: number;
  skippedCount: number;
  flaggedCount: number;
  elapsedSeconds: number;
}

export function usePracticeSession(
  questionsCount: number,
  onSessionComplete?: () => void
) {
  const [state, setState] = useState<PracticeSessionState>({
    currentIndex: 0,
    answeredCount: 0,
    skippedCount: 0,
    flaggedCount: 0,
    elapsedSeconds: 0,
  });

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => ({
        ...prev,
        elapsedSeconds: prev.elapsedSeconds + 1,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check if session complete
  useEffect(() => {
    const totalProcessed = state.answeredCount + state.skippedCount;
    if (totalProcessed >= questionsCount && onSessionComplete) {
      onSessionComplete();
    }
  }, [state.answeredCount, state.skippedCount, questionsCount, onSessionComplete]);

  const moveToNext = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.min(prev.currentIndex + 1, questionsCount - 1),
      answeredCount: prev.answeredCount + 1,
    }));
  }, [questionsCount]);

  const skip = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.min(prev.currentIndex + 1, questionsCount - 1),
      skippedCount: prev.skippedCount + 1,
    }));
  }, [questionsCount]);

  const flag = useCallback(() => {
    setState((prev) => ({
      ...prev,
      flaggedCount: prev.flaggedCount + 1,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      currentIndex: 0,
      answeredCount: 0,
      skippedCount: 0,
      flaggedCount: 0,
      elapsedSeconds: 0,
    });
  }, []);

  return {
    ...state,
    moveToNext,
    skip,
    flag,
    reset,
  };
}
```

---

## 7. Update CLAUDE.md Best Practices Section

Add this section to CLAUDE.md:

```markdown
## Best Practices & Guidelines

### Component Size Guidelines
- **Target**: 200-400 lines per component
- **Maximum**: 500 lines (refactor above this)
- **Monitor**: If component approaches 400 lines, plan refactoring
- **Rationale**: Easier to test, understand, and maintain

**Example**: Practice.tsx was 1,543 lines → split into 5 components
- PracticeCard (200 lines)
- PracticeControls (150 lines)
- PracticeFilters (120 lines)
- SessionMetrics (100 lines)
- usePracticeSession hook (150 lines)

### Configuration Management
- **Principle**: Group configs by domain
- **Structure**: Separate files for different concerns
- **Central Export**: `config.ts` exports all configs

**Structure**:
```
_shared/
├── config.ts (central export)
├── models/openai-config.ts
├── search/tavily-config.ts
└── timeout-config.ts
```

### Logging Strategy
- **System**: Use `logger.ts` (SearchLogger) for all logging
- **Pattern**: Import and instantiate at function start
- **Output**: Logs go to Supabase function logs
- **Never**: Use disabled logging.ts (removed)

```typescript
import { SearchLogger } from '../_shared/logger.ts';

export default async function handler(req: Request) {
  const logger = new SearchLogger(searchId);
  logger.log('Processing started', { company, role });
  // ... work happens ...
  logger.log('Processing complete', { status: 'success' });
}
```

### Port Configuration
- **Development Port**: 5173 (not 8080)
- **Start Dev Server**: `npm run dev`
- **Access**: http://localhost:5173
- **Environment**: Automatic setup via vite.config.ts

### RLS Policy Best Practices
See `docs/RLS_STRATEGY.md` for detailed guidance.
**Quick Rule**: Use direct `user_id` match when possible, avoid complex subqueries.
```

---

## Testing Templates

### Component Test Example

**File**: `src/components/__tests__/PracticeCard.test.tsx`
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PracticeCard } from '../PracticeCard';

describe('PracticeCard', () => {
  const mockQuestion = {
    id: '1',
    question: 'Tell us about a time you failed',
    category: 'behavioral',
    difficulty: 'Medium',
    company_context: 'At TechCorp, we value learning from failure',
  };

  it('renders question text', () => {
    render(<PracticeCard question={mockQuestion} />);
    expect(screen.getByText('Tell us about a time you failed')).toBeInTheDocument();
  });

  it('displays category and difficulty badges', () => {
    render(<PracticeCard question={mockQuestion} />);
    expect(screen.getByText('behavioral')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('shows company context when provided', () => {
    render(<PracticeCard question={mockQuestion} />);
    expect(screen.getByText(/At TechCorp/)).toBeInTheDocument();
  });

  it('calls onPlayAudio when button clicked', () => {
    const onPlayAudio = vi.fn();
    render(<PracticeCard question={mockQuestion} onPlayAudio={onPlayAudio} />);
    screen.getByText('Play Audio').click();
    expect(onPlayAudio).toHaveBeenCalled();
  });
});
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All changes tested locally
- [ ] Build succeeds (`npm run build`)
- [ ] Linter passes (`npm run lint`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Tests pass (if applicable)
- [ ] Code reviewed by team
- [ ] No console errors in dev

### Deployment
- [ ] Merge PR to main
- [ ] Create deployment PR with changelog
- [ ] Deploy edge functions (`npm run functions:deploy`)
- [ ] Pull schema snapshot (`npx supabase db pull --linked > supabase/schema.sql`)
- [ ] Verify no 404 errors in function logs
- [ ] Test critical paths in production

### Post-Deployment
- [ ] Monitor error logs for 24 hours
- [ ] Test user workflows end-to-end
- [ ] Verify analytics still working
- [ ] Document any issues found
- [ ] Share deployment notes with team

---

**Templates Last Updated**: November 14, 2025
