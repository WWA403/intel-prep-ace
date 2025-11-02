Connecting to remote database...
Creating shadow database...
Initialising schema...
Seeding globals from roles.sql...
Applying migration 00000000000000_initial_schema.sql...
Applying migration 20250722220000_consolidate_question_tables.sql...
ERROR: column "search_id" of relation "interview_questions" already exists (SQLSTATE 42701)       
At statement 0:                                                                                   
-- Consolidate interview questions: Remove enhanced_question_banks and enhance interview_questions
-- This migration consolidates the duplicate question storage into a single enhanced table        
                                                                                                  
-- Step 1: Add enhanced fields to interview_questions table                                       
ALTER TABLE public.interview_questions                                                            
ADD COLUMN search_id UUID REFERENCES public.searches(id) ON DELETE CASCADE,                       
ADD COLUMN category TEXT NOT NULL DEFAULT 'general',                                              
ADD COLUMN question_type TEXT NOT NULL DEFAULT 'common',                                          
ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'Medium',                                             
ADD COLUMN rationale TEXT,                                                                        
ADD COLUMN suggested_answer_approach TEXT,                                                        
ADD COLUMN evaluation_criteria TEXT[],                                                            
ADD COLUMN follow_up_questions TEXT[],                                                            
ADD COLUMN star_story_fit BOOLEAN DEFAULT false,                                                  
ADD COLUMN company_context TEXT,                                                                  
ADD COLUMN usage_count INTEGER DEFAULT 0,                                                         
ADD COLUMN confidence_score FLOAT DEFAULT 0.0,                                                    
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL                             
Try rerunning the command with --debug to troubleshoot the error.
