import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";

// GET /api/cron/cluster-companies
// Cron endpoint to trigger company clustering
// The Inngest function also has a built-in cron trigger (weekly Sunday 2AM)
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret - fail closed (require CRON_SECRET to be configured)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[Cron] CRON_SECRET environment variable not configured");
      return NextResponse.json(
        { error: "Cron endpoint not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("[Cron] Invalid or missing authorization");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
