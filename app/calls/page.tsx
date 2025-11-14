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
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Search, Filter } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { useTranscriptStore } from "@/store/useTranscriptStore";
import { supabase } from "@/lib/supabaseClient";

export default function CallsDashboard() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scoreRange, setScoreRange] = useState([60, 100]);
  const [selectedCallTypes, setSelectedCallTypes] = useState<string[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<string[]>([]);

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
  // SEARCH FILTER
  // ------------------------------------------------------------------
  const filteredTranscripts = transcripts.filter((t) =>
    t?.title?.toLowerCase().includes(search.toLowerCase())
  );

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

                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Filter Transcripts</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-5 py-2">
                        <div>
                          <p className="text-sm font-medium mb-1">
                            Score ({scoreRange[0]}–{scoreRange[1]})
                          </p>
                          <Slider
                            defaultValue={scoreRange}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={setScoreRange}
                          />
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelectedRisk([]);
                            setSelectedCallTypes([]);
                            setScoreRange([60, 100]);
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
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredTranscripts.map((t) => (
                        <TableRow
                          key={t.id}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() =>
                            (window.location.href = `/calls/${t.fireflies_id}`)
                          }
                        >
                          <TableCell className="font-medium">{t.title}</TableCell>
                          <TableCell>{Math.round(t.duration)} sec</TableCell>
                          <TableCell>
                            {t.created_at
                              ? new Date(t.created_at).toLocaleString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {filteredTranscripts.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-6">
                      No transcripts found.
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