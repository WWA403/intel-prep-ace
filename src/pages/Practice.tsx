import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
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
  Star,
  ArrowLeft,
  ArrowRight
} from "lucide-react";
import { searchService } from "@/services/searchService";
import { sessionSampler } from "@/services/sessionSampler";
import { useAuth } from "@/hooks/useAuth";
import { SessionSummary } from "@/components/SessionSummary";

const SWIPE_THRESHOLD_PX = 80;
const VERTICAL_SCROLL_SUPPRESSION_DELTA = 18;
const PRACTICE_SETUP_STORAGE_KEY = "practiceSetupDefaults";

const SETUP_STEPS = [
  { key: "goal", label: "Goal" },
  { key: "stages", label: "Stages" },
  { key: "filters", label: "Filters" },
  { key: "review", label: "Review" }
] as const;

const practicePresets = {
  quick: {
    label: "Quick Practice",
    description: "10 shuffled questions across all stages.",
    config: {
      sampleSize: 10,
      shuffle: true,
      categories: [] as string[],
      difficulties: [] as string[],
      favoritesOnly: false
    }
  },
  deep: {
    label: "Deep Dive",
    description: "30 sequential questions with full context.",
    config: {
      sampleSize: 30,
      shuffle: false,
      categories: [] as string[],
      difficulties: [] as string[],
      favoritesOnly: false
    }
  }
} as const;

type PracticeDefaults = {
  sampleSize: number;
  categories: string[];
  difficulties: string[];
  shuffle: boolean;
  favoritesOnly: boolean;
};

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
  session_notes?: string | null;
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
  const [isSavingNotes, setIsSavingNotes] = useState(false);
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
  const [setupStep, setSetupStep] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [rememberDefaults, setRememberDefaults] = useState(true);
  const hasDismissedSwipeHintRef = useRef(false);
  const [shouldShowSwipeHint, setShouldShowSwipeHint] = useState(true);
  const [isVerticalScrollGuarded, setIsVerticalScrollGuarded] = useState(false);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Swipe gesture states
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [swipeDelta, setSwipeDelta] = useState(0);

  const loadPracticeDefaults = () => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem(PRACTICE_SETUP_STORAGE_KEY);
      if (stored) {
        const parsed: PracticeDefaults = JSON.parse(stored);
        if (typeof parsed.sampleSize === "number") {
          setSampleSize(parsed.sampleSize);
        }
        if (Array.isArray(parsed.categories)) {
          setTempCategories(parsed.categories);
        }
        if (Array.isArray(parsed.difficulties)) {
          setTempDifficulties(parsed.difficulties);
        }
        if (typeof parsed.shuffle === "boolean") {
          setTempShuffle(parsed.shuffle);
        }
        if (typeof parsed.favoritesOnly === "boolean") {
          setTempShowFavoritesOnly(parsed.favoritesOnly);
        }
        setRememberDefaults(true);
        return true;
      }
    } catch (error) {
      console.error("Failed to read practice defaults", error);
    }
    return false;
  };

  const persistPracticeDefaults = () => {
    if (typeof window === "undefined") return;
    if (!rememberDefaults) {
      localStorage.removeItem(PRACTICE_SETUP_STORAGE_KEY);
      return;
    }

    const payload: PracticeDefaults = {
      sampleSize,
      categories: tempCategories,
      difficulties: tempDifficulties,
      shuffle: tempShuffle,
      favoritesOnly: tempShowFavoritesOnly
    };

    try {
      localStorage.setItem(PRACTICE_SETUP_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to persist practice defaults", error);
    }
  };

  const handlePresetSelect = (presetKey: keyof typeof practicePresets) => {
    const preset = practicePresets[presetKey];
    setSelectedPreset(presetKey);
    setSampleSize(preset.config.sampleSize);
    setTempShuffle(preset.config.shuffle);
    setTempCategories([...preset.config.categories]);
    setTempDifficulties([...preset.config.difficulties]);
    setTempShowFavoritesOnly(preset.config.favoritesOnly);
  };

  const canProceedFromSetupStep = () => {
    switch (setupStep) {
      case 0:
        return sampleSize > 0;
      case 1:
        return allStages.some(stage => stage.selected);
      default:
        return true;
    }
  };

  const goToNextSetupStep = () => {
    if (setupStep < SETUP_STEPS.length - 1 && canProceedFromSetupStep()) {
      setSetupStep(prev => prev + 1);
    }
  };

  const goToPreviousSetupStep = () => {
    if (setupStep > 0) {
      setSetupStep(prev => prev - 1);
    }
  };

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

const getInterviewerFocus = (
  question: Question | null,
  meta?: { company?: string; role?: string }
) => {
  if (!question) return null;

  const summaryPieces = [question.rationale, question.company_context].filter(
    (piece): piece is string => Boolean(piece && piece.trim())
  );

  const evaluationCriteria = question.evaluation_criteria?.filter(
    (criterion): criterion is string => Boolean(criterion && criterion.trim())
  ) ?? [];

  const followUps = question.follow_up_questions?.filter(
    (followUp): followUp is string => Boolean(followUp && followUp.trim())
  ) ?? [];

  const answerApproach = question.suggested_answer_approach?.trim() || null;

  const hasData =
    summaryPieces.length > 0 ||
    evaluationCriteria.length > 0 ||
    followUps.length > 0 ||
    Boolean(answerApproach);

  if (!hasData) {
    return null;
  }

  return {
    summary: summaryPieces.join(' ').trim() || null,
    criteria: evaluationCriteria,
    followUps,
    answerApproach,
    meta: {
      company: meta?.company,
      role: meta?.role,
      difficulty: question.difficulty
    }
  };
};

  // Load stored setup defaults on mount
  useEffect(() => {
    loadPracticeDefaults();
  }, []);

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

  useEffect(() => {
    if (sessionState !== 'inProgress') {
      setShouldShowSwipeHint(false);
      return;
    }

    if (currentIndex === 0 && !hasDismissedSwipeHintRef.current) {
      setShouldShowSwipeHint(true);
    } else if (currentIndex > 0 && !hasDismissedSwipeHintRef.current) {
      hasDismissedSwipeHintRef.current = true;
      setShouldShowSwipeHint(false);
    }
  }, [currentIndex, sessionState]);

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

  const hideSwipeHint = () => {
    if (!hasDismissedSwipeHintRef.current) {
      hasDismissedSwipeHintRef.current = true;
    }
    setShouldShowSwipeHint(false);
  };

  const handleDismissSwipeHint = () => {
    hideSwipeHint();
  };

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
    const hasSelectedStages = allStages.some(stage => stage.selected);
    if (!hasSelectedStages) {
      setSetupStep(1);
      return;
    }
    persistPracticeDefaults();
    hasDismissedSwipeHintRef.current = false;
    setShouldShowSwipeHint(true);
    setIsVerticalScrollGuarded(false);
    setSetupStep(0);
    setSelectedPreset(null);
    
    setUseSampling(true);
    setSessionState('inProgress');
    setCurrentIndex(0);
  };

  const handleStartNewSession = () => {
    setSessionState('setup');
    setSetupStep(0);
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
    const restoredDefaults = loadPracticeDefaults();
    if (!restoredDefaults) {
      setSampleSize(10);
      setTempCategories([]);
      setTempDifficulties([]);
      setTempShuffle(false);
      setTempShowFavoritesOnly(false);
    }
    setSelectedPreset(null);
    hasDismissedSwipeHintRef.current = false;
    setShouldShowSwipeHint(false);
    setIsVerticalScrollGuarded(false);
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
          // Mark session as completed in database
          if (practiceSession) {
            await searchService.completePracticeSession(practiceSession.id);
          }
          // Mark session as completed in UI
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
  const interviewerFocus = getInterviewerFocus(currentQuestion ?? null, {
    company: searchData?.company,
    role: searchData?.role
  });

  // Swipe handlers
  const handleSwipeLeft = () => {
    if (isVerticalScrollGuarded) {
      setIsVerticalScrollGuarded(false);
      return;
    }
    hideSwipeHint();
    if (currentIndex < questions.length - 1) {
      skipQuestion();
    }
  };

  const handleSwipeRight = () => {
    if (isVerticalScrollGuarded) {
      setIsVerticalScrollGuarded(false);
      return;
    }
    hideSwipeHint();
    if (currentQuestion) {
      handleToggleFlag(currentQuestion.id, 'favorite');
    }
  };

  // Reset swipe state when question changes
  useEffect(() => {
    setSwipeDirection(null);
    setSwipeDelta(0);
  }, [currentIndex]);

  // Swipe configuration
  const swipeHandlers = useSwipeable({
    onSwiping: (eventData) => {
      const { dir, deltaX, deltaY } = eventData;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absY > VERTICAL_SCROLL_SUPPRESSION_DELTA && absY > absX) {
        if (!isVerticalScrollGuarded) {
          setIsVerticalScrollGuarded(true);
        }
        setSwipeDirection(null);
        setSwipeDelta(0);
        return;
      }

      if (absX > absY && (dir === 'Left' || dir === 'Right')) {
        setSwipeDirection(dir.toLowerCase() as 'left' | 'right');
        setSwipeDelta(deltaX);
      }
    },
    onSwipedLeft: () => {
      setSwipeDirection(null);
      setSwipeDelta(0);
      handleSwipeLeft();
    },
    onSwipedRight: () => {
      setSwipeDirection(null);
      setSwipeDelta(0);
      handleSwipeRight();
    },
    onSwiped: () => {
      setTimeout(() => {
        setSwipeDirection(null);
        setSwipeDelta(0);
      }, 200);
      setIsVerticalScrollGuarded(false);
    },
    trackMouse: true, // Enable mouse drag for desktop
    trackTouch: true, // Enable touch for mobile
    preventScrollOnSwipe: false,
    delta: SWIPE_THRESHOLD_PX,
  });

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
    const renderSetupStepContent = () => {
      switch (setupStep) {
        case 0:
          return (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(practicePresets).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePresetSelect(key as keyof typeof practicePresets)}
                    className={`rounded-xl border p-4 text-left transition hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                      selectedPreset === key ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{preset.label}</span>
                      {selectedPreset === key && (
                        <Badge variant="secondary" className="text-xs">
                          Selected
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{preset.description}</p>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Number of Questions</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={sampleSize}
                  onChange={(e) => setSampleSize(sessionSampler.validateSampleSize(parseInt(e.target.value) || 10))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">Pick 1–100 questions for this session. Presets adjust this automatically.</p>
              </div>
            </div>
          );
        case 1:
          return (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Choose at least one stage to include in this practice run.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allStages.map((stage, index) => {
                  const totalQuestions = stage.questions?.length || 0;
                  return (
                    <div key={stage.id} className="flex items-center space-x-3 rounded-lg border p-3">
                      <Checkbox
                        checked={stage.selected}
                        onCheckedChange={() => handleStageToggle(stage.id)}
                        aria-label={`Toggle ${stage.name}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            Stage {index + 1}
                          </Badge>
                          <span className="font-medium text-sm truncate">{stage.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{totalQuestions} question{totalQuestions !== 1 ? 's' : ''} available</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedStagesCount === 0 && (
                <p className="text-xs text-amber-600">Select at least one stage to continue.</p>
              )}
            </div>
          );
        case 2:
          return (
            <div className="space-y-5">
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground">Categories</label>
                <p className="text-xs text-muted-foreground">Leave unselected to include all categories.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {questionCategories.filter(cat => cat.value !== 'all').map(cat => (
                    <div key={cat.value} className="flex items-center space-x-2 rounded-md border bg-background px-2 py-1">
                      <Checkbox
                        id={`cat-${cat.value}`}
                        checked={tempCategories.includes(cat.value)}
                        onCheckedChange={() => toggleCategory(cat.value)}
                      />
                      <label htmlFor={`cat-${cat.value}`} className="text-xs cursor-pointer">{cat.label}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
                <div className="flex flex-wrap gap-2">
                  {difficultyLevels.filter(level => level.value !== 'all').map(level => (
                    <div key={level.value} className="flex items-center space-x-2 rounded-md border bg-background px-3 py-2">
                      <Checkbox
                        id={`diff-${level.value}`}
                        checked={tempDifficulties.includes(level.value)}
                        onCheckedChange={() => toggleDifficulty(level.value)}
                      />
                      <label htmlFor={`diff-${level.value}`} className="text-xs cursor-pointer">{level.label}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Order & Favorites</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex items-center space-x-2 rounded-md border bg-background px-3 py-2">
                    <Checkbox
                      id="shuffle"
                      checked={tempShuffle}
                      onCheckedChange={(checked) => setTempShuffle(!!checked)}
                    />
                    <label htmlFor="shuffle" className="text-xs cursor-pointer">Shuffle questions randomly</label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-md border bg-background px-3 py-2">
                    <Checkbox
                      id="favorites-only"
                      checked={tempShowFavoritesOnly}
                      onCheckedChange={(checked) => setTempShowFavoritesOnly(!!checked)}
                    />
                    <label htmlFor="favorites-only" className="text-xs cursor-pointer flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-500" />
                      Favorites only
                    </label>
                  </div>
                </div>
              </div>
            </div>
          );
        default:
          return (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="text-sm font-medium mb-2">Session Summary</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• {sampleSize} question{sampleSize !== 1 ? 's' : ''} selected</li>
                  <li>• {selectedStagesCount} stage{selectedStagesCount !== 1 ? 's' : ''} included</li>
                  <li>• Categories: {tempCategories.length ? tempCategories.map(c => questionCategories.find(cat => cat.value === c)?.label).join(", ") : "All"}</li>
                  <li>• Difficulty: {tempDifficulties.length ? tempDifficulties.join(", ") : "All levels"}</li>
                  <li>• Order: {tempShuffle ? "Shuffled" : "Stage order"}</li>
                  <li>• Favorites: {tempShowFavoritesOnly ? "Only favorited questions" : "All questions"}</li>
                </ul>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-defaults"
                  checked={rememberDefaults}
                  onCheckedChange={(checked) => setRememberDefaults(!!checked)}
                />
                <label htmlFor="remember-defaults" className="text-sm text-muted-foreground">
                  Remember these defaults for next time
                </label>
              </div>
            </div>
          );
      }
    };

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
                Step {setupStep + 1} of {SETUP_STEPS.length}: {SETUP_STEPS[setupStep].label}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                {SETUP_STEPS.map((step, index) => (
                  <div key={step.key} className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                        index <= setupStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className={`text-sm ${index === setupStep ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {step.label}
                    </span>
                    {index < SETUP_STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
                  </div>
                ))}
              </div>

              {renderSetupStepContent()}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
                <Button
                  variant="ghost"
                  onClick={goToPreviousSetupStep}
                  disabled={setupStep === 0}
                  className="w-full sm:w-auto"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                {setupStep < SETUP_STEPS.length - 1 ? (
                  <Button
                    onClick={goToNextSetupStep}
                    disabled={!canProceedFromSetupStep()}
                    className="w-full sm:w-auto"
                  >
                    Next • {SETUP_STEPS[setupStep + 1].label}
                  </Button>
                ) : (
                  <Button
                    onClick={handleBeginSession}
                    disabled={!canProceedFromSetupStep() || selectedStagesCount === 0}
                    className="w-full sm:w-auto"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Practice
                  </Button>
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
    const skippedCount = questions.length - answeredCount;
    const favoritedCount = questions.filter(q => questionFlags[q.id]?.flag_type === 'favorite').length;

    const handleSaveNotes = async (notes: string) => {
      if (!practiceSession) return;
      
      setIsSavingNotes(true);
      try {
        const result = await searchService.completePracticeSession(practiceSession.id, notes);
        if (!result.success) {
          console.error("Failed to save session notes:", result.error);
        }
      } catch (error) {
        console.error("Error saving session notes:", error);
      } finally {
        setIsSavingNotes(false);
      }
    };

    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <SessionSummary
            answeredCount={answeredCount}
            totalQuestions={questions.length}
            skippedCount={skippedCount}
            favoritedCount={favoritedCount}
            totalTime={totalTime}
            avgTime={avgTime}
            onSaveNotes={handleSaveNotes}
            onStartNewSession={handleStartNewSession}
            onBackToDashboard={() => navigate(`/dashboard?searchId=${searchId}`)}
            isSaving={isSavingNotes}
          />
        </div>
      </div>
    );
  }

  // Active Practice Session - Show questions
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div
        className="container mx-auto px-4 py-4 max-w-4xl"
        style={{ paddingBottom: "calc(140px + env(safe-area-inset-bottom))" }}
      >
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
        <div className="max-w-2xl mx-auto relative">
          {/* Swipe Indicator Overlay */}
          {swipeDirection && (
            <div 
              className={`absolute inset-0 z-10 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
                swipeDirection === 'left' ? 'bg-red-500/20' : 'bg-amber-500/20'
              }`}
              style={{
                opacity: Math.min(Math.abs(swipeDelta) / 100, 0.8),
                transform: swipeDirection === 'left'
                  ? `translateX(${Math.min(swipeDelta, 0)}px)`
                  : `translateX(${Math.max(swipeDelta, 0)}px)`
              }}
            >
              <div className="flex flex-col items-center gap-2 text-lg font-semibold">
                {swipeDirection === 'left' && (
                  <>
                    <ArrowLeft className="h-8 w-8 text-red-600" />
                    <span className="text-red-600">Skip</span>
                  </>
                )}
                {swipeDirection === 'right' && (
                  <>
                    <Star className="h-8 w-8 text-amber-600 fill-current" />
                    <span className="text-amber-600">Favorite</span>
                  </>
                )}
              </div>
            </div>
          )}

          <Card 
            className={`overflow-hidden transition-transform duration-200 ${
              swipeDirection === 'left' ? 'transform -translate-x-2' :
              swipeDirection === 'right' ? 'transform translate-x-2' :
              ''
            }`}
            {...swipeHandlers}
          >
            <CardHeader className="pb-4">
              {sessionState === 'inProgress' && shouldShowSwipeHint && (
                <div className="mb-4 flex flex-wrap items-center justify-center gap-3 rounded-full bg-muted px-4 py-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 text-foreground">
                    <ArrowLeft className="h-3 w-3" />
                    Swipe to skip
                  </span>
                  <span className="flex items-center gap-1 text-foreground">
                    <Star className="h-3 w-3" />
                    Swipe to favorite
                  </span>
                  <button
                    type="button"
                    onClick={handleDismissSwipeHint}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Got it
                  </button>
                </div>
              )}
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
              
              {/* Interviewer context */}
              {interviewerFocus && (
                <div className="space-y-2 rounded-xl bg-muted/40 p-3 text-sm">
                  {(() => {
                    const metaParts = [
                      interviewerFocus.meta.role,
                      interviewerFocus.meta.company,
                      interviewerFocus.meta.difficulty ? `${interviewerFocus.meta.difficulty} depth expected` : null
                    ].filter(Boolean);
                    if (metaParts.length === 0) return null;
                    return (
                      <p className="text-xs text-muted-foreground">
                        {metaParts.join(" • ")}
                      </p>
                    );
                  })()}

                  {interviewerFocus.summary && (
                    <p className="leading-relaxed text-foreground">
                      {interviewerFocus.summary}
                    </p>
                  )}

                  {interviewerFocus.criteria.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Signals:</span>{" "}
                      {interviewerFocus.criteria.join(" · ")}
                    </p>
                  )}

                  {interviewerFocus.answerApproach && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Approach:</span>{" "}
                      {interviewerFocus.answerApproach}
                    </p>
                  )}

                  {interviewerFocus.followUps.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Possible follow-ups:</span>{" "}
                      {interviewerFocus.followUps.join(" · ")}
                    </p>
                  )}
                </div>
              )}
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Voice Recording Section - PRIORITIZED */}
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm">Voice Answer (Local preview only)</h3>
                    <p className="text-xs text-muted-foreground">
                      Audio stays on this device until uploads ship.
                    </p>
                  </div>
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
        <div
          className="flex w-full items-center justify-between max-w-2xl mx-auto mt-6 md:sticky md:bottom-4 bg-background rounded-3xl md:rounded-full border p-3 md:p-2 shadow-none md:shadow-lg md:bg-background/95 md:backdrop-blur-sm"
          style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
        >
          <Button
            variant="outline"
            onClick={previousQuestion}
            disabled={currentIndex === 0}
            className="rounded-full w-10 h-10 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* Question Indicators - Scrollable */}
          <div className="flex items-center gap-2 px-2 overflow-x-auto max-w-[260px] scrollbar-hide">
            {questions.map((question, index) => (
              <button
                key={question.id}
                onClick={() => jumpToQuestion(index)}
                type="button"
                aria-current={index === currentIndex ? "true" : undefined}
                title={`Go to question ${index + 1}`}
                aria-label={`Go to question ${index + 1}${question.answered ? ' (answered)' : ''}`}
                className={`w-3 h-3 rounded-full transition-all duration-200 flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  index === currentIndex 
                    ? 'bg-primary scale-150' 
                    : question.answered 
                      ? 'bg-green-500 hover:scale-125' 
                      : 'bg-muted hover:bg-muted-foreground/50 hover:scale-125'
                }`}
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