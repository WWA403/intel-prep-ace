# INT - Interview Prep Tool 🎯

A modern, AI-powered interview preparation tool that helps small circles of friends and colleagues quickly learn how target companies run their interviews and prepare effectively.

![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)

## ✨ Features

### 🔍 **Intelligent Research** 
- **Multi-Source Company Research**: Real-time data from Glassdoor, Levels.fyi, Blind, and more
- **Job Description Analysis**: Automatic extraction and analysis of role requirements
- **AI-Powered CV Analysis**: Intelligent skill extraction and gap analysis
- **Seniority-Based Personalization**: Set your experience level (junior/mid/senior) for tailored questions
- **Personalized Guidance**: Tailored preparation based on your actual background
- **Structured AI Responses**: Comprehensive, accurate interview insights

### 📊 **Comprehensive Question Generation**
- **120-150 questions per search** regardless of experience level
- **Research-driven approach** using actual candidate reports from Glassdoor, Reddit, Blind
- **Experience-level adaptation** - same volume, different complexity for junior/mid/senior
- **User-controlled seniority** - explicitly set target level or auto-detect from CV
- **Company-specific intelligence** - 60%+ questions reference actual company information
- Interview process overview with timeline
- Stage-by-stage preparation guidance

### 🎴 **Practice Mode**
- Flash-card style question review
- Filter questions by interview stage
- Built-in timer for practice sessions
- Answer tracking and session persistence
- Voice/text recording capabilities (Phase 3)

### 📱 **Modern Experience**
- Responsive design for desktop and mobile
- Clean, minimalist interface with fresh green theme
- Real-time status updates during AI research
- Complete search history and session management
- Secure authentication and data protection
- Full CV management with intelligent parsing

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Modern web browser
- Internet connection for AI research

### Getting Started

1. **Visit the App**
   ```
   https://lovable.dev/projects/f6161025-31dc-4404-8dea-263c660d8616
   ```

2. **Create Account**
   - Sign up with email and password
   - No email verification required for quick testing

3. **Start Researching**
   - Enter a company name (e.g., "Google", "Meta", "Stripe")
   - Optionally add role and location details
   - Upload your CV for personalized insights
   - Click "Run Intel" and wait for AI research

4. **Review & Practice**
   - Explore the generated interview stages
   - Read targeted preparation guidance
   - Practice with company-specific questions
   - Save results for future reference

## 🏗️ Architecture

### Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **AI:** OpenAI GPT-4.1 for intelligent research
- **Deployment:** Lovable platform

### Key Components

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── Navigation.tsx  # Main navigation
│   └── AuthProvider.tsx # Authentication context
├── pages/              # Route components
│   ├── Home.tsx        # Search interface
│   ├── Dashboard.tsx   # Results display
│   ├── Practice.tsx    # Question practice
│   ├── Profile.tsx     # User settings
│   └── Auth.tsx        # Login/signup
├── hooks/              # Custom React hooks
│   └── useAuth.ts      # Authentication logic
├── services/           # API integration
│   └── searchService.ts # Research API calls
└── integrations/       # External services
    └── supabase/       # Database client
```

## 🛠️ Development

### Local Setup

1. **Clone and Install**
   ```bash
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Create .env.local in project root
   cp .env.local.example .env.local  # If example exists
   
   # Add these variables to .env.local:
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   OPENAI_API_KEY=your-openai-api-key
   TAVILY_API_KEY=your-tavily-api-key
   ```

3. **Start Development**
   ```bash
   # Start frontend
   npm run dev
   
   # Start Supabase (if using local development)
   npm run supabase:start
   
   # Start functions with proper environment loading
   npm run functions:serve
   ```

4. **Open Browser**
   ```
   http://localhost:5173
   ```

### 🚨 Important: Function Environment Setup

**Critical**: Always use `npm run functions:serve` instead of `supabase functions serve` directly. 

The npm script includes the `--env-file .env.local` flag that loads your API keys. Without this, you'll get placeholder content instead of real AI research.

**Signs of missing environment variables:**
- Seeing "Research in progress" instead of real company data
- No entries in `tavily_searches` table
- Function logs show "🚨 TAVILY_API_KEY missing!"

**Troubleshooting:**
```bash
# Check if functions are getting environment variables
npm run functions:serve-debug

# Verify environment file exists
ls -la .env.local

# Check Supabase status
npm run supabase:status
```

### Database Setup

The project uses Supabase with the following main tables:
- `profiles` - User profile information with auto-creation triggers
- `searches` - Research queries with status tracking (pending/processing/completed/failed)
- `interview_stages` - Structured interview process stages with ordering
- `interview_questions` - Questions for each stage with relationships
- `resumes` - CV content storage with intelligent parsing metadata
- `practice_sessions` - User practice tracking with answer persistence
- `practice_answers` - Individual answer records with timing data

All tables include comprehensive Row Level Security (RLS) policies for data protection and user isolation.

### AI Integration - Microservices Architecture

The app uses a sophisticated microservices architecture with four specialized Edge Functions:

**Microservices Design:**
- **cv-analysis:** Independent CV parsing and skill extraction
- **company-research:** Tavily-powered company interview research  
- **job-analysis:** Job description URL extraction and analysis
- **interview-research:** Synthesis orchestrator that generates final outputs

**OpenAI Integration:**
- **Models:** GPT-4o for research synthesis, GPT-4o-mini for CV analysis
- **Structured Output:** Enforced JSON responses with comprehensive error handling
- **Features:** Company insights, personalized guidance, preparation timelines

**Tavily Expert Integration:**
- **Real-Time Research:** Multi-source company interview data
- **Job Analysis:** Advanced extraction from role description URLs
- **Trusted Sources:** Glassdoor, Levels.fyi, Blind, LinkedIn, Indeed
- **Advanced Search:** Parallel targeted queries for comprehensive coverage

**System Features:**
- **Single Responsibility:** Each function has one clear purpose
- **Error Isolation:** Component failures don't cascade
- **Parallel Processing:** Data gathering runs concurrently
- **Graceful Degradation:** Robust fallbacks for all external services
- **Performance Optimized:** Parallel processing and efficient API usage
- **Security:** All API keys securely stored in Supabase secrets

## 🎯 Usage Examples

### Basic Company Research
```
Company: Meta
Role: Software Engineer
Country: United States
Target Level: Auto-detect (or select Junior/Mid/Senior)
```

### Advanced Research with Context
```
Company: Stripe
Role: Senior Frontend Engineer
Country: Ireland
Target Level: Senior (override auto-detection)
Role Links: 
- https://stripe.com/jobs/listing/senior-frontend-engineer
- https://careers.stripe.com/jobs/12345

CV: [Upload your resume for personalized insights]
```

### Using Seniority Levels
```
Profile Settings:
- Set your current experience level (Junior/Mid/Senior)
- Questions adapt to your background

Per-Search Override:
- Applying for senior role as mid-level? Select "Senior" in search
- Questions will match the target level, not your current level
```

### Practice Session
1. Complete a company research first
2. Select specific interview stages from Dashboard
3. Navigate to Practice mode with selected questions
4. Use flash-card interface to review questions
5. Time your responses and save answers
6. Track progress across multiple sessions

## 🔒 Security & Privacy

- **Data Encryption:** All user data encrypted at rest and in transit
- **Access Control:** Row Level Security ensures user data isolation
- **Privacy First:** No data sharing with third parties
- **User Control:** Full data export and deletion capabilities

## 📖 Documentation

### Core Documentation
- **[Product Design Document](docs/PRODUCT_DESIGN.md)** - Product vision, features, and user journeys
- **[Technical Design Document](docs/TECHNICAL_DESIGN.md)** - Complete system architecture and implementation details
- **[Development Guide](docs/DEVELOPMENT_GUIDE.md)** - Practical patterns and day-to-day development workflows
- **[Implementation Changes](docs/IMPLEMENTATION_CHANGES.md)** - Development progress tracking and phase completions

### Quick Start for Developers
1. **New to the project?** Start with [Product Design](docs/PRODUCT_DESIGN.md) for context
2. **Setting up development?** Follow [Development Guide - Getting Started](docs/DEVELOPMENT_GUIDE.md#getting-started)
3. **Understanding the architecture?** See [Technical Design](docs/TECHNICAL_DESIGN.md)
4. **Daily development?** Use [Development Guide](docs/DEVELOPMENT_GUIDE.md) as your reference

---

## 📋 MVP Status & Development Backlog

> **Last Updated:** October 25, 2025  
> **Current MVP Completion:** ~82% (21/30 core features complete)

### 🎯 PRD vs Implementation Status

#### ✅ **Implemented Features** (75%)
- Email/password authentication with Supabase
- Company research with multi-source AI analysis
- Job description and CV analysis
- **Seniority-based personalization** (junior/mid/senior) ✨ NEW
- Interview stages generation (4-6 stages per company)
- Question generation (120-150 questions per search)
- **Experience-level adaptation** with smart fallback logic ✨ NEW
- **Question session sampler** with configurable size (default: 10) ✨ NEW
- **Favorite & flag questions** (favorite/needs_work/skipped) ✨ NEW
- Practice mode with filtering by stage/category/difficulty/favorites
- Voice recording capability
- Session tracking and answer persistence
- Real-time research progress tracking
- Search history and result caching

#### ⚠️ **Partially Implemented** (20%)
- **Session Summary**: Shows answered count, missing summary page
- **Location Field**: Country exists, not city-level
- **Timer**: Running timer exists, no presets (30/60/90s)
- **Question Quality**: Has confidence scoring, no user rating
- **Progress Analytics**: No dashboard (planned)

#### 🔴 **Critical Gaps** (8%)
1. ~~**Seniority-Based Personalization**~~ ✅ **COMPLETED** (Epic 1.1)
2. ~~**Question Session Sampler**~~ ✅ **COMPLETED** (Epic 1.2)
3. ~~**Favorite/Flag Questions**~~ ✅ **COMPLETED** (Epic 1.3)
4. **Swipe/Gesture Interface** - Traditional buttons only, no gestures
5. **Audio STT (Speech-to-Text)** - Voice records but doesn't transcribe
6. **AI Answer Feedback** - Not implemented (out of MVP scope per PRD)

---

### 🚀 Development Backlog

#### **PHASE 1: Critical MVP Gaps** (2-3 weeks)

<details>
<summary><b>✅ Epic 1.1: Seniority-Based Personalization</b> ✅ COMPLETED (Oct 25, 2024)</summary>

**User Story**: As a user, I want to specify my seniority level so questions match my experience level.

**Tasks**:
- [x] Add `seniority` enum to `profiles` table (`junior`, `mid`, `senior`)
- [x] Add `target_seniority` to `searches` table
- [x] Add seniority selector to Profile page
- [x] Add seniority field to Home search form
- [x] Update question generator to adapt difficulty by seniority
- [x] Create and test database migration

**Implementation Details**:
- ✅ Database migration: `20251025000000_add_seniority_fields.sql`
- ✅ Profile page: Experience Level card with dropdown selector
- ✅ Home page: Target Level field (optional, defaults to auto-detect)
- ✅ Smart fallback logic: User selection → Profile seniority → CV inference → Default 'mid'
- ✅ Question generator: Same volume (120-150), different complexity based on level

**Files Changed**:
- `supabase/migrations/20251025000000_add_seniority_fields.sql` - New migration
- `src/pages/Profile.tsx` - Experience Level card with selector
- `src/pages/Home.tsx` - Target Level field in search form
- `src/services/searchService.ts` - Profile update methods
- `supabase/functions/interview-research/index.ts` - Pass targetSeniority
- `supabase/functions/interview-question-generator/index.ts` - Fallback logic implementation
</details>

<details>
<summary><b>✅ Epic 1.2: Question Session Sampler</b> ✅ COMPLETED (Oct 25, 2025)</summary>

**User Story**: As a user, I want practice sessions with configurable question counts (not 100+).

**Tasks**:
- [x] Create `sessionSampler.ts` with smart selection algorithm
- [x] Implement random sampling respecting current filters
- [x] Update Practice.tsx to use sampled questions
- [x] Add configurable sample size input (default: 10)
- [x] Add "Start New Practice Session" button
- [x] Add "Show All Questions" toggle

**Implementation Details**:
- ✅ Simple MVP approach - no over-engineering
- ✅ Default 10 questions, user can input 1-100
- ✅ Samples respect user's current stage/category/difficulty filters
- ✅ Fisher-Yates shuffle for random sampling
- ✅ "Start New Practice Session" triggers sampling
- ✅ "Show All Questions" disables sampling
- ✅ Skipped `last_practiced_at` tracking (not needed for MVP)

**Files Created/Changed**:
- `src/services/sessionSampler.ts` - New service with random sampling
- `src/pages/Practice.tsx` - Added session sampler UI and logic
</details>

<details>
<summary><b>✅ Epic 1.3: Favorite & Flag Questions</b> ✅ COMPLETED (Oct 25, 2025)</summary>

**User Story**: As a user, I want to favorite important questions and flag difficult ones.

**Tasks**:
- [x] Create `user_question_flags` table (favorite/needs_work/skipped)
- [x] Add `setQuestionFlag()`, `removeQuestionFlag()`, and `getQuestionFlags()` to service
- [x] Add favorite/flag buttons to question cards
- [x] Add "Show Favorites Only" filter to practice mode
- [x] Sampler works with favorites (filters applied before sampling)

**Implementation Details**:
- ✅ Database migration: `20251025120000_add_user_question_flags.sql`
- ✅ Service methods: `setQuestionFlag()`, `removeQuestionFlag()`, `getQuestionFlags()`
- ✅ Practice page: Flag buttons (⭐ Favorite, 🚩 Needs Work, ⏭️ Skip)
- ✅ Setup screen: "Show Favorites Only" checkbox filter
- ✅ Toggle behavior: Click same flag to remove it
- ✅ Unique constraint: One flag per user per question (UPSERT pattern)

**Files Created/Changed**:
- `supabase/migrations/20251025120000_add_user_question_flags.sql` - New migration
- `src/services/searchService.ts` - Added flag methods
- `src/pages/Practice.tsx` - Added flag buttons and favorites filter
</details>

---

#### **PHASE 2: Enhanced UX** (2 weeks)

<details>
<summary><b>Epic 2.1: Swipe Gesture Interface</b> ⏱️ 3 days</summary>

**Tasks**:
- [ ] Install `react-swipeable` or `framer-motion`
- [ ] Implement swipe handlers (left=skip, right=favorite, up=guidance)
- [ ] Add visual swipe indicators
- [ ] Test on iOS/Android mobile devices

**Files to Change**:
- `src/pages/Practice.tsx` - Add swipe logic
- `package.json` - Add swipe library
</details>

<details>
<summary><b>Epic 2.2: Audio Transcription (STT)</b> ⏱️ 5 days</summary>

**User Story**: As a user, I want my voice answers transcribed automatically.

**Tasks**:
- [ ] Choose STT provider (OpenAI Whisper vs Browser Web Speech API)
- [ ] Create `transcribeAudio` Edge Function (if Whisper)
- [ ] Update `savePracticeAnswer` to transcribe audio
- [ ] Display transcript after recording
- [ ] Ensure P95 latency ≤ 6s (per PRD)

**Provider Comparison**:
- **OpenAI Whisper**: $0.006/min, high accuracy, requires API
- **Web Speech API**: Free, browser-native, lower accuracy

**Files to Change**:
- `supabase/functions/transcribe-audio/` - New function
- `src/services/searchService.ts` - Add transcription
- `src/pages/Practice.tsx` - Display transcript
</details>

<details>
<summary><b>Epic 2.3: Timer Presets</b> ⏱️ 2 days</summary>

**Tasks**:
- [ ] Add timer preset buttons (30/60/90s)
- [ ] Implement countdown timer (vs count-up)
- [ ] Add visual/audio alert on expiry
- [ ] Save user's preferred preset to profile

**Files to Change**:
- `src/pages/Practice.tsx` - Timer controls
- `src/pages/Profile.tsx` - Save preference
</details>

<details>
<summary><b>Epic 2.4: Session Summary & Completion</b> ⏱️ 3 days</summary>

**Tasks**:
- [ ] Create `SessionSummary` component
- [ ] Display answered/skipped/favorited breakdown
- [ ] Add session notes field
- [ ] Mark session as completed in DB

**Files to Create/Change**:
- `src/components/SessionSummary.tsx` - New component
- `src/pages/Practice.tsx` - Show on completion
- Database: Add `session_notes` to `practice_sessions`
</details>

---

#### **PHASE 3: Performance & Polish** (1 week)

<details>
<summary><b>Epic 3.1: Progress Analytics Dashboard</b> ⏱️ 4 days</summary>

**Tasks**:
- [ ] Create Analytics section in Profile/Dashboard
- [ ] Add `getPracticeAnalytics(userId, days)` method
- [ ] Display charts (questions/day, completion rate, categories)
- [ ] Use `recharts` library (already installed)

**Metrics to Track**:
- Questions answered per day (last 30 days)
- Session completion rate
- Category breakdown (behavioral vs technical)
- Favorite question count
</details>

<details>
<summary><b>Epic 3.2: Performance Optimization</b> ⏱️ 3 days</summary>

**Tasks**:
- [ ] Add performance monitoring (measure P95 latency)
- [ ] Lazy load Practice page components
- [ ] Implement question pagination (vs loading 100+)
- [ ] Optimize `getSearchResults` query
- [ ] Add service worker for offline support

**Performance Targets** (from PRD):
- App shell load: < 2s on 5G
- API response P95: < 500ms
- Research first set: 60-90s (currently 2-5 mins)
</details>

---

### 📊 Priority Matrix

| Epic                                  | Priority   | Effort | User Impact | Business Value |
| ------------------------------------- | ---------- | ------ | ----------- | -------------- |
| ~~**1.1 Seniority Personalization**~~ | ✅ Complete | Medium | High        | High           |
| ~~**1.2 Question Sampler**~~          | ✅ Complete | Medium | Very High   | Very High      |
| ~~**1.3 Favorite/Flag**~~             | ✅ Complete | Low    | High        | Medium         |
| **2.2 Audio STT**                     | 🟡 High     | High   | Very High   | High           |
| **2.1 Swipe Gestures**                | 🟡 High     | Low    | Medium      | Low            |
| **2.4 Session Summary**               | 🟡 High     | Low    | Medium      | Medium         |
| **2.3 Timer Presets**                 | 🟢 Medium   | Low    | Low         | Low            |
| **3.1 Analytics Dashboard**           | 🟢 Medium   | Medium | Medium      | Medium         |
| **3.2 Performance**                   | 🟡 High     | Medium | High        | High           |

---

### 🎯 Recommended Sprint Plan

#### **Sprint 1** (Week 1-2): Foundation
- ✅ Epic 1.1: Seniority Personalization (5 days) - **COMPLETED Oct 25, 2025**
- ✅ Epic 1.2: Question Sampler (4 days) - **COMPLETED Oct 25, 2025**
- ✅ Epic 1.3: Favorite/Flag Questions (3 days) - **COMPLETED Oct 25, 2025**

#### **Sprint 2** (Week 3-4): Enhanced UX
- ✅ Epic 2.2: Audio STT (5 days)
- ✅ Epic 2.1: Swipe Gestures (3 days)
- ✅ Epic 2.4: Session Summary (3 days)

#### **Sprint 3** (Week 5): Polish
- ✅ Epic 2.3: Timer Presets (2 days)
- ✅ Epic 3.1: Progress Analytics (4 days)

**Total Estimated Time**: 5-6 weeks (1 developer)

---

### 📈 Success Metrics (Post-Implementation)

After completing the backlog, track these metrics to validate success:

- **User Engagement**: ≥20% of sign-ups complete 1+ practice sessions
- **Session Quality**: Average 10-15 questions per session (vs current 100+)
- **Audio Adoption**: ≥30% of answers use voice recording
- **Favoriting**: ≥40% of users favorite at least 5 questions
- **Performance**: Research completion time ≤ 90 seconds (P95)
- **STT Latency**: Transcription time ≤ 6 seconds (P95)

---

### 🛠️ Contributing to the Backlog

**Before Starting Work**:
1. Check this backlog for assigned epics
2. Read the full PRD in `docs/PRODUCT_DESIGN.md`
3. Review technical design in `docs/TECHNICAL_DESIGN.md`
4. Create a feature branch: `git checkout -b feature/epic-X.Y-description`

**During Development**:
1. Update task checkboxes as you complete them
2. Document any deviations from the plan
3. Write tests for new functionality
4. Update relevant documentation

**After Completion**:
1. Mark epic as ✅ complete with date
2. Update this README with new features
3. Update `docs/IMPLEMENTATION_CHANGES.md`
4. Submit PR for review

---

## 🎨 Design System

The app uses a custom design system based on fresh green colors:
- **Primary:** #28A745 (Fresh Green)
- **Accent:** #1B5E20 (Deep Green)  
- **Backgrounds:** #FFFFFF, #F8F9FA
- **Typography:** System default sans-serif fonts

All components follow accessibility guidelines and responsive design principles.


## 🔧 Troubleshooting

### Common Issues

**Authentication Errors**
- Check Supabase URL configuration in auth settings
- Verify redirect URLs include your domain
- Ensure email verification is disabled for testing

**AI Research Failures**
- Verify OpenAI API key is set in Supabase secrets
- Check Edge Function logs for detailed errors
- Ensure sufficient OpenAI credits

**Performance Issues**
- Check network connection for AI API calls
- Clear browser cache and localStorage
- Verify Supabase service status

### Getting Help

- **Documentation:** Check the technical design document
- **Logs:** Use browser dev tools and Supabase dashboard
- **Community:** Join the project discussions

## 📈 Roadmap

### Phase 2 Features (Planned)
- **AI Interview Coach:** Real-time feedback on practice answers
- **Advanced Recording:** Audio/video practice with analysis
- **Community Features:** Anonymous sharing of interview experiences
- **Enhanced Analytics:** Personal progress tracking and insights

### Phase 3 Vision
- **Mobile Apps:** Native iOS and Android applications
- **Enterprise Features:** Team-based preparation workflows
- **Integration APIs:** Connect with job boards and ATS systems
- **Advanced AI:** Multi-modal research and preparation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for providing powerful AI research capabilities
- **Supabase** for the robust backend infrastructure  
- **shadcn/ui** for beautiful, accessible components
- **Lovable** for the development and hosting platform

---

**Built with ❤️ for better interview preparation**

*Ready to ace your next interview? Start your research now!*

## 🚀 Development Approaches

You have **two ways** to develop this app:

### 🌟 **Option 1: Remote-Only Development (Recommended)**
- ✅ Frontend → Remote Supabase (already configured)
- ✅ Functions → Deploy to Remote Supabase Edge Functions  
- ✅ Database → Remote Supabase Database
- ❌ **No `.env.local` needed**
- ❌ **No `supabase start` needed**

### ⚙️ **Option 2: Local Development** 
- ✅ Frontend → Remote Supabase
- ✅ Functions → Run locally for testing
- ✅ Database → Local Supabase
- ⚠️ **Requires `.env.local` for local function testing**

---

## 🌟 **Remote-Only Setup (Recommended)**

### 1. **Configure Environment Variables in Supabase Dashboard**
   ```
   Go to: Supabase Dashboard → Project Settings → Edge Functions → Environment Variables
   
   Add these secrets:
   OPENAI_API_KEY=your-openai-api-key
   TAVILY_API_KEY=your-tavily-api-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

### 2. **Deploy Functions to Remote**
   ```bash
   # Deploy all functions to remote Supabase
   npm run functions:deploy
   
   # Or deploy a single function
   supabase functions deploy company-research
   ```

### 3. **Start Frontend Development**
   ```bash
   # Only need to run this - connects to remote everything
   npm run dev
   ```

### 4. **Push Database Changes**
   ```bash
   # Push schema changes to remote database  
   npm run db:push
   ```

**✅ Benefits:**
- No local setup complexity
- Real production environment
- No `.env.local` needed
- Faster development cycle

---

## ⚙️ **Local Development Setup**

Only use this if you need to test function changes locally before deploying.

### 1. **Create .env.local (Required for local functions)**
   ```bash
   # Create .env.local in project root
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   OPENAI_API_KEY=your-openai-api-key
   TAVILY_API_KEY=your-tavily-api-key
   ```

### 2. **Start Local Services**
   ```bash
   # Start frontend
   npm run dev
   
   # Start local Supabase (optional)
   npm run supabase:start
   
   # Start functions locally with environment loading
   npm run functions:serve
   ```

**⚠️ Only needed when:**
- Testing function changes before deployment
- Debugging function logic locally
- Working offline

---
