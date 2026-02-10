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
// Shared Types
// ============================================

interface RepInfo {
  name: string;
  company: string;
  role?: string;
}

interface CallMetadata {
  title?: string;
  duration_minutes?: number;
  sentence_count?: number;
  talk_ratio?: {
    rep_percent: number;
    prospect_percent: number;
  };
}

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

## CRITICAL OUTPUT FORMAT
- Output the actual data values directly
- Do NOT output a JSON Schema (no "type": "object", "properties": {...})
- Do NOT describe the format - just fill in the values
`;

/**
 * Build the tagged context block shared across all extraction agents.
 */
function buildUserContext(
  context: string,
  transcript: string,
  repInfo?: RepInfo,
  callMetadata?: CallMetadata
): string {
  return `<rep_context>
${context}
</rep_context>

<call_metadata>
Title: ${callMetadata?.title || "Unknown"}
Duration: ${callMetadata?.duration_minutes || "Unknown"} minutes
Sentences: ${callMetadata?.sentence_count || "Unknown"}
Talk Ratio: Rep ${callMetadata?.talk_ratio?.rep_percent || "?"}% / Prospect ${callMetadata?.talk_ratio?.prospect_percent || "?"}%
</call_metadata>

<internal_team>
Rep: ${repInfo?.name || "Unknown"} (${repInfo?.company || "Unknown"})
Role: ${repInfo?.role || "Sales Rep"}
</internal_team>

<transcript>
${transcript}
</transcript>`;
}

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

## Role-Based Expectations
- **SDR / BDR**: Focus on qualification — did the rep identify enough pain to justify passing the lead? Surface-level is acceptable if the rep probed at least once.
- **AE / Account Executive**: Deep discovery is expected. Every pain point should be explored to "acknowledged" or "quantified" depth. Missing follow-ups here is a coaching priority.
- **CS / Customer Success**: Focus on retention signals. Look for pain that indicates churn risk or expansion opportunity.

## Coaching Style
When the rep missed a pain point or failed to dig deeper, write coaching in this format:
  "You said X → Try instead: Y"
For example: "You said 'Got it, makes sense' → Try instead: 'How much is that costing you per quarter?'"

## Scoring Criteria (0-100)
- 90-100: Multiple pain points deeply explored with quantification
- 70-89: Several pain points acknowledged, some quantified
- 50-69: Pain points identified but only surface-level
- 30-49: Few pain points, poorly explored
- 0-29: No meaningful pain discovery

## Additional Fields
- **missed_opportunities**: List moments where the prospect hinted at pain but the rep did not follow up. Use the "You said X → Try instead: Y" format.
- **score_rationale**: One sentence explaining why you gave the score you did.

${LANGUAGE_GUIDELINES}`;

export async function extractPainPoints(
  transcript: string,
  context: string,
  repInfo?: RepInfo,
  callMetadata?: CallMetadata
): Promise<PainPointExtraction> {
  console.log("[ExtractionAgent] Running Pain Points Extractor...");

  const userPrompt = `${buildUserContext(context, transcript, repInfo, callMetadata)}

Extract all pain points from this call. For each pain point:
1. Find the exact quote from the prospect
2. Identify the underlying problem
3. Classify the depth (surface/acknowledged/quantified)
4. Analyze what this reveals about their situation
5. Suggest a follow-up question for next time

Then:
- List missed_opportunities where pain was hinted at but not explored (use "You said X → Try instead: Y" format). Provide AT LEAST 2-3 missed opportunities — dig deep into the transcript for subtle hints the rep glossed over.
- Score the rep's pain point discovery (0-100)
- Provide a score_rationale explaining the score
- Write a one-sentence summary

IMPORTANT: Be thorough. Even short calls contain multiple pain signals. Extract AT LEAST 3 pain points if the call is longer than 5 minutes. Look for implicit pain (tone shifts, hedging language, comparisons to competitors) not just explicit statements.`;

  const { object } = await generateObject({
    model: getOpenAIModel(EXTRACTION_MODEL),
    schema: PainPointExtractionSchema,
    system: PAIN_POINTS_SYSTEM_PROMPT,
    prompt: userPrompt,
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

## Role-Based Expectations
- **SDR / BDR**: Fewer objections expected at this stage. Focus on whether the rep handled gatekeeping and initial skepticism cleanly.
- **AE / Account Executive**: Must handle ALL objections. Leaving an objection unaddressed is a deal risk. Expect the rep to acknowledge, reframe, and confirm resolution.
- **CS / Customer Success**: Focus on churn signals disguised as objections ("We're not using feature X", "Our team doesn't see the value").

## Pattern Detection
Look for repeated objection themes across the call. If the prospect raises the same concern multiple times in different ways, that is a pattern indicating the rep did not fully resolve it.

## Additional Fields
- **unaddressed_objections**: List objections the prospect raised that the rep never addressed or circled back to.
- **patterns**: List repeated objection themes (e.g., "Prospect mentioned budget concerns 3 separate times").

## Scoring Criteria (0-100)
- 90-100: All objections handled masterfully, turned into opportunities
- 70-89: Most objections handled well
- 50-69: Some objections handled, others missed or poorly addressed
- 30-49: Objections mostly deflected or ignored
- 0-29: Rep made objections worse or completely missed them

${LANGUAGE_GUIDELINES}`;

export async function extractObjections(
  transcript: string,
  context: string,
  repInfo?: RepInfo,
  callMetadata?: CallMetadata
): Promise<ObjectionExtraction> {
  console.log("[ExtractionAgent] Running Objections Extractor...");

  const userPrompt = `${buildUserContext(context, transcript, repInfo, callMetadata)}

Extract all objections from this call. For each objection:
1. What did the prospect push back on?
2. Find the exact quote
3. How did the rep respond?
4. Rate the effectiveness (weak/adequate/strong)
5. What should the rep have said instead?

Also:
- List unaddressed_objections the prospect raised that were never resolved. Even subtle resistance counts — "I'll think about it", "We'll see", "Not sure about that" are soft objections. Provide AT LEAST 1-2 if any resistance was shown.
- Identify patterns — repeated objection themes that indicate unresolved concerns. Look for the same concern surfacing in different words across the call. Provide AT LEAST 1-2 patterns if objections exist.
- Score the objection handling (0-100)
- Write a one-sentence summary

If no objections were raised, return an empty items array and note this in the summary. But be careful — silence or topic changes after a pitch can be passive objections.`;

  const { object } = await generateObject({
    model: getOpenAIModel(EXTRACTION_MODEL),
    schema: ObjectionExtractionSchema,
    system: OBJECTIONS_SYSTEM_PROMPT,
    prompt: userPrompt,
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

IMPORTANT: If pre-calculated talk ratio values are provided in call_metadata, use those as your primary data for the talk_ratio field. Only estimate from the transcript if no pre-calculated values are available.

## Energy Shifts
Track moments where engagement visibly changed direction. Note:
- The moment (what was being discussed)
- Direction: "up" (engagement increased) or "down" (engagement dropped)
- Trigger: what caused the shift (e.g., rep asked a great question, rep went into a monologue, prospect heard a relevant case study)

## Red Flags & Rep Adjustments
- **red_flags**: List concerning patterns (e.g., "Prospect gave one-word answers for 3 minutes straight", "Prospect tried to end the call early")
- **rep_adjustments**: List suggestions for how the rep could have responded to engagement drops (e.g., "When prospect went quiet after the pricing slide, pause and ask: 'What's your reaction to that?'")

## Scoring Criteria (0-100)
- 90-100: Highly engaged prospect, asking questions, sharing freely
- 70-89: Good engagement, prospect participating actively
- 50-69: Mixed engagement, some good moments, some flat
- 30-49: Low engagement, short answers, distracted
- 0-29: Prospect clearly disengaged or hostile

${LANGUAGE_GUIDELINES}`;

export async function scoreEngagement(
  transcript: string,
  context: string,
  repInfo?: RepInfo,
  callMetadata?: CallMetadata
): Promise<EngagementScore> {
  console.log("[ExtractionAgent] Running Engagement Scorer...");

  const userPrompt = `${buildUserContext(context, transcript, repInfo, callMetadata)}

Analyze prospect engagement in this call:
1. ${callMetadata?.talk_ratio ? `Use the pre-calculated talk ratio: Rep ${callMetadata.talk_ratio.rep_percent}% / Prospect ${callMetadata.talk_ratio.prospect_percent}%` : "Estimate talk ratio (rep % vs prospect %)"}
2. Identify positive and negative engagement signals with quotes — find AT LEAST 3-5 signals total
3. Assess overall prospect energy (low/neutral/high)
4. Track energy_shifts — moments where engagement changed direction, with the trigger. Find AT LEAST 2-3 shifts. Every call has moments where interest rises or falls.
5. List red_flags — concerning engagement patterns. Provide AT LEAST 1-2. Look for: short answers, topic avoidance, clock-watching language, distracted responses, prospect going quiet after key moments.
6. List rep_adjustments — what the rep should do differently when engagement drops. Provide AT LEAST 2-3 specific suggestions with "When X happened, try Y" format.
7. Score engagement (0-100)
8. Write a one-sentence summary

IMPORTANT: Be granular. Don't just say "engagement was good/bad". Track the emotional arc of the call from start to finish. Note specific moments where energy shifted and WHY.`;

  const { object } = await generateObject({
    model: getOpenAIModel(EXTRACTION_MODEL),
    schema: EngagementScoreSchema,
    system: ENGAGEMENT_SYSTEM_PROMPT,
    prompt: userPrompt,
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

## Meeting Scheduled
If a meeting was scheduled, provide structured details:
- scheduled: true/false
- date: the agreed date/time if mentioned
- attendees: who will be in the meeting
- purpose: what the meeting is for
If no meeting details were discussed, you may return a simple boolean false.

## Additional Fields
- **who_has_the_ball**: After this call ends, who needs to act next? "rep", "prospect", or "unclear"
- **risk_factors**: List anything that could cause the deal to stall (e.g., "No decision-maker involved", "Prospect said they need internal approval but no timeline given")
- **closing_quote**: Find the strongest commitment quote from the prospect. This should be the moment where the prospect showed the most intent to move forward. If no strong commitment was made, use the closest thing to one.

## Scoring Criteria (0-100)
- 90-100: Specific meeting scheduled, clear action items assigned
- 70-89: Good next step defined, mostly clear ownership
- 50-69: Some next step mentioned but vague
- 30-49: Weak or unclear next step
- 0-29: No next step, deal left hanging

${LANGUAGE_GUIDELINES}`;

export async function analyzeNextSteps(
  transcript: string,
  context: string,
  repInfo?: RepInfo,
  callMetadata?: CallMetadata
): Promise<NextStepsAnalysis> {
  console.log("[ExtractionAgent] Running Next Steps Analyzer...");

  const userPrompt = `${buildUserContext(context, transcript, repInfo, callMetadata)}

Analyze the next steps from this call:
1. What actions were committed to? List ALL commitments, even small ones like "I'll send that over".
2. Who owns each action (rep/prospect/unclear)?
3. Is there a specific timeline?
4. How clear was the commitment (vague/specific/time-bound)?
5. Was a meeting scheduled? If yes, provide date, attendees, and purpose as a structured object. If no, return false.
6. Assess overall momentum (stalled/weak/strong)
7. Determine who_has_the_ball — who needs to act next?
8. List risk_factors that could stall the deal — provide AT LEAST 2-3. Consider: missing stakeholders, vague timelines, unresolved objections carried forward, no mutual commitment, budget not confirmed, competitor evaluation in progress.
9. Find the closing_quote — the strongest commitment quote from the prospect. If no strong commitment, use the closest thing and note the weakness.
10. Score the next steps (0-100)
11. Write a one-sentence summary`;

  const { object } = await generateObject({
    model: getOpenAIModel(EXTRACTION_MODEL),
    schema: NextStepsAnalysisSchema,
    system: NEXT_STEPS_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  console.log(`[ExtractionAgent] Next Steps: ${object.committed_actions.length} actions, Meeting: ${JSON.stringify(object.meeting_scheduled)}, Score: ${object.score}`);
  return object;
}

// ============================================
// Agent 5: Call Structure Reviewer
// ============================================

const CALL_STRUCTURE_SYSTEM_PROMPT = `You are an expert sales coach analyzing a sales call transcript.

Your job is to evaluate how well the call was structured.

## Ideal Call Phases & Time Allocation
1. **opener** (~5% of call): Rapport building, setting the tone
2. **agenda** (~5% of call): Setting expectations for the call
3. **discovery** (~40% of call): Understanding the prospect's situation
4. **presentation** (~30% of call): Sharing relevant value/solutions
5. **close** (~20% of call): Agreeing on next steps, confirming commitments

## What to Evaluate
- Did the rep set an agenda at the start?
- Were transitions between topics smooth?
- Was time allocated appropriately to each phase?
- Did the call end with a clear close?

## Structure Issues
Identify specific structural problems, such as:
- "Skipped agenda entirely — prospect didn't know the purpose of the call"
- "Discovery was only 10% of the call — jumped to presentation too early"
- "No close phase — call just fizzled out"
- "Opener ran 15% of call — too much small talk before business"
- "Presentation before discovery — pitched without understanding needs"

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
  context: string,
  repInfo?: RepInfo,
  callMetadata?: CallMetadata
): Promise<CallStructureReview> {
  console.log("[ExtractionAgent] Running Call Structure Reviewer...");

  const userPrompt = `${buildUserContext(context, transcript, repInfo, callMetadata)}

Review the structure of this call:
1. Break down what happened in each phase (opener/agenda/discovery/presentation/close). Identify ALL phases that occurred even if they were brief or skipped.
2. For each phase, note what worked AND what didn't — provide both for every phase.
3. Was an agenda set at the start?
4. Were transitions smooth?
5. How was time management (rushed/balanced/dragged)?
6. Compare actual time allocation to ideal: opener 5%, agenda 5%, discovery 40%, presentation 30%, close 20%
7. List structure_issues — provide AT LEAST 2-3 specific structural problems. Common issues: skipped agenda, discovery too short, no clear close, presentation before discovery, monologue sections, abrupt topic changes, no recap.
8. Score the call structure (0-100)
9. Write a one-sentence summary`;

  const { object } = await generateObject({
    model: getOpenAIModel(EXTRACTION_MODEL),
    schema: CallStructureReviewSchema,
    system: CALL_STRUCTURE_SYSTEM_PROMPT,
    prompt: userPrompt,
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

## Metrics to Calculate
- **monologue_count**: How many times the rep spoke for more than 60 seconds uninterrupted
- **longest_monologue**: The longest continuous rep speaking stretch in seconds (estimate from transcript)
- **missed_follow_up_count**: How many times the prospect said something important and the rep moved on without exploring it
- **good_follow_up_count**: How many times the rep asked a great follow-up question that deepened the conversation

## Pattern Detection
Look for recurring technique patterns across the call, such as:
- "Rep consistently interrupts when prospect mentions competitors"
- "Rep defaults to monologues when unsure how to respond"
- "Rep asks great open-ended questions in discovery but switches to closed questions during presentation"

## Top Priority Fix
For the #1 most impactful issue, provide a specific practice drill the rep can do to improve. For example:
- "Practice the 3-second pause: After the prospect finishes speaking, count to 3 before responding. Record yourself on 5 practice calls this week."
- "Monologue breaker: Set a timer for 45 seconds. Every time it goes off during a practice call, stop and ask a question."

## Scoring Criteria (0-100)
- 90-100: Excellent technique, active listening, no major issues
- 70-89: Good technique with minor issues
- 50-69: Decent technique but notable problems
- 30-49: Poor technique, multiple issues affecting the call
- 0-29: Very poor technique, major problems throughout

${LANGUAGE_GUIDELINES}`;

export async function analyzeRepTechnique(
  transcript: string,
  context: string,
  repInfo?: RepInfo,
  callMetadata?: CallMetadata
): Promise<RepTechniqueAnalysis> {
  console.log("[ExtractionAgent] Running Rep Technique Analyzer...");

  const userPrompt = `${buildUserContext(context, transcript, repInfo, callMetadata)}

Analyze the rep's communication technique:
1. Identify issues (interruptions, monologues, missed follow-ups, etc.) — find AT LEAST 2-3 issues with exact quotes. Even good reps have technique issues.
   - Find exact quotes showing each issue
   - Explain the context and impact
   - Suggest what to do instead using "You said X → Try instead: Y" format
2. Identify strengths (active listening, good follow-ups, clear articulation) — find AT LEAST 2-3 strengths with exact quotes.
   - Find exact quotes showing each strength
   - Explain why it was effective
3. Count interruptions
4. Estimate average monologue length (in seconds)
5. Calculate metrics:
   - monologue_count: times rep spoke 60+ seconds uninterrupted
   - longest_monologue: longest continuous rep stretch in seconds
   - missed_follow_up_count: times rep skipped past important info
   - good_follow_up_count: times rep asked a great deepening question
6. Identify patterns — AT LEAST 2 recurring technique behaviors across the call. Look for: consistent question types, response patterns after objections, how they handle silence, verbal tics, pacing changes.
7. Determine the top_priority_fix — the #1 issue with a SPECIFIC practice drill (e.g., "Record yourself asking 3 open-ended questions in a row without any statements. Do this for 10 minutes daily this week.")
8. Score the rep's technique (0-100)
9. Write a one-sentence summary`;

  const { object } = await generateObject({
    model: getOpenAIModel(EXTRACTION_MODEL),
    schema: RepTechniqueAnalysisSchema,
    system: REP_TECHNIQUE_SYSTEM_PROMPT,
    prompt: userPrompt,
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
  formattedContext: string,
  repInfo?: RepInfo,
  callMetadata?: CallMetadata
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
    runWithTiming("pain_points", () => extractPainPoints(transcript, formattedContext, repInfo, callMetadata)),
    runWithTiming("objections", () => extractObjections(transcript, formattedContext, repInfo, callMetadata)),
    runWithTiming("engagement", () => scoreEngagement(transcript, formattedContext, repInfo, callMetadata)),
    runWithTiming("next_steps", () => analyzeNextSteps(transcript, formattedContext, repInfo, callMetadata)),
    runWithTiming("call_structure", () => reviewCallStructure(transcript, formattedContext, repInfo, callMetadata)),
    runWithTiming("rep_technique", () => analyzeRepTechnique(transcript, formattedContext, repInfo, callMetadata)),
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
