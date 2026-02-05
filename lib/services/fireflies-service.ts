/**
 * Fireflies.ai API Service
 *
 * Provides complete integration with Fireflies GraphQL API:
 * - Fetch transcript list (metadata)
 * - Fetch individual transcript with full details (sentences, summary, etc.)
 * - Sync transcripts to database
 *
 * API Docs: https://docs.fireflies.ai/graphql-api/query/transcripts
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================
// Constants
// ============================================
const FIREFLIES_API_URL = "https://api.fireflies.ai/graphql";
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_DAYS_BACK = 60;
const MAX_CONCURRENT_FETCHES = 5;

// ============================================
// Types
// ============================================

export interface FirefliesTranscriptMeta {
  id: string;
  title?: string;
  duration?: number;
  date?: string | number;
  organizer_email?: string;
  host_email?: string;
  participants?: string[];
  transcript_url?: string;
  audio_url?: string;
  video_url?: string;
  meeting_link?: string;
}

export interface FirefliesSentence {
  index: number;
  speaker_name?: string;
  speaker_id?: number;
  text?: string;
  raw_text?: string;
  start_time?: number;
  end_time?: number;
  ai_filters?: {
    task?: boolean;
    pricing?: boolean;
    metric?: boolean;
    question?: boolean;
    date_and_time?: boolean;
    sentiment?: string;
  };
}

export interface FirefliesAttendee {
  displayName?: string;
  email?: string;
  name?: string;
  phoneNumber?: string;
}

export interface FirefliesSummary {
  keywords?: string[];
  action_items?: string[];
  outline?: string[];
  overview?: string;
  short_summary?: string;
  meeting_type?: string;
  topics_discussed?: string[];
}

export interface FirefliesTranscriptDetail extends FirefliesTranscriptMeta {
  sentences?: FirefliesSentence[];
  meeting_attendees?: FirefliesAttendee[];
  summary?: FirefliesSummary;
  speakers?: Array<{ id: number; name: string }>;
}

export interface FetchTranscriptsOptions {
  limit?: number;
  skip?: number;
  fromDate?: Date;
  toDate?: Date;
  daysBack?: number;
  hostEmail?: string;
}

export interface TranscriptFetchResult {
  id: string;
  success: boolean;
  data?: FirefliesTranscriptDetail | null;
  error?: string;
}

interface GraphQLError {
  message?: string;
  extensions?: { code?: string; retryAfter?: string };
}

// ============================================
// GraphQL Queries
// ============================================

/**
 * Query for fetching transcript list (metadata only - no sentences)
 */
const GET_TRANSCRIPTS_LIST = `
  query GetTranscripts($limit: Int, $skip: Int, $fromDate: DateTime, $toDate: DateTime, $hostEmail: String) {
    transcripts(limit: $limit, skip: $skip, fromDate: $fromDate, toDate: $toDate, host_email: $hostEmail) {
      id
      title
      duration
      date
      organizer_email
      host_email
      participants
      transcript_url
      audio_url
      video_url
      meeting_link
    }
  }
`;

/**
 * Query for fetching full transcript detail including sentences
 */
const GET_TRANSCRIPT_DETAIL = `
  query GetTranscript($transcriptId: String!) {
    transcript(id: $transcriptId) {
      id
      title
      duration
      date
      organizer_email
      host_email
      transcript_url
      audio_url
      video_url
      meeting_link

      speakers {
        id
        name
      }

      sentences {
        index
        speaker_name
        speaker_id
        text
        raw_text
        start_time
        end_time
        ai_filters {
          task
          pricing
          metric
          question
          date_and_time
          sentiment
        }
      }

      meeting_attendees {
        displayName
        email
        name
        phoneNumber
      }

      summary {
        keywords
        action_items
        outline
        overview
        short_summary
        meeting_type
        topics_discussed
      }
    }
  }
`;

// ============================================
// Fireflies Service Class
// ============================================

export class FirefliesService {
  private apiKey: string;
  private supabase: SupabaseClient;

  constructor(apiKey: string, supabase?: SupabaseClient) {
    this.apiKey = apiKey;
    this.supabase = supabase || this.createSupabaseClient();
  }

  private createSupabaseClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase environment variables not configured");
    }
    return createClient(url, key);
  }

  /**
   * Execute GraphQL query against Fireflies API
   */
  private async executeQuery<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<{ data?: T; errors?: GraphQLError[] }> {
    const response = await fetch(FIREFLIES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("UNAUTHORIZED: Invalid or expired Fireflies API token");
    }

    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      const retryAfter = data.errors?.[0]?.extensions?.retryAfter;
      throw new Error(`RATE_LIMITED: ${retryAfter || "Please wait before retrying"}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP_ERROR: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch list of transcripts (metadata only, no sentences)
   */
  async fetchTranscriptsList(
    options: FetchTranscriptsOptions = {}
  ): Promise<FirefliesTranscriptMeta[]> {
    const {
      limit = DEFAULT_PAGE_SIZE,
      skip = 0,
      fromDate,
      toDate,
      daysBack = DEFAULT_DAYS_BACK,
      hostEmail,
    } = options;

    // Calculate fromDate if not provided
    const effectiveFromDate = fromDate || new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const variables = {
      limit: Math.min(limit, 50), // API max is 50
      skip,
      fromDate: effectiveFromDate.toISOString(),
      toDate: toDate?.toISOString(),
      hostEmail,
    };

    console.log("[FirefliesService] Fetching transcripts list:", { limit, skip, fromDate: variables.fromDate });

    const result = await this.executeQuery<{ transcripts: FirefliesTranscriptMeta[] }>(
      GET_TRANSCRIPTS_LIST,
      variables
    );

    if (result.errors?.length) {
      const authError = result.errors.some(
        (e) => e.extensions?.code === "UNAUTHENTICATED" || e.message?.toLowerCase().includes("unauthorized")
      );
      if (authError) {
        throw new Error("UNAUTHORIZED: Invalid or expired Fireflies API token");
      }
      throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
    }

    return result.data?.transcripts || [];
  }

  /**
   * Fetch all transcripts with pagination
   */
  async fetchAllTranscripts(
    options: Omit<FetchTranscriptsOptions, "limit" | "skip"> & { maxPages?: number } = {}
  ): Promise<FirefliesTranscriptMeta[]> {
    const { maxPages = 20, ...fetchOptions } = options;
    const allTranscripts: FirefliesTranscriptMeta[] = [];
    let skip = 0;
    let pageCount = 0;
    let hasMore = true;

    while (hasMore && pageCount < maxPages) {
      const transcripts = await this.fetchTranscriptsList({
        ...fetchOptions,
        limit: DEFAULT_PAGE_SIZE,
        skip,
      });

      allTranscripts.push(...transcripts);
      hasMore = transcripts.length >= DEFAULT_PAGE_SIZE;
      skip += DEFAULT_PAGE_SIZE;
      pageCount++;

      // Small delay between pages to avoid rate limiting
      if (hasMore && pageCount < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`[FirefliesService] Fetched ${allTranscripts.length} transcripts in ${pageCount} pages`);
    return allTranscripts;
  }

  /**
   * Fetch single transcript with full details (including sentences)
   */
  async fetchTranscriptDetail(transcriptId: string): Promise<FirefliesTranscriptDetail | null> {
    console.log("[FirefliesService] Fetching transcript detail:", transcriptId);

    const result = await this.executeQuery<{ transcript: FirefliesTranscriptDetail }>(
      GET_TRANSCRIPT_DETAIL,
      { transcriptId }
    );

    if (result.errors?.length) {
      console.error("[FirefliesService] Error fetching transcript:", result.errors);
      return null;
    }

    return result.data?.transcript || null;
  }

  /**
   * Fetch multiple transcripts in parallel with concurrency control
   */
  async fetchTranscriptsParallel(
    transcriptIds: string[],
    concurrency: number = MAX_CONCURRENT_FETCHES
  ): Promise<TranscriptFetchResult[]> {
    const results: TranscriptFetchResult[] = [];
    const queue = [...transcriptIds];

    console.log(`[FirefliesService] Fetching ${transcriptIds.length} transcripts with concurrency ${concurrency}`);

    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(async (id) => {
          try {
            const data = await this.fetchTranscriptDetail(id);
            return { id, success: !!data, data, error: data ? undefined : "Transcript not found" };
          } catch (error) {
            return {
              id,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            id: "unknown",
            success: false,
            error: result.reason?.message || "Promise rejected",
          });
        }
      }

      // Small delay between batches
      if (queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter((r) => r.success).length;
    console.log(`[FirefliesService] Completed: ${successful}/${transcriptIds.length} successful`);

    return results;
  }

  /**
   * Convert Fireflies date to ISO string
   */
  private convertFirefliesDate(dateValue: string | number | null | undefined): string | null {
    if (!dateValue) return null;
    try {
      if (typeof dateValue === "number") {
        // Unix timestamps in seconds are typically 10 digits
        const timestamp = dateValue > 9999999999 ? dateValue : dateValue * 1000;
        const date = new Date(timestamp);
        if (date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
          return date.toISOString();
        }
      }
      if (typeof dateValue === "string") {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
          return date.toISOString();
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Sync transcripts to database (upsert to temp_transcripts)
   */
  async syncToTempTranscripts(
    userId: string,
    options: FetchTranscriptsOptions = {}
  ): Promise<{ synced: number; errors: number; transcriptIds: string[] }> {
    console.log(`[FirefliesService] Starting sync for user ${userId}`);

    // Fetch all transcripts metadata
    const transcripts = await this.fetchAllTranscripts(options);

    if (transcripts.length === 0) {
      return { synced: 0, errors: 0, transcriptIds: [] };
    }

    // Map to temp_transcripts schema
    const tempRecords = transcripts.map((t) => ({
      user_id: userId,
      fireflies_id: String(t.id),
      title: t.title || "Untitled Meeting",
      duration: t.duration ? Math.round(t.duration / 60) : null,
      organizer_email: t.organizer_email || t.host_email || null,
      participants: t.participants || [],
      meeting_date: this.convertFirefliesDate(t.date),
      transcript_url: t.transcript_url,
      audio_url: t.audio_url,
      video_url: t.video_url,
      synced_at: new Date().toISOString(),
    }));

    // Upsert in batches
    const batchSize = 50;
    let synced = 0;
    let errors = 0;
    const syncedIds: string[] = [];

    for (let i = 0; i < tempRecords.length; i += batchSize) {
      const batch = tempRecords.slice(i, i + batchSize);
      const { data, error } = await this.supabase
        .from("temp_transcripts")
        .upsert(batch, { onConflict: "user_id,fireflies_id", ignoreDuplicates: false })
        .select("fireflies_id");

      if (error) {
        console.error("[FirefliesService] Batch upsert error:", error);
        errors += batch.length;
      } else {
        synced += batch.length;
        syncedIds.push(...(data?.map((d) => d.fireflies_id) || []));
      }
    }

    console.log(`[FirefliesService] Sync complete: ${synced} synced, ${errors} errors`);
    return { synced, errors, transcriptIds: syncedIds };
  }

  /**
   * Import selected transcripts to main transcripts table with full data
   */
  async importToMainTranscripts(
    userId: string,
    firefliesIds: string[],
    internalOrgId?: string
  ): Promise<{ imported: number; errors: number; transcriptIds: number[] }> {
    console.log(`[FirefliesService] Importing ${firefliesIds.length} transcripts for user ${userId}`);

    // Fetch full details for each transcript
    const detailResults = await this.fetchTranscriptsParallel(firefliesIds);
    const successfulDetails = detailResults.filter((r) => r.success && r.data);

    let imported = 0;
    let errors = 0;
    const importedIds: number[] = [];

    for (const result of successfulDetails) {
      const t = result.data!;

      try {
        // Prepare transcript record
        const transcriptRecord = {
          user_id: userId,
          fireflies_id: t.id,
          title: t.title || "Untitled Meeting",
          duration: t.duration ? Math.round(t.duration / 60) : null,
          meeting_date: this.convertFirefliesDate(t.date),
          participants: t.speakers?.map((s) => s.name) || [],
          sentences: t.sentences || [],
          meeting_attendees: t.meeting_attendees || [],
          transcript_url: t.transcript_url,
          audio_url: t.audio_url,
          video_url: t.video_url,
          meeting_link: t.meeting_link,
          internal_org_id: internalOrgId,
        };

        // Upsert to transcripts table
        const { data, error } = await this.supabase
          .from("transcripts")
          .upsert(transcriptRecord, { onConflict: "fireflies_id" })
          .select("id")
          .single();

        if (error) {
          console.error(`[FirefliesService] Error importing ${t.id}:`, error);
          errors++;
        } else {
          imported++;
          if (data?.id) {
            importedIds.push(data.id);
          }
        }
      } catch (err) {
        console.error(`[FirefliesService] Exception importing ${t.id}:`, err);
        errors++;
      }
    }

    // Add errors from failed fetches
    errors += detailResults.filter((r) => !r.success).length;

    // Mark as imported in temp_transcripts
    if (firefliesIds.length > 0) {
      await this.supabase
        .from("temp_transcripts")
        .update({ is_imported: true })
        .eq("user_id", userId)
        .in("fireflies_id", firefliesIds);
    }

    console.log(`[FirefliesService] Import complete: ${imported} imported, ${errors} errors`);
    return { imported, errors, transcriptIds: importedIds };
  }
}

// ============================================
// Factory function for creating service
// ============================================

export function createFirefliesService(apiKey: string, supabase?: SupabaseClient): FirefliesService {
  return new FirefliesService(apiKey, supabase);
}
