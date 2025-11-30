"use client";

import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

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

export function getStoredAuth() {
  // Check cache first
  const cached = getCachedData<{ name: string; email: string }>("storedAuth");
  if (cached) return cached;

  try {
    const token = localStorage.getItem("sb-rpowalzrbddorfnnmccp-auth-token");
    if (!token) return { name: "", email: "" };

    const parsed = JSON.parse(token);
    const result = {
      name:
        parsed?.user?.user_metadata?.full_name ||
        parsed?.user?.user_metadata?.name ||
        "",
      email: parsed?.user?.email || "",
    };

    setCachedData("storedAuth", result);
    return result;
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

export async function sendWebsiteToWebhook(website: string, company: string): Promise<WebhookResponse> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false };

    const { data: companyData } = await supabase
      .from("company")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!companyData?.id) return { success: false };

    const res = await fetch(
      "https://n8n.omrajpal.tech/webhook-test/c5b19b00-5069-4884-894a-9807e387555c",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website,
          company_id: companyData.id,
          company_name: company,
        }),
      }
    );

    if (!res.ok) return { success: false };

    const data = await res.json();

    console.log("Webhook response data:", data);

    // Extract markdown and json_val from response
    const markdown = data?.markdown || data?.payload?.markdown || data?.payload?.data || data?.data || "";
    const json_val = data?.json_val || data?.payload?.json_val || null;

    return {
      success: true,
      markdown,
      json_val,
    };
  } catch {
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