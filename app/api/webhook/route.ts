import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const company_id = data?.company_id ?? null;

    // Extract markdown safely
    const markdown =
      data?.markdown ||
      data?.data ||
      data?.payload?.markdown ||
      data?.payload?.data ||
      "";

    // Extract json_val safely
    let json_val =
      data?.json_val ||
      data?.payload?.json_val ||
      data?.payload?.data?.json_val ||
      "";

    // Remove ```json fences if present
    if (typeof json_val === "string") {
      json_val = json_val.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    // Validate JSON – do not crash API
    let parsedJson = null;
    try {
      parsedJson = json_val ? JSON.parse(json_val) : null;
    } catch (e) {
      console.error("❌ Invalid json_val; storing raw string instead");
      parsedJson = json_val;
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