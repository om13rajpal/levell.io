import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { loadContext, formatContextForPrompt } from "@/lib/context-loader";
import { runAllExtractions, ExtractionResult } from "@/lib/extraction-agents";
import { synthesizeCoachingReport, SynthesisResult } from "@/lib/synthesis-agent";
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
  companyId?: number;
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
  transcript: string;
  sentences: Array<{ speaker_name?: string; text?: string }>;
  duration: number;
}

async function fetchTranscript(transcriptId: number): Promise<TranscriptData | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("transcripts")
      .select("id, user_id, title, transcript, sentences, duration")
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

  // Fallback to raw transcript if sentences not available
  return transcript.transcript || "";
}

// ============================================
// Result Storage
// ============================================

interface StorageData {
  ai_overall_score: number;
  ai_category_scores: {
    pain_points: number;
    objections: number;
    engagement: number;
    next_steps: number;
    call_structure: number;
    rep_technique: number;
  };
  ai_analysis: {
    what_worked: CoachingReport["what_worked"];
    missed_opportunities: CoachingReport["missed_opportunities"];
    deal_risk_alerts: CoachingReport["deal_risk_alerts"];
    patterns_to_watch: CoachingReport["patterns_to_watch"];
    next_call_game_plan: CoachingReport["next_call_game_plan"];
  };
  call_summary?: string;
  deal_signal?: string;
  extraction_outputs?: AllExtractions;
}

async function storeResults(
  transcriptId: number,
  report: CoachingReport,
  extractions: AllExtractions
): Promise<boolean> {
  try {
    const storageData: StorageData = {
      ai_overall_score: report.overall_score,
      ai_category_scores: {
        pain_points: report.performance_breakdown.pain_points,
        objections: report.performance_breakdown.objections,
        engagement: report.performance_breakdown.engagement,
        next_steps: report.performance_breakdown.next_steps,
        call_structure: report.performance_breakdown.call_structure,
        rep_technique: report.performance_breakdown.rep_technique,
      },
      ai_analysis: {
        what_worked: report.what_worked,
        missed_opportunities: report.missed_opportunities,
        deal_risk_alerts: report.deal_risk_alerts,
        patterns_to_watch: report.patterns_to_watch,
        next_call_game_plan: report.next_call_game_plan,
      },
      call_summary: report.call_summary,
      deal_signal: report.deal_signal,
      extraction_outputs: extractions,
    };

    const { error } = await getSupabaseAdmin()
      .from("transcripts")
      .update(storageData)
      .eq("id", transcriptId);

    if (error) {
      console.error("[Pipeline] Error storing results:", error);
      return false;
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

    const formattedTranscript = formatTranscript(transcript);
    console.log(`[Pipeline] Transcript loaded: "${transcript.title}" (${transcript.duration} min)`);

    // Step 2: Load context
    const contextStart = Date.now();
    const context = await loadContext({
      transcriptId: input.transcriptId,
      userId: input.userId || transcript.user_id,
      companyId: input.companyId,
    });
    const formattedContext = formatContextForPrompt(context);
    timing.context_ms = Date.now() - contextStart;
    console.log(`[Pipeline] Context loaded in ${timing.context_ms}ms`);

    // Step 3: Run extraction agents in parallel
    const extractionStart = Date.now();
    const extractionResult: ExtractionResult = await runAllExtractions(
      formattedTranscript,
      formattedContext
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

    // Step 4: Synthesize coaching report
    const synthesisStart = Date.now();
    const synthesisResult: SynthesisResult = await synthesizeCoachingReport({
      extractions: extractionResult.data,
      transcript: formattedTranscript,
      context: formattedContext,
      callType: input.callType || context.call_type,
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

    // Step 5: Store results in database
    const storageStart = Date.now();
    const stored = await storeResults(
      input.transcriptId,
      synthesisResult.report,
      extractionResult.data
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
    companyId?: number;
  }
): Promise<PipelineResult> {
  return runAnalysisPipeline({
    transcriptId,
    callType: options?.callType,
    companyId: options?.companyId,
  });
}
