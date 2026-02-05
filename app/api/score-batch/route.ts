import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest";

// Get admin client for auth verification
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables not configured");
  return createClient(url, key);
}

/**
 * POST /api/score-batch
 * Trigger PARALLEL scoring of unscored transcripts
 *
 * NEW: Each transcript gets its OWN Inngest workflow for true parallelism
 * - 10 calls = 10 parallel workflows running simultaneously
 * - Each workflow runs 6 extraction agents concurrently
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const admin = getSupabaseAdmin();
    const { data: { user }, error: authError } = await admin.auth.getUser(token);

    if (authError || !user) {
      console.error("[Score Batch] Auth failed:", authError?.message);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[Score Batch] Parallel scoring triggered by user:", user.id);

    // Fetch unscored transcripts for this user
    const { data: transcripts, error: fetchError } = await admin
      .from("transcripts")
      .select("id")
      .eq("user_id", user.id)
      .is("ai_overall_score", null)
      .not("sentences", "is", null)
      .order("created_at", { ascending: false })
      .limit(50); // Max 50 at a time

    if (fetchError) {
      console.error("[Score Batch] Error fetching transcripts:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch transcripts" },
        { status: 500 }
      );
    }

    if (!transcripts || transcripts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No unscored transcripts found",
        total: 0,
      });
    }

    const transcriptIds = transcripts.map((t) => t.id);
    console.log(`[Score Batch] Found ${transcriptIds.length} unscored transcripts`);

    // Create a batch job to track progress
    const { data: job } = await admin
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

    const jobId = job?.id;

    // PARALLEL EXECUTION: Send individual events for EACH transcript
    // Inngest will process these in parallel (limited by function concurrency)
    const events = transcriptIds.map((transcriptId) => ({
      name: "transcript/score.requested" as const,
      data: {
        transcript_id: transcriptId,
        user_id: user.id,
        batch_job_id: jobId,
      },
    }));

    // Send ALL events at once - Inngest handles parallel execution
    const sendResult = await inngest.send(events);

    console.log(`[Score Batch] Sent ${events.length} parallel scoring events`);

    return NextResponse.json({
      success: true,
      message: `Triggered ${transcriptIds.length} parallel scoring workflows`,
      total: transcriptIds.length,
      job_id: jobId,
      event_ids: sendResult.ids || [],
    });
  } catch (error) {
    console.error("[Score Batch] Error:", error);
    return NextResponse.json(
      { error: "Failed to trigger batch scoring", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/score-batch
 * Get batch job status and unscored transcript count
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const admin = getSupabaseAdmin();
    const { data: { user }, error: authError } = await admin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get unscored transcript count for this user
    const { count: unscoredCount, error: countError } = await admin
      .from("transcripts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("ai_overall_score", null)
      .not("sentences", "is", null);

    if (countError) {
      console.error("[Score Batch] Error getting unscored count:", countError);
    }

    // NOTE: Recent batch jobs query removed for security reasons.
    // The scoring_batch_jobs table contains data for all users and should
    // only be accessible via admin endpoints, not user-facing APIs.

    return NextResponse.json({
      success: true,
      unscored_count: unscoredCount || 0,
    });
  } catch (error) {
    console.error("[Score Batch] Error:", error);
    return NextResponse.json(
      { error: "Failed to get batch status", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
