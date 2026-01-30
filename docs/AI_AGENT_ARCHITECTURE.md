# AI Agent Architecture - Full Database Access

## Overview

This document describes the architecture for making the AI Coach agent intelligent with full database access, semantic search, and page-specific system prompts.

## Current State (Before)

- InlineAgentPanel sends limited context (just what's visible on the page)
- Semantic search exists but isn't used by default
- No automatic ingestion of new data
- Generic system prompts across all pages
- Agent asks users for information instead of querying the database

## Target State (After)

- AI Agent has full access to user's data via semantic search
- Automatic ingestion when transcripts/companies are created/updated
- Page-specific system prompts with database schema context
- Agent queries database in real-time and never asks for basic information
- Comprehensive understanding of all tables and relationships

---

## Database Schema Context

### Core Tables

#### `users`
- `id` (UUID) - Primary key
- `email`, `name`, `full_name` - User identification
- `team_id` (int) - Associated team
- `company_id` (int) - User's company
- `sales_motion` (varchar) - MEDDPICC, BANT, SPICED, etc.
- `onboarding_complete` (boolean)

#### `transcripts` (Call Data)
- `id` (int) - Primary key
- `user_id` (UUID) - Owner
- `title` - Call title
- `duration` (minutes)
- `sentences` (JSONB) - Full transcript with speaker attribution
- `participants` (JSONB) - Meeting attendees
- `summary` (JSONB) - Structured summary with keywords, action items
- `ai_overall_score` (0-100)
- `ai_category_breakdown` (JSONB) - Scores by category
- `ai_analysis` (JSONB) - Detailed analysis
- `ai_deal_risk_alerts` (JSONB) - Risk warnings
- `ai_qualification_gaps` (JSONB) - MEDDPICC/BANT gaps
- `ai_what_worked` (JSONB) - Positive highlights
- `ai_improvement_areas` (JSONB) - Areas to improve
- `ai_next_call_game_plan` (JSONB) - Action items
- `deal_signal` (varchar) - healthy/at_risk/critical
- `call_type` (varchar) - discovery/followup/demo/closing
- `created_at`, `updated_at`

#### `companies` (Detected Companies from Calls)
- `id` (int) - Primary key
- `company_id` (int) - FK to user's company
- `company_name`, `domain`
- `pain_points` (JSONB array)
- `company_contacts` (JSONB) - Contact list
- `company_goal_objective` (text)
- `ai_recommendations` (JSONB)
- `risk_summary` (JSONB)
- `ai_relationship` (JSONB)
- `ai_deal_risk_alerts` (JSONB)

#### `company_calls` (Transcript-Company Junction)
- `id`, `company_id`, `transcript_id`, `created_at`

#### `teams`
- `id`, `team_name`, `owner` (UUID)
- `members` (UUID array)

#### `team_tags` and `team_member_tags`
- Role/department tagging system

#### `coaching_notes`
- `id`, `user_id`, `coach_id`, `note`, `created_at`

#### `workspace_embeddings` (Semantic Search)
- `user_id`, `source_type`, `source_id`
- `content`, `embedding` (vector)
- `metadata` (JSONB)

---

## System Architecture

### 1. Automatic Ingestion Workflow

When transcripts or companies are created/updated, automatically ingest into embeddings:

```
Transcript Created/Updated
    ↓
Inngest Event: transcript/analyzed
    ↓
Ingestion Function: ingestTranscript(transcriptId)
    ↓
workspace_embeddings table updated
```

### 2. Agent Request Flow

```
User asks question on any page
    ↓
InlineAgentPanel sends:
  - userId (for data access)
  - pageContext (page-specific info)
  - useSemanticSearch: true
    ↓
/api/agent receives request
    ↓
1. Semantic search for relevant embeddings
2. Direct database queries for specific data
3. Build page-specific system prompt
4. Stream response to user
```

### 3. Page-Specific System Prompts

Each page gets a specialized system prompt:

#### Dashboard
- Focus: Personal performance overview
- Data Access: Recent calls, scores, trends
- Capabilities: Identify patterns, suggest improvements

#### Calls List
- Focus: Call library analysis
- Data Access: All user's transcripts
- Capabilities: Find patterns, compare calls, identify top/low performers

#### Call Detail
- Focus: Deep dive into single call
- Data Access: Full transcript, AI analysis, scores
- Capabilities: Coaching, objection handling, next steps

#### Companies
- Focus: Account health and relationships
- Data Access: All companies, pain points, risks
- Capabilities: Risk analysis, prioritization, strategy

#### Company Detail
- Focus: Single account deep dive
- Data Access: Company data, all related calls
- Capabilities: Relationship advice, next steps, risk mitigation

#### Team
- Focus: Team performance management
- Data Access: Team members, their calls, scores
- Capabilities: Identify coaching needs, best practices

---

## Implementation Plan

### Phase 1: Enhanced Agent API (Priority)

Update `/api/agent/route.ts`:
1. Always enable semantic search for workspace context
2. Add direct database queries for page-specific data
3. Create page-specific system prompt builder
4. Pass userId in all requests

### Phase 2: Automatic Ingestion

Create Inngest functions:
1. `transcript/analyzed` → Auto-ingest transcript
2. `company/updated` → Auto-ingest company
3. Bulk ingestion for existing data

### Phase 3: Update InlineAgentPanel

1. Always pass `userId` and `useSemanticSearch: true`
2. Send `pageType` for system prompt selection
3. Remove redundant context data (agent queries directly)

---

## System Prompts by Page

### Dashboard System Prompt

```
You are an AI Sales Coach with full access to this user's sales data.

## Your Role
Provide personalized coaching based on the user's recent performance.

## Available Data
- All call transcripts with scores and analysis
- Performance trends over time
- Coaching notes from managers
- Team comparisons (if applicable)

## Capabilities
1. Analyze recent performance patterns
2. Identify areas needing improvement
3. Celebrate wins and progress
4. Suggest specific actions for improvement
5. Compare against personal bests

## Guidelines
- Be proactive with insights
- Reference specific calls when relevant
- Be encouraging but honest
- Provide actionable recommendations
```

### Call Detail System Prompt

```
You are an AI Sales Coach analyzing a specific call.

## Your Role
Deep dive into this call and provide coaching insights.

## Call Context
[Full transcript and AI analysis injected here]

## Capabilities
1. Explain score breakdown
2. Identify missed opportunities
3. Suggest better responses to objections
4. Create next-call game plan
5. Highlight what went well

## Guidelines
- Reference specific moments in the call
- Provide alternative phrasings/approaches
- Focus on improvement, not criticism
- Connect to overall performance patterns
```

### Companies System Prompt

```
You are an AI Sales Coach helping manage accounts.

## Your Role
Analyze the user's company portfolio and relationships.

## Available Data
- All detected companies from calls
- Pain points across accounts
- Risk levels and alerts
- Call history per company
- AI recommendations

## Capabilities
1. Identify at-risk accounts
2. Prioritize accounts needing attention
3. Summarize pain points by theme
4. Suggest engagement strategies
5. Track relationship health

## Guidelines
- Prioritize by business impact
- Be specific about risks and actions
- Connect insights across accounts
- Recommend next steps
```

---

## API Changes

### /api/agent/route.ts Updates

New request body fields:
```typescript
{
  messages: UIMessage[];
  model: string;
  userId: string;              // Required
  pageType: string;            // dashboard|calls|call_detail|companies|company_detail|team
  pageContext?: {
    transcriptId?: number;
    companyId?: number;
    teamId?: number;
  };
  useSemanticSearch?: boolean; // Default true
}
```

New response capabilities:
- Semantic search across all user data
- Direct database queries for specific data
- Page-specific system prompts
- Source citations in responses

---

## Migration Steps

1. Update agent API with enhanced capabilities
2. Create Inngest ingestion workflows
3. Bulk ingest existing user data
4. Update InlineAgentPanel to use new API
5. Test on each page type
6. Monitor and refine prompts

---

## Security Considerations

- All database queries filtered by user_id
- Row-level security on Supabase tables
- No cross-user data access
- Service role key used server-side only
- Rate limiting on agent API
