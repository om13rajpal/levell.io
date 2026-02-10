import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Get admin client for auth verification
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables not configured");
  return createClient(url, key);
}

/**
 * GET /api/recommendations/jobs/[id]
 * Get job progress by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { error: "Invalid job ID" },
        { status: 400 }
      );
    }

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

    // Get job by ID (with user_id check for security)
    const { data: job, error: jobError } = await admin
      .from("recommendation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError) {
      if (jobError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Job not found" },
          { status: 404 }
        );
      }
      console.error("[Jobs] Error getting job:", jobError);
      return NextResponse.json(
        { error: "Failed to get job", details: jobError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        job_type: job.job_type,
        status: job.status,
        progress: job.progress,
        total_items: job.total_items,
        processed_items: job.processed_items,
        error_message: job.error_message,
        result: job.result,
        started_at: job.started_at,
        completed_at: job.completed_at,
        created_at: job.created_at,
      },
    });
  } catch (error) {
    console.error("[Jobs] Error:", error);
    return NextResponse.json(
      { error: "Failed to get job progress", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
