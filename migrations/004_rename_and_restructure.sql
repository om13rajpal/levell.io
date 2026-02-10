-- Migration: 004_rename_and_restructure.sql
-- Description: Rename company tables to external_org, drop legacy columns from teams/users
-- Depends on: 003_multi_tenant_schema.sql
-- Created: 2026-02-06

-- ============================================
-- Step 1: Rename companies → external_org
-- ============================================
ALTER TABLE companies RENAME TO external_org;

-- Update foreign key column comments
COMMENT ON TABLE external_org IS 'Prospect/client companies tracked by users (formerly "companies")';

-- Rename index if it exists (Supabase may have auto-generated names)
-- The internal_org_id index from migration 003 referenced "companies"
-- PostgreSQL auto-renames indexes on table rename, so idx_companies_internal_org → idx_external_org_internal_org
-- No manual rename needed for most indexes

-- ============================================
-- Step 2: Rename company_calls → external_org_calls
-- ============================================
ALTER TABLE company_calls RENAME TO external_org_calls;

COMMENT ON TABLE external_org_calls IS 'Junction table linking transcripts to external organizations (formerly "company_calls")';

-- ============================================
-- Step 3: Rename company_recommendations → external_org_recommendations
-- ============================================
ALTER TABLE company_recommendations RENAME TO external_org_recommendations;

COMMENT ON TABLE external_org_recommendations IS 'AI-generated recommendations per external organization (formerly "company_recommendations")';

-- ============================================
-- Step 4: Rename company_icp → external_org_icp
-- ============================================
ALTER TABLE company_icp RENAME TO external_org_icp;

COMMENT ON TABLE external_org_icp IS 'ICP research data per external organization (formerly "company_icp")';

-- ============================================
-- Step 5: Update foreign key column names in external_org_calls
-- The column is still called company_id - rename to external_org_id
-- ============================================
-- Note: We keep company_id column name for now to avoid massive code changes.
-- The table rename is the primary change. Column rename can happen in a later migration.

-- ============================================
-- Step 6: Drop legacy columns from teams
-- Ownership is now tracked in team_org (is_sales_manager flag)
-- Members are now tracked in team_org junction table
-- ============================================
ALTER TABLE teams DROP COLUMN IF EXISTS owner;
ALTER TABLE teams DROP COLUMN IF EXISTS members;

-- ============================================
-- Step 7: Drop legacy team_id from users
-- Team membership is now tracked in team_org junction table
-- ============================================
ALTER TABLE users DROP COLUMN IF EXISTS team_id;

-- ============================================
-- Step 8: Update transcripts.company_id FK reference
-- The FK was created in migration 003 pointing to companies(id)
-- PostgreSQL automatically updates FK references when the target table is renamed
-- So transcripts.company_id now correctly references external_org(id)
-- ============================================

-- ============================================
-- Step 9: Rename column comments that reference old table names
-- ============================================
COMMENT ON COLUMN external_org.internal_org_id IS 'Links this prospect/client to the SaaS customer organization';
