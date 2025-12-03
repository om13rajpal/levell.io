"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabaseClient";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  ArrowLeft,
  Phone,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Star,
  Brain,
  MessageSquare,
  Plus,
  History,
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

// Format duration (stored in minutes) to human readable format
function formatDuration(minutes?: number | null): string {
  if (!minutes) return "—";
  const m = Math.floor(minutes);
  if (m <= 0) return "—";
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h > 0) {
    return `${h}h ${mins}m`;
  }
  return `${mins}m`;
}

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

export default function TeamMemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;

  const [member, setMember] = useState<any>(null);
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [coachingNotes, setCoachingNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Add coaching note dialog
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Fetch member details
      const { data: memberData } = await supabase
        .from("users")
        .select("*")
        .eq("id", memberId)
        .single();

      // Fetch transcripts for this user
      const { data: transcriptData } = await supabase
        .from("transcripts")
        .select("*")
        .eq("user_id", memberId)
        .order("created_at", { ascending: false });

      // Fetch coaching notes
      const { data: notesData } = await supabase
        .from("coaching_notes")
        .select("*")
        .eq("user_id", memberId)
        .order("created_at", { ascending: false });

      setMember(memberData);
      setTranscripts(transcriptData || []);
      setCoachingNotes(notesData || []);
      setLoading(false);
    }

    load();
  }, [memberId]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalCalls = transcripts.length;

    const scoredTranscripts = transcripts.filter(
      (t) => t.ai_overall_score != null && !isNaN(t.ai_overall_score)
    );

    const avgScore = scoredTranscripts.length > 0
      ? Math.round(
          scoredTranscripts.reduce((acc, t) => acc + Number(t.ai_overall_score), 0) /
          scoredTranscripts.length
        )
      : 0;

    // Calculate performance trend (last 5 vs previous 5)
    const recentScores = scoredTranscripts.slice(0, 5);
    const olderScores = scoredTranscripts.slice(5, 10);

    const recentAvg = recentScores.length > 0
      ? recentScores.reduce((acc, t) => acc + Number(t.ai_overall_score), 0) / recentScores.length
      : 0;

    const olderAvg = olderScores.length > 0
      ? olderScores.reduce((acc, t) => acc + Number(t.ai_overall_score), 0) / olderScores.length
      : recentAvg;

    const trend = olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;

    // Calculate deal risk rate
    const riskyDeals = scoredTranscripts.filter(
      (t) => t.ai_deal_risk_alerts && t.ai_deal_risk_alerts.length > 0
    ).length;
    const dealRiskRate = scoredTranscripts.length > 0
      ? Math.round((riskyDeals / scoredTranscripts.length) * 100)
      : 0;

    return { totalCalls, avgScore, trend, dealRiskRate };
  }, [transcripts]);

  // Score breakdown by category
  const scoreBreakdown = useMemo(() => {
    const categoryScores: Record<string, { total: number; count: number }> = {};

    transcripts.forEach((t) => {
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

    return Object.entries(categoryScores).map(([key, { total, count }]) => ({
      category: CATEGORY_LABELS[key] || key,
      score: count > 0 ? Math.round(total / count) : 0,
      fullMark: 100,
    }));
  }, [transcripts]);

  // Key strengths
  const keyStrengths = useMemo(() => {
    const strengths: Record<string, number> = {};

    transcripts.forEach((t) => {
      if (t.ai_what_worked) {
        t.ai_what_worked.forEach((item: any) => {
          const skill = item.behavior_skill;
          strengths[skill] = (strengths[skill] || 0) + 1;
        });
      }
    });

    return Object.entries(strengths)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill, count]) => ({ skill, count }));
  }, [transcripts]);

  // Focus areas
  const focusAreas = useMemo(() => {
    const areas: Record<string, number> = {};

    transcripts.forEach((t) => {
      if (t.ai_improvement_areas) {
        t.ai_improvement_areas.forEach((item: any) => {
          const skill = item.category_skill;
          areas[skill] = (areas[skill] || 0) + 1;
        });
      }
    });

    return Object.entries(areas)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill, count]) => ({ skill, count }));
  }, [transcripts]);

  // AI Coaching Recommendations
  const aiRecommendations = useMemo(() => {
    const recommendations: any[] = [];

    transcripts.slice(0, 5).forEach((t) => {
      if (t.ai_improvement_areas) {
        t.ai_improvement_areas.slice(0, 2).forEach((item: any) => {
          recommendations.push({
            skill: item.category_skill,
            recommendation: item.do_this_instead,
            reason: item.why_this_works_better,
          });
        });
      }
    });

    // Deduplicate by skill
    const unique = recommendations.reduce((acc: any[], curr) => {
      if (!acc.find((r) => r.skill === curr.skill)) {
        acc.push(curr);
      }
      return acc;
    }, []);

    return unique.slice(0, 5);
  }, [transcripts]);

  // Score history for chart
  const scoreHistory = useMemo(() => {
    return transcripts
      .filter((t) => t.ai_overall_score != null && t.created_at)
      .map((t) => ({
        date: new Date(t.created_at).toLocaleDateString(),
        score: Number(t.ai_overall_score),
        title: t.title,
      }))
      .reverse()
      .slice(-20);
  }, [transcripts]);

  // Pagination
  const totalPages = Math.ceil(transcripts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTranscripts = transcripts.slice(startIndex, endIndex);

  // Save coaching note
  const saveCoachingNote = async () => {
    if (!newNote.trim()) {
      toast.error("Please enter a note");
      return;
    }

    setSavingNote(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("coaching_notes").insert({
      user_id: memberId,
      coach_id: user?.id,
      note: newNote.trim(),
      created_at: new Date().toISOString(),
    });

    if (error) {
      toast.error("Failed to save note");
    } else {
      toast.success("Coaching note added");
      setNewNote("");
      setAddNoteOpen(false);

      // Refresh notes
      const { data: notesData } = await supabase
        .from("coaching_notes")
        .select("*")
        .eq("user_id", memberId)
        .order("created_at", { ascending: false });
      setCoachingNotes(notesData || []);
    }

    setSavingNote(false);
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
          <SiteHeader heading="Team Member Profile" />
          <div className="p-10 text-center text-muted-foreground">Loading...</div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!member) {
    return (
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader heading="Team Member Profile" />
          <div className="p-10 text-center text-muted-foreground">
            Member not found.
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
        <SiteHeader heading="Team Member Profile" />

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-6 py-6 px-4 lg:px-6 max-w-7xl mx-auto w-full">
              {/* Back Button & Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/team")}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h1 className="text-2xl font-bold">{member.name || "No Name"}</h1>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
                  <CardHeader>
                    <CardDescription>Total Calls</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                      {stats.totalCalls}
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
                    <CardDescription>Average Score</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                      {stats.avgScore > 0 ? (
                        stats.avgScore
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                          </div>
                          <span className="text-base text-muted-foreground">Scoring...</span>
                        </div>
                      )}
                    </CardTitle>
                    <CardAction>
                      {stats.avgScore > 0 ? (
                        <Badge
                          variant="outline"
                          className={
                            stats.avgScore >= 80
                              ? "border-green-500/50 text-green-700"
                              : stats.avgScore >= 60
                              ? "border-yellow-500/50 text-yellow-700"
                              : "border-red-500/50 text-red-700"
                          }
                        >
                          {stats.avgScore >= 80 ? "Excellent" : stats.avgScore >= 60 ? "Good" : "Needs Work"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-primary/30 text-primary/70">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse mr-1" />
                          Processing
                        </Badge>
                      )}
                    </CardAction>
                  </CardHeader>
                </Card>

                <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
                  <CardHeader>
                    <CardDescription>Performance Trend</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums flex items-center gap-2">
                      {stats.trend > 0 ? "+" : ""}{stats.trend}%
                      {stats.trend >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      )}
                    </CardTitle>
                    <CardAction>
                      <Badge variant="outline">
                        vs previous period
                      </Badge>
                    </CardAction>
                  </CardHeader>
                </Card>

                <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
                  <CardHeader>
                    <CardDescription>Deal Risk Rate</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                      {stats.dealRiskRate}%
                    </CardTitle>
                    <CardAction>
                      <Badge
                        variant="outline"
                        className={
                          stats.dealRiskRate < 20
                            ? "border-green-500/50 text-green-700"
                            : stats.dealRiskRate < 40
                            ? "border-yellow-500/50 text-yellow-700"
                            : "border-red-500/50 text-red-700"
                        }
                      >
                        {stats.dealRiskRate < 20 ? "Low" : stats.dealRiskRate < 40 ? "Moderate" : "High"}
                      </Badge>
                    </CardAction>
                  </CardHeader>
                </Card>
              </div>

              {/* Score Breakdown Chart */}
              <Card className="@container/card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Score Breakdown by Category
                  </CardTitle>
                  <CardDescription>
                    Average performance across different skill areas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {scoreBreakdown.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center">
                      <div className="relative mb-4">
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="absolute inset-2 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
                        <div className="relative h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Target className="h-7 w-7 text-primary animate-pulse" />
                        </div>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">Scoring calls</p>
                      <p className="text-xs text-muted-foreground">AI analyzing performance categories...</p>
                      <div className="flex items-center gap-1.5 mt-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  ) : (
                    <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={scoreBreakdown}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="category" className="text-xs" />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} />
                          <Radar
                            name="Score"
                            dataKey="score"
                            stroke="var(--primary)"
                            fill="var(--primary)"
                            fillOpacity={0.3}
                          />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Recent Calls Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    Recent Calls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTranscripts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No calls recorded.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedTranscripts.map((t) => (
                          <TableRow
                            key={t.id}
                            className="hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => router.push(`/calls/${t.id}`)}
                          >
                            <TableCell className="font-medium">{t.title}</TableCell>
                            <TableCell>
                              {t.duration ? formatDuration(t.duration) : "—"}
                            </TableCell>
                            <TableCell>
                              {t.ai_overall_score != null ? (
                                <Badge
                                  variant="outline"
                                  className={
                                    t.ai_overall_score >= 80
                                      ? "border-green-500/50 text-green-700"
                                      : t.ai_overall_score >= 60
                                      ? "border-yellow-500/50 text-yellow-700"
                                      : "border-red-500/50 text-red-700"
                                  }
                                >
                                  {Math.round(t.ai_overall_score)}
                                </Badge>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20">
                                  <div className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                                  </div>
                                  <span className="text-[10px] font-medium text-primary/80">Scoring</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {transcripts.length > 0 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
                        Showing {startIndex + 1} to {Math.min(endIndex, transcripts.length)} of {transcripts.length}
                      </div>
                      <div className="flex w-full items-center gap-8 lg:w-fit">
                        <div className="hidden items-center gap-2 lg:flex">
                          <Label className="text-sm font-medium">Rows per page</Label>
                          <Select
                            value={`${pageSize}`}
                            onValueChange={(value) => {
                              setPageSize(Number(value));
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger size="sm" className="w-20">
                              <SelectValue placeholder={pageSize} />
                            </SelectTrigger>
                            <SelectContent side="top">
                              {[10, 20, 30].map((size) => (
                                <SelectItem key={size} value={`${size}`}>
                                  {size}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm">
                            Page {currentPage} of {totalPages || 1}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages || totalPages === 0}
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Key Strengths */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      Key Strengths
                    </CardTitle>
                    <CardDescription>Most frequently demonstrated skills</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {keyStrengths.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="relative mb-3">
                          <div className="absolute inset-0 rounded-full bg-yellow-500/20 animate-ping" style={{ animationDuration: "2s" }} />
                          <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 flex items-center justify-center">
                            <Star className="h-5 w-5 text-yellow-500 animate-pulse" />
                          </div>
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">Identifying strengths</p>
                        <p className="text-xs text-muted-foreground">Analyzing call patterns...</p>
                        <div className="flex items-center gap-1 mt-2">
                          <div className="h-1 w-1 rounded-full bg-yellow-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="h-1 w-1 rounded-full bg-yellow-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="h-1 w-1 rounded-full bg-yellow-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {keyStrengths.map((strength, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-medium">{strength.skill}</span>
                            </div>
                            <Badge variant="secondary">{strength.count}x</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Focus Areas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-amber-500" />
                      Focus Areas
                    </CardTitle>
                    <CardDescription>Skills needing improvement</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {focusAreas.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="relative mb-3">
                          <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" style={{ animationDuration: "2s" }} />
                          <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                            <Target className="h-5 w-5 text-amber-500 animate-pulse" />
                          </div>
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">Finding focus areas</p>
                        <p className="text-xs text-muted-foreground">Analyzing improvement opportunities...</p>
                        <div className="flex items-center gap-1 mt-2">
                          <div className="h-1 w-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="h-1 w-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="h-1 w-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {focusAreas.map((area, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                              <span className="text-sm font-medium">{area.skill}</span>
                            </div>
                            <Badge variant="outline">{area.count}x flagged</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* AI Coaching Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-indigo-500" />
                    AI Coaching Recommendations
                  </CardTitle>
                  <CardDescription>Personalized improvement suggestions based on call analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  {aiRecommendations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="relative mb-4">
                        <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 flex items-center justify-center">
                          <Brain className="h-6 w-6 text-indigo-500 animate-pulse" />
                        </div>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">Generating recommendations</p>
                      <p className="text-xs text-muted-foreground max-w-xs">AI is analyzing calls to provide coaching insights...</p>
                      <div className="flex items-center gap-1.5 mt-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {aiRecommendations.map((rec, i) => (
                        <Alert key={i} className="bg-indigo-500/5 border border-indigo-200/40">
                          <AlertTitle className="text-indigo-700 dark:text-indigo-300">
                            <Sparkles className="h-4 w-4 inline mr-2" />
                            {rec.skill}
                          </AlertTitle>
                          <AlertDescription className="mt-2 space-y-2">
                            <p className="text-sm"><strong>Try this:</strong> {rec.recommendation}</p>
                            <p className="text-xs text-muted-foreground">{rec.reason}</p>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Score History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Score History
                  </CardTitle>
                  <CardDescription>Performance over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {scoreHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center">
                      <div className="relative mb-4">
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <History className="h-6 w-6 text-primary animate-pulse" />
                        </div>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">Building score history</p>
                      <p className="text-xs text-muted-foreground">Scoring calls to track progress...</p>
                      <div className="flex items-center gap-1.5 mt-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  ) : (
                    <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={scoreHistory}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                                    <div className="font-medium text-sm">{data.title}</div>
                                    <div className="text-sm text-muted-foreground">
                                      Score: {data.score}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="var(--primary)"
                            strokeWidth={2}
                            dot={{ fill: "var(--primary)", r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Coaching Notes */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Coaching Notes
                    </CardTitle>
                    <CardDescription>Manager feedback and development notes</CardDescription>
                  </div>
                  <Button onClick={() => setAddNoteOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </CardHeader>
                <CardContent>
                  {coachingNotes.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No coaching notes yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {coachingNotes.map((note, i) => (
                        <div key={i} className="border rounded-lg p-4 bg-muted/20">
                          <p className="text-sm">{note.note}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(note.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Add Coaching Note Dialog */}
      <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Coaching Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter coaching feedback or development notes..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddNoteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCoachingNote} disabled={savingNote}>
              {savingNote ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
