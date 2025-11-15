# Implementation Roadmap: URL Deduplication & Interview Experience Enhancement

## Executive Summary

This roadmap addresses two critical issues affecting Hireo:

1. **URL Deduplication System** - Currently disabled due to timeout issues, causing 40%+ increase in API costs
2. **Interview Experience Research** - Limited real candidate experience extraction affecting research quality

**Target Outcomes:**
- 40%+ reduction in API costs through smart URL reuse
- 50%+ improvement in response times
- Enhanced interview experience quality with real candidate insights

## Phase 1: Critical URL Deduplication Fixes (Week 1)

### **Priority: CRITICAL** - System Currently Non-Functional

#### Issue Analysis
- **Root Cause**: Database query timeouts in `find_reusable_urls()` due to complex RLS policies
- **Impact**: URL deduplication completely disabled in `company-research/index.ts`
- **Cost**: 40%+ increase in Tavily API calls, 30-60s longer response times

#### Implementation Tasks

**1. Database Performance Optimization**
```sql
-- File: supabase/migrations/20250721000000_fix_url_deduplication_performance.sql

-- Add critical performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scraped_urls_composite_lookup 
ON public.scraped_urls(company_name, content_quality_score DESC, first_scraped_at DESC) 
WHERE content_quality_score >= 0.3;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scraped_urls_active_reuse
ON public.scraped_urls(company_name, role_title, times_reused DESC) 
WHERE first_scraped_at > (now() - INTERVAL '30 days');

-- Simplify RLS policies for service role performance
DROP POLICY IF EXISTS "Users can view scraped URLs through their searches" ON public.scraped_urls;
CREATE POLICY "Service role full access" ON public.scraped_urls 
FOR ALL USING (auth.uid() IS NULL);

-- Optimize the find_reusable_urls function
CREATE OR REPLACE FUNCTION find_reusable_urls_fast(
  p_company TEXT,
  p_role TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_max_age_days INTEGER DEFAULT 30,
  p_min_quality_score FLOAT DEFAULT 0.3
)
RETURNS TABLE(url TEXT, domain TEXT, title TEXT, content_type TEXT, content_quality_score FLOAT)
AS $$
BEGIN
  RETURN QUERY
  SELECT su.url, su.domain, su.title, su.content_type, su.content_quality_score
  FROM public.scraped_urls su
  WHERE su.company_name = p_company
    AND su.content_quality_score >= p_min_quality_score
    AND su.first_scraped_at > (now() - INTERVAL '1 day' * p_max_age_days)
  ORDER BY su.content_quality_score DESC, su.times_reused DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**2. Code Optimization with Fallback**
```typescript
// File: supabase/functions/_shared/url-deduplication.ts

// Enhanced findReusableUrls with timeout and fallback
async findReusableUrls(
  company: string, 
  role?: string, 
  country?: string
): Promise<UrlDeduplicationResult> {
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Query timeout')), 5000)
  );
  
  try {
    const urlsPromise = this.supabase.rpc('find_reusable_urls_fast', {
      p_company: company,
      p_role: role,
      p_country: country
    });

    const { data: reusableUrls, error } = await Promise.race([
      urlsPromise,
      timeoutPromise
    ]);

    if (error) throw error;

    return {
      reusable_urls: reusableUrls?.map((item: any) => item.url) || [],
      excluded_domains: [], // Simplified for performance
      total_cached_urls: reusableUrls?.length || 0
    };
  } catch (error) {
    console.warn('URL deduplication failed, using fallback:', error.message);
    return {
      reusable_urls: [],
      excluded_domains: [],
      total_cached_urls: 0
    };
  }
}
```

**3. Re-enable URL Deduplication in Company Research**
```typescript
// File: supabase/functions/company-research/index.ts

// REMOVE this block:
// TEMPORARILY DISABLE URL DEDUPLICATION TO FIX TIMEOUT ISSUES
// console.log("URL deduplication temporarily disabled - using fresh search only");

// REPLACE with proper URL deduplication integration:
try {
  const urlDeduplication = new UrlDeduplicationService(supabase);
  const deduplicationResult = await urlDeduplication.findReusableUrls(company, role, country);
  
  if (deduplicationResult.reusable_urls.length > 0) {
    console.log(`Found ${deduplicationResult.reusable_urls.length} reusable URLs`);
    // Use cached content logic
  }
} catch (error) {
  console.warn('URL deduplication failed, proceeding with fresh search');
}
```

**Success Criteria:**
- [ ] Database indexes deployed and active
- [ ] URL deduplication re-enabled without timeouts
- [ ] Cache hit rate >20% within first week
- [ ] Response time improvement >30%

## Phase 2: Interview Experience Enhancement (Week 2)

### **Priority: HIGH** - Improve Research Quality

#### Current Gaps
- Generic interview stages not based on real company data
- Limited extraction of candidate experiences from sources
- Missing experience credibility assessment

#### Implementation Tasks

**1. Interview Experience Processor**
```typescript
// File: supabase/functions/_shared/interview-experience-processor.ts

export class InterviewExperienceProcessor {
  async extractRealExperiences(searchResults: any[], company: string): Promise<InterviewExperience[]> {
    const experiences: InterviewExperience[] = [];
    
    for (const result of searchResults) {
      if (this.isInterviewExperience(result)) {
        const experience = await this.processInterviewContent(result, company);
        if (experience.qualityScore > 0.7) {
          experiences.push(experience);
        }
      }
    }
    
    return this.synthesizeExperiences(experiences);
  }
  
  private isInterviewExperience(content: any): boolean {
    const experiencePatterns = [
      /interview process/i, /interviewed at/i, /my interview/i,
      /interview experience/i, /they asked/i, /the interviewer/i,
      /\d+ rounds? of interviews?/i, /phone screen/i, /technical round/i
    ];
    
    const text = content.content || content.title || '';
    return experiencePatterns.some(pattern => pattern.test(text));
  }
  
  private async processInterviewContent(result: any, company: string): Promise<InterviewExperience> {
    const content = result.content || '';
    
    return {
      company: company,
      content: content,
      source_url: result.url,
      qualityScore: this.assessExperienceQuality(content, result),
      experienceType: this.classifyExperience(content),
      difficultyLevel: this.extractDifficulty(content),
      interviewStages: this.extractStages(content),
      questions: this.extractQuestions(content),
      insights: this.extractInsights(content)
    };
  }
  
  private assessExperienceQuality(content: string, metadata: any): number {
    let score = 0.3; // Base score
    
    // Content depth indicators
    if (content.length > 500) score += 0.2;
    if (content.includes('specific question') || content.includes('they asked')) score += 0.2;
    if (content.includes('preparation') || content.includes('advice')) score += 0.15;
    
    // Source credibility
    const url = metadata.url?.toLowerCase() || '';
    if (url.includes('glassdoor')) score += 0.2;
    if (url.includes('blind')) score += 0.25;
    if (url.includes('leetcode')) score += 0.15;
    if (url.includes('reddit.com/r/')) score += 0.1;
    
    // Experience detail indicators
    const detailPatterns = [
      /interview took \d+ (hours?|minutes?)/i,
      /\d+ rounds? of interviews?/i,
      /waited \d+ (days?|weeks?) for/i,
      /salary.{0,20}(\$[\d,]+|[\d,]+k)/i
    ];
    
    detailPatterns.forEach(pattern => {
      if (pattern.test(content)) score += 0.1;
    });
    
    return Math.min(1.0, score);
  }
}
```

**2. Database Schema Enhancement**
```sql
-- File: supabase/migrations/20250721000001_enhance_interview_experiences.sql

-- Add experience metadata columns
ALTER TABLE public.interview_experiences ADD COLUMN IF NOT EXISTS
  experience_type TEXT CHECK (experience_type IN ('positive', 'negative', 'neutral')),
  difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard', 'very_hard')),
  outcome TEXT CHECK (outcome IN ('offer', 'rejection', 'ongoing', 'withdrew')),
  interview_date DATE,
  role_level TEXT CHECK (role_level IN ('intern', 'entry', 'junior', 'mid', 'senior', 'staff', 'principal')),
  location TEXT,
  interview_format TEXT CHECK (interview_format IN ('remote', 'onsite', 'hybrid')),
  preparation_time_weeks INTEGER,
  source_credibility_score FLOAT DEFAULT 0.5,
  extracted_questions TEXT[],
  key_insights TEXT[];

-- Create index for experience lookups
CREATE INDEX IF NOT EXISTS idx_interview_experiences_company_quality 
ON public.interview_experiences(company_name, source_credibility_score DESC);
```

**3. Integration with Company Research**
```typescript
// File: supabase/functions/company-research/index.ts

// Add interview experience processing after URL extraction
const experienceProcessor = new InterviewExperienceProcessor();
const realExperiences = await experienceProcessor.extractRealExperiences(searchResults, company);

// Store experiences in database
for (const experience of realExperiences) {
  await supabase.from('interview_experiences').upsert({
    company_name: company,
    role_title: role,
    content: experience.content,
    source_url: experience.source_url,
    experience_type: experience.experienceType,
    difficulty_level: experience.difficultyLevel,
    source_credibility_score: experience.qualityScore,
    extracted_questions: experience.questions,
    key_insights: experience.insights
  });
}
```

**Success Criteria:**
- [ ] Interview experience processor implemented and tested
- [ ] Database schema updated with experience metadata
- [ ] Average experience quality score >0.7
- [ ] Real candidate experiences integrated into interview stages

## Phase 3: Integration & Optimization (Week 3)

### **Priority: MEDIUM** - Polish and Monitor

#### Implementation Tasks

**1. Monitoring & Analytics**
```typescript
// File: supabase/functions/_shared/performance-monitor.ts

export class PerformanceMonitor {
  static async trackCachePerformance(
    searchId: string,
    cacheHitRate: number,
    responseTime: number,
    apiCallsAvoided: number
  ) {
    await supabase.from('performance_metrics').insert({
      search_id: searchId,
      metric_type: 'cache_performance',
      cache_hit_rate: cacheHitRate,
      response_time_ms: responseTime,
      api_calls_saved: apiCallsAvoided,
      timestamp: new Date()
    });
  }
}
```

**2. Error Recovery & Fallbacks**
```typescript
// Enhanced error handling across all functions
const performanceMonitor = new PerformanceMonitor();
const startTime = Date.now();

try {
  // Main research logic with URL deduplication
  const result = await conductResearchWithCaching();
  
  performanceMonitor.trackSuccess(searchId, Date.now() - startTime);
  return result;
} catch (error) {
  console.warn('Primary research failed, using fallback');
  performanceMonitor.trackFallback(searchId, error);
  
  // Fallback to basic research without caching
  return await conductBasicResearch();
}
```

**3. User Experience Validation**
- Load testing with realistic search queries
- Response time monitoring (<30 seconds target)
- Cache hit rate validation (40%+ target)
- API cost analysis (30% reduction target)

**Success Criteria:**
- [ ] End-to-end testing passes with real queries
- [ ] Performance monitoring active
- [ ] User experience metrics meet targets
- [ ] System stability confirmed under load

## Success Metrics & KPIs

### Technical Metrics
- **URL Cache Hit Rate**: 40%+ (currently 0%)
- **Average Response Time**: <30 seconds (currently 60-90s)
- **API Cost Reduction**: 30% fewer Tavily calls
- **System Uptime**: 99%+ with graceful degradation

### Quality Metrics  
- **Interview Experience Quality**: Average credibility score >0.7
- **Content Reuse Efficiency**: 60%+ of similar searches use cached content
- **Research Accuracy**: User satisfaction >85%
- **Error Rate**: <5% of searches fail completely

### Business Impact
- **Cost Reduction**: 30-40% reduction in monthly API costs
- **User Experience**: 50%+ improvement in perceived response time
- **Research Depth**: 2x more real candidate experiences per search
- **System Reliability**: Eliminates timeout-related failures

## Risk Mitigation

### Technical Risks
- **Database Performance**: Comprehensive indexing and query optimization
- **API Rate Limits**: Intelligent caching and request distribution
- **Memory Usage**: Content size limits and cleanup procedures
- **Data Consistency**: Transactional operations and rollback procedures

### Implementation Risks
- **Deployment Issues**: Staged rollout with feature flags
- **Backward Compatibility**: Graceful fallbacks to previous behavior  
- **User Impact**: A/B testing and gradual feature enablement
- **Monitoring Gaps**: Comprehensive logging and alerting

This roadmap provides a clear, prioritized approach to fixing the critical URL deduplication issues while enhancing interview experience research quality, ensuring the system delivers on its promise of intelligent, efficient interview preparation.