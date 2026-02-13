import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, unauthorizedResponse } from "@/lib/auth";

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
 * POST /api/embeddings/init
 *
 * Initialize embeddings for all users - queues all unindexed transcripts.
 * This is a one-time setup endpoint to kickstart the embedding process.
 *
 * Body:
 * - apiKey?: string (for authentication)
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return unauthorizedResponse(auth.error);

    const supabase = getSupabaseAdmin();

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id");

    if (usersError) {
      throw usersError;
    }

    let totalQueued = 0;
    let usersProcessed = 0;

    for (const user of users || []) {
      // Get all scored transcripts for this user
      const { data: transcripts } = await supabase
        .from("transcripts")
        .select("id")
        .eq("user_id", user.id)
        .not("ai_summary", "is", null);

      if (!transcripts || transcripts.length === 0) {
        continue;
      }

      // Get already indexed
      const { data: indexed } = await supabase
        .from("workspace_embeddings")
        .select("source_id")
        .eq("user_id", user.id)
        .eq("source_type", "transcript");

      const indexedIds = new Set((indexed || []).map((e) => e.source_id));

      // Get already queued
      const { data: queued } = await supabase
        .from("embedding_queue")
        .select("source_id")
        .eq("user_id", user.id)
        .eq("source_type", "transcript")
        .in("status", ["pending", "processing"]);

      const queuedIds = new Set((queued || []).map((q) => q.source_id));

      // Find transcripts that need to be queued
      const toQueue = transcripts.filter(
        (t) => !indexedIds.has(t.id.toString()) && !queuedIds.has(t.id.toString())
      );

      if (toQueue.length > 0) {
        const queueRows = toQueue.map((t) => ({
          source_type: "transcript",
          source_id: t.id.toString(),
          user_id: user.id,
          status: "pending",
        }));

        await supabase
          .from("embedding_queue")
          .upsert(queueRows, {
            onConflict: "source_type,source_id",
            ignoreDuplicates: true
          });

        totalQueued += toQueue.length;
        usersProcessed++;
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Initialization complete. Queued ${totalQueued} transcripts for ${usersProcessed} users.`,
      duration_ms: duration,
      stats: {
        usersChecked: users?.length || 0,
        usersWithNewItems: usersProcessed,
        itemsQueued: totalQueued,
      },
    });
  } catch (error) {
    console.error("[Init] Error:", error);
    return NextResponse.json(
      {
        error: "Initialization failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
