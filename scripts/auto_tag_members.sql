-- =====================================================
-- AUTO-TAG MEMBERS TRIGGER
-- Automatically assigns a default "Member" tag when users join a team
-- =====================================================

-- Step 1: Drop the old broken trigger
DROP TRIGGER IF EXISTS auto_assign_member_role ON teams;

-- Step 2: Create the fixed trigger function
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
      -- Check if tag assignment already exists
      IF NOT EXISTS (
        SELECT 1 FROM team_member_tags
        WHERE team_id = NEW.id
          AND user_id = member_id::UUID
          AND tag_id = default_tag_id
      ) THEN
        -- Insert tag assignment for new member
        INSERT INTO team_member_tags (team_id, user_id, tag_id)
        VALUES (NEW.id, member_id::UUID, default_tag_id);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create the trigger
CREATE TRIGGER auto_assign_member_role
  AFTER UPDATE OF members ON teams
  FOR EACH ROW
  EXECUTE FUNCTION add_default_member_tag();

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION add_default_member_tag() TO authenticated;
GRANT EXECUTE ON FUNCTION add_default_member_tag() TO anon;

-- =====================================================
-- BONUS: Also handle new team creation (tag the owner)
-- =====================================================

CREATE OR REPLACE FUNCTION tag_team_owner_on_create()
RETURNS TRIGGER AS $$
DECLARE
  owner_tag_id BIGINT;
BEGIN
  -- Create an "Owner" tag for the new team
  INSERT INTO team_tags (team_id, tag_name, tag_color)
  VALUES (NEW.id, 'Owner', '#ef4444')
  RETURNING id INTO owner_tag_id;

  -- Also create a "Member" tag for future members
  INSERT INTO team_tags (team_id, tag_name, tag_color)
  VALUES (NEW.id, 'Member', '#6366f1');

  -- Assign the Owner tag to the team owner
  INSERT INTO team_member_tags (team_id, user_id, tag_id)
  VALUES (NEW.id, NEW.owner, owner_tag_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS auto_tag_team_owner ON teams;

CREATE TRIGGER auto_tag_team_owner
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION tag_team_owner_on_create();

-- Grant permissions
GRANT EXECUTE ON FUNCTION tag_team_owner_on_create() TO authenticated;
GRANT EXECUTE ON FUNCTION tag_team_owner_on_create() TO anon;

-- =====================================================
-- DONE! Now when:
-- 1. A team is created → Owner gets "Owner" tag (red)
-- 2. A member joins → They get "Member" tag (indigo)
-- =====================================================
