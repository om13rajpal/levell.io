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

interface AgentRunInput {
  prompt_id?: string;
  prompt_version?: number;
  agent_type: string;
  run_type?: string;
  is_test_run?: boolean;
  transcript_id?: number | null;
  prompt_sent?: string;
  output?: string;
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost_usd?: number;
  total_cost?: number;
  model?: string;
  status?: string;
  error_message?: string;
  user_id?: string;
}

// POST - Batch insert multiple agent runs (for n8n workflows)
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { runs, total_cost_usd } = body as {
      runs: AgentRunInput[];
      total_cost_usd?: number;
    };

    if (!runs || !Array.isArray(runs) || runs.length === 0) {
      return NextResponse.json(
        { error: "runs array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Prepare records for insertion
    const records = runs.map((run) => ({
      agent_type: run.agent_type,
      prompt_id: run.prompt_id || null,
      prompt_sent: run.prompt_sent || run.output || "",
      output: run.output || null,
      model: run.model || "gpt-4o",
      prompt_tokens: run.prompt_tokens || run.input_tokens || 0,
      completion_tokens: run.completion_tokens || run.output_tokens || 0,
      transcript_id: run.transcript_id || null,
      user_id: run.user_id || null,
      context_type: run.run_type || "n8n",
      status: run.status || "completed",
      error_message: run.error_message || null,
      is_test_run: run.is_test_run || false,
      metadata: {
        prompt_version: run.prompt_version,
        run_type: run.run_type,
        cost_usd: run.cost_usd || run.total_cost || 0,
        batch_run: true,
      },
    }));

    const { data, error } = await supabase
      .from("agent_runs")
      .insert(records)
      .select();

    if (error) {
      console.error("[Agent Runs Batch API] Error inserting runs:", error);
      return NextResponse.json(
        { error: "Failed to save agent runs", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      runs_saved: data?.length || 0,
      total_cost_usd: total_cost_usd || 0,
      ids: data?.map((r: { id: string }) => r.id) || [],
    }, { status: 201 });
  } catch (error) {
    console.error("[Agent Runs Batch API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
