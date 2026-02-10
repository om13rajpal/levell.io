"use client";

import { useEffect, useState, useMemo, useCallback, memo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Loader2,
  Phone,
  TrendingUp,
  TrendingDown,
  Star,
  Calendar,
  FileText,
  Trash2,
  AlertTriangle,
  MessageCircle,
  X,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import {
  getTranscriptsPaginated,
  TranscriptFilters,
  clearTranscriptPageCache,
} from "@/lib/supabaseCache";
import { toast } from "sonner";
import dynamic from "next/dynamic";
const ChartAreaInteractive = dynamic(
  () => import("@/components/chart-area-interactive").then(mod => ({ default: mod.ChartAreaInteractive })),
  { ssr: false, loading: () => <div className="h-[300px] w-full animate-pulse rounded-lg bg-muted" /> }
);
import { AskAICoach } from "@/components/AskAICoach";

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

// Loading skeleton component - accepts rows prop to match pageSize
const TableSkeleton = memo(({ rows = 10 }: { rows?: number }) => (
  <TableBody>
    {[...Array(rows)].map((_, i) => (
      <TableRow key={i}>
        <TableCell>
          <Skeleton className="h-4 w-[200px]" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-[80px]" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-6 w-[60px]" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-[150px]" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-8 w-8 rounded" />
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
));
TableSkeleton.displayName = "TableSkeleton";

function CallsDashboard() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scoreRange, setScoreRange] = useState([0, 100]);
  const [durationMin, setDurationMin] = useState<string>(""); // No default filter - show all calls including imports
  const [durationMax, setDurationMax] = useState<string>("");
  const [onlyScoredCalls, setOnlyScoredCalls] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTableLoading, setIsTableLoading] = useState(false);

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [paginatedTranscripts, setPaginatedTranscripts] = useState<any[]>([]);

  // Stats for the header cards
  const [stats, setStats] = useState({
    totalCalls: 0,
    avgScore: 0,
    scoredCalls: 0,
    recentTrend: 0,
  });

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transcriptToDelete, setTranscriptToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track score range values separately to avoid array reference issues
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);

  // AI Agent panel state

  // Debounce search input with loading state for smooth UX
  useEffect(() => {
    // Show searching state immediately when user types
    if (search !== debouncedSearch) {
      setIsSearching(true);
    }

    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
      // Add a slight delay before hiding the loader for smoother transition
      setTimeout(() => setIsSearching(false), 150);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  // Update score range values when scoreRange changes
  useEffect(() => {
    setScoreMin(scoreRange[0]);
    setScoreMax(scoreRange[1]);
    setCurrentPage(1); // Reset to first page when filters change
  }, [scoreRange]);

  // Server-side paginated data fetching - only fetch visible page
  useEffect(() => {
    let isMounted = true;

    const fetchTranscripts = async () => {
      if (typeof window === "undefined") return;

      try {
        // Show table loading (skeleton) - don't reset initial loading after first load
        setIsTableLoading(true);

        // Get auth token
        const token = localStorage.getItem(
          "sb-tuzuwzglmyajuxytaowi-auth-token"
        );
        if (!token) {
          if (isMounted) {
            setIsTableLoading(false);
            setIsInitialLoading(false);
          }
          return;
        }

        const parsed = JSON.parse(token);
        const userId = parsed?.user?.id;
        if (!userId) {
          if (isMounted) {
            setIsTableLoading(false);
            setIsInitialLoading(false);
          }
          return;
        }

        // Use server-side pagination - fetch ONLY the current page's batch
        const result = await getTranscriptsPaginated(
          userId,
          supabase,
          currentPage,
          pageSize,
          debouncedSearch,
          scoreMin > 0 ? scoreMin : undefined,
          scoreMax < 100 ? scoreMax : undefined
        );

        if (isMounted) {
          setPaginatedTranscripts(result.data);
          setTotalCount(result.totalCount);

          // Calculate stats from the data
          const scoredTranscripts = result.data.filter(
            (t: any) => t.ai_overall_score != null && !isNaN(t.ai_overall_score)
          );
          const avgScore =
            scoredTranscripts.length > 0
              ? Math.round(
                  scoredTranscripts.reduce(
                    (acc: number, t: any) => acc + Number(t.ai_overall_score),
                    0
                  ) / scoredTranscripts.length
                )
              : 0;

          // Calculate trend from recent vs older calls
          const recentCalls = scoredTranscripts.slice(
            0,
            Math.ceil(scoredTranscripts.length / 2)
          );
          const olderCalls = scoredTranscripts.slice(
            Math.ceil(scoredTranscripts.length / 2)
          );
          const recentAvg =
            recentCalls.length > 0
              ? recentCalls.reduce(
                  (acc: number, t: any) => acc + Number(t.ai_overall_score),
                  0
                ) / recentCalls.length
              : 0;
          const olderAvg =
            olderCalls.length > 0
              ? olderCalls.reduce(
                  (acc: number, t: any) => acc + Number(t.ai_overall_score),
                  0
                ) / olderCalls.length
              : recentAvg;
          const trend =
            olderAvg > 0
              ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
              : 0;

          setStats({
            totalCalls: result.totalCount,
            avgScore,
            scoredCalls: scoredTranscripts.length,
            recentTrend: trend,
          });
        }
      } catch (err) {
        console.error("Error fetching transcripts:", err);
      } finally {
        if (isMounted) {
          setIsTableLoading(false);
          setIsInitialLoading(false);
          setIsSearching(false);
        }
      }
    };

    fetchTranscripts();

    return () => {
      isMounted = false;
    };
  }, [currentPage, pageSize, debouncedSearch, scoreMin, scoreMax]);

  // Client-side filtering for additional filters not handled by server
  const filteredTranscripts = useMemo(() => {
    return paginatedTranscripts.filter((t) => {
      // Only scored calls filter - check for valid numeric score
      if (onlyScoredCalls) {
        const score = t.ai_overall_score;
        if (score == null || (typeof score === "number" && isNaN(score))) {
          return false;
        }
      }

      // Duration filter (min) - duration is in minutes
      if (durationMin) {
        const minMinutes = parseInt(durationMin);
        if (!isNaN(minMinutes)) {
          // If duration is null or less than minimum, filter out
          if (t.duration == null || t.duration < minMinutes) {
            return false;
          }
        }
      }

      // Duration filter (max) - duration is in minutes
      if (durationMax && t.duration != null) {
        const maxMinutes = parseInt(durationMax);
        if (!isNaN(maxMinutes) && t.duration > maxMinutes) {
          return false;
        }
      }

      return true;
    });
  }, [paginatedTranscripts, durationMin, durationMax, onlyScoredCalls]);

  // Server-side pagination calculations
  const { totalPages, startIndex, endIndex } = useMemo(() => {
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalCount);

    return {
      totalPages: totalPages || 1,
      startIndex,
      endIndex,
    };
  }, [totalCount, currentPage, pageSize]);

  // Memoized handlers to prevent re-creation on every render
  const handleResetFilters = useCallback(() => {
    setScoreRange([0, 100]);
    setDurationMin("5"); // Reset to default 5 minutes minimum
    setDurationMax("");
    setOnlyScoredCalls(false);
    setIsDialogOpen(false);
  }, []);

  const handlePageSizeChange = useCallback((value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  }, []);

  const handleNavigateToTranscript = useCallback(
    (id: number) => {
      router.push(`/calls/${id}`);
    },
    [router]
  );

  // Handle delete transcript
  const handleDeleteClick = useCallback((e: React.MouseEvent, transcript: any) => {
    e.stopPropagation();
    setTranscriptToDelete(transcript);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!transcriptToDelete) return;

    setIsDeleting(true);
    try {
      // First, delete any company_calls records that reference this transcript
      // This prevents foreign key constraint violation
      const { error: companyCallsError } = await supabase
        .from("external_org_calls")
        .delete()
        .eq("transcript_id", transcriptToDelete.id);

      if (companyCallsError) {
        console.warn("Error deleting company_calls references:", companyCallsError);
        // Continue anyway - the record might not exist in company_calls
      }

      // Now delete the transcript
      const { error } = await supabase
        .from("transcripts")
        .delete()
        .eq("id", transcriptToDelete.id);

      if (error) throw error;

      // Remove from local state immediately for instant feedback
      setPaginatedTranscripts(prev => prev.filter(t => t.id !== transcriptToDelete.id));
      setTotalCount(prev => Math.max(0, prev - 1));

      // Clear cache to ensure fresh data on next fetch
      const token = localStorage.getItem("sb-tuzuwzglmyajuxytaowi-auth-token");
      if (token) {
        const parsed = JSON.parse(token);
        const userId = parsed?.user?.id;
        if (userId) {
          clearTranscriptPageCache(userId);
        }
      }

      toast.success("Transcript deleted successfully");
      setDeleteDialogOpen(false);
      setTranscriptToDelete(null);
    } catch (error: any) {
      console.error("Error deleting transcript:", error);
      toast.error(error.message || "Failed to delete transcript");
    } finally {
      setIsDeleting(false);
    }
  }, [transcriptToDelete]);

  const handleCancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setTranscriptToDelete(null);
  }, []);

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
        <SiteHeader heading="Transcripts" />

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6 max-w-6xl mx-auto w-full">
              {/* ----- PAGE HEADER ----- */}
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">
                  Call Transcripts
                </h1>
                <p className="text-muted-foreground">
                  Review and analyze your conversation transcripts
                </p>
              </div>

              {/* ----- STATS CARDS ----- */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="@container/card bg-gradient-to-br from-primary/5 via-background to-background border-primary/10 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      Total Calls
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold tabular-nums">
                      {isInitialLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        stats.totalCalls
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="@container/card bg-gradient-to-br from-green-500/5 via-background to-background border-green-500/10 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-green-600" />
                      Avg Score
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold tabular-nums">
                      {isInitialLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : stats.avgScore > 0 ? (
                        <span
                          className={
                            stats.avgScore >= 80
                              ? "text-green-600"
                              : stats.avgScore >= 60
                              ? "text-yellow-600"
                              : "text-red-600"
                          }
                        >
                          {stats.avgScore}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-base">
                          Pending
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="@container/card bg-gradient-to-br from-blue-500/5 via-background to-background border-blue-500/10 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      Scored Calls
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold tabular-nums">
                      {isInitialLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        stats.scoredCalls
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="@container/card bg-gradient-to-br from-purple-500/5 via-background to-background border-purple-500/10 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      {stats.recentTrend >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      Trend
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold tabular-nums">
                      {isInitialLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        <span
                          className={
                            stats.recentTrend >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {stats.recentTrend > 0 ? "+" : ""}
                          {stats.recentTrend}%
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* ----- CALL SCORES CHART ----- */}
              <ChartAreaInteractive />

              {/* ----- TRANSCRIPTS SECTION HEADER ----- */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <div>
                  <h2 className="text-lg font-semibold">Your Transcripts</h2>
                  <p className="text-sm text-muted-foreground">
                    {totalCount > 0
                      ? `${totalCount} transcripts found`
                      : "Browse all your call recordings"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    {isSearching ? (
                      <Loader2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground animate-spin" />
                    ) : (
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    )}
                    <Input
                      placeholder="Search transcripts..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 w-64 bg-background"
                    />
                  </div>

                  {/* Filters Dialog */}
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2 shadow-sm">
                        <Filter className="h-4 w-4" />
                        <span className="hidden sm:inline">Filters</span>
                      </Button>
                    </DialogTrigger>

                    <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Filter Transcripts</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-6 py-2">
                        {/* Only Scored Calls Filter */}
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="only-scored"
                            checked={onlyScoredCalls}
                            onCheckedChange={(checked) =>
                              setOnlyScoredCalls(checked === true)
                            }
                          />
                          <Label
                            htmlFor="only-scored"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            Only show scored calls
                          </Label>
                        </div>

                        {/* Score Range Filter */}
                        <div>
                          <Label className="text-sm font-medium mb-2 block">
                            Call Score Range ({scoreRange[0]}–{scoreRange[1]})
                          </Label>
                          <Slider
                            value={scoreRange}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={setScoreRange}
                            className="mt-2"
                          />
                        </div>

                        {/* Duration Filter */}
                        <div>
                          <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Duration (minutes)
                          </Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground">
                                Min
                              </Label>
                              <Input
                                type="number"
                                placeholder="5"
                                value={durationMin}
                                onChange={(e) => setDurationMin(e.target.value)}
                                className="mt-1"
                                min={0}
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground">
                                Max
                              </Label>
                              <Input
                                type="number"
                                placeholder="No limit"
                                value={durationMax}
                                onChange={(e) => setDurationMax(e.target.value)}
                                className="mt-1"
                                min={0}
                              />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Default: Shows calls 5+ minutes. Excludes short/test
                            calls.
                          </p>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="ghost" onClick={handleResetFilters}>
                          Reset
                        </Button>
                        <Button onClick={() => setIsDialogOpen(false)}>
                          Apply
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* ----- TRANSCRIPTS TABLE ----- */}
              <ErrorBoundary>
                <Card className="border-border/50 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="font-semibold">
                              Title
                            </TableHead>
                            <TableHead className="font-semibold">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Duration
                              </span>
                            </TableHead>
                            <TableHead className="font-semibold">
                              <span className="flex items-center gap-1.5">
                                <Star className="h-3.5 w-3.5" />
                                Score
                              </span>
                            </TableHead>
                            <TableHead className="font-semibold">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                Date
                              </span>
                            </TableHead>
                            <TableHead className="font-semibold w-[60px]">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>

                        {isTableLoading || isSearching ? (
                          <TableSkeleton rows={pageSize} />
                        ) : (
                          <TableBody>
                            {filteredTranscripts.map((t, index) => (
                              <TableRow
                                key={t.id}
                                className="hover:bg-primary/5 cursor-pointer transition-all duration-150 group"
                                onClick={() => handleNavigateToTranscript(t.id)}
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-3">
                                    <div className="hidden sm:flex h-9 w-9 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 items-center justify-center text-primary font-semibold text-sm border border-primary/10 group-hover:border-primary/20 transition-colors">
                                      {(t.title || "C")[0].toUpperCase()}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="line-clamp-1 group-hover:text-primary transition-colors">
                                        {t.title || "Untitled Call"}
                                      </span>
                                      <span className="text-xs text-muted-foreground sm:hidden">
                                        {formatDuration(t.duration)}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <span className="text-muted-foreground">
                                    {formatDuration(t.duration)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {t.ai_overall_score != null &&
                                  !isNaN(t.ai_overall_score) ? (
                                    <Badge
                                      variant="outline"
                                      className={`font-semibold ${
                                        t.ai_overall_score >= 80
                                          ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
                                          : t.ai_overall_score >= 60
                                          ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                                          : "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
                                      }`}
                                    >
                                      {Math.round(t.ai_overall_score)}
                                    </Badge>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20">
                                      <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                                      </div>
                                      <span className="text-[10px] font-medium text-primary/80">
                                        Scoring
                                      </span>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="text-muted-foreground text-sm">
                                    {t.created_at
                                      ? new Date(
                                          t.created_at
                                        ).toLocaleDateString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })
                                      : "—"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => handleDeleteClick(e, t)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Delete transcript</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        )}
                      </Table>
                    </div>

                    {!isTableLoading &&
                      !isSearching &&
                      filteredTranscripts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 px-4">
                          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                            <FileText className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                          <h3 className="font-semibold text-lg mb-1">
                            No transcripts found
                          </h3>
                          <p className="text-muted-foreground text-sm text-center max-w-sm">
                            {search
                              ? "Try adjusting your search or filters"
                              : "Your call transcripts will appear here once processed"}
                          </p>
                        </div>
                      )}
                  </CardContent>
                </Card>
              </ErrorBoundary>

              {/* Pagination Controls */}
              {(totalCount > 0 || !isInitialLoading) && (
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="text-muted-foreground hidden flex-1 text-sm lg:flex items-center gap-2">
                        {isTableLoading && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        <span>
                          Showing{" "}
                          <span className="font-medium text-foreground">
                            {startIndex + 1}
                          </span>{" "}
                          to{" "}
                          <span className="font-medium text-foreground">
                            {endIndex}
                          </span>{" "}
                          of{" "}
                          <span className="font-medium text-foreground">
                            {totalCount}
                          </span>{" "}
                          transcript(s)
                        </span>
                      </div>
                      <div className="flex w-full items-center gap-6 lg:w-fit">
                        <div className="hidden items-center gap-2 lg:flex">
                          <Label
                            htmlFor="rows-per-page"
                            className="text-sm text-muted-foreground"
                          >
                            Rows per page
                          </Label>
                          <Select
                            value={`${pageSize}`}
                            onValueChange={handlePageSizeChange}
                          >
                            <SelectTrigger
                              size="sm"
                              className="w-20 h-8"
                              id="rows-per-page"
                            >
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
                        <div className="flex w-fit items-center justify-center text-sm">
                          <span className="text-muted-foreground">Page</span>
                          <span className="font-medium mx-1">
                            {currentPage}
                          </span>
                          <span className="text-muted-foreground">of</span>
                          <span className="font-medium mx-1">{totalPages}</span>
                        </div>
                        <div className="ml-auto flex items-center gap-1 lg:ml-0">
                          <Button
                            variant="ghost"
                            className="hidden h-8 w-8 p-0 lg:flex hover:bg-muted"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1 || isTableLoading}
                          >
                            <span className="sr-only">Go to first page</span>
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-muted"
                            onClick={() =>
                              setCurrentPage((prev) => Math.max(1, prev - 1))
                            }
                            disabled={currentPage === 1 || isTableLoading}
                          >
                            <span className="sr-only">Go to previous page</span>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-muted"
                            onClick={() =>
                              setCurrentPage((prev) =>
                                Math.min(totalPages, prev + 1)
                              )
                            }
                            disabled={
                              currentPage === totalPages || isTableLoading
                            }
                          >
                            <span className="sr-only">Go to next page</span>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            className="hidden h-8 w-8 p-0 lg:flex hover:bg-muted"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={
                              currentPage === totalPages || isTableLoading
                            }
                          >
                            <span className="sr-only">Go to last page</span>
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Transcript
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Are you sure you want to delete this transcript?</p>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone. All associated data including AI analysis, scores, and insights will be permanently removed.
                </p>
              </div>
            </div>

            {transcriptToDelete && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="font-medium text-sm truncate">
                  {transcriptToDelete.title || "Untitled Call"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {transcriptToDelete.created_at
                    ? new Date(transcriptToDelete.created_at).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Unknown date"}
                  {transcriptToDelete.ai_overall_score != null && (
                    <> · Score: {Math.round(transcriptToDelete.ai_overall_score)}</>
                  )}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
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
                  Delete Transcript
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ask AI Coach - Global Component */}
      <AskAICoach
        context={{
          type: "calls_list",
          totalCalls: totalCount,
          avgScore: stats.avgScore,
          recentCalls: paginatedTranscripts.slice(0, 5).map((t) => ({
            id: t.id,
            title: t.title || "Untitled Call",
            score: t.ai_overall_score,
            date: t.created_at,
            duration: t.duration || 0,
          })),
          scoreDistribution: {
            high: paginatedTranscripts.filter((t) => t.ai_overall_score >= 80).length,
            medium: paginatedTranscripts.filter((t) => t.ai_overall_score >= 50 && t.ai_overall_score < 80).length,
            low: paginatedTranscripts.filter((t) => t.ai_overall_score < 50 && t.ai_overall_score != null).length,
          },
        }}
        panelTitle="Calls Coach"
        placeholder="Ask about your calls..."
        quickActions={[
          "Overview of my calls",
          "Which calls need attention?",
          "Show my best calls",
          "Areas to improve",
        ]}
      />
    </SidebarProvider>
  );
}

export default CallsDashboard;
