import { NextRequest } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  successResponse,
  validationError,
  unauthorizedError,
  serverError,
} from "@/lib/api-response";

let supabaseAdmin: SupabaseClient | null = null;

// Admin client for server-side operations
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Supabase environment variables are not configured");
    }

    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
}

// Fireflies API configuration
const FIREFLIES_API_URL = "https://api.fireflies.ai/graphql";

// Fetch full transcript details from Fireflies (like N8N "Fetch Full Transcript" node)
async function fetchFullTranscriptFromFireflies(
  transcriptId: string,
  token: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const query = `
    query GetTranscript($id: String!) {
      transcript(id: $id) {
        id
        title
        duration
        date
        organizer_email
        host_email
        participants
        meeting_attendees {
          displayName
          email
          phoneNumber
          name
          location
        }
        meeting_attendance {
          name
          email
          percentage
          total
        }
        sentences {
          index
          text
          raw_text
          start_time
          end_time
          speaker_id
          speaker_name
        }
        transcript_url
        audio_url
        video_url
        meeting_link
        summary {
          keywords
          action_items
          outline
          shorthand_bullet
          overview
          bullet_gist
          gist
          short_summary
        }
      }
    }
  `;

  try {
    const response = await fetch(FIREFLIES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        variables: { id: transcriptId },
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Fireflies API error: ${response.status}`,
      };
    }

    const result = await response.json();

    if (result.errors) {
      return {
        success: false,
        error: `GraphQL error: ${JSON.stringify(result.errors)}`,
      };
    }

    return {
      success: true,
      data: result.data?.transcript,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to fetch transcript details",
    };
  }
}

// Get Fireflies API token for user
async function getFirefliesToken(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("api_keys")
    .select("fireflies")
    .eq("user_id", userId)
    .single();

  return data?.fireflies || null;
}

// Safely convert Fireflies date to ISO string
function convertFirefliesDate(dateValue: any): string | null {
  if (!dateValue) return null;
  try {
    // If it's a number, check if it's seconds or milliseconds
    if (typeof dateValue === "number") {
      // Unix timestamps in seconds are typically 10 digits (before year 2286)
      // Unix timestamps in milliseconds are typically 13 digits
      const timestamp = dateValue > 9999999999 ? dateValue : dateValue * 1000;
      const date = new Date(timestamp);
      // Validate the date is reasonable (between 2000 and 2100)
      if (date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
        return date.toISOString();
      }
    }
    // If it's already a string, try to parse it
    if (typeof dateValue === "string") {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
        return date.toISOString();
      }
    }
    console.warn("[temp route] Invalid date value:", dateValue);
    return null;
  } catch (e) {
    console.warn("[temp route] Error converting date:", dateValue, e);
    return null;
  }
}

// Get user ID from Authorization header ONLY (secure authentication)
async function getUserFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const admin = getSupabaseAdmin();

    // Only accept Authorization header - no query param fallback for security
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.log("[temp route] No auth header present");
      return null;
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await admin.auth.getUser(token);

    if (error || !user) {
      console.log("[temp route] Auth failed:", error?.message);
      return null;
    }

    console.log("[temp route] Auth success, user:", user.id);
    return user.id;
  } catch (error) {
    console.error("[getUserFromRequest] Error:", error);
    return null;
  }
}

/**
 * GET /api/transcripts/temp
 * Fetches all temp transcripts for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const admin = getSupabaseAdmin();
    const userId = await getUserFromRequest(req);

    if (!userId) {
      return unauthorizedError();
    }

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const showSelected = searchParams.get("showSelected") === "true";
    const showImported = searchParams.get("showImported") === "true";

    const offset = (page - 1) * pageSize;

    // Build query
    let query = admin
      .from("temp_transcripts")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("meeting_date", { ascending: false, nullsFirst: false });

    // Filter by selection/import status
    if (!showImported) {
      query = query.eq("is_imported", false);
    }

    // Paginate
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching temp transcripts:", error);
      return serverError(error, "GET /api/transcripts/temp");
    }

    return successResponse({
      data: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (error) {
    return serverError(error, "GET /api/transcripts/temp");
  }
}

/**
 * POST /api/transcripts/temp
 * Bulk update temp transcripts (select/deselect, import)
 */
export async function POST(req: NextRequest) {
  try {
    const admin = getSupabaseAdmin();
    const userId = await getUserFromRequest(req);

    if (!userId) {
      return unauthorizedError();
    }

    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return validationError("Invalid JSON in request body");
    }
    const { action, ids, selectAll } = body;

    if (!action) {
      return validationError("Action is required");
    }

    switch (action) {
      case "select": {
        // Select specific transcripts
        console.log("[temp route] SELECT action - ids:", ids, "userId:", userId);

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return validationError("IDs array is required for select action");
        }

        if (!ids.every((id: unknown) => typeof id === 'number' && Number.isInteger(id))) {
          console.log("[temp route] Invalid IDs - not all integers:", ids);
          return validationError("All IDs must be valid integers");
        }

        const { data: updateData, error } = await admin
          .from("temp_transcripts")
          .update({ is_selected: true })
          .eq("user_id", userId)
          .in("id", ids)
          .select("id");

        if (error) {
          console.error("[temp route] SELECT error:", error);
          throw error;
        }

        console.log("[temp route] SELECT success - updated:", updateData?.length || 0);
        return successResponse({ updated: updateData?.length || ids.length });
      }

      case "deselect": {
        // Deselect specific transcripts
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return validationError("IDs array is required for deselect action");
        }

        if (!ids.every((id: unknown) => typeof id === 'number' && Number.isInteger(id))) {
          return validationError("All IDs must be valid integers");
        }

        const { error } = await admin
          .from("temp_transcripts")
          .update({ is_selected: false })
          .eq("user_id", userId)
          .in("id", ids);

        if (error) throw error;

        return successResponse({ updated: ids.length });
      }

      case "select_all": {
        // Select all non-imported transcripts
        const { data, error } = await admin
          .from("temp_transcripts")
          .update({ is_selected: true })
          .eq("user_id", userId)
          .eq("is_imported", false)
          .select("id");

        if (error) throw error;

        return successResponse({ updated: data?.length || 0 });
      }

      case "deselect_all": {
        // Deselect all transcripts
        const { data, error } = await admin
          .from("temp_transcripts")
          .update({ is_selected: false })
          .eq("user_id", userId)
          .eq("is_imported", false)
          .select("id");

        if (error) throw error;

        return successResponse({ updated: data?.length || 0 });
      }

      case "import": {
        // Import selected transcripts to main transcripts table
        // Two-step process like N8N workflow:
        // 1. Get selected transcripts from temp table
        // 2. Fetch FULL details from Fireflies API for each
        // 3. Insert into main transcripts table with all data

        console.log("[temp route] IMPORT action - userId:", userId);

        // First get selected transcripts
        const { data: selectedTranscripts, error: fetchError } = await admin
          .from("temp_transcripts")
          .select("*")
          .eq("user_id", userId)
          .eq("is_selected", true)
          .eq("is_imported", false);

        if (fetchError) {
          console.error("[temp route] IMPORT fetch error:", fetchError);
          throw fetchError;
        }

        console.log("[temp route] IMPORT found selected transcripts:", selectedTranscripts?.length || 0);

        if (!selectedTranscripts || selectedTranscripts.length === 0) {
          return validationError("No transcripts selected for import");
        }

        // Get Fireflies API token
        const firefliesToken = await getFirefliesToken(userId);
        if (!firefliesToken) {
          return validationError("Fireflies API key not configured. Please connect Fireflies in settings.");
        }

        // Import each transcript with full details from Fireflies
        const importedIds: number[] = [];
        const errors: string[] = [];

        for (const tempTx of selectedTranscripts) {
          try {
            // Check if already exists in transcripts table (use maybeSingle to handle 0 rows)
            const { data: existingList } = await admin
              .from("transcripts")
              .select("id")
              .eq("fireflies_id", tempTx.fireflies_id)
              .eq("user_id", userId)
              .limit(1);

            if (existingList && existingList.length > 0) {
              // Already imported, just mark as imported
              console.log(`[Import] Transcript ${tempTx.fireflies_id} already exists, marking as imported`);
              await admin
                .from("temp_transcripts")
                .update({ is_imported: true })
                .eq("id", tempTx.id);
              importedIds.push(tempTx.id);
              continue;
            }

            // Fetch full transcript details from Fireflies API (like N8N "Fetch Full Transcript" node)
            console.log(`[Import] Fetching full details for: ${tempTx.title} (${tempTx.fireflies_id})`);
            const fullTranscriptResult = await fetchFullTranscriptFromFireflies(
              tempTx.fireflies_id,
              firefliesToken
            );

            if (fullTranscriptResult.data) {
              console.log(`[Import] Fireflies raw duration: ${fullTranscriptResult.data.duration} (type: ${typeof fullTranscriptResult.data.duration})`);
            }

            if (!fullTranscriptResult.success || !fullTranscriptResult.data) {
              // Fallback to temp data if full fetch fails
              console.warn(`[Import] Could not fetch full details for ${tempTx.fireflies_id}: ${fullTranscriptResult.error}`);

              // IMPORTANT: Database trigger check_transcript_duration() rejects inserts with duration < 5
              // Default to 5 minutes minimum to ensure insert succeeds
              const durationMins = Math.max(5, tempTx.duration || 5);

              // Build the insert payload with safe date conversion
              const meetingDateISO = tempTx.meeting_date
                ? (typeof tempTx.meeting_date === 'string' && !isNaN(Date.parse(tempTx.meeting_date))
                    ? tempTx.meeting_date
                    : new Date().toISOString())
                : new Date().toISOString();

              // IMPORTANT: transcripts table schema:
              // - participants: text[] (ARRAY) - use simple string array or null
              // - meeting_attendees: JSONB - use for structured attendee data
              // - meeting_attendance: JSONB - attendance percentage data
              // - sentences: JSONB - required for transcript display (empty array for fallback)
              const fallbackPayload = {
                user_id: userId,
                fireflies_id: tempTx.fireflies_id,
                title: tempTx.title || "Untitled Call",
                duration: durationMins,
                audio_url: tempTx.audio_url || null,
                video_url: tempTx.video_url || null,
                transcript_url: tempTx.transcript_url || null,
                // participants is ARRAY type - pass string array or null
                participants: Array.isArray(tempTx.participants)
                  ? tempTx.participants.map((p: any) => typeof p === 'string' ? p : (p?.email || p?.name || 'Unknown'))
                  : null,
                // meeting_attendees is JSONB - structured data goes here
                meeting_attendees: {
                  attendees: tempTx.participants || [],
                  organizer_email: tempTx.organizer_email || null
                },
                // meeting_attendance is JSONB - attendance percentage data (empty for fallback)
                meeting_attendance: [],
                // sentences is required for transcript display - empty array for now
                sentences: [],
                // meeting_link is optional but should match full data path
                meeting_link: null,
                meeting_date: meetingDateISO,
                created_at: meetingDateISO,
              };

              console.log(`[Import] Fallback insert payload:`, JSON.stringify(fallbackPayload, null, 2));

              // Insert with basic data from temp table
              // Note: 'participants' column is ARRAY type, meeting_attendees is JSONB
              // Use insert with .select() WITHOUT .single() to avoid error when trigger rejects
              // The check_transcript_duration trigger returns NULL for duration < 5 which cancels insert
              const insertResult = await admin
                .from("transcripts")
                .insert(fallbackPayload)
                .select("id");

              console.log(`[Import] Fallback insert result:`, JSON.stringify({
                data: insertResult.data,
                error: insertResult.error,
                status: insertResult.status,
              }, null, 2));

              if (insertResult.error) {
                console.error(`[Import] Insert error for ${tempTx.title}:`, JSON.stringify(insertResult.error, null, 2));
                errors.push(`Failed to import ${tempTx.title}: ${insertResult.error.message}`);
                continue;
              }

              // Check if insert returned data (trigger might have rejected it)
              if (!insertResult.data || insertResult.data.length === 0) {
                // Fallback: Try to find the record (it might exist from previous attempt)
                console.warn(`[Import] Insert returned no data, checking if record exists...`);
                const { data: foundRecord } = await admin
                  .from("transcripts")
                  .select("id")
                  .eq("fireflies_id", tempTx.fireflies_id)
                  .eq("user_id", userId)
                  .limit(1);

                if (foundRecord && foundRecord.length > 0) {
                  console.log(`[Import] Found existing transcript ${tempTx.title} with id ${foundRecord[0].id}`);
                } else {
                  // Insert was rejected (likely by check_transcript_duration trigger for duration < 5)
                  console.error(`[Import] Insert rejected for ${tempTx.title} - duration may be < 5 minutes (was: ${durationMins})`);
                  errors.push(`Failed to import ${tempTx.title}: Transcript too short (duration must be at least 5 minutes)`);
                  continue;
                }
              } else {
                console.log(`[Import] Successfully inserted transcript ${tempTx.title} with id ${insertResult.data[0].id}`);
              }
            } else {
              // Insert with full details from Fireflies API
              const fullData = fullTranscriptResult.data;

              // Format sentences for storage (like N8N workflow)
              const formattedSentences = fullData.sentences?.map((s: any) => ({
                index: s.index,
                text: s.text,
                raw_text: s.raw_text,
                start_time: s.start_time,
                end_time: s.end_time,
                speaker_id: s.speaker_id,
                speaker_name: s.speaker_name,
              })) || [];

              // Combine meeting_attendees and participants
              const attendees = fullData.meeting_attendees || fullData.participants || [];

              // Build summary text from Fireflies summary object
              let summaryText = "";
              if (fullData.summary) {
                const parts = [];
                if (fullData.summary.overview) parts.push(`Overview: ${fullData.summary.overview}`);
                if (fullData.summary.short_summary) parts.push(`Summary: ${fullData.summary.short_summary}`);
                if (fullData.summary.action_items) parts.push(`Action Items: ${fullData.summary.action_items}`);
                if (fullData.summary.keywords) parts.push(`Keywords: ${fullData.summary.keywords}`);
                summaryText = parts.join("\n\n");
              }

              // Ensure duration is set properly
              // Fireflies returns duration in SECONDS, but temp_transcripts already has it in MINUTES
              // IMPORTANT: Database trigger check_transcript_duration() rejects inserts with duration < 5
              // So we MUST ensure minimum duration of 5 minutes
              let durationMins = Math.max(5, tempTx.duration || 5);
              if (fullData.duration && fullData.duration > 0) {
                // Fireflies duration is in seconds - convert and ensure minimum of 5
                durationMins = Math.max(5, Math.round(fullData.duration / 60));
              }

              console.log(`[Import] Duration for ${tempTx.title}: raw=${fullData.duration}, converted=${durationMins} mins`);

              // IMPORTANT: transcripts table schema:
              // - participants: text[] (ARRAY) - simple string array
              // - meeting_attendees: JSONB - structured attendee data
              // - sentences: JSONB - required for transcript display

              // Convert attendees to simple string array for participants column (ARRAY type)
              const participantsArray = Array.isArray(attendees)
                ? attendees.map((a: any) => typeof a === 'string' ? a : (a?.email || a?.name || a?.displayName || 'Unknown'))
                : null;

              const insertPayload = {
                user_id: userId,
                fireflies_id: fullData.id,
                title: fullData.title || tempTx.title || "Untitled Call",
                duration: durationMins,
                audio_url: fullData.audio_url || tempTx.audio_url,
                video_url: fullData.video_url || tempTx.video_url,
                transcript_url: fullData.transcript_url || tempTx.transcript_url,
                // participants is ARRAY type - pass string array
                participants: participantsArray,
                // meeting_attendees is JSONB - structured data
                meeting_attendees: {
                  attendees,
                  host_email: fullData.host_email || fullData.organizer_email || tempTx.organizer_email,
                  fireflies_summary: summaryText || null,
                },
                meeting_attendance: fullData.meeting_attendance || [],
                sentences: formattedSentences,
                meeting_link: fullData.meeting_link || null,
                meeting_date: convertFirefliesDate(fullData.date) || tempTx.meeting_date || null,
                created_at: convertFirefliesDate(fullData.date) || tempTx.meeting_date || new Date().toISOString(),
              };

              console.log(`[Import] Full data insert payload (summary):`, JSON.stringify({
                user_id: insertPayload.user_id,
                fireflies_id: insertPayload.fireflies_id,
                title: insertPayload.title,
                duration: insertPayload.duration,
                created_at: insertPayload.created_at,
              }, null, 2));

              // Use insert with .select() WITHOUT .single() to handle trigger rejections gracefully
              const insertResult = await admin
                .from("transcripts")
                .insert(insertPayload)
                .select("id");

              console.log(`[Import] Full data insert result:`, JSON.stringify({
                data: insertResult.data,
                error: insertResult.error,
                status: insertResult.status,
              }, null, 2));

              if (insertResult.error) {
                const errorDetails = `${insertResult.error.message} (code: ${insertResult.error.code}, hint: ${insertResult.error.hint || 'none'})`;
                console.error(`[Import] Insert error for ${tempTx.title}:`, JSON.stringify(insertResult.error, null, 2));
                errors.push(`Failed to import ${tempTx.title}: ${errorDetails}`);
                continue;
              }

              let insertedId: number | undefined;
              // Check if insert returned data (trigger might have rejected it)
              if (!insertResult.data || insertResult.data.length === 0) {
                // Fallback: Try to find the record (it might exist from previous attempt)
                console.warn(`[Import] Insert returned no data, checking if record exists...`);
                const { data: foundRecord } = await admin
                  .from("transcripts")
                  .select("id")
                  .eq("fireflies_id", insertPayload.fireflies_id)
                  .eq("user_id", userId)
                  .limit(1);

                if (foundRecord && foundRecord.length > 0) {
                  insertedId = foundRecord[0].id;
                  console.log(`[Import] Found existing transcript "${tempTx.title}" with id ${insertedId}`);
                } else {
                  // Insert was rejected (likely by check_transcript_duration trigger for duration < 5)
                  console.error(`[Import] Insert rejected for ${tempTx.title} - duration: ${durationMins} mins`);
                  errors.push(`Failed to import ${tempTx.title}: Transcript may be too short (duration must be at least 5 minutes)`);
                  continue;
                }
              } else {
                insertedId = insertResult.data[0].id;
                console.log(`[Import] SUCCESS: Inserted transcript "${tempTx.title}" with id ${insertedId}`);
              }
            }

            // Mark as imported in temp table
            await admin
              .from("temp_transcripts")
              .update({ is_imported: true })
              .eq("id", tempTx.id);

            importedIds.push(tempTx.id);

            // Rate limit: small delay between API calls to avoid throttling
            if (selectedTranscripts.indexOf(tempTx) < selectedTranscripts.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (err: any) {
            errors.push(`Failed to import ${tempTx.title}: ${err.message}`);
          }
        }

        return successResponse({
          imported: importedIds.length,
          total_selected: selectedTranscripts.length,
          errors: errors.length > 0 ? errors : undefined,
        });
      }

      case "delete": {
        // Delete specific temp transcripts (not the main ones)
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return validationError("IDs array is required for delete action");
        }

        if (!ids.every((id: unknown) => typeof id === 'number' && Number.isInteger(id))) {
          return validationError("All IDs must be valid integers");
        }

        const { error } = await admin
          .from("temp_transcripts")
          .delete()
          .eq("user_id", userId)
          .in("id", ids);

        if (error) throw error;

        return successResponse({ deleted: ids.length });
      }

      default:
        return validationError(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    return serverError(error, "POST /api/transcripts/temp");
  }
}
