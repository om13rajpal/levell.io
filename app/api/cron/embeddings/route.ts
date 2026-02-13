import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ingestTranscript, ingestCompany } from "@/lib/embeddings";
import { authenticateCronRequest } from "@/lib/auth";

export const maxDuration = 300; // 5 minutes max
export const dynamic = "force-dynamic";

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
 * GET /api/cron/embeddings
 *
 * Cron job that runs every 5 minutes to:
 * 1. Process pending items in the embedding queue
 * 2. Find and queue any unindexed transcripts for all users
 *
 * Protected by CRON_SECRET for Vercel Cron or manual triggers
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret - fail closed
    const cronAuth = authenticateCronRequest(req);
    if (!cronAuth.ok) return cronAuth.response!;

    const supabase = getSupabaseAdmin();
    const results = {
      queueProcessed: 0,
      queueFailed: 0,
      usersChecked: 0,
      newItemsQueued: 0,
      errors: [] as string[],
    };

    console.log("[Cron] Starting embeddings cron job...");

    // =========================================
    // STEP 1: Find unindexed transcripts and queue them
    // =========================================

    // Get all users with transcripts
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id")
      .not("id", "is", null);

    if (usersError) {
      console.error("[Cron] Error fetching users:", usersError);
      results.errors.push(`Failed to fetch users: ${usersError.message}`);
    } else {
      console.log(`[Cron] Checking ${users?.length || 0} users for unindexed transcripts`);

      for (const user of users || []) {
        try {
          results.usersChecked++;

          // Get transcripts that have been scored but not yet indexed
          const { data: unindexedTranscripts } = await supabase
            .from("transcripts")
            .select("id")
            .eq("user_id", user.id)
            .not("ai_summary", "is", null); // Only scored transcripts

          if (!unindexedTranscripts || unindexedTranscripts.length === 0) {
            continue;
          }

          // Get already indexed transcript IDs for this user
          const { data: indexedEmbeddings } = await supabase
            .from("workspace_embeddings")
            .select("source_id")
            .eq("user_id", user.id)
            .eq("source_type", "transcript");

          const indexedIds = new Set(
            (indexedEmbeddings || []).map((e) => e.source_id)
          );

          // Get already queued transcript IDs
          const { data: queuedItems } = await supabase
            .from("embedding_queue")
            .select("source_id")
            .eq("user_id", user.id)
            .eq("source_type", "transcript")
            .in("status", ["pending", "processing"]);

          const queuedIds = new Set(
            (queuedItems || []).map((q) => q.source_id)
          );

          // Find transcripts that need to be queued
          const toQueue = unindexedTranscripts.filter(
            (t) => !indexedIds.has(t.id.toString()) && !queuedIds.has(t.id.toString())
          );

          if (toQueue.length > 0) {
            // Queue them for processing
            const queueRows = toQueue.map((t) => ({
              source_type: "transcript",
              source_id: t.id.toString(),
              user_id: user.id,
              status: "pending",
            }));

            const { error: queueError } = await supabase
              .from("embedding_queue")
              .upsert(queueRows, {
                onConflict: "source_type,source_id",
                ignoreDuplicates: true
              });

            if (queueError) {
              console.error(`[Cron] Error queueing for user ${user.id}:`, queueError);
              results.errors.push(`Queue error for user ${user.id}: ${queueError.message}`);
            } else {
              results.newItemsQueued += toQueue.length;
              console.log(`[Cron] Queued ${toQueue.length} transcripts for user ${user.id}`);
            }
          }
        } catch (userError) {
          console.error(`[Cron] Error processing user ${user.id}:`, userError);
          results.errors.push(`User ${user.id}: ${userError instanceof Error ? userError.message : "Unknown error"}`);
        }
      }
    }

    // =========================================
    // STEP 2: Process pending queue items
    // =========================================

    const BATCH_SIZE = 20; // Process up to 20 items per run

    const { data: pendingItems, error: fetchError } = await supabase
      .from("embedding_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("[Cron] Error fetching queue:", fetchError);
      results.errors.push(`Queue fetch error: ${fetchError.message}`);
    } else if (pendingItems && pendingItems.length > 0) {
      console.log(`[Cron] Processing ${pendingItems.length} queued items`);

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
            .update({
              status: "completed",
              processed_at: new Date().toISOString()
            })
            .eq("id", item.id);

          results.queueProcessed++;
          console.log(`[Cron] Processed ${item.source_type} ${item.source_id}`);
        } catch (error) {
          console.error(`[Cron] Failed ${item.source_type} ${item.source_id}:`, error);

          // Mark as failed or back to pending for retry
          const newStatus = item.attempts >= 3 ? "failed" : "pending";
          await supabase
            .from("embedding_queue")
            .update({
              status: newStatus,
              error_message: error instanceof Error ? error.message : "Unknown error",
            })
            .eq("id", item.id);

          results.queueFailed++;
          results.errors.push(`${item.source_type} ${item.source_id}: ${error instanceof Error ? error.message : "Unknown"}`);
        }
      }
    } else {
      console.log("[Cron] No pending items in queue");
    }

    // =========================================
    // STEP 3: Clean up old completed/failed items (older than 7 days)
    // =========================================

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from("embedding_queue")
      .delete()
      .in("status", ["completed", "failed"])
      .lt("processed_at", sevenDaysAgo);

    const duration = Date.now() - startTime;

    console.log(`[Cron] Completed in ${duration}ms:`, results);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      results,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[Cron] Fatal error:", error);

    return NextResponse.json(
      {
        success: false,
        duration_ms: duration,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
