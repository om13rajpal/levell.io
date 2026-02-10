# Implementation Tickets

**Project**: Levvl (tuzuwzglmyajuxytaowi)
**Database**: PostgreSQL 17.6 on Supabase (ap-northeast-1)
**Last Updated**: 2026-02-06

---

## Ticket 1: Multi-Team Support per Internal Organization

**Title**: Add multi-team support with internal_org scoping

**Description**: Implement functionality to allow multiple teams per internal organization. Each team is owned by a Sales Manager who manages multiple users. Users belong to one team at a time.

**Requirements**:
- Allow multiple `team_id` per `internal_org_id`
- Each team (`team_id`) is owned by a Sales Manager who manages multiple users
- Remove `team_id` field from `users` table (team membership only tracked in `team_org` junction table)
- Users can only belong to one team at a time (enforced via unique constraint)
- Sales Managers can move members between teams within their organization
- Add `active` (boolean) field to both team and user tables
- Implement soft delete for teams (set `active = false` instead of deleting records)

**Acceptance Criteria**:
- [x] Multiple teams can exist per internal organization (`teams.internal_org_id` FK exists)
- [x] Each team has one Sales Manager owner (tracked via `team_org.is_sales_manager`)
- [ ] `team_id` removed from `users` table (STILL EXISTS - needs migration)
- [x] Team membership stored in `team_org` junction table (table exists)
- [ ] Unique constraint on `team_org(team_id, user_id)` prevents duplicates (NEEDS VERIFICATION)
- [ ] Sales Managers can transfer members between teams (code implementation needed)
- [x] Active flag on `teams` table (`active` column exists)
- [x] Active flag on `users` table (`active` column exists)

**DB Status**: Partially done. `team_org` table created. `users.team_id` still exists and needs removal.

---

## Ticket 2: Simplify Role Structure

**Title**: Streamline role naming conventions across platform

**Description**: Simplify the role structure to match platform UI while maintaining flexibility.

**Requirements**:
- Map existing roles to standardized platform roles:
  - **Admin** (whoever first creates account for internal_org)
  - **Sales Manager** (combined AE/BD senior roles)
  - **Member** (standard team member)
- Update UI and database to reflect unified naming
- Ensure Supabase schema aligns with platform UI terminology

**Acceptance Criteria**:
- [x] `team_roles` table created with 3 roles (Admin, Sales Manager, Member)
- [ ] Role names consistent between database and UI (code update needed)
- [ ] Existing user roles properly migrated to new structure

**DB Status**: Done. `team_roles` table exists with 3 rows.

---

## Ticket 3: Rename Company Tables to Org Nomenclature

**Title**: Refactor company tables to internal_org and external_org

**Description**: Rename company-related tables for clearer distinction between internal organizations (customers) and external organizations (their customers).

**Requirements**:
- Rename `companies` table -> `external_org`
- Rename `company` table -> `internal_org` (ALREADY DONE)
- Rename `company_calls` table -> `external_org_calls`
- Rename `company_icp` table -> `external_org_icp`
- Rename `company_recommendations` table -> `external_org_recommendations`
- Update all foreign key references across database if needed
- Update ALL code references to use new table names

**Acceptance Criteria**:
- [x] `company` -> `internal_org` (done, new table exists with FKs)
- [ ] `companies` -> `external_org` (NOT DONE - old table still exists)
- [ ] `company_calls` -> `external_org_calls` (NOT DONE)
- [ ] `company_icp` -> `external_org_icp` (NOT DONE)
- [ ] `company_recommendations` -> `external_org_recommendations` (NOT DONE)
- [ ] All code updated to use new table names

**DB Status**: Partially done. `internal_org` created. `companies`, `company_calls`, `company_icp`, `company_recommendations` NOT yet renamed.

---

## Ticket 4: Create Prompt Store Table

**Title**: Implement versioned prompt template storage system

**Description**: Create a prompt store table to track all master versions of prompts.

**Schema**:
```sql
CREATE TABLE prompt_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  model TEXT NOT NULL,
  template TEXT NOT NULL,
  system_prompt TEXT,
  description TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  active BOOLEAN DEFAULT true
);
```

**Acceptance Criteria**:
- [x] Table created with proper schema
- [x] Version increment logic (each update creates new row)
- [x] Active flag for toggling
- [x] FK from `call_analysis.prompt_id` -> `prompt_store.id`

**DB Status**: DONE. Table exists with correct schema.

---

## Ticket 5: Create Call Analysis Execution Table

**Title**: Implement call_analysis table for analysis run tracking

**Description**: Create dedicated table to store every call analysis execution.

**Current Schema** (live DB):
```
call_analysis:
  id UUID PK
  user_id UUID NOT NULL -> users.id
  internal_org_id UUID NOT NULL -> internal_org.id
  team_id BIGINT NOT NULL -> teams.id
  transcript_id BIGINT NOT NULL -> transcripts.id
  model TEXT NOT NULL
  prompt_id UUID -> prompt_store.id
  prompt_variables JSONB DEFAULT '{}'
  cost DECIMAL
  execution_time_ms INTEGER
  input_tokens INTEGER
  output_tokens INTEGER
  ai_score INTEGER (CHECK 0-100)
  ai_summary TEXT
  ai_strengths JSONB DEFAULT '[]'
  ai_improvements JSONB DEFAULT '[]'
  ai_category_scores JSONB DEFAULT '{}'
  deal_signal TEXT (CHECK: healthy, at_risk, critical)
  call_type TEXT (CHECK: discovery, followup, demo, closing, other)
  extraction_outputs JSONB DEFAULT '{}'
  status TEXT (CHECK: pending, processing, completed, failed)
  error_message TEXT
  created_at TIMESTAMPTZ
```

**Acceptance Criteria**:
- [x] Table created with proper foreign keys
- [x] AI fields stored separately from transcripts
- [x] Time and cost tracking implemented
- [ ] `deal_signal` CHECK needs update to include `strong`, `positive`
- [ ] `call_type` CHECK needs update to include `coaching`, `check_in`

**DB Status**: DONE (table exists). CHECK constraints need updating.

---

## Ticket 6: Redesign Teams Table Structure

**Title**: Refactor teams table with simplified ownership model

**Description**: Restructure teams table for clearer ownership and organization scoping.

**Requirements**:
- Use auto-increment id across all internal orgs (DONE - bigint identity)
- Remove `owner` field (move to `team_org` table) - NOT DONE
- Remove `members` array field - NOT DONE
- Make `team_name` directly updatable (DONE)
- Add `internal_org_id` foreign key (DONE)
- Add `active` flag (DONE)

**Acceptance Criteria**:
- [x] Team ownership tracked via `team_org.is_sales_manager`
- [ ] `teams.owner` column removed (STILL EXISTS)
- [ ] `teams.members` column removed (STILL EXISTS)
- [x] Auto-increment ID implemented
- [x] Active flag for soft deletes

**DB Status**: Partially done. `owner` and `members` columns need removal.

---

## Ticket 7: Redesign Team Tags as Global Team Roles

**Title**: Convert team_tags to global team_roles reference table

**Description**: Refactor team tags into a global team roles reference table.

**Schema** (live DB):
```
team_roles:
  id SERIAL PK
  role_name TEXT NOT NULL UNIQUE
  description TEXT
  created_at TIMESTAMPTZ
```

**Acceptance Criteria**:
- [x] `team_roles` table created with 3 roles
- [ ] Old `team_tags` table deprecated/removed (STILL EXISTS)
- [ ] Code updated to use `team_roles` instead of `team_tags`

**DB Status**: DONE (new table). Old `team_tags` still exists (6 rows).

---

## Ticket 8: Redesign Team Membership Junction Table

**Title**: Refactor team_member_tags to team_org relationship table

**Schema** (live DB):
```
team_org:
  id UUID PK
  team_id BIGINT NOT NULL -> teams.id
  user_id UUID NOT NULL -> users.id
  team_role_id INTEGER NOT NULL -> team_roles.id
  is_sales_manager BOOLEAN DEFAULT false
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
  active BOOLEAN DEFAULT true
```

**Acceptance Criteria**:
- [x] `team_org` table created with proper structure
- [x] FK to `team_roles` for role assignment
- [x] `is_sales_manager` flag for team admin tracking
- [ ] Old `team_member_tags` table deprecated/removed (STILL EXISTS)
- [ ] Unique constraint on `(team_id, user_id)` (NEEDS VERIFICATION)

**DB Status**: DONE (new table). Old `team_member_tags` still exists (7 rows).

---

## Ticket 9: Implement Role-Based Permissions System

**Title**: Define and enforce role-based permissions across platform

**Permission Matrix**:
- **Admin** (= "Owner"): Payment, invite Sales Managers, assign/unassign roles, all SM permissions
- **Sales Manager** (= "Admin"): Invite Members, manage team membership, create/deactivate teams, view team analytics
- **Member**: Accept invitations, view own call data, use AI chat

**Acceptance Criteria**:
- [ ] RLS policies implemented for each role
- [ ] API endpoints enforce permission checks
- [ ] UI conditionally renders features by role
- [ ] Permission utility functions created (`lib/permissions.ts`)

**DB Status**: N/A (code-only implementation). `lib/permissions.ts` may exist from previous work.

---

## Summary: What Needs to Be Done

### Database Migrations Required:
1. **Rename `companies` -> `external_org`** (Ticket 3)
2. **Rename `company_calls` -> `external_org_calls`** (Ticket 3)
3. **Rename `company_icp` -> `external_org_icp`** (Ticket 3)
4. **Rename `company_recommendations` -> `external_org_recommendations`** (Ticket 3)
5. **Drop `users.team_id`** column and FK (Ticket 1)
6. **Drop `teams.owner`** column and FK (Ticket 6)
7. **Drop `teams.members`** column (Ticket 6)
8. **Update `call_analysis.deal_signal`** CHECK to add `strong`, `positive` (Ticket 5)
9. **Update `call_analysis.call_type`** CHECK to add `coaching`, `check_in` (Ticket 5)
10. **Add unique constraint** on `team_org(team_id, user_id)` if missing (Ticket 8)

### Code Updates Required:
1. **All `companies` -> `external_org`** references across entire codebase
2. **All `company_calls` -> `external_org_calls`** references
3. **All `company_icp` -> `external_org_icp`** references
4. **All `company_recommendations` -> `external_org_recommendations`** references
5. **Remove `safeDealSignal()` mapper** (no longer needed after CHECK update)
6. **Remove `safeCallType()` mapper** (no longer needed after CHECK update)
7. **Update `lib/permissions.ts`** with role-based permission checks
8. **Remove any `users.team_id`** references from code
9. **Remove any `teams.owner`** / `teams.members` references from code
10. **Ensure `team_org`** used everywhere (not `team_member_tags` or `team_members`)
11. **Ensure `team_roles`** used where needed (not `team_tags` for role lookups)
