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

// n8n webhook URLs
const N8N_WEBHOOKS = {
  scoreV2: process.env.N8N_WEBHOOK_SCOREV2 || "https://n8n.omrajpal.tech/webhook/scoreV2",
  testPrompt: process.env.N8N_WEBHOOK_TEST_PROMPT || "https://n8n.omrajpal.tech/webhook/run-agent-prompt",
};

// POST - Trigger n8n workflow with specific parameters
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
      transcript_ids,
      openai_key,
      test_transcript,
      test_transcript_name,
    } = body;

    // Get webhook URL
    const webhookUrl = N8N_WEBHOOKS[workflow as keyof typeof N8N_WEBHOOKS];
    if (!webhookUrl) {
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

    // Build n8n payload
    const n8nPayload: Record<string, unknown> = {
      user_id: user_id,
      test_mode: test_mode,
      transcript_id: body.transcript_id || null,
      timestamp: new Date().toISOString(),
    };

    // Add OpenAI key if provided (for n8n to use)
    if (openai_key) {
      n8nPayload.openai = `Bearer ${openai_key}`;
    }

    // Add prompt data if available
    if (promptData) {
      // Add prompt_id at top level for n8n workflow compatibility
      n8nPayload.prompt_id = promptData.id;
      n8nPayload.agent_type = promptData.agent_type;

      // Also include full prompt object for reference
      n8nPayload.prompt = {
        id: promptData.id,
        name: promptData.name,
        agent_type: promptData.agent_type,
        prompt_content: promptData.prompt_content,
        version: promptData.version,
        variables: promptData.variables,
      };
    }

    // Add test transcript if provided (for testing prompts)
    if (test_mode && test_transcript) {
      n8nPayload.transcript = test_transcript;
      n8nPayload.test_transcript = test_transcript;
      n8nPayload.test_transcript_name = test_transcript_name;
    }

    // Add specific transcript IDs if test mode
    if (test_mode && transcript_ids) {
      n8nPayload.transcript_ids = transcript_ids;
    }

    console.log("[n8n Trigger] Calling webhook:", webhookUrl);
    console.log("[n8n Trigger] Payload:", JSON.stringify(n8nPayload, null, 2));

    // Call n8n webhook
    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(n8nPayload),
    });

    const responseText = await n8nResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!n8nResponse.ok) {
      console.error("[n8n Trigger] Error response:", n8nResponse.status, responseText);
      return NextResponse.json(
        {
          error: "n8n webhook returned an error",
          status: n8nResponse.status,
          details: responseData,
        },
        { status: n8nResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "n8n workflow triggered",
      workflow: workflow,
      n8n_response: responseData,
      prompt: promptData ? {
        id: promptData.id,
        name: promptData.name,
        agent_type: promptData.agent_type,
        version: promptData.version,
      } : null,
    });

  } catch (error) {
    console.error("[n8n Trigger API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

// GET - Get available n8n workflows
export async function GET() {
  return NextResponse.json({
    workflows: Object.keys(N8N_WEBHOOKS),
    webhooks: N8N_WEBHOOKS,
  });
}
