"use client";

import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import axiosClient from "@/lib/axiosClient";

// Simple in-memory cache for frequently accessed data
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
}

function setCachedData(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// Synchronous version - reads from localStorage (fallback)
export function getStoredAuth() {
  try {
    // Find the Supabase auth token in localStorage
    let token: string | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        token = localStorage.getItem(key);
        break;
      }
    }

    if (!token) return { name: "", email: "" };

    const parsed = JSON.parse(token);
    const user = parsed?.user;
    const metadata = user?.user_metadata || {};
    const identityData = user?.identities?.[0]?.identity_data || {};

    // Try multiple fields for name (Google OAuth uses different fields)
    let name = "";
    if (metadata?.full_name) {
      name = metadata.full_name;
    } else if (metadata?.name) {
      name = metadata.name;
    } else if (metadata?.given_name) {
      name = metadata?.family_name
        ? `${metadata.given_name} ${metadata.family_name}`.trim()
        : metadata.given_name;
    } else if (identityData?.full_name) {
      name = identityData.full_name;
    } else if (identityData?.name) {
      name = identityData.name;
    }

    const email = user?.email || metadata?.email || "";

    return { name, email };
  } catch {
    return { name: "", email: "" };
  }
}

// Async version - uses Supabase directly (more reliable)
export async function getAuthUserData(): Promise<{ name: string; email: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { name: "", email: "" };

    const metadata = user.user_metadata || {};
    const identityData = user.identities?.[0]?.identity_data || {};

    // Try multiple fields for name (Google OAuth uses different fields)
    let name = "";
    if (metadata?.full_name) {
      name = metadata.full_name;
    } else if (metadata?.name) {
      name = metadata.name;
    } else if (metadata?.given_name) {
      name = metadata?.family_name
        ? `${metadata.given_name} ${metadata.family_name}`.trim()
        : metadata.given_name;
    } else if (identityData?.full_name) {
      name = identityData.full_name;
    } else if (identityData?.name) {
      name = identityData.name;
    }

    const email = user.email || metadata?.email || "";

    return { name, email };
  } catch {
    return { name: "", email: "" };
  }
}

export async function updateUserInSupabase(fullname: string, email: string) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date().toISOString();

    await supabase.from("users").upsert(
      {
        id: user.id,
        name: fullname,
        email,
        created_at: now,
        last_login_time: now,
        is_logged_in: true,
      },
      { onConflict: "id" }
    );
  } catch {}
}

export async function validateConnectedTools() {
  // Check cache first
  const cacheKey = "connectedTools";
  const cached = getCachedData<boolean>(cacheKey);
  if (cached !== null) return cached;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from("api_keys")
      .select("fireflies, openapi")
      .eq("user_id", user.id)
      .single();

    if (!data || !data.fireflies) {
      toast.error("Please connect Fireflies before continuing.");
      return false;
    }

    setCachedData(cacheKey, true);
    return true;
  } catch {
    return false;
  }
}

export interface WebhookResponse {
  success: boolean;
  markdown?: string;
  json_val?: any;
}

export async function sendWebsiteToWebhook(website: string, companyName: string): Promise<WebhookResponse> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false };

    // Check if company record exists, if not create one
    let companyId: number | null = null;

    const { data: existingCompany } = await supabase
      .from("company")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingCompany?.id) {
      companyId = existingCompany.id;
      // Update company name and website if it exists
      await supabase
        .from("company")
        .update({ company_name: companyName, company_url: website })
        .eq("id", companyId);
    } else {
      // Create new company record
      const { data: newCompany, error: insertError } = await supabase
        .from("company")
        .insert({
          user_id: user.id,
          company_name: companyName,
          company_url: website,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Error creating company:", insertError);
        // Continue without company_id if insert fails
      } else {
        companyId = newCompany?.id || null;
      }
    }

    const response = await axiosClient.post(
      "https://n8n.omrajpal.tech/webhook/c5b19b00-5069-4884-894a-9807e387555c",
      {
        website,
        company_id: companyId,
        company_name: companyName,
        user_id: user.id,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "*/*",
        },
      }
    );

    const data = response.data;

    console.log("Webhook response data:", data);

    // Extract markdown and json_val from response
    const markdown = data?.markdown || data?.payload?.markdown || data?.payload?.data || data?.data || "";
    const json_val = data?.json_val || data?.payload?.json_val || null;

    return {
      success: true,
      markdown,
      json_val,
    };
  } catch (error) {
    console.error("Webhook request failed:", error);
    return { success: false };
  }
}

export async function updateSalesProcess(sales_motion: string, framework: string) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("users")
      .update({ sales_motion, framework })
      .eq("id", user.id);
  } catch {}
}

/**
 * Copy company and user data from team owner to invited user
 * This function copies all the data from steps 3-6 of onboarding
 */
export async function copyTeamOwnerDataToUser(
  userId: string,
  teamId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get team details to find the owner
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("owner")
      .eq("id", teamId)
      .single();

    if (teamError || !team) {
      console.error("Error fetching team:", teamError);
      return { success: false, error: "Team not found" };
    }

    const ownerId = team.owner;

    // Get owner's user data (sales_motion, framework)
    const { data: ownerData, error: ownerError } = await supabase
      .from("users")
      .select("sales_motion, framework")
      .eq("id", ownerId)
      .single();

    if (ownerError) {
      console.error("Error fetching owner data:", ownerError);
      // Continue without owner user data - not critical
    }

    // Get owner's company data
    const { data: ownerCompany, error: companyError } = await supabase
      .from("company")
      .select("*")
      .eq("user_id", ownerId)
      .maybeSingle();

    if (companyError) {
      console.error("Error fetching owner company:", companyError);
      // Continue without company data - not critical
    }

    // Update the new user with owner's settings
    const userUpdateData: Record<string, any> = {};

    if (ownerData?.sales_motion) {
      userUpdateData.sales_motion = ownerData.sales_motion;
    }
    if (ownerData?.framework) {
      userUpdateData.framework = ownerData.framework;
    }

    // Update user with copied data
    if (Object.keys(userUpdateData).length > 0) {
      const { error: userUpdateError } = await supabase
        .from("users")
        .update(userUpdateData)
        .eq("id", userId);

      if (userUpdateError) {
        console.error("Error updating user with owner data:", userUpdateError);
      }
    }

    // Copy company data for the new user (create a reference or copy)
    if (ownerCompany) {
      // Check if user already has a company record
      const { data: existingCompany } = await supabase
        .from("company")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingCompany) {
        // Create company record for the new user with same data
        const { error: companyCreateError } = await supabase
          .from("company")
          .insert({
            user_id: userId,
            company_name: ownerCompany.company_name,
            company_url: ownerCompany.company_url,
            // Copy any other relevant fields from owner's company
          });

        if (companyCreateError) {
          console.error("Error creating company for user:", companyCreateError);
        }
      }
    }

    return { success: true };
  } catch (err) {
    console.error("Error copying team owner data:", err);
    return { success: false, error: "Failed to copy team data" };
  }
}

/**
 * Complete invite-based onboarding
 * Copies team owner data and marks onboarding as complete
 */
export async function completeInviteOnboarding(
  userId: string,
  teamId: number,
  inviteToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Import team service functions dynamically to avoid circular deps
    const { acceptInvitation } = await import("./team");

    // 1. Copy team owner data to user (steps 3-6 data)
    const copyResult = await copyTeamOwnerDataToUser(userId, teamId);
    if (!copyResult.success) {
      console.error("Warning: Failed to copy team data:", copyResult.error);
      // Continue anyway - this is not critical
    }

    // 2. Accept the team invitation
    const acceptResult = await acceptInvitation(inviteToken, userId);
    if (!acceptResult.success) {
      return { success: false, error: acceptResult.error || "Failed to accept invitation" };
    }

    // 3. Mark onboarding as complete
    const { error: onboardingError } = await supabase
      .from("users")
      .update({ is_onboarding_done: true })
      .eq("id", userId);

    if (onboardingError) {
      console.error("Error marking onboarding complete:", onboardingError);
      return { success: false, error: "Failed to complete onboarding" };
    }

    return { success: true };
  } catch (err) {
    console.error("Error completing invite onboarding:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Check if user is in invite-based onboarding flow
 */
export function isInviteOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("invite_onboarding") === "true";
}

/**
 * Get pending invite token from localStorage
 */
export function getPendingInviteToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pending_invite_token");
}

/**
 * Get pending invite team ID from localStorage
 */
export function getPendingInviteTeamId(): number | null {
  if (typeof window === "undefined") return null;
  const teamId = localStorage.getItem("invite_team_id");
  return teamId ? parseInt(teamId, 10) : null;
}

/**
 * Clear invite-related data from localStorage
 */
export function clearInviteData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("invite_onboarding");
  localStorage.removeItem("pending_invite_token");
  localStorage.removeItem("invite_team_id");
}

/* ================================================================= */
/* WEBHOOK DATA CRUD OPERATIONS */
/* ================================================================= */

export interface WebhookDataPayload {
  company_info?: {
    website?: string;
    company_name?: string;
    value_proposition?: string;
  };
  products_and_services?: Array<{ name: string; description?: string } | string>;
  ideal_customer_profile?: {
    region?: string;
    industry?: string;
    tech_stack?: string;
    company_size?: string;
    sales_motion?: string;
  };
  buyer_personas?: Array<{
    name: string;
    goals?: string[];
    job_title?: string;
    pain_points?: string[];
    responsibilities?: string[];
    decision_influence?: string;
    information_sources?: string[];
  }>;
  talk_tracks?: Array<string | { text: string }>;
  objection_handling?: Array<{
    objection: string;
    response: string;
  }>;
}

/**
 * Fetch webhook_data json_val for the current user's company
 */
export async function fetchWebhookData(): Promise<{
  success: boolean;
  data?: WebhookDataPayload;
  markdown?: string;
  companyId?: number;
  error?: string;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // First get the company id for the user
    const { data: company, error: companyError } = await supabase
      .from("company")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyError || !company) {
      return { success: false, error: "No company found" };
    }

    // Fetch webhook_data using company_id
    const { data: webhookData, error: webhookError } = await supabase
      .from("webhook_data")
      .select("json_val, markdown")
      .eq("company_id", company.id)
      .maybeSingle();

    if (webhookError) {
      console.error("Error fetching webhook_data:", webhookError);
      return { success: false, error: webhookError.message };
    }

    if (!webhookData) {
      return { success: true, data: undefined, companyId: company.id };
    }

    return {
      success: true,
      data: webhookData.json_val as WebhookDataPayload,
      markdown: webhookData.markdown || undefined,
      companyId: company.id,
    };
  } catch (err) {
    console.error("fetchWebhookData error:", err);
    return { success: false, error: "Failed to fetch webhook data" };
  }
}

/**
 * Update webhook_data json_val for the current user's company
 */
export async function updateWebhookData(
  jsonVal: WebhookDataPayload,
  markdown?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // First get the company id for the user
    const { data: company, error: companyError } = await supabase
      .from("company")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyError || !company) {
      return { success: false, error: "No company found" };
    }

    // Build update object
    const updateData: {
      json_val: WebhookDataPayload;
      updated_at: string;
      markdown?: string;
    } = {
      json_val: jsonVal,
      updated_at: new Date().toISOString(),
    };

    if (markdown !== undefined) {
      updateData.markdown = markdown;
    }

    // Update webhook_data
    const { error: updateError } = await supabase
      .from("webhook_data")
      .update(updateData)
      .eq("company_id", company.id);

    if (updateError) {
      console.error("Error updating webhook_data:", updateError);
      return { success: false, error: updateError.message };
    }

    // Also update localStorage for offline access
    localStorage.setItem("company_json_data", JSON.stringify(jsonVal));
    if (markdown) {
      localStorage.setItem("webhook_markdown", markdown);
    }

    return { success: true };
  } catch (err) {
    console.error("updateWebhookData error:", err);
    return { success: false, error: "Failed to update webhook data" };
  }
}

/**
 * Create webhook_data record if it doesn't exist
 */
export async function createOrUpdateWebhookData(
  jsonVal: WebhookDataPayload,
  markdown?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // First get or create the company for the user
    let companyId: number | null = null;

    const { data: existingCompany } = await supabase
      .from("company")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingCompany?.id) {
      companyId = existingCompany.id;
    } else {
      // Create company if doesn't exist
      const { data: newCompany, error: createError } = await supabase
        .from("company")
        .insert({
          user_id: user.id,
          company_name: jsonVal.company_info?.company_name || "Unnamed Company",
          company_url: jsonVal.company_info?.website || "",
        })
        .select("id")
        .single();

      if (createError || !newCompany) {
        console.error("Error creating company:", createError);
        return { success: false, error: "Failed to create company" };
      }
      companyId = newCompany.id;
    }

    // Upsert webhook_data
    const { error: upsertError } = await supabase
      .from("webhook_data")
      .upsert(
        {
          company_id: companyId,
          json_val: jsonVal,
          markdown: markdown || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      );

    if (upsertError) {
      console.error("Error upserting webhook_data:", upsertError);
      return { success: false, error: upsertError.message };
    }

    // Update localStorage
    localStorage.setItem("company_json_data", JSON.stringify(jsonVal));
    if (markdown) {
      localStorage.setItem("webhook_markdown", markdown);
    }

    return { success: true };
  } catch (err) {
    console.error("createOrUpdateWebhookData error:", err);
    return { success: false, error: "Failed to save webhook data" };
  }
}