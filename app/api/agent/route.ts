import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { getOpenAIModel } from "@/lib/openai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { trackAgentRequest } from "@/lib/openmeter";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

// Lazy-loaded admin Supabase client for server-side operations
let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdmin() {
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

// Helper function to format duration
function formatDuration(minutes: number | null): string {
  if (!minutes) return "Unknown";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} minutes`;
}

// Fetch call/transcript context
async function fetchCallContext(callId: string): Promise<string> {
  try {
    const { data: transcript } = await getSupabaseAdmin()
      .from("transcripts")
      .select("*")
      .eq("id", callId)
      .single();

    if (!transcript) {
      return "No call data found for the selected call.";
    }

    let context = `
## CALL TRANSCRIPT DATA

### Call Details
- **Title**: ${transcript.title || "Untitled Call"}
- **Duration**: ${formatDuration(transcript.duration)}
- **Date**: ${transcript.created_at ? new Date(transcript.created_at).toLocaleDateString() : "Unknown"}
- **Overall Score**: ${transcript.ai_overall_score !== null ? `${transcript.ai_overall_score}/100` : "Not scored"}
`;

    // Add participants
    if (transcript.participants && Array.isArray(transcript.participants)) {
      context += `\n### Participants\n`;
      transcript.participants.forEach((p: { name?: string; email?: string }) => {
        context += `- ${p.name || "Unknown"}${p.email ? ` (${p.email})` : ""}\n`;
      });
    }

    // Add meeting attendees
    if (transcript.meeting_attendees && Array.isArray(transcript.meeting_attendees)) {
      context += `\n### Meeting Attendees\n`;
      transcript.meeting_attendees.forEach((a: { displayName?: string; email?: string }) => {
        context += `- ${a.displayName || "Unknown"}${a.email ? ` (${a.email})` : ""}\n`;
      });
    }

    // Add AI scores
    if (transcript.ai_scores && typeof transcript.ai_scores === "object") {
      context += `\n### AI Scores Breakdown\n`;
      Object.entries(transcript.ai_scores).forEach(([key, value]) => {
        context += `- **${key}**: ${value}\n`;
      });
    }

    // Add AI analysis
    if (transcript.ai_analysis && typeof transcript.ai_analysis === "object") {
      context += `\n### AI Analysis\n`;
      Object.entries(transcript.ai_analysis).forEach(([key, value]) => {
        if (typeof value === "string") {
          context += `\n**${key}**:\n${value}\n`;
        } else if (Array.isArray(value)) {
          context += `\n**${key}**:\n`;
          value.forEach((item: string | object) => {
            context += `- ${typeof item === "string" ? item : JSON.stringify(item)}\n`;
          });
        }
      });
    }

    // Add deal risk alerts
    if (transcript.ai_deal_risk_alerts && Array.isArray(transcript.ai_deal_risk_alerts)) {
      context += `\n### Deal Risk Alerts\n`;
      transcript.ai_deal_risk_alerts.forEach((alert: string | { alert?: string; description?: string }) => {
        if (typeof alert === "string") {
          context += `- ${alert}\n`;
        } else {
          context += `- **${alert.alert || "Alert"}**: ${alert.description || ""}\n`;
        }
      });
    }

    // Add qualification gaps
    if (transcript.ai_qualification_gaps && Array.isArray(transcript.ai_qualification_gaps)) {
      context += `\n### Qualification Gaps\n`;
      transcript.ai_qualification_gaps.forEach((gap: string | object) => {
        context += `- ${typeof gap === "string" ? gap : JSON.stringify(gap)}\n`;
      });
    }

    // Add summary
    if (transcript.summary) {
      context += `\n### Call Summary\n`;
      if (typeof transcript.summary === "string") {
        context += transcript.summary;
      } else if (typeof transcript.summary === "object") {
        if (transcript.summary.overview) {
          context += `\n**Overview**: ${transcript.summary.overview}\n`;
        }
        if (transcript.summary.keywords && Array.isArray(transcript.summary.keywords)) {
          context += `\n**Keywords**: ${transcript.summary.keywords.join(", ")}\n`;
        }
        if (transcript.summary.action_items && Array.isArray(transcript.summary.action_items)) {
          context += `\n**Action Items**:\n`;
          transcript.summary.action_items.forEach((item: string) => {
            context += `- ${item}\n`;
          });
        }
        if (transcript.summary.outline && Array.isArray(transcript.summary.outline)) {
          context += `\n**Discussion Outline**:\n`;
          transcript.summary.outline.forEach((item: string) => {
            context += `- ${item}\n`;
          });
        }
        if (transcript.summary.shorthand_bullet && Array.isArray(transcript.summary.shorthand_bullet)) {
          context += `\n**Key Points**:\n`;
          transcript.summary.shorthand_bullet.forEach((item: string) => {
            context += `- ${item}\n`;
          });
        }
      }
    }

    // Add conversation sentences (limited to avoid token overflow)
    if (transcript.sentences && Array.isArray(transcript.sentences)) {
      const sentences = transcript.sentences.slice(0, 100); // Limit to first 100 sentences
      context += `\n### Conversation Transcript (First ${sentences.length} exchanges)\n`;
      sentences.forEach((s: { speaker_name?: string; text?: string }) => {
        context += `**${s.speaker_name || "Unknown"}**: ${s.text || ""}\n`;
      });
      if (transcript.sentences.length > 100) {
        context += `\n... and ${transcript.sentences.length - 100} more exchanges.\n`;
      }
    }

    return context;
  } catch (error) {
    console.error("Error fetching call context:", error);
    return "Error loading call data.";
  }
}

// Fetch company context
async function fetchCompanyContext(companyId: string): Promise<string> {
  try {
    const { data: company } = await getSupabaseAdmin()
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (!company) {
      return "No company data found for the selected company.";
    }

    let context = `
## COMPANY DATA

### Company Details
- **Name**: ${company.company_name || "Unknown Company"}
- **Domain**: ${company.domain || "Unknown"}
- **Created**: ${company.created_at ? new Date(company.created_at).toLocaleDateString() : "Unknown"}
`;

    // Add goal/objective
    if (company.company_goal_objective) {
      context += `\n### Company Goal/Objective\n${company.company_goal_objective}\n`;
    }

    // Add pain points
    if (company.pain_points && Array.isArray(company.pain_points)) {
      context += `\n### Pain Points\n`;
      company.pain_points.forEach((point: string) => {
        context += `- ${point}\n`;
      });
    }

    // Add contacts
    if (company.company_contacts && Array.isArray(company.company_contacts)) {
      context += `\n### Contacts\n`;
      company.company_contacts.forEach((contact: { name?: string; email?: string; title?: string; phone?: string }) => {
        context += `- **${contact.name || "Unknown"}**`;
        if (contact.title) context += ` - ${contact.title}`;
        if (contact.email) context += ` (${contact.email})`;
        if (contact.phone) context += ` | ${contact.phone}`;
        context += `\n`;
      });
    }

    // Add AI recommendations
    if (company.ai_recommendations && Array.isArray(company.ai_recommendations)) {
      context += `\n### AI Recommendations\n`;
      company.ai_recommendations.forEach((rec: string) => {
        context += `- ${rec}\n`;
      });
    }

    // Add risk summary
    if (company.risk_summary && Array.isArray(company.risk_summary)) {
      context += `\n### Risk Summary\n`;
      company.risk_summary.forEach((risk: string) => {
        context += `- ${risk}\n`;
      });
    }

    // Add relationship insights
    if (company.ai_relationship && Array.isArray(company.ai_relationship)) {
      context += `\n### Relationship Insights\n`;
      company.ai_relationship.forEach((insight: string) => {
        context += `- ${insight}\n`;
      });
    }

    // Fetch associated calls
    const { data: companyCalls } = await getSupabaseAdmin()
      .from("company_calls")
      .select("transcript_id, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (companyCalls && companyCalls.length > 0) {
      // Fetch transcript details
      const transcriptIds = companyCalls.map((c) => c.transcript_id);
      const { data: transcripts } = await getSupabaseAdmin()
        .from("transcripts")
        .select("id, title, duration, ai_overall_score, created_at")
        .in("id", transcriptIds);

      if (transcripts && transcripts.length > 0) {
        context += `\n### Recent Calls (${transcripts.length} calls)\n`;
        transcripts.forEach((t) => {
          context += `- **${t.title || "Untitled"}** - ${formatDuration(t.duration)} - Score: ${t.ai_overall_score !== null ? `${t.ai_overall_score}/100` : "N/A"} - ${t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}\n`;
        });

        // Calculate average score
        const scoredCalls = transcripts.filter((t) => t.ai_overall_score !== null);
        if (scoredCalls.length > 0) {
          const avgScore = scoredCalls.reduce((sum, t) => sum + (t.ai_overall_score || 0), 0) / scoredCalls.length;
          context += `\n**Average Call Score**: ${avgScore.toFixed(1)}/100\n`;
        }
      }
    }

    return context;
  } catch (error) {
    console.error("Error fetching company context:", error);
    return "Error loading company data.";
  }
}

// Build system prompt
function buildSystemPrompt(contextData: string, contextType: "call" | "company"): string {
  const contextDescription = contextType === "call"
    ? "a sales call transcript with analysis"
    : "a company profile with related call history";

  return `# Sales Intelligence Assistant

You are an expert sales intelligence assistant helping analyze ${contextDescription}. You have access to detailed data about the selected ${contextType}.

## Your Capabilities
- Analyze call transcripts and identify key insights
- Evaluate sales performance and scoring
- Identify deal risks and qualification gaps
- Provide actionable recommendations
- Answer questions about specific details in the data

## Communication Style
- Be direct and actionable
- Reference specific data points from the context
- Prioritize insights that can improve sales outcomes
- Use markdown formatting for clarity
- Be concise but thorough

## Context Data
${contextData}

---

## Guidelines
1. Always reference specific data when answering questions
2. If asked about something not in the context, acknowledge the limitation
3. Provide actionable insights when relevant
4. Be helpful and professional
5. When analyzing calls, focus on sales effectiveness and customer engagement
6. When analyzing companies, focus on relationship health and opportunities
`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      messages,
      model: modelId = "gpt-4o",
      contextType,
      contextId,
      userId,
    }: {
      messages: UIMessage[];
      model?: string;
      contextType?: "call" | "company";
      contextId?: string;
      userId?: string;
    } = body;

    console.log("[Agent] Request received:", {
      modelId,
      contextType,
      contextId,
      messageCount: messages?.length,
    });

    // Fetch context based on selection
    let contextData = "";
    if (contextType && contextId) {
      if (contextType === "call") {
        contextData = await fetchCallContext(contextId);
      } else if (contextType === "company") {
        contextData = await fetchCompanyContext(contextId);
      }
    } else {
      contextData = "No context selected. Please select a call or company to analyze.";
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(contextData, contextType || "call");

    // Get the model
    const model = getOpenAIModel(modelId);
    console.log("[Agent] Using model:", modelId);

    const result = streamText({
      model,
      messages: convertToModelMessages(messages),
      system: systemPrompt,
      onFinish: async ({ usage }) => {
        // Track token usage with OpenMeter
        if (userId && usage) {
          try {
            await trackAgentRequest({
              userId,
              companyId: contextType === "company" ? contextId : undefined,
              promptTokens: usage.inputTokens || 0,
              completionTokens: usage.outputTokens || 0,
              model: modelId,
            });
            console.log("[Agent] Usage tracked:", {
              userId,
              promptTokens: usage.inputTokens,
              completionTokens: usage.outputTokens,
            });
          } catch (trackError) {
            console.error("[Agent] Failed to track usage:", trackError);
          }
        }
      },
    });

    // Return streaming response
    return result.toUIMessageStreamResponse({
      sendSources: true,
      sendReasoning: true,
    });
  } catch (error) {
    console.error("Agent API Error:", error);
    return new Response(
      JSON.stringify({
        error: "An error occurred while processing your request.",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
