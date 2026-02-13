import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, unauthorizedResponse } from "@/lib/auth";

// Initialize Supabase admin client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createClient(url, key);
}

// GET single transcript by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return unauthorizedResponse(auth.error);

    const { id } = await params;

    // Handle undefined, null, or invalid IDs gracefully (for test mode)
    // Some systems render undefined variables as "[undefined]" with brackets
    if (!id || id === "undefined" || id === "[undefined]" || id === "null" || id === "[null]" || id === "") {
      return NextResponse.json({
        id: null,
        content: "",
        transcript: "",
        message: "No transcript ID provided - using test mode",
      });
    }

    // Validate that id is a number
    const transcriptId = parseInt(id, 10);
    if (isNaN(transcriptId)) {
      return NextResponse.json({
        id: null,
        content: "",
        transcript: "",
        message: "Invalid transcript ID format",
      });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("transcripts")
      .select(`
        id,
        title,
        sentences,
        participants,
        duration,
        ai_summary,
        meeting_date,
        created_at
      `)
      .eq("id", transcriptId)
      .single();

    if (error) {
      console.error("[Transcripts API] Error fetching:", error);

      // Return empty response instead of error for workflow compatibility
      if (error.code === "PGRST116") {
        return NextResponse.json({
          id: null,
          content: "",
          transcript: "",
          message: "Transcript not found",
        });
      }

      return NextResponse.json(
        { error: "Failed to fetch transcript", details: error.message },
        { status: 500 }
      );
    }

    // Extract transcript content from sentences (JSONB array)
    let transcriptContent = "";
    if (data.sentences && Array.isArray(data.sentences)) {
      transcriptContent = data.sentences
        .map((s: { speaker_name?: string; text?: string }) =>
          `${s.speaker_name || "Speaker"}: ${s.text || ""}`
        )
        .join("\n");
    }

    return NextResponse.json({
      id: data.id,
      title: data.title,
      content: transcriptContent,
      transcript: transcriptContent,
      participants: data.participants,
      duration: data.duration,
      ai_summary: data.ai_summary,
      meeting_date: data.meeting_date,
      created_at: data.created_at,
    });
  } catch (error) {
    console.error("[Transcripts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
