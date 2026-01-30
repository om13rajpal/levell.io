# Implementation Plan: Call Page Fixes & Onboarding Step 6 Removal

## Analysis Summary

### Database Structure (from transcript ID 677)

The AI fields are stored as **JSON strings** in the database, not parsed objects:

```
ai_category_breakdown: "{\"pain_points\":{\"score\":65,\"weight\":5,\"one_liner\":\"...\"},...}"
ai_what_worked: "[{\"skill\":\"Rapport-Building\",\"moment\":\"...\",\"quote\":\"...\"}]"
ai_improvement_areas: "[{\"priority\":1,\"skill\":\"...\",\"what_happened\":\"...\"}]"
```

### Root Cause of Issues

1. **Performance Breakdown showing 699-700 numbers**: `Object.entries()` called on a JSON **string** iterates character indices, not object keys
2. **"No detailed feedback available"**: Code looks for `value.reason` but data has `value.one_liner`
3. **Data not mapped correctly**: JSON strings not being parsed before use

---

## Tasks

### Task 1: Remove Onboarding Step 6
- Delete `app/onboarding/step6/page.tsx`
- Update step 5 to complete onboarding directly
- Remove `framework` column from users table via Supabase MCP

### Task 2: Fix JSON Parsing in Call Page
- Add `parseJSON` helper function to safely parse all AI fields
- Apply to: `ai_category_breakdown`, `ai_what_worked`, `ai_improvement_areas`, etc.
- Ensure all JSON strings are parsed to objects/arrays

### Task 3: Fix Category Breakdown Display
- Map `one_liner` to display as the reason/description
- Handle the weight field for proper scoring context
- Fix the formatting of category labels

### Task 4: Fix What Worked / Improvement Areas Display
- Parse JSON arrays correctly
- Map V3 format fields: `skill`, `moment`, `quote`, `why_effective`, `reinforcement`
- For improvement: `priority`, `skill`, `what_happened`, `quote`, `impact`, `do_instead`, `practice_drill`

### Task 5: UI/Font Improvements
- Increase font sizes for readability
- Improve card spacing and visual hierarchy
- Better contrast for text elements

---

## Data Field Mapping

### ai_category_breakdown (object)
```typescript
{
  [category: string]: {
    score: number;      // 0-100
    weight: number;     // importance weight
    one_liner: string;  // description (currently missed as "reason")
  }
}
```

### ai_what_worked (array)
```typescript
[{
  skill: string;           // category label
  moment: string;          // what happened
  quote: string;           // supporting quote
  why_effective: string;   // explanation
  reinforcement: string;   // how to continue
}]
```

### ai_improvement_areas (array)
```typescript
[{
  priority: number;        // 1, 2, 3...
  skill: string;           // area name
  what_happened: string;   // observation
  quote: string;           // supporting quote
  impact: string;          // why it matters
  do_instead: string;      // recommendation
  practice_drill: string;  // action item
}]
```

### ai_missed_opportunities (array)
```typescript
[{
  moment: string;          // situation
  prospect_said: string;   // what prospect said
  rep_did: string;         // what rep did
  should_have: string;     // what should have happened
  strategic_value: string; // why it matters
}]
```

### ai_deal_risk_alerts (array)
```typescript
[{
  risk_type: string;       // timeline, budget, etc.
  evidence: string;        // what indicates risk
  severity: string;        // high, medium, low
  mitigation: string;      // how to address
}]
```

### ai_next_call_game_plan (array)
```typescript
[{
  priority: number;
  objective: string;
  approach: string;
  key_question: string;
  success_criteria: string;
}]
```
