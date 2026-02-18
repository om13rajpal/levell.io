# AI Agent Prompts & n8n Workflow Architecture

This document describes the complete architecture for testing AI agent prompts with n8n workflows.

## Overview

The system allows testing 7 AI agents that analyze sales call transcripts. Each agent has a specific focus:

| Agent Type | Purpose |
|------------|---------|
| `pain_points` | Identify customer pain points and challenges |
| `objection` | Detect and analyze objections raised |
| `engagement` | Measure customer engagement levels |
| `next_steps` | Extract action items and next steps |
| `call_structure` | Analyze the call flow and structure |
| `rep_technique` | Evaluate sales rep techniques |
| `synthesis` | Create overall call summary |

## Architecture Diagram

```
┌─────────────────┐     ┌────────────────────┐     ┌──────────────────┐
│  Prompts Page   │────▶│  /api/prompts/     │────▶│   n8n Webhook    │
│  (Frontend)     │     │  trigger-n8n       │     │                  │
└─────────────────┘     └────────────────────┘     └────────┬─────────┘
                                                           │
                        ┌──────────────────────────────────┼──────────────────────────────────┐
                        │                                  │                                  │
                        ▼                                  ▼                                  │
              ┌─────────────────┐              ┌─────────────────────┐                        │
              │ Fetch Prompt    │              │ Fetch Transcript    │                        │
              │ /api/prompts/:id│              │ /api/transcripts/:id│                        │
              └────────┬────────┘              └──────────┬──────────┘                        │
                       │                                  │                                   │
                       ▼                                  ▼                                   │
              ┌──────────────────────────────────────────────────────┐                        │
              │              Prepare Prompt Data                      │                        │
              │  - Replace {{transcript}} with actual content         │                        │
              │  - Build system prompt                                │                        │
              └────────────────────────┬─────────────────────────────┘                        │
                                       │                                                      │
                                       ▼                                                      │
              ┌──────────────────────────────────────────────────────┐                        │
              │                   OpenAI GPT-4o                       │                        │
              │  - System: Agent prompt content                       │                        │
              │  - User: Transcript to analyze                        │                        │
              └────────────────────────┬─────────────────────────────┘                        │
                                       │                                                      │
                                       ▼                                                      │
              ┌──────────────────────────────────────────────────────┐                        │
              │                Save Agent Run                         │                        │
              │  /api/agent-runs (single) or /api/agent-runs/batch   │                        │
              └────────────────────────┬─────────────────────────────┘                        │
                                       │                                                      │
                                       ▼                                                      │
              ┌──────────────────────────────────────────────────────┐                        │
              │              Respond to Webhook                       │◀─────────────────────┘
              └──────────────────────────────────────────────────────┘
```

## Database Schema

### Tables

#### `agent_prompts`
Stores the AI agent prompt templates.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Display name |
| agent_type | TEXT | One of: pain_points, objection, engagement, next_steps, call_structure, rep_technique, synthesis |
| prompt_content | TEXT | The prompt template with `{{transcript}}` variable |
| description | TEXT | Optional description |
| is_active | BOOLEAN | Whether prompt is currently active |
| version | INTEGER | Version number (auto-increments on edit) |
| variables | TEXT[] | List of variables used (e.g., ['transcript']) |
| created_by | UUID | User who created |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

#### `agent_runs`
Stores all agent execution records.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| prompt_id | UUID | FK to agent_prompts |
| agent_type | TEXT | Agent type |
| prompt_sent | TEXT | Actual prompt sent to OpenAI |
| output | TEXT | Agent output |
| model | TEXT | Model used (default: gpt-4o) |
| prompt_tokens | INTEGER | Input tokens used |
| completion_tokens | INTEGER | Output tokens used |
| transcript_id | BIGINT | FK to transcripts table |
| is_test_run | BOOLEAN | Whether this was a test run |
| status | TEXT | pending, running, completed, failed |
| context_type | TEXT | 'n8n', 'manual', 'test' |
| metadata | JSONB | Additional data |
| created_at | TIMESTAMPTZ | Execution timestamp |

#### `test_transcripts`
Sample transcripts for testing prompts.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Display name |
| description | TEXT | Description of scenario |
| scenario_type | TEXT | cold_call, discovery, closing, etc. |
| transcript_content | TEXT | Full transcript text |
| transcript_id | BIGINT | FK to real transcripts table (for fetching) |
| is_active | BOOLEAN | Whether active |
| created_at | TIMESTAMPTZ | Creation timestamp |

#### `transcripts`
Real sales call transcripts.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| title | TEXT | Call title |
| sentences | JSONB | Array of {speaker_name, text} objects |
| participants | TEXT[] | List of participants |
| duration | NUMERIC | Call duration |
| ai_summary | TEXT | AI-generated summary |
| user_id | UUID | User who owns transcript |
| created_at | TIMESTAMPTZ | Creation timestamp |

## API Endpoints

### Prompts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/prompts` | GET | List all prompts (add `?active_only=true` for active only) |
| `/api/prompts/:id` | GET | Get single prompt |
| `/api/prompts/:id` | PUT | Update prompt (creates new version) |
| `/api/prompts?version_history=:id` | GET | Get version history for prompt |

### Agent Runs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent-runs` | GET | List runs (supports `?prompt_id=` filter) |
| `/api/agent-runs` | POST | Create single run |
| `/api/agent-runs/batch` | POST | Create multiple runs (for multi-agent workflow) |

### Test Transcripts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/test-transcripts` | GET | List all test transcripts |
| `/api/test-transcripts?include_content=true` | GET | Include full transcript content |
| `/api/test-transcripts` | POST | Create new test transcript |

### Transcripts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transcripts/:id` | GET | Get transcript by ID (returns formatted content) |

### n8n Trigger

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/prompts/trigger-n8n` | POST | Trigger n8n workflow |
| `/api/prompts/trigger-n8n` | GET | List available workflows |

**POST Body:**
```json
{
  "workflow": "testPrompt",       // or "scoreV2" for multi-agent
  "prompt_id": "uuid-here",       // Required for single agent
  "agent_type": "pain_points",    // Agent type
  "test_mode": true,              // Whether this is a test run
  "transcript_id": 123,           // ID of real transcript to fetch
  "test_transcript": "...",       // Optional: inline transcript content
  "test_transcript_name": "..."   // Optional: name for logging
}
```

## n8n Workflows

### Single Agent Runner (`testPrompt`)

**Webhook URL:** `https://your-n8n-instance/webhook/run-agent-prompt`

**Flow:**
1. Receive webhook with `prompt_id` and `transcript_id`
2. Fetch prompt from `/api/prompts/:prompt_id`
3. Fetch transcript from `/api/transcripts/:transcript_id`
4. Replace `{{transcript}}` in prompt content
5. Call OpenAI GPT-4o
6. Save run to `/api/agent-runs`
7. Respond with result

**Expected Input:**
```json
{
  "prompt_id": "uuid",
  "transcript_id": 123,
  "test_mode": true,
  "test_transcript": "optional inline content",
  "test_transcript_name": "Test Call"
}
```

### Multi-Agent Runner (`scoreV2`)

**Webhook URL:** `https://your-n8n-instance/webhook/scoreV2`

**Flow:**
1. Receive webhook with `transcript_id`
2. Fetch ALL active prompts from `/api/prompts?active_only=true`
3. Fetch transcript from `/api/transcripts/:transcript_id`
4. For each prompt:
   - Replace `{{transcript}}` in prompt content
   - Call OpenAI GPT-4o
   - Collect results
5. Batch save all runs to `/api/agent-runs/batch`
6. Respond with aggregated result

**Expected Input:**
```json
{
  "transcript_id": 123,
  "test_mode": true,
  "test_transcript": "optional inline content"
}
```

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# n8n Webhooks (optional - defaults provided)
N8N_WEBHOOK_SCOREV2=https://n8n.yourdomain.com/webhook/scoreV2
N8N_WEBHOOK_TEST_PROMPT=https://n8n.yourdomain.com/webhook/run-agent-prompt
```

## Frontend Usage

### Running a Single Prompt

1. Navigate to `/prompts`
2. Click "Run Prompt" on any agent card
3. Select a test transcript from dropdown
4. Click "Run Single Agent"
5. View results in the dialog or navigate to `/agent-runs`

### Viewing Run History

1. Click "Outputs" on any agent card
2. See list of all runs with token usage and cost
3. Click "View" on any run for detailed output

### Editing Prompts

1. Click the edit icon on any agent card
2. Modify the prompt content
3. Click "Save Changes" - previous version is automatically archived
4. View version history by clicking "Versions"

## Test Transcript Links

Test transcripts are linked to real transcripts via `transcript_id`. This allows:

1. **Fetching via API:** n8n workflow can fetch full transcript content from `/api/transcripts/:id`
2. **Consistent Testing:** Same transcript data used across all test runs
3. **Real Data:** Test with actual sales call content

**Current Links:**
| Test Transcript | Real Transcript ID | Title |
|-----------------|-------------------|-------|
| Discovery Call - Software Company | 1 | Quick Sync |
| Demo Call - Heavy Objections | 2 | Black Canyon Inn X Booyah |
| Cold Call - Manufacturing Prospect | 3 | Black Canyon Inn pre-call sync |
| Closing Call - Enterprise Deal | 4 | Team Kaitlin Weekly Meeting |
| Difficult Call - Unengaged Prospect | 5 | BeardBrand Call 3 -- pricing |

## Troubleshooting

### 404 on /api/transcripts/:id

**Cause:** The n8n workflow receives `transcript_id: null` when no test transcript is selected.

**Solution:**
1. Ensure test transcripts have valid `transcript_id` values linked
2. The `/api/transcripts/[id]` route handles null/undefined gracefully by returning empty content

### 405 Method Not Allowed on /api/agent-runs/batch

**Cause:** The batch endpoint didn't exist.

**Solution:** Created `/api/agent-runs/batch/route.ts` with POST handler.

### Single Agent Goes to Multi-Agent Workflow

**Cause:** Frontend was always calling `scoreV2` workflow.

**Solution:** Changed `executeRun("scoreV2")` to `executeRun("testPrompt")` in prompts page.

## Files Reference

```
app/
├── prompts/
│   └── page.tsx                    # Prompts management UI
├── api/
│   ├── prompts/
│   │   ├── route.ts                # List/create prompts
│   │   ├── [id]/route.ts           # Get/update single prompt
│   │   └── trigger-n8n/route.ts    # Trigger n8n workflows
│   ├── agent-runs/
│   │   ├── route.ts                # List/create single runs
│   │   └── batch/route.ts          # Batch create runs
│   ├── test-transcripts/
│   │   └── route.ts                # Test transcripts CRUD
│   └── transcripts/
│       └── [id]/route.ts           # Get transcript by ID
docs/
├── n8n-workflows/
│   ├── single-agent-runner.json    # Single agent n8n workflow
│   └── multi-agent-runner.json     # Multi-agent n8n workflow
└── PROMPTS_N8N_ARCHITECTURE.md     # This document
```
