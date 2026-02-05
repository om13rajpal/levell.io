import { inngest } from "@/lib/inngest";
import { runAnalysisPipeline } from "@/lib/analysis-pipeline";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { generateObject } from "ai";
import { getOpenAIModel } from "@/lib/openai";
import { ingestTranscript, ingestCompany, ingestAllUserTranscripts } from "@/lib/embeddings";
import { cleanupExpiredCache } from "@/lib/prompt-cache";
// Note: getCachedPrompt, setCachedPrompt, loadContext, formatContextForPrompt
// are available for future prompt caching integration
import { firecrawlMap, firecrawlScrape, selectPagesForICP } from "@/lib/firecrawl";
import {
  createBatches,
  delay,
  createScoringBatchJob,
  completeScoringBatchJob,
  createRecommendationJob,
  updateJobProgress,
  completeJob,
  BATCH_CONFIG,
  // Note: failJob is available but not used in onFailure handlers because
  // jobId is created inside steps and is not accessible in onFailure context
} from "@/lib/batch-processor";
import {
  ClusteringAnalysisSchema,
  UserRecommendationsSchema,
  ICPAnalysisSchema,
} from "@/types/recommendation-types";

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
// PARALLEL EXECUTION: Each transcript triggers its own instance
// 6 extraction agents run concurrently within each workflow
// ============================================
const scoreTranscript = inngest.createFunction(
  {
    id: "score-transcript-v2",
    name: "Score Transcript V2",
    // Allow multiple instances to run in parallel (up to 10 per environment)
    concurrency: { limit: 10, key: "score-v2", scope: "env" },
  },
  { event: "transcript/score.requested" },
  async ({ event, step }) => {
    const { transcript_id, user_id, call_type, company_id, batch_job_id } = event.data;

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

    // Update batch job progress if part of a batch
    if (batch_job_id) {
      await step.run("update-batch-job", async () => {
        const supabase = getSupabaseAdmin();
        const field = result.success ? "processed_count" : "failed_count";

        // Increment the appropriate counter
        const { data: job } = await supabase
          .from("scoring_batch_jobs")
          .select("processed_count, failed_count, total_transcripts")
          .eq("id", batch_job_id)
          .single();

        if (job) {
          const newCount = (job[field] || 0) + 1;
          const totalDone = (job.processed_count || 0) + (job.failed_count || 0) + 1;

          const updateData: Record<string, unknown> = { [field]: newCount };

          // Mark complete if all done
          if (totalDone >= job.total_transcripts) {
            updateData.status = "completed";
            updateData.completed_at = new Date().toISOString();
          }

          await supabase
            .from("scoring_batch_jobs")
            .update(updateData)
            .eq("id", batch_job_id);
        }
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
// Batch Score Transcripts
// Processes multiple unscored transcripts with concurrency
// ============================================
const scoreBatchTranscripts = inngest.createFunction(
  {
    id: "score-batch-transcripts",
    name: "Score Batch Transcripts",
    concurrency: { limit: 1, key: "batch-scoring", scope: "env" },
    throttle: { limit: 1, period: "5m" },
    retries: 2,
    onFailure: async ({ error }) => {
      // Log batch job failure for debugging
      console.error("[BatchScore] Function failed:", error.message);
      // LIMITATION: Cannot update job status here because jobId is created inside a step
      // and is not accessible in onFailure. The jobId would need to be passed via event
      // metadata to be available here. For now, jobs that fail before completion will
      // remain in "processing" status and should be cleaned up by a separate process.
    },
  },
  [
    { event: "transcripts/score-batch.requested" },
    { cron: "0 */2 * * *" }, // Every 2 hours
  ],
  async ({ event, step }) => {
    const triggeredBy = event?.name?.includes("cron") ? "cron" : "manual";
    const userId = event?.data?.user_id;

    // Step 1: Fetch unscored transcripts
    const transcripts = await step.run("fetch-unscored-transcripts", async () => {
      const supabase = getSupabaseAdmin();

      let query = supabase
        .from("transcripts")
        .select("id, user_id, title")
        .is("ai_overall_score", null)
        .not("sentences", "is", null);

      // Filter by user_id if provided (manual trigger from dashboard)
      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(BATCH_CONFIG.SCORING_BATCH_SIZE);

      if (error) {
        throw new Error(`Failed to fetch transcripts: ${error.message}`);
      }

      console.log(`[BatchScore] Found ${data?.length || 0} unscored transcripts${userId ? ` for user ${userId}` : ""}`);
      return data || [];
    });

    if (transcripts.length === 0) {
      return {
        success: true,
        message: "No unscored transcripts found",
        processed: 0,
        failed: 0,
      };
    }

    // Step 2: Create batch job record
    const jobId = await step.run("create-batch-job", async () => {
      return createScoringBatchJob(triggeredBy, transcripts.length);
    });

    // Step 3: Process in parallel chunks
    const results = await step.run("process-transcripts", async () => {
      const errors: Array<{ transcript_id: number; error: string }> = [];
      let processed = 0;
      let failed = 0;

      // Create chunks for parallel processing
      const chunks = createBatches(transcripts, BATCH_CONFIG.SCORING_CHUNK_SIZE);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Process chunk in parallel
        const chunkResults = await Promise.allSettled(
          chunk.map(async (t) => {
            try {
              const result = await runAnalysisPipeline({
                transcriptId: t.id,
                userId: t.user_id,
              });

              if (result.success) {
                return { success: true, transcript_id: t.id };
              } else {
                return { success: false, transcript_id: t.id, error: result.error };
              }
            } catch (error) {
              return {
                success: false,
                transcript_id: t.id,
                error: error instanceof Error ? error.message : "Unknown error",
              };
            }
          })
        );

        // Collect results
        for (const result of chunkResults) {
          if (result.status === "fulfilled") {
            if (result.value.success) {
              processed++;
            } else {
              failed++;
              errors.push({
                transcript_id: result.value.transcript_id,
                error: result.value.error || "Unknown error",
              });
            }
          } else {
            failed++;
            errors.push({
              transcript_id: 0,
              error: result.reason?.message || "Chunk processing failed",
            });
          }
        }

        // Rate limiting between chunks
        if (i < chunks.length - 1) {
          await delay(BATCH_CONFIG.RATE_LIMIT_DELAY_MS);
        }
      }

      return { processed, failed, errors };
    });

    // Step 4: Trigger embedding ingestion for successes
    if (results.processed > 0) {
      const successfulTranscripts = transcripts.filter(
        (t) => !results.errors.some((e) => e.transcript_id === t.id)
      );

      // Send individual transcript/analyzed events for each successful transcript
      const embeddingEvents = successfulTranscripts.map((t) => ({
        name: "transcript/analyzed" as const,
        data: {
          transcript_id: t.id,
          user_id: t.user_id,
        },
      }));

      if (embeddingEvents.length > 0) {
        await step.sendEvent("trigger-batch-embeddings", embeddingEvents);
      }
    }

    // Step 5: Finalize batch job
    await step.run("finalize-batch-job", async () => {
      if (jobId) {
        await completeScoringBatchJob(
          jobId,
          results.processed,
          results.failed,
          results.errors.length > 0 ? results.errors : undefined
        );
      }
    });

    return {
      success: true,
      job_id: jobId,
      total: transcripts.length,
      processed: results.processed,
      failed: results.failed,
      errors: results.errors,
    };
  }
);

// ============================================
// Company Clustering / Recommendations
// Analyzes all transcripts for a company to generate insights
// ============================================
const clusterCompanies = inngest.createFunction(
  {
    id: "cluster-companies",
    name: "Cluster Company Transcripts",
    concurrency: { limit: 2 },
    retries: 3,
    onFailure: async ({ event, error }) => {
      // Attempt to mark the job as failed
      // LIMITATION: jobId is created inside a step, so we cannot directly access it here.
      // We can only log the failure. Jobs that fail will remain in "pending" or "processing"
      // status and should be cleaned up by a separate monitoring process.
      const { user_id, company_id } = event.data.event?.data || {};
      console.error("[Cluster] Function failed:", {
        error: error.message,
        user_id,
        company_id,
      });
    },
  },
  [
    { event: "companies/cluster.requested" },
    { cron: "0 2 * * 0" }, // Weekly Sunday 2AM
  ],
  async ({ event, step }) => {
    const { user_id, company_id } = event?.data || {};

    // Step 1: Get companies to cluster
    const companies = await step.run("fetch-companies", async () => {
      const supabase = getSupabaseAdmin();

      let query = supabase
        .from("companies")
        .select("id, company_name, user_id")
        .not("company_name", "is", null);

      // If specific user, filter by user
      if (user_id) {
        query = query.eq("user_id", user_id);
      }

      // If specific company, filter by company
      if (company_id) {
        query = query.eq("id", company_id);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        throw new Error(`Failed to fetch companies: ${error.message}`);
      }

      return data || [];
    });

    if (companies.length === 0) {
      return { success: true, message: "No companies to cluster", processed: 0 };
    }

    // Step 2: Create job record
    const jobId = await step.run("create-job", async () => {
      return createRecommendationJob(
        "company_clustering",
        user_id || companies[0].user_id,
        company_id?.toString(),
        companies.length
      );
    });

    // Step 3: Process each company
    const results = await step.run("cluster-all-companies", async () => {
      const supabase = getSupabaseAdmin();
      let processed = 0;
      let failed = 0;

      for (const company of companies) {
        try {
          // Get all transcripts for this company
          const { data: companyCalls } = await supabase
            .from("company_calls")
            .select("transcript_id")
            .eq("company_id", company.id);

          if (!companyCalls || companyCalls.length === 0) {
            console.log(`[Cluster] No transcripts for company ${company.id}`);
            continue;
          }

          const transcriptIds = companyCalls.map((c) => c.transcript_id);

          // Fetch transcript data
          const { data: transcripts } = await supabase
            .from("transcripts")
            .select("id, title, ai_summary, ai_overall_score, ai_deal_signal")
            .in("id", transcriptIds)
            .not("ai_summary", "is", null);

          if (!transcripts || transcripts.length === 0) {
            console.log(`[Cluster] No analyzed transcripts for company ${company.id}`);
            continue;
          }

          // Batch transcripts for AI analysis
          const batches = createBatches(transcripts, BATCH_CONFIG.BATCH_SIZE);
          const allInsights: string[] = [];

          for (const batch of batches) {
            // Format batch for AI
            const batchSummary = batch.map((t, i) => {
              return `Call ${i + 1}: "${t.title || "Untitled"}"
Score: ${t.ai_overall_score || "N/A"}/100, Signal: ${t.ai_deal_signal || "N/A"}
Summary: ${t.ai_summary || "No summary"}`;
            }).join("\n\n---\n\n");

            // AI analysis
            const { object } = await generateObject({
              model: getOpenAIModel("gpt-4o-mini"),
              schema: ClusteringAnalysisSchema,
              system: `You are a sales analytics expert. Analyze these call transcripts for a company and extract patterns, recommendations, and insights. Be specific and actionable.`,
              prompt: `Company: ${company.company_name}
Total Transcripts: ${transcripts.length}

Calls:
${batchSummary}

Analyze these calls and provide:
1. Strategic recommendations for this account
2. Key strengths in the relationship
3. Areas needing focus
4. Relationship dynamics
5. Risks to monitor
6. Common pain points and objections`,
            });

            allInsights.push(JSON.stringify(object));
          }

          // Merge insights if multiple batches
          const finalAnalysis = JSON.parse(allInsights[0]);
          if (allInsights.length > 1) {
            // Combine arrays from multiple batches
            for (let i = 1; i < allInsights.length; i++) {
              const insight = JSON.parse(allInsights[i]);
              finalAnalysis.recommendations = [...(finalAnalysis.recommendations || []), ...(insight.recommendations || [])];
              finalAnalysis.risks = [...(finalAnalysis.risks || []), ...(insight.risks || [])];
              finalAnalysis.pain_points_objections = [...(finalAnalysis.pain_points_objections || []), ...(insight.pain_points_objections || [])];
            }
          }

          // Store in company_recommendations
          await supabase
            .from("company_recommendations")
            .upsert({
              company_id: company.id,
              user_id: company.user_id,
              recommendations: finalAnalysis.recommendations || [],
              key_strengths: finalAnalysis.key_strengths || [],
              focus_areas: finalAnalysis.focus_areas || [],
              relationships: finalAnalysis.relationships || [],
              risks: finalAnalysis.risks || [],
              pain_points_objections: finalAnalysis.pain_points_objections || [],
              patterns: finalAnalysis.patterns || null,
              total_transcripts: transcripts.length,
              last_analyzed_at: new Date().toISOString(),
            }, { onConflict: "company_id" });

          processed++;
          console.log(`[Cluster] Processed company ${company.id}: ${company.company_name}`);

          // Update job progress
          if (jobId) {
            await updateJobProgress(jobId, processed, companies.length);
          }
        } catch (error) {
          console.error(`[Cluster] Error processing company ${company.id}:`, error);
          failed++;
        }
      }

      return { processed, failed };
    });

    // Step 4: Complete job
    await step.run("complete-job", async () => {
      if (jobId) {
        await completeJob(jobId, { processed: results.processed, failed: results.failed });
      }
    });

    return {
      success: true,
      companies_processed: results.processed,
      companies_failed: results.failed,
      job_id: jobId,
    };
  }
);

// ============================================
// User Recommendations
// Generates personalized coaching insights for users
// ============================================
const generateUserRecommendations = inngest.createFunction(
  {
    id: "user-ai-recommendations",
    name: "Generate User Recommendations",
    concurrency: { limit: 5 },
    onFailure: async ({ event, error }) => {
      // Attempt to mark the job as failed
      // LIMITATION: jobId is created inside a step, so we cannot directly access it here.
      // We can only log the failure. Jobs that fail will remain in "pending" or "processing"
      // status and should be cleaned up by a separate monitoring process.
      const { user_id } = event.data.event?.data || {};
      console.error("[UserRecs] Function failed:", {
        error: error.message,
        user_id,
      });
    },
  },
  [
    { event: "user/recommendations.requested" },
    { cron: "0 3 * * *" }, // Daily 3AM
  ],
  async ({ event, step }) => {
    const { user_id } = event?.data || {};

    // Step 1: Get users to analyze
    const users = await step.run("fetch-users", async () => {
      const supabase = getSupabaseAdmin();

      let query = supabase.from("users").select("id, email, full_name");

      if (user_id) {
        query = query.eq("id", user_id);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      return data || [];
    });

    if (users.length === 0) {
      return { success: true, message: "No users to analyze", processed: 0 };
    }

    // Step 2: Create job record
    const jobId = await step.run("create-job", async () => {
      const targetUserId = user_id || users[0]?.id;
      if (!targetUserId) return null;

      return createRecommendationJob(
        "user_recommendations",
        targetUserId,
        user_id || undefined,
        users.length
      );
    });

    // Step 3: Process each user
    const results = await step.run("generate-recommendations", async () => {
      const supabase = getSupabaseAdmin();
      let processed = 0;
      let failed = 0;

      for (const user of users) {
        try {
          // Get user's transcripts
          const { data: transcripts } = await supabase
            .from("transcripts")
            .select("id, title, ai_summary, ai_overall_score, ai_deal_signal, created_at")
            .eq("user_id", user.id)
            .not("ai_summary", "is", null)
            .order("created_at", { ascending: false })
            .limit(50);

          if (!transcripts || transcripts.length < 3) {
            console.log(`[UserRecs] Not enough transcripts for user ${user.id}`);
            continue;
          }

          // Batch transcripts
          const batches = createBatches(transcripts, BATCH_CONFIG.BATCH_SIZE);
          const allInsights: string[] = [];

          for (const batch of batches) {
            const batchSummary = batch.map((t, i) => {
              return `Call ${i + 1}: "${t.title || "Untitled"}" (${t.created_at})
Score: ${t.ai_overall_score || "N/A"}/100, Signal: ${t.ai_deal_signal || "N/A"}
Summary: ${t.ai_summary || "No summary"}`;
            }).join("\n\n---\n\n");

            const { object } = await generateObject({
              model: getOpenAIModel("gpt-4o-mini"),
              schema: UserRecommendationsSchema,
              system: `You are a sales coaching expert. Analyze these call transcripts and provide personalized coaching recommendations for this sales rep. Focus on patterns, strengths, and actionable improvements.`,
              prompt: `Sales Rep: ${user.full_name || user.email}
Total Analyzed Calls: ${transcripts.length}

Recent Calls:
${batchSummary}

Provide:
1. Actionable recommendations for improvement
2. Key strengths to leverage
3. Focus areas for development
4. Relationship management insights
5. Coaching insights with trends`,
            });

            allInsights.push(JSON.stringify(object));
          }

          // Merge insights
          const finalRecs = JSON.parse(allInsights[0]);
          if (allInsights.length > 1) {
            for (let i = 1; i < allInsights.length; i++) {
              const insight = JSON.parse(allInsights[i]);
              finalRecs.recommendations = [...(finalRecs.recommendations || []), ...(insight.recommendations || [])].slice(0, 10);
              finalRecs.focus_areas = [...(finalRecs.focus_areas || []), ...(insight.focus_areas || [])].slice(0, 5);
            }
          }

          // Store in user_recommendations
          await supabase
            .from("user_recommendations")
            .upsert({
              user_id: user.id,
              recommendations: finalRecs.recommendations || [],
              key_strengths: finalRecs.key_strengths || [],
              focus_areas: finalRecs.focus_areas || [],
              relationships: finalRecs.relationships || [],
              coaching_insights: finalRecs.coaching_insights || null,
              total_transcripts: transcripts.length,
              last_analyzed_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

          processed++;
          console.log(`[UserRecs] Generated recommendations for user ${user.id}`);

          // Update job progress
          if (jobId) {
            await updateJobProgress(jobId, processed, users.length);
          }
        } catch (error) {
          console.error(`[UserRecs] Error for user ${user.id}:`, error);
          failed++;
        }
      }

      return { processed, failed };
    });

    // Step 4: Complete job
    await step.run("complete-job", async () => {
      if (jobId) {
        await completeJob(jobId, {
          users_processed: results.processed,
          users_failed: results.failed,
        });
      }
    });

    return {
      success: true,
      users_processed: results.processed,
      users_failed: results.failed,
      job_id: jobId,
    };
  }
);

// ============================================
// Company Website Analysis (ICP Research)
// Scrapes and analyzes company websites for ICP data
// ============================================
const analyzeCompanyWebsite = inngest.createFunction(
  {
    id: "analyze-company-website",
    name: "Analyze Company Website",
    retries: 2,
    onFailure: async ({ event, error }) => {
      // Update ICP status to failed when the function fails
      // In Inngest onFailure, the original event is at event.data.event
      const company_id = event.data.event?.data?.company_id;
      if (company_id) {
        try {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          await supabase
            .from("company_icp")
            .update({
              scrape_status: "failed",
            })
            .eq("company_id", company_id);
          console.error(`[ICP] Function failed for company ${company_id}:`, error.message);
        } catch (e) {
          console.error("[ICP] Failed to update status on error:", e);
        }
      } else {
        console.error("[ICP] Function failed but could not extract company_id:", error.message);
      }
    },
  },
  { event: "company/analyze.requested" },
  async ({ event, step }) => {
    const { website, company_id, company_name, user_id } = event.data;

    if (!website) {
      return { success: false, error: "Website URL is required" };
    }

    // Step 1: Create or update company_icp record
    await step.run("init-icp-record", async () => {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("company_icp")
        .upsert({
          company_id,
          user_id,
          website,
          scrape_status: "scraping",
        }, { onConflict: "company_id" });
    });

    // Step 2: Map website URLs
    const siteMap = await step.run("map-website", async () => {
      const result = await firecrawlMap(website, { limit: 50 });
      if (!result.success) {
        throw new Error(`Failed to map website: ${result.error}`);
      }
      return result.links;
    });

    // Step 3: Select multiple pages for ICP analysis
    const targetUrls = await step.run("select-pages", async () => {
      const pages = selectPagesForICP(siteMap, { maxPages: 3 });
      if (pages.length === 0) return [website];
      return pages;
    });

    // Step 4: Scrape multiple pages
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

    // Step 5: Update scrape status with combined content
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

    // Step 6: AI Analysis with combined content
    const analysis = await step.run("analyze-content", async () => {
      const combinedMarkdown = allContent
        .map(c => `## Page: ${c.url}\n\n${c.markdown}`)
        .join("\n\n---\n\n");

      const { object } = await generateObject({
        model: getOpenAIModel("gpt-4o"),
        schema: ICPAnalysisSchema,
        system: `You are a sales intelligence expert. Analyze this company's website content and extract comprehensive information about the company, their products/services, ideal customer profile, buyer personas, talk tracks, and objection handling strategies.

Be thorough but realistic - only include information that can be reasonably inferred from the content. You are analyzing multiple pages from the same company website.`,
        prompt: `Company: ${company_name}
Website: ${website}
Pages Analyzed: ${allContent.length}

Content:
${combinedMarkdown}

Extract:
1. Company information (name, industry, description, size, etc.)
2. Products and services with key features
3. Ideal customer profile (industries, sizes, geographies)
4. Buyer personas with their goals and challenges
5. Key talk tracks and value propositions
6. Common objections and how to handle them`,
      });

      return object;
    });

    // Step 7: Store analysis
    await step.run("store-analysis", async () => {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("company_icp")
        .update({
          company_info: analysis.company_info,
          products_and_services: analysis.products_and_services,
          ideal_customer_profile: analysis.ideal_customer_profile,
          buyer_personas: analysis.buyer_personas,
          talk_tracks: analysis.talk_tracks,
          objection_handling: analysis.objection_handling,
          scrape_status: "completed",
        })
        .eq("company_id", company_id);
    });

    // Step 8: Store ICP data in company_icp table (already done in step 7)
    // Note: The users table doesn't have a business_profile column.
    // ICP data is stored per-company in the company_icp table, not per-user.
    // If user-level ICP storage is needed in the future, a new column or table should be added.
    await step.run("log-completion", async () => {
      if (!user_id) return;
      console.log(`[ICP] Completed ICP analysis for company ${company_id} (user: ${user_id})`);
    });

    // Trigger company embedding update
    await step.sendEvent("update-company-embeddings", {
      name: "company/updated",
      data: { company_id, user_id },
    });

    return {
      success: true,
      company_id,
      company_name,
      pages_analyzed: allContent.length,
      analysis_complete: true,
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

// Fireflies transcript metadata type
interface FirefliesTranscript {
  id: string;
  title?: string;
  duration?: number;
  date?: string | number;
  organizer_email?: string;
  participants?: string[];
  host_email?: string;
}

interface GraphQLError {
  message?: string;
  extensions?: { code?: string; retryAfter?: string };
}

// Helper: Fetch a page of transcripts (lightweight - just metadata)
// Uses fromDate parameter (ISO 8601) instead of deprecated date parameter
async function fetchTranscriptsPage(token: string, skip: number, fromDate: string): Promise<{
  transcripts: FirefliesTranscript[];
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
      const authError = (data.errors as GraphQLError[]).some((e) =>
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Inngest] Error fetching page from Fireflies:", error);
    return {
      transcripts: [],
      hasMore: false,
      error: errorMessage,
    };
  }
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
      const transcripts: FirefliesTranscript[] = [];
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
      const convertFirefliesDate = (dateValue: string | number | null | undefined): string | null => {
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
      const tempTranscripts = transcripts.map((t: FirefliesTranscript) => ({
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
    const { transcript_id } = event.data;

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
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Inngest] Error ingesting transcript ${transcript_id}:`, error);
        return { success: false, error: errorMessage };
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
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Inngest] Error ingesting company ${company_id}:`, error);
        return { success: false, error: errorMessage };
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
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Inngest] Error during bulk ingestion for user ${user_id}:`, error);
        return { success: false, error: errorMessage };
      }
    });

    return result;
  }
);

// ============================================
// Prompt Cache Cleanup
// Periodically cleans up expired prompt cache entries
// ============================================
const cleanupPromptCache = inngest.createFunction(
  { id: "cleanup-prompt-cache", name: "Cleanup Prompt Cache" },
  { cron: "0 4 * * *" }, // Daily 4AM
  async ({ step }) => {
    const result = await step.run("cleanup-cache", async () => {
      const deleted = await cleanupExpiredCache();
      console.log(`[Inngest] Cleaned up ${deleted} expired prompt cache entries`);
      return { deleted };
    });

    return result;
  }
);

// Export all functions as an array for the serve handler
export const functions = [
  scoreTranscript,
  scoreBatchTranscripts,
  clusterCompanies,
  generateUserRecommendations,
  analyzeCompanyWebsite,
  testPromptRunner,
  syncTranscripts,
  fetchAllTranscriptsToTemp,
  predictCompanies,
  ingestTranscriptEmbeddings,
  ingestCompanyEmbeddings,
  bulkIngestUserData,
  cleanupPromptCache,
];
