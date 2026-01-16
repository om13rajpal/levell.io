"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIcon,
  FilterIcon,
  RefreshCwIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  StarIcon,
  ClockIcon,
  CoinsIcon,
  ZapIcon,
  UserIcon,
  PhoneIcon,
  BuildingIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  CopyIcon,
  CheckIcon,
  BarChart3Icon,
  TrendingUpIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AgentRun {
  id: string;
  agent_type: string;
  prompt_id: string | null;
  prompt_sent: string;
  system_prompt: string | null;
  user_message: string | null;
  output: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost: string;
  transcript_id: number | null;
  company_id: string | null;
  user_id: string | null;
  context_type: string;
  context_data: Record<string, unknown>;
  duration_ms: number | null;
  status: string;
  error_message: string | null;
  is_best: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  agent_prompts?: { id: string; name: string; version: number } | null;
  transcripts?: { id: number; title: string } | null;
  companies?: { id: string; company_name: string } | null;
  users?: { id: string; name: string; email: string } | null;
}

interface Stats {
  summary: {
    totalRuns: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCost: string;
    avgDurationMs: number;
    errorCount: number;
    errorRate: string;
    bestCount: number;
  };
  byModel: Array<{ model: string; count: number; tokens: number; cost: string }>;
  byAgentType: Array<{ agentType: string; count: number; tokens: number; cost: string }>;
  byDate: Array<{ date: string; count: number; tokens: number; cost: string }>;
}

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

const AGENT_TYPES = [
  { value: "sales_intelligence", label: "Sales Intelligence" },
  { value: "call_analyzer", label: "Call Analyzer" },
  { value: "deal_risk", label: "Deal Risk" },
  { value: "coaching", label: "Coaching" },
  { value: "summary", label: "Summary" },
];

export default function AgentRunsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    agent_type: "",
    model: "",
    context_type: "",
    status: "",
    is_best: "",
  });

  // Fetch runs
  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });

      if (filters.agent_type) params.set("agent_type", filters.agent_type);
      if (filters.model) params.set("model", filters.model);
      if (filters.context_type) params.set("context_type", filters.context_type);
      if (filters.status) params.set("status", filters.status);
      if (filters.is_best) params.set("is_best", filters.is_best);

      const response = await fetch(`/api/agent-runs?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setRuns(data.runs || []);
        setTotalCount(data.pagination?.totalCount || 0);
        setTotalPages(data.pagination?.totalPages || 0);
      } else {
        toast.error("Failed to fetch runs");
      }
    } catch {
      toast.error("Error fetching runs");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/agent-runs/stats");
      const data = await response.json();

      if (response.ok) {
        setStats(data);
      }
    } catch {
      console.error("Error fetching stats");
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    fetchStats();
  }, [fetchRuns, fetchStats]);

  // Mark run as best
  const handleToggleBest = async (run: AgentRun) => {
    try {
      const response = await fetch(`/api/agent-runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_best: !run.is_best }),
      });

      if (response.ok) {
        toast.success(run.is_best ? "Removed from best" : "Marked as best");
        fetchRuns();
      } else {
        toast.error("Failed to update");
      }
    } catch {
      toast.error("Error updating run");
    }
  };

  // Copy to clipboard
  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Format duration
  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircleIcon className="size-3 mr-1" />
            Completed
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircleIcon className="size-3 mr-1" />
            Error
          </Badge>
        );
      case "streaming":
        return (
          <Badge variant="secondary">
            <ActivityIcon className="size-3 mr-1 animate-pulse" />
            Streaming
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircleIcon className="size-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
                <ActivityIcon className="size-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Agent Runs</h1>
                <p className="text-muted-foreground">
                  Browse and audit AI agent executions
                </p>
              </div>
            </div>

            <Button variant="outline" onClick={fetchRuns}>
              <RefreshCwIcon className="size-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="runs" className="space-y-6">
          <TabsList>
            <TabsTrigger value="runs" className="gap-2">
              <ActivityIcon className="size-4" />
              All Runs
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3Icon className="size-4" />
              Statistics
            </TabsTrigger>
          </TabsList>

          {/* Runs Tab */}
          <TabsContent value="runs" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <FilterIcon className="size-4" />
                  <CardTitle className="text-base">Filters</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Agent Type</Label>
                    <Select
                      value={filters.agent_type}
                      onValueChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          agent_type: v === "all" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {AGENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Model</Label>
                    <Select
                      value={filters.model}
                      onValueChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          model: v === "all" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All models" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All models</SelectItem>
                        {MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Context</Label>
                    <Select
                      value={filters.context_type}
                      onValueChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          context_type: v === "all" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All contexts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All contexts</SelectItem>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={filters.status}
                      onValueChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          status: v === "all" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="streaming">Streaming</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Best Only</Label>
                    <Select
                      value={filters.is_best}
                      onValueChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          is_best: v === "all" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All runs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All runs</SelectItem>
                        <SelectItem value="true">Best only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Runs Table */}
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <RefreshCwIcon className="size-8 animate-spin text-muted-foreground" />
                  </div>
                ) : runs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <ActivityIcon className="size-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No runs found</h3>
                    <p className="text-muted-foreground">
                      Agent runs will appear here when they execute
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Context</TableHead>
                        <TableHead>Tokens</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run) => (
                        <TableRow key={run.id} className={cn(run.is_best && "bg-yellow-500/5")}>
                          <TableCell className="font-mono text-xs">
                            {new Date(run.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-medium">
                              {run.agent_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <ZapIcon className="size-3 text-muted-foreground" />
                              <span className="text-sm">{run.model}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {run.context_type === "call" ? (
                                <PhoneIcon className="size-3 text-muted-foreground" />
                              ) : run.context_type === "company" ? (
                                <BuildingIcon className="size-3 text-muted-foreground" />
                              ) : (
                                <UserIcon className="size-3 text-muted-foreground" />
                              )}
                              <span className="text-sm truncate max-w-[150px]">
                                {run.transcripts?.title ||
                                  run.companies?.company_name ||
                                  run.context_type}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {run.total_tokens.toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            ${parseFloat(run.total_cost).toFixed(4)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDuration(run.duration_ms)}
                          </TableCell>
                          <TableCell>{getStatusBadge(run.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleToggleBest(run)}
                              >
                                <StarIcon
                                  className={cn(
                                    "size-4",
                                    run.is_best
                                      ? "fill-yellow-500 text-yellow-500"
                                      : "text-muted-foreground"
                                  )}
                                />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => setSelectedRun(run)}
                              >
                                <EyeIcon className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1} to{" "}
                    {Math.min(page * pageSize, totalCount)} of {totalCount} runs
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeftIcon className="size-4" />
                    </Button>
                    <span className="text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRightIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-6">
            {stats && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <ActivityIcon className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Runs</p>
                          <p className="text-2xl font-bold">
                            {stats.summary.totalRuns.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <ZapIcon className="size-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Tokens</p>
                          <p className="text-2xl font-bold">
                            {stats.summary.totalTokens.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/10">
                          <CoinsIcon className="size-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Cost</p>
                          <p className="text-2xl font-bold">${stats.summary.totalCost}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                          <ClockIcon className="size-5 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Avg Duration</p>
                          <p className="text-2xl font-bold">
                            {formatDuration(stats.summary.avgDurationMs)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Breakdown Tables */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">By Model</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Model</TableHead>
                            <TableHead className="text-right">Runs</TableHead>
                            <TableHead className="text-right">Tokens</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.byModel.map((item) => (
                            <TableRow key={item.model}>
                              <TableCell className="font-medium">{item.model}</TableCell>
                              <TableCell className="text-right">{item.count}</TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {item.tokens.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                ${item.cost}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">By Agent Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Runs</TableHead>
                            <TableHead className="text-right">Tokens</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.byAgentType.map((item) => (
                            <TableRow key={item.agentType}>
                              <TableCell className="font-medium">{item.agentType}</TableCell>
                              <TableCell className="text-right">{item.count}</TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {item.tokens.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                ${item.cost}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                {/* Daily Trend */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingUpIcon className="size-4" />
                      <CardTitle className="text-base">Daily Activity (Last 30 Days)</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Runs</TableHead>
                          <TableHead className="text-right">Tokens</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.byDate.slice(0, 10).map((item) => (
                          <TableRow key={item.date}>
                            <TableCell className="font-medium">{item.date}</TableCell>
                            <TableCell className="text-right">{item.count}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {item.tokens.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              ${item.cost}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Run Detail Dialog */}
      <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedRun && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Agent Run Details
                  {selectedRun.is_best && (
                    <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      <StarIcon className="size-3 mr-1 fill-current" />
                      Best
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {new Date(selectedRun.created_at).toLocaleString()} •{" "}
                  {selectedRun.model} • {formatDuration(selectedRun.duration_ms)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Metadata Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Agent Type</Label>
                    <p className="font-medium">{selectedRun.agent_type}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Model</Label>
                    <p className="font-medium">{selectedRun.model}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div>{getStatusBadge(selectedRun.status)}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Context</Label>
                    <p className="font-medium">
                      {selectedRun.transcripts?.title ||
                        selectedRun.companies?.company_name ||
                        selectedRun.context_type}
                    </p>
                  </div>
                </div>

                {/* Token Usage */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Token Usage & Cost</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">
                          {selectedRun.prompt_tokens.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Prompt Tokens</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {selectedRun.completion_tokens.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Completion Tokens</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {selectedRun.total_tokens.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Tokens</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          ${parseFloat(selectedRun.total_cost).toFixed(4)}
                        </p>
                        <p className="text-xs text-muted-foreground">Cost (USD)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* System Prompt */}
                {selectedRun.system_prompt && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">System Prompt</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopy(selectedRun.system_prompt!, "system")
                        }
                      >
                        {copiedField === "system" ? (
                          <CheckIcon className="size-4" />
                        ) : (
                          <CopyIcon className="size-4" />
                        )}
                      </Button>
                    </div>
                    <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto">
                      {selectedRun.system_prompt}
                    </pre>
                  </div>
                )}

                {/* User Message */}
                {selectedRun.user_message && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">User Message</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopy(selectedRun.user_message!, "user")
                        }
                      >
                        {copiedField === "user" ? (
                          <CheckIcon className="size-4" />
                        ) : (
                          <CopyIcon className="size-4" />
                        )}
                      </Button>
                    </div>
                    <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-[150px] overflow-y-auto">
                      {selectedRun.user_message}
                    </pre>
                  </div>
                )}

                {/* Full Prompt Sent */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Full Prompt Sent</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(selectedRun.prompt_sent, "prompt")}
                    >
                      {copiedField === "prompt" ? (
                        <CheckIcon className="size-4" />
                      ) : (
                        <CopyIcon className="size-4" />
                      )}
                    </Button>
                  </div>
                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                    {selectedRun.prompt_sent}
                  </pre>
                </div>

                {/* Output */}
                {selectedRun.output && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Agent Output</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(selectedRun.output!, "output")}
                      >
                        {copiedField === "output" ? (
                          <CheckIcon className="size-4" />
                        ) : (
                          <CopyIcon className="size-4" />
                        )}
                      </Button>
                    </div>
                    <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                      {selectedRun.output}
                    </pre>
                  </div>
                )}

                {/* Error Message */}
                {selectedRun.error_message && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-destructive">
                      Error Message
                    </Label>
                    <pre className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-destructive">
                      {selectedRun.error_message}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
