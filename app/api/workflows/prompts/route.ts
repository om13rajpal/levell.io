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

// GET - Fetch prompts for workflows
// Returns all active prompts with their content for use in agents
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return unauthorizedResponse(auth.error);

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
      console.error("[Prompts API] Error fetching prompts:", error);
      return NextResponse.json(
        { error: "Failed to fetch prompts", details: error.message },
        { status: 500 }
      );
    }

    // Format prompts for consumption
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
    console.error("[Prompts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Helper to clean UUID fields - convert empty strings to null
function cleanUuid(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "null" || trimmed === "undefined") return null;
    return trimmed;
  }
  return null;
}

// Helper to clean number fields - convert empty/invalid to 0
function cleanNumber(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined || value === "") return defaultValue;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return isNaN(num) ? defaultValue : num;
}

// POST - Save agent run results
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
      prompt_sent,
      system_prompt,
      user_message,
    } = body;

    if (!agent_type || !output) {
      return NextResponse.json(
        { error: "agent_type and output are required" },
        { status: 400 }
      );
    }

    // Clean UUID fields to convert empty strings to null
    const cleanedPromptId = cleanUuid(prompt_id);
    const cleanedTranscriptId = cleanUuid(transcript_id);
    const cleanedTestTranscriptId = cleanUuid(test_transcript_id);

    // Generate default prompt_sent if not provided
    const defaultPromptSent = `[inngest workflow] Agent: ${agent_type}`;

    // Save the run
    const { data, error } = await supabase
      .from("agent_runs")
      .insert({
        agent_type,
        prompt_id: cleanedPromptId,
        transcript_id: cleanedTranscriptId,
        output: typeof output === "string" ? output : JSON.stringify(output, null, 2),
        model: model || "gpt-4o",
        prompt_tokens: cleanNumber(prompt_tokens, 0),
        completion_tokens: cleanNumber(completion_tokens, 0),
        total_cost: cleanNumber(total_cost, 0),
        duration_ms: cleanNumber(duration_ms, 0),
        status: "completed",
        is_test_run: Boolean(is_test_run),
        test_transcript_id: cleanedTestTranscriptId,
        metadata: metadata || {},
        prompt_sent: prompt_sent || defaultPromptSent,
        system_prompt: system_prompt || null,
        user_message: user_message || null,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("[Prompts API] Error saving run:", error);
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
    console.error("[Prompts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
