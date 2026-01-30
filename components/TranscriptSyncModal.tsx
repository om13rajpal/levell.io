"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  Download,
  CheckCircle2,
  Loader2,
  Calendar,
  Clock,
  Users,
  AlertCircle,
  CheckCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import axiosClient from "@/lib/axiosClient";

interface TempTranscript {
  id: number;
  fireflies_id: string;
  title: string;
  duration: number | null;
  organizer_email: string | null;
  participants: any[];
  meeting_date: string | null;
  summary: string | null;
  is_selected: boolean;
  is_imported: boolean;
  synced_at: string;
}

interface TranscriptSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export default function TranscriptSyncModal({
  open,
  onOpenChange,
  onImportComplete,
}: TranscriptSyncModalProps) {
  const [transcripts, setTranscripts] = useState<TempTranscript[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [syncStatus, setSyncStatus] = useState<string>("idle");
  const [totalCount, setTotalCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState<{ pagesFetched: number; totalFound: number } | null>(null);
  const [syncCancelled, setSyncCancelled] = useState(false);

  // Format duration
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  // Get auth token for API calls
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

  // Fetch temp transcripts
  const fetchTempTranscripts = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/transcripts/temp?pageSize=100", {
        headers,
      });
      const json = await response.json();

      // Handle both old format { data, total } and new format { success, data: { data, total } }
      const responseData = json.success !== undefined ? json.data : json;

      if (json.error || !json.success) {
        toast.error(json.error || "Failed to fetch transcripts");
        return;
      }

      const transcriptsList = responseData?.data || [];
      setTranscripts(transcriptsList);
      setTotalCount(responseData?.total || 0);

      // Initialize selected based on is_selected flag
      const initialSelected = new Set<number>();
      transcriptsList.forEach((t: TempTranscript) => {
        if (t.is_selected) initialSelected.add(t.id);
      });
      setSelectedIds(initialSelected);
    } catch (error) {
      console.error("Error fetching temp transcripts:", error);
      toast.error("Failed to load transcripts");
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  // Check sync status - returns status info for polling logic
  const checkSyncStatus = useCallback(async (): Promise<{ status: string; error?: string } | null> => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error("Auth error during sync check:", authError);
        return { status: "error", error: "Authentication failed. Please refresh and try again." };
      }

      const { data, error } = await supabase
        .from("users")
        .select("transcript_sync_status, last_transcript_sync")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error checking sync status:", error);
        return { status: "error", error: "Failed to check sync status. Database may be unavailable." };
      }

      if (data) {
        setSyncStatus(data.transcript_sync_status || "idle");

        // If syncing completed, refresh the list
        if (data.transcript_sync_status === "completed" && syncing) {
          setSyncing(false);
          setSyncProgress(null);
          fetchTempTranscripts();
          toast.success("Sync completed!");
          return { status: "completed" };
        }

        // If sync errored on backend
        if (data.transcript_sync_status === "error") {
          return { status: "error", error: "Sync failed on the server. Please check your Fireflies API key and try again." };
        }

        return { status: data.transcript_sync_status || "idle" };
      }
      return null;
    } catch (err) {
      console.error("Unexpected error in checkSyncStatus:", err);
      return { status: "error", error: "An unexpected error occurred while checking sync status." };
    }
  }, [syncing, fetchTempTranscripts]);

  // Poll sync status while syncing with exponential backoff
  useEffect(() => {
    if (!syncing || syncCancelled) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let currentInterval = 2000; // Start at 2 seconds
    const MAX_INTERVAL = 30000; // Max 30 seconds between polls
    const BACKOFF_MULTIPLIER = 2;
    let isMounted = true;

    const poll = async () => {
      if (!isMounted || syncCancelled) return;

      const result = await checkSyncStatus();

      if (!isMounted || syncCancelled) return;

      // Handle errors
      if (result?.status === "error") {
        setSyncing(false);
        setSyncProgress(null);
        toast.error(result.error || "Sync failed. Please try again.");
        return;
      }

      // If completed, checkSyncStatus already handles cleanup
      if (result?.status === "completed") {
        return;
      }

      // Schedule next poll with exponential backoff
      currentInterval = Math.min(currentInterval * BACKOFF_MULTIPLIER, MAX_INTERVAL);
      timeoutId = setTimeout(poll, currentInterval);
    };

    // Start polling after initial interval
    timeoutId = setTimeout(poll, currentInterval);

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [syncing, syncCancelled, checkSyncStatus]);

  // Handle cancellation of sync
  const handleCancelSync = useCallback(() => {
    setSyncCancelled(true);
    setSyncing(false);
    setSyncProgress(null);
    toast.info("Sync cancelled. Any transcripts already fetched are still available.");
  }, []);

  // Load transcripts when modal opens
  useEffect(() => {
    if (open) {
      fetchTempTranscripts();
      checkSyncStatus();
    }
  }, [open, fetchTempTranscripts, checkSyncStatus]);

  // Sync all transcripts from Fireflies
  const handleSyncAll = async () => {
    setSyncCancelled(false);
    setSyncProgress(null);
    setSyncing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        setSyncing(false);
        return;
      }

      // Get Fireflies API key
      const { data: apiKeys } = await supabase
        .from("api_keys")
        .select("fireflies")
        .eq("user_id", user.id)
        .single();

      if (!apiKeys?.fireflies) {
        toast.error("Fireflies API key not configured. Please connect Fireflies in settings.");
        setSyncing(false);
        return;
      }

      // Trigger Inngest event
      await axiosClient.post("/api/inngest/trigger", {
        event: "transcripts/fetch-all.requested",
        data: {
          user_id: user.id,
          token: apiKeys.fireflies,
        },
      });

      toast.info("Syncing transcripts from Fireflies...");
    } catch (error: any) {
      console.error("Error triggering sync:", error);
      toast.error(error.message || "Failed to start sync");
      setSyncing(false);
    }
  };

  // Toggle selection
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Select all
  const selectAll = () => {
    const allIds = transcripts.filter((t) => !t.is_imported).map((t) => t.id);
    setSelectedIds(new Set(allIds));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Import selected transcripts
  const handleImport = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one transcript to import");
      return;
    }

    setImporting(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Not authenticated. Please refresh and try again.");
        setImporting(false);
        return;
      }

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      };

      // First update selection status in database
      const selectResponse = await fetch("/api/transcripts/temp", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "select",
          ids: Array.from(selectedIds),
        }),
      });

      const selectJson = await selectResponse.json();
      // Handle new format { success, data } or old format { error }
      if (selectJson.error || selectJson.success === false) {
        toast.error(`Failed to select transcripts: ${selectJson.error || "Unknown error"}`);
        setImporting(false);
        return;
      }

      console.log("[Import] Selected transcripts:", selectJson);

      // Then import the selected transcripts
      const response = await fetch("/api/transcripts/temp", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "import" }),
      });

      const json = await response.json();
      console.log("[Import] Import response:", json);

      // Handle new format { success, data: { imported, errors } } or old format
      const importData = json.success !== undefined ? json.data : json;

      if (json.error || json.success === false) {
        toast.error(json.error || "Import failed");
        return;
      }

      if (importData?.errors && importData.errors.length > 0) {
        toast.warning(`Imported ${importData.imported || 0} transcript(s) with ${importData.errors.length} error(s)`);
        console.error("[Import] Errors:", JSON.stringify(importData.errors, null, 2));
        // Also show first error in toast
        if (importData.errors[0]) {
          toast.error(importData.errors[0]);
        }
      } else {
        toast.success(`Successfully imported ${importData?.imported || 0} transcript(s)`);
      }

      // Refresh the list
      await fetchTempTranscripts();

      // Notify parent
      onImportComplete?.();
    } catch (error: any) {
      console.error("Error importing transcripts:", error);
      toast.error("Failed to import transcripts");
    } finally {
      setImporting(false);
    }
  };

  const nonImportedCount = transcripts.filter((t) => !t.is_imported).length;
  const allSelected = nonImportedCount > 0 && selectedIds.size === nonImportedCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[66vw] max-w-[66vw] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Sync & Select Transcripts
          </DialogTitle>
          <DialogDescription>
            Sync your calls from Fireflies and choose which ones to track and analyze.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {/* Sync status bar */}
          <div className="flex items-center justify-between gap-4 px-1">
            <div className="flex items-center gap-2">
              {syncStatus === "syncing" || syncing ? (
                <Badge variant="secondary" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {syncProgress && syncProgress.pagesFetched > 0 ? (
                    <span>
                      Fetching page {syncProgress.pagesFetched}
                      {syncProgress.totalFound > 0 && ` (${syncProgress.totalFound} found)`}
                    </span>
                  ) : (
                    "Syncing..."
                  )}
                </Badge>
              ) : syncStatus === "completed" ? (
                <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
                  <CheckCircle2 className="h-3 w-3" />
                  Synced
                </Badge>
              ) : syncStatus === "error" ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Sync failed
                </Badge>
              ) : null}
              <span className="text-sm text-muted-foreground">
                {totalCount} transcript(s) available
              </span>
            </div>

            <div className="flex items-center gap-2">
              {syncing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelSync}
                  className="gap-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAll}
                disabled={syncing}
                className="gap-2"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {syncing ? "Syncing..." : "Sync from Fireflies"}
              </Button>
            </div>
          </div>

          {/* Selection controls */}
          <div className="flex items-center justify-between gap-4 px-1">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => {
                  if (checked) selectAll();
                  else deselectAll();
                }}
                disabled={nonImportedCount === 0}
              />
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                disabled={nonImportedCount === 0}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                disabled={selectedIds.size === 0}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {/* Transcripts table */}
          <div className="flex-1 min-h-0 overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-12 px-4"></TableHead>
                  <TableHead className="min-w-[300px] px-4">Title</TableHead>
                  <TableHead className="w-28 px-4">Duration</TableHead>
                  <TableHead className="w-36 px-4">Date</TableHead>
                  <TableHead className="w-28 px-4 text-center">Participants</TableHead>
                  <TableHead className="w-28 px-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  // Loading skeleton
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : transcripts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {syncStatus === "idle" ? (
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="h-8 w-8 text-muted-foreground/50" />
                          <p>No transcripts synced yet.</p>
                          <p className="text-sm">Click "Sync from Fireflies" to get started.</p>
                        </div>
                      ) : (
                        "No transcripts found."
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  transcripts.map((transcript) => (
                    <TableRow
                      key={transcript.id}
                      className={transcript.is_imported ? "opacity-50" : "cursor-pointer hover:bg-muted/50"}
                      onClick={() => !transcript.is_imported && toggleSelection(transcript.id)}
                    >
                      <TableCell className="px-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(transcript.id)}
                          onCheckedChange={() => toggleSelection(transcript.id)}
                          disabled={transcript.is_imported}
                        />
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex flex-col">
                          <span className="font-medium line-clamp-1">
                            {transcript.title || "Untitled Meeting"}
                          </span>
                          {transcript.organizer_email && (
                            <span className="text-xs text-muted-foreground truncate">
                              {transcript.organizer_email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{formatDuration(transcript.duration)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{formatDate(transcript.meeting_date)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                          <Users className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{transcript.participants?.length || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        {transcript.is_imported ? (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Imported
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || selectedIds.size === 0}
            className="gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Import Selected ({selectedIds.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
