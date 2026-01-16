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

// GET - Fetch prompts for n8n workflow
// Returns all active prompts with their content for use in n8n agents
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const agentType = searchParams.get("agent_type");
    const includeInactive = searchParams.get("include_inactive") === "true";

    let query = supabase
      .from("agent_prompts")
      .select("id, name, agent_type, prompt_content, description, variables, version, is_active, created_at");

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    if (agentType) {
      query = query.eq("agent_type", agentType);
    }

    const { data, error } = await query.order("agent_type", { ascending: true });

    if (error) {
      console.error("[n8n Prompts API] Error fetching prompts:", error);
      return NextResponse.json(
        { error: "Failed to fetch prompts", details: error.message },
        { status: 500 }
      );
    }

    // Format prompts for n8n consumption
    const formattedPrompts: Record<string, {
      id: string;
      name: string;
      prompt_content: string;
      version: number;
      variables: string[];
    }> = {};

    data?.forEach(prompt => {
      formattedPrompts[prompt.agent_type] = {
        id: prompt.id,
        name: prompt.name,
        prompt_content: prompt.prompt_content,
        version: prompt.version,
        variables: prompt.variables || [],
      };
    });

    return NextResponse.json({
      prompts: formattedPrompts,
      raw: data,
      count: data?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[n8n Prompts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST - Save agent run results from n8n
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      agent_type,
      prompt_id,
      transcript_id,
      output,
      model,
      prompt_tokens,
      completion_tokens,
      total_cost,
      duration_ms,
      is_test_run = false,
      test_transcript_id,
      metadata = {},
    } = body;

    if (!agent_type || !output) {
      return NextResponse.json(
        { error: "agent_type and output are required" },
        { status: 400 }
      );
    }

    // Save the run
    const { data, error } = await supabase
      .from("agent_runs")
      .insert({
        agent_type,
        prompt_id,
        transcript_id,
        output: typeof output === "string" ? output : JSON.stringify(output, null, 2),
        model: model || "gpt-4o",
        prompt_tokens: prompt_tokens || 0,
        completion_tokens: completion_tokens || 0,
        total_cost: total_cost || 0,
        duration_ms: duration_ms || 0,
        status: "completed",
        is_test_run,
        test_transcript_id,
        metadata,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("[n8n Prompts API] Error saving run:", error);
      return NextResponse.json(
        { error: "Failed to save run", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      run_id: data.id,
      created_at: data.created_at,
    });
  } catch (error) {
    console.error("[n8n Prompts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
