-- ============================================
-- Enhanced Department/Tag Functionality Migration
-- ============================================
-- This migration adds tag_type and description columns to team_tags,
-- creates indexes for performance, and sets up RLS policies.
-- Safe to run multiple times (idempotent).
-- ============================================

-- ============================================
-- 1. Add tag_type column to team_tags
-- ============================================
-- Distinguishes between 'role' tags (Admin/Member) and 'department' tags (HR, Sales, etc.)

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

-- ============================================
-- 2. Add description column to team_tags
-- ============================================
-- Optional description for tags

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

-- ============================================
-- 3. Update existing tags with appropriate types
-- ============================================
-- Set Admin and Member tags to 'role' type

UPDATE team_tags
SET tag_type = 'role'
WHERE LOWER(tag_name) IN ('admin', 'member')
  AND (tag_type IS NULL OR tag_type = 'role');

-- ============================================
-- 4. Create performance indexes
-- ============================================

-- Index for filtering tags by team and type
CREATE INDEX IF NOT EXISTS idx_team_tags_team_type
ON team_tags(team_id, tag_type);

-- Index for looking up tags by name within a team
CREATE INDEX IF NOT EXISTS idx_team_tags_team_name
ON team_tags(team_id, LOWER(tag_name));

-- Index for team_member_tags lookups
CREATE INDEX IF NOT EXISTS idx_team_member_tags_team_user
ON team_member_tags(team_id, user_id);

-- Index for finding all users with a specific tag
CREATE INDEX IF NOT EXISTS idx_team_member_tags_tag
ON team_member_tags(tag_id);

-- ============================================
-- 5. Row Level Security (RLS) Policies
-- ============================================

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

-- ============================================
-- team_tags Policies
-- ============================================

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
    -- Must be admin
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
    -- Cannot delete core role tags
    AND tag_type != 'role'
);

-- ============================================
-- team_member_tags Policies
-- ============================================

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

-- ============================================
-- 6. Default Department Tags Seed Function
-- ============================================

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
    -- Check if team exists
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id) THEN
        RAISE EXCEPTION 'Team with ID % does not exist', p_team_id;
    END IF;

    -- Insert default department tags (skip if already exists)
    FOREACH v_dept SLICE 1 IN ARRAY v_default_departments
    LOOP
        INSERT INTO team_tags (team_id, tag_name, tag_color, tag_type, description)
        VALUES (p_team_id, v_dept[1], v_dept[2], 'department', v_dept[3])
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION seed_default_department_tags IS 'Seeds a team with default department tags. Call with team_id to add standard departments.';

-- ============================================
-- 7. Helper Function: Ensure Team Has Role Tags
-- ============================================

CREATE OR REPLACE FUNCTION ensure_team_role_tags(p_team_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure Admin tag exists
    INSERT INTO team_tags (team_id, tag_name, tag_color, tag_type, description)
    VALUES (p_team_id, 'Admin', '#ef4444', 'role', 'Team administrator with full permissions')
    ON CONFLICT DO NOTHING;

    -- Ensure Member tag exists
    INSERT INTO team_tags (team_id, tag_name, tag_color, tag_type, description)
    VALUES (p_team_id, 'Member', '#6366f1', 'role', 'Standard team member')
    ON CONFLICT DO NOTHING;
END;
$$;

COMMENT ON FUNCTION ensure_team_role_tags IS 'Ensures Admin and Member role tags exist for a team.';

-- ============================================
-- 8. Utility Function: Get Team Tags By Type
-- ============================================

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

-- ============================================
-- Validation Queries (run to verify migration)
-- ============================================

-- Check new columns exist:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'team_tags'
--   AND column_name IN ('tag_type', 'description');

-- Check indexes exist:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('team_tags', 'team_member_tags')
--   AND indexname LIKE 'idx_team%';

-- Check RLS policies:
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('team_tags', 'team_member_tags');

-- Test seed function (replace 1 with actual team_id):
-- SELECT seed_default_department_tags(1);
-- SELECT * FROM get_team_tags_by_type(1);

-- ============================================
-- Rollback (if needed)
-- ============================================
--
-- -- Remove columns
-- ALTER TABLE team_tags DROP COLUMN IF EXISTS tag_type;
-- ALTER TABLE team_tags DROP COLUMN IF EXISTS description;
--
-- -- Drop indexes
-- DROP INDEX IF EXISTS idx_team_tags_team_type;
-- DROP INDEX IF EXISTS idx_team_tags_team_name;
-- DROP INDEX IF EXISTS idx_team_member_tags_team_user;
-- DROP INDEX IF EXISTS idx_team_member_tags_tag;
--
-- -- Drop policies
-- DROP POLICY IF EXISTS team_tags_select_policy ON team_tags;
-- DROP POLICY IF EXISTS team_tags_insert_policy ON team_tags;
-- DROP POLICY IF EXISTS team_tags_update_policy ON team_tags;
-- DROP POLICY IF EXISTS team_tags_delete_policy ON team_tags;
-- DROP POLICY IF EXISTS team_member_tags_select_policy ON team_member_tags;
-- DROP POLICY IF EXISTS team_member_tags_insert_policy ON team_member_tags;
-- DROP POLICY IF EXISTS team_member_tags_update_policy ON team_member_tags;
-- DROP POLICY IF EXISTS team_member_tags_delete_policy ON team_member_tags;
--
-- -- Drop functions
-- DROP FUNCTION IF EXISTS seed_default_department_tags;
-- DROP FUNCTION IF EXISTS ensure_team_role_tags;
-- DROP FUNCTION IF EXISTS get_team_tags_by_type;
