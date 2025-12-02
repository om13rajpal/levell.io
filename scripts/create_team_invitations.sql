-- =====================================================
-- TEAM SYSTEM SETUP
-- Run this in your Supabase SQL Editor
-- =====================================================

-- =====================================================
-- HELPER FUNCTION: Append member to team array
-- This is more reliable than client-side array manipulation
-- =====================================================

CREATE OR REPLACE FUNCTION append_team_member(team_id_input BIGINT, user_id_input UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE teams
  SET members = array_append(COALESCE(members, ARRAY[]::TEXT[]), user_id_input::TEXT)
  WHERE id = team_id_input
    AND NOT (user_id_input::TEXT = ANY(COALESCE(members, ARRAY[]::TEXT[])));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION append_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION append_team_member TO anon;

-- =====================================================
-- HELPER FUNCTION: Remove member from team array
-- =====================================================

CREATE OR REPLACE FUNCTION remove_team_member(team_id_input BIGINT, user_id_input UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE teams
  SET members = array_remove(members, user_id_input::TEXT)
  WHERE id = team_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION remove_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION remove_team_member TO anon;

-- =====================================================
-- First, check if teams table has correct members column type
-- The members column should be TEXT[] (array of UUIDs as text)
-- If your teams table doesn't exist or members isn't an array, run this:

-- ALTER TABLE teams ALTER COLUMN members TYPE TEXT[] USING members::TEXT[];

-- =====================================================
-- CREATE TEAM_INVITATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

-- =====================================================
-- DISABLE RLS FOR UNRESTRICTED ACCESS (as per user setup)
-- =====================================================

-- Since user mentioned all tables are unrestricted, disable RLS
ALTER TABLE team_invitations DISABLE ROW LEVEL SECURITY;

-- If you want to enable RLS later, uncomment below and create policies
-- ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- VERIFY TEAMS TABLE SETUP
-- =====================================================

-- Make sure teams table has correct structure
-- Run this to check: SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'teams';

-- The members column MUST be an array type (text[] or uuid[])
-- If it's not, the .contains() query won't work properly

-- To fix if members is wrong type:
-- ALTER TABLE teams ALTER COLUMN members TYPE TEXT[] USING COALESCE(members, ARRAY[]::TEXT[]);

-- =====================================================
-- GRANT PERMISSIONS (for authenticated users)
-- =====================================================

GRANT ALL ON team_invitations TO authenticated;
GRANT ALL ON team_invitations TO anon;
