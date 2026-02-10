import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import type { CachedPrompt } from "@/types/recommendation-types";

// ============================================
// Configuration
// ============================================

const CACHE_TTL_HOURS = parseInt(process.env.PROMPT_CACHE_TTL_HOURS || "1", 10);
const CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000;

// ============================================
// Supabase Admin Client
// ============================================

let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdminInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Supabase environment variables are not configured");
    }

    supabaseAdminInstance = createClient(url, key);
  }
  return supabaseAdminInstance;
}

// ============================================
// Hash Generation
// ============================================

/**
 * Generate SHA256 hash of content for cache validation
 */
export function generateContentHash(transcript: string, context: string): string {
  const content = `${transcript}|||${context}`;
  return createHash("sha256").update(content).digest("hex");
}

// ============================================
// Cache Operations
// ============================================

/**
 * Get cached prompt data for a transcript
 * Returns null if not found or expired
 */
export async function getCachedPrompt(transcriptId: number): Promise<CachedPrompt | null> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("prompt_cache")
      .select("*")
      .eq("transcript_id", transcriptId)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned - cache miss
        return null;
      }
      console.error("[PromptCache] Error fetching cache:", error);
      return null;
    }

    console.log(`[PromptCache] Cache HIT for transcript ${transcriptId}`);
    return data as CachedPrompt;
  } catch (error) {
    console.error("[PromptCache] Error in getCachedPrompt:", error);
    return null;
  }
}

/**
 * Store formatted prompt data in cache
 */
export async function setCachedPrompt(
  transcriptId: number,
  formattedTranscript: string,
  formattedContext: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const contentHash = generateContentHash(formattedTranscript, formattedContext);
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

    const { error } = await supabase
      .from("prompt_cache")
      .upsert(
        {
          transcript_id: transcriptId,
          content_hash: contentHash,
          formatted_transcript: formattedTranscript,
          formatted_context: formattedContext,
          expires_at: expiresAt,
        },
        { onConflict: "transcript_id" }
      );

    if (error) {
      console.error("[PromptCache] Error setting cache:", error);
      return;
    }

    console.log(`[PromptCache] Cache SET for transcript ${transcriptId}, expires in ${CACHE_TTL_HOURS}h`);
  } catch (error) {
    console.error("[PromptCache] Error in setCachedPrompt:", error);
  }
}

/**
 * Validate cached content against current transcript/context
 * Returns true if cache is valid, false if stale
 */
export async function validateCachedPrompt(
  transcriptId: number,
  currentTranscript: string,
  currentContext: string
): Promise<boolean> {
  try {
    const cached = await getCachedPrompt(transcriptId);
    if (!cached) return false;

    const currentHash = generateContentHash(currentTranscript, currentContext);
    const isValid = cached.content_hash === currentHash;

    if (!isValid) {
      console.log(`[PromptCache] Cache STALE for transcript ${transcriptId} - content changed`);
    }

    return isValid;
  } catch (error) {
    console.error("[PromptCache] Error in validateCachedPrompt:", error);
    return false;
  }
}

/**
 * Invalidate cache for a specific transcript
 */
export async function invalidatePromptCache(transcriptId: number): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("prompt_cache")
      .delete()
      .eq("transcript_id", transcriptId);

    if (error) {
      console.error("[PromptCache] Error invalidating cache:", error);
      return;
    }

    console.log(`[PromptCache] Cache INVALIDATED for transcript ${transcriptId}`);
  } catch (error) {
    console.error("[PromptCache] Error in invalidatePromptCache:", error);
  }
}

/**
 * Cleanup expired cache entries
 * Returns the number of entries deleted
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const supabase = getSupabaseAdmin();

    // Use the stored procedure for efficient cleanup
    const { data, error } = await supabase.rpc("cleanup_expired_prompt_cache");

    if (error) {
      // Fallback to manual delete if RPC fails
      console.warn("[PromptCache] RPC cleanup failed, using manual delete:", error);

      const { count } = await supabase
        .from("prompt_cache")
        .delete({ count: "exact" })
        .lt("expires_at", new Date().toISOString());

      console.log(`[PromptCache] Cleaned up ${count || 0} expired entries (manual)`);
      return count || 0;
    }

    console.log(`[PromptCache] Cleaned up ${data || 0} expired entries`);
    return data || 0;
  } catch (error) {
    console.error("[PromptCache] Error in cleanupExpiredCache:", error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  total: number;
  active: number;
  expired: number;
}> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Get total count
    const { count: totalCount } = await supabase
      .from("prompt_cache")
      .select("*", { count: "exact", head: true });

    // Get active count
    const { count: activeCount } = await supabase
      .from("prompt_cache")
      .select("*", { count: "exact", head: true })
      .gt("expires_at", now);

    const total = totalCount || 0;
    const active = activeCount || 0;
    const expired = total - active;

    return { total, active, expired };
  } catch (error) {
    console.error("[PromptCache] Error in getCacheStats:", error);
    return { total: 0, active: 0, expired: 0 };
  }
}

/**
 * Get or set cached prompt (convenience function)
 * Returns cached data if available, otherwise calls generator and caches result
 */
export async function getOrSetCachedPrompt(
  transcriptId: number,
  generator: () => Promise<{ transcript: string; context: string }>
): Promise<{ transcript: string; context: string; cached: boolean }> {
  // Try to get from cache first
  const cached = await getCachedPrompt(transcriptId);
  if (cached) {
    return {
      transcript: cached.formatted_transcript,
      context: cached.formatted_context,
      cached: true,
    };
  }

  // Generate fresh content
  const { transcript, context } = await generator();

  // Cache for next time (non-blocking)
  setCachedPrompt(transcriptId, transcript, context).catch((err) => {
    console.error("[PromptCache] Background cache set failed:", err);
  });

  return { transcript, context, cached: false };
}
