import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared Supabase admin client factory.
 * Reuse across all API routes instead of defining inline.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, key);
}

/**
 * Authenticate a user request via Supabase Bearer token.
 * Returns the authenticated user's ID on success, or an error string on failure.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ userId: string; error?: never } | { error: string; userId?: never }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { error: "Authorization header required" };
  }

  const token = authHeader.replace("Bearer ", "");
  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);

  if (error || !user) {
    return { error: "Unauthorized" };
  }

  return { userId: user.id };
}

/**
 * Standard 401 Unauthorized JSON response.
 */
export function unauthorizedResponse(message?: string): NextResponse {
  return NextResponse.json(
    { success: false, error: message || "Unauthorized" },
    { status: 401 }
  );
}

/**
 * Authenticate a cron request via CRON_SECRET Bearer token.
 * Fails CLOSED: rejects if CRON_SECRET env var is missing.
 */
export function authenticateCronRequest(request: NextRequest): { ok: boolean; response?: NextResponse } {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[Cron Auth] CRON_SECRET environment variable not configured");
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized - cron endpoint not configured" },
        { status: 401 }
      ),
    };
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[Cron Auth] Invalid or missing authorization");
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true };
}
