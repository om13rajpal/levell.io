import { generateObject } from "ai";
import { getOpenAIModel } from "@/lib/openai";
import {
  PainPointExtractionSchema,
  ObjectionExtractionSchema,
  EngagementScoreSchema,
  NextStepsAnalysisSchema,
  CallStructureReviewSchema,
  RepTechniqueAnalysisSchema,
  AllExtractions,
  PainPointExtraction,
  ObjectionExtraction,
  EngagementScore,
  NextStepsAnalysis,
  CallStructureReview,
  RepTechniqueAnalysis,
} from "@/types/extraction-outputs";

// Model to use for extraction (cheap and fast)
const EXTRACTION_MODEL = "gpt-4o-mini";

// ============================================
// Shared Prompt Elements
// ============================================

const LANGUAGE_GUIDELINES = `
## Language Guidelines
- Sound like a sales manager giving direct feedback, NOT a consultant writing a report
- Use simple, actionable language
- DON'T say: "Value articulation was suboptimal"
- DO say: "You didn't explain why they should care"
- DON'T say: "Identifying decision-making patterns uncovers authority"
- DO say: "You didn't find out who makes the decision"
- DON'T say: "Qualification criteria not established"
- DO say: "You don't know if they can actually buy"
- Be specific and reference exact moments from the transcript
`;

// ============================================
// Agent 1: Pain Points Extractor
// ============================================

const PAIN_POINTS_SYSTEM_PROMPT = `You are an expert sales coach analyzing a sales call transcript.

Your job is to extract all pain points the prospect revealed during the call.

## What to Look For
- Explicit problems the prospect mentions
- Implicit frustrations or challenges
- Business impacts they describe
- Emotional indicators of pain (frustration, urgency, worry)

## Depth Classification
- **surface**: Prospect mentioned a problem but didn't elaborate
- **acknowledged**: Prospect confirmed the pain is real and impacts them
- **quantified**: Prospect attached numbers, costs, or specific impacts to the pain

## Scoring Criteria (0-100)
- 90-100: Multiple pain points deeply explored with quantification
- 70-89: Several pain points acknowledged, some quantified
- 50-69: Pain points identified but only surface-level
- 30-49: Few pain points, poorly explored
- 0-29: No meaningful pain discovery

${LANGUAGE_GUIDELINES}`;

export async function extractPainPoints(
  transcript: string,
  context: string
): Promise<PainPointExtraction> {
  console.log("[ExtractionAgent] Running Pain Points Extractor...");

  const { object } = await generateObject({
    model: getOpenAIModel(EXTRACTION_MODEL),
    schema: PainPointExtractionSchema,
    system: PAIN_POINTS_SYSTEM_PROMPT,
    prompt: `## Context
${context}

## Transcript to Analyze
${transcript}

Extract all pain points from this call. For each pain point:
1. Find the exact quote from the prospect
2. Identify the underlying problem
3. Classify the depth (surface/acknowledged/quantified)
4. Analyze what this reveals about their situation
5. Suggest a follow-up question for next time

Then score the rep's pain point discovery (0-100) and write a one-sentence summary.`,
  });

  console.log(`[ExtractionAgent] Pain Points: Found ${object.items.length} items, Score: ${object.score}`);
  return object;
}

// ============================================
// Agent 2: Objections Extractor
// ============================================

const OBJECTIONS_SYSTEM_PROMPT = `You are an expert sales coach analyzing a sales call transcript.

Your job is to extract all objections the prospect raised and how the rep handled them.

## What Counts as an Objection
- Price concerns ("That's expensive", "We don't have budget")
- Timing concerns ("Not the right time", "We're busy")
- Authority concerns ("I need to check with my boss")
- Competition ("We're looking at other solutions")
- Status quo ("Our current solution works fine")
- Skepticism ("I'm not sure this will work for us")

## Effectiveness Rating
- **weak**: Rep deflected, dismissed, or ignored the objection
- **adequate**: Rep addressed it but didn't fully resolve concern
- **strong**: Rep acknowledged, addressed, and turned it into discovery

## Scoring Criteria (0-100)
- 90-100: All objections handled masterfully, turned into opportunities
- 70-89: Most objections handled well
- 50-69: Some objections handled, others missed or poorly addressed
- 30-49: Objections mostly deflected or ignored
- 0-29: Rep made objections worse or completely missed them

${LANGUAGE_GUIDELINES}`;

export async function extractObjections(
  transcript: string,
  context: string
): Promise<ObjectionExtraction> {
  console.log("[ExtractionAgent] Running Objections Extractor...");

  const { object } = await generateObject({
    model: getOpenAIModel(EXTRACTION_MODEL),
    schema: ObjectionExtractionSchema,
    system: OBJECTIONS_SYSTEM_PROMPT,
    prompt: `## Context
${context}

## Transcript to Analyze
${transcript}

Extract all objections from this call. For each objection:
1. What did the prospect push back on?
2. Find the exact quote
3. How did the rep respond?
4. Rate the effectiveness (weak/adequate/strong)
5. What should the rep have said instead?

Then score the objection handling (0-100) and write a one-sentence summary.
If no objections were raised, return an empty items array and note this in the summary.`,
  });

  console.log(`[ExtractionAgent] Objections: Found ${object.items.length} items, Score: ${object.score}`);
  return object;
}

// ============================================
// Agent 3: Engagement Scorer
// ============================================

const ENGAGEMENT_SYSTEM_PROMPT = `You are an expert sales coach analyzing a sales call transcript.

Your job is to measure how engaged the prospect was during the call.

## Positive Engagement Signals
- Asking clarifying questions
- Sharing detailed information
- Showing enthusiasm or curiosity
- Leaning into the conversation
- Offering additional context unprompted

## Negative Engagement Signals
- Short, one-word answers
- Asking to speed up or end early
- Distracted responses
- Pushing back without substance
- Going quiet or disengaged

## Talk Ratio Guidelines (by call type)
- Discovery: Rep should talk 30-40%, Prospect 60-70%
- Demo: Rep can talk 50-60%, Prospect 40-50%
- Closing: More balanced, 45-55% each

## Scoring Criteria (0-100)
- 90-100: Highly engaged prospect, asking questions, sharing freely
- 70-89: Good engagement, prospect participating actively
- 50-69: Mixed engagement, some good moments, some flat
- 30-49: Low engagement, short answers, distracted
- 0-29: Prospect clearly disengaged or hostile

${LANGUAGE_GUIDELINES}`;

export async function scoreEngagement(
  transcript: string,
  context: string
): Promise<EngagementScore> {
  console.log("[ExtractionAgent] Running Engagement Scorer...");

  const { object } = await generateObject({
    model: getOpenAIModel(EXTRACTION_MODEL),
    schema: EngagementScoreSchema,
    system: ENGAGEMENT_SYSTEM_PROMPT,
    prompt: `## Context
${context}

## Transcript to Analyze
${transcript}

Analyze prospect engagement in this call:
1. Estimate talk ratio (rep % vs prospect %)
2. Identify positive and negative engagement signals with quotes
3. Assess overall prospect energy (low/neutral/high)
4. Score engagement (0-100)
5. Write a one-sentence summary

Look for energy shifts during the call - when did engagement go up or down?`,
  });

  console.log(`[ExtractionAgent] Engagement: Talk ratio ${object.talk_ratio.rep_percent}/${object.talk_ratio.prospect_percent}, Score: ${object.score}`);
  return object;
}

// ============================================
// Agent 4: Next Steps Analyzer
// ============================================

const NEXT_STEPS_SYSTEM_PROMPT = `You are an expert sales coach analyzing a sales call transcript.

Your job is to evaluate the next steps and commitments made during the call.

## What Makes a Strong Next Step
- Specific action (not "let's stay in touch")
- Clear owner (who will do it)
- Time-bound (when will it happen)
- Mutual agreement (both parties confirm)

## Clarity Levels
- **vague**: "Let's reconnect sometime"
- **specific**: "I'll send you the proposal by Friday"
- **time-bound**: "We'll meet next Tuesday at 2pm to review with your team"

## Momentum Assessment
- **stalled**: No clear next step, deal might be dead
- **weak**: Vague next step, prospect non-committal
- **strong**: Clear, time-bound next step with mutual commitment

## Scoring Criteria (0-100)
- 90-100: Specific meeting scheduled, clear action items assigned
- 70-89: Good next step defined, mostly clear ownership
- 50-69: Some next step mentioned but vague
- 30-49: Weak or unclear next step
- 0-29: No next step, deal left hanging

${LANGUAGE_GUIDELINES}`;

export async function analyzeNextSteps(
  transcript: string,
  context: string
): Promise<NextStepsAnalysis> {
  console.log("[ExtractionAgent] Running Next Steps Analyzer...");

  const { object } = await generateObject({
    model: getOpenAIModel(EXTRACTION_MODEL),
    schema: NextStepsAnalysisSchema,
    system: NEXT_STEPS_SYSTEM_PROMPT,
    prompt: `## Context
${context}

## Transcript to Analyze
${transcript}

Analyze the next steps from this call:
1. What actions were committed to?
2. Who owns each action (rep/prospect/unclear)?
3. Is there a specific timeline?
4. How clear was the commitment (vague/specific/time-bound)?
5. Was a meeting scheduled?
6. Assess overall momentum (stalled/weak/strong)
7. Score the next steps (0-100)
8. Write a one-sentence summary`,
  });

  console.log(`[ExtractionAgent] Next Steps: ${object.committed_actions.length} actions, Meeting: ${object.meeting_scheduled}, Score: ${object.score}`);
  return object;
}

// ============================================
// Agent 5: Call Structure Reviewer
// ============================================

const CALL_STRUCTURE_SYSTEM_PROMPT = `You are an expert sales coach analyzing a sales call transcript.

Your job is to evaluate how well the call was structured.

## Ideal Call Phases
1. **opener**: Rapport building, setting the tone
2. **agenda**: Setting expectations for the call
3. **discovery**: Understanding the prospect's situation
4. **presentation**: Sharing relevant value/solutions
5. **close**: Agreeing on next steps

## What to Evaluate
- Did the rep set an agenda at the start?
- Were transitions between topics smooth?
- Was time allocated appropriately to each phase?
- Did the call end with a clear close?

## Time Management
- **rushed**: Call felt hurried, important topics skipped
- **balanced**: Good pacing, each phase got appropriate time
- **dragged**: Call went too long, lost focus

## Scoring Criteria (0-100)
- 90-100: Clear structure, smooth flow, professional execution
- 70-89: Generally good structure with minor issues
- 50-69: Some structure but disorganized moments
- 30-49: Poorly structured, jumped around
- 0-29: No structure, chaotic call

${LANGUAGE_GUIDELINES}`;

export async function reviewCallStructure(
  transcript: string,
  context: string
): Promise<CallStructureReview> {
  console.log("[ExtractionAgent] Running Call Structure Reviewer...");

  const { object } = await generateObject({
    model: getOpenAIModel(EXTRACTION_MODEL),
    schema: CallStructureReviewSchema,
    system: CALL_STRUCTURE_SYSTEM_PROMPT,
    prompt: `## Context
${context}

## Transcript to Analyze
${transcript}

Review the structure of this call:
1. Break down what happened in each phase (opener/agenda/discovery/presentation/close)
2. For each phase, note what worked and what didn't
3. Was an agenda set at the start?
4. Were transitions smooth?
5. How was time management (rushed/balanced/dragged)?
6. Score the call structure (0-100)
7. Write a one-sentence summary`,
  });

  console.log(`[ExtractionAgent] Call Structure: ${object.sections.length} phases, Agenda: ${object.agenda_set}, Score: ${object.score}`);
  return object;
}

// ============================================
// Agent 6: Rep Technique Analyzer
// ============================================

const REP_TECHNIQUE_SYSTEM_PROMPT = `You are an expert sales coach analyzing a sales call transcript.

Your job is to evaluate the rep's communication techniques.

## Common Issues to Watch For
- **interruption**: Cutting off the prospect mid-sentence
- **monologue**: Talking for extended periods without checking in
- **missed_follow_up**: Skipping past valuable information without digging deeper
- **filler_words**: Excessive "um", "uh", "like", "you know"
- **other**: Any other technique issues

## Strengths to Recognize
- **active_listening**: Acknowledging and building on what prospect said
- **good_follow_up**: Asking probing questions to go deeper
- **clear_articulation**: Explaining concepts clearly and concisely
- **other**: Any other positive techniques

## Scoring Criteria (0-100)
- 90-100: Excellent technique, active listening, no major issues
- 70-89: Good technique with minor issues
- 50-69: Decent technique but notable problems
- 30-49: Poor technique, multiple issues affecting the call
- 0-29: Very poor technique, major problems throughout

${LANGUAGE_GUIDELINES}`;

export async function analyzeRepTechnique(
  transcript: string,
  context: string
): Promise<RepTechniqueAnalysis> {
  console.log("[ExtractionAgent] Running Rep Technique Analyzer...");

  const { object } = await generateObject({
    model: getOpenAIModel(EXTRACTION_MODEL),
    schema: RepTechniqueAnalysisSchema,
    system: REP_TECHNIQUE_SYSTEM_PROMPT,
    prompt: `## Context
${context}

## Transcript to Analyze
${transcript}

Analyze the rep's communication technique:
1. Identify issues (interruptions, monologues, missed follow-ups, etc.)
   - Find exact quotes showing each issue
   - Explain the context and impact
   - Suggest what to do instead
2. Identify strengths (active listening, good follow-ups, clear articulation)
   - Find exact quotes showing each strength
   - Explain why it was effective
3. Count interruptions
4. Estimate average monologue length (in seconds)
5. Score the rep's technique (0-100)
6. Write a one-sentence summary`,
  });

  console.log(`[ExtractionAgent] Rep Technique: ${object.issues.length} issues, ${object.strengths.length} strengths, Score: ${object.score}`);
  return object;
}

// ============================================
// Parallel Execution Orchestrator
// ============================================

export interface ExtractionResult {
  success: boolean;
  data?: AllExtractions;
  errors?: {
    agent: string;
    error: string;
  }[];
  timing: {
    total_ms: number;
    per_agent: Record<string, number>;
  };
}

/**
 * Run all 6 extraction agents in parallel
 * Uses Promise.allSettled so one failure doesn't break everything
 */
export async function runAllExtractions(
  transcript: string,
  formattedContext: string
): Promise<ExtractionResult> {
  console.log("[ExtractionOrchestrator] Starting parallel extraction...");
  const startTime = Date.now();
  const timings: Record<string, number> = {};

  // Define all extractions with timing
  const runWithTiming = async <T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ name: string; result: T }> => {
    const start = Date.now();
    const result = await fn();
    timings[name] = Date.now() - start;
    return { name, result };
  };

  // Run all in parallel with individual error handling
  const [
    painPointsResult,
    objectionsResult,
    engagementResult,
    nextStepsResult,
    callStructureResult,
    repTechniqueResult,
  ] = await Promise.allSettled([
    runWithTiming("pain_points", () => extractPainPoints(transcript, formattedContext)),
    runWithTiming("objections", () => extractObjections(transcript, formattedContext)),
    runWithTiming("engagement", () => scoreEngagement(transcript, formattedContext)),
    runWithTiming("next_steps", () => analyzeNextSteps(transcript, formattedContext)),
    runWithTiming("call_structure", () => reviewCallStructure(transcript, formattedContext)),
    runWithTiming("rep_technique", () => analyzeRepTechnique(transcript, formattedContext)),
  ]);

  const totalTime = Date.now() - startTime;
  const errors: { agent: string; error: string }[] = [];

  // Process results explicitly to maintain type safety
  let painPoints: PainPointExtraction | undefined;
  let objections: ObjectionExtraction | undefined;
  let engagement: EngagementScore | undefined;
  let nextSteps: NextStepsAnalysis | undefined;
  let callStructure: CallStructureReview | undefined;
  let repTechnique: RepTechniqueAnalysis | undefined;

  if (painPointsResult.status === "fulfilled") {
    painPoints = painPointsResult.value.result;
  } else {
    errors.push({ agent: "pain_points", error: painPointsResult.reason?.message || "Unknown error" });
    console.error("[ExtractionOrchestrator] pain_points failed:", painPointsResult.reason);
  }

  if (objectionsResult.status === "fulfilled") {
    objections = objectionsResult.value.result;
  } else {
    errors.push({ agent: "objections", error: objectionsResult.reason?.message || "Unknown error" });
    console.error("[ExtractionOrchestrator] objections failed:", objectionsResult.reason);
  }

  if (engagementResult.status === "fulfilled") {
    engagement = engagementResult.value.result;
  } else {
    errors.push({ agent: "engagement", error: engagementResult.reason?.message || "Unknown error" });
    console.error("[ExtractionOrchestrator] engagement failed:", engagementResult.reason);
  }

  if (nextStepsResult.status === "fulfilled") {
    nextSteps = nextStepsResult.value.result;
  } else {
    errors.push({ agent: "next_steps", error: nextStepsResult.reason?.message || "Unknown error" });
    console.error("[ExtractionOrchestrator] next_steps failed:", nextStepsResult.reason);
  }

  if (callStructureResult.status === "fulfilled") {
    callStructure = callStructureResult.value.result;
  } else {
    errors.push({ agent: "call_structure", error: callStructureResult.reason?.message || "Unknown error" });
    console.error("[ExtractionOrchestrator] call_structure failed:", callStructureResult.reason);
  }

  if (repTechniqueResult.status === "fulfilled") {
    repTechnique = repTechniqueResult.value.result;
  } else {
    errors.push({ agent: "rep_technique", error: repTechniqueResult.reason?.message || "Unknown error" });
    console.error("[ExtractionOrchestrator] rep_technique failed:", repTechniqueResult.reason);
  }

  console.log(`[ExtractionOrchestrator] Completed in ${totalTime}ms with ${errors.length} errors`);

  // If we have all required fields, return success
  if (
    painPoints &&
    objections &&
    engagement &&
    nextSteps &&
    callStructure &&
    repTechnique
  ) {
    return {
      success: true,
      data: {
        pain_points: painPoints,
        objections: objections,
        engagement: engagement,
        next_steps: nextSteps,
        call_structure: callStructure,
        rep_technique: repTechnique,
      },
      errors: errors.length > 0 ? errors : undefined,
      timing: {
        total_ms: totalTime,
        per_agent: timings,
      },
    };
  }

  // Return partial failure
  return {
    success: false,
    errors,
    timing: {
      total_ms: totalTime,
      per_agent: timings,
    },
  };
}
