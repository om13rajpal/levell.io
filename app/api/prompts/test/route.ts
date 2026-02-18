import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { authenticateRequest, unauthorizedResponse } from "@/lib/auth";

// Initialize Supabase admin client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createClient(url, key);
}

// Initialize OpenAI client
function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }
  return new OpenAI({ apiKey });
}

// Token cost calculation (per 1M tokens)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4-turbo": { input: 10.00, output: 30.00 },
  "gpt-4.1": { input: 2.50, output: 10.00 }, // Same as gpt-4o
  "gpt-3.5-turbo": { input: 0.50, output: 1.50 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS["gpt-4o"];
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

// Clean transcript text from sentences
function cleanTranscriptText(sentences: Array<{
  speaker_name?: string;
  speaker?: string;
  text?: string;
  start_time?: number;
  end_time?: number;
}>): { text: string; talkRatio: { rep_percent: number; prospect_percent: number } } {
  if (!sentences || !Array.isArray(sentences)) {
    return { text: "", talkRatio: { rep_percent: 50, prospect_percent: 50 } };
  }

  // Collect unique speakers
  const speakers = new Set<string>();
  sentences.forEach(s => {
    const speaker = s.speaker_name || s.speaker || "";
    if (speaker) speakers.add(speaker.trim());
  });

  // Simple heuristic: first speaker is usually the rep
  const speakerList = [...speakers];
  const repSpeaker = speakerList[0] || "Unknown";

  let repWords = 0;
  let prospectWords = 0;

  const cleanedLines = sentences
    .filter(s => s.text && s.text.trim().length > 3)
    .map(s => {
      const speaker = (s.speaker_name || s.speaker || "Unknown").trim();
      const isRep = speaker === repSpeaker;
      const text = s.text?.trim() || "";
      const wordCount = text.split(/\s+/).length;

      if (isRep) {
        repWords += wordCount;
      } else {
        prospectWords += wordCount;
      }

      const roleTag = isRep ? "[REP]" : "[PROSPECT]";
      return `${roleTag} ${speaker}: ${text}`;
    });

  const totalWords = repWords + prospectWords;
  const talkRatio = {
    rep_percent: totalWords > 0 ? Math.round((repWords / totalWords) * 100) : 50,
    prospect_percent: totalWords > 0 ? Math.round((prospectWords / totalWords) * 100) : 50,
  };

  return { text: cleanedLines.join("\n"), talkRatio };
}

// Build context from transcript data
function buildContext(transcript: Record<string, unknown>, user: Record<string, unknown> | null): string {
  const userName = (user?.name as string) || "Sales Rep";
  const userEmail = (user?.email as string) || "";
  const salesMotion = (user?.sales_motion as string) || "consultative";

  return `## SALES CONTEXT
Sales Motion: ${salesMotion}

## CALL PARTICIPANTS
Rep Name: ${userName}
Rep Email: ${userEmail}

## CALL METADATA
Call Title: ${transcript.title || "Untitled Call"}
Duration: ${transcript.duration || "Unknown"} minutes`;
}

// POST - Run a prompt test against test transcripts
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return unauthorizedResponse(auth.error);

    const supabase = getSupabaseAdmin();
    const openai = getOpenAI();
    const body = await request.json();

    const {
      prompt_id,
      agent_type,
      test_transcript_ids,
      model = "gpt-4o",
      max_transcripts = 5,
    } = body;

    // Validation
    if (!prompt_id && !agent_type) {
      return NextResponse.json(
        { error: "Must provide either prompt_id or agent_type" },
        { status: 400 }
      );
    }

    // 1. Fetch the prompt
    let promptQuery = supabase
      .from("agent_prompts")
      .select("*")
      .eq("is_active", true);

    if (prompt_id) {
      promptQuery = promptQuery.eq("id", prompt_id);
    } else {
      promptQuery = promptQuery.eq("agent_type", agent_type);
    }

    const { data: promptData, error: promptError } = await promptQuery.single();

    if (promptError || !promptData) {
      return NextResponse.json(
        { error: "Prompt not found", details: promptError?.message },
        { status: 404 }
      );
    }

    // 2. Fetch test transcripts
    let transcriptQuery = supabase
      .from("test_transcripts_full")
      .select("*");

    if (test_transcript_ids && test_transcript_ids.length > 0) {
      transcriptQuery = transcriptQuery.in("test_id", test_transcript_ids);
    }

    const { data: testTranscripts, error: transcriptError } = await transcriptQuery
      .limit(max_transcripts);

    if (transcriptError) {
      return NextResponse.json(
        { error: "Failed to fetch test transcripts", details: transcriptError.message },
        { status: 500 }
      );
    }

    if (!testTranscripts || testTranscripts.length === 0) {
      return NextResponse.json(
        { error: "No test transcripts found" },
        { status: 404 }
      );
    }

    // 3. Parse the prompt template (extract system and user prompts)
    const promptContent = promptData.prompt_content;

    // Extract system prompt (between "## System Prompt" and "## User Message Template" or "## Output Format")
    const systemMatch = promptContent.match(/## System Prompt\n([\s\S]*?)(?=## User Message Template|## Output Format|$)/i);
    const userMatch = promptContent.match(/## User Message Template\n([\s\S]*?)$/i);

    const systemPromptTemplate = systemMatch ? systemMatch[1].trim() : promptContent;
    const userPromptTemplate = userMatch ? userMatch[1].trim() : "Analyze the following transcript:\n\n{{transcript_text}}\n\n{{context}}";

    // 4. Run the prompt against each test transcript
    const results: Array<{
      test_transcript_id: string;
      label: string;
      call_type: string;
      transcript_title: string;
      input_tokens: number;
      output_tokens: number;
      cost: number;
      duration_ms: number;
      output: unknown;
      error?: string;
      run_id?: string;
    }> = [];

    for (const testTranscript of testTranscripts) {
      const runStartTime = Date.now();

      try {
        // Clean transcript if not already cleaned
        let transcriptText = testTranscript.clean_transcript_text;
        let talkRatio = testTranscript.talk_ratio;

        if (!transcriptText && testTranscript.sentences) {
          const cleaned = cleanTranscriptText(testTranscript.sentences);
          transcriptText = cleaned.text;
          talkRatio = cleaned.talkRatio;
        }

        // Build context
        const context = buildContext(testTranscript, {
          name: testTranscript.user_name,
          email: testTranscript.user_email,
          sales_motion: testTranscript.sales_motion,
        });

        // Replace variables in prompts
        const repName = testTranscript.rep_name || testTranscript.user_name || "Sales Rep";
        const repTranscriptName = testTranscript.rep_transcript_name || repName;

        const systemPrompt = systemPromptTemplate;
        const userPrompt = userPromptTemplate
          .replace(/\{\{transcript_text\}\}/g, transcriptText || "")
          .replace(/\{\{context\}\}/g, context)
          .replace(/\{\{rep_name\}\}/g, repName)
          .replace(/\{\{rep_transcript_name\}\}/g, repTranscriptName)
          .replace(/\{\{rep_email\}\}/g, testTranscript.user_email || "")
          .replace(/\{\{talk_ratio\}\}/g, JSON.stringify(talkRatio))
          .replace(/\{\{prospects\}\}/g, JSON.stringify(testTranscript.prospects || []));

        // Ensure JSON keyword is present for response_format
        const finalUserPrompt = userPrompt.toLowerCase().includes("json")
          ? userPrompt
          : userPrompt + "\n\nRespond in JSON format.";

        // Call OpenAI
        const completion = await openai.chat.completions.create({
          model: model,
          response_format: { type: "json_object" },
          temperature: 0.3,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: finalUserPrompt },
          ],
        });

        const runDuration = Date.now() - runStartTime;
        const inputTokens = completion.usage?.prompt_tokens || 0;
        const outputTokens = completion.usage?.completion_tokens || 0;
        const cost = calculateCost(model, inputTokens, outputTokens);

        let outputJson: unknown;
        try {
          outputJson = JSON.parse(completion.choices[0]?.message?.content || "{}");
        } catch {
          outputJson = { raw: completion.choices[0]?.message?.content };
        }

        // Save to agent_runs
        const { data: runData, error: runError } = await supabase
          .from("agent_runs")
          .insert({
            agent_type: promptData.agent_type,
            prompt_id: promptData.id,
            prompt_sent: `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userPrompt}`,
            system_prompt: systemPrompt,
            user_message: userPrompt,
            output: JSON.stringify(outputJson, null, 2),
            model: model,
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_cost: cost,
            transcript_id: testTranscript.transcript_id,
            context_type: "call",
            duration_ms: runDuration,
            status: "completed",
            is_test_run: true,
            test_transcript_id: testTranscript.test_id,
            metadata: {
              test_label: testTranscript.label,
              call_type: testTranscript.call_type,
              difficulty: testTranscript.difficulty,
              prompt_version: promptData.version,
            },
          })
          .select("id")
          .single();

        if (runError) {
          console.error("[Test Prompt] Failed to save run:", runError);
        }

        results.push({
          test_transcript_id: testTranscript.test_id,
          label: testTranscript.label,
          call_type: testTranscript.call_type,
          transcript_title: testTranscript.title,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost: cost,
          duration_ms: runDuration,
          output: outputJson,
          run_id: runData?.id,
        });

      } catch (error) {
        const runDuration = Date.now() - runStartTime;
        results.push({
          test_transcript_id: testTranscript.test_id,
          label: testTranscript.label,
          call_type: testTranscript.call_type,
          transcript_title: testTranscript.title,
          input_tokens: 0,
          output_tokens: 0,
          cost: 0,
          duration_ms: runDuration,
          output: null,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    const totalInputTokens = results.reduce((sum, r) => sum + r.input_tokens, 0);
    const totalOutputTokens = results.reduce((sum, r) => sum + r.output_tokens, 0);
    const successCount = results.filter(r => !r.error).length;

    return NextResponse.json({
      prompt: {
        id: promptData.id,
        name: promptData.name,
        agent_type: promptData.agent_type,
        version: promptData.version,
      },
      model: model,
      summary: {
        total_transcripts: results.length,
        successful: successCount,
        failed: results.length - successCount,
        total_input_tokens: totalInputTokens,
        total_output_tokens: totalOutputTokens,
        total_cost: totalCost.toFixed(6),
        total_duration_ms: totalDuration,
      },
      results: results,
    });

  } catch (error) {
    console.error("[Test Prompt API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

// GET - Get test results for a prompt
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const promptId = searchParams.get("prompt_id");
    const agentType = searchParams.get("agent_type");
    const limit = parseInt(searchParams.get("limit") || "50");

    let query = supabase
      .from("agent_runs")
      .select(`
        *,
        test_transcripts (id, label, call_type, difficulty),
        agent_prompts (id, name, agent_type, version)
      `)
      .eq("is_test_run", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (promptId) {
      query = query.eq("prompt_id", promptId);
    }

    if (agentType) {
      query = query.eq("agent_type", agentType);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch test results", details: error.message },
        { status: 500 }
      );
    }

    // Group by prompt version
    const byVersion: Record<string, typeof data> = {};
    data?.forEach(run => {
      const key = `${run.prompt_id}_v${run.metadata?.prompt_version || 1}`;
      if (!byVersion[key]) {
        byVersion[key] = [];
      }
      byVersion[key].push(run);
    });

    return NextResponse.json({
      runs: data,
      byVersion: byVersion,
      count: data?.length || 0,
    });

  } catch (error) {
    console.error("[Test Prompt API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
