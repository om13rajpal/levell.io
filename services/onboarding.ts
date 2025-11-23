"use client";

import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export function getStoredAuth() {
  try {
    const token = localStorage.getItem("sb-rpowalzrbddorfnnmccp-auth-token");
    if (!token) return { name: "", email: "" };

    const parsed = JSON.parse(token);
    return {
      name:
        parsed?.user?.user_metadata?.full_name ||
        parsed?.user?.user_metadata?.name ||
        "",
      email: parsed?.user?.email || "",
    };
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

    return true;
  } catch {
    return false;
  }
}

export async function sendWebsiteToWebhook(website: string, company: string) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: companyData } = await supabase
      .from("company")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!companyData?.id) return false;

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

    return res.ok;
  } catch {
    return false;
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