"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Sparkles,
  Building2,
  TrendingUp,
  Phone,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Target,
  Globe,
  ExternalLink,
  Trash2,
  MessageSquareWarning,
  ChevronDown,
  CheckCircle,
  MessageCircle,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import axiosClient from "@/lib/axiosClient";
import Image from "next/image";
import { getCompaniesPaginated, getCompanyStats, type CompanyStats } from "@/lib/supabaseCache";

import { AskAICoach } from "@/components/AskAICoach";

// --------------------------------------------------
// Cache utilities
// --------------------------------------------------
const CACHE_TTL = {
  COMPANIES: 5 * 60 * 1000, // 5 minutes
};

function getCachedData<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function setCachedData(key: string, data: any, timestamp?: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ data, timestamp: timestamp || Date.now() })
    );
  } catch {
    // Ignore cache errors
  }
}

function isCacheValid(key: string, ttl: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return false;
    const { timestamp } = JSON.parse(cached);
    return Date.now() - timestamp < ttl;
  } catch {
    return false;
  }
}

// --------------------------------------------------
// Utility – extract industry from domain
// --------------------------------------------------
function industryFromDomain(domain: string) {
  if (!domain) return "Unknown";
  if (domain.includes("tech")) return "Technology";
  if (domain.includes("health")) return "Healthcare";
  if (domain.includes("fin")) return "Finance";
  if (domain.includes("soft")) return "SaaS";
  return "General";
}

// --------------------------------------------------
// Utility – extract domain from URL for logo
// --------------------------------------------------
function getDomainFromUrl(url: string): string {
  if (!url) return "";
  try {
    let domain = url.toLowerCase().trim();
    // Remove protocol
    domain = domain.replace(/^https?:\/\//, "");
    // Remove www.
    domain = domain.replace(/^www\./, "");
    // Remove path
    domain = domain.split("/")[0];
    return domain;
  } catch {
    return "";
  }
}

// --------------------------------------------------
// MAIN PAGE
// --------------------------------------------------
export default function CompaniesPage() {
  const router = useRouter();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [myCompany, setMyCompany] = useState<any>(null);
  const [detectedCompanies, setDetectedCompanies] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [totalCompaniesCount, setTotalCompaniesCount] = useState(0);
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null);

  // Combined filter state for reduced re-renders
  const [filters, setFilters] = useState({
    q: "",
    industry: "all",
    risk: "all",
    sortBy: "calls",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states combined
  const [modalState, setModalState] = useState({
    selectedCompany: null as any,
    goal: "",
    saving: false,
    addDialogOpen: false,
    newCompanyName: "",
    newCompanyDomain: "",
    newCompanyUrl: "",
    addingSaving: false,
    deleteDialogOpen: false,
    companyToDelete: null as any,
    isDeleting: false,
  });

  // Predict Companies
  const [predicting, setPredicting] = useState(false);
  const [predictionClicked, setPredictionClicked] = useState(false);


  // LocalStorage key for prediction state
  const PREDICTION_CLICKED_KEY = "prediction_companies_clicked";

  // --------------------------------------------------
  // Load prediction clicked state from localStorage
  // --------------------------------------------------
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedState = localStorage.getItem(PREDICTION_CLICKED_KEY);
      if (savedState === "true") {
        setPredictionClicked(true);
      }
    }
  }, []);

  // Store user's company ID to avoid refetching
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // --------------------------------------------------
  // Debounce search for server-side filtering
  // --------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.q);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.q]);

  // --------------------------------------------------
  // Initial load - fetch user's company once
  // --------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadUserCompany() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !isMounted) {
        if (isMounted) {
          setIsInitialLoading(false);
          setInitialLoadDone(true);
        }
        return;
      }

      // Fetch user's company once
      const myCompResult = await supabase
        .from("company")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (isMounted) {
        setMyCompany(myCompResult.data || null);
        setMyCompanyId(myCompResult.data?.id || null);
        setInitialLoadDone(true);

        // Fetch aggregate stats (runs once)
        if (myCompResult.data?.id) {
          const stats = await getCompanyStats(myCompResult.data.id, supabase);
          if (isMounted) {
            setCompanyStats(stats);
          }
        }
      }
    }

    loadUserCompany();

    return () => {
      isMounted = false;
    };
  }, []);

  // --------------------------------------------------
  // Load paginated companies - only fetch batch for current page
  // --------------------------------------------------
  useEffect(() => {
    // Wait for initial load to complete
    if (!initialLoadDone) return;

    let isMounted = true;

    async function loadCompanies() {
      if (!myCompanyId) {
        setDetectedCompanies([]);
        setCalls([]);
        setTotalCompaniesCount(0);
        setIsInitialLoading(false);
        setIsTableLoading(false);
        return;
      }

      // Show table skeleton during fetch (not full page loading)
      setIsTableLoading(true);

      // Use server-side pagination - fetch ONLY the current page's batch
      const paginatedResult = await getCompaniesPaginated(
        myCompanyId,
        supabase,
        page,
        pageSize,
        debouncedSearch
      );

      if (!isMounted) return;

      setDetectedCompanies(paginatedResult.data);
      setTotalCompaniesCount(paginatedResult.totalCount);

      // Clear prediction state if companies exist
      if (paginatedResult.totalCount > 0) {
        localStorage.removeItem(PREDICTION_CLICKED_KEY);
        setPredictionClicked(false);
      }

      // Get the detected company IDs to fetch their calls
      const detectedCompanyIds = paginatedResult.data.map((c: any) => c.id);

      if (detectedCompanyIds.length === 0) {
        setCalls([]);
        setIsTableLoading(false);
        setIsInitialLoading(false);
        return;
      }

      // Fetch calls and transcripts for the visible companies only
      const [callsResult, transcriptsResult] = await Promise.all([
        supabase
          .from("external_org_calls")
          .select("company_id, created_at, transcript_id")
          .in("company_id", detectedCompanyIds),
        supabase.from("transcripts").select("id, ai_overall_score"),
      ]);

      if (!isMounted) return;

      // Build transcript scores map
      const transcriptScores: Record<number, number> = {};
      if (transcriptsResult.data) {
        transcriptsResult.data.forEach((t) => {
          if (t.ai_overall_score != null && !isNaN(t.ai_overall_score)) {
            transcriptScores[t.id] = Number(t.ai_overall_score);
          }
        });
      }

      // Attach scores to calls
      const callsWithScores = (callsResult.data || []).map((call) => ({
        ...call,
        score: transcriptScores[call.transcript_id] ?? null,
      }));

      setCalls(callsWithScores);
      setIsTableLoading(false);
      setIsInitialLoading(false);
    }

    loadCompanies();

    return () => {
      isMounted = false;
    };
  }, [initialLoadDone, myCompanyId, page, pageSize, debouncedSearch]);

  // --------------------------------------------------
  // Enhancing detected company objects
  // --------------------------------------------------
  const combinedData = useMemo(() => {
    return detectedCompanies.map((c) => {
      const companyCalls = calls.filter((x) => x.company_id === c.id);

      const lastCall = companyCalls.length
        ? new Date(
            companyCalls[companyCalls.length - 1].created_at
          ).toLocaleDateString()
        : "No calls";

      // Calculate average score from calls with valid scores
      const callsWithScores = companyCalls.filter(
        (call) => call.score != null && !isNaN(call.score)
      );
      const avgScore = callsWithScores.length > 0
        ? Math.round(
            callsWithScores.reduce((sum, call) => sum + call.score, 0) /
              callsWithScores.length
          )
        : null;

      return {
        ...c,
        calls: companyCalls.length,
        lastCall,
        industry: industryFromDomain(c.domain),
        score: avgScore,
        risk: companyCalls.length === 0 ? "Critical" : "Low",
      };
    });
  }, [detectedCompanies, calls]);

  // --------------------------------------------------
  // Stats calculations - use server-side aggregate stats
  // --------------------------------------------------
  const stats = useMemo(() => {
    // Use server-side aggregate stats for accurate totals
    if (companyStats) {
      return {
        totalCompanies: companyStats.totalCompanies,
        totalCalls: companyStats.totalCalls,
        avgScore: companyStats.avgScore,
        atRisk: companyStats.atRiskCount,
      };
    }

    // Fallback to page data while loading
    return {
      totalCompanies: totalCompaniesCount,
      totalCalls: combinedData.reduce((sum, c) => sum + c.calls, 0),
      avgScore: 0,
      atRisk: combinedData.filter((c) => c.risk === "Critical").length,
    };
  }, [companyStats, totalCompaniesCount, combinedData]);

  // --------------------------------------------------
  // Aggregate pain points from all companies
  // --------------------------------------------------
  const aggregatedPainPoints = useMemo(() => {
    const painPointsWithCompany: { painPoint: string; companyName: string; companyId: number }[] = [];

    detectedCompanies.forEach((company) => {
      if (company.pain_points && Array.isArray(company.pain_points)) {
        company.pain_points.forEach((painPoint: string) => {
          painPointsWithCompany.push({
            painPoint,
            companyName: company.company_name,
            companyId: company.id,
          });
        });
      }
    });

    return painPointsWithCompany;
  }, [detectedCompanies]);

  // Pain points expanded state
  const [painPointsExpanded, setPainPointsExpanded] = useState(false);
  const PAIN_POINTS_COLLAPSED_COUNT = 5;

  // --------------------------------------------------
  // Filters with debounced search
  // --------------------------------------------------
  const filtered = useMemo(() => {
    let rows = [...combinedData];

    if (filters.q.trim())
      rows = rows.filter((c) =>
        c.company_name.toLowerCase().includes(filters.q.toLowerCase())
      );
    if (filters.industry !== "all")
      rows = rows.filter((c) => c.industry === filters.industry);
    if (filters.risk !== "all")
      rows = rows.filter((c) => (c.risk ?? "Low") === filters.risk);

    rows.sort((a, b) =>
      filters.sortBy === "score" ? (b.score || 0) - (a.score || 0) : b.calls - a.calls
    );
    return rows;
  }, [filters, combinedData]);

  const industries = useMemo(
    () => Array.from(new Set(combinedData.map((c) => c.industry))),
    [combinedData]
  );

  // Server-side pagination - no need to slice, data is already paginated
  const maxPage = Math.ceil(totalCompaniesCount / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCompaniesCount);
  const pageItems = filtered; // Already paginated from server

  useEffect(() => {
    if (page > maxPage && maxPage > 0) setPage(1);
  }, [maxPage, page]);

  // --------------------------------------------------
  // Memoized Filter Handlers with debounce for search
  // --------------------------------------------------
  const handleSearch = useCallback((value: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, q: value }));
    }, 300);
  }, []);

  const handleIndustryChange = useCallback(
    (value: string) => setFilters((prev) => ({ ...prev, industry: value })),
    []
  );

  const handleRiskChange = useCallback(
    (value: string) => setFilters((prev) => ({ ...prev, risk: value })),
    []
  );

  const handleSortChange = useCallback(
    (value: string) => setFilters((prev) => ({ ...prev, sortBy: value })),
    []
  );

  const handleRowClick = useCallback(
    (companyId: number) => {
      router.push(`/companies/${companyId}`);
    },
    [router]
  );

  // --------------------------------------------------
  // Save Goal
  // --------------------------------------------------
  const saveGoal = useCallback(async () => {
    if (!modalState.goal.trim()) {
      toast.error("Please enter a company goal");
      return;
    }

    try {
      setModalState((prev) => ({ ...prev, saving: true }));

      const { error } = await supabase
        .from("external_org")
        .update({ company_goal_objective: modalState.goal })
        .eq("id", modalState.selectedCompany.id);

      if (error) throw error;

      toast.success("Company goal saved!");
      setModalState((prev) => ({
        ...prev,
        selectedCompany: null,
        goal: "",
        saving: false,
      }));
    } catch (err: any) {
      toast.error(err.message);
      setModalState((prev) => ({ ...prev, saving: false }));
    }
  }, [modalState.goal, modalState.selectedCompany]);

  // --------------------------------------------------
  // Predict Companies (trigger Inngest workflow)
  // --------------------------------------------------
  async function predictCompanies() {
    try {
      setPredicting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      // Save prediction clicked state to localStorage
      localStorage.setItem(PREDICTION_CLICKED_KEY, "true");
      setPredictionClicked(true);

      await axiosClient.post("/api/inngest/trigger", {
        event: "companies/predict.requested",
        data: { user_id: user.id },
      });

      toast.success("Prediction workflow triggered successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to predict companies");
    } finally {
      setPredicting(false);
    }
  }

  // --------------------------------------------------
  // Add New Company
  // --------------------------------------------------
  const addNewCompany = useCallback(async () => {
    if (!modalState.newCompanyName.trim()) {
      toast.error("Please enter a company name");
      return;
    }

    try {
      setModalState((prev) => ({ ...prev, addingSaving: true }));

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        setModalState((prev) => ({ ...prev, addingSaving: false }));
        return;
      }

      // Parallel: insert company and get user's company
      const [userCompanyResult, insertResult] = await Promise.all([
        supabase.from("company").select("id").eq("user_id", user.id).single(),
        supabase
          .from("external_org")
          .insert([
            {
              company_name: modalState.newCompanyName,
              domain: modalState.newCompanyDomain || null,
              company_id: myCompany?.id || null,
            },
          ])
          .select(),
      ]);

      if (insertResult.error) throw insertResult.error;

      toast.success("Company added successfully!");

      // Refresh the companies list
      const { data: detected } = await supabase.from("external_org").select("*");
      setDetectedCompanies(detected || []);

      // Invalidate cache
      if (user) {
        const cacheKey = `companies-data-${user.id}`;
        localStorage.removeItem(cacheKey);
      }

      // Reset form and close dialog
      setModalState((prev) => ({
        ...prev,
        newCompanyName: "",
        newCompanyDomain: "",
        newCompanyUrl: "",
        addDialogOpen: false,
        addingSaving: false,
      }));
    } catch (err: any) {
      toast.error(err.message);
      setModalState((prev) => ({ ...prev, addingSaving: false }));
    }
  }, [modalState.newCompanyName, modalState.newCompanyDomain, myCompany]);

  // --------------------------------------------------
  // Delete Company
  // --------------------------------------------------
  const handleDeleteClick = useCallback((e: React.MouseEvent, company: any) => {
    e.stopPropagation();
    setModalState((prev) => ({
      ...prev,
      companyToDelete: company,
      deleteDialogOpen: true,
    }));
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!modalState.companyToDelete) return;

    setModalState((prev) => ({ ...prev, isDeleting: true }));

    try {
      // First, get all transcript IDs associated with this company
      const { data: companyCalls } = await supabase
        .from("external_org_calls")
        .select("transcript_id")
        .eq("company_id", modalState.companyToDelete.id);

      const transcriptIds = companyCalls?.map((cc) => cc.transcript_id).filter(Boolean) || [];

      // Delete the company_calls records
      const { error: callsError } = await supabase
        .from("external_org_calls")
        .delete()
        .eq("company_id", modalState.companyToDelete.id);

      if (callsError) {
        console.warn("Error deleting company_calls:", callsError);
        // Continue anyway - there might not be any calls
      }

      // Delete the transcripts associated with this company
      if (transcriptIds.length > 0) {
        const { error: transcriptsError } = await supabase
          .from("transcripts")
          .delete()
          .in("id", transcriptIds);

        if (transcriptsError) {
          console.warn("Error deleting transcripts:", transcriptsError);
        }
      }

      // Now delete the company
      const { error } = await supabase
        .from("external_org")
        .delete()
        .eq("id", modalState.companyToDelete.id);

      if (error) throw error;

      // Remove from local state immediately for instant feedback
      setDetectedCompanies((prev) =>
        prev.filter((c) => c.id !== modalState.companyToDelete.id)
      );
      setTotalCompaniesCount((prev) => Math.max(0, prev - 1));

      // Invalidate cache
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const cacheKey = `companies-data-${user.id}`;
        localStorage.removeItem(cacheKey);
      }

      toast.success("Company, associated calls, and transcripts deleted successfully");
      setModalState((prev) => ({
        ...prev,
        deleteDialogOpen: false,
        companyToDelete: null,
        isDeleting: false,
      }));
    } catch (err: any) {
      console.error("Error deleting company:", err);
      toast.error(err.message || "Failed to delete company");
      setModalState((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [modalState.companyToDelete]);

  const handleCancelDelete = useCallback(() => {
    setModalState((prev) => ({
      ...prev,
      deleteDialogOpen: false,
      companyToDelete: null,
    }));
  }, []);

  // --------------------------------------------------
  // Initial Loading State - only show full page loader on first load
  // --------------------------------------------------
  if (isInitialLoading && detectedCompanies.length === 0) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader heading="Companies" />
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading companies...</p>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader heading="Companies" />

        <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Your Company Banner */}
          {myCompany && (
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <MyCompanyLogo url={myCompany.company_url} name={myCompany.company_name} />
                    <div>
                      <h3 className="font-semibold text-lg">{myCompany.company_name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" />
                        {myCompany.company_url || "No website added"}
                      </p>
                    </div>
                  </div>
                  {myCompany.company_url && (
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                      <a href={myCompany.company_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Visit Website
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard
              title="Total Companies"
              value={stats.totalCompanies}
              icon={<Building2 className="h-4 w-4" />}
              trend="Detected from calls"
            />
            <StatsCard
              title="Total Calls"
              value={stats.totalCalls}
              icon={<Phone className="h-4 w-4" />}
              trend="All time"
            />
            <StatsCard
              title="Average Score"
              value={stats.avgScore}
              icon={<TrendingUp className="h-4 w-4" />}
              trend="Across companies"
              valueColor={
                stats.avgScore >= 80
                  ? "text-emerald-600"
                  : stats.avgScore >= 60
                  ? "text-amber-600"
                  : "text-red-600"
              }
            />
            <StatsCard
              title="At Risk"
              value={stats.atRisk}
              icon={<AlertTriangle className="h-4 w-4" />}
              trend="Need attention"
              valueColor={stats.atRisk > 0 ? "text-red-600" : "text-emerald-600"}
            />
          </div>

          {/* Uncovered Pain Points Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquareWarning className="h-5 w-5 text-orange-500" />
                  Uncovered Pain Points
                </CardTitle>
                {aggregatedPainPoints.length > 0 && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300 dark:border-orange-700">
                    {aggregatedPainPoints.length} across all companies
                  </Badge>
                )}
              </div>
              <CardDescription>
                Customer challenges and concerns identified across all company calls
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aggregatedPainPoints.length > 0 ? (
                <div className="space-y-3">
                  {aggregatedPainPoints.slice(0, painPointsExpanded ? aggregatedPainPoints.length : PAIN_POINTS_COLLAPSED_COUNT).map((item, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-orange-500/5 border border-orange-200/40 dark:border-orange-500/20 hover:bg-orange-500/10 transition-colors cursor-pointer"
                      onClick={() => router.push(`/companies/${item.companyId}`)}
                    >
                      <div className="flex gap-3">
                        <div className="h-6 w-6 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-orange-700 dark:text-orange-300 leading-relaxed">
                            {item.painPoint}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {item.companyName}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {aggregatedPainPoints.length > PAIN_POINTS_COLLAPSED_COUNT && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-500/10"
                      onClick={() => setPainPointsExpanded(!painPointsExpanded)}
                    >
                      <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${painPointsExpanded ? 'rotate-180' : ''}`} />
                      {painPointsExpanded
                        ? 'View Less'
                        : `View More (${aggregatedPainPoints.length - PAIN_POINTS_COLLAPSED_COUNT} more)`}
                    </Button>
                  )}
                  {/* Footer Note */}
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <p>Pain points are automatically extracted from call transcripts using AI analysis.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <MessageSquareWarning className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    No pain points identified yet
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Pain points will be automatically extracted as more calls are analyzed. They help you understand customer challenges and tailor your approach.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Header + Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Detected Companies
              </h2>
              <p className="text-sm text-muted-foreground">
                Auto-detected from your call transcripts using AI
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={predictCompanies}
                disabled={predicting}
              >
                {predicting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {predicting ? "Predicting..." : "Predict Companies"}
              </Button>

              <Button
                className="gap-2"
                onClick={() =>
                  setModalState((prev) => ({ ...prev, addDialogOpen: true }))
                }
              >
                <Plus className="h-4 w-4" /> Add Company
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                defaultValue={filters.q}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filters.industry} onValueChange={handleIndustryChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {industries.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.risk} onValueChange={handleRiskChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Low">Healthy</SelectItem>
                <SelectItem value="Warning">Warning</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calls">Most Calls</SelectItem>
                <SelectItem value="score">Highest Score</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Companies Table */}
          <ErrorBoundary>
          {isTableLoading ? (
            // Table skeleton during loading
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead className="text-center">Calls</TableHead>
                    <TableHead>Last Call</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(pageSize)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-lg" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-[150px]" />
                            <Skeleton className="h-3 w-[100px]" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-[30px] mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-6 w-[60px] mx-auto rounded-full" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-[40px] mx-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-[80px] ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : filtered.length === 0 ? (
            predictionClicked ? (
              // Prediction in progress animation
              <div className="py-16">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="relative mb-6">
                    {/* Outer rotating ring */}
                    <div className="absolute inset-0 h-24 w-24 rounded-full border-4 border-primary/20 animate-pulse" />
                    <div className="h-24 w-24 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                    {/* Inner sparkle icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative">
                        <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                        <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-ping" />
                        <div className="absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-primary animate-ping" style={{ animationDelay: '0.5s' }} />
                      </div>
                    </div>
                  </div>
                  <h3 className="font-semibold text-xl mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Predicting Companies
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-4">
                    Our AI is analyzing your call transcripts to detect and predict potential companies. This may take a moment...
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>Processing</span>
                  </div>
                </div>
              </div>
            ) : (
              // Default empty state
              <div className="py-16">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-lg mb-1">No companies found</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {filters.q ||
                    filters.industry !== "all" ||
                    filters.risk !== "all"
                      ? "Try adjusting your filters to see more results."
                      : "Companies will appear here once detected from your call transcripts."}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead className="text-center">Calls</TableHead>
                    <TableHead>Last Call</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(c.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <CompanyLogo domain={c.domain} companyName={c.company_name} />
                          <div>
                            <div className="font-medium">
                              {c.company_name}
                            </div>
                            {c.domain && (
                              <div className="text-xs text-muted-foreground">
                                {c.domain}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{c.industry}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {c.calls}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.lastCall}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge level={c.risk} />
                      </TableCell>
                      <TableCell className="text-center">
                        <ScoreIndicator score={c.score} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalState((prev) => ({
                                ...prev,
                                selectedCompany: c,
                              }));
                            }}
                          >
                            <Target className="h-3.5 w-3.5" />
                            Add Goal
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleDeleteClick(e, c)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete company</span>
                          </Button>
                        </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
          )}
          </ErrorBoundary>

          {/* Pagination */}
          {totalCompaniesCount > 0 && (
            <div className="flex items-center justify-between py-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {endIndex} of{" "}
                    {totalCompaniesCount} companies
                  </p>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        setPageSize(Number(v));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 text-sm font-medium">
                        {page} / {maxPage}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                        disabled={page === maxPage}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPage(maxPage)}
                        disabled={page === maxPage}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
        </div>
      </SidebarInset>

      {/* GOAL MODAL */}
      <Dialog
        open={!!modalState.selectedCompany}
        onOpenChange={() =>
          setModalState((prev) => ({ ...prev, selectedCompany: null }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Set Company Goal
            </DialogTitle>
            <DialogDescription>
              Define a goal or objective for{" "}
              {modalState.selectedCompany?.company_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="goal">Goal / Objective</Label>
              <Textarea
                id="goal"
                placeholder="e.g., Close enterprise deal by Q4, Expand to 10 seats..."
                value={modalState.goal}
                onChange={(e) =>
                  setModalState((prev) => ({ ...prev, goal: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setModalState((prev) => ({ ...prev, selectedCompany: null }))
              }
            >
              Cancel
            </Button>
            <Button
              onClick={saveGoal}
              disabled={modalState.saving}
              className="gap-2"
            >
              {modalState.saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Goal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD COMPANY MODAL */}
      <Dialog
        open={modalState.addDialogOpen}
        onOpenChange={(open) =>
          setModalState((prev) => ({ ...prev, addDialogOpen: open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Add New Company
            </DialogTitle>
            <DialogDescription>
              Manually add a company to track
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company-name"
                placeholder="Enter company name"
                value={modalState.newCompanyName}
                onChange={(e) =>
                  setModalState((prev) => ({
                    ...prev,
                    newCompanyName: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-domain">Industry / Domain</Label>
              <Input
                id="company-domain"
                placeholder="e.g., technology, finance, healthcare"
                value={modalState.newCompanyDomain}
                onChange={(e) =>
                  setModalState((prev) => ({
                    ...prev,
                    newCompanyDomain: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-url">Website URL</Label>
              <Input
                id="company-url"
                placeholder="https://example.com"
                value={modalState.newCompanyUrl}
                onChange={(e) =>
                  setModalState((prev) => ({
                    ...prev,
                    newCompanyUrl: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setModalState((prev) => ({
                  ...prev,
                  addDialogOpen: false,
                  newCompanyName: "",
                  newCompanyDomain: "",
                  newCompanyUrl: "",
                }));
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={addNewCompany}
              disabled={modalState.addingSaving}
              className="gap-2"
            >
              {modalState.addingSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Company
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE COMPANY CONFIRMATION MODAL */}
      <Dialog
        open={modalState.deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelDelete();
        }}
      >
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

            {modalState.companyToDelete && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {modalState.companyToDelete.company_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {modalState.companyToDelete.domain || "No domain"} ·{" "}
                      {modalState.companyToDelete.calls || 0} calls
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={modalState.isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={modalState.isDeleting}
              className="gap-2"
            >
              {modalState.isDeleting ? (
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

      {/* AI Coach */}
      <AskAICoach
        context={{
          type: "companies",
          totalCompanies: stats.totalCompanies,
          totalCalls: stats.totalCalls,
          avgScore: stats.avgScore,
          atRisk: stats.atRisk,
          painPoints: aggregatedPainPoints.map(p => p.painPoint).slice(0, 10),
          companies: combinedData.slice(0, 10).map(c => ({
            name: c.company_name,
            calls: c.calls,
            score: c.score,
            risk: c.risk,
            lastCall: c.lastCall,
          })),
        }}
        panelTitle="Companies Coach"
        placeholder="Ask about your companies, pain points, risk analysis..."
        quickActions={[
          "Which companies need attention?",
          "Summarize pain points",
          "Show at-risk accounts",
          "Top performing companies",
        ]}
      />
    </SidebarProvider>
  );
}

// --------------------------------------------------
// Helper Components
// --------------------------------------------------

function StatsCard({
  title,
  value,
  icon,
  trend,
  valueColor,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend: string;
  valueColor?: string;
}) {
  return (
    <Card className="border-border/60 bg-card/60 shadow-sm backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
        <div className={`text-2xl font-bold ${valueColor || ""}`}>{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{trend}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; className: string }> = {
    Low: {
      label: "Healthy",
      className:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    },
    Warning: {
      label: "Warning",
      className:
        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    },
    Critical: {
      label: "At Risk",
      className:
        "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
    },
  };

  const { label, className } = config[level] || config.Low;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function ScoreIndicator({ score }: { score: number | null }) {
  // Handle null or invalid scores - show scoring animation
  if (score == null) {
    return (
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </div>
          <span className="text-[10px] font-medium text-primary/80">Scoring</span>
        </div>
      </div>
    );
  }

  const getColor = () => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  const getTextColor = () => {
    if (score >= 80) return "text-emerald-700 dark:text-emerald-400";
    if (score >= 60) return "text-amber-700 dark:text-amber-400";
    return "text-red-700 dark:text-red-400";
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <div className="relative h-8 w-8">
        <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            className="stroke-muted"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            className={`${getColor().replace("bg-", "stroke-")}`}
            strokeWidth="3"
            strokeDasharray={`${(score / 100) * 88} 88`}
            strokeLinecap="round"
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${getTextColor()}`}
        >
          {score}
        </span>
      </div>
    </div>
  );
}

function CompanyLogo({ domain, companyName }: { domain: string; companyName: string }) {
  const [imageError, setImageError] = useState(false);

  // Check if domain looks like a valid website domain (has a TLD like .com, .io, etc.)
  const cleanDomain = getDomainFromUrl(domain);
  const isValidDomain = cleanDomain && /\.[a-z]{2,}$/i.test(cleanDomain);
  const logoUrl = isValidDomain ? `https://logo.clearbit.com/${cleanDomain}` : null;

  // Show icon fallback if no valid domain or image failed to load
  if (!logoUrl || imageError) {
    return (
      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-10 w-10 rounded-lg shrink-0 overflow-hidden bg-white dark:bg-white/90 shadow-sm border border-border/50">
      <Image
        src={logoUrl}
        alt={`${companyName} logo`}
        width={40}
        height={40}
        className="h-10 w-10 object-contain p-1"
        onError={() => setImageError(true)}
        unoptimized
      />
    </div>
  );
}

function MyCompanyLogo({ url, name }: { url?: string; name?: string }) {
  const [imageError, setImageError] = useState(false);

  const cleanDomain = getDomainFromUrl(url || "");
  const logoUrl = cleanDomain ? `https://logo.clearbit.com/${cleanDomain}` : null;

  // Show fallback if no url or image failed to load
  if (!logoUrl || imageError) {
    return (
      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
        <Building2 className="h-6 w-6 text-primary" />
      </div>
    );
  }

  return (
    <div className="h-12 w-12 rounded-xl shrink-0 overflow-hidden bg-white shadow-sm">
      <Image
        src={logoUrl}
        alt={`${name || "Company"} logo`}
        width={48}
        height={48}
        className="h-12 w-12 object-contain"
        onError={() => setImageError(true)}
        unoptimized
      />
    </div>
  );
}
