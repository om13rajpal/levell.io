-- ============================================
-- V2 Multi-Agent Architecture Schema Migration
-- ============================================
-- Run this in Supabase SQL Editor or via CLI
--
-- This migration adds columns to support the new multi-agent
-- analysis pipeline for deeper, more actionable coaching.
-- ============================================

-- Add call_summary column for AI-generated summaries (used for future call context)
ALTER TABLE transcripts
ADD COLUMN IF NOT EXISTS call_summary TEXT;

COMMENT ON COLUMN transcripts.call_summary IS 'AI-generated 4-5 sentence summary for future call context';

-- Add deal_signal column for deal health tracking
ALTER TABLE transcripts
ADD COLUMN IF NOT EXISTS deal_signal VARCHAR(20);

COMMENT ON COLUMN transcripts.deal_signal IS 'Deal health indicator: healthy, at_risk, or critical';

-- Add call_type column for call classification
ALTER TABLE transcripts
ADD COLUMN IF NOT EXISTS call_type VARCHAR(20);

COMMENT ON COLUMN transcripts.call_type IS 'Call classification: discovery, followup, demo, or closing';

-- Add extraction_outputs column for raw agent outputs (useful for debugging/reprocessing)
ALTER TABLE transcripts
ADD COLUMN IF NOT EXISTS extraction_outputs JSONB;

COMMENT ON COLUMN transcripts.extraction_outputs IS 'Raw outputs from all 6 extraction agents';

-- Create index for efficient context loader queries
-- Fetches previous calls for the same company
CREATE INDEX IF NOT EXISTS idx_company_calls_company_created
ON company_calls(company_id, created_at DESC);

-- Create index for deal signal filtering
CREATE INDEX IF NOT EXISTS idx_transcripts_deal_signal
ON transcripts(deal_signal)
WHERE deal_signal IS NOT NULL;

-- Create index for call type filtering
CREATE INDEX IF NOT EXISTS idx_transcripts_call_type
ON transcripts(call_type)
WHERE call_type IS NOT NULL;

-- ============================================
-- Validation Queries (run to verify migration)
-- ============================================

-- Check new columns exist:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'transcripts'
--   AND column_name IN ('call_summary', 'deal_signal', 'call_type', 'extraction_outputs');

-- Check indexes exist:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'transcripts'
--   AND indexname LIKE '%deal_signal%' OR indexname LIKE '%call_type%';

-- ============================================
-- Rollback (if needed)
-- ============================================
--
-- ALTER TABLE transcripts DROP COLUMN IF EXISTS call_summary;
-- ALTER TABLE transcripts DROP COLUMN IF EXISTS deal_signal;
-- ALTER TABLE transcripts DROP COLUMN IF EXISTS call_type;
-- ALTER TABLE transcripts DROP COLUMN IF EXISTS extraction_outputs;
-- DROP INDEX IF EXISTS idx_company_calls_company_created;
-- DROP INDEX IF EXISTS idx_transcripts_deal_signal;
-- DROP INDEX IF EXISTS idx_transcripts_call_type;
