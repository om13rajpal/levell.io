import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";
import { authenticateCronRequest } from "@/lib/auth";

// GET /api/cron/cluster-companies
// Cron endpoint to trigger company clustering
// The Inngest function also has a built-in cron trigger (weekly Sunday 2AM)
export async function GET(request: NextRequest) {
  try {
    const cronAuth = authenticateCronRequest(request);
    if (!cronAuth.ok) return cronAuth.response!;

    console.log("[Cron] Triggering company clustering");

    // Trigger the clustering function (for all users/companies)
    const sendResult = await inngest.send({
      name: "companies/cluster.requested",
      data: {
        triggered_by: "cron",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Company clustering cron triggered",
      event_id: sendResult.ids?.[0] || null,
    });
  } catch (error) {
    console.error("[Cron] Error triggering company clustering:", error);
    return NextResponse.json(
      { error: "Failed to trigger company clustering" },
      { status: 500 }
    );
  }
}
