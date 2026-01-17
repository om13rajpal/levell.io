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

// Database row type for test_transcripts table
interface TestTranscriptRow {
  id: string;
  label: string;
  description: string | null;
  call_type: string;
  clean_transcript_text?: string;
  is_active: boolean;
  created_at: string;
}

// GET all test transcripts
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const includeContent = searchParams.get("include_content") === "true";

    // Select fields based on whether content is needed
    // Map existing columns: label->name, call_type->scenario_type, clean_transcript_text->transcript_content
    const selectFields = includeContent
      ? "id, label, description, call_type, clean_transcript_text, is_active, created_at"
      : "id, label, description, call_type, is_active, created_at";

    const { data, error } = await supabase
      .from("test_transcripts")
      .select(selectFields)
      .eq("is_active", true)
      .order("call_type", { ascending: true });

    if (error) {
      console.error("[Test Transcripts API] Error fetching:", error);
      return NextResponse.json(
        { error: "Failed to fetch test transcripts", details: error.message },
        { status: 500 }
      );
    }

    // Map column names to expected format
    const transcripts = ((data || []) as unknown as TestTranscriptRow[]).map((t) => ({
      id: t.id,
      name: t.label,
      description: t.description,
      scenario_type: t.call_type,
      transcript_content: t.clean_transcript_text,
      is_active: t.is_active,
      created_at: t.created_at,
    }));

    return NextResponse.json({
      transcripts,
      count: transcripts.length,
    });
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

    const { name, description, scenario_type, expected_outcome, transcript_content } = body;

    if (!name || !transcript_content || !scenario_type) {
      return NextResponse.json(
        { error: "name, scenario_type, and transcript_content are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("test_transcripts")
      .insert({
        name,
        description: description || null,
        scenario_type,
        expected_outcome: expected_outcome || null,
        transcript_content,
      })
      .select()
      .single();

    if (error) {
      console.error("[Test Transcripts API] Error creating:", error);
      return NextResponse.json(
        { error: "Failed to create test transcript", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transcript: data
    }, { status: 201 });
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
