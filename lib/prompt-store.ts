import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key);
}

export interface PromptTemplate {
  id: string;
  type: string;
  version: number;
  model: string;
  template: string;
  system_prompt: string | null;
  description: string | null;
  variables: string[];
  created_at: string;
  updated_at: string;
  active: boolean;
}

/**
 * Get the active prompt template for a given type and model
 */
export async function getActivePrompt(
  type: string,
  model: string
): Promise<PromptTemplate | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("prompt_store")
    .select("*")
    .eq("type", type)
    .eq("model", model)
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[PromptStore] Error fetching active prompt:", error);
    return null;
  }
  return data;
}

/**
 * Get all versions of a prompt type
 */
export async function getPromptVersions(
  type: string,
  model: string
): Promise<PromptTemplate[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("prompt_store")
    .select("*")
    .eq("type", type)
    .eq("model", model)
    .order("version", { ascending: false });

  if (error) {
    console.error("[PromptStore] Error fetching prompt versions:", error);
    return [];
  }
  return data || [];
}

/**
 * Create a new prompt version (deactivates previous versions)
 * Uses the create_prompt_version SQL function
 */
export async function createPromptVersion(params: {
  type: string;
  model: string;
  template: string;
  system_prompt?: string;
  description?: string;
  variables?: string[];
}): Promise<{ id: string | null; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("create_prompt_version", {
    p_type: params.type,
    p_model: params.model,
    p_template: params.template,
    p_system_prompt: params.system_prompt || null,
    p_description: params.description || null,
    p_variables: JSON.stringify(params.variables || []),
  });

  if (error) {
    console.error("[PromptStore] Error creating prompt version:", error);
    return { id: null, error: error.message };
  }
  return { id: data };
}

/**
 * Render a prompt template by replacing variables
 */
export function renderPrompt(
  template: string,
  variables: Record<string, string>
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return rendered;
}

/**
 * Get all distinct prompt types
 */
export async function getPromptTypes(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("prompt_store")
    .select("type")
    .eq("active", true);

  if (error) {
    console.error("[PromptStore] Error fetching prompt types:", error);
    return [];
  }

  const types = [...new Set((data || []).map((d: any) => d.type))];
  return types;
}
