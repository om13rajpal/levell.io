/**
 * Fireflies Sync API Endpoints
 *
 * POST /api/fireflies/sync - Sync transcripts from Fireflies to database
 * GET /api/fireflies/sync - Fetch transcripts list from Fireflies (preview)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createFirefliesService } from "@/lib/services/fireflies-service";

// ============================================
// Validation Schemas
// ============================================

const SyncRequestSchema = z.object({
  internalOrgId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  skip: z.number().min(0).optional().default(0),
  daysBack: z.number().min(1).max(365).optional().default(60),
});

const ImportRequestSchema = z.object({
  firefliesIds: z.array(z.string()).min(1).max(50),
  internalOrgId: z.string().uuid().optional(),
});

// ============================================
// Helper Functions
// ============================================

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, key);
}

type AuthResult = { userId: string; error: null } | { userId: null; error: string };

async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { userId: null, error: "Authorization header required" };
  }

  const token = authHeader.replace("Bearer ", "");
  const admin = getSupabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(token);

  if (error || !user) {
    return { userId: null, error: "Unauthorized" };
  }

  return { userId: user.id, error: null };
}

async function getFirefliesApiKey(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("api_keys")
    .select("fireflies")
    .eq("user_id", userId)
    .single();

  return data?.fireflies || null;
}

// ============================================
// GET /api/fireflies/sync
// Fetch transcripts list from Fireflies (preview/list)
// ============================================

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");
    const daysBack = parseInt(searchParams.get("daysBack") || "60");

    // Get user's Fireflies API key
    const apiKey = await getFirefliesApiKey(userId);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Fireflies API key not configured. Please add your API key in settings." },
        { status: 400 }
      );
    }

    // Create service and fetch transcripts
    const service = createFirefliesService(apiKey);
    const transcripts = await service.fetchTranscriptsList({
      limit,
      skip,
      daysBack,
    });

    return NextResponse.json({
      success: true,
      data: {
        transcripts,
        count: transcripts.length,
        pagination: { limit, skip, hasMore: transcripts.length >= limit },
      },
    });
  } catch (error) {
    console.error("[Fireflies Sync GET] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("UNAUTHORIZED")) {
      return NextResponse.json(
        { error: "Invalid or expired Fireflies API token. Please reconnect Fireflies in settings." },
        { status: 401 }
      );
    }

    if (message.includes("RATE_LIMITED")) {
      return NextResponse.json(
        { error: "Rate limited by Fireflies API. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch transcripts", details: message },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/fireflies/sync
// Sync transcripts from Fireflies to temp_transcripts
// ============================================

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;
    const body = await request.json();

    // Check if this is a sync request or import request
    if (body.firefliesIds) {
      // Import selected transcripts to main table
      const validatedData = ImportRequestSchema.parse(body);

      const apiKey = await getFirefliesApiKey(userId);
      if (!apiKey) {
        return NextResponse.json(
          { error: "Fireflies API key not configured" },
          { status: 400 }
        );
      }

      const supabase = getSupabaseAdmin();
      const service = createFirefliesService(apiKey, supabase);

      const result = await service.importToMainTranscripts(
        userId,
        validatedData.firefliesIds,
        validatedData.internalOrgId
      );

      return NextResponse.json({
        success: true,
        data: {
          imported: result.imported,
          errors: result.errors,
          transcriptIds: result.transcriptIds,
          message: `Successfully imported ${result.imported} transcripts`,
        },
      });
    } else {
      // Sync to temp_transcripts
      const validatedData = SyncRequestSchema.parse(body);

      const apiKey = await getFirefliesApiKey(userId);
      if (!apiKey) {
        return NextResponse.json(
          { error: "Fireflies API key not configured" },
          { status: 400 }
        );
      }

      const supabase = getSupabaseAdmin();
      const service = createFirefliesService(apiKey, supabase);

      // Update sync status
      await supabase
        .from("users")
        .update({ transcript_sync_status: "syncing" })
        .eq("id", userId);

      const result = await service.syncToTempTranscripts(userId, {
        daysBack: validatedData.daysBack,
      });

      // Update sync status
      await supabase
        .from("users")
        .update({
          transcript_sync_status: result.errors > 0 ? "partial" : "completed",
          last_transcript_sync: new Date().toISOString(),
        })
        .eq("id", userId);

      return NextResponse.json({
        success: true,
        data: {
          synced: result.synced,
          errors: result.errors,
          transcriptIds: result.transcriptIds,
          message: `Synced ${result.synced} transcripts`,
        },
      });
    }
  } catch (error) {
    console.error("[Fireflies Sync POST] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("UNAUTHORIZED")) {
      return NextResponse.json(
        { error: "Invalid or expired Fireflies API token" },
        { status: 401 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to sync transcripts", details: message },
      { status: 500 }
    );
  }
}
