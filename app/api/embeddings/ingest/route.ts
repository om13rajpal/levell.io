import { NextRequest, NextResponse } from "next/server";
import {
  ingestTranscript,
  ingestCompany,
  ingestAllUserTranscripts,
} from "@/lib/embeddings";
import { authenticateRequest, unauthorizedResponse } from "@/lib/auth";

export const maxDuration = 300; // 5 minutes for bulk ingestion

/**
 * POST /api/embeddings/ingest
 *
 * Ingest content into the workspace embeddings for semantic search.
 *
 * Body:
 * - action: "transcript" | "company" | "bulk_transcripts"
 * - transcriptId?: number (for transcript action)
 * - companyId?: string (for company action)
 * - userId: string (required for all actions)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return unauthorizedResponse(auth.error);

    const body = await req.json();
    const { action, transcriptId, companyId, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "transcript": {
        if (!transcriptId) {
          return NextResponse.json(
            { error: "transcriptId is required for transcript action" },
            { status: 400 }
          );
        }

        await ingestTranscript(transcriptId);
        return NextResponse.json({
          success: true,
          message: `Transcript ${transcriptId} ingested successfully`,
        });
      }

      case "company": {
        if (!companyId) {
          return NextResponse.json(
            { error: "companyId is required for company action" },
            { status: 400 }
          );
        }

        await ingestCompany(companyId, userId);
        return NextResponse.json({
          success: true,
          message: `Company ${companyId} ingested successfully`,
        });
      }

      case "bulk_transcripts": {
        const result = await ingestAllUserTranscripts(userId);
        return NextResponse.json({
          success: true,
          message: `Bulk ingestion complete`,
          processed: result.processed,
          errors: result.errors,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Embeddings API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to ingest content",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
