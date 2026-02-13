import { NextRequest, NextResponse } from "next/server";
import { semanticSearch, getRelevantContext } from "@/lib/embeddings";
import { authenticateRequest, unauthorizedResponse } from "@/lib/auth";

/**
 * POST /api/embeddings/search
 *
 * Semantic search across user's workspace.
 *
 * Body:
 * - query: string (the search query)
 * - userId: string (required)
 * - limit?: number (default 10)
 * - sourceTypes?: ("transcript" | "company" | "coaching_note")[]
 * - minSimilarity?: number (default 0.3)
 * - format?: "raw" | "context" (default "raw")
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return unauthorizedResponse(auth.error);

    const body = await req.json();
    const {
      query,
      userId,
      limit = 10,
      sourceTypes,
      minSimilarity = 0.3,
      format = "raw",
    } = body;

    if (!query) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (format === "context") {
      // Return formatted context for AI agent
      const context = await getRelevantContext(userId, query, limit);
      return NextResponse.json({
        success: true,
        context,
      });
    }

    // Return raw search results
    const results = await semanticSearch(userId, query, {
      limit,
      sourceTypes,
      minSimilarity,
    });

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error("[Embeddings Search API] Error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
