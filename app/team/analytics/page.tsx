"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabaseClient";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Phone,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  Download,
  FileText,
  FileSpreadsheet,
  File,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Building2,
  AlertTriangle,
  Trophy,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart";
import { toast } from "sonner";

const COLORS = {
  excellent: "#22c55e",
  good: "#3b82f6",
  needsWork: "#eab308",
  poor: "#ef4444",
};

const TOP_PERFORMER_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
];

const CATEGORY_LABELS: Record<string, string> = {
  call_setup_control: "Call Setup",
  discovery_qualification: "Discovery",
  active_listening: "Listening",
  value_communication: "Value Comm",
  next_steps_momentum: "Next Steps",
  objection_handling: "Objections",
};

const chartConfig = {
  score: {
    label: "Score",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

export default function TeamAnalyticsPage() {
  const router = useRouter();

  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [allTranscripts, setAllTranscripts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyCalls, setCompanyCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination states
  const [callsPerRepPage, setCallsPerRepPage] = useState(1);
  const [repComparisonPage, setRepComparisonPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get team
      const { data: teamRow } = await supabase
        .from("teams")
        .select("*")
        .contains("members", [user.id])
        .limit(1)
        .maybeSingle();

      if (!teamRow) {
        setLoading(false);
        return;
      }

      setTeam(teamRow);

      // Get all team members
      if (teamRow.members?.length > 0) {
        const { data: memberData } = await supabase
          .from("users")
          .select("id, name, email")
          .in("id", teamRow.members);
        setMembers(memberData || []);

        // Get all transcripts for team members
        const { data: transcriptData } = await supabase
          .from("transcripts")
          .select("*")
          .in("user_id", teamRow.members)
          .order("created_at", { ascending: false });
        setAllTranscripts(transcriptData || []);
      }

      // Get companies
      const { data: companyData } = await supabase
        .from("companies")
        .select("*");
      setCompanies(companyData || []);

      // Get company calls
      const { data: callsData } = await supabase
        .from("company_calls")
        .select("*");
      setCompanyCalls(callsData || []);

      setLoading(false);
    }

    load();
  }, []);

  // Team Stats
  const teamStats = useMemo(() => {
    const totalCalls = allTranscripts.length;

    const scoredTranscripts = allTranscripts.filter(
      (t) => t.ai_overall_score != null && !isNaN(t.ai_overall_score)
    );

    const avgScore = scoredTranscripts.length > 0
      ? Math.round(
          scoredTranscripts.reduce((acc, t) => acc + Number(t.ai_overall_score), 0) /
          scoredTranscripts.length
        )
      : 0;

    // Score trend (last 30 days vs previous 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recent = scoredTranscripts.filter(
      (t) => new Date(t.created_at) >= thirtyDaysAgo
    );
    const older = scoredTranscripts.filter(
      (t) => new Date(t.created_at) >= sixtyDaysAgo && new Date(t.created_at) < thirtyDaysAgo
    );

    const recentAvg = recent.length > 0
      ? recent.reduce((acc, t) => acc + Number(t.ai_overall_score), 0) / recent.length
      : 0;
    const olderAvg = older.length > 0
      ? older.reduce((acc, t) => acc + Number(t.ai_overall_score), 0) / older.length
      : recentAvg;

    const trend = olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;

    // Avg per rep
    const avgPerRep = members.length > 0 ? Math.round(totalCalls / members.length) : 0;

    return { totalCalls, avgScore, trend, avgPerRep };
  }, [allTranscripts, members]);

  // Score trends over time
  const scoreTrendsData = useMemo(() => {
    const byDate: Record<string, { total: number; count: number }> = {};

    allTranscripts
      .filter((t) => t.ai_overall_score != null && t.created_at)
      .forEach((t) => {
        const date = new Date(t.created_at).toLocaleDateString();
        if (!byDate[date]) {
          byDate[date] = { total: 0, count: 0 };
        }
        byDate[date].total += Number(t.ai_overall_score);
        byDate[date].count += 1;
      });

    return Object.entries(byDate)
      .map(([date, { total, count }]) => ({
        date,
        score: Math.round(total / count),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30);
  }, [allTranscripts]);

  // Top 5 performers
  const topPerformers = useMemo(() => {
    const memberScores = members.map((member) => {
      const memberTranscripts = allTranscripts.filter(
        (t) => t.user_id === member.id && t.ai_overall_score != null
      );

      const avgScore = memberTranscripts.length > 0
        ? Math.round(
            memberTranscripts.reduce((acc, t) => acc + Number(t.ai_overall_score), 0) /
            memberTranscripts.length
          )
        : 0;

      return {
        ...member,
        avgScore,
        totalCalls: memberTranscripts.length,
      };
    });

    return memberScores
      .filter((m) => m.totalCalls > 0)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);
  }, [members, allTranscripts]);

  // Calls per rep data
  const callsPerRepData = useMemo(() => {
    return members.map((member) => {
      const memberTranscripts = allTranscripts.filter((t) => t.user_id === member.id);
      const scoredTranscripts = memberTranscripts.filter(
        (t) => t.ai_overall_score != null
      );
      const avgScore = scoredTranscripts.length > 0
        ? Math.round(
            scoredTranscripts.reduce((acc, t) => acc + Number(t.ai_overall_score), 0) /
            scoredTranscripts.length
          )
        : 0;

      return {
        ...member,
        totalCalls: memberTranscripts.length,
        avgScore,
      };
    }).sort((a, b) => b.totalCalls - a.totalCalls);
  }, [members, allTranscripts]);

  // Category performance
  const categoryPerformance = useMemo(() => {
    const categories: Record<string, { total: number; count: number }> = {};

    allTranscripts.forEach((t) => {
      if (t.ai_category_breakdown) {
        Object.entries(t.ai_category_breakdown).forEach(([key, value]: any) => {
          if (!categories[key]) {
            categories[key] = { total: 0, count: 0 };
          }
          categories[key].total += value.score || 0;
          categories[key].count += 1;
        });
      }
    });

    return Object.entries(categories).map(([key, { total, count }]) => ({
      category: CATEGORY_LABELS[key] || key,
      score: count > 0 ? Math.round(total / count) : 0,
    }));
  }, [allTranscripts]);

  // Score distribution
  const scoreDistribution = useMemo(() => {
    const distribution = { excellent: 0, good: 0, needsWork: 0, poor: 0 };

    allTranscripts
      .filter((t) => t.ai_overall_score != null)
      .forEach((t) => {
        const score = Number(t.ai_overall_score);
        if (score >= 80) distribution.excellent++;
        else if (score >= 60) distribution.good++;
        else if (score >= 40) distribution.needsWork++;
        else distribution.poor++;
      });

    return [
      { name: "Excellent (80-100)", value: distribution.excellent, color: COLORS.excellent },
      { name: "Good (60-79)", value: distribution.good, color: COLORS.good },
      { name: "Needs Work (40-59)", value: distribution.needsWork, color: COLORS.needsWork },
      { name: "Poor (0-39)", value: distribution.poor, color: COLORS.poor },
    ];
  }, [allTranscripts]);

  // Rep performance comparison
  const repPerformance = useMemo(() => {
    return members.map((member) => {
      const memberTranscripts = allTranscripts.filter((t) => t.user_id === member.id);
      const scoredTranscripts = memberTranscripts.filter(
        (t) => t.ai_overall_score != null
      );

      const avgScore = scoredTranscripts.length > 0
        ? Math.round(
            scoredTranscripts.reduce((acc, t) => acc + Number(t.ai_overall_score), 0) /
            scoredTranscripts.length
          )
        : 0;

      // Best category
      const categoryScores: Record<string, { total: number; count: number }> = {};
      memberTranscripts.forEach((t) => {
        if (t.ai_category_breakdown) {
          Object.entries(t.ai_category_breakdown).forEach(([key, value]: any) => {
            if (!categoryScores[key]) {
              categoryScores[key] = { total: 0, count: 0 };
            }
            categoryScores[key].total += value.score || 0;
            categoryScores[key].count += 1;
          });
        }
      });

      let bestCategory = "N/A";
      let needsImprovement = "N/A";
      let bestScore = 0;
      let worstScore = 100;

      Object.entries(categoryScores).forEach(([key, { total, count }]) => {
        const avg = count > 0 ? total / count : 0;
        if (avg > bestScore) {
          bestScore = avg;
          bestCategory = CATEGORY_LABELS[key] || key;
        }
        if (avg < worstScore && count > 0) {
          worstScore = avg;
          needsImprovement = CATEGORY_LABELS[key] || key;
        }
      });

      return {
        ...member,
        totalCalls: memberTranscripts.length,
        avgScore,
        bestCategory,
        needsImprovement,
      };
    }).sort((a, b) => b.avgScore - a.avgScore);
  }, [members, allTranscripts]);

  // Company performance - top by call volume
  const topCompaniesByVolume = useMemo(() => {
    const companyCallCounts: Record<string, number> = {};
    companyCalls.forEach((call) => {
      companyCallCounts[call.company_id] = (companyCallCounts[call.company_id] || 0) + 1;
    });

    return companies
      .map((company) => ({
        ...company,
        callCount: companyCallCounts[company.id] || 0,
      }))
      .filter((c) => c.callCount > 0)
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 5);
  }, [companies, companyCalls]);

  // Companies with critical risks
  const criticalRiskCompanies = useMemo(() => {
    const companyRisks: Record<string, number> = {};

    allTranscripts.forEach((t) => {
      if (t.ai_deal_risk_alerts && t.ai_deal_risk_alerts.length > 0) {
        // Find company for this transcript
        const call = companyCalls.find((c) => c.transcript_id === t.fireflies_id);
        if (call) {
          companyRisks[call.company_id] = (companyRisks[call.company_id] || 0) + t.ai_deal_risk_alerts.length;
        }
      }
    });

    return companies
      .map((company) => ({
        ...company,
        riskCount: companyRisks[company.id] || 0,
      }))
      .filter((c) => c.riskCount > 0)
      .sort((a, b) => b.riskCount - a.riskCount)
      .slice(0, 5);
  }, [companies, companyCalls, allTranscripts]);

  // Pagination for calls per rep
  const callsPerRepPages = Math.ceil(callsPerRepData.length / pageSize);
  const paginatedCallsPerRep = callsPerRepData.slice(
    (callsPerRepPage - 1) * pageSize,
    callsPerRepPage * pageSize
  );

  // Pagination for rep comparison
  const repComparisonPages = Math.ceil(repPerformance.length / pageSize);
  const paginatedRepComparison = repPerformance.slice(
    (repComparisonPage - 1) * pageSize,
    repComparisonPage * pageSize
  );

  // Export functions
  const exportToCSV = () => {
    const headers = ["Name", "Email", "Total Calls", "Average Score", "Best Category", "Needs Improvement"];
    const rows = repPerformance.map((rep) => [
      rep.name || "No Name",
      rep.email,
      rep.totalCalls,
      rep.avgScore,
      rep.bestCategory,
      rep.needsImprovement,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  const exportToExcel = () => {
    // For Excel, we'll create a TSV (tab-separated values) which Excel can open
    const headers = ["Name", "Email", "Total Calls", "Average Score", "Best Category", "Needs Improvement"];
    const rows = repPerformance.map((rep) => [
      rep.name || "No Name",
      rep.email,
      rep.totalCalls,
      rep.avgScore,
      rep.bestCategory,
      rep.needsImprovement,
    ]);

    const tsvContent = [headers, ...rows]
      .map((row) => row.join("\t"))
      .join("\n");

    const blob = new Blob([tsvContent], { type: "application/vnd.ms-excel" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-analytics-${new Date().toISOString().split("T")[0]}.xls`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Excel file exported successfully");
  };

  const exportToPDF = () => {
    // Create a printable HTML document
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow pop-ups to export PDF");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Team Analytics Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; }
          .stats { display: flex; gap: 20px; margin-bottom: 20px; }
          .stat-card { padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        </style>
      </head>
      <body>
        <h1>Team Analytics Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>

        <div class="stats">
          <div class="stat-card">
            <h3>Total Calls</h3>
            <p>${teamStats.totalCalls}</p>
          </div>
          <div class="stat-card">
            <h3>Team Average Score</h3>
            <p>${teamStats.avgScore}</p>
          </div>
          <div class="stat-card">
            <h3>Score Trend</h3>
            <p>${teamStats.trend > 0 ? "+" : ""}${teamStats.trend}%</p>
          </div>
        </div>

        <h2>Rep Performance</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Total Calls</th>
              <th>Avg Score</th>
              <th>Best Category</th>
              <th>Needs Improvement</th>
            </tr>
          </thead>
          <tbody>
            ${repPerformance.map((rep) => `
              <tr>
                <td>${rep.name || "No Name"}</td>
                <td>${rep.email}</td>
                <td>${rep.totalCalls}</td>
                <td>${rep.avgScore}</td>
                <td>${rep.bestCategory}</td>
                <td>${rep.needsImprovement}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
    toast.success("PDF print dialog opened");
  };

  if (loading) {
    return (
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader heading="Team Analytics" />
          <div className="p-10 text-center text-muted-foreground">Loading...</div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!team) {
    return (
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader heading="Team Analytics" />
          <div className="p-10 text-center text-muted-foreground">
            No team found. Please create or join a team first.
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader heading="Team Analytics" />

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-6 py-6 px-4 lg:px-6 max-w-7xl mx-auto w-full">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{team.team_name} Analytics</h1>
                  <p className="text-sm text-muted-foreground">
                    Comprehensive performance insights for your team
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export Analytics
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportToPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToCSV}>
                      <File className="h-4 w-4 mr-2" />
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Export as Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
                  <CardHeader>
                    <CardDescription>Total Calls Analysed</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                      {teamStats.totalCalls}
                    </CardTitle>
                    <CardAction>
                      <Badge variant="outline">
                        <Phone className="h-3 w-3 mr-1" />
                        All Time
                      </Badge>
                    </CardAction>
                  </CardHeader>
                </Card>

                <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
                  <CardHeader>
                    <CardDescription>Team Average Score</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                      {teamStats.avgScore > 0 ? teamStats.avgScore : "—"}
                    </CardTitle>
                    <CardAction>
                      <Badge
                        variant="outline"
                        className={
                          teamStats.avgScore >= 80
                            ? "border-green-500/50 text-green-700"
                            : teamStats.avgScore >= 60
                            ? "border-yellow-500/50 text-yellow-700"
                            : "border-red-500/50 text-red-700"
                        }
                      >
                        {teamStats.avgScore >= 80 ? "Excellent" : teamStats.avgScore >= 60 ? "Good" : "Needs Work"}
                      </Badge>
                    </CardAction>
                  </CardHeader>
                </Card>

                <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
                  <CardHeader>
                    <CardDescription>Score Trend</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums flex items-center gap-2">
                      {teamStats.trend > 0 ? "+" : ""}{teamStats.trend}%
                      {teamStats.trend >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      )}
                    </CardTitle>
                    <CardAction>
                      <Badge variant="outline">vs last 30 days</Badge>
                    </CardAction>
                  </CardHeader>
                </Card>

                <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
                  <CardHeader>
                    <CardDescription>Avg Per Rep</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                      {teamStats.avgPerRep} calls
                    </CardTitle>
                    <CardAction>
                      <Badge variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        {members.length} reps
                      </Badge>
                    </CardAction>
                  </CardHeader>
                </Card>
              </div>

              {/* Score Trends Over Time */}
              <Card className="@container/card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Score Trends Over Time
                  </CardTitle>
                  <CardDescription>Daily average scores across the team</CardDescription>
                </CardHeader>
                <CardContent>
                  {scoreTrendsData.length === 0 ? (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                      No data available
                    </div>
                  ) : (
                    <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={scoreTrendsData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="var(--primary)"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Top 5 Performers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Top 5 Performers
                  </CardTitle>
                  <CardDescription>Highest average scores</CardDescription>
                </CardHeader>
                <CardContent>
                  {topPerformers.length === 0 ? (
                    <p className="text-muted-foreground">No data available</p>
                  ) : (
                    <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topPerformers} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={100}
                            tickFormatter={(value) => value || "No Name"}
                          />
                          <Tooltip />
                          <Bar dataKey="avgScore" radius={[0, 4, 4, 0]}>
                            {topPerformers.map((entry, index) => (
                              <Cell key={index} fill={TOP_PERFORMER_COLORS[index % TOP_PERFORMER_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Calls Per Rep */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Calls Per Rep
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team Member</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead className="text-right">Avg Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCallsPerRep.map((rep) => (
                        <TableRow key={rep.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {rep.name?.[0]?.toUpperCase() || rep.email?.[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{rep.name || "No Name"}</p>
                                <p className="text-xs text-muted-foreground">{rep.totalCalls} calls</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="w-[200px]">
                            <Progress
                              value={rep.avgScore}
                              className="h-2"
                              style={{
                                background: `linear-gradient(to right,
                                  ${rep.avgScore >= 80 ? COLORS.excellent : rep.avgScore >= 60 ? COLORS.good : rep.avgScore >= 40 ? COLORS.needsWork : COLORS.poor} ${rep.avgScore}%,
                                  #e5e7eb ${rep.avgScore}%)`,
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={
                                rep.avgScore >= 80
                                  ? "border-green-500/50 text-green-700"
                                  : rep.avgScore >= 60
                                  ? "border-yellow-500/50 text-yellow-700"
                                  : "border-red-500/50 text-red-700"
                              }
                            >
                              {rep.avgScore}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {callsPerRepData.length > pageSize && (
                    <div className="flex items-center justify-end gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCallsPerRepPage(1)}
                        disabled={callsPerRepPage === 1}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCallsPerRepPage((p) => Math.max(1, p - 1))}
                        disabled={callsPerRepPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {callsPerRepPage} of {callsPerRepPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCallsPerRepPage((p) => Math.min(callsPerRepPages, p + 1))}
                        disabled={callsPerRepPage === callsPerRepPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCallsPerRepPage(callsPerRepPages)}
                        disabled={callsPerRepPage === callsPerRepPages}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Category Performance
                    </CardTitle>
                    <CardDescription>Team average by skill category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {categoryPerformance.length === 0 ? (
                      <p className="text-muted-foreground">No data available</p>
                    ) : (
                      <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={categoryPerformance}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                            <Tooltip />
                            <Bar dataKey="score" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Score Distribution Pie */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Score Distribution
                    </CardTitle>
                    <CardDescription>Breakdown of call scores</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {scoreDistribution.every((d) => d.value === 0) ? (
                      <p className="text-muted-foreground">No data available</p>
                    ) : (
                      <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={scoreDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {scoreDistribution.map((entry, index) => (
                                <Cell key={index} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Rep Performance Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Rep Performance Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Total Calls</TableHead>
                        <TableHead>Avg Score</TableHead>
                        <TableHead>Best Category</TableHead>
                        <TableHead>Needs Improvement</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRepComparison.map((rep) => (
                        <TableRow key={rep.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {rep.name?.[0]?.toUpperCase() || rep.email?.[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{rep.name || "No Name"}</p>
                                <p className="text-xs text-muted-foreground">{rep.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{rep.totalCalls}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                rep.avgScore >= 80
                                  ? "border-green-500/50 text-green-700"
                                  : rep.avgScore >= 60
                                  ? "border-yellow-500/50 text-yellow-700"
                                  : "border-red-500/50 text-red-700"
                              }
                            >
                              {rep.avgScore}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{rep.bestCategory}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-amber-700 border-amber-500/50">
                              {rep.needsImprovement}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/team/member/${rep.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Profile
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {repPerformance.length > pageSize && (
                    <div className="flex items-center justify-end gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setRepComparisonPage(1)}
                        disabled={repComparisonPage === 1}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setRepComparisonPage((p) => Math.max(1, p - 1))}
                        disabled={repComparisonPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {repComparisonPage} of {repComparisonPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setRepComparisonPage((p) => Math.min(repComparisonPages, p + 1))}
                        disabled={repComparisonPage === repComparisonPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setRepComparisonPage(repComparisonPages)}
                        disabled={repComparisonPage === repComparisonPages}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Company Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Companies by Call Volume */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Top Companies by Call Volume
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topCompaniesByVolume.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No data available</p>
                    ) : (
                      <div className="space-y-3">
                        {topCompaniesByVolume.map((company, i) => (
                          <div
                            key={company.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                            onClick={() => router.push(`/companies/${company.id}`)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                                {i + 1}
                              </div>
                              <span className="font-medium">{company.company_name}</span>
                            </div>
                            <Badge variant="secondary">{company.callCount} calls</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Companies with Critical Risks */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-rose-500" />
                      Companies with Critical Risks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {criticalRiskCompanies.length === 0 ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <span>No critical risks detected</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {criticalRiskCompanies.map((company) => (
                          <div
                            key={company.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-rose-200/40 bg-rose-500/5 cursor-pointer hover:bg-rose-500/10 transition-colors"
                            onClick={() => router.push(`/companies/${company.id}`)}
                          >
                            <span className="font-medium">{company.company_name}</span>
                            <Badge variant="destructive">{company.riskCount} risks</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
