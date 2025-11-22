"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Grid2X2, List, Plus, MoreHorizontal, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

  // --------------------------------------------------
  // Load Data
  // --------------------------------------------------
  useEffect(() => {
    async function load() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 1 — Your own company
      const { data: myComp } = await supabase
        .from("company")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // 2 — Detected companies
      const { data: detected } = await supabase.from("companies").select("*");

      // 3 — Call counts
      const { data: companyCalls } = await supabase
        .from("company_calls")
        .select("company_id, created_at");

      setMyCompany(myComp || null);
      setDetectedCompanies(detected || []);
      setCalls(companyCalls || []);
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

      return {
        ...c,
        calls: companyCalls.length,
        lastCall,
        industry: industryFromDomain(c.domain),
        score: Math.floor(Math.random() * 40) + 60, // Placeholder — replace with actual score later
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
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Add Company
              </Button>
            </div>
          </div>

          {/* FILTER BAR */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8 bg-card/60 border-border/60"
              />
            </div>

            <Select value={industry} onValueChange={setIndustry}>
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

            <Select value={risk} onValueChange={setRisk}>
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

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px] bg-card/60 border-border/60">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calls">By Call Count</SelectItem>
                <SelectItem value="score">By Score</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* GRID */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              No companies found.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((c) => (
                <CompanyCard
                  key={c.id}
                  company={c}
                  onGoal={() => setSelectedCompany(c)}
                />
              ))}
            </div>
          )}
        </div>
      </SidebarInset>

      {/* MODAL */}
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
  const map = {
    Low: "bg-emerald-950/40 text-emerald-300 border-emerald-900",
    Warning: "bg-amber-950/40 text-amber-300 border-amber-900",
    Critical: "bg-red-950/40 text-red-300 border-red-900",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${map[level]}`}
    >
      {level === "Low" ? "Healthy" : level}
    </span>
  );
}

function ScoreDot({ score }: any) {
  const ring =
    score >= 85
      ? "bg-emerald-950/40 text-emerald-300 border-emerald-900"
      : score >= 70
      ? "bg-amber-950/40 text-amber-300 border-amber-900"
      : "bg-red-950/40 text-red-300 border-red-900";

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
