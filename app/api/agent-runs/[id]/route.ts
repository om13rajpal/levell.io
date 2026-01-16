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

// GET single agent run by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("agent_runs")
      .select(`
        *,
        agent_prompts (id, name, version, prompt_content),
        transcripts (id, title, duration, ai_overall_score),
        companies (id, company_name, domain),
        users (id, name, email)
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Agent run not found" },
          { status: 404 }
        );
      }
      console.error("[Agent Runs API] Error fetching run:", error);
      return NextResponse.json(
        { error: "Failed to fetch agent run", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ run: data });
  } catch (error) {
    console.error("[Agent Runs API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// PATCH update agent run (mark as best, update status, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { is_best, status, output, error_message, metadata } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (is_best !== undefined) updateData.is_best = is_best;
    if (status !== undefined) updateData.status = status;
    if (output !== undefined) updateData.output = output;
    if (error_message !== undefined) updateData.error_message = error_message;
    if (metadata !== undefined) updateData.metadata = metadata;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("agent_runs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Agent run not found" },
          { status: 404 }
        );
      }
      console.error("[Agent Runs API] Error updating run:", error);
      return NextResponse.json(
        { error: "Failed to update agent run", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ run: data });
  } catch (error) {
    console.error("[Agent Runs API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
