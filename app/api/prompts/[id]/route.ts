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

// GET single prompt by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return unauthorizedResponse(auth.error);

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("agent_prompts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Prompt not found" },
          { status: 404 }
        );
      }
      console.error("[Prompts API] Error fetching prompt:", error);
      return NextResponse.json(
        { error: "Failed to fetch prompt", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ prompt: data });
  } catch (error) {
    console.error("[Prompts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// PUT update prompt
// Note: When prompt_content is changed, the database trigger automatically:
// 1. Archives the current version (creates a copy with is_active=false)
// 2. Increments the version number
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return unauthorizedResponse(auth.error);

    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      name,
      prompt_content,
      system_prompt,
      user_prompt_template,
      temperature,
      description,
      variables,
      is_active
    } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (prompt_content !== undefined) updateData.prompt_content = prompt_content;
    if (system_prompt !== undefined) updateData.system_prompt = system_prompt;
    if (user_prompt_template !== undefined) updateData.user_prompt_template = user_prompt_template;
    if (temperature !== undefined) updateData.temperature = temperature;
    if (description !== undefined) updateData.description = description;
    if (variables !== undefined) updateData.variables = variables;
    if (is_active !== undefined) updateData.is_active = is_active;

    console.log("[Prompts API] Updating prompt:", {
      id,
      has_system_prompt: system_prompt !== undefined,
      has_user_prompt: user_prompt_template !== undefined,
      temperature: temperature,
    });

    const { data, error } = await supabase
      .from("agent_prompts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Prompt not found" },
          { status: 404 }
        );
      }
      console.error("[Prompts API] Error updating prompt:", error);
      return NextResponse.json(
        { error: "Failed to update prompt", details: error.message },
        { status: 500 }
      );
    }

    const contentChanged = prompt_content !== undefined || system_prompt !== undefined || user_prompt_template !== undefined;
    return NextResponse.json({
      prompt: data,
      message: contentChanged
        ? "Prompt updated. Previous version has been archived."
        : "Prompt updated."
    });
  } catch (error) {
    console.error("[Prompts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// PATCH restore a previous version or perform other partial operations
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { action } = body;

    if (action === "restore") {
      // Restore this version (must be an archived version)
      const { data, error } = await supabase
        .rpc("restore_prompt_version", { version_id: id });

      if (error) {
        console.error("[Prompts API] Error restoring version:", error);
        return NextResponse.json(
          { error: "Failed to restore version", details: error.message },
          { status: 500 }
        );
      }

      if (!data) {
        return NextResponse.json(
          { error: "Could not restore version - no active prompt found" },
          { status: 400 }
        );
      }

      // Fetch the restored prompt
      const { data: restoredPrompt } = await supabase
        .from("agent_prompts")
        .select("*")
        .eq("id", data)
        .single();

      return NextResponse.json({
        prompt: restoredPrompt,
        message: "Version restored successfully. A new version has been created."
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported actions: restore" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Prompts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// DELETE prompt
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return unauthorizedResponse(auth.error);

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("agent_prompts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Prompts API] Error deleting prompt:", error);
      return NextResponse.json(
        { error: "Failed to delete prompt", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Prompts API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
