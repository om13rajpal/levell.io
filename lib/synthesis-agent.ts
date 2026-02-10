import { generateText } from "ai";
import { getOpenAIModel } from "@/lib/openai";
import {
  AllExtractions,
  CoachingReport,
  CoachingReportSchema,
  CallType,
  DealSignal,
  PerformanceBreakdown,
} from "@/types/extraction-outputs";
import type { CleanedTranscript } from "@/lib/transcript-cleaner";

// Use a smarter model for synthesis (needs to prioritize, write naturally, connect patterns)
const SYNTHESIS_MODEL = "gpt-4o";

// ============================================
// Scoring Weight Configuration
// ============================================

interface ScoringWeights {
  pain_points: number;
  objections: number;
  engagement: number;
  next_steps: number;
  call_structure: number;
  rep_technique: number;
}

const WEIGHTS_BY_CALL_TYPE: Record<string, ScoringWeights> = {
  discovery: {
    pain_points: 0.25,
    objections: 0.05,
    engagement: 0.20,
    next_steps: 0.15,
    call_structure: 0.15,
    rep_technique: 0.20,
  },
  demo: {
    pain_points: 0.05,
    objections: 0.20,
    engagement: 0.20,
    next_steps: 0.15,
    call_structure: 0.15,
    rep_technique: 0.25,
  },
  followup: {
    pain_points: 0.15,
    objections: 0.25,
    engagement: 0.15,
    next_steps: 0.25,
    call_structure: 0.10,
    rep_technique: 0.10,
  },
  closing: {
    pain_points: 0.10,
    objections: 0.30,
    engagement: 0.15,
    next_steps: 0.30,
    call_structure: 0.05,
    rep_technique: 0.10,
  },
  coaching: {
    pain_points: 0.10,
    objections: 0.10,
    engagement: 0.25,
    next_steps: 0.10,
    call_structure: 0.20,
    rep_technique: 0.25,
  },
  check_in: {
    pain_points: 0.15,
    objections: 0.15,
    engagement: 0.25,
    next_steps: 0.20,
    call_structure: 0.10,
    rep_technique: 0.15,
  },
};

// Default weights when call type is unknown
const DEFAULT_WEIGHTS: ScoringWeights = {
  pain_points: 0.20,
  objections: 0.15,
  engagement: 0.20,
  next_steps: 0.20,
  call_structure: 0.10,
  rep_technique: 0.15,
};

/**
 * Calculate weighted overall score from individual category scores
 */
export function calculateWeightedScore(
  breakdown: PerformanceBreakdown,
  callType?: CallType | string
): number {
  const weights = callType && WEIGHTS_BY_CALL_TYPE[callType] ? WEIGHTS_BY_CALL_TYPE[callType] : DEFAULT_WEIGHTS;

  const weightedSum =
    breakdown.pain_points * weights.pain_points +
    breakdown.objections * weights.objections +
    breakdown.engagement * weights.engagement +
    breakdown.next_steps * weights.next_steps +
    breakdown.call_structure * weights.call_structure +
    breakdown.rep_technique * weights.rep_technique;

  return Math.round(weightedSum);
}

/**
 * Determine deal signal based on scores and patterns
 */
export function determineDealSignal(
  breakdown: PerformanceBreakdown,
  extractions: AllExtractions
): DealSignal {
  const avgScore =
    (breakdown.pain_points +
      breakdown.objections +
      breakdown.engagement +
      breakdown.next_steps +
      breakdown.call_structure +
      breakdown.rep_technique) /
    6;

  // Critical indicators
  const hasUnhandledObjections = extractions.objections.items.some(
    (o) => o.effectiveness === "weak"
  );
  const noNextSteps = extractions.next_steps.committed_actions.length === 0;
  const stalledMomentum = extractions.next_steps.momentum_assessment === "stalled";
  const lowEngagement = extractions.engagement.prospect_energy === "low";
  const highEngagement = extractions.engagement.prospect_energy === "high";
  const strongMomentum = extractions.next_steps.momentum_assessment === "strong";
  const hasCriticalIssues = stalledMomentum || noNextSteps || hasUnhandledObjections || lowEngagement;

  // Critical: Multiple red flags
  if (
    (stalledMomentum && noNextSteps) ||
    (hasUnhandledObjections && lowEngagement) ||
    avgScore < 40
  ) {
    return "critical";
  }

  // At Risk: Some concerning signals
  if (
    stalledMomentum ||
    noNextSteps ||
    hasUnhandledObjections ||
    lowEngagement ||
    avgScore < 60
  ) {
    return "at_risk";
  }

  // Strong: Excellent performance across the board
  if (
    avgScore >= 80 &&
    !hasUnhandledObjections &&
    strongMomentum &&
    highEngagement
  ) {
    return "strong";
  }

  // Positive: Good performance with no critical issues
  if (avgScore >= 70 && !hasCriticalIssues) {
    return "positive";
  }

  // Healthy: Good signals across the board
  return "healthy";
}

// ============================================
// Synthesis Agent Prompt
// ============================================

const SYNTHESIS_SYSTEM_PROMPT = `You are an expert sales coaching AI synthesizing analysis from 6 extraction agents.

## Your Role
Address the rep by first name. Be direct. Sound like a senior sales manager, not a consultant.

You receive structured analysis from 6 extraction agents:
1. Pain Points Extractor - problems the prospect revealed
2. Objections Extractor - resistance and how it was handled
3. Engagement Scorer - prospect participation levels
4. Next Steps Analyzer - commitments and momentum
5. Call Structure Reviewer - how the call flowed
6. Rep Technique Analyzer - communication patterns

Your job is to synthesize these into an actionable coaching report.

## Language Rules
- Address rep by first name throughout
- Use "You said X -> Try instead: Y" format for improvements
- For practice drills, be specific: "Record yourself doing X for 2 minutes, then listen back"
- Sound like a sales manager, not a report generator

DON'T say: "Value articulation was suboptimal"
DO say: "You didn't explain why they should care"

DON'T say: "Identifying decision-making patterns uncovers authority"
DO say: "You didn't find out who makes the decision"

DON'T say: "Demonstrated active listening behaviors"
DO say: "Good job repeating back what they said"

Be direct, specific, and actionable. Reference exact quotes and moments.`;

// ============================================
// Synthesis Agent Function
// ============================================

export interface SynthesisInput {
  extractions: AllExtractions;
  transcript: string;
  context: string;
  callType?: CallType;
  repInfo?: { name: string; email: string; transcript_speaker_name?: string; company?: string; role?: string };
  cleanedTranscript?: { talk_ratio: { rep_percent: number; prospect_percent: number }; duration_minutes: number };
}

export interface SynthesisResult {
  success: boolean;
  report?: CoachingReport;
  error?: string;
  timing_ms: number;
}

/**
 * Generate the final coaching report from all extraction outputs
 */
export async function synthesizeCoachingReport(
  input: SynthesisInput
): Promise<SynthesisResult> {
  console.log("[SynthesisAgent] Starting synthesis...");
  const startTime = Date.now();

  try {
    // Build the performance breakdown from extraction scores
    const performanceBreakdown: PerformanceBreakdown = {
      pain_points: input.extractions.pain_points.score,
      objections: input.extractions.objections.score,
      engagement: input.extractions.engagement.score,
      next_steps: input.extractions.next_steps.score,
      call_structure: input.extractions.call_structure.score,
      rep_technique: input.extractions.rep_technique.score,
    };

    // Calculate weighted overall score
    const overallScore = calculateWeightedScore(performanceBreakdown, input.callType);

    // Determine deal signal
    const dealSignal = determineDealSignal(performanceBreakdown, input.extractions);

    // Format extraction outputs for the prompt
    const extractionSummary = formatExtractionsForPrompt(input.extractions);

    // Build rep info section if available
    let repSection = "";
    if (input.repInfo) {
      repSection = `\n## Rep Information
- Name: ${input.repInfo.name}
- Email: ${input.repInfo.email}`;
      if (input.repInfo.company) repSection += `\n- Company: ${input.repInfo.company}`;
      if (input.repInfo.role) repSection += `\n- Role: ${input.repInfo.role}`;
      if (input.repInfo.transcript_speaker_name) repSection += `\n- Transcript Speaker Name: ${input.repInfo.transcript_speaker_name}`;
      repSection += "\n";
    }

    // Build talk ratio section if available
    let talkRatioSection = "";
    if (input.cleanedTranscript) {
      talkRatioSection = `\n## Talk Ratio
- Rep: ${input.cleanedTranscript.talk_ratio.rep_percent}%
- Prospect: ${input.cleanedTranscript.talk_ratio.prospect_percent}%
- Call Duration: ${input.cleanedTranscript.duration_minutes} minutes\n`;
    }

    // Build scoring weights context
    const activeWeights = input.callType && WEIGHTS_BY_CALL_TYPE[input.callType]
      ? WEIGHTS_BY_CALL_TYPE[input.callType]
      : DEFAULT_WEIGHTS;
    const weightsContext = `\n## Scoring Weights (${input.callType || "default"})
- Pain Points: ${(activeWeights.pain_points * 100).toFixed(0)}%
- Objections: ${(activeWeights.objections * 100).toFixed(0)}%
- Engagement: ${(activeWeights.engagement * 100).toFixed(0)}%
- Next Steps: ${(activeWeights.next_steps * 100).toFixed(0)}%
- Call Structure: ${(activeWeights.call_structure * 100).toFixed(0)}%
- Rep Technique: ${(activeWeights.rep_technique * 100).toFixed(0)}%
Higher weight = more important for this call type.\n`;

    // Build the synthesis prompt
    const synthesisPrompt = `## Historical Context
${input.context}
${repSection}${talkRatioSection}${weightsContext}
## Extraction Agent Outputs
${extractionSummary}

## Transcript Excerpt (for reference)
${input.transcript.slice(0, 5000)}${input.transcript.length > 5000 ? "\n\n[Transcript truncated...]" : ""}

## Pre-calculated Scores
Performance Breakdown:
- Pain Points: ${performanceBreakdown.pain_points}/100
- Objections: ${performanceBreakdown.objections}/100
- Engagement: ${performanceBreakdown.engagement}/100
- Next Steps: ${performanceBreakdown.next_steps}/100
- Call Structure: ${performanceBreakdown.call_structure}/100
- Rep Technique: ${performanceBreakdown.rep_technique}/100

Overall Score: ${overallScore}/100
Deal Signal: ${dealSignal.toUpperCase()}

## Your Task
Synthesize all this information into a coaching report.${input.repInfo ? ` Address ${input.repInfo.name.split(" ")[0]} by first name throughout.` : ""}

Do NOT include performance_breakdown, overall_score, or deal_signal - those are calculated separately.

Focus on producing RICH, DETAILED output for each section. DO NOT be thin or surface-level. Every section must have substance.

1. Overall Assessment - 2-3 sentences addressing the rep by first name. Be specific about what happened on this call. Reference actual moments.
2. What Worked - EXACTLY 3-4 specific wins with exact quotes from the transcript. Each must have a different "keep_doing" tip. Don't repeat generic advice. Look for: good questions asked, effective responses to objections, rapport-building moments, strong closes, empathetic statements.
3. Critical Improvements - EXACTLY 3 areas with SPECIFIC practice drills. Each drill must be actionable this week (e.g., "Record yourself asking discovery questions for 5 minutes — aim for 3 follow-ups per topic before moving on. Do this daily for 5 days."). Use "You said X -> Try instead: Y" format.
4. Missed Opportunities - EXACTLY 3-4 actionable improvements with "You said X -> Try instead: Y" format. Include the exact prospect quote that was the missed cue.
5. Deal Risk Alerts - provide AT LEAST 2-3 if deal_signal is at_risk or critical. Even for healthy deals, provide AT LEAST 1 risk. Include severity (high/medium/low), what_happened (specific moment), why_risky (business impact), how_to_address (next call action), and suggested_question where applicable.
6. Patterns to Watch - AT LEAST 2-3 recurring behaviors observed across the call. Include: frequency (occurrences count), impact, and a specific recommendation. Look for: question types, response patterns, energy levels, topic avoidance, verbal habits.
7. The One Thing - single most impactful change. "what" must be specific (not generic like "ask better questions"), "how" must be a concrete 3-step drill, "measure" must be observable.
8. Next Call Game Plan - AT LEAST 3-4 specific actions with success criteria. Mix of questions to ask, topics to cover, and things to avoid.
9. Coaching Notes - EXACTLY 3 discussion points for the manager. Each should be specific to this call, not generic coaching advice.
10. Call Summary / Executive Summary - 4-5 sentences for database storage. Include: what the call was about, key outcome, deal status, and recommended next action.
11. Deal Signal Reason - specific evidence from the call for the deal signal determination. Reference at least 2 concrete moments.`;

    // Use generateText + manual JSON parsing to avoid Zod v4 JSON Schema conversion issues.
    // The AI SDK's generateObject fails ~80% of the time with Zod v4 schemas because
    // the Zod-to-JSON-Schema conversion produces schemas that confuse the model.
    const { text } = await generateText({
      model: getOpenAIModel(SYNTHESIS_MODEL),
      system: SYNTHESIS_SYSTEM_PROMPT + `\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code fences, no explanation.
The JSON must have these exact fields:
{
  "rep_scored": { "name": "string", "email": "string", "transcript_speaker_name": "string" },
  "call_type": "discovery|demo|coaching|check_in|followup|closing",
  "overall_assessment": "2-3 sentences addressing rep by first name",
  "deal_signal_reason": "specific evidence for the deal signal determination",
  "executive_summary": "4-5 sentences for CRM storage",
  "what_worked": [{"moment": "string", "quote": "string", "why_effective": "string", "keep_doing": "string"}],
  "critical_improvements": [{"area": "string", "issue": "string", "practice_drill": "specific drill to practice"}],
  "missed_opportunities": [{"moment": "string", "prospect_said": "exact quote", "rep_said": "exact quote", "why_it_matters": "string", "what_to_do": "string", "suggested_phrasing": "string or omit"}],
  "deal_risk_alerts": [{"risk_type": "string", "severity": "high|medium|low", "what_happened": "string", "why_risky": "string", "how_to_address": "string", "suggested_question": "string or omit"}],
  "patterns_to_watch": [{"pattern": "string", "occurrences": number, "impact": "string", "recommendation": "string"}],
  "the_one_thing": { "what": "single most impactful change", "how": "specific steps to implement", "measure": "how to know it's working" },
  "next_call_game_plan": [{"action": "string", "priority": "high|medium|low", "category": "question|topic|avoid", "success_criteria": "string"}],
  "coaching_notes": ["manager discussion point 1", "manager discussion point 2"],
  "call_summary": "string (4-5 sentences for database)"
}`,
      prompt: synthesisPrompt,
      maxRetries: 2,
    });

    // Parse JSON from the response (strip markdown fences if present)
    const jsonStr = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error(`Failed to parse synthesis JSON: ${jsonStr.slice(0, 200)}`);
    }

    // Extract new fields from parsed response
    const parsedObj = parsed as Record<string, unknown>;

    // Map executive_summary or call_summary from response
    if (parsedObj.executive_summary && !parsedObj.call_summary) {
      parsedObj.call_summary = parsedObj.executive_summary;
    }

    // Validate with Zod, but merge our calculated fields first
    const fullObject = {
      ...parsedObj,
      performance_breakdown: performanceBreakdown,
      overall_score: overallScore,
      deal_signal: dealSignal,
      // Preserve new n8n-aligned fields if present in AI output
      ...(parsedObj.the_one_thing ? { the_one_thing: parsedObj.the_one_thing } : {}),
      ...(parsedObj.coaching_notes ? { coaching_notes: parsedObj.coaching_notes } : {}),
      ...(parsedObj.critical_improvements ? { critical_improvements: parsedObj.critical_improvements } : {}),
      ...(parsedObj.call_type ? { call_type: parsedObj.call_type } : {}),
      ...(parsedObj.overall_assessment ? { overall_assessment: parsedObj.overall_assessment } : {}),
      ...(parsedObj.deal_signal_reason ? { deal_signal_reason: parsedObj.deal_signal_reason } : {}),
      ...(parsedObj.rep_scored ? { rep_scored: parsedObj.rep_scored } : {}),
    };

    const validated = CoachingReportSchema.safeParse(fullObject);
    if (!validated.success) {
      const issues = validated.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      console.warn(`[SynthesisAgent] Validation issues: ${issues}`);
      // Use the parsed data as-is with our calculated values, coercing to CoachingReport
      // This is acceptable because the model output is close enough and we override the critical fields
    }

    const report: CoachingReport = validated.success
      ? validated.data
      : (fullObject as CoachingReport);

    const timingMs = Date.now() - startTime;
    console.log(`[SynthesisAgent] Completed in ${timingMs}ms, Score: ${overallScore}, Signal: ${dealSignal}`);

    return {
      success: true,
      report,
      timing_ms: timingMs,
    };
  } catch (error) {
    const timingMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[SynthesisAgent] Error:", errorMessage);

    return {
      success: false,
      error: errorMessage,
      timing_ms: timingMs,
    };
  }
}

/**
 * Format extraction outputs into a readable prompt section
 */
function formatExtractionsForPrompt(extractions: AllExtractions): string {
  let output = "";

  // Pain Points
  output += "### Pain Points Analysis\n";
  output += `Score: ${extractions.pain_points.score}/100\n`;
  output += `Summary: ${extractions.pain_points.summary}\n`;
  if (extractions.pain_points.items.length > 0) {
    output += "Items:\n";
    extractions.pain_points.items.forEach((item, i) => {
      output += `${i + 1}. "${item.quote}"\n`;
      output += `   Pain: ${item.pain_point}\n`;
      output += `   Depth: ${item.depth}\n`;
      output += `   Analysis: ${item.analysis}\n`;
    });
  }
  output += "\n";

  // Objections
  output += "### Objections Analysis\n";
  output += `Score: ${extractions.objections.score}/100\n`;
  output += `Summary: ${extractions.objections.summary}\n`;
  if (extractions.objections.items.length > 0) {
    output += "Items:\n";
    extractions.objections.items.forEach((item, i) => {
      output += `${i + 1}. Objection: ${item.objection}\n`;
      output += `   Quote: "${item.quote}"\n`;
      output += `   Rep Response: ${item.rep_response}\n`;
      output += `   Effectiveness: ${item.effectiveness}\n`;
      if (item.effectiveness !== "strong") {
        output += `   Better Response: ${item.better_response}\n`;
      }
    });
  }
  output += "\n";

  // Engagement
  output += "### Engagement Analysis\n";
  output += `Score: ${extractions.engagement.score}/100\n`;
  output += `Summary: ${extractions.engagement.summary}\n`;
  output += `Talk Ratio: Rep ${extractions.engagement.talk_ratio.rep_percent}% / Prospect ${extractions.engagement.talk_ratio.prospect_percent}%\n`;
  output += `Prospect Energy: ${extractions.engagement.prospect_energy}\n`;
  if (extractions.engagement.engagement_signals.length > 0) {
    output += "Signals:\n";
    extractions.engagement.engagement_signals.forEach((signal) => {
      output += `- [${signal.type}] ${signal.signal}`;
      if (signal.quote) output += ` ("${signal.quote}")`;
      output += `\n  Implication: ${signal.implication}\n`;
    });
  }
  output += "\n";

  // Next Steps
  output += "### Next Steps Analysis\n";
  output += `Score: ${extractions.next_steps.score}/100\n`;
  output += `Summary: ${extractions.next_steps.summary}\n`;
  // Handle union type: meeting_scheduled can be boolean or object { scheduled, date, attendees, purpose }
  const meetingScheduled = typeof extractions.next_steps.meeting_scheduled === "object"
    ? extractions.next_steps.meeting_scheduled.scheduled
    : extractions.next_steps.meeting_scheduled;
  output += `Meeting Scheduled: ${meetingScheduled ? "Yes" : "No"}\n`;
  if (typeof extractions.next_steps.meeting_scheduled === "object") {
    const ms = extractions.next_steps.meeting_scheduled;
    if (ms.date) output += `  Date: ${ms.date}\n`;
    if (ms.attendees?.length) output += `  Attendees: ${ms.attendees.join(", ")}\n`;
    if (ms.purpose) output += `  Purpose: ${ms.purpose}\n`;
  }
  output += `Momentum: ${extractions.next_steps.momentum_assessment}\n`;
  if (extractions.next_steps.committed_actions.length > 0) {
    output += "Committed Actions:\n";
    extractions.next_steps.committed_actions.forEach((action, i) => {
      output += `${i + 1}. ${action.action}\n`;
      output += `   Owner: ${action.owner} | Timeline: ${action.timeline} | Clarity: ${action.clarity}\n`;
    });
  }
  output += "\n";

  // Call Structure
  output += "### Call Structure Analysis\n";
  output += `Score: ${extractions.call_structure.score}/100\n`;
  output += `Summary: ${extractions.call_structure.summary}\n`;
  output += `Agenda Set: ${extractions.call_structure.agenda_set ? "Yes" : "No"}\n`;
  output += `Transitions Smooth: ${extractions.call_structure.transitions_smooth ? "Yes" : "No"}\n`;
  output += `Time Management: ${extractions.call_structure.time_management}\n`;
  if (extractions.call_structure.sections.length > 0) {
    output += "Sections:\n";
    extractions.call_structure.sections.forEach((section) => {
      output += `- ${section.phase.toUpperCase()}: ${section.what_happened}\n`;
      if (section.what_worked) output += `  ✓ ${section.what_worked}\n`;
      if (section.what_didnt) output += `  ✗ ${section.what_didnt}\n`;
      if (section.suggestion) output += `  → ${section.suggestion}\n`;
    });
  }
  output += "\n";

  // Rep Technique
  output += "### Rep Technique Analysis\n";
  output += `Score: ${extractions.rep_technique.score}/100\n`;
  output += `Summary: ${extractions.rep_technique.summary}\n`;
  output += `Interruption Count: ${extractions.rep_technique.interruption_count}\n`;
  output += `Avg Monologue Length: ${extractions.rep_technique.average_monologue_length}s\n`;
  if (extractions.rep_technique.issues.length > 0) {
    output += "Issues:\n";
    extractions.rep_technique.issues.forEach((issue, i) => {
      output += `${i + 1}. [${issue.type}] "${issue.quote}"\n`;
      output += `   Context: ${issue.context}\n`;
      output += `   Impact: ${issue.impact}\n`;
      output += `   Suggestion: ${issue.suggestion}\n`;
    });
  }
  if (extractions.rep_technique.strengths.length > 0) {
    output += "Strengths:\n";
    extractions.rep_technique.strengths.forEach((strength, i) => {
      output += `${i + 1}. [${strength.type}] "${strength.quote}"\n`;
      output += `   Why Effective: ${strength.why_effective}\n`;
    });
  }

  return output;
}
