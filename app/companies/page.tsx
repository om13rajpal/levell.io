"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import axiosClient from "@/lib/axiosClient";
import Image from "next/image";

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
  const [loading, setLoading] = useState(true);

  const [myCompany, setMyCompany] = useState<any>(null);
  const [detectedCompanies, setDetectedCompanies] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);

  // Filters & state
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("all");
  const [risk, setRisk] = useState("all");
  const [sortBy, setSortBy] = useState("calls");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Goal modal
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);

  // Add Company modal
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyDomain, setNewCompanyDomain] = useState("");
  const [newCompanyUrl, setNewCompanyUrl] = useState("");
  const [addingSaving, setAddingSaving] = useState(false);

  // Predict Companies
  const [predicting, setPredicting] = useState(false);

  // --------------------------------------------------
  // Load Data - OPTIMIZED: Parallel API calls
  // --------------------------------------------------
  useEffect(() => {
    async function load() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get user's company first
      const myCompResult = await supabase
        .from("company")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const myCompanyId = myCompResult.data?.id;

      // Parallel API calls - filter companies by user's company_id
      const [detectedResult, callsResult] = await Promise.all([
        myCompanyId
          ? supabase.from("companies").select("*").eq("company_id", myCompanyId)
          : supabase.from("companies").select("*"),
        supabase.from("company_calls").select("company_id, created_at, transcript_id"),
      ]);

      // Fetch transcript scores for all calls
      const transcriptIds = (callsResult.data || [])
        .map((c) => c.transcript_id)
        .filter(Boolean);

      let transcriptScores: Record<number, number> = {};
      if (transcriptIds.length > 0) {
        const { data: transcripts } = await supabase
          .from("transcripts")
          .select("id, ai_overall_score")
          .in("id", transcriptIds);

        if (transcripts) {
          transcripts.forEach((t) => {
            if (t.ai_overall_score != null && !isNaN(t.ai_overall_score)) {
              transcriptScores[t.id] = Number(t.ai_overall_score);
            }
          });
        }
      }

      // Attach scores to calls
      const callsWithScores = (callsResult.data || []).map((call) => ({
        ...call,
        score: transcriptScores[call.transcript_id] ?? null,
      }));

      setMyCompany(myCompResult.data || null);
      setDetectedCompanies(detectedResult.data || []);
      setCalls(callsWithScores);
      setLoading(false);
    }

    load();
  }, []);

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
  // Stats calculations
  // --------------------------------------------------
  const stats = useMemo(() => {
    const totalCompanies = combinedData.length;
    const totalCalls = combinedData.reduce((sum, c) => sum + c.calls, 0);

    // Only include companies with valid scores in average
    const companiesWithScores = combinedData.filter((c) => c.score != null);
    const avgScore = companiesWithScores.length > 0
      ? Math.round(
          companiesWithScores.reduce((sum, c) => sum + (c.score || 0), 0) / companiesWithScores.length
        )
      : 0;

    const atRisk = combinedData.filter((c) => c.risk === "Critical").length;

    return { totalCompanies, totalCalls, avgScore, atRisk };
  }, [combinedData]);

  // --------------------------------------------------
  // Filters
  // --------------------------------------------------
  const filtered = useMemo(() => {
    let rows = [...combinedData];

    if (q.trim())
      rows = rows.filter((c) =>
        c.company_name.toLowerCase().includes(q.toLowerCase())
      );
    if (industry !== "all") rows = rows.filter((c) => c.industry === industry);
    if (risk !== "all") rows = rows.filter((c) => (c.risk ?? "Low") === risk);

    rows.sort((a, b) =>
      sortBy === "score" ? b.score - a.score : b.calls - a.calls
    );
    return rows;
  }, [q, industry, risk, sortBy, combinedData]);

  const industries = Array.from(new Set(combinedData.map((c) => c.industry)));

  const maxPage = Math.ceil(filtered.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageItems = filtered.slice(startIndex, endIndex);

  useEffect(() => {
    if (page > maxPage && maxPage > 0) setPage(1);
  }, [maxPage, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [q, industry, risk, sortBy]);

  // --------------------------------------------------
  // Memoized Filter Handlers
  // --------------------------------------------------
  const handleSearch = useCallback((value: string) => setQ(value), []);
  const handleIndustryChange = useCallback((value: string) => setIndustry(value), []);
  const handleRiskChange = useCallback((value: string) => setRisk(value), []);
  const handleSortChange = useCallback((value: string) => setSortBy(value), []);

  // --------------------------------------------------
  // Save Goal
  // --------------------------------------------------
  async function saveGoal() {
    if (!goal.trim()) {
      toast.error("Please enter a company goal");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("companies")
        .update({ company_goal_objective: goal })
        .eq("id", selectedCompany.id);

      if (error) throw error;

      toast.success("Company goal saved!");
      setSelectedCompany(null);
      setGoal("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // Predict Companies (trigger n8n workflow)
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

      await axiosClient.get(
        `https://n8n.omrajpal.tech/webhook/c7fd515a-cdcc-461f-9446-09cac79e73ea?userid=${user.id}`
      );

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
  async function addNewCompany() {
    if (!newCompanyName.trim()) {
      toast.error("Please enter a company name");
      return;
    }

    try {
      setAddingSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      // First get the user's company to link to
      const { data: userCompany } = await supabase
        .from("company")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const { data, error } = await supabase
        .from("companies")
        .insert([
          {
            company_name: newCompanyName,
            domain: newCompanyDomain || null,
            company_id: userCompany?.id || null,
          },
        ])
        .select();

      if (error) throw error;

      toast.success("Company added successfully!");

      // Refresh the companies list
      const { data: detected } = await supabase.from("companies").select("*");
      setDetectedCompanies(detected || []);

      // Reset form and close dialog
      setNewCompanyName("");
      setNewCompanyDomain("");
      setNewCompanyUrl("");
      setAddDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingSaving(false);
    }
  }

  // --------------------------------------------------
  // Loading State
  // --------------------------------------------------
  if (loading) {
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
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
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

              <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
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
                value={q}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={industry} onValueChange={handleIndustryChange}>
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

            <Select value={risk} onValueChange={handleRiskChange}>
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

            <Select value={sortBy} onValueChange={handleSortChange}>
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
          {filtered.length === 0 ? (
            <div className="py-16">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-lg mb-1">No companies found</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {q || industry !== "all" || risk !== "all"
                    ? "Try adjusting your filters to see more results."
                    : "Companies will appear here once detected from your call transcripts."}
                </p>
              </div>
            </div>
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
                      onClick={() =>
                        (window.location.href = `/companies/${c.id}`)
                      }
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCompany(c);
                          }}
                          >
                            <Target className="h-3.5 w-3.5" />
                            Add Goal
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
          )}

          {/* Pagination */}
          {filtered.length > pageSize && (
            <div className="flex items-center justify-between py-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, filtered.length)} of{" "}
                    {filtered.length} companies
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
        open={!!selectedCompany}
        onOpenChange={() => setSelectedCompany(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Set Company Goal
            </DialogTitle>
            <DialogDescription>
              Define a goal or objective for {selectedCompany?.company_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="goal">Goal / Objective</Label>
              <Textarea
                id="goal"
                placeholder="e.g., Close enterprise deal by Q4, Expand to 10 seats..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCompany(null)}>
              Cancel
            </Button>
            <Button onClick={saveGoal} disabled={saving} className="gap-2">
              {saving ? (
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
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
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
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-domain">Industry / Domain</Label>
              <Input
                id="company-domain"
                placeholder="e.g., technology, finance, healthcare"
                value={newCompanyDomain}
                onChange={(e) => setNewCompanyDomain(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-url">Website URL</Label>
              <Input
                id="company-url"
                placeholder="https://example.com"
                value={newCompanyUrl}
                onChange={(e) => setNewCompanyUrl(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setNewCompanyName("");
                setNewCompanyDomain("");
                setNewCompanyUrl("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={addNewCompany} disabled={addingSaving} className="gap-2">
              {addingSaving ? (
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

  const cleanDomain = getDomainFromUrl(domain);
  const logoUrl = cleanDomain ? `https://logo.clearbit.com/${cleanDomain}` : null;

  // Show fallback if no domain or image failed to load
  if (!logoUrl || imageError) {
    return (
      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-8 w-8 rounded shrink-0 overflow-hidden">
      <Image
        src={logoUrl}
        alt={`${companyName} logo`}
        width={32}
        height={32}
        className="h-8 w-8 object-cover"
        onError={() => setImageError(true)}
        unoptimized
      />
    </div>
  );
}
