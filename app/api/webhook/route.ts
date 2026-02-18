import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

// Webhook secret for authentication (set in environment variables)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    // Verify webhook secret if configured
    if (WEBHOOK_SECRET) {
      const authHeader = req.headers.get("x-webhook-secret") || req.headers.get("authorization");
      const providedSecret = authHeader?.replace("Bearer ", "");

      if (providedSecret !== WEBHOOK_SECRET) {
        console.error("❌ Webhook authentication failed - invalid secret");
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    } else {
      // Log warning if no secret configured (for development awareness)
      console.warn("⚠️ WEBHOOK_SECRET not configured - webhook is unprotected");
    }

    const data = await req.json();

    const company_id = data?.company_id ?? null;

    // Extract markdown safely
    // Response structure: { data: { markdown, analysis } }
    const markdown =
      data?.data?.markdown ||
      data?.markdown ||
      data?.payload?.markdown ||
      data?.payload?.data?.markdown ||
      "";

    // Extract analysis/json_val safely
    // The analysis data comes as "analysis" from the webhook
    let json_val =
      data?.data?.analysis ||
      data?.analysis ||
      data?.json_val ||
      data?.data?.json_val ||
      data?.payload?.json_val ||
      data?.payload?.data?.analysis ||
      "";

    // Handle json_val - it might already be an object or a string
    let parsedJson = null;

    if (json_val) {
      if (typeof json_val === "object") {
        // Already an object, use directly
        parsedJson = json_val;
      } else if (typeof json_val === "string") {
        // Remove ```json fences if present
        const cleanedJson = json_val.replace(/```json/g, "").replace(/```/g, "").trim();

        // Try to parse as JSON
        try {
          parsedJson = JSON.parse(cleanedJson);
        } catch (e) {
          console.error("❌ Invalid json_val; storing raw string instead");
          parsedJson = cleanedJson;
        }
      }
    }

    // INSERT if no company_id
    if (!company_id) {
      const { data: inserted, error } = await supabase
        .from("webhook_data")
        .insert([{ payload: data, markdown, json_val: parsedJson }])
        .select("*");

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: "Inserted new record (no company_id)",
        data: inserted,
      });
    }

    // UPSERT when company_id exists
    const { data: result, error } = await supabase
      .from("webhook_data")
      .upsert(
        {
          company_id,
          payload: data,
          markdown,
          json_val: parsedJson,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "company_id",
          ignoreDuplicates: false,
        }
      )
      .select("*");

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Upsert successful",
      data: result,
    });
  } catch (error: any) {
    console.error("❌ Webhook UPSERT failed:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}