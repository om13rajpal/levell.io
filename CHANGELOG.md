# Changelog

All notable changes to Levvl.io will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased] - V2 Multi-Agent Architecture

### Overview
Phase 2 implements a multi-agent architecture for deeper, simpler, more actionable sales coaching.

**Architecture:** Context Loader → Extraction Agents (Parallel) → Synthesis Agent → Database

### Added

#### WS1: Context Loader
- [ ] `lib/context-loader.ts` - Loads historical context for AI agents
- [ ] Previous call summaries by company
- [ ] Company profile loading
- [ ] User business profile (ICP, products, personas)
- [ ] Standardized `ContextObject` interface

#### WS2: Extraction Agents
- [ ] `types/extraction-outputs.ts` - TypeScript types and Zod schemas
- [ ] `lib/extraction-agents.ts` - 6 parallel extraction agents:
  1. Pain Points Extractor
  2. Objections Extractor
  3. Engagement Scorer
  4. Next Steps Analyzer
  5. Call Structure Reviewer
  6. Rep Technique Analyzer

#### WS3: Synthesis Agent
- [ ] `lib/synthesis-agent.ts` - Combines extraction outputs
- [ ] Generates coaching report with new sections:
  - What Worked
  - Missed Opportunities
  - Deal Risk Alerts
  - Patterns to Watch (NEW)
  - Next Call Game Plan (NEW)
  - Performance Breakdown
  - Deal Signal

#### WS4: Database
- [ ] `call_summary` column for AI-generated summaries
- [ ] `deal_signal` column (healthy/at_risk/critical)
- [ ] `extraction_outputs` JSONB for raw agent data

#### WS5: API Integration
- [ ] `app/api/analyze-v2/route.ts` - V2 analysis pipeline API
- [ ] Updated webhook handler with v2 support

#### WS6: Frontend
- [ ] Updated Call Detail page with new coaching UI
- [ ] Deal Signal badges
- [ ] New scoring breakdown visualization

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
