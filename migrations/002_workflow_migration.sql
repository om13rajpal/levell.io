-- Migration: 002_workflow_migration.sql
-- Description: Add tables for batch scoring, recommendations, ICP research, and prompt caching
-- Part of n8n to Inngest migration

-- ============================================
-- Batch Job Tracking
-- Tracks batch scoring jobs for monitoring and debugging
-- ============================================
CREATE TABLE IF NOT EXISTS scoring_batch_jobs (
  id SERIAL PRIMARY KEY,
  status VARCHAR(20) DEFAULT 'pending', -- pending/processing/completed/failed
  triggered_by VARCHAR(20) NOT NULL,    -- cron/manual
  total_transcripts INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scoring_batch_jobs_status ON scoring_batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scoring_batch_jobs_created ON scoring_batch_jobs(created_at DESC);

-- ============================================
-- Company Recommendations
-- Stores AI-generated recommendations based on transcript analysis
-- ============================================
CREATE TABLE IF NOT EXISTS company_recommendations (
  id SERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL,
  recommendations TEXT[],
  key_strengths TEXT[],
  focus_areas TEXT[],
  relationships TEXT[],
  risks TEXT[],
  pain_points_objections TEXT[],
  patterns JSONB,
  total_transcripts INTEGER DEFAULT 0,
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_recommendations_user ON company_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_company_recommendations_company ON company_recommendations(company_id);

-- ============================================
-- User Recommendations
-- Stores personalized coaching recommendations for sales reps
-- ============================================
CREATE TABLE IF NOT EXISTS user_recommendations (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  recommendations TEXT[],
  key_strengths TEXT[],
  focus_areas TEXT[],
  relationships TEXT[],
  coaching_insights JSONB,
  total_transcripts INTEGER DEFAULT 0,
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_recommendations_user ON user_recommendations(user_id);

-- ============================================
-- Company ICP (Ideal Customer Profile)
-- Stores scraped website data and AI-generated ICP analysis
-- ============================================
CREATE TABLE IF NOT EXISTS company_icp (
  id SERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL,
  website TEXT,
  company_info JSONB,
  products_and_services JSONB,
  ideal_customer_profile JSONB,
  buyer_personas JSONB,
  talk_tracks TEXT[],
  objection_handling JSONB,
  raw_scraped_content TEXT,
  scrape_status VARCHAR(20) DEFAULT 'pending', -- pending/scraping/analyzing/completed/failed
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_icp_user ON company_icp(user_id);
CREATE INDEX IF NOT EXISTS idx_company_icp_company ON company_icp(company_id);
CREATE INDEX IF NOT EXISTS idx_company_icp_status ON company_icp(scrape_status);

-- ============================================
-- Recommendation Jobs
-- Tracks long-running recommendation generation jobs
-- ============================================
CREATE TABLE IF NOT EXISTS recommendation_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL, -- company_clustering/user_recommendations/icp_research
  target_id TEXT,                 -- company_id or null for user-level
  user_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending/processing/completed/failed
  progress INTEGER DEFAULT 0,     -- 0-100 percentage
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  error_message TEXT,
  result JSONB,                   -- Optional result summary
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_jobs_user ON recommendation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_jobs_status ON recommendation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_recommendation_jobs_type ON recommendation_jobs(job_type);

-- ============================================
-- Prompt Cache
-- Caches formatted prompts to reduce redundant processing
-- Persistent across serverless cold starts
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_cache (
  id SERIAL PRIMARY KEY,
  transcript_id BIGINT NOT NULL UNIQUE REFERENCES transcripts(id) ON DELETE CASCADE,
  content_hash VARCHAR(64) NOT NULL,      -- SHA256 hash for cache validation
  formatted_transcript TEXT NOT NULL,
  formatted_context TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_cache_transcript ON prompt_cache(transcript_id);
CREATE INDEX IF NOT EXISTS idx_prompt_cache_expires ON prompt_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_prompt_cache_hash ON prompt_cache(content_hash);

-- ============================================
-- Cleanup Function for Expired Cache
-- Can be called manually or via cron
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_prompt_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM prompt_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies
-- ============================================

-- Scoring batch jobs: Admin only (service role)
ALTER TABLE scoring_batch_jobs ENABLE ROW LEVEL SECURITY;

-- Company recommendations: Users can only see their own
ALTER TABLE company_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_recommendations_select ON company_recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY company_recommendations_insert ON company_recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY company_recommendations_update ON company_recommendations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY company_recommendations_delete ON company_recommendations
  FOR DELETE USING (auth.uid() = user_id);

-- User recommendations: Users can only see their own
ALTER TABLE user_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_recommendations_select ON user_recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_recommendations_insert ON user_recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_recommendations_update ON user_recommendations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_recommendations_delete ON user_recommendations
  FOR DELETE USING (auth.uid() = user_id);

-- Company ICP: Users can only see their own
ALTER TABLE company_icp ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_icp_select ON company_icp
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY company_icp_insert ON company_icp
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY company_icp_update ON company_icp
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY company_icp_delete ON company_icp
  FOR DELETE USING (auth.uid() = user_id);

-- Recommendation jobs: Users can only see their own
ALTER TABLE recommendation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY recommendation_jobs_select ON recommendation_jobs
  FOR SELECT USING (auth.uid() = user_id);

-- Prompt cache: Admin only (service role)
ALTER TABLE prompt_cache ENABLE ROW LEVEL SECURITY;
