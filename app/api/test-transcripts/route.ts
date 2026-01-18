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

// Database row type for test_transcripts table (actual DB schema - Levvl project)
interface TestTranscriptRow {
  id: string;
  label: string;
  description: string | null;
  call_type: string;
  difficulty: string | null;
  clean_transcript_text?: string;
  transcript_id: number | null;
  context_data?: Record<string, unknown>;
  rep_name?: string | null;
  rep_email?: string | null;
  rep_transcript_name?: string | null;
  prospects?: unknown[];
  talk_ratio?: Record<string, unknown>;
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
    // Using actual DB column names: label, call_type, clean_transcript_text, difficulty
    const selectFields = includeContent
      ? "id, label, description, call_type, difficulty, clean_transcript_text, transcript_id, context_data, rep_name, is_active, created_at"
      : "id, label, description, call_type, difficulty, transcript_id, is_active, created_at";

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

    // Map DB columns to API response format expected by frontend
    // DB uses: label, call_type, clean_transcript_text
    // API returns: name, scenario_type, transcript_content (for frontend compatibility)
    const transcripts = ((data || []) as unknown as TestTranscriptRow[]).map((t) => ({
      id: t.id,
      name: t.label,  // Map label -> name for frontend
      description: t.description,
      scenario_type: t.call_type || "other",  // Map call_type -> scenario_type
      difficulty: t.difficulty,
      transcript_content: t.clean_transcript_text,  // Map clean_transcript_text -> transcript_content
      transcript_id: t.transcript_id,
      context_data: t.context_data,
      rep_name: t.rep_name,
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

    const {
      name,  // Frontend sends name, we map to label
      description,
      scenario_type,  // Frontend sends scenario_type, we map to call_type
      transcript_content,  // Frontend sends transcript_content, we map to clean_transcript_text
      transcript_id,
      difficulty,
      context_data,
      rep_name,
    } = body;

    if (!name || !transcript_content || !scenario_type) {
      return NextResponse.json(
        { error: "name, scenario_type, and transcript_content are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("test_transcripts")
      .insert({
        label: name,  // Map name -> label
        description: description || null,
        call_type: scenario_type,  // Map scenario_type -> call_type
        clean_transcript_text: transcript_content,  // Map transcript_content -> clean_transcript_text
        transcript_id: transcript_id || null,
        difficulty: difficulty || "medium",
        context_data: context_data || {},
        rep_name: rep_name || null,
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
      transcript: {
        id: data.id,
        name: data.label,  // Map label -> name for frontend
        description: data.description,
        scenario_type: data.call_type,  // Map call_type -> scenario_type
        difficulty: data.difficulty,
        transcript_content: data.clean_transcript_text,  // Map clean_transcript_text -> transcript_content
        transcript_id: data.transcript_id,
        context_data: data.context_data,
        rep_name: data.rep_name,
        is_active: data.is_active,
        created_at: data.created_at,
      }
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
