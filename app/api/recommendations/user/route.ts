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
 * POST /api/recommendations/user
 * Trigger user recommendations generation
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
      console.error("[UserRecs] Auth failed:", authError?.message);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[UserRecs] User recommendations triggered by user:", user.id);

    // Trigger the recommendations function
    const sendResult = await inngest.send({
      name: "user/recommendations.requested",
      data: {
        user_id: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "User recommendations job queued",
      event_id: sendResult.ids?.[0] || null,
    });
  } catch (error) {
    console.error("[UserRecs] Error:", error);
    return NextResponse.json(
      { error: "Failed to trigger recommendations", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommendations/user
 * Get user's recommendations and coaching insights
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

    // Get user recommendations
    const { data: recommendations, error: recsError } = await admin
      .from("user_recommendations")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (recsError && recsError.code !== "PGRST116") {
      console.error("[UserRecs] Error getting recommendations:", recsError);
    }

    // Get user's transcript count for context
    const { count: transcriptCount, error: countError } = await admin
      .from("transcripts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("ai_overall_score", "is", null);

    if (countError) {
      console.error("[UserRecs] Error getting transcript count:", countError);
    }

    // Get recent recommendation jobs for this user
    const { data: recentJobs, error: jobsError } = await admin
      .from("recommendation_jobs")
      .select("*")
      .eq("user_id", user.id)
      .eq("job_type", "user_recommendations")
      .order("created_at", { ascending: false })
      .limit(3);

    if (jobsError) {
      console.error("[UserRecs] Error getting recent jobs:", jobsError);
    }

    return NextResponse.json({
      success: true,
      recommendations: recommendations || null,
      analyzed_transcripts: transcriptCount || 0,
      recent_jobs: recentJobs || [],
    });
  } catch (error) {
    console.error("[UserRecs] Error:", error);
    return NextResponse.json(
      { error: "Failed to get recommendations", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
