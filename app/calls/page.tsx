"use client";

import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarIcon
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { useTranscriptStore } from "@/store/useTranscriptStore";
import { supabase } from "@/lib/supabaseClient";

export default function CallsDashboard() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scoreRange, setScoreRange] = useState([0, 100]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [durationMin, setDurationMin] = useState<string>("");
  const [durationMax, setDurationMax] = useState<string>("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const transcripts = useTranscriptStore((s) => s.transcripts);
  const setTranscripts = useTranscriptStore((s) => s.setTranscripts);

  // ------------------------------------------------------------------
  // ⭐ 1. LOAD FROM LOCALSTORAGE FIRST (instant UI)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("transcripts-cache");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log("Loaded transcripts from localStorage:", parsed);
        setTranscripts(parsed);
      } catch (err) {
        console.error("Invalid transcripts-cache:", err);
      }
    }
  }, [setTranscripts]);

  // ------------------------------------------------------------------
  // ⭐ 2. IF NO LOCALSTORAGE → FETCH FROM SUPABASE AND STORE
  // ------------------------------------------------------------------
  useEffect(() => {
    const fetchTranscripts = async () => {
      try {
        if (!transcripts || transcripts.length === 0) {
          console.log("No local storage transcripts → Fetching from Supabase...");
        } else {
          console.log("Local storage transcripts found → Skipping fetch");
          return; // Already loaded from localStorage
        }

        // Read token
        const token = localStorage.getItem("sb-rpowalzrbddorfnnmccp-auth-token");
        if (!token) return;

        const parsed = JSON.parse(token);
        const userId = parsed?.user?.id;
        if (!userId) return;

        // Fetch Supabase data
        const { data, error } = await supabase
          .from("transcripts")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Supabase error:", error);
          return;
        }

        console.log("Fetched from Supabase:", data);

        // Save to Zustand
        setTranscripts(data ?? []);

        // ⭐ Save to localStorage so next reload is instant
        localStorage.setItem("transcripts-cache", JSON.stringify(data ?? []));
      } catch (err) {
        console.error("Error during transcript fetch:", err);
      }
    };

    fetchTranscripts();
  }, [transcripts, setTranscripts]);

  // ------------------------------------------------------------------
  // SEARCH FILTER + ALL FILTERS + PAGINATION
  // ------------------------------------------------------------------
  const filteredTranscripts = transcripts.filter((t) => {
    // Search filter
    if (search && !t?.title?.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }

    // Score range filter
    if (t.ai_overall_score != null) {
      if (t.ai_overall_score < scoreRange[0] || t.ai_overall_score > scoreRange[1]) {
        return false;
      }
    }

    // Date from filter
    if (dateFrom && t.created_at) {
      const transcriptDate = new Date(t.created_at);
      if (transcriptDate < dateFrom) {
        return false;
      }
    }

    // Date to filter
    if (dateTo && t.created_at) {
      const transcriptDate = new Date(t.created_at);
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (transcriptDate > endOfDay) {
        return false;
      }
    }

    // Duration filter (min)
    if (durationMin && t.duration) {
      const minSeconds = parseInt(durationMin);
      if (!isNaN(minSeconds) && t.duration < minSeconds) {
        return false;
      }
    }

    // Duration filter (max)
    if (durationMax && t.duration) {
      const maxSeconds = parseInt(durationMax);
      if (!isNaN(maxSeconds) && t.duration > maxSeconds) {
        return false;
      }
    }

    return true;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredTranscripts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTranscripts = filteredTranscripts.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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

              {/* ----- HEADER ----- */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl font-semibold">Your Transcripts</h1>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search transcripts..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>

                  {/* Filters Dialog (optional) */}
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                      </Button>
                    </DialogTrigger>

                    <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Filter Transcripts</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-6 py-2">
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

                        {/* Date From Filter */}
                        <div>
                          <Label className="text-sm font-medium mb-2 block">
                            Date From
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !dateFrom && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateFrom}
                                onSelect={setDateFrom}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Date To Filter */}
                        <div>
                          <Label className="text-sm font-medium mb-2 block">
                            Date To
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !dateTo && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateTo}
                                onSelect={setDateTo}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Duration Filter */}
                        <div>
                          <Label className="text-sm font-medium mb-2 block">
                            Duration (seconds)
                          </Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground">Min</Label>
                              <Input
                                type="number"
                                placeholder="Min"
                                value={durationMin}
                                onChange={(e) => setDurationMin(e.target.value)}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground">Max</Label>
                              <Input
                                type="number"
                                placeholder="Max"
                                value={durationMax}
                                onChange={(e) => setDurationMax(e.target.value)}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setScoreRange([0, 100]);
                            setDateFrom(undefined);
                            setDateTo(undefined);
                            setDurationMin("");
                            setDurationMax("");
                            setIsDialogOpen(false);
                          }}
                        >
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
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    All Transcripts
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
                      {paginatedTranscripts.map((t) => (
                        <TableRow
                          key={t.id}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() =>
                            (window.location.href = `/calls/${t.id}`)
                          }
                        >
                          <TableCell className="font-medium">{t.title}</TableCell>
                          <TableCell>{Math.round(t.duration)} sec</TableCell>
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
                  </Table>

                  {paginatedTranscripts.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-6">
                      No transcripts found.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pagination Controls */}
              {filteredTranscripts.length > 0 && (
                <div className="flex items-center justify-between px-4">
                  <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredTranscripts.length)} of{" "}
                    {filteredTranscripts.length} transcript(s).
                  </div>
                  <div className="flex w-full items-center gap-8 lg:w-fit">
                    <div className="hidden items-center gap-2 lg:flex">
                      <Label htmlFor="rows-per-page" className="text-sm font-medium">
                        Rows per page
                      </Label>
                      <Select
                        value={`${pageSize}`}
                        onValueChange={(value) => {
                          setPageSize(Number(value));
                          setCurrentPage(1);
                        }}
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

            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}