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