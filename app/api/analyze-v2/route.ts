import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAnalysisPipeline, PipelineResult } from "@/lib/analysis-pipeline";
import { CallType } from "@/types/extraction-outputs";
import { authenticateRequest, unauthorizedResponse } from "@/lib/auth";

// Allow longer execution for the full pipeline
export const maxDuration = 120; // 2 minutes

// Request validation schema
const AnalyzeRequestSchema = z.object({
  transcript_id: z.number().int().positive(),
  user_id: z.string().uuid().optional(),
  company_id: z.number().int().positive().optional(),
  call_type: z.enum(["discovery", "followup", "demo", "closing"]).optional(),
});

type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// Response type
interface AnalyzeResponse {
  success: boolean;
  data?: {
    transcript_id: number;
    overall_score: number;
    deal_signal: string;
    performance_breakdown: {
      pain_points: number;
      objections: number;
      engagement: number;
      next_steps: number;
      call_structure: number;
      rep_technique: number;
    };
    coaching_summary: {
      what_worked_count: number;
      missed_opportunities_count: number;
      deal_risk_alerts_count: number;
      patterns_to_watch_count: number;
      next_call_actions_count: number;
    };
    timing: {
      total_ms: number;
      context_ms: number;
      extraction_ms: number;
      synthesis_ms: number;
      storage_ms: number;
    };
  };
  error?: string;
  details?: string;
}

/**
 * POST /api/analyze-v2
 *
 * Run the V2 multi-agent analysis pipeline on a transcript.
 *
 * Request body:
 * {
 *   transcript_id: number (required)
 *   user_id?: string (optional, for context loading)
 *   company_id?: number (optional, for context loading)
 *   call_type?: "discovery" | "followup" | "demo" | "closing" (optional)
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   data?: { ... analysis results ... }
 *   error?: string
 * }
 */
export async function POST(req: NextRequest): Promise<NextResponse<AnalyzeResponse>> {
  console.log("[API/analyze-v2] Received request");

  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return unauthorizedResponse(auth.error) as NextResponse<AnalyzeResponse>;

    // Parse and validate request body
    const body = await req.json();
    const parseResult = AnalyzeRequestSchema.safeParse(body);

    if (!parseResult.success) {
      console.log("[API/analyze-v2] Validation failed:", parseResult.error.message);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: parseResult.error.message,
        },
        { status: 400 }
      );
    }

    const request: AnalyzeRequest = parseResult.data;
    console.log("[API/analyze-v2] Processing transcript:", request.transcript_id);

    // Run the analysis pipeline
    const result: PipelineResult = await runAnalysisPipeline({
      transcriptId: request.transcript_id,
      userId: request.user_id,
      companyId: request.company_id?.toString(),
      callType: request.call_type as CallType | undefined,
    });

    if (!result.success || !result.coaching_report) {
      console.log("[API/analyze-v2] Pipeline failed:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Analysis failed",
        },
        { status: 500 }
      );
    }

    // Build response (don't expose full report, just summary)
    const response: AnalyzeResponse = {
      success: true,
      data: {
        transcript_id: result.transcript_id,
        overall_score: result.coaching_report.overall_score,
        deal_signal: result.coaching_report.deal_signal,
        performance_breakdown: result.coaching_report.performance_breakdown,
        coaching_summary: {
          what_worked_count: result.coaching_report.what_worked.length,
          missed_opportunities_count: result.coaching_report.missed_opportunities.length,
          deal_risk_alerts_count: result.coaching_report.deal_risk_alerts.length,
          patterns_to_watch_count: result.coaching_report.patterns_to_watch.length,
          next_call_actions_count: result.coaching_report.next_call_game_plan.length,
        },
        timing: result.timing,
      },
    };

    console.log("[API/analyze-v2] Success:", {
      transcript_id: result.transcript_id,
      score: result.coaching_report.overall_score,
      deal_signal: result.coaching_report.deal_signal,
      total_ms: result.timing.total_ms,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API/analyze-v2] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analyze-v2
 *
 * Health check and documentation endpoint
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: "LEVVL V2 Analysis API",
    version: "2.0.0",
    status: "healthy",
    endpoints: {
      "POST /api/analyze-v2": {
        description: "Run V2 multi-agent analysis on a transcript",
        body: {
          transcript_id: "number (required)",
          user_id: "string UUID (optional)",
          company_id: "number (optional)",
          call_type: "discovery | followup | demo | closing (optional)",
        },
        response: {
          success: "boolean",
          data: {
            transcript_id: "number",
            overall_score: "0-100",
            deal_signal: "healthy | at_risk | critical",
            performance_breakdown: "object with 6 category scores",
            coaching_summary: "counts of each coaching section",
            timing: "ms for each pipeline stage",
          },
        },
      },
    },
    architecture: {
      stages: [
        "1. Context Loader - loads previous calls, company, user profile",
        "2. Extraction Agents (6 parallel) - pain points, objections, engagement, next steps, structure, technique",
        "3. Synthesis Agent - combines into coaching report",
        "4. Storage - saves to database",
      ],
      models: {
        extraction: "gpt-4o-mini (fast, cheap)",
        synthesis: "gpt-4o (smarter, for prioritization)",
      },
    },
  });
}
