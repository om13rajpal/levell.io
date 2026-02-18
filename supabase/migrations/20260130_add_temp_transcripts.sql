-- ============================================
-- MIGRATION: Temporary Transcripts Table
-- ============================================
-- This table stores transcripts fetched from Fireflies
-- before users decide which ones to track/score.
-- ============================================

-- Create temp_transcripts table
CREATE TABLE IF NOT EXISTS temp_transcripts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fireflies_id TEXT NOT NULL,
  title TEXT,
  duration INTEGER, -- in minutes
  organizer_email TEXT,
  participants JSONB DEFAULT '[]',
  meeting_date TIMESTAMP WITH TIME ZONE,
  transcript_url TEXT,
  audio_url TEXT,
  video_url TEXT,
  summary TEXT,
  is_selected BOOLEAN DEFAULT FALSE,
  is_imported BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique fireflies_id per user
  CONSTRAINT unique_fireflies_id_per_user UNIQUE (user_id, fireflies_id)
);

-- Add comments
COMMENT ON TABLE temp_transcripts IS 'Temporary storage for Fireflies transcripts before user selection';
COMMENT ON COLUMN temp_transcripts.fireflies_id IS 'Unique ID from Fireflies API';
COMMENT ON COLUMN temp_transcripts.is_selected IS 'User has selected this transcript for tracking';
COMMENT ON COLUMN temp_transcripts.is_imported IS 'Transcript has been imported to main transcripts table';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_temp_transcripts_user_id ON temp_transcripts(user_id);
CREATE INDEX IF NOT EXISTS idx_temp_transcripts_user_selected ON temp_transcripts(user_id, is_selected);
CREATE INDEX IF NOT EXISTS idx_temp_transcripts_user_imported ON temp_transcripts(user_id, is_imported);
CREATE INDEX IF NOT EXISTS idx_temp_transcripts_meeting_date ON temp_transcripts(meeting_date DESC);

-- Enable RLS
ALTER TABLE temp_transcripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS temp_transcripts_select_policy ON temp_transcripts;
DROP POLICY IF EXISTS temp_transcripts_insert_policy ON temp_transcripts;
DROP POLICY IF EXISTS temp_transcripts_update_policy ON temp_transcripts;
DROP POLICY IF EXISTS temp_transcripts_delete_policy ON temp_transcripts;

-- Users can only see their own temp transcripts
CREATE POLICY temp_transcripts_select_policy ON temp_transcripts
FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own temp transcripts
CREATE POLICY temp_transcripts_insert_policy ON temp_transcripts
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own temp transcripts
CREATE POLICY temp_transcripts_update_policy ON temp_transcripts
FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own temp transcripts
CREATE POLICY temp_transcripts_delete_policy ON temp_transcripts
FOR DELETE USING (auth.uid() = user_id);

-- Add sync_status column to track sync progress
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_transcript_sync TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS transcript_sync_status TEXT DEFAULT 'idle';

COMMENT ON COLUMN users.last_transcript_sync IS 'Last time transcripts were synced from Fireflies';
COMMENT ON COLUMN users.transcript_sync_status IS 'Current sync status: idle, syncing, completed, error';
