import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createClient(url, key);
}

// GET - Fetch test transcripts for workflows
// Returns full transcript data including sentences for processing
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const testIds = searchParams.get("ids"); // Comma-separated test transcript IDs
    const limit = parseInt(searchParams.get("limit") || "5");
    const callType = searchParams.get("call_type");

    let query = supabase
      .from("test_transcripts_full")
      .select("*");

    if (testIds) {
      const idArray = testIds.split(",").map(id => id.trim());
      query = query.in("test_id", idArray);
    }

    if (callType) {
      query = query.eq("call_type", callType);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      console.error("[Test Transcripts API] Error fetching:", error);
      return NextResponse.json(
        { error: "Failed to fetch test transcripts", details: error.message },
        { status: 500 }
      );
    }

    // Format for consumption
    const formattedTranscripts = data?.map(t => ({
      test_id: t.test_id,
      transcript_id: t.transcript_id,
      label: t.label,
      call_type: t.call_type,
      difficulty: t.difficulty,
      title: t.title,
      duration: t.duration,
      // Pre-cleaned transcript text if available
      clean_transcript_text: t.clean_transcript_text,
      // Raw sentences for processing if needed
      sentences: t.sentences,
      // Context data
      user_name: t.user_name,
      user_email: t.user_email,
      rep_name: t.rep_name,
      rep_transcript_name: t.rep_transcript_name,
      prospects: t.prospects,
      talk_ratio: t.talk_ratio,
      sales_motion: t.sales_motion,
    })) || [];

    return NextResponse.json({
      test_transcripts: formattedTranscripts,
      count: formattedTranscripts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Test Transcripts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
