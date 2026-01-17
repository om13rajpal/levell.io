# n8n Workflows for Agent Prompts

This directory contains n8n workflow templates for running the 7 AI agent prompts.

## Workflows

### 1. agent-prompt-runner.json
A simple workflow that runs a single agent prompt:
- Receives webhook trigger with prompt_id and transcript_id
- Fetches the prompt from API
- Fetches transcript data
- Runs the prompt through OpenAI GPT-4o
- Saves the result to agent_runs via API
- Returns run details with token usage and cost

### 2. score-v2-all-agents.json
A comprehensive workflow that runs all 7 agents in parallel:
- Receives webhook trigger at `/scoreV2`
- Fetches all active prompts from API
- Runs 6 agents in parallel (Pain Points, Objection, Engagement, Next Steps, Call Structure, Rep Technique)
- Waits for all agents to complete
- Runs Synthesis Agent to combine all results
- Saves all 7 agent runs to database
- Returns aggregated results with total cost

## Setup Instructions

### 1. Import Workflows
1. Open n8n dashboard
2. Go to Workflows > Import
3. Upload the JSON file
4. Save the workflow

### 2. Credentials

The workflows are configured to use the following credentials:

#### OpenAI
- Credential ID: `s4JHez4r5GFcPdkg`
- Credential Name: `Seb`

If you need to use different credentials, update the `credentials` section in each OpenAI node.

### 3. API Endpoints

The workflows use the following API endpoints on `levell-io.vercel.app`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/prompts` | GET | Fetch all prompts |
| `/api/prompts/{id}` | GET | Fetch single prompt |
| `/api/transcripts/{id}` | GET | Fetch transcript |
| `/api/agent-runs` | POST | Save single agent run |
| `/api/agent-runs/batch` | POST | Save multiple agent runs |

### 4. Webhook URLs
After activating the workflows, the webhook URLs will be:

```
# Score V2 - All Agents
https://your-n8n-instance/webhook/scoreV2

# Single Agent Prompt Runner
https://your-n8n-instance/webhook/run-agent-prompt
```

Update these in your application's environment:

```env
# .env.local
N8N_WEBHOOK_SCOREV2=https://your-n8n-instance/webhook/scoreV2
N8N_WEBHOOK_TEST_PROMPT=https://your-n8n-instance/webhook/run-agent-prompt
```

## Agent Types

The system supports 7 agent types that run in the following order:

| Order | Agent Type | Description |
|-------|------------|-------------|
| 1-6 (Parallel) | `pain_points` | Extracts customer pain points from transcripts |
| 1-6 (Parallel) | `objection` | Analyzes objection handling techniques |
| 1-6 (Parallel) | `engagement` | Measures conversation engagement patterns |
| 1-6 (Parallel) | `next_steps` | Identifies next steps and commitments |
| 1-6 (Parallel) | `call_structure` | Evaluates call structure and methodology |
| 1-6 (Parallel) | `rep_technique` | Analyzes sales representative techniques |
| 7 (Sequential) | `synthesis` | Creates comprehensive call summary from all agents |

## Webhook Payload

### Score V2 - All Agents
```json
{
  "transcript": "Full transcript text...",
  "transcript_id": 123,
  "user_id": "uuid-of-user",
  "test_mode": false,
  "test_transcript": "Optional test transcript for test_mode=true"
}
```

### Single Agent Runner
```json
{
  "prompt_id": "uuid-of-prompt",
  "transcript_id": 123,
  "user_id": "uuid-of-user",
  "test_mode": false,
  "test_transcript": "Optional test transcript"
}
```

## Token Tracking

The workflows automatically calculate and track:
- **Input Tokens**: Number of tokens in the prompt
- **Output Tokens**: Number of tokens in the response
- **Cost (USD)**: Calculated based on GPT-4o pricing:
  - Input: $2.50 per 1M tokens
  - Output: $10.00 per 1M tokens

## Workflow Architecture

### Score V2 - All Agents

```
┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐
│  Webhook    │───▶│  Fetch Prompts   │───▶│  Parse Data       │
│  /scoreV2   │    │  from API        │    │                   │
└─────────────┘    └──────────────────┘    └─────────┬─────────┘
                                                      │
                   ┌──────────────────────────────────┼──────────────────────────────────┐
                   │                                  │                                  │
                   ▼                                  ▼                                  ▼
          ┌────────────────┐              ┌────────────────┐              ┌────────────────┐
          │  Pain Points   │              │   Objection    │              │   Engagement   │
          │    Agent       │              │     Agent      │              │     Agent      │
          └───────┬────────┘              └───────┬────────┘              └───────┬────────┘
                  │                               │                               │
                  │        ┌────────────────┐     │     ┌────────────────┐        │
                  │        │   Next Steps   │     │     │ Call Structure │        │
                  │        │     Agent      │     │     │     Agent      │        │
                  │        └───────┬────────┘     │     └───────┬────────┘        │
                  │                │              │             │                  │
                  │                │     ┌────────────────┐     │                  │
                  │                │     │ Rep Technique  │     │                  │
                  │                │     │     Agent      │     │                  │
                  │                │     └───────┬────────┘     │                  │
                  │                │             │              │                  │
                  └────────────────┴─────────────┼──────────────┴──────────────────┘
                                                 │
                                                 ▼
                                    ┌────────────────────────┐
                                    │   Wait For All Agents  │
                                    │        (Merge)         │
                                    └───────────┬────────────┘
                                                │
                                                ▼
                                    ┌────────────────────────┐
                                    │   Collect Agent        │
                                    │      Outputs           │
                                    └───────────┬────────────┘
                                                │
                                                ▼
                                    ┌────────────────────────┐
                                    │   Synthesis Agent      │
                                    │   (Combines all)       │
                                    └───────────┬────────────┘
                                                │
                                                ▼
                                    ┌────────────────────────┐
                                    │   Prepare Results &    │
                                    │   Calculate Cost       │
                                    └───────────┬────────────┘
                                                │
                                                ▼
                                    ┌────────────────────────┐
                                    │   Save to Database     │
                                    │   (Batch Insert)       │
                                    └───────────┬────────────┘
                                                │
                                                ▼
                                    ┌────────────────────────┐
                                    │   Respond to Webhook   │
                                    └────────────────────────┘
```

## Response Format

### Score V2 Success Response
```json
{
  "success": true,
  "message": "All 7 agents completed successfully",
  "agents_run": 7,
  "results": {
    "pain_points": { ... },
    "objection": { ... },
    "engagement": { ... },
    "next_steps": { ... },
    "call_structure": { ... },
    "rep_technique": { ... },
    "synthesis": { ... }
  },
  "token_usage": {
    "per_agent": { ... },
    "synthesis": { "input": 0, "output": 0 },
    "total_input": 0,
    "total_output": 0
  },
  "cost_usd": 0.00
}
```

## Error Handling

The workflows include error handling:
- Failed runs are marked with `status: 'failed'`
- Error messages are stored in `error_message` field
- Webhook responds with error details

## Customization

To customize the workflows:
1. Adjust the OpenAI model (default: gpt-4o)
2. Modify temperature setting (default: 0.3)
3. Update max tokens (default: 4096)
4. Change JSON response format if needed
5. Add additional processing nodes as needed
