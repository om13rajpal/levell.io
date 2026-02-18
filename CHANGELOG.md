# Changelog

All notable changes to Levvl.io will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased] - V2 Multi-Agent Architecture

### Overview
Phase 2 implements a multi-agent architecture for deeper, simpler, more actionable sales coaching.

**Architecture:** Context Loader → Extraction Agents (Parallel) → Synthesis Agent → Database

### Added

#### WS1: Context Loader
- [x] `lib/context-loader.ts` - Loads historical context for AI agents
- [x] Previous call summaries by company
- [x] Company profile loading
- [x] User business profile (ICP, products, personas)
- [x] Standardized `ContextObject` interface

#### WS2: Extraction Agents
- [x] `types/extraction-outputs.ts` - TypeScript types and Zod schemas
- [x] `lib/extraction-agents.ts` - 6 parallel extraction agents:
  1. Pain Points Extractor
  2. Objections Extractor
  3. Engagement Scorer
  4. Next Steps Analyzer
  5. Call Structure Reviewer
  6. Rep Technique Analyzer

#### WS3: Synthesis Agent
- [x] `lib/synthesis-agent.ts` - Combines extraction outputs
- [x] Generates coaching report with new sections:
  - What Worked
  - Missed Opportunities
  - Deal Risk Alerts
  - Patterns to Watch (NEW)
  - Next Call Game Plan (NEW)
  - Performance Breakdown
  - Deal Signal

#### WS4: Database
- [x] `migrations/001_v2_multi_agent_schema.sql` - Migration script
- [x] `call_summary` column for AI-generated summaries
- [x] `deal_signal` column (healthy/at_risk/critical)
- [x] `call_type` column (discovery/followup/demo/closing)
- [x] `extraction_outputs` JSONB for raw agent data

#### WS5: API Integration
- [x] `app/api/analyze-v2/route.ts` - V2 analysis pipeline API
- [x] `lib/analysis-pipeline.ts` - Full pipeline orchestrator
- [ ] Updated webhook handler with v2 support (pending)

#### WS6: Frontend
- [x] Updated Call Detail page with new coaching UI
- [x] Deal Signal badges (healthy/at_risk/critical)
- [x] Patterns to Watch section
- [x] Priority badges on Next Call Game Plan
- [x] V2 data with V1 backward compatibility
- [x] New 6-category scoring breakdown visualization

### Changed
- AI language now sounds like a sales manager giving feedback
- Scoring uses 6 focused categories instead of generic framework

### External Setup Required (n8n, Supabase, etc.)
- [ ] Run database migrations in Supabase
- [ ] Update n8n Fireflies workflow to call v2 endpoint
- [ ] Add GEMINI_API_KEY to environment (if using Gemini)

---

## [1.0.0] - Current Production (V1)

### Features
- Single-prompt AI analysis
- 6 scoring categories (Call Setup, Discovery, Active Listening, Value Communication, Next Steps, Objection Handling)
- Call transcript sync from Fireflies
- Company detection and tracking
- Team collaboration with coaching notes
- AI chat agent for contextual insights
