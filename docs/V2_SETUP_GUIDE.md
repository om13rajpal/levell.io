# V2 Multi-Agent Architecture - Setup Guide

This guide covers the external setup required to activate the V2 analysis pipeline.

---

## 1. Database Migration (Supabase)

### Run the Migration Script

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the contents of `migrations/001_v2_multi_agent_schema.sql`
3. Click **Run**

### What Gets Added

| Column | Type | Purpose |
|--------|------|---------|
| `call_summary` | TEXT | AI-generated 4-5 sentence summary for future call context |
| `deal_signal` | VARCHAR(20) | Deal health: `healthy`, `at_risk`, or `critical` |
| `call_type` | VARCHAR(20) | Call classification: `discovery`, `followup`, `demo`, `closing` |
| `extraction_outputs` | JSONB | Raw outputs from all 6 extraction agents |

### Verify Migration

Run this query to confirm:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transcripts'
  AND column_name IN ('call_summary', 'deal_signal', 'call_type', 'extraction_outputs');
```

---

## 2. n8n Workflow Update

### Option A: Replace V1 with V2

Update your existing Fireflies webhook workflow to call the new endpoint:

**Endpoint:** `POST /api/analyze-v2`

**Request Body:**
```json
{
  "transcript_id": 123,
  "user_id": "uuid-string",
  "company_id": 456,
  "call_type": "discovery"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `transcript_id` | Yes | The transcript ID from your database |
| `user_id` | No | User UUID for context loading |
| `company_id` | No | Company ID for loading previous calls |
| `call_type` | No | `discovery`, `followup`, `demo`, or `closing` |

### Option B: Run V1 and V2 in Parallel

Keep the existing V1 analysis and add a second HTTP node to call `/api/analyze-v2`. This lets you compare results before fully switching.

### Response Format

```json
{
  "success": true,
  "data": {
    "transcript_id": 123,
    "overall_score": 72,
    "deal_signal": "healthy",
    "performance_breakdown": {
      "pain_points": 75,
      "objections": 68,
      "engagement": 80,
      "next_steps": 70,
      "call_structure": 65,
      "rep_technique": 74
    },
    "coaching_summary": {
      "what_worked_count": 3,
      "missed_opportunities_count": 2,
      "deal_risk_alerts_count": 1,
      "patterns_to_watch_count": 2,
      "next_call_actions_count": 4
    },
    "timing": {
      "total_ms": 8500,
      "context_ms": 200,
      "extraction_ms": 4000,
      "synthesis_ms": 3500,
      "storage_ms": 100
    }
  }
}
```

---

## 3. Environment Variables

### Already Configured (No Action Needed)

The V2 pipeline uses your existing OpenAI configuration:

```env
OPENAI_API_KEY=sk-...
```

### Models Used

| Stage | Model | Purpose |
|-------|-------|---------|
| Extraction (6 agents) | `gpt-4o-mini` | Fast, cheap parallel analysis |
| Synthesis | `gpt-4o` | Smart prioritization and coaching language |

### Estimated Costs

Per call analysis (approximate):
- Extraction: ~$0.01-0.02 (6 parallel calls with gpt-4o-mini)
- Synthesis: ~$0.02-0.04 (1 call with gpt-4o)
- **Total: ~$0.03-0.06 per transcript**

---

## 4. Testing the V2 Pipeline

### Manual Test via API

```bash
curl -X POST https://your-domain.com/api/analyze-v2 \
  -H "Content-Type: application/json" \
  -d '{"transcript_id": 123}'
```

### Health Check

```bash
curl https://your-domain.com/api/analyze-v2
```

Returns API documentation and status.

---

## 5. Rollback (If Needed)

### Database Rollback

Run this SQL to remove V2 columns:

```sql
ALTER TABLE transcripts DROP COLUMN IF EXISTS call_summary;
ALTER TABLE transcripts DROP COLUMN IF EXISTS deal_signal;
ALTER TABLE transcripts DROP COLUMN IF EXISTS call_type;
ALTER TABLE transcripts DROP COLUMN IF EXISTS extraction_outputs;
DROP INDEX IF EXISTS idx_company_calls_company_created;
DROP INDEX IF EXISTS idx_transcripts_deal_signal;
DROP INDEX IF EXISTS idx_transcripts_call_type;
```

### n8n Rollback

Switch your HTTP node back to `/api/agent` (V1 endpoint).

---

## 6. What Changed in the UI

The Call Detail page (`/calls/[id]`) now displays:

1. **Deal Signal Badge** - Shows healthy/at_risk/critical next to call title
2. **Patterns to Watch** - New section showing recurring behaviors
3. **Priority Labels** - Next Call Game Plan items show high/medium/low priority
4. **V2 Scoring** - 6 focused categories instead of V1's generic framework

The UI is **backward compatible** - it will display V1 data for older calls and V2 data for new analyses.

---

## Checklist

- [ ] Run database migration in Supabase
- [ ] Verify new columns exist
- [ ] Update n8n workflow to call `/api/analyze-v2`
- [ ] Test with a sample transcript
- [ ] Monitor first few V2 analyses for quality
- [ ] (Optional) Update Linear issues to mark completed

---

## Support

If you encounter issues:
1. Check Vercel logs for API errors
2. Verify Supabase columns exist
3. Ensure `OPENAI_API_KEY` is set in Vercel environment
