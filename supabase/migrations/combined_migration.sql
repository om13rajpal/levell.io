-- ============================================
-- COMBINED MIGRATION - Run in Supabase SQL Editor
-- ============================================
-- This combines:
-- 1. V2 Multi-Agent Architecture Schema
-- 2. Department Tags Functionality
-- Safe to run multiple times (idempotent)
-- ============================================


-- ############################################
-- PART 1: V2 Multi-Agent Architecture Schema
-- ############################################

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


-- ############################################
-- PART 2: Department Tags Functionality
-- ############################################

-- Add tag_type column to team_tags
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'team_tags' AND column_name = 'tag_type'
    ) THEN
        ALTER TABLE team_tags
        ADD COLUMN tag_type VARCHAR(20) DEFAULT 'role'
        CHECK (tag_type IN ('role', 'department'));
    END IF;
END $$;

COMMENT ON COLUMN team_tags.tag_type IS 'Tag type: role (Admin/Member) or department (HR, Sales, Engineering, etc.)';

-- Add description column to team_tags
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'team_tags' AND column_name = 'description'
    ) THEN
        ALTER TABLE team_tags
        ADD COLUMN description TEXT;
    END IF;
END $$;

COMMENT ON COLUMN team_tags.description IS 'Optional description explaining the tag purpose';

-- Update existing tags with appropriate types
UPDATE team_tags
SET tag_type = 'role'
WHERE LOWER(tag_name) IN ('admin', 'member')
  AND (tag_type IS NULL OR tag_type = 'role');

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_team_tags_team_type
ON team_tags(team_id, tag_type);

CREATE INDEX IF NOT EXISTS idx_team_tags_team_name
ON team_tags(team_id, LOWER(tag_name));

CREATE INDEX IF NOT EXISTS idx_team_member_tags_team_user
ON team_member_tags(team_id, user_id);

CREATE INDEX IF NOT EXISTS idx_team_member_tags_tag
ON team_member_tags(tag_id);

-- Enable RLS on team_tags if not already enabled
ALTER TABLE team_tags ENABLE ROW LEVEL SECURITY;

-- Enable RLS on team_member_tags if not already enabled
ALTER TABLE team_member_tags ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS team_tags_select_policy ON team_tags;
DROP POLICY IF EXISTS team_tags_insert_policy ON team_tags;
DROP POLICY IF EXISTS team_tags_update_policy ON team_tags;
DROP POLICY IF EXISTS team_tags_delete_policy ON team_tags;

DROP POLICY IF EXISTS team_member_tags_select_policy ON team_member_tags;
DROP POLICY IF EXISTS team_member_tags_insert_policy ON team_member_tags;
DROP POLICY IF EXISTS team_member_tags_update_policy ON team_member_tags;
DROP POLICY IF EXISTS team_member_tags_delete_policy ON team_member_tags;

-- team_tags Policies

-- All team members can view tags for their team
CREATE POLICY team_tags_select_policy ON team_tags
FOR SELECT
USING (
    team_id IN (
        SELECT t.id FROM teams t
        WHERE auth.uid() = ANY(t.members)
    )
);

-- Only team admins (owner or users with Admin tag) can insert tags
CREATE POLICY team_tags_insert_policy ON team_tags
FOR INSERT
WITH CHECK (
    team_id IN (
        SELECT t.id FROM teams t
        WHERE t.owner = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM team_member_tags tmt
        JOIN team_tags tt ON tmt.tag_id = tt.id
        WHERE tmt.user_id = auth.uid()
          AND tmt.team_id = team_tags.team_id
          AND LOWER(tt.tag_name) = 'admin'
    )
);

-- Only team admins can update tags
CREATE POLICY team_tags_update_policy ON team_tags
FOR UPDATE
USING (
    team_id IN (
        SELECT t.id FROM teams t
        WHERE t.owner = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM team_member_tags tmt
        JOIN team_tags tt ON tmt.tag_id = tt.id
        WHERE tmt.user_id = auth.uid()
          AND tmt.team_id = team_tags.team_id
          AND LOWER(tt.tag_name) = 'admin'
    )
);

-- Only team admins can delete tags (but protect role tags)
CREATE POLICY team_tags_delete_policy ON team_tags
FOR DELETE
USING (
    (
        team_id IN (
            SELECT t.id FROM teams t
            WHERE t.owner = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM team_member_tags tmt
            JOIN team_tags tt ON tmt.tag_id = tt.id
            WHERE tmt.user_id = auth.uid()
              AND tmt.team_id = team_tags.team_id
              AND LOWER(tt.tag_name) = 'admin'
        )
    )
    AND tag_type != 'role'
);

-- team_member_tags Policies

-- All team members can view tag assignments for their team
CREATE POLICY team_member_tags_select_policy ON team_member_tags
FOR SELECT
USING (
    team_id IN (
        SELECT t.id FROM teams t
        WHERE auth.uid() = ANY(t.members)
    )
);

-- Only team admins can assign tags
CREATE POLICY team_member_tags_insert_policy ON team_member_tags
FOR INSERT
WITH CHECK (
    team_id IN (
        SELECT t.id FROM teams t
        WHERE t.owner = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM team_member_tags tmt
        JOIN team_tags tt ON tmt.tag_id = tt.id
        WHERE tmt.user_id = auth.uid()
          AND tmt.team_id = team_member_tags.team_id
          AND LOWER(tt.tag_name) = 'admin'
    )
);

-- Only team admins can update tag assignments
CREATE POLICY team_member_tags_update_policy ON team_member_tags
FOR UPDATE
USING (
    team_id IN (
        SELECT t.id FROM teams t
        WHERE t.owner = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM team_member_tags tmt
        JOIN team_tags tt ON tmt.tag_id = tt.id
        WHERE tmt.user_id = auth.uid()
          AND tmt.team_id = team_member_tags.team_id
          AND LOWER(tt.tag_name) = 'admin'
    )
);

-- Only team admins can remove tag assignments
CREATE POLICY team_member_tags_delete_policy ON team_member_tags
FOR DELETE
USING (
    team_id IN (
        SELECT t.id FROM teams t
        WHERE t.owner = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM team_member_tags tmt
        JOIN team_tags tt ON tmt.tag_id = tt.id
        WHERE tmt.user_id = auth.uid()
          AND tmt.team_id = team_member_tags.team_id
          AND LOWER(tt.tag_name) = 'admin'
    )
);

-- Helper Function: Seed Default Department Tags
CREATE OR REPLACE FUNCTION seed_default_department_tags(p_team_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_default_departments TEXT[][] := ARRAY[
        ARRAY['Sales', '#22c55e', 'Sales and business development team'],
        ARRAY['Engineering', '#3b82f6', 'Software engineering and development'],
        ARRAY['Marketing', '#a855f7', 'Marketing and brand management'],
        ARRAY['Customer Success', '#f97316', 'Customer support and success'],
        ARRAY['HR', '#ec4899', 'Human resources and people operations'],
        ARRAY['Finance', '#14b8a6', 'Finance and accounting'],
        ARRAY['Operations', '#6366f1', 'Business operations and logistics'],
        ARRAY['Product', '#eab308', 'Product management and design']
    ];
    v_dept TEXT[];
BEGIN
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id) THEN
        RAISE EXCEPTION 'Team with ID % does not exist', p_team_id;
    END IF;

    FOREACH v_dept SLICE 1 IN ARRAY v_default_departments
    LOOP
        INSERT INTO team_tags (team_id, tag_name, tag_color, tag_type, description)
        VALUES (p_team_id, v_dept[1], v_dept[2], 'department', v_dept[3])
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION seed_default_department_tags IS 'Seeds a team with default department tags. Call with team_id to add standard departments.';

-- Helper Function: Ensure Team Has Role Tags
CREATE OR REPLACE FUNCTION ensure_team_role_tags(p_team_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO team_tags (team_id, tag_name, tag_color, tag_type, description)
    VALUES (p_team_id, 'Admin', '#ef4444', 'role', 'Team administrator with full permissions')
    ON CONFLICT DO NOTHING;

    INSERT INTO team_tags (team_id, tag_name, tag_color, tag_type, description)
    VALUES (p_team_id, 'Member', '#6366f1', 'role', 'Standard team member')
    ON CONFLICT DO NOTHING;
END;
$$;

COMMENT ON FUNCTION ensure_team_role_tags IS 'Ensures Admin and Member role tags exist for a team.';

-- Utility Function: Get Team Tags By Type
CREATE OR REPLACE FUNCTION get_team_tags_by_type(p_team_id INTEGER, p_tag_type VARCHAR DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    tag_name VARCHAR,
    tag_color VARCHAR,
    tag_type VARCHAR,
    description TEXT,
    member_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tt.id,
        tt.tag_name,
        tt.tag_color,
        tt.tag_type,
        tt.description,
        COUNT(tmt.id) as member_count
    FROM team_tags tt
    LEFT JOIN team_member_tags tmt ON tt.id = tmt.tag_id
    WHERE tt.team_id = p_team_id
      AND (p_tag_type IS NULL OR tt.tag_type = p_tag_type)
    GROUP BY tt.id, tt.tag_name, tt.tag_color, tt.tag_type, tt.description
    ORDER BY tt.tag_type, tt.tag_name;
END;
$$;

COMMENT ON FUNCTION get_team_tags_by_type IS 'Returns tags for a team, optionally filtered by type, with member counts.';


-- ############################################
-- MIGRATION COMPLETE
-- ############################################
-- Run the validation queries below to verify:
--
-- Check V2 columns:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'transcripts'
--   AND column_name IN ('call_summary', 'deal_signal', 'call_type', 'extraction_outputs');
--
-- Check tag columns:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'team_tags'
--   AND column_name IN ('tag_type', 'description');
--
-- Check indexes:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename IN ('team_tags', 'team_member_tags', 'transcripts')
--   AND indexname LIKE 'idx_%';
