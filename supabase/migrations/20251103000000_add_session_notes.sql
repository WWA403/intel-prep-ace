-- Add session_notes field to practice_sessions table
-- Epic 2.4: Session Summary & Completion

ALTER TABLE public.practice_sessions
ADD COLUMN IF NOT EXISTS session_notes TEXT;

