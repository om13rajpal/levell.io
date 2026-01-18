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

// GET all agent runs with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");
    const offset = (page - 1) * pageSize;

    // Filters
    const agentType = searchParams.get("agent_type");
    const model = searchParams.get("model");
    const userId = searchParams.get("user_id");
    const transcriptId = searchParams.get("transcript_id");
    const companyId = searchParams.get("company_id");
    const contextType = searchParams.get("context_type");
    const status = searchParams.get("status");
    const isBest = searchParams.get("is_best");
    const isTestRun = searchParams.get("is_test_run");
    const promptId = searchParams.get("prompt_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Build query
    let query = supabase
      .from("agent_runs")
      .select(`
        *,
        agent_prompts (id, name, version),
        transcripts (id, title),
        companies (id, company_name),
        users (id, name, email)
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply filters
    if (agentType) query = query.eq("agent_type", agentType);
    if (model) query = query.eq("model", model);
    if (userId) query = query.eq("user_id", userId);
    if (transcriptId) query = query.eq("transcript_id", transcriptId);
    if (companyId) query = query.eq("company_id", companyId);
    if (contextType) query = query.eq("context_type", contextType);
    if (status) query = query.eq("status", status);
    if (isBest === "true") query = query.eq("is_best", true);
    if (isTestRun === "true") query = query.eq("is_test_run", true);
    if (isTestRun === "false") query = query.eq("is_test_run", false);
    if (promptId) query = query.eq("prompt_id", promptId);
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[Agent Runs API] Error fetching runs:", error);
      return NextResponse.json(
        { error: "Failed to fetch agent runs", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      runs: data,
      pagination: {
        page,
        pageSize,
        totalCount: count || 0,
        totalPages: count ? Math.ceil(count / pageSize) : 0,
        hasMore: count ? offset + pageSize < count : false,
      },
    });
  } catch (error) {
    console.error("[Agent Runs API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST log a new agent run
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      agent_type,
      prompt_id,
      prompt_sent,
      system_prompt,
      user_message,
      output,
      model,
      prompt_tokens,
      completion_tokens,
      transcript_id,
      company_id,
      user_id,
      context_type,
      context_data,
      duration_ms,
      status,
      error_message,
      metadata,
    } = body;

    // Validation - prompt_id is required by DB schema (NOT NULL)
    if (!agent_type || !prompt_sent || !model || !prompt_id) {
      return NextResponse.json(
        { error: "Missing required fields: agent_type, prompt_sent, model, prompt_id" },
        { status: 400 }
      );
    }

    // Fetch prompt version from the prompt if not provided in metadata
    let promptVersion = metadata?.prompt_version || 1;
    if (!metadata?.prompt_version) {
      const { data: promptData } = await supabase
        .from("agent_prompts")
        .select("version")
        .eq("id", prompt_id)
        .single();

      if (promptData) {
        promptVersion = promptData.version;
      }
    }

    const { data, error } = await supabase
      .from("agent_runs")
      .insert({
        agent_type,
        prompt_id,
        prompt_version: promptVersion,
        prompt_sent,
        system_prompt: system_prompt || null,
        user_message: user_message || null,
        output: output || null,
        model,
        prompt_tokens: prompt_tokens || 0,
        completion_tokens: completion_tokens || 0,
        transcript_id: transcript_id || null,
        company_id: company_id || null,
        user_id: user_id || null,
        context_type: context_type || "general",
        context_data: context_data || {},
        duration_ms: duration_ms || null,
        status: status || "completed",
        error_message: error_message || null,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error("[Agent Runs API] Error creating run:", error);
      return NextResponse.json(
        { error: "Failed to log agent run", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ run: data }, { status: 201 });
  } catch (error) {
    console.error("[Agent Runs API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
