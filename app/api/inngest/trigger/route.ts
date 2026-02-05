import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest";

// Allowed events that can be triggered from client-side
const ALLOWED_EVENTS = [
  "transcripts/fetch-all.requested",
  "transcripts/sync.requested",
  "transcript/score.requested",
  "transcripts/score-batch.requested",
  "transcripts/score-parallel.requested", // New: trigger parallel scoring via /api/calls/score
  "company/analyze.requested",
  "company/updated",
  "companies/cluster.requested",
  "companies/predict.requested",
  "prompt/test.requested",
  "user/ingest-all.requested",
  "user/recommendations.requested",
];

// Get admin client for auth verification
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables not configured");
  return createClient(url, key);
}

/**
 * Generic Inngest event trigger route for client-side code.
 * Accepts an event name and data payload, sends it to Inngest.
 * REQUIRES authentication via Authorization header.
 *
 * POST /api/inngest/trigger
 * Body: { event: "company/analyze.requested", data: { ... } }
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
      console.error("[Inngest Trigger] Auth failed:", authError?.message);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { event, data } = body;

    if (!event || typeof event !== "string") {
      return NextResponse.json(
        { error: "event name is required" },
        { status: 400 }
      );
    }

    // Validate event is in allowed list
    if (!ALLOWED_EVENTS.includes(event)) {
      console.error("[Inngest Trigger] Blocked unauthorized event:", event);
      return NextResponse.json(
        { error: `Event '${event}' is not allowed` },
        { status: 403 }
      );
    }

    // Ensure user_id in data matches authenticated user (prevent spoofing)
    if (data?.user_id && data.user_id !== user.id) {
      console.error("[Inngest Trigger] User ID mismatch:", data.user_id, "vs", user.id);
      return NextResponse.json(
        { error: "User ID mismatch" },
        { status: 403 }
      );
    }

    // Inject authenticated user_id if not provided
    const eventData = {
      ...data,
      user_id: data?.user_id || user.id,
    };

    console.log("[Inngest Trigger] Sending event:", event, "for user:", user.id);

    const sendResult = await inngest.send({
      name: event,
      data: eventData,
    });

    return NextResponse.json({
      success: true,
      event,
      event_id: sendResult.ids?.[0] || null,
    });
  } catch (error) {
    console.error("[Inngest Trigger] Error:", error);
    return NextResponse.json(
      { error: "Failed to send event", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
