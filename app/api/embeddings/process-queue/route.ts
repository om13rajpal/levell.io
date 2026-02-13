import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ingestTranscript, ingestCompany } from "@/lib/embeddings";
import { authenticateCronRequest } from "@/lib/auth";

export const maxDuration = 300; // 5 minutes

// Initialize Supabase admin client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables not configured");
  }

  return createClient(url, key);
}

/**
 * POST /api/embeddings/process-queue
 *
 * Process pending items in the embedding queue.
 * Should be called by a cron job or scheduled task.
 *
 * Body (optional):
 * - batchSize?: number (default 10)
 * - apiKey?: string (for authentication)
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate cron request - fail closed
    const cronAuth = authenticateCronRequest(req);
    if (!cronAuth.ok) return cronAuth.response!;

    const body = await req.json().catch(() => ({}));
    const { batchSize = 10 } = body;

    const supabase = getSupabaseAdmin();

    // Fetch pending items from queue
    const { data: pendingItems, error: fetchError } = await supabase
      .from("embedding_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      console.error("[Queue] Error fetching pending items:", fetchError);
      throw fetchError;
    }

    if (!pendingItems || pendingItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending items in queue",
        processed: 0,
      });
    }

    console.log(`[Queue] Processing ${pendingItems.length} items`);

    let processed = 0;
    let failed = 0;

    for (const item of pendingItems) {
      try {
        // Mark as processing
        await supabase
          .from("embedding_queue")
          .update({ status: "processing", attempts: item.attempts + 1 })
          .eq("id", item.id);

        // Process based on source type
        if (item.source_type === "transcript") {
          await ingestTranscript(parseInt(item.source_id));
        } else if (item.source_type === "company") {
          await ingestCompany(item.source_id, item.user_id);
        }

        // Mark as completed
        await supabase
          .from("embedding_queue")
          .update({ status: "completed", processed_at: new Date().toISOString() })
          .eq("id", item.id);

        processed++;
        console.log(`[Queue] Processed ${item.source_type} ${item.source_id}`);
      } catch (error) {
        console.error(`[Queue] Failed to process ${item.source_type} ${item.source_id}:`, error);

        // Mark as failed (or back to pending for retry)
        const newStatus = item.attempts >= 3 ? "failed" : "pending";
        await supabase
          .from("embedding_queue")
          .update({
            status: newStatus,
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", item.id);

        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} items, ${failed} failed`,
      processed,
      failed,
      total: pendingItems.length,
    });
  } catch (error) {
    console.error("[Queue API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to process queue",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy cron triggering
export async function GET(req: NextRequest) {
  try {
    // Authenticate cron request - fail closed
    const cronAuth = authenticateCronRequest(req);
    if (!cronAuth.ok) return cronAuth.response!;

    const supabase = getSupabaseAdmin();

    // Fetch pending items from queue
    const { data: pendingItems, error: fetchError } = await supabase
      .from("embedding_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error("[Queue] Error fetching pending items:", fetchError);
      throw fetchError;
    }

    if (!pendingItems || pendingItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending items in queue",
        processed: 0,
      });
    }

    console.log(`[Queue] Processing ${pendingItems.length} items`);

    let processed = 0;
    let failed = 0;

    for (const item of pendingItems) {
      try {
        await supabase
          .from("embedding_queue")
          .update({ status: "processing", attempts: item.attempts + 1 })
          .eq("id", item.id);

        if (item.source_type === "transcript") {
          await ingestTranscript(parseInt(item.source_id));
        } else if (item.source_type === "company") {
          await ingestCompany(item.source_id, item.user_id);
        }

        await supabase
          .from("embedding_queue")
          .update({ status: "completed", processed_at: new Date().toISOString() })
          .eq("id", item.id);

        processed++;
        console.log(`[Queue] Processed ${item.source_type} ${item.source_id}`);
      } catch (error) {
        console.error(`[Queue] Failed to process ${item.source_type} ${item.source_id}:`, error);

        const newStatus = item.attempts >= 3 ? "failed" : "pending";
        await supabase
          .from("embedding_queue")
          .update({
            status: newStatus,
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", item.id);

        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} items, ${failed} failed`,
      processed,
      failed,
      total: pendingItems.length,
    });
  } catch (error) {
    console.error("[Queue API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to process queue",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
