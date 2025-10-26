import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Timer,
  CheckCircle,
  SkipForward,
  AlertCircle,
  Loader2,
  Brain,
  Play,
  Settings,
  Save,
  Mic,
  MicOff,
  Square,
  Filter,
  Shuffle,
  Star
} from "lucide-react";
import { searchService } from "@/services/searchService";
import { sessionSampler } from "@/services/sessionSampler";
import { useAuth } from "@/hooks/useAuth";

interface EnhancedQuestion {
  question: string;
  type: string;
  difficulty: string;
  rationale: string;
  suggested_answer_approach: string;
  evaluation_criteria: string[];
  follow_up_questions: string[];
  star_story_fit: boolean;
  company_context: string;
}

interface Question {
  id: string;
  stage_id: string;
  stage_name: string;
  question: string;
  answered: boolean;
  // Enhanced question properties
  type?: string;
  difficulty?: string;
  rationale?: string;
  suggested_answer_approach?: string;
  evaluation_criteria?: string[];
  follow_up_questions?: string[];
  star_story_fit?: boolean;
  company_context?: string;
  category?: string;
}

interface InterviewStage {
  id: string;
  name: string;
  duration: string | null;
  interviewer: string | null;
  content: string | null;
  guidance: string | null;
  order_index: number;
  search_id: string;
  created_at: string;
  questions: {
    id: string;
    question: string;
    created_at: string;
  }[];
  selected: boolean;
}

// Note: EnhancedQuestionBank interface removed - functionality consolidated into interview_questions

interface PracticeSession {
  id: string;
  user_id: string;
  search_id: string;
  started_at: string;
  completed_at?: string;
}

const Practice = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchId = searchParams.get('searchId');
  const urlStageIds = searchParams.get('stages')?.split(',') || [];
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allStages, setAllStages] = useState<InterviewStage[]>([]);
  const [searchData, setSearchData] = useState<{ search_status: string; company?: string; role?: string } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [questionTimers, setQuestionTimers] = useState<Map<string, number>>(new Map());
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState<number>(Date.now());
  const [timerTick, setTimerTick] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [savedAnswers, setSavedAnswers] = useState<Map<string, boolean>>(new Map());
  
  // Question flags (Epic 1.3)
  const [questionFlags, setQuestionFlags] = useState<Record<string, { flag_type: string; id: string }>>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // Enhanced question filtering - applied filters (used during session)
  const [appliedCategories, setAppliedCategories] = useState<string[]>([]);
  const [appliedDifficulties, setAppliedDifficulties] = useState<string[]>([]);
  const [appliedShuffle, setAppliedShuffle] = useState<boolean>(false);
  
  // Temporary filters during setup (not applied until session begins)
  const [tempCategories, setTempCategories] = useState<string[]>([]);
  const [tempDifficulties, setTempDifficulties] = useState<string[]>([]);
  const [tempShuffle, setTempShuffle] = useState<boolean>(false);
  
  // Session sampling
  const [sampleSize, setSampleSize] = useState<number>(10);
  const [useSampling, setUseSampling] = useState<boolean>(false);
  const [tempShowFavoritesOnly, setTempShowFavoritesOnly] = useState(false);
  
  // Session state: 'setup' | 'inProgress' | 'completed'
  const [sessionState, setSessionState] = useState<'setup' | 'inProgress' | 'completed'>('setup');
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const questionCategories = [
    { value: 'all', label: 'All Categories' },
    { value: 'behavioral', label: 'Behavioral' },
    { value: 'technical', label: 'Technical' },
    { value: 'situational', label: 'Situational' },
    { value: 'company_specific', label: 'Company Specific' },
    { value: 'role_specific', label: 'Role Specific' },
    { value: 'experience_based', label: 'Experience Based' },
    { value: 'cultural_fit', label: 'Cultural Fit' }
  ];

  const difficultyLevels = [
    { value: 'all', label: 'All Levels' },
    { value: 'Easy', label: 'Easy' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Hard', label: 'Hard' }
  ];

  // Load search data and set up stages
  useEffect(() => {
    const loadSearchData = async () => {
      if (!searchId) return;

      setIsLoading(true);
      setError(null);

      try {
        const result = await searchService.getSearchResults(searchId);
        
        if (result.success && result.search) {
          setSearchData(result.search);
          
          // Check if search is still processing
          if (result.search.search_status === 'pending' || result.search.search_status === 'processing') {
            setError(null); // Clear any previous errors
            return; // Don't process stages yet, show processing state
          }
          
          if (result.search.search_status === 'failed') {
            setError("Research processing failed. Please try starting a new search.");
            return;
          }
          
          // Only process stages if search is completed
          if (result.search.search_status === 'completed' && result.stages) {
            // Transform stages data and add selection state
            const transformedStages = result.stages
              .sort((a, b) => a.order_index - b.order_index)
              .map(stage => ({
                ...stage,
                selected: urlStageIds.length > 0 ? urlStageIds.includes(stage.id) : true // Default to all selected if no URL stages
              }));
            
            setAllStages(transformedStages);
            
            // Note: Enhanced questions now integrated into regular questions
            
            // Update URL if no stages were specified (select all by default)
            if (urlStageIds.length === 0) {
              const allStageIds = transformedStages.map(stage => stage.id);
              setSearchParams({ searchId, stages: allStageIds.join(',') });
            }
          }
        } else {
          setError(result.error?.message || "Failed to load search data");
        }
      } catch (err) {
        console.error("Error loading search data:", err);
        setError("An unexpected error occurred while loading search data");
      } finally {
        setIsLoading(false);
      }
    };

    loadSearchData();
  }, [searchId]);

  // Load question flags when stages are loaded (separate effect to avoid infinite loop)
  useEffect(() => {
    const loadFlags = async () => {
      const selectedStages = allStages.filter(stage => stage.selected);
      if (selectedStages.length === 0) return;

      const allQuestionIds: string[] = [];
      selectedStages.forEach(stage => {
        stage.questions?.forEach(questionObj => {
          allQuestionIds.push(questionObj.id);
        });
      });

      if (allQuestionIds.length > 0) {
        const flagsResult = await searchService.getQuestionFlags(allQuestionIds);
        if (flagsResult.success && flagsResult.flags) {
          setQuestionFlags(flagsResult.flags);
        }
      }
    };

    if (allStages.length > 0) {
      loadFlags();
    }
  }, [allStages]); // Only reload flags when stages change

  // Load practice session when stages are selected
  useEffect(() => {
    const loadPracticeSession = async () => {
      if (!searchId) return;

      const selectedStages = allStages.filter(stage => stage.selected);
      if (selectedStages.length === 0) {
        setQuestions([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const allQuestions: Question[] = [];
        
        // Load questions from stages (now all enhanced)
        {
          selectedStages.forEach(stage => {
            stage.questions?.forEach(questionObj => {
              allQuestions.push({
                id: questionObj.id,
                stage_id: stage.id,
                stage_name: stage.name,
                question: questionObj.question,
                answered: false,
                type: questionObj.type,
                difficulty: questionObj.difficulty,
                rationale: questionObj.rationale,
                suggested_answer_approach: questionObj.suggested_answer_approach,
                evaluation_criteria: questionObj.evaluation_criteria,
                follow_up_questions: questionObj.follow_up_questions,
                star_story_fit: questionObj.star_story_fit,
                company_context: questionObj.company_context,
                category: questionObj.category
              });
            });
          });
        }

        // Apply filters and sorting
        let filteredQuestions = allQuestions;
        
        // Filter by categories (only if applied filters exist)
        if (appliedCategories.length > 0) {
          filteredQuestions = filteredQuestions.filter(q => 
            q.category && appliedCategories.includes(q.category)
          );
        }
        
        // Filter by difficulty (only if applied filters exist)
        if (appliedDifficulties.length > 0) {
          filteredQuestions = filteredQuestions.filter(q => 
            q.difficulty && appliedDifficulties.includes(q.difficulty)
          );
        }
        
        // Filter by favorites only (Epic 1.3) - uses questionFlags from separate effect
        if (showFavoritesOnly) {
          filteredQuestions = filteredQuestions.filter(q => 
            questionFlags[q.id]?.flag_type === 'favorite'
          );
        }
        
        // Sort questions by stage order for consistent experience
        const sortedQuestions = filteredQuestions.sort((a, b) => {
          const stageA = selectedStages.find(s => s.id === a.stage_id);
          const stageB = selectedStages.find(s => s.id === b.stage_id);
          return (stageA?.order_index || 0) - (stageB?.order_index || 0);
        });
        
        // Shuffle if requested
        let processedQuestions = appliedShuffle 
          ? sortedQuestions.sort(() => Math.random() - 0.5)
          : sortedQuestions;
        
        // Apply sampling if enabled
        if (useSampling && sampleSize > 0) {
          processedQuestions = sessionSampler.sampleQuestions(processedQuestions, sampleSize);
        }
        
        setQuestions(processedQuestions);

        // Create practice session if questions exist
        if (processedQuestions.length > 0) {
          const sessionResult = await searchService.createPracticeSession(searchId);
          
          if (sessionResult.success && sessionResult.session) {
            setPracticeSession(sessionResult.session);
          }
        }
      } catch (err) {
        console.error("Error loading practice session:", err);
        setError("An unexpected error occurred while loading practice questions");
      } finally {
        setIsLoading(false);
      }
    };

    if (allStages.length > 0) {
      loadPracticeSession();
    }
  }, [allStages, appliedCategories, appliedDifficulties, appliedShuffle, searchId, useSampling, sampleSize, showFavoritesOnly]);

  // Reset timer when question changes
  useEffect(() => {
    setCurrentQuestionStartTime(Date.now());
    // Reset recording state when changing questions
    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setHasRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, [currentIndex]);

  // Recording timer
  useEffect(() => {
    if (isRecording && recordingIntervalRef.current === null) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (!isRecording && recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, [isRecording]);

  const handleStageToggle = (stageId: string) => {
    const updatedStages = allStages.map(stage => 
      stage.id === stageId 
        ? { ...stage, selected: !stage.selected }
        : stage
    );
    setAllStages(updatedStages);
    
    // Update URL with new stage selection
    const selectedStageIds = updatedStages.filter(stage => stage.selected).map(stage => stage.id);
    if (selectedStageIds.length > 0) {
      setSearchParams({ searchId: searchId!, stages: selectedStageIds.join(',') });
    }
  };

  const getCurrentQuestionTime = () => {
    return Math.floor((Date.now() - currentQuestionStartTime) / 1000);
  };

  const handleAnswerChange = (value: string) => {
    const newAnswers = new Map(answers);
    newAnswers.set(currentQuestion.id, value);
    setAnswers(newAnswers);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        setHasRecording(true);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playRecording = () => {
    if (audioBlob) {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.play();
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setHasRecording(false);
    setRecordingTime(0);
  };

  const handleBeginSession = () => {
    // Apply temporary filters to active filters
    setAppliedCategories(tempCategories);
    setAppliedDifficulties(tempDifficulties);
    setAppliedShuffle(tempShuffle);
    setShowFavoritesOnly(tempShowFavoritesOnly);
    
    setUseSampling(true);
    setSessionState('inProgress');
    setCurrentIndex(0);
  };

  const handleStartNewSession = () => {
    setSessionState('setup');
    setUseSampling(false);
    setCurrentIndex(0);
    setAnswers(new Map());
    setQuestionTimers(new Map());
    setSavedAnswers(new Map());
    
    // Reset filters
    setAppliedCategories([]);
    setAppliedDifficulties([]);
    setAppliedShuffle(false);
    setShowFavoritesOnly(false);
    setTempCategories([]);
    setTempDifficulties([]);
    setTempShuffle(false);
    setTempShowFavoritesOnly(false);
  };
  
  const toggleCategory = (category: string) => {
    setTempCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };
  
  const toggleDifficulty = (difficulty: string) => {
    setTempDifficulties(prev => 
      prev.includes(difficulty) 
        ? prev.filter(d => d !== difficulty)
        : [...prev, difficulty]
    );
  };

  // Flag handling functions (Epic 1.3)
  const handleToggleFlag = async (questionId: string, flagType: 'favorite' | 'needs_work' | 'skipped') => {
    try {
      const currentFlag = questionFlags[questionId];
      
      // If same flag type, remove it (toggle off)
      if (currentFlag && currentFlag.flag_type === flagType) {
        const result = await searchService.removeQuestionFlag(questionId);
        if (result.success) {
          setQuestionFlags(prev => {
            const newFlags = { ...prev };
            delete newFlags[questionId];
            return newFlags;
          });
        } else {
          console.error('Failed to remove flag:', result.error);
        }
      } else {
        // Set new flag (or update existing one)
        const result = await searchService.setQuestionFlag(questionId, flagType);
        if (result.success && result.flag) {
          setQuestionFlags(prev => ({
            ...prev,
            [questionId]: { flag_type: flagType, id: result.flag.id }
          }));
        } else {
          console.error('Failed to set flag:', result.error);
        }
      }
    } catch (error) {
      console.error('Error toggling flag:', error);
    }
  };

  const handleSaveAnswer = async () => {
    const currentAnswer = answers.get(currentQuestion.id) || "";
    if (!currentAnswer.trim() && !hasRecording || !practiceSession) return;

    setIsSaving(true);
    const questionId = currentQuestion.id;
    const timeSpent = getCurrentQuestionTime();
    
    try {
      // For now, we'll save the text answer and recording status
      // In a full implementation, you'd upload the audio file
      const result = await searchService.savePracticeAnswer({
        sessionId: practiceSession.id,
        questionId: questionId,
        textAnswer: currentAnswer.trim() || (hasRecording ? "[Voice recording provided]" : ""),
        answerTime: timeSpent
      });

      if (result.success) {
        // Mark question as answered
        setQuestions(prev => 
          prev.map(q => 
            q.id === questionId ? { ...q, answered: true } : q
          )
        );
        setSavedAnswers(prev => new Map(prev).set(questionId, true));
        
        // Save question time
        setQuestionTimers(prev => new Map(prev).set(questionId, timeSpent));
        
        // Check if this is the last question
        if (currentIndex >= questions.length - 1) {
          // Mark session as completed
          setSessionState('completed');
        } else {
          // Auto-advance to next question
          setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
          }, 500);
        }
      } else {
        console.error("Failed to save answer:", result.error?.message);
      }
    } catch (err) {
      console.error("Error saving answer:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const previousQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const skipQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const jumpToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
    }
  };

  const resetCurrentQuestionTimer = () => {
    setCurrentQuestionStartTime(Date.now());
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers.get(currentQuestion.id) || "" : "";
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = questions.filter(q => q.answered).length;
  const selectedStagesCount = allStages.filter(stage => stage.selected).length;
  const currentQuestionTime = getCurrentQuestionTime();

  // Update timer display every second
  useEffect(() => {
    const interval = setInterval(() => {
      // Increment timerTick to force re-render and update timer display
      if (currentQuestion) {
        setTimerTick(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentQuestion]);

  // Show default state when no search ID provided
  if (!searchId) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="p-8">
              <CardHeader>
                <div className="flex items-center justify-center mb-4">
                  <Play className="h-12 w-12 text-primary" />
                </div>
                <CardTitle>No Search Selected</CardTitle>
                <CardDescription>
                  Select a search to start practicing interview questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button 
                    onClick={() => navigate('/dashboard')}
                    size="lg"
                    className="w-full"
                  >
                    Go to Dashboard
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/')}
                    className="w-full"
                  >
                    Start New Search
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Only show full-screen loading during initial load, not during setup configuration
  if (isLoading && sessionState !== 'setup') {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-md mx-auto text-center">
            <CardHeader>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <CardTitle>Loading Practice Session</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Setting up your personalized interview practice...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show processing state when research is still being processed
  if (searchData && (searchData.search_status === 'pending' || searchData.search_status === 'processing')) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-md mx-auto text-center">
            <CardHeader>
              <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Research In Progress</CardTitle>
              <CardDescription>
                {searchData.company && `for ${searchData.company}`}
                {searchData.role && ` - ${searchData.role}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Your interview research is still being processed. Practice mode will be available once the research is complete.
                </p>
                <div className="space-y-2">
                  <Button 
                    onClick={() => navigate(`/dashboard?searchId=${searchId}`)}
                    className="w-full"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    View Research Progress
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/')}
                    className="w-full"
                  >
                    Start New Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-md mx-auto text-center">
            <CardHeader>
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
              <CardTitle>Practice Session Error</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Button 
                  onClick={() => navigate(`/dashboard${searchId ? `?searchId=${searchId}` : ''}`)}
                  className="w-full"
                >
                  Back to Dashboard
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="w-full"
                >
                  Start New Search
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If no questions available after filtering, show appropriate message
  if (!currentQuestion && sessionState === 'inProgress') {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-md mx-auto text-center">
            <CardHeader>
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <CardTitle>No Questions Match Your Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                Your current filter settings resulted in no questions. Try adjusting your categories, difficulty levels, or selected stages.
              </p>
              <div className="space-y-2">
                <Button 
                  onClick={handleStartNewSession}
                  className="w-full"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Adjust Filters
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate(`/dashboard${searchId ? `?searchId=${searchId}` : ''}`)}
                  className="w-full"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Session Setup State - Show filters and configuration
  if (sessionState === 'setup') {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard${searchId ? `?searchId=${searchId}` : ''}`)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="text-sm text-muted-foreground">
              {searchData?.company && `${searchData.company}`}
              {searchData?.role && ` - ${searchData.role}`}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Configure Your Practice Session
              </CardTitle>
              <CardDescription>
                Set up your practice preferences before starting the session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Practice Session Sampler */}
              <div className="space-y-4 border-b pb-4">
                <h4 className="text-sm font-medium">Practice Session</h4>
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs text-muted-foreground">Number of Questions</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={sampleSize}
                      onChange={(e) => setSampleSize(sessionSampler.validateSampleSize(parseInt(e.target.value) || 10))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <p className="text-xs text-muted-foreground">
                      Select how many questions you want to practice (1-100)
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Question Filtering */}
              <div className="space-y-4 border-b pb-4">
                <h4 className="text-sm font-medium">Question Filters (Optional)</h4>
                <p className="text-xs text-muted-foreground">
                  Leave unchecked to include all categories and difficulty levels
                </p>
                
                {/* Categories */}
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground">Categories</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {questionCategories.filter(cat => cat.value !== 'all').map(cat => (
                      <div key={cat.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cat-${cat.value}`}
                          checked={tempCategories.includes(cat.value)}
                          onCheckedChange={() => toggleCategory(cat.value)}
                        />
                        <label 
                          htmlFor={`cat-${cat.value}`} 
                          className="text-xs cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {cat.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Difficulty */}
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
                  <div className="flex flex-wrap gap-3">
                    {difficultyLevels.filter(level => level.value !== 'all').map(level => (
                      <div key={level.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`diff-${level.value}`}
                          checked={tempDifficulties.includes(level.value)}
                          onCheckedChange={() => toggleDifficulty(level.value)}
                        />
                        <label 
                          htmlFor={`diff-${level.value}`} 
                          className="text-xs cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {level.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Shuffle */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Order</label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="shuffle"
                      checked={tempShuffle}
                      onCheckedChange={(checked) => setTempShuffle(checked as boolean)}
                    />
                    <label htmlFor="shuffle" className="text-xs cursor-pointer">
                      Shuffle questions randomly
                    </label>
                  </div>
                </div>
                
                {/* Favorites Filter (Epic 1.3) */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Favorites</label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="favorites-only"
                      checked={tempShowFavoritesOnly}
                      onCheckedChange={(checked) => setTempShowFavoritesOnly(checked as boolean)}
                    />
                    <label htmlFor="favorites-only" className="text-xs cursor-pointer flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-500" />
                      Show only favorited questions
                    </label>
                  </div>
                </div>
              </div>
              
              {/* Stage Selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Interview Stages</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allStages.map((stage, index) => {
                    const totalQuestions = stage.questions?.length || 0;
                    
                    return (
                      <div key={stage.id} className="flex items-center space-x-3 p-3 border rounded">
                        <Checkbox
                          checked={stage.selected}
                          onCheckedChange={() => handleStageToggle(stage.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              Stage {index + 1}
                            </Badge>
                            <span className="font-medium text-sm truncate">{stage.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} available
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Begin Session Button */}
              <div className="pt-4 border-t space-y-3">
                {/* Filter Summary */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    • {allStages.filter(s => s.selected).length} stage{allStages.filter(s => s.selected).length !== 1 ? 's' : ''} selected
                  </div>
                  {tempCategories.length > 0 && (
                    <div>
                      • Categories: {tempCategories.map(c => questionCategories.find(cat => cat.value === c)?.label).join(', ')}
                    </div>
                  )}
                  {tempDifficulties.length > 0 && (
                    <div>
                      • Difficulty: {tempDifficulties.join(', ')}
                    </div>
                  )}
                  {tempCategories.length === 0 && tempDifficulties.length === 0 && (
                    <div>• All categories and difficulty levels included</div>
                  )}
                  {tempShuffle && <div>• Questions will be shuffled</div>}
                  {tempShowFavoritesOnly && <div>• <Star className="h-3 w-3 inline text-amber-500" /> Showing favorites only</div>}
                </div>
                
                <Button
                  onClick={handleBeginSession}
                  size="lg"
                  className="w-full"
                  disabled={allStages.filter(s => s.selected).length === 0}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Begin Practice Session ({sampleSize} Questions)
                </Button>
                {allStages.filter(s => s.selected).length === 0 && (
                  <p className="text-xs text-amber-600 text-center mt-2">
                    Please select at least one interview stage to begin
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Session Completed State - Show summary and new session button
  if (sessionState === 'completed') {
    const totalTime = Array.from(questionTimers.values()).reduce((sum, time) => sum + time, 0);
    const avgTime = answeredCount > 0 ? Math.floor(totalTime / answeredCount) : 0;

    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-green-100 p-4">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-2xl">Practice Session Complete!</CardTitle>
              <CardDescription>
                Great job! You've completed your practice session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Session Statistics */}
              <div className="grid grid-cols-3 gap-4 py-6">
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">{answeredCount}</div>
                  <div className="text-xs text-muted-foreground">Questions Answered</div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">{formatTime(totalTime)}</div>
                  <div className="text-xs text-muted-foreground">Total Time</div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">{formatTime(avgTime)}</div>
                  <div className="text-xs text-muted-foreground">Avg. Per Question</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completion</span>
                  <span className="font-medium">{answeredCount}/{questions.length}</span>
                </div>
                <Progress value={(answeredCount / questions.length) * 100} className="h-2" />
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                <Button
                  onClick={handleStartNewSession}
                  size="lg"
                  className="w-full"
                >
                  <Shuffle className="h-4 w-4 mr-2" />
                  Start New Practice Session
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/dashboard?searchId=${searchId}`)}
                  className="w-full"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Active Practice Session - Show questions
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-4 max-w-4xl">
        {/* Compact Header */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard${searchId ? `?searchId=${searchId}` : ''}`)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full text-xs">
                <Timer className="h-3 w-3" />
                <span className="font-mono">{formatTime(currentQuestionTime)}</span>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Question {currentIndex + 1} of {questions.length} • {answeredCount} answered
            </p>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Main Question Card - Mobile Optimized */}
        <div className="max-w-2xl mx-auto">
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs">
                    {currentQuestion.stage_name}
                  </Badge>
                  {currentQuestion.category && (
                    <Badge variant="outline" className="text-xs">
                      {currentQuestion.category.replace('_', ' ').toUpperCase()}
                    </Badge>
                  )}
                  {currentQuestion.difficulty && (
                    <Badge 
                      variant={currentQuestion.difficulty === 'Hard' ? 'destructive' : 
                               currentQuestion.difficulty === 'Medium' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {currentQuestion.difficulty}
                    </Badge>
                  )}
                  {currentQuestion.star_story_fit && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                      STAR Method
                    </Badge>
                  )}
                </div>
                {currentQuestion.answered && (
                  <Badge variant="default" className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Answered
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg sm:text-xl leading-relaxed mb-4">
                {currentQuestion.question}
              </CardTitle>
              
              {/* Favorite Button */}
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleFlag(currentQuestion.id, 'favorite')}
                  className={`h-7 px-2 ${
                    questionFlags[currentQuestion.id]?.flag_type === 'favorite'
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : 'text-muted-foreground hover:text-amber-600'
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${
                    questionFlags[currentQuestion.id]?.flag_type === 'favorite' ? 'fill-current' : ''
                  }`} />
                </Button>
              </div>
              
              {/* Enhanced Question Information */}
              {(currentQuestion.rationale || currentQuestion.company_context) && (
                <div className="space-y-3 text-sm">
                  {currentQuestion.rationale && (
                    <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-200">
                      <h4 className="font-medium text-blue-900 mb-1">Why this question?</h4>
                      <p className="text-blue-800">{currentQuestion.rationale}</p>
                    </div>
                  )}
                  
                  {currentQuestion.company_context && (
                    <div className="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-200">
                      <h4 className="font-medium text-purple-900 mb-1">Company Context</h4>
                      <p className="text-purple-800">{currentQuestion.company_context}</p>
                    </div>
                  )}
                  
                  {currentQuestion.suggested_answer_approach && (
                    <div className="bg-green-50 p-3 rounded-lg border-l-4 border-green-200">
                      <h4 className="font-medium text-green-900 mb-1">Answer Approach</h4>
                      <p className="text-green-800">{currentQuestion.suggested_answer_approach}</p>
                    </div>
                  )}
                  
                  {currentQuestion.evaluation_criteria && currentQuestion.evaluation_criteria.length > 0 && (
                    <div className="bg-amber-50 p-3 rounded-lg border-l-4 border-amber-200">
                      <h4 className="font-medium text-amber-900 mb-1">What interviewers look for:</h4>
                      <ul className="text-amber-800 space-y-1">
                        {currentQuestion.evaluation_criteria.map((criterion, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-amber-600 mt-1">•</span>
                            {criterion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {currentQuestion.follow_up_questions && currentQuestion.follow_up_questions.length > 0 && (
                    <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-1">Potential follow-up questions:</h4>
                      <ul className="text-gray-800 space-y-1">
                        {currentQuestion.follow_up_questions.map((followUp, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-gray-600 mt-1">•</span>
                            {followUp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Voice Recording Section - PRIORITIZED */}
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">Voice Answer (Recommended)</h3>
                  {isRecording && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      Recording: {formatTime(recordingTime)}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  {!isRecording && !hasRecording && (
                    <Button 
                      onClick={startRecording}
                      className="flex-1 bg-primary hover:bg-primary/90 h-12"
                    >
                      <Mic className="h-4 w-4 mr-2" />
                      Start Recording
                    </Button>
                  )}
                  
                  {isRecording && (
                    <Button 
                      onClick={stopRecording}
                      variant="destructive"
                      className="flex-1 h-12"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop Recording
                    </Button>
                  )}
                  
                  {hasRecording && !isRecording && (
                    <>
                      <Button 
                        onClick={playRecording}
                        variant="outline"
                        className="flex-1 h-12"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Play ({formatTime(recordingTime)})
                      </Button>
                      <Button 
                        onClick={clearRecording}
                        variant="outline"
                        size="sm"
                        className="h-12 px-3"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button 
                        onClick={startRecording}
                        variant="outline"
                        size="sm"
                        className="h-12 px-3"
                      >
                        <MicOff className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Notes Section - Smaller */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Notes (Optional)</label>
                <Textarea
                  value={currentAnswer}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  placeholder="Add any notes or key points here..."
                  className="min-h-[80px] resize-none text-sm"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={resetCurrentQuestionTimer}
                    className="h-8 px-2"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset Timer
                  </Button>
                  <span>Timer resets when you navigate</span>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={skipQuestion}
                    disabled={currentIndex >= questions.length - 1}
                    className="flex-1 h-11"
                  >
                    <SkipForward className="h-4 w-4 mr-2" />
                    Skip Question
                  </Button>
                  <Button
                    onClick={handleSaveAnswer}
                    disabled={(!currentAnswer.trim() && !hasRecording) || isSaving}
                    className="flex-1 h-11 bg-primary hover:bg-primary/90"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {currentIndex >= questions.length - 1 ? 'Save Answer' : 'Save & Continue'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation - Fixed at bottom on mobile */}
        <div className="flex items-center justify-between max-w-2xl mx-auto mt-6 sticky bottom-4 bg-background/95 backdrop-blur-sm rounded-full border p-2 shadow-lg">
          <Button
            variant="outline"
            onClick={previousQuestion}
            disabled={currentIndex === 0}
            className="rounded-full w-10 h-10 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* Question Indicators - Scrollable */}
          <div className="flex items-center gap-1 px-2 overflow-x-auto max-w-xs scrollbar-hide">
            {questions.map((question, index) => (
              <button
                key={question.id}
                onClick={() => jumpToQuestion(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 flex-shrink-0 ${
                  index === currentIndex 
                    ? 'bg-primary scale-150' 
                    : question.answered 
                      ? 'bg-green-500 hover:scale-125' 
                      : 'bg-muted hover:bg-muted-foreground/50 hover:scale-125'
                }`}
                aria-label={`Go to question ${index + 1}${question.answered ? ' (answered)' : ''}`}
              />
            ))}
          </div>
          
          <Button
            onClick={nextQuestion}
            disabled={currentIndex >= questions.length - 1}
            className="rounded-full w-10 h-10 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Practice;