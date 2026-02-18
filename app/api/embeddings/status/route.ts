import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, unauthorizedResponse } from "@/lib/auth";

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
 * GET /api/embeddings/status?userId=...
 *
 * Get embedding status for a user's workspace.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return unauthorizedResponse(auth.error);

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get total transcripts for user
    const { count: totalTranscripts } = await supabase
      .from("transcripts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    // Get indexed transcripts count
    const { data: indexedData } = await supabase
      .from("workspace_embeddings")
      .select("source_id")
      .eq("user_id", userId)
      .eq("source_type", "transcript");

    const uniqueIndexedTranscripts = new Set(
      (indexedData || []).map((e) => e.source_id)
    ).size;

    // Get pending queue items
    const { count: pendingCount } = await supabase
      .from("embedding_queue")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");

    // Get failed queue items
    const { count: failedCount } = await supabase
      .from("embedding_queue")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "failed");

    const isFullyIndexed = uniqueIndexedTranscripts >= (totalTranscripts || 0);

    return NextResponse.json({
      success: true,
      userId,
      stats: {
        totalTranscripts: totalTranscripts || 0,
        indexedTranscripts: uniqueIndexedTranscripts,
        pendingInQueue: pendingCount || 0,
        failedInQueue: failedCount || 0,
        indexingProgress: totalTranscripts
          ? Math.round((uniqueIndexedTranscripts / totalTranscripts) * 100)
          : 100,
        isFullyIndexed,
      },
      capabilities: {
        semanticSearchEnabled: uniqueIndexedTranscripts > 0,
        workspaceModeReady: uniqueIndexedTranscripts >= 5, // Require at least 5 indexed for good results
      },
    });
  } catch (error) {
    console.error("[Embeddings Status API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to get status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
