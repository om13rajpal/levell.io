# Database Schema vs Codebase Audit Report

**Date**: 2026-02-06
**Audited by**: 4 parallel research agents + Supabase MCP schema verification
**Project**: Levvl (tuzuwzglmyajuxytaowi)
**Database**: PostgreSQL 17.6 on Supabase

---

## Executive Summary

A comprehensive audit of every Supabase query in the codebase against the live database schema revealed **52 critical issues** and **8 medium issues**. The root cause is a previous code refactor that renamed table references (`companies` -> `external_org`) without applying a corresponding database migration. This means **the entire application is broken at runtime** - every page, API route, and background job that queries company data will fail.

---

## Issue Categories

### CATEGORY 1: Wrong Table Names (CRITICAL) — 46 occurrences

The codebase references tables that do not exist in the database. A previous refactor renamed:
- `companies` -> `external_org` (in code only)
- `company_calls` -> `external_org_calls` (in code only)
- `company_icp` -> `external_org_icp` (in code only)
- `company_recommendations` -> `external_org_recommendations` (in code only)

The database was **never migrated** — original table names still exist.

#### Fix: Revert code back to original DB table names

| # | File | Line(s) | Wrong Reference | Correct Table |
|---|------|---------|-----------------|---------------|
| 1 | `lib/context-loader.ts` | 43 | `external_org_calls` | `company_calls` |
| 2 | `lib/context-loader.ts` | 100 | `external_org` | `companies` |
| 3 | `lib/context-loader.ts` | 226 | `external_org_calls` | `company_calls` |
| 4 | `lib/context-loader.ts` | 332 | `external_org_icp` | `company_icp` |
| 5 | `lib/inngest-functions.ts` | ~351 | `external_org_calls` | `company_calls` |
| 6 | `lib/inngest-functions.ts` | ~362 | `external_org` | `companies` |
| 7 | `lib/inngest-functions.ts` | ~378 | `external_org` | `companies` |
| 8 | `lib/inngest-functions.ts` | ~402 | `external_org_calls` | `company_calls` |
| 9 | `lib/inngest-functions.ts` | ~434 | `external_org_calls` | `company_calls` |
| 10 | `lib/inngest-functions.ts` | ~520 | `external_org_recommendations` | `company_recommendations` |
| 11 | `lib/inngest-functions.ts` | ~767 | `external_org_icp` | `company_icp` |
| 12 | `lib/inngest-functions.ts` | ~793 | `external_org_icp` | `company_icp` |
| 13 | `lib/inngest-functions.ts` | ~851 | `external_org_icp` | `company_icp` |
| 14 | `lib/inngest-functions.ts` | ~898 | `external_org_icp` | `company_icp` |
| 15 | `lib/supabaseCache.ts` | ~500 | `external_org` | `companies` |
| 16 | `lib/supabaseCache.ts` | ~554 | `external_org` | `companies` |
| 17 | `lib/supabaseCache.ts` | ~903 | `external_org` | `companies` |
| 18 | `lib/supabaseCache.ts` | ~911 | `external_org` | `companies` |
| 19 | `lib/supabaseCache.ts` | ~925 | `external_org_calls` | `company_calls` |
| 20 | `lib/supabaseCache.ts` | ~933 | `external_org_calls` | `company_calls` |
| 21 | `lib/supabaseCache.ts` | ~957 | `external_org_calls` | `company_calls` |
| 22 | `lib/embeddings.ts` | ~353 | `external_org` | `companies` |
| 23 | `app/agent/page.tsx` | ~298 | `external_org` | `companies` |
| 24 | `app/calls/page.tsx` | ~382 | `external_org_calls` | `company_calls` |
| 25 | `app/companies/page.tsx` | ~332 | `external_org_calls` | `company_calls` |
| 26 | `app/companies/page.tsx` | ~534 | `external_org` | `companies` |
| 27 | `app/companies/page.tsx` | ~610 | `external_org` | `companies` |
| 28 | `app/companies/page.tsx` | ~626 | `external_org` | `companies` |
| 29 | `app/companies/page.tsx` | ~670 | `external_org_calls` | `company_calls` |
| 30 | `app/companies/page.tsx` | ~678 | `external_org_calls` | `company_calls` |
| 31 | `app/companies/page.tsx` | ~701 | `external_org` | `companies` |
| 32 | `app/companies/[id]/page.tsx` | ~268 | `external_org_calls` | `company_calls` |
| 33 | `app/companies/[id]/page.tsx` | ~276 | `external_org_calls` | `company_calls` |
| 34 | `app/companies/[id]/page.tsx` | ~299 | `external_org` | `companies` |
| 35 | `app/companies/[id]/page.tsx` | ~332 | `external_org` | `companies` |
| 36 | `app/companies/[id]/page.tsx` | ~333 | `external_org_calls` | `company_calls` |
| 37 | `app/team/analytics/page.tsx` | ~185 | `external_org` | `companies` |
| 38 | `app/team/analytics/page.tsx` | ~191 | `external_org_calls` | `company_calls` |
| 39 | `app/api/agent/route.ts` | ~280 | `external_org` | `companies` |
| 40 | `app/api/agent/route.ts` | ~357 | `external_org_calls` | `company_calls` |
| 41 | `app/api/agent/route.ts` | ~647 | `external_org` | `companies` |
| 42 | `app/api/agent/route.ts` | ~656 | `external_org_calls` | `company_calls` |
| 43 | `app/api/agent/route.ts` | ~701 | `external_org` | `companies` |
| 44 | `app/api/agent/route.ts` | ~756 | `external_org_calls` | `company_calls` |
| 45 | `app/api/recommendations/cluster/route.ts` | ~107 | `external_org_recommendations` | `company_recommendations` |
| 46 | `app/api/recommendations/cluster/route.ts` | ~126 | `external_org_recommendations` | `company_recommendations` |

---

### CATEGORY 2: Wrong Column Names in Joins (CRITICAL) — 4 occurrences

| # | File | Line | Wrong Reference | Correct Column | Impact |
|---|------|------|-----------------|----------------|--------|
| 47 | `lib/analysis-pipeline.ts` | 122 | `teams(name)` in select | `teams(team_name)` | Team/company name always null |
| 48 | `lib/analysis-pipeline.ts` | 131 | `teamData?.teams?.name` | `teamData?.teams?.team_name` | Rep company always empty string |
| 49 | `lib/supabaseCache.ts` | ~557 | `.order('name')` on companies | `.order('company_name')` | Sort fails or is ignored |
| 50 | `lib/supabaseCache.ts` | ~556 | `.eq('user_id', userId)` on companies | N/A - `companies` has no `user_id` | Query returns nothing |

---

### CATEGORY 3: Non-Existent Tables in supabaseCache.ts (CRITICAL) — 2 occurrences

| # | File | Line | Wrong Table | Correct Table |
|---|------|------|-------------|---------------|
| 51 | `lib/supabaseCache.ts` | ~600 | `team_members` | `team_org` |
| 52 | `lib/supabaseCache.ts` | ~623 | `calls` | Needs investigation (likely `company_calls` or direct `transcripts` query) |

---

### CATEGORY 4: Missing Columns on `call_analysis` (CRITICAL) — 3 columns

The `call_analysis` table does NOT have these columns that the pipeline writes to:

| Column Written | Exists? | Impact |
|---|---|---|
| `ai_score_reason` | NO | Insert fails silently (non-fatal) |
| `ai_call_type` | NO | Insert fails silently (should be `call_type`) |
| `ai_the_one_thing` | NO | Insert fails silently |

**Result**: Every `call_analysis` insert fails. No analysis records are ever created.

---

### CATEGORY 5: CHECK Constraint Violations (CRITICAL) — 1 issue

| Table | Column | Allowed Values | Code Produces |
|---|---|---|---|
| `call_analysis` | `deal_signal` | `healthy`, `at_risk`, `critical` | Also `strong`, `positive` |

**Current mitigation**: `safeDealSignal()` mapper added in previous fix session. Works until migration 005 is applied.

---

### CATEGORY 6: Type Mismatches (MEDIUM) — 3 columns

The `users` table has these columns as **JSONB**, but the code treats them as **TEXT/string**:

| Column | DB Type | Code Type | Impact |
|---|---|---|---|
| `users.focus_areas` | `jsonb` | `string \| null` | Renders as `[object Object]` in prompts |
| `users.key_strengths` | `jsonb` | `string \| null` | Renders as `[object Object]` in prompts |
| `users.ai_recommendations` | `jsonb` | `string \| null` | Renders as `[object Object]` in prompts |

---

### CATEGORY 7: Wrong Column Name Mapping (MEDIUM) — 2 issues

| # | File | Line | Issue |
|---|------|------|-------|
| 53 | `lib/analysis-pipeline.ts` | ~247 | Writes `ai_call_type` to `call_analysis` but column name is `call_type` |
| 54 | `types/extraction-outputs.ts` | ~322 | `CallTypeSchema` missing `"other"` value that DB CHECK allows |

---

### CATEGORY 8: Nonexistent Column on users (MEDIUM) — 1 issue

| # | File | Line | Issue |
|---|------|------|-------|
| 55 | `app/business/page.tsx` | ~234,422 | References `users.business_profile` column — does not exist |

---

## Database Migration Needed

### Migration 005 (update from previous session) needs revision:

**Remove** (already exist):
- `transcripts.ai_score_reason` — ALREADY EXISTS
- `transcripts.ai_call_type` — ALREADY EXISTS
- `transcripts.ai_improvement_areas` — ALREADY EXISTS
- `transcripts.ai_the_one_thing` — ALREADY EXISTS
- `transcripts.ai_coaching_notes` — ALREADY EXISTS
- `transcripts.ai_deal_signal_reason` — ALREADY EXISTS
- `users.focus_areas` — ALREADY EXISTS (as JSONB)
- `users.key_strengths` — ALREADY EXISTS (as JSONB)
- `users.ai_recommendations` — ALREADY EXISTS (as JSONB)

**Keep** (still needed):
- `call_analysis.ai_score_reason` (TEXT)
- `call_analysis.ai_the_one_thing` (JSONB)
- Update `call_analysis.deal_signal` CHECK constraint to add `strong`, `positive`

**Change**:
- Code should write to existing `call_analysis.call_type` instead of non-existent `ai_call_type`

---

## Fix Plan

### Agent 1: Revert table names in lib/ files
Files: `context-loader.ts`, `inngest-functions.ts`, `supabaseCache.ts`, `embeddings.ts`, `analysis-pipeline.ts`
- `external_org` -> `companies`
- `external_org_calls` -> `company_calls`
- `external_org_icp` -> `company_icp`
- `external_org_recommendations` -> `company_recommendations`
- Fix `teams(name)` -> `teams(team_name)`
- Fix `team_members` -> `team_org`
- Fix `calls` table reference
- Fix `companies` column refs (`user_id`, `name`)

### Agent 2: Revert table names in app/ files
Files: `agent/page.tsx`, `calls/page.tsx`, `companies/page.tsx`, `companies/[id]/page.tsx`, `team/analytics/page.tsx`, `api/agent/route.ts`, `api/recommendations/cluster/route.ts`
- Same table name reversions

### Agent 3: Fix call_analysis column issues + JSONB type handling
Files: `analysis-pipeline.ts`, `context-loader.ts`, `types/extraction-outputs.ts`
- Remove non-existent columns from `call_analysis` insert
- Map `ai_call_type` -> `call_type`
- Fix JSONB-to-string handling for `focus_areas`, `key_strengths`, `ai_recommendations`
- Add `"other"` to CallTypeSchema

### Agent 4: Rewrite migration 005
File: `migrations/005_scoring_pipeline_columns.sql`
- Remove already-existing columns
- Keep only what's actually needed
- Add proper CHECK constraint updates
