import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createClient(url, key);
}

// GET aggregated statistics for agent runs
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const agentType = searchParams.get("agent_type");

    // Get overall stats
    let statsQuery = supabase
      .from("agent_runs")
      .select("*", { count: "exact", head: false });

    if (startDate) statsQuery = statsQuery.gte("created_at", startDate);
    if (endDate) statsQuery = statsQuery.lte("created_at", endDate);
    if (agentType) statsQuery = statsQuery.eq("agent_type", agentType);

    const { data: runs, count, error } = await statsQuery;

    if (error) {
      console.error("[Agent Runs Stats API] Error fetching stats:", error);
      return NextResponse.json(
        { error: "Failed to fetch stats", details: error.message },
        { status: 500 }
      );
    }

    // Calculate aggregates
    const totalRuns = count || 0;
    const totalPromptTokens = runs?.reduce((sum, r) => sum + (r.prompt_tokens || 0), 0) || 0;
    const totalCompletionTokens = runs?.reduce((sum, r) => sum + (r.completion_tokens || 0), 0) || 0;
    const totalTokens = totalPromptTokens + totalCompletionTokens;
    const totalCost = runs?.reduce((sum, r) => sum + parseFloat(r.total_cost || "0"), 0) || 0;
    const avgDuration = runs?.length
      ? runs.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / runs.length
      : 0;
    const errorCount = runs?.filter(r => r.status === "error").length || 0;
    const bestCount = runs?.filter(r => r.is_best).length || 0;

    // Group by model
    const byModel: Record<string, { count: number; tokens: number; cost: number }> = {};
    runs?.forEach(r => {
      if (!byModel[r.model]) {
        byModel[r.model] = { count: 0, tokens: 0, cost: 0 };
      }
      byModel[r.model].count++;
      byModel[r.model].tokens += (r.prompt_tokens || 0) + (r.completion_tokens || 0);
      byModel[r.model].cost += parseFloat(r.total_cost || "0");
    });

    // Group by agent type
    const byAgentType: Record<string, { count: number; tokens: number; cost: number }> = {};
    runs?.forEach(r => {
      if (!byAgentType[r.agent_type]) {
        byAgentType[r.agent_type] = { count: 0, tokens: 0, cost: 0 };
      }
      byAgentType[r.agent_type].count++;
      byAgentType[r.agent_type].tokens += (r.prompt_tokens || 0) + (r.completion_tokens || 0);
      byAgentType[r.agent_type].cost += parseFloat(r.total_cost || "0");
    });

    // Group by date (last 30 days)
    const byDate: Record<string, { count: number; tokens: number; cost: number }> = {};
    runs?.forEach(r => {
      const date = new Date(r.created_at).toISOString().split("T")[0];
      if (!byDate[date]) {
        byDate[date] = { count: 0, tokens: 0, cost: 0 };
      }
      byDate[date].count++;
      byDate[date].tokens += (r.prompt_tokens || 0) + (r.completion_tokens || 0);
      byDate[date].cost += parseFloat(r.total_cost || "0");
    });

    return NextResponse.json({
      summary: {
        totalRuns,
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        totalCost: totalCost.toFixed(4),
        avgDurationMs: Math.round(avgDuration),
        errorCount,
        errorRate: totalRuns > 0 ? ((errorCount / totalRuns) * 100).toFixed(2) + "%" : "0%",
        bestCount,
      },
      byModel: Object.entries(byModel).map(([model, stats]) => ({
        model,
        ...stats,
        cost: stats.cost.toFixed(4),
      })),
      byAgentType: Object.entries(byAgentType).map(([type, stats]) => ({
        agentType: type,
        ...stats,
        cost: stats.cost.toFixed(4),
      })),
      byDate: Object.entries(byDate)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 30)
        .map(([date, stats]) => ({
          date,
          ...stats,
          cost: stats.cost.toFixed(4),
        })),
    });
  } catch (error) {
    console.error("[Agent Runs Stats API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
