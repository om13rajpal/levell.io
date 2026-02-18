-- Migration: 003_multi_tenant_schema.sql
-- Description: Multi-tenant organization structure with team roles and call analysis tracking
-- Created: 2026-02-05

-- ============================================
-- Task 1.1: Create Global Team Roles Table
-- ============================================
CREATE TABLE IF NOT EXISTS team_roles (
    id SERIAL PRIMARY KEY,
    role_name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed with the 3 standard roles
INSERT INTO team_roles (id, role_name, description) VALUES
(1, 'Admin', 'Full access: payments, invites, all data'),
(2, 'Sales Manager', 'Team management, invite members, view team analytics'),
(3, 'Member', 'Basic access: own data, AI chat, scoring')
ON CONFLICT (role_name) DO NOTHING;

SELECT setval('team_roles_id_seq', (SELECT MAX(id) FROM team_roles));

COMMENT ON TABLE team_roles IS 'Global role definitions for team membership (Admin, Sales Manager, Member)';

-- ============================================
-- Task 1.2: Create Internal Org Table (SaaS customers)
-- ============================================
CREATE TABLE IF NOT EXISTS internal_org (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name TEXT NOT NULL,
    domain TEXT,
    fireflies_api_key TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_internal_org_name ON internal_org(org_name);
CREATE INDEX IF NOT EXISTS idx_internal_org_domain ON internal_org(domain);
CREATE INDEX IF NOT EXISTS idx_internal_org_active ON internal_org(active);

COMMENT ON TABLE internal_org IS 'SaaS customer organizations (the companies paying for the platform)';
COMMENT ON COLUMN internal_org.fireflies_api_key IS 'Fireflies API key for this organization (encrypted in production)';

-- ============================================
-- Task 1.3: Add Internal Org Reference to Companies
-- ============================================
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS internal_org_id UUID REFERENCES internal_org(id);

CREATE INDEX IF NOT EXISTS idx_companies_internal_org ON companies(internal_org_id);

COMMENT ON COLUMN companies.internal_org_id IS 'Links this prospect/client to the SaaS customer organization';

-- ============================================
-- Task 1.4: Update Teams Table
-- ============================================
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS internal_org_id UUID REFERENCES internal_org(id);

ALTER TABLE teams
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE teams
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_teams_internal_org ON teams(internal_org_id);

COMMENT ON COLUMN teams.internal_org_id IS 'The SaaS customer organization this team belongs to';

-- ============================================
-- Task 1.5: Update Users Table
-- ============================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS internal_org_id UUID REFERENCES internal_org(id);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_users_internal_org ON users(internal_org_id);

COMMENT ON COLUMN users.internal_org_id IS 'The SaaS customer organization this user belongs to';
COMMENT ON COLUMN users.auth_user_id IS 'Links to Supabase Auth user ID';

-- ============================================
-- Task 1.6: Create Team Membership Junction Table
-- ============================================
CREATE TABLE IF NOT EXISTS team_org (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id BIGINT NOT NULL REFERENCES teams(id),
    user_id UUID NOT NULL REFERENCES users(id),
    team_role_id INTEGER NOT NULL REFERENCES team_roles(id),
    is_sales_manager BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    active BOOLEAN DEFAULT true
);

-- CRITICAL: Enforce single active team per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_org_user_single_team
ON team_org(user_id)
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_team_org_team ON team_org(team_id);
CREATE INDEX IF NOT EXISTS idx_team_org_user ON team_org(user_id);
CREATE INDEX IF NOT EXISTS idx_team_org_role ON team_org(team_role_id);

COMMENT ON TABLE team_org IS 'Junction table linking users to teams with role assignment';
COMMENT ON COLUMN team_org.is_sales_manager IS 'Whether this user is the Sales Manager of the team';

-- ============================================
-- Task 1.7: Create Prompt Store Table
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    model TEXT NOT NULL,
    template TEXT NOT NULL,
    system_prompt TEXT,
    description TEXT,
    variables JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_prompt_store_type_model_active
ON prompt_store(type, model, active);

CREATE OR REPLACE FUNCTION create_prompt_version(
    p_type TEXT,
    p_model TEXT,
    p_template TEXT,
    p_system_prompt TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_variables JSONB DEFAULT '[]'
) RETURNS UUID AS $$
DECLARE
    v_new_version INTEGER;
    v_new_id UUID;
BEGIN
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
    FROM prompt_store WHERE type = p_type AND model = p_model;

    UPDATE prompt_store SET active = false, updated_at = now()
    WHERE type = p_type AND model = p_model AND active = true;

    INSERT INTO prompt_store (type, version, model, template, system_prompt, description, variables)
    VALUES (p_type, v_new_version, p_model, p_template, p_system_prompt, p_description, p_variables)
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE prompt_store IS 'Versioned prompt templates for AI agents';
COMMENT ON FUNCTION create_prompt_version IS 'Creates new prompt version and deactivates previous versions';

-- ============================================
-- Task 1.8: Update Transcripts Table
-- ============================================
ALTER TABLE transcripts
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

ALTER TABLE transcripts
ADD COLUMN IF NOT EXISTS internal_org_id UUID REFERENCES internal_org(id);

CREATE INDEX IF NOT EXISTS idx_transcripts_company ON transcripts(company_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_internal_org ON transcripts(internal_org_id);

COMMENT ON COLUMN transcripts.company_id IS 'The prospect/client company this call is associated with';
COMMENT ON COLUMN transcripts.internal_org_id IS 'The SaaS customer organization for multi-tenant access';

-- ============================================
-- Task 1.9: Create Call Analysis Table
-- ============================================
CREATE TABLE IF NOT EXISTS call_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    internal_org_id UUID NOT NULL REFERENCES internal_org(id),
    team_id BIGINT NOT NULL REFERENCES teams(id),
    transcript_id BIGINT NOT NULL REFERENCES transcripts(id),
    model TEXT NOT NULL,
    prompt_id UUID REFERENCES prompt_store(id),
    prompt_variables JSONB DEFAULT '{}',
    cost DECIMAL,
    execution_time_ms INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
    ai_summary TEXT,
    ai_strengths JSONB DEFAULT '[]',
    ai_improvements JSONB DEFAULT '[]',
    ai_category_scores JSONB DEFAULT '{}',
    deal_signal TEXT CHECK (deal_signal IN ('healthy', 'at_risk', 'critical')),
    call_type TEXT CHECK (call_type IN ('discovery', 'followup', 'demo', 'closing', 'other')),
    extraction_outputs JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_analysis_user ON call_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_call_analysis_transcript ON call_analysis(transcript_id);
CREATE INDEX IF NOT EXISTS idx_call_analysis_org ON call_analysis(internal_org_id);
CREATE INDEX IF NOT EXISTS idx_call_analysis_team ON call_analysis(team_id);
CREATE INDEX IF NOT EXISTS idx_call_analysis_status ON call_analysis(status);
CREATE INDEX IF NOT EXISTS idx_call_analysis_created ON call_analysis(created_at DESC);

COMMENT ON TABLE call_analysis IS 'Tracks every AI analysis execution with inputs, outputs, and costs';
COMMENT ON COLUMN call_analysis.extraction_outputs IS 'Full raw output from all 6 extraction agents';
COMMENT ON COLUMN call_analysis.ai_category_scores IS 'Individual scores: pain_points, objections, engagement, next_steps, call_structure, rep_technique';

-- ============================================
-- Task 1.10: Create Helper Functions
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_internal_org_updated_at ON internal_org;
CREATE TRIGGER update_internal_org_updated_at
    BEFORE UPDATE ON internal_org
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_team_org_updated_at ON team_org;
CREATE TRIGGER update_team_org_updated_at
    BEFORE UPDATE ON team_org
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prompt_store_updated_at ON prompt_store;
CREATE TRIGGER update_prompt_store_updated_at
    BEFORE UPDATE ON prompt_store
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at timestamp on row modifications';
