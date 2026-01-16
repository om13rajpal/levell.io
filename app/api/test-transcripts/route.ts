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

// GET all test transcripts
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("test_transcripts")
      .select(`
        *,
        transcripts (
          id,
          title,
          fireflies_id,
          duration,
          ai_overall_score,
          created_at
        )
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Test Transcripts API] Error fetching:", error);
      return NextResponse.json(
        { error: "Failed to fetch test transcripts", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ test_transcripts: data });
  } catch (error) {
    console.error("[Test Transcripts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST add a new test transcript
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { transcript_id, label, description, call_type, difficulty } = body;

    if (!transcript_id || !label) {
      return NextResponse.json(
        { error: "transcript_id and label are required" },
        { status: 400 }
      );
    }

    // Verify transcript exists
    const { data: transcript, error: transcriptError } = await supabase
      .from("transcripts")
      .select("id, title")
      .eq("id", transcript_id)
      .single();

    if (transcriptError || !transcript) {
      return NextResponse.json(
        { error: "Transcript not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("test_transcripts")
      .insert({
        transcript_id,
        label,
        description: description || null,
        call_type: call_type || "other",
        difficulty: difficulty || "medium",
      })
      .select(`
        *,
        transcripts (id, title, fireflies_id, duration, ai_overall_score)
      `)
      .single();

    if (error) {
      console.error("[Test Transcripts API] Error creating:", error);
      return NextResponse.json(
        { error: "Failed to create test transcript", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ test_transcript: data }, { status: 201 });
  } catch (error) {
    console.error("[Test Transcripts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// DELETE remove a test transcript
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("test_transcripts")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      console.error("[Test Transcripts API] Error deleting:", error);
      return NextResponse.json(
        { error: "Failed to delete test transcript", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Test Transcripts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
