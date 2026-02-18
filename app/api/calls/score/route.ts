/**
 * Parallel Call Scoring API
 *
 * POST /api/calls/score - Trigger parallel scoring for multiple calls
 * GET /api/calls/score - SSE streaming for real-time progress updates
 *
 * KEY FEATURE: Each call triggers its OWN Inngest workflow
 * This enables TRUE parallelism - 10 calls = 10 parallel workflows
 * Each workflow runs 6 extraction agents concurrently
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest";
import { z } from "zod";

// ============================================
// Validation Schemas
// ============================================

const ScoreRequestSchema = z.object({
  transcriptIds: z.array(z.number()).min(1).max(50),
  userId: z.string().uuid().optional(),
  internalOrgId: z.string().uuid().optional(),
  teamId: z.number().optional(),
  // NOT used for sequential batching - each transcript gets its own workflow
  // This is kept for compatibility but doesn't affect parallelism
  concurrency: z.number().min(1).max(10).optional().default(10),
});

// ============================================
// Helper Functions
// ============================================

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables not configured");
  return createClient(url, key);
}

async function authenticateRequest(
  request: NextRequest
): Promise<{ userId: string; error?: never } | { error: string; userId?: never }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { error: "Authorization header required" };
  }

  const token = authHeader.replace("Bearer ", "");
  const admin = getSupabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(token);

  if (error || !user) {
    return { error: "Unauthorized" };
  }

  return { userId: user.id };
}

// ============================================
// POST /api/calls/score
// Trigger PARALLEL scoring workflows for multiple calls
// Each transcript gets its own Inngest workflow for true parallelism
// ============================================

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = ScoreRequestSchema.parse(body);

    const { transcriptIds, internalOrgId, teamId } = validatedData;
    const userId = validatedData.userId || auth.userId;

    console.log(`[CallScore] Triggering parallel scoring for ${transcriptIds.length} transcripts`);

    // Create a scoring job record to track this batch
    const supabase = getSupabaseAdmin();
    const { data: job, error: jobError } = await supabase
      .from("scoring_batch_jobs")
      .insert({
        status: "processing",
        triggered_by: "manual",
        total_transcripts: transcriptIds.length,
        processed_count: 0,
        failed_count: 0,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError) {
      console.error("[CallScore] Failed to create job record:", jobError);
    }

    const jobId = job?.id;

    // PARALLEL EXECUTION: Send individual events for EACH transcript
    // Inngest will process these in parallel (limited by function concurrency settings)
    const events = transcriptIds.map((transcriptId) => ({
      name: "transcript/score.requested" as const,
      data: {
        transcript_id: transcriptId,
        user_id: userId,
        internal_org_id: internalOrgId,
        team_id: teamId,
        batch_job_id: jobId, // For tracking
      },
    }));

    // Send ALL events at once - Inngest handles parallel execution
    const sendResult = await inngest.send(events);

    console.log(`[CallScore] Sent ${events.length} parallel scoring events, IDs: ${sendResult.ids?.join(", ")}`);

    return NextResponse.json({
      success: true,
      data: {
        total: transcriptIds.length,
        jobId,
        eventIds: sendResult.ids || [],
        message: `Triggered ${transcriptIds.length} parallel scoring workflows`,
      },
    });
  } catch (error) {
    console.error("[CallScore POST] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to trigger scoring", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/calls/score
// SSE streaming for real-time progress updates
// ============================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get("jobId");
  const transcriptIds = searchParams.get("transcriptIds")?.split(",").map(Number);

  if (!jobId && !transcriptIds?.length) {
    return NextResponse.json(
      { error: "jobId or transcriptIds query parameter required" },
      { status: 400 }
    );
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const supabase = getSupabaseAdmin();
      let lastCheck = new Date();
      let completedCount = 0;
      let totalCount = transcriptIds?.length || 0;

      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Poll for updates
      const checkProgress = async () => {
        try {
          if (jobId) {
            // Check job status
            const { data: jobData } = await supabase
              .from("scoring_batch_jobs")
              .select("*")
              .eq("id", jobId)
              .single();

            if (jobData) {
              totalCount = jobData.total_transcripts;
              completedCount = jobData.processed_count + jobData.failed_count;

              sendEvent({
                type: "progress",
                jobId,
                total: totalCount,
                processed: jobData.processed_count,
                failed: jobData.failed_count,
                status: jobData.status,
              });

              if (jobData.status === "completed" || jobData.status === "failed") {
                sendEvent({ type: "done", jobId, status: jobData.status });
                controller.close();
                return true;
              }
            }
          } else if (transcriptIds?.length) {
            // Check individual transcript statuses
            const { data: transcripts } = await supabase
              .from("transcripts")
              .select("id, ai_overall_score, ai_deal_signal, ai_analyzed_at")
              .in("id", transcriptIds)
              .gt("ai_analyzed_at", lastCheck.toISOString());

            if (transcripts?.length) {
              for (const t of transcripts) {
                sendEvent({
                  type: "completed",
                  transcriptId: t.id,
                  aiScore: t.ai_overall_score,
                  dealSignal: t.ai_deal_signal,
                });
              }
              completedCount += transcripts.length;
              lastCheck = new Date();
            }

            if (completedCount >= totalCount) {
              sendEvent({ type: "done", total: totalCount, completed: completedCount });
              controller.close();
              return true;
            }
          }

          return false;
        } catch (error) {
          console.error("[CallScore SSE] Error checking progress:", error);
          sendEvent({ type: "error", message: "Failed to check progress" });
          return false;
        }
      };

      // Initial check
      await checkProgress();

      // Poll every 2 seconds for up to 5 minutes
      const maxPolls = 150;
      let polls = 0;

      const pollInterval = setInterval(async () => {
        polls++;
        const done = await checkProgress();

        if (done || polls >= maxPolls) {
          clearInterval(pollInterval);
          if (!done) {
            sendEvent({ type: "timeout", message: "Progress check timed out" });
          }
          controller.close();
        }
      }, 2000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
