import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { getOpenAIModel } from "@/lib/openai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { trackAgentRequest } from "@/lib/openmeter";
import { getRelevantContext } from "@/lib/embeddings";
import { getSystemPromptForPage, type PageType } from "@/lib/agent-prompts";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

// Helper to log agent runs to the database
async function logAgentRun(
  supabase: SupabaseClient,
  runData: {
    agent_type: string;
    prompt_sent: string;
    system_prompt: string;
    user_message: string;
    output: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    transcript_id?: number;
    company_id?: string;
    user_id?: string;
    context_type: string;
    duration_ms: number;
    status: string;
    error_message?: string;
  }
) {
  try {
    const { error } = await supabase.from("agent_runs").insert({
      agent_type: runData.agent_type,
      prompt_sent: runData.prompt_sent,
      system_prompt: runData.system_prompt,
      user_message: runData.user_message,
      output: runData.output,
      model: runData.model,
      prompt_tokens: runData.prompt_tokens,
      completion_tokens: runData.completion_tokens,
      transcript_id: runData.transcript_id || null,
      company_id: runData.company_id || null,
      user_id: runData.user_id || null,
      context_type: runData.context_type,
      duration_ms: runData.duration_ms,
      status: runData.status,
      error_message: runData.error_message || null,
    });

    if (error) {
      console.error("[Agent] Failed to log run:", error);
    } else {
      console.log("[Agent] Run logged successfully");
    }
  } catch (err) {
    console.error("[Agent] Error logging run:", err);
  }
}

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

// Simple in-memory TTL cache for context data
const contextCache = new Map<string, { data: string; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedContext(key: string): string | null {
  const entry = contextCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    contextCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedContext(key: string, data: string): void {
  // Limit cache size to prevent memory leaks
  if (contextCache.size >= 100) {
    const oldestKey = contextCache.keys().next().value;
    if (oldestKey) contextCache.delete(oldestKey);
  }
  contextCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
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
    const cacheKey = `call:${callId}`;
    const cached = getCachedContext(cacheKey);
    if (cached) {
      console.log("[Agent] Cache hit for call context:", callId);
      return cached;
    }

    console.log("[Agent] Fetching call context for ID:", callId);
    const { data: transcript, error } = await getSupabaseAdmin()
      .from("transcripts")
      .select("*")
      .eq("id", callId)
      .single();

    if (error) {
      console.error("[Agent] Supabase error fetching transcript:", error);
      return `Error fetching call data: ${error.message}. Call ID: ${callId}`;
    }

    if (!transcript) {
      console.log("[Agent] No transcript found for ID:", callId);
      return `No call data found for the selected call (ID: ${callId}).`;
    }

    console.log("[Agent] Successfully fetched transcript:", transcript.title);

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

    setCachedContext(cacheKey, context);
    return context;
  } catch (error) {
    console.error("Error fetching call context:", error);
    return "Error loading call data.";
  }
}

// Fetch company context
async function fetchCompanyContext(companyId: string): Promise<string> {
  try {
    const cacheKey = `company:${companyId}`;
    const cached = getCachedContext(cacheKey);
    if (cached) {
      console.log("[Agent] Cache hit for company context:", companyId);
      return cached;
    }

    console.log("[Agent] Fetching company context for ID:", companyId);

    const { data: company, error } = await getSupabaseAdmin()
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (error) {
      console.error("[Agent] Supabase error fetching company:", error);
      return `Error fetching company data: ${error.message}. Company ID: ${companyId}`;
    }

    if (!company) {
      console.log("[Agent] No company found for ID:", companyId);
      return `No company data found for the selected company (ID: ${companyId}).`;
    }

    console.log("[Agent] Successfully fetched company:", company.company_name);

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

    setCachedContext(cacheKey, context);
    return context;
  } catch (error) {
    console.error("Error fetching company context:", error);
    return "Error loading company data.";
  }
}

// Build system prompt for legacy mode (specific call/company)
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

// Build system prompt for workspace mode (semantic search)
function buildWorkspaceSystemPrompt(contextData: string): string {
  return `# Sales Intelligence Assistant - Full Workspace Access

You are an expert sales intelligence assistant with access to the user's entire workspace of calls and company data. The context below contains the most relevant information from their workspace based on their question.

## Your Capabilities
- Access and analyze all call transcripts in the workspace
- Review company profiles and relationship history
- Cross-reference information across multiple calls and companies
- Identify patterns and trends across the sales pipeline
- Provide comprehensive, data-driven insights

## Communication Style
- Be direct and actionable
- Reference specific data points from the context
- When data comes from multiple sources, cite which call or company it's from
- Prioritize insights that can improve sales outcomes
- Use markdown formatting for clarity
- Be concise but thorough

## Relevant Context from Your Workspace
${contextData}

---

## Guidelines
1. The context above was automatically retrieved based on relevance to your question
2. Reference specific calls, companies, or data points when answering
3. If you need more specific information, ask clarifying questions
4. Identify patterns across multiple calls when relevant
5. Provide actionable insights and recommendations
6. If the context doesn't contain relevant information, acknowledge this and suggest what to look for
`;
}

// Fetch comprehensive database context for a user based on page type
async function fetchUserDatabaseContext(
  userId: string,
  pageType: PageType,
  pageContext?: { transcriptId?: number; companyId?: number; teamId?: number }
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const parts: string[] = [];

  try {
    // Page-specific data fetching
    switch (pageType) {
      case "dashboard": {
        // Fetch recent calls with scores
        const { data: recentCalls } = await supabase
          .from("transcripts")
          .select("id, title, ai_overall_score, duration, created_at, deal_signal, call_type")
          .eq("user_id", userId)
          .not("duration", "is", null)
          .gte("duration", 5)
          .order("created_at", { ascending: false })
          .limit(20);

        if (recentCalls && recentCalls.length > 0) {
          parts.push("### Recent Calls (Last 20)");
          let totalScore = 0;
          let scoredCount = 0;
          recentCalls.forEach((call) => {
            parts.push(`- **${call.title || "Untitled"}** (ID: ${call.id}) - Score: ${call.ai_overall_score ?? "N/A"}/100 - ${call.duration ? Math.round(call.duration) : "?"}min - ${call.deal_signal || "no signal"} - ${new Date(call.created_at).toLocaleDateString()}`);
            if (call.ai_overall_score != null) {
              totalScore += call.ai_overall_score;
              scoredCount++;
            }
          });
          if (scoredCount > 0) {
            parts.push(`\n**Average Score**: ${Math.round(totalScore / scoredCount)}/100`);
          }
        }

        // Fetch coaching notes
        const { data: notes } = await supabase
          .from("coaching_notes")
          .select("note, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (notes && notes.length > 0) {
          parts.push("\n### Recent Coaching Notes");
          notes.forEach((note) => {
            parts.push(`- ${note.note} (${new Date(note.created_at).toLocaleDateString()})`);
          });
        }
        break;
      }

      case "calls": {
        // Fetch all calls with analysis data
        const { data: allCalls } = await supabase
          .from("transcripts")
          .select("id, title, ai_overall_score, ai_category_breakdown, ai_improvement_areas, duration, created_at, deal_signal")
          .eq("user_id", userId)
          .not("duration", "is", null)
          .gte("duration", 5)
          .order("created_at", { ascending: false })
          .limit(50);

        if (allCalls && allCalls.length > 0) {
          parts.push(`### All Calls (${allCalls.length} calls)`);

          // Score distribution
          const high = allCalls.filter((c) => c.ai_overall_score && c.ai_overall_score >= 80).length;
          const medium = allCalls.filter((c) => c.ai_overall_score && c.ai_overall_score >= 60 && c.ai_overall_score < 80).length;
          const low = allCalls.filter((c) => c.ai_overall_score && c.ai_overall_score < 60).length;
          parts.push(`**Score Distribution**: High (80+): ${high}, Medium (60-79): ${medium}, Low (<60): ${low}`);

          // List calls
          allCalls.forEach((call) => {
            parts.push(`- **${call.title || "Untitled"}** (ID: ${call.id}) - ${call.ai_overall_score ?? "N/A"}/100 - ${call.deal_signal || "-"} - ${new Date(call.created_at).toLocaleDateString()}`);
          });
        }
        break;
      }

      case "call_detail": {
        if (pageContext?.transcriptId) {
          // Fetch full transcript data
          const { data: transcript } = await supabase
            .from("transcripts")
            .select("*")
            .eq("id", pageContext.transcriptId)
            .single();

          if (transcript) {
            parts.push(`### Call: ${transcript.title || "Untitled"}`);
            parts.push(`- **Score**: ${transcript.ai_overall_score ?? "N/A"}/100`);
            parts.push(`- **Duration**: ${transcript.duration ? Math.round(transcript.duration) : "?"}min`);
            parts.push(`- **Date**: ${new Date(transcript.created_at).toLocaleDateString()}`);
            parts.push(`- **Deal Signal**: ${transcript.deal_signal || "Not set"}`);
            parts.push(`- **Call Type**: ${transcript.call_type || "Not classified"}`);

            // Parse and add category breakdown
            const categoryBreakdown = parseJSON(transcript.ai_category_breakdown);
            if (categoryBreakdown && typeof categoryBreakdown === "object") {
              parts.push("\n### Score Breakdown by Category");
              Object.entries(categoryBreakdown).forEach(([key, value]) => {
                parts.push(`- **${key}**: ${value}`);
              });
            }

            // Parse and add AI analysis
            const aiAnalysis = parseJSON(transcript.ai_analysis);
            if (aiAnalysis && typeof aiAnalysis === "object") {
              parts.push("\n### AI Analysis");
              if (aiAnalysis.deal_signal_reason) parts.push(`**Deal Signal Reason**: ${aiAnalysis.deal_signal_reason}`);
              if (aiAnalysis.call_context_for_next_call) parts.push(`**Context for Next Call**: ${aiAnalysis.call_context_for_next_call}`);
              if (aiAnalysis.strengths && Array.isArray(aiAnalysis.strengths)) {
                parts.push("**Strengths**:");
                aiAnalysis.strengths.forEach((s: any) => parts.push(`- ${typeof s === "string" ? s : s.point || s.description || JSON.stringify(s)}`));
              }
              if (aiAnalysis.weaknesses && Array.isArray(aiAnalysis.weaknesses)) {
                parts.push("**Weaknesses**:");
                aiAnalysis.weaknesses.forEach((w: any) => parts.push(`- ${typeof w === "string" ? w : w.point || w.description || JSON.stringify(w)}`));
              }
            }

            // Deal risk alerts
            const riskAlerts = parseJSON(transcript.ai_deal_risk_alerts);
            if (riskAlerts && Array.isArray(riskAlerts) && riskAlerts.length > 0) {
              parts.push("\n### Deal Risk Alerts");
              riskAlerts.forEach((alert: any) => {
                const alertType = typeof alert === "string" ? alert : alert.type || alert.alert || "Alert";
                const desc = typeof alert === "object" ? alert.description || alert.how_to_address || "" : "";
                parts.push(`- **${alertType}**${desc ? `: ${desc}` : ""}`);
              });
            }

            // Next call game plan
            const gamePlan = parseJSON(transcript.ai_next_call_game_plan);
            if (gamePlan && Array.isArray(gamePlan) && gamePlan.length > 0) {
              parts.push("\n### Next Call Game Plan");
              gamePlan.forEach((item: any, i: number) => {
                const action = typeof item === "string" ? item : item.action || item.objective || item.text || JSON.stringify(item);
                parts.push(`${i + 1}. ${action}`);
              });
            }

            // Summary
            if (transcript.summary) {
              const summary = typeof transcript.summary === "string" ? transcript.summary : transcript.summary.overview || "";
              if (summary) {
                parts.push(`\n### Summary\n${summary}`);
              }
            }

            // Transcript sentences (limited)
            if (transcript.sentences && Array.isArray(transcript.sentences)) {
              parts.push(`\n### Conversation (${Math.min(transcript.sentences.length, 100)} of ${transcript.sentences.length} exchanges)`);
              transcript.sentences.slice(0, 100).forEach((s: any) => {
                parts.push(`**${s.speaker_name || "Unknown"}**: ${s.text || ""}`);
              });
            }
          }
        }
        break;
      }

      case "companies": {
        // Fetch user's company ID first
        const { data: userCompany } = await supabase
          .from("company")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (userCompany) {
          // Fetch all companies
          const { data: companies } = await supabase
            .from("companies")
            .select("*")
            .eq("company_id", userCompany.id)
            .order("created_at", { ascending: false });

          if (companies && companies.length > 0) {
            // Get call counts
            const companyIds = companies.map((c) => c.id);
            const { data: callCounts } = await supabase
              .from("company_calls")
              .select("company_id")
              .in("company_id", companyIds);

            const countMap: Record<number, number> = {};
            (callCounts || []).forEach((cc: any) => {
              countMap[cc.company_id] = (countMap[cc.company_id] || 0) + 1;
            });

            parts.push(`### Companies (${companies.length} total)`);

            // Aggregate pain points
            const allPainPoints: string[] = [];
            companies.forEach((company) => {
              const painPoints = parseJSON(company.pain_points);
              if (painPoints && Array.isArray(painPoints)) {
                allPainPoints.push(...painPoints);
              }
            });

            if (allPainPoints.length > 0) {
              parts.push("\n### Aggregated Pain Points");
              allPainPoints.slice(0, 20).forEach((pp) => parts.push(`- ${pp}`));
            }

            parts.push("\n### Company List");
            companies.forEach((company) => {
              const calls = countMap[company.id] || 0;
              const risks = parseJSON(company.ai_deal_risk_alerts);
              const hasRisks = risks && Array.isArray(risks) && risks.length > 0;
              parts.push(`- **${company.company_name}** (ID: ${company.id}) - ${calls} calls - ${hasRisks ? "AT RISK" : "OK"}`);

              const painPoints = parseJSON(company.pain_points);
              if (painPoints && Array.isArray(painPoints) && painPoints.length > 0) {
                parts.push(`  Pain points: ${painPoints.slice(0, 3).join(", ")}`);
              }
            });
          }
        }
        break;
      }

      case "company_detail": {
        if (pageContext?.companyId) {
          const { data: company } = await supabase
            .from("companies")
            .select("*")
            .eq("id", pageContext.companyId)
            .single();

          if (company) {
            parts.push(`### Company: ${company.company_name}`);
            parts.push(`- **Domain**: ${company.domain || "N/A"}`);
            if (company.company_goal_objective) {
              parts.push(`- **Goal/Objective**: ${company.company_goal_objective}`);
            }

            // Pain points
            const painPoints = parseJSON(company.pain_points);
            if (painPoints && Array.isArray(painPoints) && painPoints.length > 0) {
              parts.push("\n### Pain Points");
              painPoints.forEach((pp: string) => parts.push(`- ${pp}`));
            }

            // Contacts
            const contacts = parseJSON(company.company_contacts);
            if (contacts && Array.isArray(contacts) && contacts.length > 0) {
              parts.push("\n### Contacts");
              contacts.forEach((c: any) => {
                parts.push(`- **${c.name || "Unknown"}** - ${c.title || "N/A"} (${c.email || "no email"})`);
              });
            }

            // Risk alerts
            const risks = parseJSON(company.ai_deal_risk_alerts);
            if (risks && Array.isArray(risks) && risks.length > 0) {
              parts.push("\n### Deal Risk Alerts");
              risks.forEach((r: any) => {
                const type = typeof r === "string" ? r : r.type || r.alert || "Risk";
                const desc = typeof r === "object" ? r.description || r.how_to_address || "" : "";
                parts.push(`- **${type}**${desc ? `: ${desc}` : ""}`);
              });
            }

            // AI recommendations
            const recommendations = parseJSON(company.ai_recommendations);
            if (recommendations && Array.isArray(recommendations) && recommendations.length > 0) {
              parts.push("\n### AI Recommendations");
              recommendations.forEach((r: string) => parts.push(`- ${r}`));
            }

            // Relationship insights
            const relationship = parseJSON(company.ai_relationship);
            if (relationship && Array.isArray(relationship) && relationship.length > 0) {
              parts.push("\n### Relationship Insights");
              relationship.forEach((r: string) => parts.push(`- ${r}`));
            }

            // Fetch related calls
            const { data: companyCalls } = await supabase
              .from("company_calls")
              .select("transcript_id, created_at")
              .eq("company_id", pageContext.companyId)
              .order("created_at", { ascending: false })
              .limit(10);

            if (companyCalls && companyCalls.length > 0) {
              const transcriptIds = companyCalls.map((cc) => cc.transcript_id);
              const { data: transcripts } = await supabase
                .from("transcripts")
                .select("id, title, ai_overall_score, duration, created_at")
                .in("id", transcriptIds);

              if (transcripts && transcripts.length > 0) {
                parts.push(`\n### Recent Calls (${transcripts.length})`);
                transcripts.forEach((t) => {
                  parts.push(`- **${t.title || "Untitled"}** (ID: ${t.id}) - ${t.ai_overall_score ?? "N/A"}/100 - ${new Date(t.created_at).toLocaleDateString()}`);
                });
              }
            }
          }
        }
        break;
      }

      case "team": {
        // Fetch user's team
        const { data: userTeam } = await supabase
          .from("teams")
          .select("*")
          .contains("members", [userId])
          .single();

        if (userTeam) {
          parts.push(`### Team: ${userTeam.team_name}`);
          parts.push(`- **Members**: ${userTeam.members?.length || 0}`);

          // Fetch member details
          if (userTeam.members && userTeam.members.length > 0) {
            const { data: members } = await supabase
              .from("users")
              .select("id, name, email")
              .in("id", userTeam.members);

            if (members) {
              // For each member, get their call stats
              parts.push("\n### Team Members Performance");
              for (const member of members) {
                const { data: memberCalls } = await supabase
                  .from("transcripts")
                  .select("ai_overall_score")
                  .eq("user_id", member.id)
                  .not("duration", "is", null)
                  .gte("duration", 5);

                const callCount = memberCalls?.length || 0;
                const avgScore = callCount > 0
                  ? Math.round(
                      (memberCalls || [])
                        .filter((c) => c.ai_overall_score != null)
                        .reduce((sum, c) => sum + (c.ai_overall_score || 0), 0) /
                      (memberCalls || []).filter((c) => c.ai_overall_score != null).length
                    )
                  : 0;

                parts.push(`- **${member.name || member.email}** - ${callCount} calls - Avg score: ${avgScore}/100`);
              }
            }
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error("[Agent] Error fetching database context:", error);
    parts.push("Error fetching some data from database.");
  }

  return parts.join("\n");
}

// Helper to safely parse JSON fields
function parseJSON(data: unknown): any {
  if (!data) return null;
  if (typeof data === "object") return data;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const body = await req.json();

    const {
      messages,
      model: modelId = "gpt-4o",
      contextType,
      contextId,
      userId,
      useSemanticSearch = false,
      pageType, // NEW: Page type for enhanced context
      pageContext, // NEW: Page-specific context (transcriptId, companyId, etc.)
    }: {
      messages: UIMessage[];
      model?: string;
      contextType?: "call" | "company" | "workspace";
      contextId?: string;
      userId?: string;
      useSemanticSearch?: boolean;
      pageType?: PageType;
      pageContext?: { transcriptId?: number; companyId?: number; teamId?: number };
    } = body;

    console.log("[Agent] Request received:", {
      modelId,
      contextType,
      contextId,
      pageType,
      messageCount: messages?.length,
      useSemanticSearch,
      bodyKeys: Object.keys(body),
    });

    // Fetch context based on mode
    let contextData = "";
    let systemPrompt = "";

    // Extract the user's query from the last message (needed for semantic search)
    const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
    let userQuery = "";
    if (lastMessage) {
      if ('content' in lastMessage && typeof (lastMessage as { content?: unknown }).content === "string") {
        userQuery = (lastMessage as { content: string }).content;
      } else if ('parts' in lastMessage && Array.isArray(lastMessage.parts)) {
        const textParts = lastMessage.parts.filter(
          (p): p is { type: 'text'; text: string } =>
            p !== null && typeof p === 'object' && 'type' in p && p.type === 'text' && 'text' in p
        );
        userQuery = textParts.map(p => p.text).join(" ");
      } else {
        userQuery = JSON.stringify(lastMessage);
      }
    }

    // NEW: Enhanced page-specific mode with full database access
    if (pageType && userId) {
      console.log("[Agent] Using enhanced page-specific mode:", pageType);

      // 1. Fetch direct database context for the page
      const dbContext = await fetchUserDatabaseContext(userId, pageType, pageContext);
      console.log("[Agent] Database context length:", dbContext.length);

      // 2. Also fetch semantic search results for additional context
      let semanticContext = "";
      try {
        semanticContext = await getRelevantContext(userId, userQuery, 5);
        console.log("[Agent] Semantic context length:", semanticContext.length);
      } catch (err) {
        console.warn("[Agent] Semantic search unavailable:", err);
      }

      // 3. Combine contexts
      const combinedContext = [dbContext, semanticContext].filter(Boolean).join("\n\n---\n\n");

      // 4. Get page-specific system prompt
      systemPrompt = getSystemPromptForPage(pageType, pageContext, combinedContext);
    }
    // Workspace mode with semantic search
    else if (useSemanticSearch || contextType === "workspace") {
      if (!userId) {
        throw new Error("userId is required for semantic search mode");
      }

      console.log("[Agent] Using semantic search for query:", userQuery.slice(0, 100));

      try {
        contextData = await getRelevantContext(userId, userQuery, 8);
        console.log("[Agent] Semantic search returned context length:", contextData.length);
      } catch (searchError) {
        console.error("[Agent] Semantic search failed:", searchError);
        contextData = "No indexed content found. Your workspace may need to be indexed first. Please contact support.";
      }

      systemPrompt = buildWorkspaceSystemPrompt(contextData);
    }
    // Legacy mode: specific call or company
    else if (contextType && contextId) {
      console.log("[Agent] Fetching context for:", contextType, contextId);
      if (contextType === "call") {
        contextData = await fetchCallContext(contextId);
      } else if (contextType === "company") {
        contextData = await fetchCompanyContext(contextId);
      }
      console.log("[Agent] Context data length:", contextData.length);
      systemPrompt = buildSystemPrompt(contextData, contextType);
    }
    // No context provided - try to use userId for basic workspace access
    else if (userId) {
      console.log("[Agent] No specific context, using basic workspace mode for user:", userId);
      try {
        contextData = await getRelevantContext(userId, userQuery, 8);
      } catch {
        contextData = "Limited context available. Try asking about specific calls or companies.";
      }
      systemPrompt = buildWorkspaceSystemPrompt(contextData);
    }
    // Truly no context
    else {
      console.log("[Agent] No context provided - contextType:", contextType, "contextId:", contextId);
      contextData = `No context selected. Please select a call or company to analyze.`;
      systemPrompt = buildSystemPrompt(contextData, "call");
    }

    // Get the last user message for logging - reuses lastMessage defined above
    const lastUserMessage = lastMessage
      ? ('content' in lastMessage ? lastMessage.content : JSON.stringify(lastMessage))
      : "";
    const userMessageText = typeof lastUserMessage === "string"
      ? lastUserMessage
      : JSON.stringify(lastUserMessage);

    // Get the model
    const model = getOpenAIModel(modelId);
    console.log("[Agent] Using model:", modelId);

    const result = streamText({
      model,
      messages: convertToModelMessages(messages),
      system: systemPrompt,
      onFinish: async ({ text, usage }) => {
        const durationMs = Date.now() - startTime;

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

        // Log the agent run to the database
        try {
          await logAgentRun(getSupabaseAdmin(), {
            agent_type: "sales_intelligence",
            prompt_sent: systemPrompt + "\n\nUser: " + userMessageText,
            system_prompt: systemPrompt,
            user_message: userMessageText,
            output: text || "",
            model: modelId,
            prompt_tokens: usage?.inputTokens || 0,
            completion_tokens: usage?.outputTokens || 0,
            transcript_id: contextType === "call" && contextId ? parseInt(contextId) : undefined,
            company_id: contextType === "company" ? contextId : undefined,
            user_id: userId,
            context_type: contextType || "general",
            duration_ms: durationMs,
            status: "completed",
          });
        } catch (logError) {
          console.error("[Agent] Failed to log run:", logError);
        }
      },
    });

    // Return streaming response
    return result.toUIMessageStreamResponse({
      sendSources: true,
      sendReasoning: true,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error("Agent API Error:", error);

    // Log the error run
    try {
      const body = await req.clone().json().catch(() => ({}));
      await logAgentRun(getSupabaseAdmin(), {
        agent_type: "sales_intelligence",
        prompt_sent: "Error occurred before prompt was built",
        system_prompt: "",
        user_message: "",
        output: "",
        model: body.model || "gpt-4o",
        prompt_tokens: 0,
        completion_tokens: 0,
        user_id: body.userId,
        context_type: body.contextType || "general",
        duration_ms: durationMs,
        status: "error",
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    } catch {
      // Ignore logging errors
    }

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
