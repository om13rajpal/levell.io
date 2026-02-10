import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { loadContext, formatContextForPrompt, loadEnrichedContext, formatEnrichedContextForPrompt, EnrichedContext } from "@/lib/context-loader";
import { cleanTranscript, CleanedTranscript } from "@/lib/transcript-cleaner";
import { runAllExtractions, ExtractionResult } from "@/lib/extraction-agents";
import { synthesizeCoachingReport, SynthesisResult } from "@/lib/synthesis-agent";
import { getOrSetCachedPrompt } from "@/lib/prompt-cache";
import {
  AnalysisResult,
  CoachingReport,
  AllExtractions,
  CallType,
} from "@/types/extraction-outputs";

// Lazy-loaded admin Supabase client
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
// Pipeline Types
// ============================================

export interface PipelineInput {
  transcriptId: number;
  userId?: string;
  companyId?: string;
  callType?: CallType;
}

export interface PipelineResult {
  success: boolean;
  transcript_id: number;
  coaching_report?: CoachingReport;
  extractions?: AllExtractions;
  error?: string;
  timing: {
    total_ms: number;
    context_ms: number;
    extraction_ms: number;
    synthesis_ms: number;
    storage_ms: number;
  };
}

// ============================================
// Transcript Fetching
// ============================================

interface TranscriptData {
  id: number;
  user_id: string;
  title: string;
  sentences: Array<{ speaker_name?: string; text?: string; start_time?: number; end_time?: number }>;
  duration: number;
}

async function fetchTranscript(transcriptId: number): Promise<TranscriptData | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("transcripts")
      .select("id, user_id, title, sentences, duration")
      .eq("id", transcriptId)
      .single();

    if (error) {
      console.error("[Pipeline] Error fetching transcript:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[Pipeline] Error in fetchTranscript:", error);
    return null;
  }
}

/**
 * Format transcript sentences into readable text
 */
function formatTranscript(transcript: TranscriptData): string {
  if (transcript.sentences && Array.isArray(transcript.sentences)) {
    return transcript.sentences
      .map((s) => `${s.speaker_name || "Unknown"}: ${s.text || ""}`)
      .join("\n");
  }

  // No sentences available
  return "";
}

// ============================================
// Rep Info Fetching
// ============================================

/**
 * Fetch rep name, email, and company for transcript cleaning and synthesis
 */
async function fetchRepInfo(userId: string): Promise<{ name: string; email: string; company: string; role?: string } | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .select("name, email")
      .eq("id", userId)
      .single();
    if (error || !data) return null;

    // Get company name and user's team role from team_org
    const { data: teamData } = await getSupabaseAdmin()
      .from("team_org")
      .select("teams(team_name), team_roles(role_name)")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    return {
      name: data.name || data.email?.split("@")[0] || "Rep",
      email: data.email || "",
      company: (teamData as any)?.teams?.team_name || "",
      role: (teamData as any)?.team_roles?.role_name || undefined,
    };
  } catch {
    return null;
  }
}

// ============================================
// Result Storage
// ============================================

/**
 * Resolve user's team and org context from team_org
 */
async function resolveUserContext(userId: string): Promise<{
  teamId: number | null;
  internalOrgId: string | null;
}> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("team_org")
      .select("team_id, teams(internal_org_id)")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return { teamId: null, internalOrgId: null };
    }

    return {
      teamId: data.team_id,
      internalOrgId: (data as any).teams?.internal_org_id || null,
    };
  } catch {
    return { teamId: null, internalOrgId: null };
  }
}

async function storeResults(
  transcriptId: number,
  report: CoachingReport,
  extractions: AllExtractions,
  userId?: string,
  timing?: { extraction_ms: number; synthesis_ms: number; total_ms: number }
): Promise<boolean> {
  try {
    // Map to actual database column names
    const storageData = {
      ai_overall_score: report.overall_score,
      ai_category_breakdown: {
        pain_points: report.performance_breakdown.pain_points,
        objections: report.performance_breakdown.objections,
        engagement: report.performance_breakdown.engagement,
        next_steps: report.performance_breakdown.next_steps,
        call_structure: report.performance_breakdown.call_structure,
        rep_technique: report.performance_breakdown.rep_technique,
      },
      ai_summary: report.call_summary,
      ai_deal_signal: report.deal_signal,
      ai_what_worked: report.what_worked,
      ai_missed_opportunities: report.missed_opportunities,
      ai_deal_risk_alerts: report.deal_risk_alerts,
      ai_next_call_game_plan: report.next_call_game_plan,
      ai_behavioral_patterns: report.patterns_to_watch,
      ai_analyzed_at: new Date().toISOString(),
      ai_score_reason: report.overall_assessment || null,
      ai_call_type: report.call_type || null,
      ai_improvement_areas: report.critical_improvements || null,
      ai_the_one_thing: report.the_one_thing || null,
      ai_coaching_notes: report.coaching_notes || null,
      ai_deal_signal_reason: report.deal_signal_reason || null,
    };

    // Dual-write: store on transcripts (backward compat) AND call_analysis
    const { error } = await getSupabaseAdmin()
      .from("transcripts")
      .update(storageData)
      .eq("id", transcriptId);

    if (error) {
      console.error("[Pipeline] Error storing results on transcripts:", error);
      return false;
    }

    // Write to call_analysis table (best-effort, don't fail pipeline)
    if (userId) {
      try {
        const { teamId, internalOrgId } = await resolveUserContext(userId);

        if (teamId && internalOrgId) {
          const callAnalysisData = {
            user_id: userId,
            internal_org_id: internalOrgId,
            team_id: teamId,
            transcript_id: transcriptId,
            model: "gpt-4o",
            ai_score: report.overall_score,
            ai_summary: report.call_summary,
            ai_strengths: report.what_worked,
            ai_improvements: report.missed_opportunities,
            ai_category_scores: report.performance_breakdown,
            deal_signal: report.deal_signal,
            extraction_outputs: extractions,
            execution_time_ms: timing?.total_ms || null,
            status: "completed" as const,
            call_type: report.call_type || null,
          };

          const { error: analysisError } = await getSupabaseAdmin()
            .from("call_analysis")
            .insert(callAnalysisData);

          if (analysisError) {
            console.warn("[Pipeline] Error writing to call_analysis (non-fatal):", analysisError.message);
          } else {
            console.log("[Pipeline] call_analysis record created for transcript:", transcriptId);
          }
        }
      } catch (analysisErr) {
        console.warn("[Pipeline] call_analysis write failed (non-fatal):", analysisErr);
      }
    }

    console.log("[Pipeline] Results stored successfully for transcript:", transcriptId);
    return true;
  } catch (error) {
    console.error("[Pipeline] Error in storeResults:", error);
    return false;
  }
}

// ============================================
// Main Pipeline
// ============================================

/**
 * Run the full V2 analysis pipeline:
 * 1. Load context (previous calls, company, user profile)
 * 2. Run 6 extraction agents in parallel
 * 3. Synthesize into coaching report
 * 4. Store results in database
 */
export async function runAnalysisPipeline(
  input: PipelineInput
): Promise<PipelineResult> {
  console.log("[Pipeline] Starting V2 analysis for transcript:", input.transcriptId);
  const pipelineStart = Date.now();

  const timing = {
    total_ms: 0,
    context_ms: 0,
    extraction_ms: 0,
    synthesis_ms: 0,
    storage_ms: 0,
  };

  try {
    // Step 1: Fetch the transcript
    const transcript = await fetchTranscript(input.transcriptId);
    if (!transcript) {
      return {
        success: false,
        transcript_id: input.transcriptId,
        error: "Transcript not found",
        timing,
      };
    }

    console.log(`[Pipeline] Transcript loaded: "${transcript.title}" (${transcript.duration} min)`);

    const userId = input.userId || transcript.user_id;

    // Step 2: Fetch rep info and clean transcript (graceful fallback)
    let cleaned: CleanedTranscript | null = null;
    let repInfo: { name: string; email: string; company: string; role?: string } | null = null;

    try {
      repInfo = await fetchRepInfo(userId);
      if (repInfo && transcript.sentences?.length > 0) {
        cleaned = cleanTranscript(
          transcript.sentences,
          repInfo.name,
          repInfo.email,
          repInfo.company,
          transcript.duration
        );
        console.log(`[Pipeline] Transcript cleaned: ${cleaned.sentence_count} sentences, talk ratio: Rep ${cleaned.talk_ratio.rep_percent}% / Prospect ${cleaned.talk_ratio.prospect_percent}%`);
      }
    } catch (err) {
      console.warn("[Pipeline] Transcript cleaning failed, using raw transcript:", err);
    }

    const transcriptText = cleaned?.sentences_text || formatTranscript(transcript);

    // Step 3: Load and format context (with caching, enriched context preferred)
    const contextStart = Date.now();
    let callType: CallType | undefined = input.callType;
    let userRole: string | undefined = repInfo?.role;

    const { transcript: formattedTranscript, context: formattedContext, cached } = await getOrSetCachedPrompt(
      input.transcriptId,
      async () => {
        // Try enriched context first, fall back to basic context
        let formattedCtx: string;
        try {
          const enrichedCtx = await loadEnrichedContext({
            transcriptId: input.transcriptId,
            userId,
            companyId: input.companyId,
          });
          // Capture call_type from context if not provided in input
          if (!callType) {
            callType = enrichedCtx.call_type;
          }
          formattedCtx = formatEnrichedContextForPrompt(enrichedCtx);
          console.log("[Pipeline] Using enriched context");
        } catch (enrichErr) {
          console.warn("[Pipeline] Enriched context failed, falling back to basic context:", enrichErr);
          const ctx = await loadContext({
            transcriptId: input.transcriptId,
            userId,
            companyId: input.companyId,
          });
          if (!callType) {
            callType = ctx.call_type;
          }
          formattedCtx = formatContextForPrompt(ctx);
        }
        return { transcript: transcriptText, context: formattedCtx };
      }
    );

    // If cache was hit and we still don't have callType, load context just for call_type
    if (cached && !callType) {
      try {
        const ctx = await loadEnrichedContext({
          transcriptId: input.transcriptId,
          userId,
          companyId: input.companyId,
        });
        callType = ctx.call_type;
      } catch {
        const ctx = await loadContext({
          transcriptId: input.transcriptId,
          userId,
          companyId: input.companyId,
        });
        callType = ctx.call_type;
      }
    }

    timing.context_ms = Date.now() - contextStart;
    console.log(`[Pipeline] Context loaded in ${timing.context_ms}ms (cache ${cached ? "HIT" : "MISS"})`);

    // Step 4: Run extraction agents in parallel
    const extractionStart = Date.now();
    const callMetadata = cleaned
      ? {
          title: transcript.title,
          duration_minutes: cleaned.duration_minutes,
          sentence_count: cleaned.sentence_count,
          talk_ratio: { rep_percent: cleaned.talk_ratio.rep_percent, prospect_percent: cleaned.talk_ratio.prospect_percent },
        }
      : undefined;
    const extractionResult: ExtractionResult = await runAllExtractions(
      formattedTranscript,
      formattedContext,
      repInfo ? { name: repInfo.name, company: repInfo.company, role: userRole } : undefined,
      callMetadata
    );
    timing.extraction_ms = Date.now() - extractionStart;
    console.log(`[Pipeline] Extraction completed in ${timing.extraction_ms}ms`);

    if (!extractionResult.success || !extractionResult.data) {
      return {
        success: false,
        transcript_id: input.transcriptId,
        error: `Extraction failed: ${extractionResult.errors?.map((e) => e.agent).join(", ")}`,
        timing,
      };
    }

    // Step 5: Synthesize coaching report
    const synthesisStart = Date.now();
    const synthesisResult: SynthesisResult = await synthesizeCoachingReport({
      extractions: extractionResult.data,
      transcript: formattedTranscript,
      context: formattedContext,
      callType: callType,
      repInfo: repInfo
        ? {
            name: repInfo.name,
            email: repInfo.email,
            transcript_speaker_name: cleaned?.participants.rep.transcript_speaker_name,
            company: repInfo.company,
          }
        : undefined,
      cleanedTranscript: cleaned
        ? {
            talk_ratio: cleaned.talk_ratio,
            duration_minutes: cleaned.duration_minutes,
          }
        : undefined,
    });
    timing.synthesis_ms = Date.now() - synthesisStart;
    console.log(`[Pipeline] Synthesis completed in ${timing.synthesis_ms}ms`);

    if (!synthesisResult.success || !synthesisResult.report) {
      return {
        success: false,
        transcript_id: input.transcriptId,
        error: `Synthesis failed: ${synthesisResult.error}`,
        timing,
      };
    }

    // Step 6: Store results in database (dual-write: transcripts + call_analysis)
    const storageStart = Date.now();
    const stored = await storeResults(
      input.transcriptId,
      synthesisResult.report,
      extractionResult.data,
      userId,
      timing
    );
    timing.storage_ms = Date.now() - storageStart;

    if (!stored) {
      console.warn("[Pipeline] Failed to store results, but analysis succeeded");
    }

    timing.total_ms = Date.now() - pipelineStart;

    console.log(`[Pipeline] V2 analysis complete in ${timing.total_ms}ms`, {
      score: synthesisResult.report.overall_score,
      dealSignal: synthesisResult.report.deal_signal,
      timing,
    });

    return {
      success: true,
      transcript_id: input.transcriptId,
      coaching_report: synthesisResult.report,
      extractions: extractionResult.data,
      timing,
    };
  } catch (error) {
    timing.total_ms = Date.now() - pipelineStart;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Pipeline] Pipeline error:", errorMessage);

    return {
      success: false,
      transcript_id: input.transcriptId,
      error: errorMessage,
      timing,
    };
  }
}

/**
 * Analyze a single transcript (convenience wrapper)
 */
export async function analyzeTranscript(transcriptId: number): Promise<PipelineResult> {
  return runAnalysisPipeline({ transcriptId });
}

/**
 * Re-analyze a transcript with specific options
 */
export async function reanalyzeTranscript(
  transcriptId: number,
  options?: {
    callType?: CallType;
    companyId?: string;
  }
): Promise<PipelineResult> {
  return runAnalysisPipeline({
    transcriptId,
    callType: options?.callType,
    companyId: options?.companyId,
  });
}
