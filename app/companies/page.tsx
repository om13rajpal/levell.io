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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Grid2X2, List, Plus, MoreHorizontal, Search, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

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
// MAIN PAGE
// --------------------------------------------------
export default function CompaniesPage() {
  const [loading, setLoading] = useState(true);

  const [myCompany, setMyCompany] = useState<any>(null);
  const [detectedCompanies, setDetectedCompanies] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);

  // Filters & state
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("all");
  const [risk, setRisk] = useState("all");
  const [sortBy, setSortBy] = useState("calls");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 6;

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

      // Parallel API calls using Promise.all for better performance
      const [myCompResult, detectedResult, callsResult] = await Promise.all([
        supabase
          .from("company")
          .select("*")
          .eq("user_id", user.id)
          .single(),
        supabase.from("companies").select("*"),
        supabase.from("company_calls").select("company_id, created_at"),
      ]);

      setMyCompany(myCompResult.data || null);
      setDetectedCompanies(detectedResult.data || []);
      setCalls(callsResult.data || []);
      setLoading(false);
    }

    load();
  }, []);

  // --------------------------------------------------
  // Enhancing detected company objects - OPTIMIZED: Deterministic scoring
  // --------------------------------------------------
  const combinedData = useMemo(() => {
    return detectedCompanies.map((c) => {
      const companyCalls = calls.filter((x) => x.company_id === c.id);

      const lastCall = companyCalls.length
        ? new Date(
            companyCalls[companyCalls.length - 1].created_at
          ).toLocaleDateString()
        : "No calls";

      return {
        ...c,
        calls: companyCalls.length,
        lastCall,
        industry: industryFromDomain(c.domain),
        // Deterministic pseudo-random based on company ID to prevent re-render changes
        score: c.ai_overall_score ?? ((c.id * 17) % 40 + 60),
        risk: companyCalls.length === 0 ? "Critical" : "Low",
      };
    });
  }, [detectedCompanies, calls]);

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
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > maxPage) setPage(1);
  }, [maxPage, page]);

  // --------------------------------------------------
  // Memoized Filter Handlers - OPTIMIZED: useCallback
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

      const res = await fetch(
        "https://n8n.omrajpal.tech/webhook/c4b17fa2-8f72-46be-b1b3-d2b30f89976c",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userid: user.id }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to trigger prediction workflow");
      }

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

      const { data, error } = await supabase
        .from("companies")
        .insert([
          {
            company_name: newCompanyName,
            domain: newCompanyDomain || null,
            company_url: newCompanyUrl || null,
            user_id: user.id,
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
      <div className="p-10 text-center text-muted-foreground">
        Loading companies…
      </div>
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

        <div className="flex flex-col px-6 md:px-8 py-8 gap-6">
          {/* Your Company Snapshot */}
          {myCompany && (
            <Card className="border-border/60 bg-card/60 shadow-md backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  Your Company
                </CardTitle>
                <CardDescription>{myCompany.company_name}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Website: {myCompany.company_url || "—"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* FILTERS + HEADER */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Detected Companies
              </h1>
              <p className="text-sm text-muted-foreground">
                Auto-detected from your call transcripts using AI.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center border border-border/60 rounded-md">
                <Button
                  variant={view === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("grid")}
                  className="rounded-r-none"
                >
                  <Grid2X2 className="h-4 w-4" />
                </Button>
                <Button
                  variant={view === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("list")}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="secondary"
                className="gap-2"
                onClick={predictCompanies}
                disabled={predicting}
              >
                <Sparkles className="h-4 w-4" />
                {predicting ? "Predicting…" : "Predict Companies"}
              </Button>

              <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4" /> Add Company
              </Button>
            </div>
          </div>

          {/* FILTER BAR - OPTIMIZED: useCallback handlers */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies…"
                value={q}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 bg-card/60 border-border/60"
              />
            </div>

            <Select value={industry} onValueChange={handleIndustryChange}>
              <SelectTrigger className="w-[150px] bg-card/60 border-border/60">
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
              <SelectTrigger className="w-[140px] bg-card/60 border-border/60">
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Warning">Warning</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[160px] bg-card/60 border-border/60">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calls">By Call Count</SelectItem>
                <SelectItem value="score">By Score</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* GRID OR LIST VIEW */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              No companies found.
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((c) => (
                <CompanyCard
                  key={c.id}
                  company={c}
                  onGoal={() => setSelectedCompany(c)}
                />
              ))}
            </div>
          ) : (
            <Card className="border-border/60 bg-card/60 shadow-sm backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  All Companies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Calls</TableHead>
                      <TableHead>Last Call</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((c) => (
                      <TableRow
                        key={c.id}
                        className="hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() =>
                          (window.location.href = `/companies/${c.id}`)
                        }
                      >
                        <TableCell className="font-medium">
                          {c.company_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.industry}
                        </TableCell>
                        <TableCell>{c.calls}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.lastCall}
                        </TableCell>
                        <TableCell>
                          <RiskBadge level={c.risk} />
                        </TableCell>
                        <TableCell>
                          <ScoreDot score={c.score} />
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
                            Add Goal
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>

      {/* GOAL MODAL */}
      <Dialog
        open={!!selectedCompany}
        onOpenChange={() => setSelectedCompany(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add Goal for {selectedCompany?.company_name}
            </DialogTitle>
          </DialogHeader>

          <Input
            placeholder="Enter company goal/objective…"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedCompany(null)}>
              Cancel
            </Button>
            <Button onClick={saveGoal} disabled={saving}>
              {saving ? "Saving…" : "Save Goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD COMPANY MODAL */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name *</Label>
              <Input
                id="company-name"
                placeholder="Enter company name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-domain">Domain</Label>
              <Input
                id="company-domain"
                placeholder="e.g., technology, finance"
                value={newCompanyDomain}
                onChange={(e) => setNewCompanyDomain(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-url">Company Website</Label>
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
              variant="ghost"
              onClick={() => {
                setAddDialogOpen(false);
                setNewCompanyName("");
                setNewCompanyDomain("");
                setNewCompanyUrl("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={addNewCompany} disabled={addingSaving}>
              {addingSaving ? "Adding…" : "Add Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

// --------------------------------------------------
// Card Components (same design but improved)
// --------------------------------------------------
function CompanyCard({ company, onGoal }: any) {
  return (
    <Card className="border-border/60 bg-card/60 shadow-sm backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-medium">
              {company.company_name}
            </CardTitle>
            <CardDescription className="text-xs">
              {company.industry}
            </CardDescription>
          </div>
          <RowMenu />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{company.calls} calls</span>
          <span>Last call: {company.lastCall}</span>
        </div>

        <div className="flex items-center justify-between">
          <RiskBadge level={company.risk} />
          <ScoreDot score={company.score} />
        </div>

        <Button variant="secondary" className="w-full text-sm" onClick={onGoal}>
          Add Company Goal
        </Button>

        <Button
          variant="outline"
          className="w-full text-sm"
          onClick={() => (window.location.href = `/companies/${company.id}`)}
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}

function RiskBadge({ level }: any) {
  const map: Record<string, string> = {
    Low: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    Warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    Critical: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${map[level] || "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/40 dark:text-gray-300 dark:border-gray-900"}`}
    >
      {level === "Low" ? "Healthy" : level}
    </span>
  );
}

function ScoreDot({ score }: any) {
  const ring =
    score >= 85
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
      : score >= 70
      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
      : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";

  return (
    <div
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs ${ring}`}
      title={`Score ${score}`}
    >
      {score}
    </div>
  );
}

function RowMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem>View</DropdownMenuItem>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem>Archive</DropdownMenuItem>
        <DropdownMenuItem className="text-red-500 focus:text-red-500">
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
