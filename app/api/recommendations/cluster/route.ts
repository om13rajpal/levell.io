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
 * POST /api/recommendations/cluster
 * Trigger company clustering for recommendations
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
      console.error("[Cluster] Auth failed:", authError?.message);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse optional company_id from request body (UUID string)
    let company_id: string | undefined;
    try {
      const body = await request.json();
      company_id = body.company_id;
    } catch {
      // No body or invalid JSON - that's fine
    }

    console.log("[Cluster] Company clustering triggered by user:", user.id, company_id ? `for company ${company_id}` : "for all companies");

    // Trigger the clustering function
    const sendResult = await inngest.send({
      name: "companies/cluster.requested",
      data: {
        user_id: user.id,
        company_id,
      },
    });

    return NextResponse.json({
      success: true,
      message: company_id ? `Clustering job queued for company ${company_id}` : "Clustering job queued for all companies",
      event_id: sendResult.ids?.[0] || null,
    });
  } catch (error) {
    console.error("[Cluster] Error:", error);
    return NextResponse.json(
      { error: "Failed to trigger clustering", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommendations/cluster
 * Get clustering status and company recommendations
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

    // Get company_id from query params if provided
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("company_id");

    if (companyId) {
      // Get specific company recommendations (company_id is UUID)
      const { data: recommendations, error } = await admin
        .from("external_org_recommendations")
        .select("*")
        .eq("company_id", companyId)
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("[Cluster] Error getting recommendations:", error);
      }

      return NextResponse.json({
        success: true,
        company_id: companyId,
        recommendations: recommendations || null,
      });
    }

    // Get all company recommendations for user
    const { data: allRecommendations, error: recsError } = await admin
      .from("external_org_recommendations")
      .select(`
        *,
        external_org:company_id (id, company_name, domain)
      `)
      .eq("user_id", user.id)
      .order("last_analyzed_at", { ascending: false });

    if (recsError) {
      console.error("[Cluster] Error getting all recommendations:", recsError);
    }

    // Get recent clustering jobs
    const { data: recentJobs, error: jobsError } = await admin
      .from("recommendation_jobs")
      .select("*")
      .eq("user_id", user.id)
      .eq("job_type", "company_clustering")
      .order("created_at", { ascending: false })
      .limit(5);

    if (jobsError) {
      console.error("[Cluster] Error getting recent jobs:", jobsError);
    }

    return NextResponse.json({
      success: true,
      recommendations: allRecommendations || [],
      recent_jobs: recentJobs || [],
    });
  } catch (error) {
    console.error("[Cluster] Error:", error);
    return NextResponse.json(
      { error: "Failed to get cluster status", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
