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

// GET best selections for a task
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const taskName = searchParams.get("task_name");

    let query = supabase
      .from("best_transcript_selections")
      .select(`
        *,
        agent_runs (
          *,
          transcripts (id, title, duration, ai_overall_score),
          companies (id, company_name)
        ),
        users:selected_by (id, name, email)
      `)
      .order("rank", { ascending: true });

    if (taskName) {
      query = query.eq("task_name", taskName);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Best Selections API] Error fetching selections:", error);
      return NextResponse.json(
        { error: "Failed to fetch best selections", details: error.message },
        { status: 500 }
      );
    }

    // Group by task_name
    const grouped: Record<string, typeof data> = {};
    data?.forEach(selection => {
      if (!grouped[selection.task_name]) {
        grouped[selection.task_name] = [];
      }
      grouped[selection.task_name].push(selection);
    });

    return NextResponse.json({
      selections: data,
      byTask: grouped,
    });
  } catch (error) {
    console.error("[Best Selections API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST create/update best selection
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { task_name, agent_run_id, rank, notes, selected_by } = body;

    // Validation
    if (!task_name || !agent_run_id || !rank) {
      return NextResponse.json(
        { error: "Missing required fields: task_name, agent_run_id, rank" },
        { status: 400 }
      );
    }

    if (rank < 1 || rank > 5) {
      return NextResponse.json(
        { error: "Rank must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Upsert the selection (replace if same task_name + rank exists)
    const { data, error } = await supabase
      .from("best_transcript_selections")
      .upsert(
        {
          task_name,
          agent_run_id,
          rank,
          notes: notes || null,
          selected_by: selected_by || null,
        },
        { onConflict: "task_name,rank" }
      )
      .select(`
        *,
        agent_runs (
          *,
          transcripts (id, title),
          companies (id, company_name)
        )
      `)
      .single();

    if (error) {
      console.error("[Best Selections API] Error creating selection:", error);
      return NextResponse.json(
        { error: "Failed to create best selection", details: error.message },
        { status: 500 }
      );
    }

    // Also mark the agent run as best
    await supabase
      .from("agent_runs")
      .update({ is_best: true })
      .eq("id", agent_run_id);

    return NextResponse.json({ selection: data }, { status: 201 });
  } catch (error) {
    console.error("[Best Selections API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// DELETE remove a best selection
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const id = searchParams.get("id");
    const taskName = searchParams.get("task_name");
    const rank = searchParams.get("rank");

    if (!id && (!taskName || !rank)) {
      return NextResponse.json(
        { error: "Must provide either id or task_name + rank" },
        { status: 400 }
      );
    }

    let query = supabase.from("best_transcript_selections").delete();

    if (id) {
      query = query.eq("id", id);
    } else {
      query = query.eq("task_name", taskName!).eq("rank", parseInt(rank!));
    }

    const { error } = await query;

    if (error) {
      console.error("[Best Selections API] Error deleting selection:", error);
      return NextResponse.json(
        { error: "Failed to delete selection", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Best Selections API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
