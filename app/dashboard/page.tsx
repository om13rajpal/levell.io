"use client";

import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getTranscriptsPaginated, getUserIdFromCache } from "@/lib/supabaseCache";

import { AppSidebar } from "@/components/app-sidebar";
import dynamic from "next/dynamic";
const ChartAreaInteractive = dynamic(
  () => import("@/components/chart-area-interactive").then(mod => ({ default: mod.ChartAreaInteractive })),
  { ssr: false, loading: () => <div className="h-[300px] w-full animate-pulse rounded-lg bg-muted" /> }
);
const TranscriptSyncModal = dynamic(
  () => import("@/components/TranscriptSyncModal"),
  { ssr: false }
);
import { AskAICoach } from "@/components/AskAICoach";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  MessageSquare,
  MessageCircle,
  Loader2,
  ListChecks,
  X,
  Sparkles,
} from "lucide-react";
import { IconFileText, IconRefresh } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import axiosClient from "@/lib/axiosClient";

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

// Loading skeleton component
const TableSkeleton = memo(({ rows = 10 }: { rows?: number }) => (
  <TableBody>
    {[...Array(rows)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
        <TableCell><Skeleton className="h-6 w-[60px]" /></TableCell>
        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
      </TableRow>
    ))}
  </TableBody>
));
TableSkeleton.displayName = "TableSkeleton";

export default function Page() {
  const router = useRouter();
  const tableRef = useRef<HTMLDivElement>(null);

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [transcripts, setTranscripts] = useState<any[]>([]);

  // Loading states
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [unscoredCount, setUnscoredCount] = useState<number | null>(null);

  // AI Agent panel state

  // Coaching notes state
  const [coachingNotes, setCoachingNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);

  // Fetch coaching notes for current user
  useEffect(() => {
    let isMounted = true;

    const fetchCoachingNotes = async () => {
      setNotesLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) setNotesLoading(false);
          return;
        }

        // Fetch coaching notes
        const { data: notesData, error } = await supabase
          .from("coaching_notes")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (error) {
          // Table might not exist yet - silently fail
          console.log("Coaching notes not available:", error.message);
          if (isMounted) {
            setCoachingNotes([]);
          }
        } else if (isMounted && notesData) {
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
          const notesWithCoach = notesData.map(note => ({
            ...note,
            coach: coachMap[note.coach_id] || null
          }));

          setCoachingNotes(notesWithCoach);
        }
      } catch (err) {
        console.error("Error fetching coaching notes:", err);
      } finally {
        if (isMounted) {
          setNotesLoading(false);
        }
      }
    };

    fetchCoachingNotes();

    return () => {
      isMounted = false;
    };
  }, []);

  // Intersection Observer - detect when table is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0,
      }
    );

    const currentRef = tableRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [isVisible]);

  // Fetch transcripts when visible or when pagination changes
  useEffect(() => {
    if (!isVisible) return;

    let isMounted = true;

    const fetchTranscripts = async () => {
      const userId = getUserIdFromCache();
      if (!userId) {
        if (isMounted) setIsTableLoading(false);
        return;
      }

      setIsTableLoading(true);

      try {
        const result = await getTranscriptsPaginated(
          userId,
          supabase,
          currentPage,
          pageSize
        );

        if (isMounted) {
          setTranscripts(result.data);
          setTotalCount(result.totalCount);
          setHasFetched(true);
        }
      } catch (err) {
        console.error("Error fetching transcripts:", err);
      } finally {
        if (isMounted) {
          setIsTableLoading(false);
        }
      }
    };

    fetchTranscripts();

    return () => {
      isMounted = false;
    };
  }, [isVisible, currentPage, pageSize]);

  // Pagination calculations
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

  const handlePageSizeChange = useCallback((value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  }, []);

  const handleNavigateToTranscript = useCallback((id: number) => {
    router.push(`/calls/${id}`);
  }, [router]);

  // Sync calls from Fireflies
  const handleSync = useCallback(async () => {
    try {
      setSyncLoading(true);

      // Get authenticated user from Supabase
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast.error("Please log in to sync");
        setSyncLoading(false);
        return;
      }

      const userId = user.id;

      // Fetch the user's Fireflies API key from api_keys table
      const { data: apiKeyData, error: apiKeyError } = await supabase
        .from("api_keys")
        .select("fireflies")
        .eq("user_id", userId)
        .single();

      if (apiKeyError || !apiKeyData?.fireflies) {
        toast.error("Please connect your Fireflies account first in Settings > Integrations");
        setSyncLoading(false);
        return;
      }

      // Get current transcript count for skip parameter
      const skip = totalCount;

      // Send Inngest event to sync transcripts
      const response = await axiosClient.post("/api/inngest/trigger", {
        event: "transcripts/sync.requested",
        data: {
          user_id: userId,
          skip: skip,
          token: apiKeyData.fireflies,
        },
      });

      if (response.status >= 200 && response.status < 300) {
        toast.success("Sync completed successfully");
        // Refresh the data after sync
        setHasFetched(false);
        setIsVisible(false);
        setTimeout(() => setIsVisible(true), 100);
      } else {
        toast.error("Sync failed. Please try again.");
      }
    } catch (err) {
      console.error("Sync error:", err);
      toast.error("Sync failed. Please try again.");
    } finally {
      setSyncLoading(false);
    }
  }, [totalCount]);

  // Fetch unscored count on mount and after scoring
  useEffect(() => {
    let isMounted = true;

    const fetchUnscoredCount = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await axiosClient.get("/api/score-batch", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (isMounted && response.data?.unscored_count !== undefined) {
          setUnscoredCount(response.data.unscored_count);
        }
      } catch (err) {
        console.error("Error fetching unscored count:", err);
      }
    };

    fetchUnscoredCount();

    return () => {
      isMounted = false;
    };
  }, [hasFetched]);

  // Trigger batch scoring
  const handleScoreCalls = useCallback(async () => {
    try {
      setScoreLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please log in to score calls");
        setScoreLoading(false);
        return;
      }

      const response = await axiosClient.post(
        "/api/score-batch",
        {},
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (response.status >= 200 && response.status < 300) {
        toast.success("Scoring job started! Calls will be scored in the background.");
        setUnscoredCount(0); // Optimistically update
      } else {
        toast.error("Failed to start scoring job");
      }
    } catch (err) {
      console.error("Score error:", err);
      toast.error("Failed to start scoring job");
    } finally {
      setScoreLoading(false);
    }
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
        <SiteHeader heading="Dashboard" />

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />

              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>

              {/* Coaching Notes Section */}
              {!notesLoading && coachingNotes.length > 0 && (
                <div className="px-4 lg:px-6">
                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        My Coaching Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {coachingNotes.map((note, i) => (
                          <div key={i} className="border rounded-lg p-4 bg-muted/20">
                            <p className="text-sm">{note.note}</p>
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
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Transcript Table - Lazy loaded with server-side pagination */}
              <div ref={tableRef} className="px-4 lg:px-6">
                <ErrorBoundary>
                  <Card className="border-border/60">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base font-medium">
                        Recent Calls
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {unscoredCount !== null && unscoredCount > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                            onClick={handleScoreCalls}
                            disabled={scoreLoading}
                          >
                            <Sparkles
                              className={`h-4 w-4 ${scoreLoading ? "animate-pulse" : ""}`}
                            />
                            {scoreLoading ? "Scoring..." : `Score ${unscoredCount} Calls`}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex items-center gap-2 border-violet-500/30 text-violet-600 hover:bg-violet-500/10"
                          onClick={() => setSyncModalOpen(true)}
                        >
                          <ListChecks className="h-4 w-4" />
                          Sync All & Select
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10"
                          onClick={handleSync}
                          disabled={syncLoading}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${syncLoading ? "animate-spin" : ""}`}
                          />
                          {syncLoading ? "Syncing..." : "Sync New"}
                        </Button>
                      </div>
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

                        {isTableLoading || !hasFetched ? (
                          <TableSkeleton rows={pageSize} />
                        ) : (
                          <TableBody>
                            {transcripts.map((t) => (
                              <TableRow
                                key={t.id}
                                className="hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => handleNavigateToTranscript(t.id)}
                              >
                                <TableCell className="font-medium">{t.title}</TableCell>
                                <TableCell>{formatDuration(t.duration)}</TableCell>
                                <TableCell>
                                  {t.ai_overall_score != null && !isNaN(t.ai_overall_score) ? (
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
                            ))}
                          </TableBody>
                        )}
                      </Table>

                      {!isTableLoading && hasFetched && transcripts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 px-4">
                          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                            <IconFileText className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                          <h3 className="font-semibold text-lg mb-1">No transcripts yet</h3>
                          <p className="text-muted-foreground text-sm text-center max-w-sm mb-4">
                            Connect your meeting tools and sync your call recordings to see transcripts here.
                          </p>
                          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncLoading}>
                            {syncLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <IconRefresh className="h-4 w-4 mr-2" />}
                            Sync Transcripts
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Pagination Controls */}
                  {(totalCount > 0 || hasFetched) && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
                        Showing {startIndex + 1} to {endIndex} of{" "}
                        {totalCount} transcript(s).
                      </div>
                      <div className="flex w-full items-center gap-8 lg:w-fit">
                        <div className="hidden items-center gap-2 lg:flex">
                          <Label htmlFor="rows-per-page" className="text-sm font-medium">
                            Rows per page
                          </Label>
                          <Select
                            value={`${pageSize}`}
                            onValueChange={handlePageSizeChange}
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
                          Page {currentPage} of {totalPages}
                        </div>
                        <div className="ml-auto flex items-center gap-2 lg:ml-0">
                          <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                          >
                            <span className="sr-only">Go to first page</span>
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                          >
                            <span className="sr-only">Go to previous page</span>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                          >
                            <span className="sr-only">Go to next page</span>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className="hidden size-8 lg:flex"
                            size="icon"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                          >
                            <span className="sr-only">Go to last page</span>
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Transcript Sync Modal */}
      <TranscriptSyncModal
        open={syncModalOpen}
        onOpenChange={setSyncModalOpen}
        onImportComplete={() => {
          // Refresh transcript list after import
          setHasFetched(false);
          setIsVisible(false);
          setTimeout(() => setIsVisible(true), 100);
        }}
      />

      {/* Ask AI Coach - Global Component */}
      <AskAICoach
        context={{
          type: "dashboard",
          totalCalls: totalCount,
          avgScore: transcripts.length > 0
            ? Math.round(
                transcripts
                  .filter((t) => t.ai_overall_score != null)
                  .reduce((acc, t) => acc + (t.ai_overall_score || 0), 0) /
                (transcripts.filter((t) => t.ai_overall_score != null).length || 1)
              )
            : 0,
          trend: 0,
          recentActivity: transcripts.slice(0, 5).map((t) => t.title || "Untitled Call"),
        }}
        panelTitle="Dashboard Coach"
        placeholder="Ask about your performance..."
        quickActions={[
          "How am I doing this week?",
          "What should I focus on?",
          "Show my best performing calls",
          "Areas to improve",
        ]}
      />
    </SidebarProvider>
  );
}
