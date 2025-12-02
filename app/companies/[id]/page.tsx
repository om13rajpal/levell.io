"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabaseClient";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  ArrowLeft,
  Phone,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Briefcase,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  Mail,
  UserCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Line,
  LineChart,
  Scatter,
  ScatterChart,
  ReferenceLine,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

function industryFromDomain(domain: string) {
  if (!domain) return "Unknown";
  if (domain.includes("tech")) return "Technology";
  if (domain.includes("health")) return "Healthcare";
  if (domain.includes("fin")) return "Finance";
  if (domain.includes("soft")) return "SaaS";
  return "General";
}

function getDomainFromUrl(url: string): string {
  if (!url) return "";
  try {
    let domain = url.toLowerCase().trim();
    domain = domain.replace(/^https?:\/\//, "");
    domain = domain.replace(/^www\./, "");
    domain = domain.split("/")[0];
    return domain;
  } catch {
    return "";
  }
}

function CompanyLogo({ domain, companyName, size = "lg" }: { domain: string; companyName: string; size?: "sm" | "lg" }) {
  const [imageError, setImageError] = useState(false);

  const cleanDomain = getDomainFromUrl(domain);
  const logoUrl = cleanDomain ? `https://logo.clearbit.com/${cleanDomain}` : null;

  const sizeClasses = size === "lg" ? "h-16 w-16" : "h-8 w-8";

  if (!logoUrl || imageError) {
    return (
      <div className={`${sizeClasses} rounded-xl bg-muted flex items-center justify-center shrink-0`}>
        <Building2 className={size === "lg" ? "h-8 w-8 text-muted-foreground" : "h-4 w-4 text-muted-foreground"} />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses} rounded-xl shrink-0 overflow-hidden`}>
      <Image
        src={logoUrl}
        alt={`${companyName} logo`}
        width={size === "lg" ? 64 : 32}
        height={size === "lg" ? 64 : 32}
        className={`${sizeClasses} object-cover`}
        onError={() => setImageError(true)}
        unoptimized
      />
    </div>
  );
}

function formatDate(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleDateString();
  } catch {
    return dt;
  }
}

function formatDateTime(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

const chartConfig = {
  score: {
    label: "Relationship Score",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

export default function CompanyDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [company, setCompany] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Memoized pagination handlers
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Parallel API calls - fetch company and calls simultaneously
      // Include company_contacts and ai_recommendations from schema
      const [companyResult, callDataResult] = await Promise.all([
        supabase.from("companies").select("id, domain, company_name, created_at, company_goal_objective, company_contacts, ai_recommendations").eq("id", id).single(),
        supabase.from("company_calls")
          .select("id, created_at, transcript_id")
          .eq("company_id", id)
          .order("created_at", { ascending: false })
      ]);

      const comp = companyResult.data;
      const callData = callDataResult.data || [];

      // Fetch transcripts if we have call data
      // transcript_id in company_calls is FK to transcripts.id (not fireflies_id)
      let transcriptData: any[] = [];
      if (callData.length > 0) {
        const transcriptIds = callData.map((c) => c.transcript_id).filter(Boolean);
        if (transcriptIds.length > 0) {
          const { data } = await supabase
            .from("transcripts")
            .select("*")
            .in("id", transcriptIds);
          transcriptData = data || [];
        }
      }

      // Extract contacts - prefer company_contacts from DB if available
      let allAttendees: any[] = [];

      // First check if company has stored contacts
      if (comp?.company_contacts && Array.isArray(comp.company_contacts)) {
        allAttendees = comp.company_contacts;
      } else {
        // Fall back to extracting from transcripts
        transcriptData.forEach((t) => {
          if (t.meeting_attendees) {
            t.meeting_attendees.forEach((a: any) => {
              if (!allAttendees.find((x) => x.email === a.email)) {
                allAttendees.push(a);
              }
            });
          }
        });
      }

      setCompany(comp);
      setCalls(callData);
      setTranscripts(transcriptData);
      setContacts(allAttendees.slice(0, 5));
      setLoading(false);
    }

    load();
  }, [id]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalCalls = calls.length;

    const scoredTranscripts = transcripts.filter(
      (t) => t.ai_overall_score != null && !isNaN(t.ai_overall_score)
    );

    const avgScore = scoredTranscripts.length > 0
      ? Math.round(
          scoredTranscripts.reduce((acc, t) => acc + Number(t.ai_overall_score), 0) /
          scoredTranscripts.length
        )
      : 0;

    const lastCall = calls.length > 0
      ? formatDateTime(calls[0].created_at)
      : "No calls yet";

    const primaryContacts = contacts.length;

    return { totalCalls, avgScore, lastCall, primaryContacts };
  }, [calls, transcripts, contacts]);

  // Relationship health data for chart
  const relationshipHealthData = useMemo(() => {
    return transcripts
      .filter((t) => t.ai_overall_score != null && t.created_at)
      .map((t) => {
        const score = Number(t.ai_overall_score);
        const hasRisk = t.ai_deal_risk_alerts && t.ai_deal_risk_alerts.length > 0;
        return {
          date: new Date(t.created_at).toLocaleDateString(),
          score,
          risk: hasRisk ? (score < 60 ? "critical" : "flagged") : "healthy",
          title: t.title,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transcripts]);

  // Risk summary
  const riskSummary = useMemo(() => {
    const risks: any[] = [];
    transcripts.forEach((t) => {
      if (t.ai_deal_risk_alerts) {
        t.ai_deal_risk_alerts.forEach((r: any) => {
          risks.push({ ...r, callTitle: t.title, date: t.created_at });
        });
      }
    });
    return risks.slice(0, 5);
  }, [transcripts]);

  // Recent tasks from qualification gaps
  const recentTasks = useMemo(() => {
    const tasks: any[] = [];
    transcripts.slice(0, 3).forEach((t) => {
      if (t.ai_qualification_gaps) {
        t.ai_qualification_gaps.forEach((gap: any) => {
          tasks.push({
            task: gap.how_to_get_it_next_conversation,
            element: gap.framework_element,
            callTitle: t.title,
          });
        });
      }
    });
    return tasks.slice(0, 5);
  }, [transcripts]);

  // AI Relationship Insights
  const aiInsights = useMemo(() => {
    const insights: any[] = [];

    // Aggregate what worked
    transcripts.slice(0, 3).forEach((t) => {
      if (t.ai_what_worked) {
        t.ai_what_worked.slice(0, 2).forEach((item: any) => {
          insights.push({
            type: "success",
            title: item.behavior_skill,
            description: item.explanation,
          });
        });
      }
    });

    // Aggregate improvements
    transcripts.slice(0, 3).forEach((t) => {
      if (t.ai_improvement_areas) {
        t.ai_improvement_areas.slice(0, 2).forEach((item: any) => {
          insights.push({
            type: "improvement",
            title: item.category_skill,
            description: item.do_this_instead,
          });
        });
      }
    });

    return insights.slice(0, 6);
  }, [transcripts]);

  // Pagination
  const totalPages = Math.ceil(transcripts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTranscripts = transcripts.slice(startIndex, endIndex);

  const industry = useMemo(() => {
    return company?.domain ? industryFromDomain(company.domain) : "Unknown";
  }, [company]);

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
          <SiteHeader heading="Company Details" />
          <div className="p-10 text-center text-muted-foreground">Loading...</div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!company) {
    return (
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader heading="Company Details" />
          <div className="p-10 text-center text-muted-foreground">
            Company not found.
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
        <SiteHeader heading="Company Details" />

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-6 py-6 px-4 lg:px-6 max-w-7xl mx-auto w-full">
              {/* Back Button & Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/companies")}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <CompanyLogo domain={company.domain} companyName={company.company_name} size="lg" />
                  <div>
                    <h1 className="text-2xl font-bold">{company.company_name}</h1>
                    <p className="text-sm text-muted-foreground">
                      {industry} · {company.domain || "No domain"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    stats.avgScore >= 80
                      ? "border-green-500/50 text-green-700 dark:text-green-400"
                      : stats.avgScore >= 60
                      ? "border-yellow-500/50 text-yellow-700 dark:text-yellow-400"
                      : "border-red-500/50 text-red-700 dark:text-red-400"
                  }
                >
                  Health Score: {stats.avgScore || "—"}
                </Badge>
              </div>

              {/* Stats Cards - 4 cards like dashboard */}
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
                  <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                      Total recorded calls
                    </div>
                  </CardFooter>
                </Card>

                <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
                  <CardHeader>
                    <CardDescription>Average Call Score</CardDescription>
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
                        <Badge variant="outline">
                          {stats.avgScore >= 70 ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {stats.avgScore >= 70 ? "Good" : "Needs Work"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-primary/30 text-primary/70">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse mr-1" />
                          Processing
                        </Badge>
                      )}
                    </CardAction>
                  </CardHeader>
                  <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                      Based on AI analysis
                    </div>
                  </CardFooter>
                </Card>

                <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
                  <CardHeader>
                    <CardDescription>Last Call</CardDescription>
                    <CardTitle className="text-lg font-semibold">
                      {stats.lastCall}
                    </CardTitle>
                    <CardAction>
                      <Badge variant="outline">
                        <Calendar className="h-3 w-3 mr-1" />
                        Recent
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                      Most recent interaction
                    </div>
                  </CardFooter>
                </Card>

                <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
                  <CardHeader>
                    <CardDescription>Primary Contacts</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                      {stats.primaryContacts}
                    </CardTitle>
                    <CardAction>
                      <Badge variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                      Known contacts
                    </div>
                  </CardFooter>
                </Card>
              </div>

              {/* Relationship Health Graph */}
              <Card className="@container/card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Relationship Health Over Time
                  </CardTitle>
                  <CardDescription>
                    Score trends with risk indicators (Critical = Red, Flagged = Yellow)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {relationshipHealthData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[250px] text-center">
                      <div className="relative mb-4">
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="absolute inset-2 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
                        <div className="relative h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <svg className="h-7 w-7 text-primary animate-pulse" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">Scoring your calls</p>
                      <p className="text-xs text-muted-foreground">AI analysis in progress...</p>
                      <div className="flex items-center gap-1.5 mt-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  ) : (
                    <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={relationshipHealthData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                                    <div className="font-medium">{data.title}</div>
                                    <div className="text-sm text-muted-foreground">
                                      Score: {data.score}
                                    </div>
                                    <div className="text-sm">
                                      Status:{" "}
                                      <span
                                        className={
                                          data.risk === "critical"
                                            ? "text-red-500"
                                            : data.risk === "flagged"
                                            ? "text-yellow-500"
                                            : "text-green-500"
                                        }
                                      >
                                        {data.risk}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="5 5" />
                          <ReferenceLine y={80} stroke="#eab308" strokeDasharray="5 5" />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="var(--primary)"
                            strokeWidth={2}
                            dot={({ cx, cy, payload }) => {
                              const color =
                                payload.risk === "critical"
                                  ? "#ef4444"
                                  : payload.risk === "flagged"
                                  ? "#eab308"
                                  : "#22c55e";
                              return (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={3}
                                  fill={color}
                                />
                              );
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contacts at Company */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Contacts at {company.company_name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contacts.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No contacts detected yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {contacts.map((contact, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20"
                          >
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm">
                              {contact.email || "No email"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Risk Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-rose-500" />
                      Risk Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {riskSummary.length === 0 ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span>No significant risks detected</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {riskSummary.map((risk, i) => (
                          <Alert
                            key={i}
                            className="bg-rose-500/5 border border-rose-200/40 dark:border-rose-500/20"
                          >
                            <AlertTitle className="text-rose-700 dark:text-rose-300 text-sm">
                              {risk.risk_description}
                            </AlertTitle>
                            <AlertDescription className="text-xs mt-1">
                              {risk.what_this_means}
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Tasks */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Recent Tasks
                    </CardTitle>
                    <CardDescription>
                      Action items from recent calls
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recentTasks.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No pending tasks.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {recentTasks.map((task, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20"
                          >
                            <Target className="h-4 w-4 text-primary mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">{task.task}</p>
                              <p className="text-xs text-muted-foreground">
                                {task.element} · {task.callTitle}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Deal Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-primary" />
                      Deal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Company</span>
                      <span className="font-medium">{company.company_name}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Industry</span>
                      <span className="font-medium">{industry}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Interactions</span>
                      <span className="font-medium">{stats.totalCalls}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Relationship Health</span>
                      <Badge
                        className={
                          stats.avgScore >= 80
                            ? "bg-green-500/10 text-green-700 border-green-500/30"
                            : stats.avgScore >= 60
                            ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30"
                            : "bg-red-500/10 text-red-700 border-red-500/30"
                        }
                      >
                        {stats.avgScore >= 80
                          ? "Strong"
                          : stats.avgScore >= 60
                          ? "Moderate"
                          : "At Risk"}
                      </Badge>
                    </div>
                    {company.company_goal_objective && (
                      <>
                        <Separator />
                        <div>
                          <span className="text-sm text-muted-foreground">Company Goal</span>
                          <p className="mt-1 text-sm">{company.company_goal_objective}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* AI Recommendations from Database */}
              {company.ai_recommendations && company.ai_recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      AI Recommendations
                    </CardTitle>
                    <CardDescription>
                      Strategic recommendations for this account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {company.ai_recommendations.map((rec: string, i: number) => (
                        <Alert
                          key={i}
                          className="bg-purple-500/5 border border-purple-200/40 dark:border-purple-500/20"
                        >
                          <AlertDescription className="text-sm">
                            {rec}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Relationship Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-500" />
                    AI Relationship Insights
                  </CardTitle>
                  <CardDescription>
                    Key insights from your interactions with this company
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {aiInsights.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="relative mb-4">
                        <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 flex items-center justify-center">
                          <Sparkles className="h-6 w-6 text-indigo-500 animate-pulse" />
                        </div>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">Generating Insights</p>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        AI is analyzing your calls to provide relationship insights...
                      </p>
                      <div className="flex items-center gap-1.5 mt-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {aiInsights.map((insight, i) => (
                        <Alert
                          key={i}
                          className={
                            insight.type === "success"
                              ? "bg-emerald-500/5 border border-emerald-200/40 dark:border-emerald-500/20"
                              : "bg-amber-500/5 border border-amber-200/40 dark:border-amber-500/20"
                          }
                        >
                          <AlertTitle
                            className={
                              insight.type === "success"
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-amber-700 dark:text-amber-300"
                            }
                          >
                            {insight.type === "success" ? (
                              <CheckCircle className="h-4 w-4 inline mr-2" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 inline mr-2" />
                            )}
                            {insight.title}
                          </AlertTitle>
                          <AlertDescription className="text-sm mt-1">
                            {insight.description}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Call History Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    Call History
                  </CardTitle>
                  <CardDescription>
                    All recorded calls with this company
                  </CardDescription>
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
                            No calls recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedTranscripts.map((t) => (
                          <TableRow
                            key={t.id}
                            className="hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() =>
                              router.push(`/calls/${t.id}`)
                            }
                          >
                            <TableCell className="font-medium">{t.title}</TableCell>
                            <TableCell>
                              {t.duration ? `${Math.round(t.duration)} sec` : "—"}
                            </TableCell>
                            <TableCell>
                              {t.ai_overall_score != null &&
                              !isNaN(t.ai_overall_score) ? (
                                <Badge
                                  variant="outline"
                                  className={
                                    t.ai_overall_score >= 80
                                      ? "border-green-500/50 text-green-700 dark:text-green-400"
                                      : t.ai_overall_score >= 60
                                      ? "border-yellow-500/50 text-yellow-700 dark:text-yellow-400"
                                      : "border-red-500/50 text-red-700 dark:text-red-400"
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
                              {t.created_at
                                ? new Date(t.created_at).toLocaleString()
                                : "—"}
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
                        Showing {startIndex + 1} to{" "}
                        {Math.min(endIndex, transcripts.length)} of{" "}
                        {transcripts.length} call(s).
                      </div>
                      <div className="flex w-full items-center gap-8 lg:w-fit">
                        <div className="hidden items-center gap-2 lg:flex">
                          <Label htmlFor="rows-per-page" className="text-sm font-medium">
                            Rows per page
                          </Label>
                          <Select
                            value={`${pageSize}`}
                            onValueChange={(value) => handlePageSizeChange(Number(value))}
                          >
                            <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                              <SelectValue placeholder={pageSize} />
                            </SelectTrigger>
                            <SelectContent side="top">
                              {[10, 20, 30, 40, 50].map((size) => (
                                <SelectItem key={size} value={`${size}`}>
                                  {size}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex w-fit items-center justify-center text-sm font-medium">
                          Page {currentPage} of {totalPages || 1}
                        </div>
                        <div className="ml-auto flex items-center gap-2 lg:ml-0">
                          <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage === 1}
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            onClick={() =>
                              handlePageChange(Math.max(1, currentPage - 1))
                            }
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            onClick={() =>
                              handlePageChange(Math.min(totalPages, currentPage + 1))
                            }
                            disabled={currentPage === totalPages || totalPages === 0}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className="hidden size-8 lg:flex"
                            size="icon"
                            onClick={() => handlePageChange(totalPages)}
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
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
