import { generateObject } from "ai";
import { getOpenAIModel } from "@/lib/openai";
import {
  AllExtractions,
  CoachingReport,
  CoachingReportSchema,
  CallType,
  DealSignal,
  PerformanceBreakdown,
} from "@/types/extraction-outputs";

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

const WEIGHTS_BY_CALL_TYPE: Record<CallType, ScoringWeights> = {
  discovery: {
    pain_points: 0.25,      // HIGH - This is the whole point
    objections: 0.10,       // LOW - Not expected yet
    engagement: 0.25,       // HIGH - Get them talking
    next_steps: 0.15,       // MEDIUM - Earn a meeting
    call_structure: 0.10,   // MEDIUM - Set agenda
    rep_technique: 0.15,    // HIGH - Listening is everything
  },
  followup: {
    pain_points: 0.15,      // MEDIUM - Validate, go deeper
    objections: 0.25,       // HIGH - Make or break
    engagement: 0.15,       // MEDIUM - Are stakeholders engaged?
    next_steps: 0.25,       // HIGH - Advance the deal
    call_structure: 0.10,   // MEDIUM - Build on context
    rep_technique: 0.10,    // MEDIUM - Confidence in presenting
  },
  demo: {
    pain_points: 0.15,      // MEDIUM
    objections: 0.20,       // HIGH - Address concerns
    engagement: 0.20,       // HIGH - Keep them interested
    next_steps: 0.20,       // HIGH - Move to close
    call_structure: 0.15,   // MEDIUM
    rep_technique: 0.10,    // MEDIUM
  },
  closing: {
    pain_points: 0.10,      // LOW - Should be known
    objections: 0.30,       // HIGHEST - Handle final concerns
    engagement: 0.15,       // MEDIUM
    next_steps: 0.30,       // HIGHEST - Secure commitment
    call_structure: 0.05,   // LOW
    rep_technique: 0.10,    // MEDIUM
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
  callType?: CallType
): number {
  const weights = callType ? WEIGHTS_BY_CALL_TYPE[callType] : DEFAULT_WEIGHTS;

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

  // Healthy: Good signals across the board
  return "healthy";
}

// ============================================
// Synthesis Agent Prompt
// ============================================

const SYNTHESIS_SYSTEM_PROMPT = `You are an expert sales coach synthesizing analysis from multiple specialized agents into a cohesive coaching report.

## Your Role
You receive structured analysis from 6 extraction agents:
1. Pain Points Extractor - problems the prospect revealed
2. Objections Extractor - resistance and how it was handled
3. Engagement Scorer - prospect participation levels
4. Next Steps Analyzer - commitments and momentum
5. Call Structure Reviewer - how the call flowed
6. Rep Technique Analyzer - communication patterns

Your job is to synthesize these into an actionable coaching report.

## Output Sections

### 1. What Worked (2-3 items max)
Specific moments the rep nailed. Include:
- The moment (what happened)
- The exact quote
- Why it was effective

### 2. Missed Opportunities (2-4 items)
Key moments where the rep could have done better:
- The moment (headline)
- Why it matters
- What they should have done (with exact phrasing to use)

### 3. Deal Risk Alerts (0-3 items)
Only include if there are genuine risks:
- Risk type (headline)
- What happened
- Why it's a risk
- How to address it (specific question to ask)

### 4. Patterns to Watch
Recurring behaviors from this call:
- The pattern observed
- How many times it occurred
- Its impact
- Recommendation to fix

### 5. Next Call Game Plan
Specific actions for the next conversation:
- Questions to ask
- Topics to revisit
- Things to avoid
Prioritize as high/medium/low

### 6. Call Summary
Write 4-5 sentences summarizing:
- What the call was about
- Key discoveries
- Current deal status
- What happens next
This is stored in the database for future context, not shown to the rep.

## Language Guidelines
Sound like a sales manager giving feedback, NOT a consultant writing a report.

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

    // Generate the coaching report
    const { object } = await generateObject({
      model: getOpenAIModel(SYNTHESIS_MODEL),
      schema: CoachingReportSchema,
      system: SYNTHESIS_SYSTEM_PROMPT,
      prompt: `## Historical Context
${input.context}

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
Synthesize all this information into a coaching report. Use the pre-calculated scores for the performance_breakdown, overall_score, and deal_signal fields.

Focus on:
1. What Worked - 2-3 specific wins with quotes
2. Missed Opportunities - 2-4 actionable improvements
3. Deal Risk Alerts - only genuine risks
4. Patterns to Watch - recurring behaviors
5. Next Call Game Plan - specific actions
6. Call Summary - 4-5 sentences for database storage`,
    });

    // Override with our calculated values to ensure consistency
    const report: CoachingReport = {
      ...object,
      performance_breakdown: performanceBreakdown,
      overall_score: overallScore,
      deal_signal: dealSignal,
    };

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
  output += `Meeting Scheduled: ${extractions.next_steps.meeting_scheduled ? "Yes" : "No"}\n`;
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
