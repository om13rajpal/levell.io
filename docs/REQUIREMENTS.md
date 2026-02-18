# Call Scoring System - Detailed Requirements

**Project**: Canada (Level) Call Scoring SaaS
**Version**: 1.0
**Created**: 2026-02-05

---

## Table of Contents
1. [Overview](#overview)
2. [Ticket Details](#ticket-details)
3. [Database Schema Specifications](#database-schema-specifications)
4. [API Specifications](#api-specifications)
5. [Service Implementation Details](#service-implementation-details)
6. [Fireflies Integration](#fireflies-integration)

---

## Overview

### Business Context
Build a multi-tenant call scoring SaaS platform that:
- Integrates with Fireflies.ai to fetch call transcripts
- Runs parallel AI analysis on calls using multiple extraction agents
- Supports multi-team organization structure with role-based access
- Tracks all analysis executions with full audit trail

### Key Requirements
1. **Multi-Team Support**: Users belong to exactly ONE team at a time
2. **Role Structure**: Admin → Sales Manager → Member hierarchy
3. **Parallel Processing**: Score 10 calls simultaneously with 6 agents each running in parallel
4. **Fireflies Integration**: Fetch transcripts via GraphQL API

---

## Ticket Details

### Ticket 1: Multi-Team Support
**Priority**: P0

**Requirements**:
- Users can only belong to ONE team at a time (not multiple)
- Team membership tracked via junction table with unique constraint
- When user switches teams, previous membership marked inactive
- Single active team per user enforced at database level

**Implementation**:
```sql
-- Unique partial index ensuring single active team per user
CREATE UNIQUE INDEX idx_team_org_user_single_team
ON team_org(user_id)
WHERE active = true;
```

---

### Ticket 2: Simplified Role Structure
**Priority**: P0

**Roles**:
| Role | ID | Capabilities |
|------|-----|--------------|
| **Admin** | 1 | Payment management, invite Sales Managers, manage all roles, view all org data, delete workspace |
| **Sales Manager** | 2 | Invite members to team, manage team settings, view team analytics, assign calls |
| **Member** | 3 | Accept invitations, view own data, use AI chat, score assigned calls |

**Notes**:
- Roles are global (same across all organizations)
- Stored in `team_roles` reference table
- Role assignment is per team membership (in `team_org`)

---

### Ticket 3: Organization Nomenclature
**Priority**: P0

**Terminology**:
| Term | Table | Description |
|------|-------|-------------|
| **Internal Org** | `internal_org` | Our SaaS customers (the companies paying for the platform) |
| **External Org** | `clients` | The prospects/customers that internal orgs are tracking calls with |

**Relationship**:
```
internal_org (SaaS Customer)
    └── teams (Sales teams within the org)
    └── users (Employees of the SaaS customer)
    └── clients (Prospects they're selling to)
        └── transcripts (Calls with those prospects)
```

---

### Ticket 4: Prompt Store with Versioning
**Priority**: P1

**Requirements**:
- Store prompt templates with version history
- Each update creates NEW row with incremented version
- Never modify existing versions (immutable)
- Track which model each prompt is designed for

**Schema**:
```sql
CREATE TABLE prompt_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,           -- 'pain_points', 'objections', etc.
    version INTEGER NOT NULL DEFAULT 1,
    model TEXT NOT NULL,          -- 'gpt-4', 'claude-3', etc.
    template TEXT NOT NULL,       -- The actual prompt template
    system_prompt TEXT,           -- Optional system message
    description TEXT,             -- Human-readable description
    variables JSONB DEFAULT '[]', -- Expected variables: [{name, type, required}]
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    active BOOLEAN DEFAULT true
);

-- Versioning function
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
    -- Get next version number
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
    FROM prompt_store WHERE type = p_type AND model = p_model;

    -- Deactivate previous versions
    UPDATE prompt_store SET active = false
    WHERE type = p_type AND model = p_model AND active = true;

    -- Insert new version
    INSERT INTO prompt_store (type, version, model, template, system_prompt, description, variables)
    VALUES (p_type, v_new_version, p_model, p_template, p_system_prompt, p_description, p_variables)
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;
```

---

### Ticket 5: Call Analysis Execution Tracking
**Priority**: P0

**Requirements**:
- Track every AI analysis execution
- Link to: user, org, team, transcript, prompt used
- Store: model, cost, tokens, execution time
- Store: AI outputs (score, summary, strengths, improvements)
- Track deal health signals

**call_analysis Fields**:
```typescript
interface CallAnalysis {
    // Identity
    id: UUID;
    user_id: UUID;           // Who ran the analysis
    internal_org_id: UUID;   // Which org
    team_id: INTEGER;        // Which team
    transcript_id: UUID;     // Which call

    // Execution Context
    model: string;           // 'gpt-4-turbo', etc.
    prompt_id: UUID | null;  // Which prompt version used
    prompt_variables: JSONB; // Variables passed to prompt

    // Metrics
    cost: DECIMAL;           // USD cost
    execution_time_ms: INTEGER;
    input_tokens: INTEGER;
    output_tokens: INTEGER;

    // AI Outputs
    ai_score: INTEGER;       // 0-100 overall score
    ai_summary: TEXT;        // Executive summary
    ai_strengths: JSONB;     // ["Good rapport", "Clear pricing"]
    ai_improvements: JSONB;  // ["Ask more questions", "Handle objections"]
    ai_category_scores: JSONB; // {pain_points: 85, objections: 70, ...}

    // Deal Intelligence
    deal_signal: 'healthy' | 'at_risk' | 'critical';
    call_type: 'discovery' | 'followup' | 'demo' | 'closing' | 'other';

    // Raw Outputs
    extraction_outputs: JSONB; // Full output from each agent

    // Status
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error_message: TEXT | null;

    created_at: TIMESTAMPTZ;
}
```

---

### Ticket 6: Teams Table Redesign
**Priority**: P0

**Requirements**:
- Auto-increment integer ID (for simpler references)
- Team belongs to one internal_org
- Team name is updatable
- Soft delete via `active` flag

**Schema**:
```sql
CREATE TABLE team (
    id SERIAL PRIMARY KEY,
    team_name TEXT NOT NULL,
    internal_org_id UUID NOT NULL REFERENCES internal_org(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    active BOOLEAN DEFAULT true
);
```

---

### Ticket 7: Global Team Roles Table
**Priority**: P0

**Requirements**:
- Reference table for role definitions
- Same roles apply to ALL organizations
- Seeded with 3 roles on creation

**Schema & Seed**:
```sql
CREATE TABLE team_roles (
    id SERIAL PRIMARY KEY,
    role_name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed data
INSERT INTO team_roles (id, role_name, description) VALUES
(1, 'Admin', 'Full access: payments, invites, all data'),
(2, 'Sales Manager', 'Team management, invite members, view team analytics'),
(3, 'Member', 'Basic access: own data, AI chat, scoring');
```

---

### Ticket 8: Team Membership Junction Table
**Priority**: P0

**Requirements**:
- Links users to teams with role assignment
- Enforces single active team per user
- Tracks if user is the Sales Manager of the team

**Schema**:
```sql
CREATE TABLE team_org (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id INTEGER NOT NULL REFERENCES team(id),
    user_id UUID NOT NULL REFERENCES users(id),
    team_role_id INTEGER NOT NULL REFERENCES team_roles(id),
    is_sales_manager BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    active BOOLEAN DEFAULT true
);

-- CRITICAL: Enforce single active team per user
CREATE UNIQUE INDEX idx_team_org_user_single_team
ON team_org(user_id)
WHERE active = true;
```

---

### Ticket 9: Role-Based Permissions
**Priority**: P1

**Permission Matrix**:

| Action | Admin | Sales Manager | Member |
|--------|-------|---------------|--------|
| Manage billing/payments | ✅ | ❌ | ❌ |
| Invite Sales Managers | ✅ | ❌ | ❌ |
| Invite Members | ✅ | ✅ (own team) | ❌ |
| View all org data | ✅ | ❌ | ❌ |
| View team data | ✅ | ✅ (own team) | ❌ |
| View own data | ✅ | ✅ | ✅ |
| Score calls | ✅ | ✅ | ✅ |
| Use AI chat | ✅ | ✅ | ✅ |
| Manage team settings | ✅ | ✅ (own team) | ❌ |
| Delete workspace | ✅ | ❌ | ❌ |

**Implementation Options**:
1. Row-Level Security (RLS) policies in Supabase
2. Application-level checks in API routes
3. Hybrid approach (RLS + API validation)

---

## Database Schema Specifications

### Entity Relationship Diagram (Text)
```
┌─────────────────┐     ┌─────────────────┐
│  internal_org   │────<│      team       │
│  (SaaS customer)│     │  (Sales team)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │     ┌─────────────────┼─────────────────┐
         │     │                 │                 │
         ▼     ▼                 ▼                 │
┌─────────────────┐     ┌─────────────────┐       │
│     users       │────<│    team_org     │>──────┘
│  (Employees)    │     │ (Membership)    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │   team_roles    │
         │              │ (Admin/Mgr/Mbr) │
         │              └─────────────────┘
         │
         │     ┌─────────────────┐
         └────>│    clients      │
               │  (Prospects)    │
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐     ┌─────────────────┐
               │   transcripts   │────>│  call_analysis  │
               │  (Call data)    │     │  (AI results)   │
               └─────────────────┘     └────────┬────────┘
                                                │
                                                ▼
                                       ┌─────────────────┐
                                       │  prompt_store   │
                                       │  (Versioned)    │
                                       └─────────────────┘
```

### Full Migration SQL
```sql
-- 1. Create team_roles (global reference)
CREATE TABLE team_roles (
    id SERIAL PRIMARY KEY,
    role_name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO team_roles (id, role_name, description) VALUES
(1, 'Admin', 'Full access: payments, invites, all data'),
(2, 'Sales Manager', 'Team management, invite members, view team analytics'),
(3, 'Member', 'Basic access: own data, AI chat, scoring');

-- 2. Create internal_org (SaaS customers)
CREATE TABLE internal_org (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name TEXT NOT NULL,
    domain TEXT,
    fireflies_api_key TEXT,  -- Encrypted in production
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    active BOOLEAN DEFAULT true
);

-- 3. Add internal_org_id to clients
ALTER TABLE clients ADD COLUMN internal_org_id UUID REFERENCES internal_org(id);

-- 4. Create team
CREATE TABLE team (
    id SERIAL PRIMARY KEY,
    team_name TEXT NOT NULL,
    internal_org_id UUID NOT NULL REFERENCES internal_org(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    active BOOLEAN DEFAULT true
);

-- 5. Create users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,  -- Links to Supabase Auth
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    internal_org_id UUID REFERENCES internal_org(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    active BOOLEAN DEFAULT true
);

-- 6. Create team_org (junction)
CREATE TABLE team_org (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id INTEGER NOT NULL REFERENCES team(id),
    user_id UUID NOT NULL REFERENCES users(id),
    team_role_id INTEGER NOT NULL REFERENCES team_roles(id),
    is_sales_manager BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    active BOOLEAN DEFAULT true
);

CREATE UNIQUE INDEX idx_team_org_user_single_team ON team_org(user_id) WHERE active = true;

-- 7. Create prompt_store
CREATE TABLE prompt_store (
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

CREATE INDEX idx_prompt_store_type_model_active ON prompt_store(type, model, active);

-- 8. Create transcripts
CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fireflies_id TEXT UNIQUE,
    title TEXT,
    duration INTEGER,  -- seconds
    call_date TIMESTAMPTZ,
    external_org_id UUID REFERENCES clients(id),
    attendees JSONB DEFAULT '[]',
    transcript_text TEXT,
    audio_url TEXT,
    video_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Create call_analysis
CREATE TABLE call_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    internal_org_id UUID NOT NULL REFERENCES internal_org(id),
    team_id INTEGER NOT NULL REFERENCES team(id),
    transcript_id UUID NOT NULL REFERENCES transcripts(id),

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

-- 10. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_internal_org_updated_at BEFORE UPDATE ON internal_org
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_updated_at BEFORE UPDATE ON team
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_org_updated_at BEFORE UPDATE ON team_org
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prompt_store_updated_at BEFORE UPDATE ON prompt_store
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transcripts_updated_at BEFORE UPDATE ON transcripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## API Specifications

### POST /api/fireflies/sync
Sync transcripts from Fireflies to database.

**Request**:
```typescript
{
    apiKey: string;           // Fireflies API key
    internalOrgId: string;    // UUID of the org
    limit?: number;           // Max 100, default 50
    skip?: number;            // Pagination offset
    daysBack?: number;        // Max 365, default 60
}
```

**Response**:
```typescript
{
    success: true;
    data: {
        synced: number;
        errors: number;
        transcriptIds: string[];
        message: string;
    }
}
```

### POST /api/calls/score
Trigger parallel scoring for multiple calls.

**Request**:
```typescript
{
    transcriptIds: string[];  // UUIDs, max 50
    userId: string;           // Who is running this
    internalOrgId: string;
    teamId: number;
    concurrency?: number;     // 1-10, default 5
}
```

**Response**:
```typescript
{
    success: true;
    data: {
        total: number;
        successful: number;
        failed: number;
        results: Array<{
            transcriptId: string;
            analysisId: string;
            success: boolean;
            aiScore?: number;
            dealSignal?: string;
            executionTimeMs?: number;
            error?: string;
        }>;
    }
}
```

### GET /api/calls/score (SSE)
Stream progress updates during scoring.

**Query Params**:
- `transcriptIds`: Comma-separated UUIDs
- `userId`: UUID
- `internalOrgId`: UUID
- `teamId`: number

**SSE Events**:
```typescript
// Progress update
data: {"transcriptId": "...", "status": "processing", "progress": 50}

// Completion
data: {"transcriptId": "...", "status": "completed", "aiScore": 85}

// Done
data: {"done": true}
```

---

## Service Implementation Details

### Fireflies Service
**File**: `lib/services/fireflies-service.ts`

```typescript
export class FirefliesService {
    constructor(apiKey: string, supabase: SupabaseClient) {}

    // Fetch list of transcripts
    async fetchTranscriptsList(options: {
        limit?: number;
        skip?: number;
        fromDate?: Date;
    }): Promise<FirefliesTranscript[]>

    // Fetch single transcript with full text
    async fetchTranscriptDetail(transcriptId: string): Promise<FirefliesTranscriptDetail>

    // Fetch multiple transcripts in parallel
    async fetchTranscriptsParallel(
        transcriptIds: string[],
        concurrency?: number
    ): Promise<TranscriptFetchResult[]>

    // Sync to database
    async syncTranscriptsToDatabase(
        internalOrgId: string,
        options?: FetchTranscriptsOptions
    ): Promise<{synced: number; errors: number; transcriptIds: string[]}>
}
```

### Call Scoring Service
**File**: `lib/services/call-scoring-service.ts`

```typescript
// Extraction agents with weights
const EXTRACTION_AGENTS = [
    { name: "pain_points", weight: 0.20 },
    { name: "objections", weight: 0.15 },
    { name: "engagement", weight: 0.20 },
    { name: "next_steps", weight: 0.15 },
    { name: "call_structure", weight: 0.15 },
    { name: "rep_technique", weight: 0.15 },
];

export class CallScoringService {
    constructor(supabase: SupabaseClient) {}

    // Score a single call (runs 6 agents in parallel)
    async scoreCall(request: CallScoringRequest): Promise<CallScoringResult>

    // Score multiple calls with concurrency control
    async scoreCallsBatch(
        requests: CallScoringRequest[],
        concurrency?: number,
        onProgress?: ProgressCallback
    ): Promise<CallScoringResult[]>
}

// Uses Promise.allSettled for graceful failure handling
// Each agent failure doesn't stop other agents
// Partial results are still saved
```

---

## Fireflies Integration

### GraphQL Endpoint
```
URL: https://api.fireflies.ai/graphql
Auth: Bearer <API_KEY>
```

### Query: Get All Transcripts
```graphql
query GetAllTranscripts($limit: Int, $skip: Int, $fromDate: DateTime) {
    transcripts(limit: $limit, skip: $skip, fromDate: $fromDate) {
        id
        title
        duration
        dateTime
        attendees {
            name
            email
        }
        transcript_text
        audio_url
        video_url
    }
}
```

### Example Request
```typescript
const response = await fetch('https://api.fireflies.ai/graphql', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
        query: GET_ALL_TRANSCRIPTS,
        variables: {
            limit: 50,
            skip: 0,
            fromDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        },
    }),
});
```

---

## Implementation Notes

1. **Use Supabase MCP** for all database operations
2. **Commit after each task** completion
3. **Use `Promise.allSettled`** for parallel operations that should continue on failure
4. **Create junction tables** for many-to-many relationships with unique constraints
5. **Use SERIAL** for auto-increment IDs, UUID for entity IDs
6. **Add `active` boolean** for soft deletes
7. **Enable RLS** on all tables after initial development
8. **Create `update_updated_at_column()`** trigger function once, reuse for all tables
