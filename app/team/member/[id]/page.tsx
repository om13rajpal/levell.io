"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
  Trash2,
  Loader2,
  Shield,
  Crown,
  Briefcase,
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

// Helper to parse JSONB fields that may come as strings or arrays
function parseJsonbArray(data: any): string[] {
  if (!data) return [];

  // Already an array
  if (Array.isArray(data)) {
    return data.map(item => String(item).trim()).filter(Boolean);
  }

  // String that looks like a JSON array
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim()).filter(Boolean);
      }
      // Single string value
      return [data.trim()].filter(Boolean);
    } catch {
      // Not valid JSON, treat as comma-separated or single value
      if (data.includes(",")) {
        return data.split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      }
      return [data.trim()].filter(Boolean);
    }
  }

  return [];
}

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Member org entries and team roles
  const [memberOrgEntries, setMemberOrgEntries] = useState<any[]>([]);
  const [teamRoles, setTeamRoles] = useState<any[]>([]);
  const [isTeamOwner, setIsTeamOwner] = useState(false);
  const [memberRole, setMemberRole] = useState<"admin" | "member" | null>(null);
  const [memberTeamRole, setMemberTeamRole] = useState<string | null>(null); // from team_roles table
  const [isSalesManager, setIsSalesManager] = useState(false);

  // Server-side pagination for transcripts
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalTranscripts, setTotalTranscripts] = useState(0);
  const [transcriptsLoading, setTranscriptsLoading] = useState(false);

  // Stats - loaded separately for performance
  const [stats, setStats] = useState<{
    totalCalls: number;
    avgScore: number;
    trend: number;
    dealRiskRate: number;
  }>({ totalCalls: 0, avgScore: 0, trend: 0, dealRiskRate: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Chart data - fetched separately from paginated table data
  const [chartData, setChartData] = useState<any[]>([]);

  // Add coaching note dialog
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const currentUid = user?.id || null;
      setCurrentUserId(currentUid);

      // Fetch member details
      const { data: memberData } = await supabase
        .from("users")
        .select("*")
        .eq("id", memberId)
        .single();

      // Get member's active team membership via team_org junction table
      const { data: memberTeamOrg } = await supabase
        .from("team_org")
        .select("team_id, team_role_id, is_sales_manager, team_roles(role_name)")
        .eq("user_id", memberId)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      if (memberTeamOrg) {
        const teamId = memberTeamOrg.team_id;

        // Set role info from team_org
        const roleName = (memberTeamOrg as any).team_roles?.role_name || null;
        setMemberTeamRole(roleName);
        setIsSalesManager(memberTeamOrg.is_sales_manager || false);

        // Determine member's role from team_role_id
        // team_roles: id=1 Admin, id=2 Sales Manager, id=3 Member
        if (memberTeamOrg.team_role_id === 1) {
          setMemberRole("admin");
        } else {
          setMemberRole("member");
        }

        // Fetch global team_roles
        const { data: rolesData } = await supabase
          .from("team_roles")
          .select("id, role_name, description, created_at");

        if (rolesData) {
          setTeamRoles(rolesData);
        }

        // Store the member's org entry for display
        setMemberOrgEntries([memberTeamOrg]);

        // Check if profile member is sales manager (owner equivalent)
        if (memberTeamOrg.is_sales_manager) {
          setIsTeamOwner(true);
        }

        if (currentUid) {
          // Check current user's role via team_org for admin access
          const { data: currentUserTeamOrg } = await supabase
            .from("team_org")
            .select("team_role_id, is_sales_manager")
            .eq("user_id", currentUid)
            .eq("team_id", teamId)
            .eq("active", true)
            .limit(1)
            .maybeSingle();

          // Admin role (team_role_id=1) or is_sales_manager grants admin access
          if (currentUserTeamOrg && (currentUserTeamOrg.team_role_id === 1 || currentUserTeamOrg.is_sales_manager)) {
            setIsAdmin(true);
          }
        }
      }

      // Fetch stats using aggregate queries (much faster than fetching all)
      setStatsLoading(true);
      const { count: totalCount } = await supabase
        .from("transcripts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", memberId)
        .not("duration", "is", null)
        .gte("duration", 5);

      setTotalTranscripts(totalCount || 0);

      // Fetch scored transcripts for stats calculation AND chart visualization
      // Include ai_category_breakdown and title for charts
      const { data: scoredData } = await supabase
        .from("transcripts")
        .select("ai_overall_score, ai_deal_risk_alerts, ai_category_breakdown, created_at, title")
        .eq("user_id", memberId)
        .not("duration", "is", null)
        .gte("duration", 5)
        .not("ai_overall_score", "is", null)
        .order("created_at", { ascending: false })
        .limit(50); // Get recent 50 for stats calculation and charts

      // Calculate stats from scored data
      const scoredTranscripts = scoredData || [];
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

      setStats({
        totalCalls: totalCount || 0,
        avgScore,
        trend,
        dealRiskRate,
      });
      setStatsLoading(false);

      // Store scored data for chart visualization
      setChartData(scoredTranscripts);

      // Fetch first page of transcripts for table (server-side pagination)
      const { data: transcriptData } = await supabase
        .from("transcripts")
        .select("*")
        .eq("user_id", memberId)
        .not("duration", "is", null)
        .gte("duration", 5)
        .order("created_at", { ascending: false })
        .range(0, pageSize - 1);

      setTranscripts(transcriptData || []);

      // Fetch coaching notes
      const { data: notesData, error: notesError } = await supabase
        .from("coaching_notes")
        .select("*")
        .eq("user_id", memberId)
        .order("created_at", { ascending: false });

      let notesWithCoach: any[] = [];
      if (notesError) {
        console.log("Coaching notes not available:", notesError.message);
      } else if (notesData) {
        // Fetch coach info for each note
        const coachIds = [...new Set(notesData.map(n => n.coach_id).filter(Boolean))];
        let coachMap: Record<string, any> = {};

        if (coachIds.length > 0) {
          const { data: coaches } = await supabase
            .from("users")
            .select("id, name, email")
            .in("id", coachIds);

          if (coaches) {
            coachMap = Object.fromEntries(coaches.map(c => [c.id, c]));
          }
        }

        // Attach coach info to notes
        notesWithCoach = notesData.map(note => ({
          ...note,
          coach: coachMap[note.coach_id] || null
        }));
      }

      setMember(memberData);
      setCoachingNotes(notesWithCoach);
      setLoading(false);
    }

    load();
  }, [memberId, pageSize]);

  // Fetch transcripts for a specific page (server-side pagination)
  const fetchTranscriptsPage = useCallback(async (page: number, size: number) => {
    setTranscriptsLoading(true);
    const offset = (page - 1) * size;

    const { data, error } = await supabase
      .from("transcripts")
      .select("*")
      .eq("user_id", memberId)
      .not("duration", "is", null)
      .gte("duration", 5)
      .order("created_at", { ascending: false })
      .range(offset, offset + size - 1);

    if (!error && data) {
      setTranscripts(data);
    }
    setTranscriptsLoading(false);
  }, [memberId]);

  // Handle page changes with server-side fetch
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    fetchTranscriptsPage(newPage, pageSize);
  }, [fetchTranscriptsPage, pageSize]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    fetchTranscriptsPage(1, newSize);
  }, [fetchTranscriptsPage]);

  // Score breakdown by category - uses chartData (scored transcripts) not paginated table data
  const scoreBreakdown = useMemo(() => {
    const categoryScores: Record<string, { total: number; count: number }> = {};

    chartData.forEach((t) => {
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
  }, [chartData]);

  // Parse user's stored AI fields from the users table
  const userAiRecommendations = useMemo(() => {
    return parseJsonbArray(member?.ai_recommendations);
  }, [member]);

  const userKeyStrengths = useMemo(() => {
    return parseJsonbArray(member?.key_strengths);
  }, [member]);

  const userFocusAreas = useMemo(() => {
    return parseJsonbArray(member?.focus_areas);
  }, [member]);

  // Key strengths - prioritize stored data, fall back to computed
  const keyStrengths = useMemo(() => {
    // Use stored key_strengths from users table if available
    if (userKeyStrengths.length > 0) {
      return userKeyStrengths.map((skill, i) => ({ skill, count: 0, fromDb: true }));
    }

    // Fall back to computed from transcripts
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
      .map(([skill, count]) => ({ skill, count, fromDb: false }));
  }, [transcripts, userKeyStrengths]);

  // Focus areas - prioritize stored data, fall back to computed
  const focusAreas = useMemo(() => {
    // Use stored focus_areas from users table if available
    if (userFocusAreas.length > 0) {
      return userFocusAreas.map((skill, i) => ({ skill, count: 0, fromDb: true }));
    }

    // Fall back to computed from transcripts
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
      .map(([skill, count]) => ({ skill, count, fromDb: false }));
  }, [transcripts, userFocusAreas]);

  // AI Coaching Recommendations - prioritize stored data from users table
  const aiRecommendations = useMemo(() => {
    // Use stored ai_recommendations from users table if available
    if (userAiRecommendations.length > 0) {
      return userAiRecommendations.map((rec, i) => ({
        skill: `Recommendation ${i + 1}`,
        recommendation: rec,
        reason: null,
        fromDb: true,
      }));
    }

    // Fall back to computed from transcripts
    const recommendations: any[] = [];

    transcripts.slice(0, 5).forEach((t) => {
      if (t.ai_improvement_areas) {
        t.ai_improvement_areas.slice(0, 2).forEach((item: any) => {
          recommendations.push({
            skill: item.category_skill,
            recommendation: item.do_this_instead,
            reason: item.why_this_works_better,
            fromDb: false,
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
  }, [transcripts, userAiRecommendations]);

  // Score history for chart - uses chartData (scored transcripts) not paginated table data
  const scoreHistory = useMemo(() => {
    return chartData
      .filter((t) => t.ai_overall_score != null && t.created_at)
      .map((t) => ({
        date: new Date(t.created_at).toLocaleDateString(),
        score: Number(t.ai_overall_score),
        title: t.title,
      }))
      .reverse()
      .slice(-20);
  }, [chartData]);

  // Get the member's role name for display
  const memberRoleLabel = useMemo(() => {
    if (!memberOrgEntries.length || !teamRoles.length) return null;
    const orgEntry = memberOrgEntries[0]; // we stored the team_org entry here
    if (!orgEntry?.team_role_id) return null;
    const role = teamRoles.find((r: any) => r.id === orgEntry.team_role_id);
    return role?.role_name || null;
  }, [teamRoles, memberOrgEntries]);

  // Server-side pagination calculations
  const totalPages = Math.ceil(totalTranscripts / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalTranscripts);

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

  // Delete coaching note
  const deleteCoachingNote = async (noteId: string) => {
    setDeletingNoteId(noteId);

    const { error } = await supabase
      .from("coaching_notes")
      .delete()
      .eq("id", noteId);

    if (error) {
      toast.error("Failed to delete note");
      console.error("Delete error:", error);
    } else {
      toast.success("Coaching note deleted");
      // Remove note from local state
      setCoachingNotes((prev) => prev.filter((n) => n.id !== noteId));
    }

    setDeletingNoteId(null);
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
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className={`text-lg ${
                          isTeamOwner
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : memberRole === 'admin'
                            ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isTeamOwner && (
                        <div className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center ring-2 ring-background">
                          <Crown className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold">{member.name || "No Name"}</h1>
                        {/* Role Badge */}
                        {isTeamOwner ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-xs">
                            <Crown className="h-3 w-3" />
                            Owner
                          </Badge>
                        ) : memberRole === "admin" ? (
                          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 gap-1 text-xs">
                            <Shield className="h-3 w-3" />
                            Admin
                          </Badge>
                        ) : memberRole === "member" ? (
                          <Badge variant="outline" className="text-muted-foreground gap-1 text-xs">
                            Member
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                      {/* Role Label */}
                      {memberRoleLabel && !isTeamOwner && memberRole !== "admin" && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {memberRoleLabel}
                          </Badge>
                        </div>
                      )}
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
                      {transcripts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No calls recorded.
                          </TableCell>
                        </TableRow>
                      ) : (
                        transcripts.map((t) => (
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
                  {totalTranscripts > 0 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-muted-foreground hidden flex-1 text-sm lg:flex items-center gap-2">
                        {transcriptsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Showing {startIndex + 1} to {endIndex} of {totalTranscripts}
                      </div>
                      <div className="flex w-full items-center gap-8 lg:w-fit">
                        <div className="hidden items-center gap-2 lg:flex">
                          <Label className="text-sm font-medium">Rows per page</Label>
                          <Select
                            value={`${pageSize}`}
                            onValueChange={(value) => handlePageSizeChange(Number(value))}
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
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage === 1 || transcriptsLoading}
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1 || transcriptsLoading}
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
                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages || totalPages === 0 || transcriptsLoading}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
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
                            {!strength.fromDb && strength.count > 0 && (
                              <Badge variant="secondary">{strength.count}x</Badge>
                            )}
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
                            {!area.fromDb && area.count > 0 && (
                              <Badge variant="outline">{area.count}x flagged</Badge>
                            )}
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
                  {isAdmin && (
                    <Button onClick={() => setAddNoteOpen(true)} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {coachingNotes.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No coaching notes yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {coachingNotes.map((note) => (
                        <div key={note.id} className="border rounded-lg p-4 bg-muted/20">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm flex-1">{note.note}</p>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => deleteCoachingNote(note.id)}
                                disabled={deletingNoteId === note.id}
                              >
                                {deletingNoteId === note.id ? (
                                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                            <p className="text-xs text-muted-foreground">
                              Added by{" "}
                              <span className="font-medium text-foreground/80">
                                {note.coach?.name || note.coach?.email || "Admin"}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(note.created_at).toLocaleString()}
                            </p>
                          </div>
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
