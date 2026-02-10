# Enhancement Implementation Plan

## Overview

This document outlines the implementation plan for 4 optional enhancements identified during QA review.

---

## 1. Prompt Cache Integration (High Value)

### Goal
Integrate the existing prompt cache module into the analysis pipeline to reduce redundant transcript/context formatting.

### Files to Modify
- `lib/analysis-pipeline.ts`

### Implementation Steps

1. Import cache functions at top of file:
```typescript
import { getOrSetCachedPrompt } from "@/lib/prompt-cache";
```

2. Locate the transcript formatting section (around lines 211-221)

3. Wrap the formatting logic with `getOrSetCachedPrompt()`:
```typescript
const { transcript: formattedTranscript, context: formattedContext, cached } =
  await getOrSetCachedPrompt(transcriptId, async () => {
    // Existing formatting logic
    const transcript = formatTranscriptForPrompt(transcriptData);
    const context = formatContextForPrompt(contextData);
    return { transcript, context };
  });

if (cached) {
  console.log(`[Pipeline] Cache HIT for transcript ${transcriptId}`);
}
```

4. Add cache hit logging for observability

### Expected Benefit
- Reduces formatting time for repeat analyses
- Persists across serverless cold starts
- 1-hour TTL ensures fresh data when content changes

---

## 2. Security Hardening

### Goal
- Require CRON_SECRET to be set (fail closed)
- Filter batch jobs by authenticated user

### Files to Modify
- `app/api/cron/score-batch/route.ts`
- `app/api/cron/user-recommendations/route.ts`
- `app/api/cron/cluster-companies/route.ts` (if exists)
- `app/api/score-batch/route.ts`

### Implementation Steps

#### 2a. Cron Routes - Require Secret

For each cron route, change:
```typescript
// BEFORE (fails open)
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// AFTER (fails closed)
if (!cronSecret) {
  console.error("[Cron] CRON_SECRET not configured");
  return NextResponse.json(
    { error: "Cron endpoint not configured" },
    { status: 500 }
  );
}

if (authHeader !== `Bearer ${cronSecret}`) {
  console.error("[Cron] Invalid or missing authorization");
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

#### 2b. Score Batch Route - User Filter

In `app/api/score-batch/route.ts`, modify the GET handler:

```typescript
// BEFORE (line ~104-108)
const { data: recentJobs } = await admin
  .from("scoring_batch_jobs")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(5);

// AFTER - Add user filter
// Note: scoring_batch_jobs doesn't have user_id column
// Option 1: Add triggered_by_user_id column to table
// Option 2: Remove this query from user-facing endpoint
// Option 3: Only show jobs if user is admin

// Recommended: Remove from user response or make admin-only
```

**Decision**: Since `scoring_batch_jobs` is system-level (batch processing all users), we should either:
- Remove it from the user-facing GET response, OR
- Keep it but document it's system-wide data

For this implementation, we'll remove it from the user response and add a comment about admin access.

---

## 3. Job Tracking for User Recommendations

### Goal
Add job tracking to `generateUserRecommendations` to match the pattern used in `clusterCompanies`.

### Files to Modify
- `lib/inngest-functions.ts` (generateUserRecommendations function)

### Implementation Steps

1. Import job tracking functions (already imported)

2. Add job creation after fetching users:
```typescript
// After Step 1 (fetch-users), add Step 2:
const jobId = await step.run("create-job", async () => {
  // For user-specific trigger, use that user_id
  // For cron (all users), use a system identifier or first user
  const targetUserId = user_id || users[0]?.id;
  if (!targetUserId) return null;

  return createRecommendationJob(
    "user_recommendations",
    targetUserId,
    user_id ? user_id : undefined, // target_id only if specific user
    users.length
  );
});
```

3. Add progress updates inside the user processing loop:
```typescript
// After each user is processed successfully
if (jobId) {
  await updateJobProgress(jobId, processed, users.length);
}
```

4. Add job completion at the end:
```typescript
// New step after processing
await step.run("complete-job", async () => {
  if (jobId) {
    await completeJob(jobId, {
      users_processed: results.processed,
      users_failed: results.failed
    });
  }
});
```

5. Add error handling with failJob if needed

---

## 4. Multi-Page ICP Scraping

### Goal
Scrape multiple relevant pages instead of just one for richer ICP analysis.

### Files to Modify
- `lib/inngest-functions.ts` (analyzeCompanyWebsite function)

### Implementation Steps

1. Replace `selectBestPageForICP` with `selectPagesForICP`:
```typescript
// BEFORE
import { firecrawlMap, firecrawlScrape, selectBestPageForICP } from "@/lib/firecrawl";

// AFTER
import { firecrawlMap, firecrawlScrape, selectPagesForICP } from "@/lib/firecrawl";
```

2. Modify the select-page step:
```typescript
// BEFORE
const targetUrl = await step.run("select-page", async () => {
  const best = selectBestPageForICP(siteMap, company_name);
  if (!best) return website;
  return best;
});

// AFTER
const targetUrls = await step.run("select-pages", async () => {
  const pages = selectPagesForICP(siteMap, { maxPages: 3 });
  if (pages.length === 0) return [website];
  return pages;
});
```

3. Modify scrape-content to handle multiple pages:
```typescript
// BEFORE
const content = await step.run("scrape-content", async () => {
  const result = await firecrawlScrape(targetUrl, { onlyMainContent: true });
  if (!result.success || !result.data) {
    throw new Error(`Failed to scrape page: ${result.error}`);
  }
  return result.data;
});

// AFTER
const allContent = await step.run("scrape-pages", async () => {
  const results = await Promise.allSettled(
    targetUrls.map(url => firecrawlScrape(url, { onlyMainContent: true }))
  );

  const successfulContent: Array<{ url: string; markdown: string }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled" && result.value.success && result.value.data) {
      successfulContent.push({
        url: targetUrls[i],
        markdown: result.value.data.markdown,
      });
    }
  }

  if (successfulContent.length === 0) {
    throw new Error("Failed to scrape any pages");
  }

  return successfulContent;
});
```

4. Update the scrape status step:
```typescript
await step.run("update-scrape-status", async () => {
  const supabase = getSupabaseAdmin();
  const combinedMarkdown = allContent
    .map(c => `## Page: ${c.url}\n\n${c.markdown}`)
    .join("\n\n---\n\n");

  await supabase
    .from("company_icp")
    .update({
      scrape_status: "analyzing",
      raw_scraped_content: combinedMarkdown,
      last_scraped_at: new Date().toISOString(),
    })
    .eq("company_id", company_id);
});
```

5. Update the AI analysis prompt to mention multiple pages:
```typescript
const analysis = await step.run("analyze-content", async () => {
  const combinedMarkdown = allContent
    .map(c => `## Page: ${c.url}\n\n${c.markdown}`)
    .join("\n\n---\n\n");

  const { object } = await generateObject({
    model: getOpenAIModel("gpt-4o"),
    schema: ICPAnalysisSchema,
    system: `You are a sales intelligence expert. Analyze this company's website content from multiple pages and extract comprehensive information...`,
    prompt: `Company: ${company_name}
Website: ${website}
Pages Analyzed: ${allContent.length}

Content:
${combinedMarkdown}

Extract:
1. Company information...
...`,
  });

  return object;
});
```

---

## Implementation Order

1. **Security** (fastest, critical)
2. **Job Tracking** (straightforward addition)
3. **Prompt Cache** (requires understanding pipeline flow)
4. **Multi-page ICP** (most complex, involves multiple step changes)

---

## Testing Plan

After implementation:
1. Run TypeScript compilation: `npx tsc --noEmit`
2. Run ESLint: `npx eslint <modified-files>`
3. Manual testing:
   - Trigger cron without secret (should 500)
   - Trigger user recommendations, check job record created
   - Score same transcript twice, verify cache hit log
   - Trigger ICP analysis, verify multiple pages scraped

---

## Rollback Plan

All changes are additive and backward-compatible. If issues arise:
- Prompt cache: Remove `getOrSetCachedPrompt` wrapper, revert to direct formatting
- Security: Revert to optional secret check
- Job tracking: Remove job creation/update steps
- Multi-page: Revert to `selectBestPageForICP`
