# Development Guide: Hireo - Interview Prep Tool

This guide provides practical patterns, conventions, and workflows for developing and maintaining the Hireo application.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Coding Patterns](#coding-patterns)
3. [Component Development](#component-development)
4. [State Management Patterns](#state-management-patterns)
5. [API Integration](#api-integration)
6. [Error Handling](#error-handling)
7. [Testing Patterns](#testing-patterns)
8. [Debugging Guide](#debugging-guide)
9. [Common Tasks](#common-tasks)
10. [Performance Tips](#performance-tips)

## Getting Started

### Local Development Setup

```bash
# Clone and install dependencies
git clone <repository-url>
cd intel-prep-ace
npm install

# Start development server
npm run dev

# Access the application
open http://localhost:5173
```

### Environment Variables
```bash
# .env.local (create this file)
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# For Supabase functions (same .env.local file)
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
OPENAI_API_KEY=your-openai-api-key
TAVILY_API_KEY=your-tavily-api-key
```

### Useful Development Commands
```bash
# Frontend development
npm run dev                    # Start Vite dev server
npm run lint                   # ESLint check
npm run build                  # Test production build

# Supabase development
npm run supabase:start         # Start local Supabase
npm run supabase:stop          # Stop local Supabase
npm run supabase:status        # Check Supabase status

# Supabase functions (IMPORTANT: Use these for proper env loading)
npm run functions:serve        # Serve functions with .env.local
npm run functions:serve-debug  # Serve functions with debug output

# Legacy commands (avoid - missing env vars)
npx supabase functions serve  # ❌ Missing environment variables
npx supabase start            # ✅ OK for database only

# Database schema
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### 🚨 Common Issue: Missing API Keys in Functions

**Problem**: Your functions return fallback content like "Research in progress" instead of real AI research.

**Cause**: Environment variables from `.env.local` are not loaded when using `supabase functions serve` directly.

**Solution**: Always use the npm scripts that include the `--env-file` flag:
```bash
# ✅ Correct way (loads .env.local)
npm run functions:serve

# ❌ Wrong way (missing env vars)
supabase functions serve
```

**How to verify**: Check function logs for these messages:
- ✅ "CONFIG_SUCCESS: API_KEY_FOUND" 
- ❌ "🚨 TAVILY_API_KEY missing!"

### Function Logging

Functions now create comprehensive logs in two places:

1. **Database Logging**: Check these tables in Supabase dashboard:
   - `tavily_searches` - All Tavily API calls
   - `openai_calls` - All OpenAI API calls  
   - `function_executions` - Complete function runs

2. **File Logging**: Check `supabase/functions/*/logs/` directories:
   - Detailed execution logs with timestamps
   - Phase-by-phase progress tracking
   - Error diagnostics and API response data

## Coding Patterns

### File Naming Conventions
```
components/          # PascalCase for React components
├── AuthProvider.tsx
├── Navigation.tsx
└── ui/
    ├── button.tsx   # lowercase for shadcn/ui components
    └── card.tsx

pages/              # PascalCase for route components
├── Home.tsx
├── Dashboard.tsx
└── Practice.tsx

hooks/              # camelCase starting with 'use'
├── useAuth.ts
└── use-toast.ts

services/           # camelCase
└── searchService.ts

utils/              # camelCase
└── formatters.ts
```

### Import Order Convention
```typescript
// 1. React and core libraries
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// 2. UI components (shadcn/ui)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 3. Custom components
import Navigation from "@/components/Navigation";
import { useAuthContext } from "@/components/AuthProvider";

// 4. Hooks and utilities
import { useAuth } from "@/hooks/useAuth";
import { searchService } from "@/services/searchService";

// 5. Icons (always last)
import { Search, AlertCircle, Loader2 } from "lucide-react";
```

### TypeScript Patterns

#### Interface Definitions
```typescript
// Use interfaces for component props
interface SearchFormProps {
  onSubmit: (data: SearchFormData) => void;
  isLoading?: boolean;
  initialData?: Partial<SearchFormData>;
}

// Use types for data structures
type SearchStatus = "pending" | "processing" | "completed" | "failed";

type SearchFormData = {
  company: string;
  role?: string;
  country?: string;
  roleLinks?: string;
  cv?: string;
};
```

#### Generic Service Response Pattern
```typescript
// Consistent API response type
type ServiceResponse<T> = {
  success: boolean;
  data?: T;
  error?: any;
};

// Usage example
async function getSearchResults(searchId: string): Promise<ServiceResponse<SearchResults>> {
  try {
    // ... implementation
    return { success: true, data: results };
  } catch (error) {
    return { success: false, error };
  }
}
```

## Component Development

### Component Structure Template
```typescript
// src/components/ExampleComponent.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ExampleComponentProps {
  title: string;
  onAction: () => void;
  isLoading?: boolean;
}

const ExampleComponent = ({ title, onAction, isLoading = false }: ExampleComponentProps) => {
  const [localState, setLocalState] = useState("");

  const handleAction = () => {
    // Local logic
    onAction();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleAction} disabled={isLoading}>
          {isLoading ? "Loading..." : "Action"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ExampleComponent;
```

### Page Component Template
```typescript
// src/pages/ExamplePage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { useAuthContext } from "@/components/AuthProvider";

const ExamplePage = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Page initialization logic
  }, []);

  if (!user) {
    return <div>Please sign in to access this page.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {/* Page content */}
      </div>
    </div>
  );
};

export default ExamplePage;
```

### Loading State Pattern
```typescript
// Consistent loading UI across the app
const LoadingState = ({ message = "Loading..." }: { message?: string }) => (
  <div className="min-h-screen bg-background">
    <Navigation />
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full max-w-md mx-auto text-center">
        <CardHeader>
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <CardTitle>Loading</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  </div>
);

// Usage in components
if (isLoading) {
  return <LoadingState message="Fetching your data..." />;
}
```

### Error State Pattern
```typescript
// Consistent error UI with retry functionality
const ErrorState = ({ 
  error, 
  onRetry, 
  backToHome = false 
}: { 
  error: string; 
  onRetry?: () => void; 
  backToHome?: boolean; 
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="space-y-2">
              {onRetry && (
                <Button onClick={onRetry} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              {backToHome && (
                <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                  Back to Home
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Usage in components
if (error) {
  return <ErrorState error={error} onRetry={loadData} />;
}
```

## State Management Patterns

### Form State with Validation
```typescript
// Standard form handling pattern
const useFormState = <T extends Record<string, any>>(initialData: T) => {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const updateField = (field: keyof T, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const setFieldError = (field: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const clearErrors = () => setErrors({});

  return {
    formData,
    errors,
    updateField,
    setFieldError,
    clearErrors,
    hasErrors: Object.keys(errors).length > 0
  };
};

// Usage example
const SearchForm = () => {
  const { formData, errors, updateField, setFieldError } = useFormState({
    company: "",
    role: "",
    country: ""
  });

  return (
    <div>
      <Input
        value={formData.company}
        onChange={(e) => updateField('company', e.target.value)}
        placeholder="Company name"
      />
      {errors.company && (
        <p className="text-destructive text-sm mt-1">{errors.company}</p>
      )}
    </div>
  );
};
```

### URL State Management
```typescript
// Reading URL parameters
const useUrlParams = () => {
  const [searchParams] = useSearchParams();
  
  return {
    searchId: searchParams.get('searchId'),
    stageIds: searchParams.get('stages')?.split(',') || [],
    // Add more params as needed
  };
};

// Updating URL parameters
const useUrlNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const updateUrl = (params: Record<string, string | undefined>) => {
    const searchParams = new URLSearchParams(location.search);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        searchParams.set(key, value);
      } else {
        searchParams.delete(key);
      }
    });

    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  };

  return { updateUrl };
};
```

### Polling Pattern
```typescript
// Reusable polling hook
const usePolling = (
  callback: () => Promise<void>,
  delay: number,
  condition: () => boolean
) => {
  useEffect(() => {
    if (!condition()) return;

    const interval = setInterval(callback, delay);
    return () => clearInterval(interval);
  }, [callback, delay, condition]);
};

// Usage for search status polling
const Dashboard = () => {
  const [searchData, setSearchData] = useState(null);
  
  const loadSearchData = useCallback(async () => {
    // Fetch search data
    const result = await searchService.getSearchResults(searchId);
    if (result.success) {
      setSearchData(result.data);
    }
  }, [searchId]);

  // Poll every 3 seconds while search is processing
  usePolling(
    loadSearchData,
    3000,
    () => searchData?.search_status === 'processing'
  );
};
```

## API Integration

### Service Function Pattern
```typescript
// src/services/searchService.ts
export const searchService = {
  async createSearch(params: CreateSearchParams): Promise<ServiceResponse<{ searchId: string }>> {
    try {
      // 1. Always check authentication first
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Authentication required");
      }

      // 2. Validate input parameters
      if (!params.company?.trim()) {
        throw new Error("Company name is required");
      }

      // 3. Make the API call
      const { data, error } = await supabase
        .from("searches")
        .insert({
          user_id: user.id,
          company: params.company,
          role: params.role,
          country: params.country,
          role_links: params.roleLinks,
          search_status: "pending"
        })
        .select()
        .single();

      if (error) throw error;

      // 4. Process response
      return { 
        success: true, 
        data: { searchId: data.id } 
      };

    } catch (error) {
      console.error("Error creating search:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }
};
```

### API Call in Components
```typescript
// Component using service
const CreateSearchForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (formData: SearchFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await searchService.createSearch(formData);
      
      if (result.success && result.data) {
        // Handle success
        navigate(`/dashboard?searchId=${result.data.searchId}`);
      } else {
        // Handle API error
        setError(result.error || "Failed to create search");
      }
    } catch (error) {
      // Handle unexpected errors
      console.error("Unexpected error:", error);
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };
};
```

### Edge Function Development
```typescript
// supabase/functions/example/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  // Define request structure
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Parse request body
    const body = await req.json() as RequestBody;
    
    // 2. Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Process request
    // ... your logic here

    // 4. Return success response
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Function error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
```

## Error Handling

### Global Error Boundary
```typescript
// src/components/ErrorBoundary.tsx
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### Custom Error Types
```typescript
// src/utils/errors.ts
export class AuthenticationError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class ValidationError extends Error {
  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = "ValidationError";
  }
}

export class APIError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "APIError";
  }
}

// Usage in services
if (!user) {
  throw new AuthenticationError();
}

if (!params.company) {
  throw new ValidationError("company", "Company name is required");
}
```

## 6. Error Handling

### 6.1 Comprehensive Error Patterns

#### Multi-State Error Management
```typescript
// Advanced error handling with contextual recovery
const [error, setError] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(false);

// Context-aware error states
const handleError = (error: any, context: string) => {
  console.error(`${context} error:`, error);
  
  // Contextual error messages
  const errorMessages = {
    authentication: "Please sign in to continue",
    network: "Network connection failed. Please check your internet connection.",
    processing: "Processing failed. The system is experiencing issues.",
    validation: "Please check your input and try again",
    notFound: "The requested resource was not found"
  };
  
  setError(errorMessages[context as keyof typeof errorMessages] || "An unexpected error occurred");
};
```

#### Graceful Degradation Pattern
```typescript
// Progressive fallback for failed operations
if (searchData?.search_status === 'failed') {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <CardTitle>Processing Failed</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Button onClick={retryFunction} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => navigate('/')} className="w-full">
            Start New Search
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### State-Specific Error Recovery
```typescript
// Different recovery options based on error context
const getErrorActions = (errorContext: string) => {
  switch (errorContext) {
    case 'authentication':
      return [
        { label: 'Sign In', action: () => navigate('/auth') }
      ];
    case 'search_processing':
      return [
        { label: 'View Progress', action: () => navigate(`/dashboard?searchId=${searchId}`) },
        { label: 'Start New Search', action: () => navigate('/') }
      ];
    case 'practice_session':
      return [
        { label: 'Back to Dashboard', action: () => navigate(`/dashboard?searchId=${searchId}`) },
        { label: 'Select Different Stages', action: () => setShowStageSelector(true) }
      ];
    default:
      return [
        { label: 'Retry', action: retryFunction }
      ];
  }
};
```

### 6.2 Advanced Loading States

#### Context-Aware Loading Patterns
```typescript
// Different loading states for different contexts
const getLoadingState = (context: string) => {
  const loadingStates = {
    search_creation: "Starting your interview research...",
    search_processing: "Analyzing company data and generating guidance...",
    cv_analysis: "Parsing your CV with AI...",
    practice_setup: "Setting up your personalized practice session...",
    answer_saving: "Saving your practice answer..."
  };
  
  return loadingStates[context as keyof typeof loadingStates] || "Loading...";
};
```

## 7. Advanced Workflows

### 7.1 CV Analysis Workflow

#### AI-Powered CV Processing
```typescript
// Complete CV analysis workflow
const analyzeCV = async (cvText: string) => {
  setIsAnalyzing(true);
  setError(null);
  
  try {
    // Call AI analysis edge function
    const result = await searchService.analyzeCV(cvText);
    
    if (result.success) {
      setParsedData(result.parsedData);
      
      // Save to database
      const saveResult = await searchService.saveResume({
        content: cvText,
        parsedData: result.parsedData
      });
      
      if (saveResult.success) {
        setSuccess("CV analyzed and saved successfully!");
      }
    } else {
      setError("Failed to analyze CV. Please try again.");
    }
  } catch (err) {
    setError("An unexpected error occurred during CV analysis");
  } finally {
    setIsAnalyzing(false);
  }
};
```

#### Intelligent Data Display
```typescript
// Progressive disclosure of parsed CV data
const renderParsedSection = (title: string, data: any, icon: React.ReactNode) => {
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Dynamic rendering based on data type */}
        {Array.isArray(data) ? (
          <div className="flex flex-wrap gap-2">
            {data.map((item, index) => (
              <Badge key={index} variant="secondary">{item}</Badge>
            ))}
          </div>
        ) : (
          <p>{data}</p>
        )}
      </CardContent>
    </Card>
  );
};
```

### 7.2 Practice Session Workflow

#### Dynamic Session Management
```typescript
// Complete practice session setup and management
const setupPracticeSession = async () => {
  setIsLoading(true);
  
  try {
    // Load search results and stages
    const result = await searchService.getSearchResults(searchId);
    
    if (result.success) {
      // Filter selected stages
      const selectedStages = result.stages.filter(stage => 
        urlStageIds.includes(stage.id)
      );
      
      // Aggregate and shuffle questions
      const allQuestions = selectedStages.flatMap(stage =>
        stage.questions.map(q => ({
          ...q,
          stage_id: stage.id,
          stage_name: stage.name,
          answered: false
        }))
      );
      
      const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5);
      setQuestions(shuffledQuestions);
      
      // Create practice session
      const sessionResult = await searchService.createPracticeSession(searchId);
      if (sessionResult.success) {
        setPracticeSession(sessionResult.session);
        setIsTimerRunning(true); // Start timer
      }
    }
  } catch (err) {
    handleError(err, 'practice_session');
  } finally {
    setIsLoading(false);
  }
};
```

#### Real-time Answer Tracking
```typescript
// Advanced answer persistence with state synchronization
const handleAnswerSave = async () => {
  if (!answer.trim() || !practiceSession) return;
  
  const questionId = currentQuestion.id;
  
  try {
    // Save answer with timing data
    const result = await searchService.savePracticeAnswer({
      sessionId: practiceSession.id,
      questionId,
      textAnswer: answer.trim(),
      answerTime: timeElapsed
    });
    
    if (result.success) {
      // Immediate UI feedback
      setQuestions(prev => prev.map(q => 
        q.id === questionId ? { ...q, answered: true } : q
      ));
      
      // Track saved answers for progress display
      setSavedAnswers(prev => new Map(prev).set(questionId, true));
      
      // Clear current answer and provide feedback
      setAnswer("");
      toast({
        title: "Answer Saved",
        description: "Your practice answer has been recorded.",
        duration: 2000,
      });
    }
  } catch (err) {
    handleError(err, 'answer_saving');
  }
};
```

## 8. Testing Patterns

### 8.1 Error Scenario Testing

#### Comprehensive Error Testing Checklist
```typescript
// Test different error scenarios
const errorTestScenarios = [
  {
    name: "Authentication Failure",
    setup: () => mockAuthFailure(),
    expectedBehavior: "Redirect to auth with error message"
  },
  {
    name: "Network Timeout",
    setup: () => mockNetworkTimeout(),
    expectedBehavior: "Show retry option with connection error"
  },
  {
    name: "Processing Failure",
    setup: () => mockProcessingFailure(),
    expectedBehavior: "Show processing failed state with new search option"
  },
  {
    name: "Invalid Search ID",
    setup: () => navigateToInvalidSearch(),
    expectedBehavior: "Show not found state with navigation options"
  }
];
```

### 8.2 Real-time Feature Testing

#### Polling and State Management Testing
```typescript
// Test polling behavior and cleanup
const testPollingScenario = async () => {
  // Start with pending search
  mockSearchStatus('pending');
  
  // Verify polling starts
  expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 3000);
  
  // Change status to completed
  mockSearchStatus('completed');
  
  // Verify polling stops
  expect(clearInterval).toHaveBeenCalled();
};
```

## Debugging Guide

### Common Issues and Solutions

#### Authentication Problems
```typescript
// Debug authentication state
console.log("Auth Debug:", {
  user: user?.id,
  session: !!session,
  loading,
  email: user?.email
});

// Check RLS policies in Supabase dashboard
// Authentication > Policies
```

#### Database Query Issues
```typescript
// Debug Supabase queries
const { data, error } = await supabase
  .from("searches")
  .select("*")
  .eq("user_id", user.id);

console.log("Query result:", { data, error });

// Check SQL logs in Supabase dashboard
// Logs > SQL
```

#### State Management Issues
```typescript
// Debug React state
useEffect(() => {
  console.log("State changed:", {
    isLoading,
    error,
    searchData,
    questions: questions.length
  });
}, [isLoading, error, searchData, questions]);
```

#### API Integration Issues
```typescript
// Debug API calls
const result = await searchService.createSearch(params);
console.log("API call result:", {
  success: result.success,
  error: result.error,
  data: result.data
});

// Check Edge Function logs in Supabase dashboard
// Edge Functions > [function-name] > Logs
```

### Browser Developer Tools

#### React Developer Tools
- Install React DevTools browser extension
- Use Components tab to inspect React component tree
- Use Profiler tab to identify performance issues

#### Network Tab Debugging
```typescript
// Look for these patterns in Network tab:
// 1. Failed authentication: 401 responses
// 2. RLS policy violations: 403 responses
// 3. Malformed requests: 400 responses
// 4. Server errors: 500 responses
```

## Common Tasks

### Adding a New Page
1. Create page component in `src/pages/`
2. Add route to `src/App.tsx`
3. Add navigation link in `src/components/Navigation.tsx`
4. Update URL state management if needed

### Adding a New API Endpoint
1. Create Edge Function in `supabase/functions/`
2. Add service method in `src/services/`
3. Add TypeScript types for request/response
4. Test with error handling

### Adding a New UI Component
1. Create component in `src/components/`
2. Follow naming conventions
3. Add proper TypeScript interfaces
4. Include loading and error states

### Database Schema Changes
1. Create migration in `supabase/migrations/`
2. Update TypeScript types: `npx supabase gen types typescript`
3. Update service methods
4. Test RLS policies

### Configuration Management

The interview research system uses a centralized configuration file for easy customization.

### Configuration File Structure

**Main Config**: `supabase/functions/_shared/config.ts`

Key configurable parameters:
- **OpenAI Model**: Choose between `gpt-4o`, `gpt-4o-mini` for cost optimization
- **Tavily Search Limits**: Adjust number of searches and extractions 
- **Content Length Limits**: Control how much content to process
- **Allowed Domains**: Specify which sites to search
- **Company Tickers**: Map company names to stock symbols for Blind searches
- **Performance Timeouts**: Set API call timeout limits

### Quick Configuration Examples

**Cost Optimization** (reduce API costs):
```typescript
// In config.ts, modify these values:
RESEARCH_CONFIG.tavily.maxResults.discovery = 5;        // Reduced from 10
RESEARCH_CONFIG.tavily.maxResults.extraction = 8;       // Reduced from 15  
RESEARCH_CONFIG.openai.model = 'gpt-4o-mini';          // Cheaper model
```

**Premium Quality** (maximum research depth):
```typescript
RESEARCH_CONFIG.tavily.maxResults.discovery = 15;       // Increased from 10
RESEARCH_CONFIG.tavily.maxResults.extraction = 20;      // Increased from 15
RESEARCH_CONFIG.content.maxContentLength.deepExtract = 8000; // More content
```

**Add New Companies**:
```typescript
RESEARCH_CONFIG.search.companyTickers['my-company'] = 'MYCO';
```

**Add New Domains**:
```typescript
RESEARCH_CONFIG.search.allowedDomains.push('my-site.com');
```

See `supabase/functions/_shared/config.example.ts` for complete examples.

## Enhanced Logging Infrastructure
The application now includes comprehensive logging for real candidate experience research and debugging.

#### New Logging System Architecture
```typescript
import { SearchLogger } from '../_shared/logger.ts';

// Initialize logger with search context
const logger = new SearchLogger(searchId, 'function-name', userId);

// Log different types of operations
logger.log('OPERATION_TYPE', 'PHASE', data, error?, duration?);
logger.logTavilySearch(query, phase, requestPayload, response, error, duration);
logger.logTavilyExtract(urls, phase, response, error, duration);
logger.logOpenAI(operation, phase, request, response, error, duration);

// Log phase transitions
logger.logPhaseTransition('DISCOVERY', 'EXTRACTION', data);

// Log data processing
logger.logDataProcessing('CONTEXT_BUILDING', inputData, outputData, error);

// End function execution
logger.logFunctionEnd(success, result, error);

// Save detailed logs to file
await logger.saveToFile();
```

#### Enhanced Company Research Process
The interview research pipeline now follows a **Retrieve-then-Extract** pattern:

1. **Phase 1: Discovery Searches**
   - Target-specific queries for Glassdoor interview pages (`site:glassdoor.com/Interview`)
   - Company ticker symbol searches for Blind (`AMZN interview`, `GOOGL interview`)
   - 1point3acres searches for international candidates (`interview 面试`)
   - Role-specific searches with recent time filters (`2024 2025`)

2. **Phase 2: Deep Content Extraction**
   - URLs extracted from discovery phase
   - Tavily `/extract` API for full page content (4-6k characters vs previous 200 char snippets)
   - Focus on interview review sites (Glassdoor, Blind, 1point3acres, Reddit)

3. **Phase 3: AI Analysis with Real Data**
   - Raw content processing with `include_raw_content: true`
   - Interview stages extracted from actual candidate reports
   - JSON mode for reliable parsing (`response_format: { type: "json_object" }`)

#### Debugging with Log Files
All search executions now save detailed logs to `supabase/functions/logs/`:

```bash
# Check recent logs
ls -la supabase/functions/logs/

# View detailed execution log
cat supabase/functions/logs/company-research_<searchId>_<timestamp>.json

# View quick summary
cat supabase/functions/logs/company-research_<searchId>_summary.json
```

#### Log File Structure
```typescript
// Detailed log file contains:
{
  "searchId": "uuid",
  "functionName": "company-research", 
  "startTime": "2024-01-01T00:00:00Z",
  "endTime": "2024-01-01T00:05:23Z",
  "totalDuration": 323000,
  "summary": {
    "totalLogs": 45,
    "errors": 0,
    "tavilySearches": 12,
    "tavilyExtracts": 1,
    "openaiCalls": 1,
    "completedSuccessfully": true
  },
  "logs": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "operation": "TAVILY_SEARCH",
      "phase": "DISCOVERY",
      "input": { "query": "Amazon software engineer interview site:glassdoor.com" },
      "output": { "resultsCount": 8, "extractedUrls": [...] },
      "duration": 2500
    }
    // ... all execution steps
  ]
}
```

#### Troubleshooting Fast Responses
If searches complete too quickly without real data:

1. **Check Tavily API Key**: Look for `CONFIG_ERROR:API_KEY_MISSING` in logs
2. **Verify Search Execution**: Check for `TAVILY_SEARCH:DISCOVERY_SUCCESS` entries
3. **Confirm URL Extraction**: Look for `URL_EXTRACTION` with `totalUrls > 0`
4. **Validate Deep Extraction**: Verify `TAVILY_EXTRACT:EXTRACTION_SUCCESS` with content

#### Cost Monitoring with Enhanced Logging
```sql
-- Enhanced Tavily usage tracking
SELECT 
  DATE(created_at) as date,
  api_type,
  SUM(credits_used) as total_credits,
  COUNT(*) as total_calls,
  AVG(results_count) as avg_results
FROM tavily_searches 
GROUP BY DATE(created_at), api_type
ORDER BY date DESC;

-- Function execution performance
SELECT 
  function_name,
  AVG(execution_time_ms) as avg_duration,
  COUNT(*) as executions,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_rate
FROM function_executions 
GROUP BY function_name;
```

## Performance Tips

### Function Timeout Prevention
The app now includes comprehensive timeout handling to prevent Supabase Edge Function 504 errors.

#### Timeout Configuration
```typescript
// supabase/functions/_shared/config.ts - Performance configuration
RESEARCH_CONFIG.performance = {
  timeouts: {
    tavilySearch: 30000,    // 30 seconds per search
    tavilyExtract: 45000,   // 45 seconds for extraction
    openaiCall: 60000,      // 60 seconds for AI analysis
  },
  
  retries: {
    maxRetries: 2,          // Maximum retry attempts
    retryDelay: 1000,       // Delay between retries
  },
  
  concurrency: {
    maxParallelSearches: 12, // Maximum concurrent searches
    maxParallelExtracts: 8,  // Maximum concurrent extractions
  }
};
```

#### Microservice Timeout Handling
```typescript
// interview-research/index.ts - Timeout prevention patterns
async function gatherCompanyData(company: string, role?: string, country?: string, searchId?: string) {
  try {
    // Set timeout for company research (60 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/company-research`, {
      method: 'POST',
      headers: { /* headers */ },
      body: JSON.stringify({ company, role, country, searchId }),
      signal: controller.signal // Abort on timeout
    });

    clearTimeout(timeoutId);
    
    if (response.ok) {
      return await response.json();
    }
    
    console.warn("Company research failed, continuing without data");
    return null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn("Company research timed out after 60 seconds, continuing without data");
    }
    return null; // Graceful degradation
  }
}
```

#### Optimized Processing Flow
```typescript
// Restructured for parallel processing and timeout prevention
async function optimizedDataGathering() {
  // Step 1: Start company research immediately (most time-consuming)
  const companyDataPromise = gatherCompanyData(company, role, country, searchId);
  
  // Step 2: Run faster operations in parallel
  const [jobRequirements, cvAnalysis] = await Promise.all([
    gatherJobData(roleLinks || [], searchId, company, role), 
    gatherCVData(cv || "", userId)
  ]);
  
  // Step 3: Wait for company research to complete or timeout
  const companyInsights = await companyDataPromise;
  
  // Step 4: Run enhanced analysis in parallel (optional optimizations)
  const [cvJobComparison, enhancedQuestions] = await Promise.all([
    generateCVJobComparison(searchId, userId, cvAnalysis, jobRequirements, companyInsights),
    generateEnhancedQuestions(searchId, userId, companyInsights, jobRequirements, cvAnalysis, synthesisResult.interview_stages)
  ]);
}
```

#### API Optimization Settings
```typescript
// Reduced API load for faster processing
RESEARCH_CONFIG.tavily = {
  searchDepth: 'basic',        // Changed from 'advanced' for speed
  maxResults: {
    discovery: 12,             // Reduced from 20 to 12
    extraction: 15,            // Reduced from 30 to 15
  },
  maxCreditsPerSearch: 30,     // Reduced credit usage
};

// Streamlined search queries (removed redundant queries)
queryTemplates: {
  glassdoor: [
    '{company} {role} Interview Questions & Answers site:glassdoor.com/Interview',
    '{company} interview process {role} 2024 2025 site:glassdoor.com',
  ],
  blind: [
    '{ticker} interview {role} site:blind.teamblind.com',
    'interview {ticker} {role} experience site:blind.teamblind.com',
  ],
  // Reduced from 12+ queries to 6 for faster execution
}
```

#### Progress Dialog Optimization
```typescript
// More realistic progress tracking that prevents stuck-at-90% issues
useEffect(() => {
  if (searchStatus === 'pending' || searchStatus === 'processing') {
    interval = setInterval(() => {
      setProgressValue(prev => {
        // More aggressive progress for better UX
        if (prev >= 95) return Math.min(95, prev + 0.5); // Slow increment near completion
        if (prev >= 80) return prev + Math.random() * 2 + 1; // 80-95%
        return prev + Math.random() * 4 + 3; // Faster increment 0-80%
      });
    }, 1500); // Faster updates (1.5s vs 2s)
  } else if (searchStatus === 'completed') {
    setProgressValue(100); // Immediate completion
  }
}, [searchStatus]);
```

#### Client-Side Timeout Detection
```typescript
// Enhanced polling with timeout detection and user feedback
const startStatusPolling = (searchId: string) => {
  let pollCount = 0;
  let hasShownTimeoutWarning = false;
  
  const poll = async () => {
    // Show timeout warning after 2.5 minutes
    if (pollCount > 75 && !hasShownTimeoutWarning) {
      hasShownTimeoutWarning = true;
      toast({
        title: "Research Taking Longer",
        description: "The research is taking longer than expected. You can close this dialog and check back later.",
        duration: 8000,
      });
    }
    
    // Auto-timeout detection after 8 minutes
    if (pollCount > 160) {
      setSearchStatus('failed');
      toast({
        title: "Research Timeout",
        description: "The research process has timed out. Please try again with a smaller scope.",
        variant: "destructive",
      });
      return false;
    }
  };
};
```

### React Performance
```typescript
// Use React.memo for expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{/* Complex rendering */}</div>;
});

// Use useCallback for event handlers
const handleClick = useCallback(() => {
  // Handler logic
}, [dependency]);

// Use useMemo for expensive calculations
const expensiveValue = useMemo(() => {
  return calculateExpensiveValue(data);
}, [data]);
```

### Database Performance
```sql
-- Add indexes for common queries
CREATE INDEX idx_searches_user_status ON searches(user_id, search_status);
CREATE INDEX idx_practice_answers_session_created ON practice_answers(session_id, created_at);
```

### Bundle Size Optimization
```typescript
// Import only what you need from large libraries
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
// Instead of: import { formatDistanceToNow } from "date-fns";

// Use dynamic imports for large components
const HeavyComponent = lazy(() => import("./HeavyComponent"));
```

### API Performance
```typescript
// Batch database operations
const batchInsert = async (records: any[]) => {
  const { data, error } = await supabase
    .from("table")
    .insert(records); // Insert multiple records at once
  
  return { data, error };
};

// Use select to limit returned data
const { data } = await supabase
  .from("searches")
  .select("id, company, created_at") // Only select needed fields
  .eq("user_id", userId);
```

---

This development guide should be your go-to reference for daily development tasks. Update it as new patterns emerge or when adding new features. 

### Quick Test: Verify Tavily Integration

After setting up your environment, test that Tavily is working:

1. **Start Functions Properly**:
   ```bash
   npm run functions:serve
   ```

2. **Check Console Output**: Look for these logs when starting:
   ```
   ✅ Functions serve started at http://localhost:54321/functions/v1/
   📡 Environment file loaded: .env.local
   ```

3. **Run a Test Search**: Create a search in the app and watch function logs for:
   ```
   ✅ CONFIG_SUCCESS: API_KEY_FOUND
   🔍 TAVILY_SEARCH_START: Starting company research
   📊 DISCOVERY_COMPLETE: Found X results
   ```

4. **Verify Database Logging**: Check Supabase dashboard tables:
   - `tavily_searches`: Should have new entries with actual API responses
   - `function_executions`: Should show successful completions
   - `searches`: Should have status "completed" instead of "failed"

5. **Check File Logs**: Look for detailed logs in:
   ```bash
   ls -la supabase/functions/*/logs/
   ```

**If you see fallback content**: You'll see logs like:
```
❌ 🚨 TAVILY_API_KEY missing!
💡 Solution: Run functions with environment file
```

**Troubleshooting**:
```bash
# Verify environment variables are loaded
npm run functions:serve-debug

# Check if .env.local exists and contains TAVILY_API_KEY
grep TAVILY .env.local

# Restart with clean environment
npm run functions:serve
``` 