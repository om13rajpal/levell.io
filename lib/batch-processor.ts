import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================
// Configuration
// ============================================

export const BATCH_CONFIG = {
  MAX_CONCURRENT_TRANSCRIPTS: parseInt(process.env.RECOMMENDATION_CONCURRENCY || "5", 10),
  BATCH_SIZE: parseInt(process.env.RECOMMENDATION_BATCH_SIZE || "25", 10),
  RATE_LIMIT_DELAY_MS: 500,
  SCORING_BATCH_SIZE: 20,
  SCORING_CHUNK_SIZE: 5,
};

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
// Batch Creation Utilities
// ============================================

/**
 * Split an array into batches of specified size
 */
export function createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Delay helper for rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Batch Processing Results
// ============================================

export interface BatchItemResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  itemId?: string | number;
}

export interface BatchResult<T> {
  total: number;
  processed: number;
  failed: number;
  results: BatchItemResult<T>[];
  errors: Array<{ itemId?: string | number; error: string }>;
}

// ============================================
// Concurrent Batch Processing
// ============================================

/**
 * Process batches with concurrency control and rate limiting
 * Uses Promise.allSettled for graceful failure handling
 */
export async function processBatchesConcurrently<T, R>(
  batches: T[][],
  processor: (batch: T[], batchIndex: number) => Promise<BatchItemResult<R>[]>,
  options: {
    concurrency?: number;
    delayMs?: number;
    onProgress?: (processed: number, total: number) => void;
  } = {}
): Promise<BatchResult<R>> {
  const { concurrency = BATCH_CONFIG.MAX_CONCURRENT_TRANSCRIPTS, delayMs = BATCH_CONFIG.RATE_LIMIT_DELAY_MS, onProgress } = options;

  const result: BatchResult<R> = {
    total: batches.reduce((sum, b) => sum + b.length, 0),
    processed: 0,
    failed: 0,
    results: [],
    errors: [],
  };

  // Process batches with concurrency limit
  for (let i = 0; i < batches.length; i += concurrency) {
    const concurrentBatches = batches.slice(i, i + concurrency);

    // Process concurrent batches
    const batchPromises = concurrentBatches.map((batch, idx) => processor(batch, i + idx));

    const settledResults = await Promise.allSettled(batchPromises);

    // Collect results
    for (let batchIdx = 0; batchIdx < settledResults.length; batchIdx++) {
      const settled = settledResults[batchIdx];
      if (settled.status === "fulfilled") {
        for (const itemResult of settled.value) {
          result.results.push(itemResult);
          if (itemResult.success) {
            result.processed++;
          } else {
            result.failed++;
            if (itemResult.error) {
              result.errors.push({
                itemId: itemResult.itemId,
                error: itemResult.error,
              });
            }
          }
        }
      } else {
        // Entire batch failed - use correct batch index
        const failedBatch = concurrentBatches[batchIdx];
        result.failed += failedBatch?.length || 0;
        result.errors.push({ error: settled.reason?.message || "Unknown batch error" });
      }
    }

    // Progress callback
    onProgress?.(result.processed + result.failed, result.total);

    // Rate limiting delay between batch groups
    if (i + concurrency < batches.length && delayMs > 0) {
      await delay(delayMs);
    }
  }

  return result;
}

/**
 * Process items individually with concurrency control
 * Useful for single-item processing with rate limits
 */
export async function processItemsConcurrently<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<BatchItemResult<R>>,
  options: {
    concurrency?: number;
    delayMs?: number;
    onProgress?: (processed: number, total: number) => void;
  } = {}
): Promise<BatchResult<R>> {
  const { concurrency = BATCH_CONFIG.MAX_CONCURRENT_TRANSCRIPTS, delayMs = BATCH_CONFIG.RATE_LIMIT_DELAY_MS, onProgress } = options;

  const result: BatchResult<R> = {
    total: items.length,
    processed: 0,
    failed: 0,
    results: [],
    errors: [],
  };

  // Process items with concurrency limit
  for (let i = 0; i < items.length; i += concurrency) {
    const concurrentItems = items.slice(i, i + concurrency);

    // Process concurrent items
    const itemPromises = concurrentItems.map((item, idx) => processor(item, i + idx));

    const settledResults = await Promise.allSettled(itemPromises);

    // Collect results
    for (let j = 0; j < settledResults.length; j++) {
      const settled = settledResults[j];
      if (settled.status === "fulfilled") {
        result.results.push(settled.value);
        if (settled.value.success) {
          result.processed++;
        } else {
          result.failed++;
          if (settled.value.error) {
            result.errors.push({
              itemId: settled.value.itemId,
              error: settled.value.error,
            });
          }
        }
      } else {
        result.failed++;
        result.errors.push({
          itemId: i + j,
          error: settled.reason?.message || "Unknown error",
        });
      }
    }

    // Progress callback
    onProgress?.(result.processed + result.failed, result.total);

    // Rate limiting delay between chunks
    if (i + concurrency < items.length && delayMs > 0) {
      await delay(delayMs);
    }
  }

  return result;
}

// ============================================
// Job Progress Tracking
// ============================================

/**
 * Update recommendation job progress
 */
export async function updateJobProgress(
  jobId: number,
  processed: number,
  total: number,
  status?: "pending" | "processing" | "completed" | "failed"
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

    const updateData: Record<string, unknown> = {
      processed_items: processed,
      progress,
    };

    if (status) {
      updateData.status = status;
      if (status === "processing" && !processed) {
        updateData.started_at = new Date().toISOString();
      }
      if (status === "completed" || status === "failed") {
        updateData.completed_at = new Date().toISOString();
      }
    }

    const { error } = await supabase
      .from("recommendation_jobs")
      .update(updateData)
      .eq("id", jobId);

    if (error) {
      console.error("[BatchProcessor] Error updating job progress:", error);
    }
  } catch (error) {
    console.error("[BatchProcessor] Error in updateJobProgress:", error);
  }
}

/**
 * Create a new recommendation job
 */
export async function createRecommendationJob(
  jobType: "company_clustering" | "user_recommendations" | "icp_research",
  userId: string,
  targetId?: string,
  totalItems?: number
): Promise<number | null> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("recommendation_jobs")
      .insert({
        job_type: jobType,
        user_id: userId,
        target_id: targetId,
        total_items: totalItems || 0,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[BatchProcessor] Error creating job:", error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error("[BatchProcessor] Error in createRecommendationJob:", error);
    return null;
  }
}

/**
 * Mark job as failed with error message
 */
export async function failJob(jobId: number, errorMessage: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("recommendation_jobs")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (error) {
      console.error("[BatchProcessor] Error failing job:", error);
    }
  } catch (error) {
    console.error("[BatchProcessor] Error in failJob:", error);
  }
}

/**
 * Complete job with result
 */
export async function completeJob(
  jobId: number,
  result?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("recommendation_jobs")
      .update({
        status: "completed",
        progress: 100,
        result,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (error) {
      console.error("[BatchProcessor] Error completing job:", error);
    }
  } catch (error) {
    console.error("[BatchProcessor] Error in completeJob:", error);
  }
}

// ============================================
// Batch Job Tracking (Scoring)
// ============================================

/**
 * Create a scoring batch job
 */
export async function createScoringBatchJob(
  triggeredBy: "cron" | "manual",
  totalTranscripts: number
): Promise<number | null> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("scoring_batch_jobs")
      .insert({
        triggered_by: triggeredBy,
        total_transcripts: totalTranscripts,
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[BatchProcessor] Error creating scoring batch job:", error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error("[BatchProcessor] Error in createScoringBatchJob:", error);
    return null;
  }
}

/**
 * Update scoring batch job progress
 */
export async function updateScoringBatchProgress(
  jobId: number,
  processed: number,
  failed: number,
  errors?: Array<{ transcript_id: number; error: string }>
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("scoring_batch_jobs")
      .update({
        processed_count: processed,
        failed_count: failed,
        errors: errors || null,
      })
      .eq("id", jobId);

    if (error) {
      console.error("[BatchProcessor] Error updating scoring batch progress:", error);
    }
  } catch (error) {
    console.error("[BatchProcessor] Error in updateScoringBatchProgress:", error);
  }
}

/**
 * Complete scoring batch job
 */
export async function completeScoringBatchJob(
  jobId: number,
  processed: number,
  failed: number,
  errors?: Array<{ transcript_id: number; error: string }>
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    const status = failed > 0 && processed === 0 ? "failed" : "completed";

    const { error } = await supabase
      .from("scoring_batch_jobs")
      .update({
        status,
        processed_count: processed,
        failed_count: failed,
        errors: errors || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (error) {
      console.error("[BatchProcessor] Error completing scoring batch job:", error);
    }
  } catch (error) {
    console.error("[BatchProcessor] Error in completeScoringBatchJob:", error);
  }
}
