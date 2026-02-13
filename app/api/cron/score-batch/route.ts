import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";
import { authenticateCronRequest } from "@/lib/auth";

// GET /api/cron/score-batch
// Cron endpoint to trigger batch transcript scoring
// The Inngest function also has a built-in cron trigger (every 2 hours)
export async function GET(request: NextRequest) {
  try {
    const cronAuth = authenticateCronRequest(request);
    if (!cronAuth.ok) return cronAuth.response!;

    console.log("[Cron] Triggering batch scoring");

    // Trigger the batch scoring function
    const sendResult = await inngest.send({
      name: "transcripts/score-batch.requested",
      data: {
        triggered_by: "cron",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Batch scoring cron triggered",
      event_id: sendResult.ids?.[0] || null,
    });
  } catch (error) {
    console.error("[Cron] Error triggering batch scoring:", error);
    return NextResponse.json(
      { error: "Failed to trigger batch scoring" },
      { status: 500 }
    );
  }
}
