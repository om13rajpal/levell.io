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

// GET all prompts (public route - no auth required)
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return unauthorizedResponse(auth.error);

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const agentType = searchParams.get("agent_type");
    const activeOnly = searchParams.get("active_only") !== "false"; // Default to active only
    const includeArchived = searchParams.get("include_archived") === "true";
    const getVersionHistory = searchParams.get("version_history");
    const includeStats = searchParams.get("include_stats") === "true";

    // If requesting version history for a specific prompt
    if (getVersionHistory) {
      const { data: versions, error: versionError } = await supabase
        .rpc("get_prompt_versions", { prompt_id_or_type: getVersionHistory });

      if (versionError) {
        console.error("[Prompts API] Error fetching version history:", versionError);
        return NextResponse.json(
          { error: "Failed to fetch version history", details: versionError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ versions });
    }

    let query = supabase
      .from("agent_prompts")
      .select("*")
      .order("created_at", { ascending: false });

    // Filter by agent_type if provided
    if (agentType) {
      query = query.eq("agent_type", agentType);
    }

    // By default, exclude archived versions (those with _archived suffix)
    if (!includeArchived) {
      query = query.not("agent_type", "like", "%_archived");
    }

    // Filter by active status
    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Prompts API] Error fetching prompts:", error);
      return NextResponse.json(
        { error: "Failed to fetch prompts", details: error.message },
        { status: 500 }
      );
    }

    // Group prompts by agent_type for easier consumption
    const byAgentType: Record<string, typeof data> = {};
    data?.forEach(prompt => {
      if (!byAgentType[prompt.agent_type]) {
        byAgentType[prompt.agent_type] = [];
      }
      byAgentType[prompt.agent_type].push(prompt);
    });

    // If stats requested, fetch run counts for each prompt
    let promptsWithStats = data;
    if (includeStats && data && data.length > 0) {
      const promptIds = data.map(p => p.id);

      // Get run counts grouped by prompt_id
      const { data: runCounts } = await supabase
        .from("agent_runs")
        .select("prompt_id, is_test_run")
        .in("prompt_id", promptIds);

      // Calculate stats per prompt
      const statsMap: Record<string, { total_runs: number; test_runs: number; production_runs: number }> = {};
      runCounts?.forEach(run => {
        if (!run.prompt_id) return;
        if (!statsMap[run.prompt_id]) {
          statsMap[run.prompt_id] = { total_runs: 0, test_runs: 0, production_runs: 0 };
        }
        statsMap[run.prompt_id].total_runs++;
        if (run.is_test_run) {
          statsMap[run.prompt_id].test_runs++;
        } else {
          statsMap[run.prompt_id].production_runs++;
        }
      });

      // Attach stats to prompts
      promptsWithStats = data.map(prompt => ({
        ...prompt,
        stats: statsMap[prompt.id] || { total_runs: 0, test_runs: 0, production_runs: 0 }
      }));
    }

    return NextResponse.json({
      prompts: promptsWithStats,
      byAgentType,
      count: data?.length || 0
    });
  } catch (error) {
    console.error("[Prompts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST create new prompt
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return unauthorizedResponse(auth.error);

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { name, agent_type, prompt_content, description, variables, is_active, created_by } = body;

    // Validation
    if (!name || !agent_type || !prompt_content) {
      return NextResponse.json(
        { error: "Missing required fields: name, agent_type, prompt_content" },
        { status: 400 }
      );
    }

    // Get the latest version for this agent_type
    const { data: existingPrompts } = await supabase
      .from("agent_prompts")
      .select("version")
      .eq("agent_type", agent_type)
      .order("version", { ascending: false })
      .limit(1);

    const newVersion = existingPrompts && existingPrompts.length > 0
      ? existingPrompts[0].version + 1
      : 1;

    const { data, error } = await supabase
      .from("agent_prompts")
      .insert({
        name,
        agent_type,
        prompt_content,
        description: description || null,
        variables: variables || [],
        is_active: is_active !== undefined ? is_active : true,
        version: newVersion,
        created_by: created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[Prompts API] Error creating prompt:", error);
      return NextResponse.json(
        { error: "Failed to create prompt", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ prompt: data }, { status: 201 });
  } catch (error) {
    console.error("[Prompts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
