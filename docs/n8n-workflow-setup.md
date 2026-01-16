# n8n Workflow Setup Guide - Dynamic Prompt Loading

This guide explains how to update your n8n workflow to fetch prompts from the database instead of using hardcoded prompts.

## API Endpoints

Your Next.js app provides these endpoints for n8n integration:

### 1. Fetch Prompts
```
GET /api/n8n/prompts
```

Returns all active prompts formatted for n8n use.

**Response:**
```json
{
  "prompts": {
    "pain_points": {
      "id": "uuid",
      "name": "Pain Points Extractor",
      "prompt_content": "...",
      "version": 1,
      "variables": ["transcript_text", "context"]
    },
    "objections": { ... },
    "engagement": { ... },
    "next_steps": { ... },
    "call_structure": { ... },
    "rep_technique": { ... },
    "synthesis": { ... }
  },
  "count": 7
}
```

### 2. Fetch Test Transcripts
```
GET /api/n8n/test-transcripts?limit=5
```

Returns test transcripts with full data for processing.

**Query Parameters:**
- `ids`: Comma-separated test transcript IDs
- `limit`: Max number of transcripts (default: 5)
- `call_type`: Filter by call type (discovery, demo, follow_up, etc.)

### 3. Save Agent Run Results
```
POST /api/n8n/prompts
```

**Body:**
```json
{
  "agent_type": "pain_points",
  "prompt_id": "uuid-of-prompt",
  "transcript_id": 123,
  "output": { "pain_points": [...] },
  "model": "gpt-4o",
  "prompt_tokens": 1500,
  "completion_tokens": 500,
  "total_cost": 0.025,
  "duration_ms": 3500,
  "is_test_run": true,
  "test_transcript_id": "uuid"
}
```

### 4. Trigger n8n Workflow (from UI)
```
POST /api/prompts/trigger-n8n
```

**Body:**
```json
{
  "workflow": "scoreV2",
  "user_id": "user-uuid",
  "prompt_id": "prompt-uuid",
  "test_mode": true,
  "transcript_ids": ["id1", "id2"]
}
```

---

## Updated n8n Workflow Structure

### Step 1: Add HTTP Request Node to Fetch Prompts

Create a new HTTP Request node at the start of your workflow:

**Node: "Fetch Prompts from DB"**
```json
{
  "method": "GET",
  "url": "={{$env.APP_URL}}/api/n8n/prompts",
  "headers": {
    "Content-Type": "application/json"
  },
  "responseFormat": "json"
}
```

### Step 2: Add HTTP Request Node to Fetch Test Transcripts (for test mode)

**Node: "Fetch Test Transcripts"**
```json
{
  "method": "GET",
  "url": "={{$env.APP_URL}}/api/n8n/test-transcripts?limit=5",
  "headers": {
    "Content-Type": "application/json"
  },
  "responseFormat": "json"
}
```

### Step 3: Update Each Agent Node

For each extraction agent (Pain Points, Objections, etc.), update the prompt to use the database value:

**Before (hardcoded):**
```
You are a sales call analyst specializing in identifying pain points...
```

**After (dynamic):**
```
={{ $('Fetch Prompts from DB').item.json.prompts.pain_points.prompt_content }}
```

### Step 4: Add Code Node to Track Prompt IDs

Add a Code node after each agent to capture the prompt ID for saving:

```javascript
const prompts = $('Fetch Prompts from DB').first().json.prompts;
const agentType = 'pain_points'; // Change for each agent

return [{
  json: {
    ...items[0].json,
    prompt_id: prompts[agentType].id,
    prompt_version: prompts[agentType].version,
    agent_type: agentType
  }
}];
```

### Step 5: Add HTTP Request Node to Save Results

At the end of each agent branch, add a node to save the results:

**Node: "Save Agent Run"**
```json
{
  "method": "POST",
  "url": "={{$env.APP_URL}}/api/n8n/prompts",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "agent_type": "={{ $json.agent_type }}",
    "prompt_id": "={{ $json.prompt_id }}",
    "transcript_id": "={{ $json.transcript_id }}",
    "output": "={{ $json.output }}",
    "model": "gpt-4o",
    "is_test_run": "={{ $json.test_mode || false }}"
  }
}
```

---

## Environment Variables for n8n

Add these environment variables to your n8n instance:

```
APP_URL=https://your-app-domain.com
# or for local development:
APP_URL=http://localhost:3000
```

---

## Complete Updated Workflow JSON

Here's a partial example of the updated workflow structure:

```json
{
  "nodes": [
    {
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "scoreV2",
        "method": "POST"
      }
    },
    {
      "name": "Fetch Prompts from DB",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "={{$env.APP_URL}}/api/n8n/prompts"
      }
    },
    {
      "name": "Check Test Mode",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.test_mode }}",
              "value2": true
            }
          ]
        }
      }
    },
    {
      "name": "Fetch Test Transcripts",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "={{$env.APP_URL}}/api/n8n/test-transcripts"
      }
    },
    {
      "name": "Pain Points Agent",
      "type": "n8n-nodes-base.openAi",
      "parameters": {
        "model": "gpt-4o",
        "messages": {
          "values": [
            {
              "role": "system",
              "content": "={{ $('Fetch Prompts from DB').item.json.prompts.pain_points.prompt_content }}"
            },
            {
              "role": "user",
              "content": "Analyze this transcript:\n\n{{ $json.transcript_text }}"
            }
          ]
        }
      }
    }
  ]
}
```

---

## Agent Type Mapping

Use these exact agent_type values to match database prompts:

| Agent | agent_type value |
|-------|-----------------|
| Pain Points | `pain_points` |
| Objections | `objections` |
| Engagement | `engagement` |
| Next Steps | `next_steps` |
| Call Structure | `call_structure` |
| Rep Technique | `rep_technique` |
| Synthesis | `synthesis` |

---

## Testing the Integration

1. **Test Prompt Fetch:**
   ```bash
   curl http://localhost:3000/api/n8n/prompts
   ```

2. **Test Transcript Fetch:**
   ```bash
   curl http://localhost:3000/api/n8n/test-transcripts?limit=3
   ```

3. **Trigger from UI:**
   - Go to `/prompts` page
   - Click "Test" on any prompt
   - Select test transcripts
   - Run the test

4. **View Results:**
   - Go to `/agent-runs` page
   - Filter by `is_test_run = true`

---

## Webhook URLs

Configure these in your `.env.local`:

```
N8N_WEBHOOK_SCOREV2=https://n8n.omrajpal.tech/webhook/scoreV2
N8N_WEBHOOK_TEST_PROMPT=https://n8n.omrajpal.tech/webhook/test-prompt
```
