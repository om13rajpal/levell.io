"use client";

import { useState, useMemo, useEffect } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Grid2X2,
  List,
  Plus,
  MoreHorizontal,
  Search,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// -----------------------------
// Demo Data
// -----------------------------
const COMPANIES = [
  { id: "1", name: "Acme Corporation", industry: "Manufacturing", calls: 24, lastCall: "2 days ago", score: 88, risk: "Warning" },
  { id: "2", name: "Globex", industry: "Technology", calls: 31, lastCall: "1 day ago", score: 91 },
  { id: "3", name: "Initech", industry: "SaaS", calls: 12, lastCall: "5 days ago", score: 72, risk: "Warning" },
  { id: "4", name: "Umbrella Corp", industry: "Healthcare", calls: 7, lastCall: "12 days ago", score: 58, risk: "Critical" },
  { id: "5", name: "Wayne Enterprises", industry: "Finance", calls: 19, lastCall: "3 days ago", score: 86 },
  { id: "6", name: "Stark Industries", industry: "Defense", calls: 42, lastCall: "today", score: 93 },
];
const INDUSTRIES = Array.from(new Set(COMPANIES.map((c) => c.industry)));

export default function Page() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("all");
  const [risk, setRisk] = useState("all");
  const [sortBy, setSortBy] = useState("calls");
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const filtered = useMemo(() => {
    let rows = [...COMPANIES];
    if (q.trim()) rows = rows.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
    if (industry !== "all") rows = rows.filter((c) => c.industry === industry);
    if (risk !== "all") rows = rows.filter((c) => (c.risk ?? "Low") === risk);
    rows.sort((a, b) => (sortBy === "score" ? b.score - a.score : b.calls - a.calls));
    return rows;
  }, [q, industry, risk, sortBy]);

  const total = filtered.length;
  const maxPage = Math.ceil(total / pageSize);
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > maxPage) setPage(1);
  }, [maxPage, page]);

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
        <SiteHeader heading="Companies"/>
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-6 md:gap-6 md:py-8 px-6 md:px-8">
              {/* Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Company Intelligence</h1>
                  <p className="text-sm text-muted-foreground">
                    Track activity, risks, and momentum across your accounts.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden md:flex rounded-lg border border-border/60 bg-card/60 backdrop-blur-sm">
                    <Button
                      variant={view === "grid" ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2 rounded-l-lg"
                      onClick={() => setView("grid")}
                    >
                      <Grid2X2 className="h-4 w-4" />
                      Grid
                    </Button>
                    <Separator orientation="vertical" />
                    <Button
                      variant={view === "list" ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2 rounded-r-lg"
                      onClick={() => setView("list")}
                    >
                      <List className="h-4 w-4" />
                      List
                    </Button>
                  </div>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Add Company
                  </Button>
                </div>
              </div>

              {/* Top Stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard title="Total Companies" value="127" />
                <StatCard title="Active Companies" value="76" caption="Called in last 30 days" />
                <StatCard title="Critical Risks" value="8" valueColor="text-red-400" />
                <StatCard title="New This Month" value="12" caption="+18% vs last month" />
              </div>

              {/* Filters */}
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 items-center gap-2">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search companies…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      className="pl-8 bg-card/60 border-border/60"
                    />
                  </div>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger className="w-[160px] bg-card/60 border-border/60">
                      <SelectValue placeholder="Industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Industries</SelectItem>
                      {INDUSTRIES.map((i) => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={risk} onValueChange={setRisk}>
                    <SelectTrigger className="w-[150px] bg-card/60 border-border/60">
                      <SelectValue placeholder="Risk" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risks</SelectItem>
                      <SelectItem value="Warning">Warning</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px] bg-card/60 border-border/60">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calls">By Call Count</SelectItem>
                      <SelectItem value="score">By Score</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setQ(""); setIndustry("all"); setRisk("all"); setSortBy("calls"); }}>
                  Clear Filters
                </Button>
              </div>

              {/* Companies Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pageItems.map((c) => (
                  <CompanyCard key={c.id} company={c} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// -------------------
// Components
// -------------------
function StatCard({ title, value, caption, valueColor = "text-foreground" }: any) {
  return (
    <Card className="border-border/60 bg-card/60 shadow-sm backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">{title}</CardDescription>
        <CardTitle className={`text-2xl ${valueColor}`}>{value}</CardTitle>
        {caption && <p className="text-[11px] text-muted-foreground">{caption}</p>}
      </CardHeader>
    </Card>
  );
}

function CompanyCard({ company }: any) {
  return (
    <Card className="border-border/60 bg-card/60 shadow-sm backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-medium">{company.name}</CardTitle>
            <CardDescription className="text-xs">{company.industry}</CardDescription>
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
          {company.risk ? <RiskBadge level={company.risk} /> : <div />}
          <ScoreDot score={company.score} />
        </div>
        <Button variant="outline" className="w-full text-sm">View Details</Button>
      </CardContent>
    </Card>
  );
}

function RiskBadge({ level }: any) {
  const map = {
    Warning: "bg-amber-950/40 text-amber-300 border-amber-900",
    Critical: "bg-red-950/40 text-red-300 border-red-900",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${map[level]}`}>
      {level === "Critical" ? "Critical Risk" : level}
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
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
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