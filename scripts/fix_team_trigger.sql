-- =====================================================
-- FIX: Team Member Tag Trigger
-- The team_member_tags table uses tag_id (FK to team_tags) not a text 'tag' column
-- We need to:
-- 1. Cast TEXT to UUID when inserting user_id
-- 2. Look up or create a default tag in team_tags first
-- =====================================================

-- OPTION 1: Simply disable the trigger (RECOMMENDED - simplest fix)
-- This removes the automatic tag assignment when members join
DROP TRIGGER IF EXISTS auto_assign_member_role ON teams;

-- =====================================================
-- OPTION 2: If you want to keep automatic tagging, use this instead
-- This creates a proper trigger that handles the tag_id lookup
-- =====================================================

/*
CREATE OR REPLACE FUNCTION add_default_member_tag()
RETURNS TRIGGER AS $$
DECLARE
  member_id TEXT;
  new_members TEXT[];
  old_members TEXT[];
  default_tag_id BIGINT;
BEGIN
  -- Get the arrays (handle NULL cases)
  new_members := COALESCE(NEW.members, ARRAY[]::TEXT[]);
  old_members := COALESCE(OLD.members, ARRAY[]::TEXT[]);

  -- Find or create a default 'Member' tag for this team
  SELECT id INTO default_tag_id
  FROM team_tags
  WHERE team_id = NEW.id AND tag_name = 'Member'
  LIMIT 1;

  -- If no default tag exists, create one
  IF default_tag_id IS NULL THEN
    INSERT INTO team_tags (team_id, tag_name, tag_color)
    VALUES (NEW.id, 'Member', '#6366f1')
    RETURNING id INTO default_tag_id;
  END IF;

  -- Find newly added members (in NEW but not in OLD)
  FOREACH member_id IN ARRAY new_members
  LOOP
    -- Check if this member is new (not in old array)
    IF NOT (member_id = ANY(old_members)) THEN
      -- Insert tag assignment for new member, casting TEXT to UUID
      INSERT INTO team_member_tags (team_id, user_id, tag_id)
      VALUES (NEW.id, member_id::UUID, default_tag_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS auto_assign_member_role ON teams;

CREATE TRIGGER auto_assign_member_role
  AFTER UPDATE OF members ON teams
  FOR EACH ROW
  EXECUTE FUNCTION add_default_member_tag();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION add_default_member_tag() TO authenticated;
GRANT EXECUTE ON FUNCTION add_default_member_tag() TO anon;
*/

-- =====================================================
-- Run the DROP TRIGGER line above (Option 1) first
-- If team joining works, you're done!
-- If you need automatic tagging, uncomment Option 2
-- =====================================================
