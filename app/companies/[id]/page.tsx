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
  Loader2,
  MessageSquareWarning,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
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

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalTranscripts, setTotalTranscripts] = useState(0);
  const [transcriptsLoading, setTranscriptsLoading] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Stats - loaded separately for performance
  const [stats, setStats] = useState<{
    totalCalls: number;
    avgScore: number;
    lastCall: string;
    primaryContacts: number;
  }>({ totalCalls: 0, avgScore: 0, lastCall: "No calls yet", primaryContacts: 0 });

  // Fetch transcripts for a specific page (server-side pagination)
  const fetchTranscriptsPage = useCallback(async (transcriptIds: string[], page: number, size: number) => {
    if (transcriptIds.length === 0) return;

    setTranscriptsLoading(true);
    const offset = (page - 1) * size;

    const { data, error } = await supabase
      .from("transcripts")
      .select("*")
      .in("id", transcriptIds)
      .not("duration", "is", null)
      .gte("duration", 5)
      .order("created_at", { ascending: false })
      .range(offset, offset + size - 1);

    if (!error && data) {
      setTranscripts(data);
    }
    setTranscriptsLoading(false);
  }, []);

  // Store transcript IDs for pagination
  const [allTranscriptIds, setAllTranscriptIds] = useState<string[]>([]);

  // Memoized pagination handlers
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    fetchTranscriptsPage(allTranscriptIds, newPage, pageSize);
  }, [fetchTranscriptsPage, allTranscriptIds, pageSize]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    fetchTranscriptsPage(allTranscriptIds, 1, newSize);
  }, [fetchTranscriptsPage, allTranscriptIds]);

  // Delete company handler
  const handleDeleteCompany = useCallback(async () => {
    if (!company) return;

    setIsDeleting(true);

    try {
      // First, delete all company_calls records associated with this company
      const { error: callsError } = await supabase
        .from("company_calls")
        .delete()
        .eq("company_id", id);

      if (callsError) {
        console.warn("Error deleting company_calls:", callsError);
        // Continue anyway - there might not be any calls
      }

      // Now delete the company
      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Invalidate cache
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const cacheKey = `companies-data-${user.id}`;
        localStorage.removeItem(cacheKey);
      }

      toast.success("Company and all associated calls deleted successfully");

      // Redirect to companies list
      router.push("/companies");
    } catch (err: any) {
      console.error("Error deleting company:", err);
      toast.error(err.message || "Failed to delete company");
      setIsDeleting(false);
    }
  }, [company, id, router]);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Parallel API calls - fetch company and calls simultaneously
      // Include company_contacts, ai_recommendations, risk_summary, and ai_relationship from schema
      const [companyResult, callDataResult] = await Promise.all([
        supabase.from("companies").select("id, domain, company_name, created_at, company_goal_objective, company_contacts, ai_recommendations, risk_summary, ai_relationship, pain_points").eq("id", id).single(),
        supabase.from("company_calls")
          .select("id, created_at, transcript_id")
          .eq("company_id", id)
          .order("created_at", { ascending: false })
      ]);

      // Log any errors for debugging
      if (companyResult.error) {
        console.error("Company fetch error:", companyResult.error);
      }

      const comp = companyResult.data;
      const callData = callDataResult.data || [];

      // Get transcript IDs from company_calls
      const transcriptIds = callData.map((c) => c.transcript_id).filter(Boolean);
      setAllTranscriptIds(transcriptIds);

      // Get total count of valid transcripts (with duration filter)
      let totalCount = 0;
      let transcriptData: any[] = [];

      if (transcriptIds.length > 0) {
        // Get count first
        const { count } = await supabase
          .from("transcripts")
          .select("*", { count: "exact", head: true })
          .in("id", transcriptIds)
          .not("duration", "is", null)
          .gte("duration", 5);

        totalCount = count || 0;
        setTotalTranscripts(totalCount);

        // Fetch stats data (scored transcripts for average calculation)
        const { data: scoredData } = await supabase
          .from("transcripts")
          .select("ai_overall_score, ai_deal_risk_alerts, created_at, title")
          .in("id", transcriptIds)
          .not("duration", "is", null)
          .gte("duration", 5)
          .not("ai_overall_score", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);

        // Calculate stats
        const scoredTranscripts = scoredData || [];
        const avgScore = scoredTranscripts.length > 0
          ? Math.round(
              scoredTranscripts.reduce((acc, t) => acc + Number(t.ai_overall_score), 0) /
              scoredTranscripts.length
            )
          : 0;

        const lastCall = callData.length > 0
          ? formatDateTime(callData[0].created_at)
          : "No calls yet";

        // Extract contacts
        let allAttendees: any[] = [];
        if (comp?.company_contacts && Array.isArray(comp.company_contacts)) {
          allAttendees = comp.company_contacts;
        }

        setStats({
          totalCalls: callData.length,
          avgScore,
          lastCall,
          primaryContacts: allAttendees.slice(0, 5).length,
        });

        // Fetch first page of transcripts for table
        const { data: firstPageData } = await supabase
          .from("transcripts")
          .select("*")
          .in("id", transcriptIds)
          .not("duration", "is", null)
          .gte("duration", 5)
          .order("created_at", { ascending: false })
          .range(0, pageSize - 1);

        transcriptData = firstPageData || [];
      }

      // Extract contacts - prefer company_contacts from DB if available
      let contactsList: any[] = [];

      // First check if company has stored contacts
      if (comp?.company_contacts && Array.isArray(comp.company_contacts)) {
        contactsList = comp.company_contacts;
      } else {
        // Fall back to extracting from transcripts
        transcriptData.forEach((t) => {
          if (t.meeting_attendees) {
            t.meeting_attendees.forEach((a: any) => {
              if (!contactsList.find((x) => x.email === a.email)) {
                contactsList.push(a);
              }
            });
          }
        });
      }

      // Update stats with contacts if not already set
      setStats(prev => ({
        ...prev,
        primaryContacts: contactsList.slice(0, 5).length,
      }));

      setCompany(comp);
      setCalls(callData);
      setTranscripts(transcriptData);
      setContacts(contactsList.slice(0, 5));
      setLoading(false);
    }

    load();
  }, [id, pageSize]);

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

  // Server-side pagination calculations
  const totalPages = Math.ceil(totalTranscripts / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalTranscripts);

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
                <div className="flex items-center gap-3">
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
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

                {/* Risk Summary - prioritize company-level risk_summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-rose-500" />
                      Risk Summary
                    </CardTitle>
                    {company.risk_summary && company.risk_summary.length > 0 && (
                      <CardDescription>
                        Key risks identified for this account
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {/* Company-level Risk Summary (array of strings) */}
                    {company.risk_summary && company.risk_summary.length > 0 ? (
                      <div className="space-y-3">
                        {company.risk_summary.map((risk: string, i: number) => (
                          <Alert
                            key={i}
                            className="bg-rose-500/5 border border-rose-200/40 dark:border-rose-500/20"
                          >
                            <AlertDescription className="text-sm text-rose-700 dark:text-rose-300">
                              {risk}
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    ) : riskSummary.length === 0 ? (
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

              {/* Pain Points & Objections Section */}
              {company.pain_points && company.pain_points.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquareWarning className="h-5 w-5 text-orange-500" />
                        Pain Points & Objections
                      </CardTitle>
                      <Badge variant="outline" className="text-orange-600 border-orange-300 dark:border-orange-700">
                        {company.pain_points.length} identified
                      </Badge>
                    </div>
                    <CardDescription>
                      Key concerns and objections raised across all calls with this company
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {company.pain_points.map((painPoint: string, i: number) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-orange-500/5 border border-orange-200/40 dark:border-orange-500/20"
                      >
                        <div className="flex gap-3">
                          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                          <p className="text-sm text-orange-700 dark:text-orange-300 leading-relaxed">
                            {painPoint}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Footer Note */}
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <p>Pain points are automatically extracted from call transcripts using AI analysis.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

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

              {/* AI Relationship Insights from Database */}
              {company.ai_relationship && company.ai_relationship.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-cyan-500" />
                      AI Relationship Insights
                    </CardTitle>
                    <CardDescription>
                      Key relationship dynamics and insights for this account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {company.ai_relationship.map((insight: string, i: number) => (
                        <Alert
                          key={i}
                          className="bg-cyan-500/5 border border-cyan-200/40 dark:border-cyan-500/20"
                        >
                          <AlertDescription className="text-sm text-cyan-700 dark:text-cyan-300">
                            {insight}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

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
                      {transcripts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No calls recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        transcripts.map((t) => (
                          <TableRow
                            key={t.id}
                            className="hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() =>
                              router.push(`/calls/${t.id}`)
                            }
                          >
                            <TableCell className="font-medium">{t.title}</TableCell>
                            <TableCell>
                              {t.duration ? formatDuration(t.duration) : "—"}
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
                  {totalTranscripts > 0 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-muted-foreground hidden flex-1 text-sm lg:flex items-center gap-2">
                        {transcriptsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Showing {startIndex + 1} to {endIndex} of {totalTranscripts} call(s).
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
                            disabled={currentPage === 1 || transcriptsLoading}
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
                            disabled={currentPage === 1 || transcriptsLoading}
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
                            disabled={currentPage === totalPages || totalPages === 0 || transcriptsLoading}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className="hidden size-8 lg:flex"
                            size="icon"
                            onClick={() => handlePageChange(totalPages)}
                            disabled={currentPage === totalPages || totalPages === 0 || transcriptsLoading}
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

      {/* DELETE COMPANY CONFIRMATION MODAL */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Company
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Are you sure you want to delete this company?
                </p>
                <p className="text-sm text-muted-foreground">
                  All associated call records linking to this company will also be
                  permanently removed. The original call transcripts will remain intact.
                </p>
              </div>
            </div>

            {company && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-3">
                  <CompanyLogo domain={company.domain} companyName={company.company_name} size="sm" />
                  <div>
                    <p className="font-medium text-sm">
                      {company.company_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {company.domain || "No domain"} · {stats.totalCalls} calls
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCompany}
              disabled={isDeleting}
              className="gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Company
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
