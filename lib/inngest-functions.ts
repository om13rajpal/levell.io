import { inngest } from "@/lib/inngest";
import { runAnalysisPipeline } from "@/lib/analysis-pipeline";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { ingestTranscript, ingestCompany, ingestAllUserTranscripts } from "@/lib/embeddings";

// Lazy-loaded admin Supabase client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createClient(url, key);
}

// ============================================
// Score V2 Workflow
// Replaces the N8N scoreV2 webhook
// ============================================
const scoreTranscript = inngest.createFunction(
  { id: "score-transcript-v2", name: "Score Transcript V2" },
  { event: "transcript/score.requested" },
  async ({ event, step }) => {
    const { transcript_id, user_id, prompt_id, agent_type, call_type, company_id } = event.data;

    const result = await step.run("run-analysis-pipeline", async () => {
      return runAnalysisPipeline({
        transcriptId: transcript_id,
        userId: user_id,
        companyId: company_id,
        callType: call_type,
      });
    });

    // If analysis was successful, trigger embedding ingestion
    if (result.success) {
      await step.sendEvent("trigger-embedding-ingestion", {
        name: "transcript/analyzed",
        data: {
          transcript_id,
          user_id,
        },
      });
    }

    return {
      success: result.success,
      transcript_id: result.transcript_id,
      overall_score: result.coaching_report?.overall_score,
      deal_signal: result.coaching_report?.deal_signal,
      timing: result.timing,
      error: result.error,
    };
  }
);

// ============================================
// Test Prompt Runner
// Replaces the N8N testPrompt webhook
// ============================================
const testPromptRunner = inngest.createFunction(
  { id: "test-prompt-runner", name: "Test Prompt Runner" },
  { event: "prompt/test.requested" },
  async ({ event, step }) => {
    const {
      prompt_id,
      agent_type,
      system_prompt,
      user_prompt_template,
      temperature = 0.3,
      transcript_id,
      test_transcript,
      test_transcript_name,
      user_id,
    } = event.data;

    // Step 1: Run prompt through OpenAI
    const aiResult = await step.run("run-openai-prompt", async () => {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Build the user message from template and transcript
      let userMessage = user_prompt_template || "";
      if (test_transcript) {
        userMessage = userMessage
          ? userMessage.replace("{{transcript}}", test_transcript)
          : test_transcript;
      }

      const startTime = Date.now();

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature,
        messages: [
          { role: "system", content: system_prompt || "" },
          { role: "user", content: userMessage },
        ],
      });

      const durationMs = Date.now() - startTime;

      return {
        output: completion.choices[0]?.message?.content || "",
        model: completion.model,
        prompt_tokens: completion.usage?.prompt_tokens || 0,
        completion_tokens: completion.usage?.completion_tokens || 0,
        duration_ms: durationMs,
      };
    });

    // Step 2: Save result to agent_runs
    const saveResult = await step.run("save-agent-run", async () => {
      const supabase = getSupabaseAdmin();

      const { data, error } = await supabase
        .from("agent_runs")
        .insert({
          agent_type: agent_type || "test",
          prompt_id: prompt_id || null,
          transcript_id: transcript_id || null,
          output: aiResult.output,
          model: aiResult.model,
          prompt_tokens: aiResult.prompt_tokens,
          completion_tokens: aiResult.completion_tokens,
          total_cost: 0,
          duration_ms: aiResult.duration_ms,
          status: "completed",
          is_test_run: true,
          test_transcript_id: null,
          metadata: {
            test_transcript_name,
            triggered_by: "inngest",
          },
          prompt_sent: `[Inngest] Agent: ${agent_type}`,
          system_prompt: system_prompt || null,
          user_message: user_prompt_template || null,
        })
        .select("id, created_at")
        .single();

      if (error) {
        throw new Error(`Failed to save agent run: ${error.message}`);
      }

      return { run_id: data.id, created_at: data.created_at };
    });

    return {
      success: true,
      run_id: saveResult.run_id,
      output: aiResult.output,
      model: aiResult.model,
      duration_ms: aiResult.duration_ms,
    };
  }
);

// ============================================
// Company Website Analysis
// Replaces the N8N company analysis webhook
// ============================================
const analyzeCompanyWebsite = inngest.createFunction(
  { id: "analyze-company-website", name: "Analyze Company Website" },
  { event: "company/analyze.requested" },
  async ({ event, step }) => {
    const { website, company_id, company_name, user_id } = event.data;

    // TODO: Implement the actual scraping and analysis logic.
    // Previously this was handled by N8N nodes that:
    // 1. Scraped the company website
    // 2. Extracted company info, products, ICP, buyer personas, talk tracks, objections
    // 3. Generated markdown summary and structured JSON analysis
    // 4. Stored results in webhook_data table via POST /api/webhook
    //
    // For now, this function receives the event and logs it.
    // The actual implementation should use a web scraping service
    // and LLM-based extraction to replicate the N8N workflow.

    const result = await step.run("analyze-website", async () => {
      console.log("[Inngest] Company website analysis requested:", {
        website,
        company_id,
        company_name,
        user_id,
      });

      // Placeholder: return empty analysis
      // Replace this with actual scraping + LLM analysis logic
      return {
        markdown: "",
        analysis: null,
        status: "not_implemented",
      };
    });

    return {
      success: result.status !== "not_implemented",
      markdown: result.markdown,
      analysis: result.analysis,
    };
  }
);

// ============================================
// Transcript Sync (Fireflies)
// Replaces the N8N sync webhook on dashboard
// ============================================
const syncTranscripts = inngest.createFunction(
  { id: "sync-transcripts", name: "Sync Transcripts from Fireflies" },
  { event: "transcripts/sync.requested" },
  async ({ event, step }) => {
    const { user_id, skip, token } = event.data;

    // TODO: Implement the actual Fireflies sync logic.
    // Previously this was handled by an N8N workflow that:
    // 1. Called the Fireflies GraphQL API with the user's API token
    // 2. Fetched new transcripts (skipping already-synced ones)
    // 3. Processed and stored them in the transcripts table
    //
    // For now, this function receives the event and logs it.
    // The actual implementation should call the Fireflies API directly.

    const result = await step.run("sync-from-fireflies", async () => {
      console.log("[Inngest] Transcript sync requested:", {
        user_id,
        skip,
        has_token: !!token,
      });

      // Placeholder: return empty sync result
      // Replace this with actual Fireflies API integration
      return {
        synced_count: 0,
        status: "not_implemented",
      };
    });

    return {
      success: result.status !== "not_implemented",
      synced_count: result.synced_count,
    };
  }
);

// ============================================
// Fetch All Transcripts to Temp Table
// Syncs ALL transcripts from Fireflies to temp_transcripts table
// for user selection before importing
// Uses proper pagination like the N8N workflow
// ============================================
const FIREFLIES_API_URL = "https://api.fireflies.ai/graphql";
const FIREFLIES_PAGE_SIZE = 50;
const FIREFLIES_DAYS_BACK = 60; // Fetch transcripts from last 60 days

// Helper: Fetch a page of transcripts (lightweight - just metadata)
// Uses fromDate parameter (ISO 8601) instead of deprecated date parameter
async function fetchTranscriptsPage(token: string, skip: number, fromDate: string): Promise<{
  transcripts: any[];
  hasMore: boolean;
  error?: string;
  isAuthError?: boolean;
  retryAfter?: string;
}> {
  // Use fromDate (ISO 8601) instead of deprecated date parameter
  const query = `
    query GetTranscripts($limit: Int, $skip: Int, $fromDate: DateTime) {
      transcripts(limit: $limit, skip: $skip, fromDate: $fromDate) {
        id
        title
        duration
        date
        organizer_email
        participants
        host_email
      }
    }
  `;

  try {
    const response = await fetch(FIREFLIES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        variables: {
          limit: FIREFLIES_PAGE_SIZE,
          skip,
          fromDate: fromDate, // ISO 8601 format (e.g., "2024-01-01T00:00:00.000Z")
        },
      }),
    });

    // Handle authentication errors specifically
    if (response.status === 401 || response.status === 403) {
      return {
        transcripts: [],
        hasMore: false,
        error: "Invalid or expired Fireflies API token. Please reconnect Fireflies in settings.",
        isAuthError: true,
      };
    }

    // Handle rate limiting
    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      const retryAfter = data.errors?.[0]?.extensions?.retryAfter;
      return {
        transcripts: [],
        hasMore: true, // Signal to retry
        error: "Rate limited by Fireflies API",
        retryAfter,
      };
    }

    if (!response.ok) {
      return {
        transcripts: [],
        hasMore: false,
        error: `Fireflies API error: ${response.status}`,
      };
    }

    const data = await response.json();

    if (data.errors) {
      // Check for auth errors in GraphQL response
      const authError = data.errors.some((e: any) =>
        e.extensions?.code === "UNAUTHENTICATED" ||
        e.message?.toLowerCase().includes("unauthorized")
      );
      if (authError) {
        return {
          transcripts: [],
          hasMore: false,
          error: "Invalid or expired Fireflies API token. Please reconnect Fireflies in settings.",
          isAuthError: true,
        };
      }
      return {
        transcripts: [],
        hasMore: false,
        error: `Fireflies GraphQL error: ${JSON.stringify(data.errors)}`,
      };
    }

    const transcripts = data.data?.transcripts || [];
    return {
      transcripts,
      hasMore: transcripts.length >= FIREFLIES_PAGE_SIZE,
    };
  } catch (error: any) {
    console.error("[Inngest] Error fetching page from Fireflies:", error);
    return {
      transcripts: [],
      hasMore: false,
      error: error.message,
    };
  }
}

// Helper: Delay function for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const fetchAllTranscriptsToTemp = inngest.createFunction(
  { id: "fetch-all-transcripts-temp", name: "Fetch All Transcripts to Temp" },
  { event: "transcripts/fetch-all.requested" },
  async ({ event, step }) => {
    const { user_id, token } = event.data;

    if (!token) {
      return {
        success: false,
        error: "Fireflies API token is required",
        synced_count: 0,
      };
    }

    // Step 1: Update user sync status
    await step.run("update-sync-status-start", async () => {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("users")
        .update({ transcript_sync_status: "syncing" })
        .eq("id", user_id);
    });

    // Step 2: Fetch all transcripts with pagination (like N8N workflow)
    const allTranscripts = await step.run("fetch-all-pages", async () => {
      const fromDate = new Date(Date.now() - FIREFLIES_DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();
      const transcripts: any[] = [];
      let skip = 0;
      let hasMore = true;
      let pageCount = 0;
      let consecutiveErrors = 0;
      let lastError: string | null = null;
      let isAuthError = false;
      const maxPages = 20; // Safety limit: 20 pages * 50 = 1000 transcripts max
      const maxConsecutiveErrors = 3;
      const baseDelay = 2000; // Base delay: 2 seconds

      console.log(`[Inngest] Starting Fireflies sync from ${fromDate}`);

      while (hasMore && pageCount < maxPages && consecutiveErrors < maxConsecutiveErrors) {
        // Exponential backoff: 2s, 4s, 8s based on consecutive errors
        const delayMs = baseDelay * Math.pow(2, consecutiveErrors);
        if (pageCount > 0 || consecutiveErrors > 0) {
          console.log(`[Inngest] Waiting ${delayMs}ms before next request...`);
          await delay(delayMs);
        }

        console.log(`[Inngest] Fetching page ${pageCount + 1}, skip=${skip}`);
        const result = await fetchTranscriptsPage(token, skip, fromDate);

        if (result.error) {
          console.error(`[Inngest] Error on page ${pageCount + 1}:`, result.error);
          lastError = result.error;

          // Check for auth errors - stop immediately
          if (result.isAuthError) {
            isAuthError = true;
            break;
          }

          // Handle rate limiting with retry
          if (result.retryAfter) {
            const retryDelay = new Date(result.retryAfter).getTime() - Date.now();
            if (retryDelay > 0 && retryDelay < 60000) { // Wait up to 1 minute
              console.log(`[Inngest] Rate limited, waiting ${retryDelay}ms...`);
              await delay(retryDelay);
              consecutiveErrors++;
              continue; // Retry same page
            }
          }

          consecutiveErrors++;
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error(`[Inngest] Max consecutive errors reached, stopping`);
            break;
          }
          continue; // Try next page
        }

        // Success - reset error counter
        consecutiveErrors = 0;
        transcripts.push(...result.transcripts);
        hasMore = result.hasMore;
        skip += FIREFLIES_PAGE_SIZE;
        pageCount++;

        console.log(`[Inngest] Page ${pageCount}: fetched ${result.transcripts.length} transcripts, total: ${transcripts.length}`);
      }

      return {
        transcripts,
        totalPages: pageCount,
        status: isAuthError ? "auth_error" : consecutiveErrors >= maxConsecutiveErrors ? "partial" : "success",
        lastError,
        isAuthError,
      };
    });

    // Handle auth errors first
    if (allTranscripts.isAuthError) {
      await step.run("update-sync-status-auth-error", async () => {
        const supabase = getSupabaseAdmin();
        await supabase
          .from("users")
          .update({
            transcript_sync_status: "error",
            last_transcript_sync: new Date().toISOString(),
          })
          .eq("id", user_id);
      });

      return {
        success: false,
        synced_count: 0,
        total_fetched: 0,
        error: allTranscripts.lastError || "Authentication failed",
        message: "Fireflies API token is invalid or expired. Please reconnect Fireflies in settings.",
      };
    }

    if (allTranscripts.transcripts.length === 0) {
      // No transcripts found - update status and return
      const status = allTranscripts.status === "partial" ? "error" : "completed";
      await step.run("update-sync-status-empty", async () => {
        const supabase = getSupabaseAdmin();
        await supabase
          .from("users")
          .update({
            transcript_sync_status: status,
            last_transcript_sync: new Date().toISOString(),
          })
          .eq("id", user_id);
      });

      return {
        success: status === "completed",
        synced_count: 0,
        total_fetched: 0,
        message: status === "completed"
          ? "No transcripts found in the last 60 days"
          : `Sync failed after retries: ${allTranscripts.lastError}`,
      };
    }

    // Step 3: Upsert transcripts to temp_transcripts table
    const upsertResult = await step.run("upsert-temp-transcripts", async () => {
      const supabase = getSupabaseAdmin();
      const transcripts = allTranscripts.transcripts;

      // Helper function to safely convert Fireflies date to ISO string
      const convertFirefliesDate = (dateValue: any): string | null => {
        if (!dateValue) return null;
        try {
          // If it's a number, check if it's seconds or milliseconds
          if (typeof dateValue === "number") {
            // Unix timestamps in seconds are typically 10 digits (before year 2286)
            // Unix timestamps in milliseconds are typically 13 digits
            const timestamp = dateValue > 9999999999 ? dateValue : dateValue * 1000;
            const date = new Date(timestamp);
            // Validate the date is reasonable (between 2000 and 2100)
            if (date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
              return date.toISOString();
            }
          }
          // If it's already a string, try to parse it
          if (typeof dateValue === "string") {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
              return date.toISOString();
            }
          }
          console.warn("[Inngest] Invalid date value:", dateValue);
          return null;
        } catch (e) {
          console.warn("[Inngest] Error converting date:", dateValue, e);
          return null;
        }
      };

      // Map Fireflies data to temp_transcripts schema
      const tempTranscripts = transcripts.map((t: any) => ({
        user_id,
        fireflies_id: String(t.id), // Ensure fireflies_id is a string
        title: t.title || "Untitled Meeting",
        duration: t.duration ? Math.round(t.duration / 60) : null, // Convert seconds to minutes
        organizer_email: t.organizer_email || t.host_email || null,
        participants: Array.isArray(t.participants) ? t.participants : [],
        meeting_date: convertFirefliesDate(t.date),
        synced_at: new Date().toISOString(),
      }));

      console.log(`[Inngest] Upserting ${tempTranscripts.length} transcripts for user ${user_id}`);
      console.log("[Inngest] Sample record:", JSON.stringify(tempTranscripts[0], null, 2));

      // Upsert in batches of 50
      const batchSize = 50;
      let syncedCount = 0;
      let errorCount = 0;
      let lastError: string | null = null;

      for (let i = 0; i < tempTranscripts.length; i += batchSize) {
        const batch = tempTranscripts.slice(i, i + batchSize);

        const { data, error } = await supabase
          .from("temp_transcripts")
          .upsert(batch, {
            onConflict: "user_id,fireflies_id",
            ignoreDuplicates: false,
          })
          .select("id");

        if (error) {
          console.error("[Inngest] Error upserting batch:", {
            error: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            batchStart: i,
            batchSize: batch.length,
          });
          lastError = error.message;
          errorCount += batch.length;
        } else {
          console.log(`[Inngest] Successfully upserted batch: ${data?.length || batch.length} records`);
          syncedCount += batch.length;
        }
      }

      return { synced_count: syncedCount, error_count: errorCount, last_error: lastError };
    });

    // Step 4: Update user sync status based on results
    const finalStatus = allTranscripts.status === "partial"
      ? "partial"
      : upsertResult.error_count > 0
        ? "partial"
        : "completed";

    await step.run("update-sync-status-complete", async () => {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("users")
        .update({
          transcript_sync_status: finalStatus,
          last_transcript_sync: new Date().toISOString(),
        })
        .eq("id", user_id);
    });

    return {
      success: finalStatus === "completed",
      partial: finalStatus === "partial",
      synced_count: upsertResult.synced_count,
      error_count: upsertResult.error_count,
      total_fetched: allTranscripts.transcripts.length,
      pages_fetched: allTranscripts.totalPages,
      fetch_status: allTranscripts.status,
      message: finalStatus === "partial"
        ? `Synced ${upsertResult.synced_count} transcripts with some errors`
        : `Successfully synced ${upsertResult.synced_count} transcripts`,
    };
  }
);

// ============================================
// Company Prediction
// Replaces the N8N predict companies webhook
// ============================================
const predictCompanies = inngest.createFunction(
  { id: "predict-companies", name: "Predict Companies" },
  { event: "companies/predict.requested" },
  async ({ event, step }) => {
    const { user_id } = event.data;

    // TODO: Implement the actual company prediction logic.
    // Previously this was handled by an N8N workflow that:
    // 1. Analyzed user's existing data and patterns
    // 2. Predicted relevant companies for outreach
    //
    // For now, this function receives the event and logs it.

    const result = await step.run("predict-companies", async () => {
      console.log("[Inngest] Company prediction requested:", { user_id });

      return {
        predictions: [],
        status: "not_implemented",
      };
    });

    return {
      success: result.status !== "not_implemented",
      predictions: result.predictions,
    };
  }
);

// ============================================
// Transcript Embedding Ingestion
// Automatically ingests transcripts into embeddings after analysis
// ============================================
const ingestTranscriptEmbeddings = inngest.createFunction(
  { id: "ingest-transcript-embeddings", name: "Ingest Transcript Embeddings" },
  { event: "transcript/analyzed" },
  async ({ event, step }) => {
    const { transcript_id, user_id } = event.data;

    if (!transcript_id) {
      return {
        success: false,
        error: "transcript_id is required",
      };
    }

    const result = await step.run("ingest-transcript", async () => {
      try {
        await ingestTranscript(transcript_id);
        console.log(`[Inngest] Successfully ingested transcript ${transcript_id} for embeddings`);
        return { success: true, transcript_id };
      } catch (error: any) {
        console.error(`[Inngest] Error ingesting transcript ${transcript_id}:`, error);
        return { success: false, error: error.message };
      }
    });

    return result;
  }
);

// ============================================
// Company Embedding Ingestion
// Ingests company data into embeddings when updated
// ============================================
const ingestCompanyEmbeddings = inngest.createFunction(
  { id: "ingest-company-embeddings", name: "Ingest Company Embeddings" },
  { event: "company/updated" },
  async ({ event, step }) => {
    const { company_id, user_id } = event.data;

    if (!company_id || !user_id) {
      return {
        success: false,
        error: "company_id and user_id are required",
      };
    }

    const result = await step.run("ingest-company", async () => {
      try {
        await ingestCompany(company_id, user_id);
        console.log(`[Inngest] Successfully ingested company ${company_id} for embeddings`);
        return { success: true, company_id };
      } catch (error: any) {
        console.error(`[Inngest] Error ingesting company ${company_id}:`, error);
        return { success: false, error: error.message };
      }
    });

    return result;
  }
);

// ============================================
// Bulk User Data Ingestion
// Ingests all user's transcripts for semantic search
// ============================================
const bulkIngestUserData = inngest.createFunction(
  { id: "bulk-ingest-user-data", name: "Bulk Ingest User Data" },
  { event: "user/ingest-all.requested" },
  async ({ event, step }) => {
    const { user_id } = event.data;

    if (!user_id) {
      return {
        success: false,
        error: "user_id is required",
      };
    }

    const result = await step.run("bulk-ingest-transcripts", async () => {
      try {
        const stats = await ingestAllUserTranscripts(user_id);
        console.log(`[Inngest] Bulk ingestion complete for user ${user_id}:`, stats);
        return { success: true, ...stats };
      } catch (error: any) {
        console.error(`[Inngest] Error during bulk ingestion for user ${user_id}:`, error);
        return { success: false, error: error.message };
      }
    });

    return result;
  }
);

// Export all functions as an array for the serve handler
export const functions = [
  scoreTranscript,
  testPromptRunner,
  analyzeCompanyWebsite,
  syncTranscripts,
  fetchAllTranscriptsToTemp,
  predictCompanies,
  ingestTranscriptEmbeddings,
  ingestCompanyEmbeddings,
  bulkIngestUserData,
];
