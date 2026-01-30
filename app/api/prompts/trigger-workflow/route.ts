import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest";

// Initialize Supabase admin client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createClient(url, key);
}

// Available Inngest workflows
const INNGEST_WORKFLOWS = {
  scoreV2: "transcript/score.requested",
  testPrompt: "prompt/test.requested",
} as const;

// POST - Trigger Inngest workflow with specific parameters
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      workflow = "scoreV2",
      user_id,
      prompt_id,
      agent_type,
      test_mode = false,
      transcript_id,
      transcript_ids,
      openai_key,
      test_transcript,
      test_transcript_name,
      // Separate system/user prompts and temperature
      system_prompt: overrideSystemPrompt,
      user_prompt_template: overrideUserPrompt,
      temperature = 0.3,
    } = body;

    console.log("[Inngest Trigger] Received request:", {
      workflow,
      prompt_id,
      agent_type,
      test_mode,
      transcript_id,
      has_test_transcript: !!test_transcript,
      test_transcript_name,
      temperature,
      has_system_prompt: !!overrideSystemPrompt,
      has_user_prompt: !!overrideUserPrompt,
    });

    // Validate workflow
    const eventName = INNGEST_WORKFLOWS[workflow as keyof typeof INNGEST_WORKFLOWS];
    if (!eventName) {
      return NextResponse.json(
        { error: "Invalid workflow specified" },
        { status: 400 }
      );
    }

    // If prompt_id provided, fetch the prompt to include in payload
    let promptData = null;
    if (prompt_id) {
      const { data, error } = await supabase
        .from("agent_prompts")
        .select("*")
        .eq("id", prompt_id)
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Prompt not found", details: error.message },
          { status: 404 }
        );
      }
      promptData = data;
    } else if (agent_type) {
      const { data, error } = await supabase
        .from("agent_prompts")
        .select("*")
        .eq("agent_type", agent_type)
        .eq("is_active", true)
        .single();

      if (!error && data) {
        promptData = data;
      }
    }

    // Determine system and user prompts
    const systemPrompt = overrideSystemPrompt || promptData?.system_prompt || promptData?.prompt_content || "";
    const userPromptTemplate = overrideUserPrompt || promptData?.user_prompt_template || "";
    const promptTemperature = temperature ?? promptData?.temperature ?? 0.3;

    // Build Inngest event data
    const eventData: Record<string, unknown> = {
      user_id,
      test_mode,
      transcript_id: transcript_id ?? null,
      timestamp: new Date().toISOString(),
      prompt_id: promptData?.id || prompt_id || null,
      agent_type: promptData?.agent_type || agent_type || null,
      system_prompt: systemPrompt,
      user_prompt_template: userPromptTemplate,
      temperature: promptTemperature,
    };

    // Add test transcript if provided
    if (test_mode && test_transcript) {
      eventData.test_transcript = test_transcript;
      eventData.test_transcript_name = test_transcript_name;
    }

    // Add specific transcript IDs if test mode
    if (test_mode && transcript_ids) {
      eventData.transcript_ids = transcript_ids;
    }

    console.log("[Inngest Trigger] Sending event:", eventName);

    // Send Inngest event
    const sendResult = await inngest.send({
      name: eventName,
      data: eventData,
    });

    return NextResponse.json({
      success: true,
      message: "Inngest workflow triggered",
      workflow: workflow,
      event_id: sendResult.ids?.[0] || null,
      prompt: promptData ? {
        id: promptData.id,
        name: promptData.name,
        agent_type: promptData.agent_type,
        version: promptData.version,
      } : null,
    });

  } catch (error) {
    console.error("[Inngest Trigger API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

// GET - Get available workflows
export async function GET() {
  return NextResponse.json({
    workflows: Object.keys(INNGEST_WORKFLOWS),
    events: INNGEST_WORKFLOWS,
  });
}
