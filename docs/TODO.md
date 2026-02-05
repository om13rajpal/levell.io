# Project Task List - Call Scoring & Multi-Team Implementation

**Project**: Canada (Level) Call Scoring SaaS
**Created**: 2026-02-05
**Last Updated**: 2026-02-05

---

## Phase 1: Database Schema Design (Priority: P0)

### Task 1.1: Create Global Team Roles Table (Ticket 7)
- [x] Create `team_roles` table with id (SERIAL), role_name, description, created_at
- [x] Seed with Admin, Sales Manager, Member roles
- [x] Add unique constraint on role_name
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: None

### Task 1.2: Create Internal Org Table (Ticket 3)
- [x] Create `internal_org` table for SaaS customer organizations
- [x] Columns: id (UUID), org_name, domain, fireflies_api_key, created_at, updated_at, active
- [x] Add indexes on org_name and domain
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: None

### Task 1.3: Add Internal Org Reference to Clients (Ticket 3)
- [x] Add `internal_org_id` (UUID, FK) column to existing clients table
- [x] Create foreign key constraint to internal_org.id
- [x] This links external clients/prospects to the SaaS customer org
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: Task 1.2

### Task 1.4: Create Teams Table (Ticket 6)
- [x] Update `teams` table with internal_org_id (FK)
- [x] Add updated_at, active columns
- [x] Create foreign key to internal_org
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: Task 1.2

### Task 1.5: Create Users Table (Ticket 1)
- [x] Update `users` table with internal_org_id, auth_user_id
- [x] Add updated_at, active columns
- [x] Team membership tracked via junction table
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: Task 1.2

### Task 1.6: Create Team Membership Junction Table (Ticket 8)
- [x] Create `team_org` junction table
- [x] Columns: id (UUID), team_id (FK), user_id (FK), team_role_id (FK), is_sales_manager, active
- [x] Add unique partial index: one active team per user
- [x] Add created_at, updated_at columns
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: Tasks 1.1, 1.4, 1.5

### Task 1.7: Create Prompt Store Table (Ticket 4)
- [x] Create `prompt_store` table with versioning support
- [x] Columns: id (UUID), type, version (INT), model, template, system_prompt, description, variables (JSONB)
- [x] Add created_at, updated_at, active columns
- [x] Create `create_prompt_version()` function for version management
- [x] Add composite index on (type, model, active)
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: None

### Task 1.8: Create Transcripts Table (Ticket 5)
- [x] Update `transcripts` table with company_id, internal_org_id
- [x] Add indexes for company and internal_org lookups
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: Task 1.3

### Task 1.9: Create Call Analysis Table (Ticket 5)
- [x] Create `call_analysis` table for AI analysis execution records
- [x] Include: user_id, internal_org_id, team_id, transcript_id (all FKs)
- [x] Add: model, prompt_id (FK), prompt_variables (JSONB)
- [x] Add: cost, execution_time_ms, input_tokens, output_tokens
- [x] Add: ai_score (0-100), ai_summary, ai_strengths (JSONB), ai_improvements (JSONB)
- [x] Add: ai_category_scores (JSONB), deal_signal (enum), call_type (enum)
- [x] Add: extraction_outputs (JSONB), status (enum), error_message
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: Tasks 1.2, 1.4, 1.5, 1.7, 1.8

### Task 1.10: Create Helper Functions
- [x] Create `update_updated_at_column()` trigger function
- [x] Apply trigger to all tables with updated_at column
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: All table tasks

---

## Phase 2: Role-Based Permissions (Ticket 9)

### Task 2.1: Define Permission Matrix
- [ ] Admin: Payment, invite Sales Managers, manage all roles, view all data
- [ ] Sales Manager: Invite members, manage own teams, view team analytics
- [ ] Member: Accept invitations, view own data, use AI chat features
- **Status**: Pending
- **Dependencies**: Phase 1

### Task 2.2: Implement Row-Level Security Policies
- [ ] Create RLS policies for team_roles (read-only for all)
- [ ] Create RLS policies for internal_org (org members only)
- [ ] Create RLS policies for team (team members + org admins)
- [ ] Create RLS policies for users (self + admins)
- [ ] Create RLS policies for team_org (self + managers + admins)
- [ ] Create RLS policies for prompt_store (org-based access)
- [ ] Create RLS policies for transcripts (team-based access)
- [ ] Create RLS policies for call_analysis (team-based access)
- **Status**: Pending
- **Dependencies**: Task 2.1

### Task 2.3: Create Permission Utility Functions
- [ ] Create `check_user_permission(user_id, permission)` function
- [ ] Create `get_user_role(user_id)` function
- [ ] Create `is_team_member(user_id, team_id)` function
- [ ] Create `is_org_admin(user_id, org_id)` function
- **Status**: Pending
- **Dependencies**: Task 2.2

---

## Phase 3: Fireflies Integration & API Development

### Task 3.1: Implement Fireflies API Client
- [x] Create `lib/services/fireflies-service.ts`
- [x] Implement GraphQL client for Fireflies API
- [x] Query: GetAllTranscripts with limit, skip, fromDate parameters
- [x] Query: GetTranscript for full details with sentences
- [x] Use Bearer token authentication
- [x] Add parallel transcript fetching with concurrency control
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: Phase 1

### Task 3.2: Create Fireflies Sync API Endpoints
- [x] POST `/api/fireflies/sync` - Sync transcripts from Fireflies to database
- [x] GET `/api/fireflies/sync` - Fetch transcripts list from Fireflies (preview)
- [x] Add validation with Zod schemas
- [x] Support: internalOrgId, limit, skip, daysBack parameters
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: Task 3.1

### Task 3.3: Implement Multi-Agent Call Scoring Service
- [x] 6 parallel extraction agents already exist in `lib/extraction-agents.ts`:
  - pain_points (weight: 0.20)
  - objections (weight: 0.15)
  - engagement (weight: 0.20)
  - next_steps (weight: 0.15)
  - call_structure (weight: 0.15)
  - rep_technique (weight: 0.15)
- [x] Uses `Promise.allSettled` for graceful parallel execution
- [x] Calculate weighted AI score (0-100)
- [x] Determine deal_signal: healthy, at_risk, critical
- [x] Track execution time and token usage
- **Status**: COMPLETED (pre-existing in codebase)
- **Dependencies**: Task 1.7, Task 1.9

### Task 3.4: Create Call Scoring API Endpoints
- [x] POST `/api/calls/score` - Trigger parallel scoring for multiple calls
- [x] GET `/api/calls/score` - SSE streaming for real-time progress updates
- [x] Each transcript gets its OWN Inngest workflow for TRUE parallelism
- [x] 10 calls = 10 parallel workflows running simultaneously
- [x] Updated `/api/score-batch` to use parallel scoring
- **Status**: COMPLETED (2026-02-05)
- **Dependencies**: Task 3.3

---

## Phase 4: Testing & Validation

### Task 4.1: Database Migration Testing
- [ ] Test all schema changes on development database
- [ ] Verify foreign key constraints work correctly
- [ ] Test RLS policies with different user roles
- [ ] Validate prompt versioning function
- **Status**: Pending
- **Dependencies**: Phase 1, Phase 2

### Task 4.2: API Integration Testing
- [ ] Test Fireflies sync with real API credentials
- [ ] Test call scoring with sample transcripts
- [ ] Verify parallel execution works correctly
- [ ] Test SSE streaming endpoint
- **Status**: Pending
- **Dependencies**: Phase 3

### Task 4.3: E2E Pipeline Testing
- [ ] Test full pipeline: Fireflies sync → Store → Score → Results
- [ ] Test with 10 real transcripts
- [ ] Measure latency and cost per analysis
- [ ] Validate scoring accuracy
- **Status**: Pending
- **Dependencies**: Tasks 4.1, 4.2

---

## Database Tables Summary

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `team_roles` | Global role reference (Admin, Sales Manager, Member) | Referenced by team_org |
| `internal_org` | SaaS customer organizations | Parent of team, users |
| `clients` | External prospects/customers | Belongs to internal_org |
| `team` | Teams within organizations | Belongs to internal_org |
| `users` | User profiles | Belongs to internal_org |
| `team_org` | User-team membership junction | Links users ↔ teams with roles |
| `prompt_store` | Versioned prompt templates | Referenced by call_analysis |
| `transcripts` | Call metadata from Fireflies | Belongs to external client |
| `call_analysis` | AI analysis execution records | Links user, org, team, transcript, prompt |

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/fireflies/sync` | POST | Sync transcripts from Fireflies to database |
| `/api/fireflies/sync` | GET | Fetch transcripts list from Fireflies |
| `/api/calls/score` | POST | Trigger parallel scoring for multiple calls |
| `/api/calls/score` | GET | SSE streaming for progress updates |

---

## Fireflies GraphQL Query Reference

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

**Endpoint**: `https://api.fireflies.ai/graphql`
**Auth**: Bearer token in Authorization header

---

## Notes

- Use Supabase MCP for all database operations
- Commit after each task completion
- All tables should have `created_at` and `updated_at` timestamps
- Use UUIDs for primary keys (except team and team_roles which use SERIAL)
- Enable RLS on all tables after initial development
