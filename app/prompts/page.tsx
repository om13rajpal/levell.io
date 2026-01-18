"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import {
  PlayIcon,
  HistoryIcon,
  BarChart3Icon,
  RefreshCwIcon,
  SparklesIcon,
  Loader2Icon,
  CheckIcon,
  XIcon,
  CopyIcon,
  CodeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CoinsIcon,
  ZapIcon,
  ClockIcon,
  EditIcon,
  SaveIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AgentPrompt {
  id: string;
  name: string;
  agent_type: string;
  prompt_content: string;
  system_prompt: string | null;
  user_prompt_template: string | null;
  temperature: number;
  description: string | null;
  is_active: boolean;
  version: number;
  variables: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface PromptVersion {
  id: string;
  prompt_id: string;
  version: number;
  name: string;
  prompt_content: string;
  description: string | null;
  variables: string[];
  created_at: string;
  is_current: boolean;
}

interface AgentRun {
  id: string;
  agent_type: string;
  prompt_version: number;
  status: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: string;
  duration_ms: number;
  model: string;
  output: string | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  is_test_run: boolean;
}

interface TestTranscript {
  id: string;
  name: string;
  description: string | null;
  scenario_type: string;
  expected_outcome: string | null;
  transcript_content?: string;
  transcript_id: number | null;
}

const AGENT_LABELS: Record<string, string> = {
  pain_points: "Pain Points",
  objection: "Objection",
  engagement: "Engagement",
  next_steps: "Next Steps",
  call_structure: "Call Structure",
  rep_technique: "Rep Technique",
  synthesis: "Synthesis",
};

function PromptsPageContent() {
  const searchParams = useSearchParams();
  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Version History Dialog
  const [versionsDialogOpen, setVersionsDialogOpen] = useState(false);
  const [selectedPromptForVersions, setSelectedPromptForVersions] = useState<AgentPrompt | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersionContent, setSelectedVersionContent] = useState<string | null>(null);

  // Outputs Dialog
  const [outputsDialogOpen, setOutputsDialogOpen] = useState(false);
  const [selectedPromptForOutputs, setSelectedPromptForOutputs] = useState<AgentPrompt | null>(null);
  const [outputs, setOutputs] = useState<AgentRun[]>([]);
  const [outputsLoading, setOutputsLoading] = useState(false);
  const [selectedOutput, setSelectedOutput] = useState<AgentRun | null>(null);

  // Run Prompt Dialog
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [selectedPromptForRun, setSelectedPromptForRun] = useState<AgentPrompt | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runResult, setRunResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    run_id?: string;
  } | null>(null);

  // Test Transcripts
  const [testTranscripts, setTestTranscripts] = useState<TestTranscript[]>([]);
  const [selectedTestTranscript, setSelectedTestTranscript] = useState<string>("");
  const [testTranscriptsLoading, setTestTranscriptsLoading] = useState(false);

  // Edit Prompt Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPromptForEdit, setSelectedPromptForEdit] = useState<AgentPrompt | null>(null);
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [editUserPrompt, setEditUserPrompt] = useState("");
  const [editTemperature, setEditTemperature] = useState(0.3);
  const [editLoading, setEditLoading] = useState(false);

  // Run dialog temperature override
  const [runTemperature, setRunTemperature] = useState(0.3);

  // Fetch prompts
  const fetchPrompts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/prompts?active_only=true");
      const data = await response.json();

      if (response.ok) {
        setPrompts(data.prompts || []);
      } else {
        toast.error("Failed to fetch prompts");
      }
    } catch {
      toast.error("Error fetching prompts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // Toggle prompt expansion
  const toggleExpand = (id: string) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Copy prompt to clipboard
  const handleCopy = async (prompt: AgentPrompt) => {
    try {
      await navigator.clipboard.writeText(prompt.prompt_content);
      setCopiedId(prompt.id);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Open Version History Dialog
  const handleViewVersions = async (prompt: AgentPrompt) => {
    setSelectedPromptForVersions(prompt);
    setVersionsDialogOpen(true);
    setVersionsLoading(true);
    setSelectedVersionContent(null);

    try {
      const response = await fetch(`/api/prompts?version_history=${prompt.id}`);
      const data = await response.json();

      if (response.ok) {
        setVersions(data.versions || []);
      } else {
        toast.error("Failed to fetch versions");
      }
    } catch {
      toast.error("Error fetching versions");
    } finally {
      setVersionsLoading(false);
    }
  };

  // Open Outputs Dialog
  const handleViewOutputs = async (prompt: AgentPrompt) => {
    setSelectedPromptForOutputs(prompt);
    setOutputsDialogOpen(true);
    setOutputsLoading(true);
    setSelectedOutput(null);

    try {
      const response = await fetch(`/api/agent-runs?prompt_id=${prompt.id}&page_size=50`);
      const data = await response.json();

      if (response.ok) {
        setOutputs(data.runs || []);
      } else {
        toast.error("Failed to fetch outputs");
      }
    } catch {
      toast.error("Error fetching outputs");
    } finally {
      setOutputsLoading(false);
    }
  };

  // Fetch test transcripts
  const fetchTestTranscripts = async () => {
    setTestTranscriptsLoading(true);
    try {
      const response = await fetch("/api/test-transcripts");
      const data = await response.json();
      if (response.ok) {
        setTestTranscripts(data.transcripts || []);
      }
    } catch {
      console.error("Failed to fetch test transcripts");
    } finally {
      setTestTranscriptsLoading(false);
    }
  };

  // Open Run Prompt Dialog
  const handleRunPrompt = (prompt: AgentPrompt) => {
    setSelectedPromptForRun(prompt);
    setRunResult(null);
    setSelectedTestTranscript("");
    setRunTemperature(prompt.temperature ?? 0.3);
    setRunDialogOpen(true);
    fetchTestTranscripts();
  };

  // Execute Run
  const executeRun = async (workflow: string = "scoreV2") => {
    if (!selectedPromptForRun) return;

    if (!selectedTestTranscript) {
      toast.error("Please select a test transcript");
      return;
    }

    // Find the selected transcript from already loaded data
    const transcript = testTranscripts.find(t => t.id === selectedTestTranscript);

    if (!transcript) {
      toast.error("Selected transcript not found");
      return;
    }

    setRunLoading(true);
    try {
      // Fetch full transcript content for the test
      const transcriptResponse = await fetch(`/api/test-transcripts?include_content=true`);
      const transcriptData = await transcriptResponse.json();
      const fullTranscript = transcriptData.transcripts?.find((t: TestTranscript) => t.id === selectedTestTranscript);

      // Use transcript_id from already loaded data as primary source (more reliable)
      // Fallback to fullTranscript if available
      const transcriptId = transcript.transcript_id ?? fullTranscript?.transcript_id ?? null;
      const transcriptContent = fullTranscript?.transcript_content || "";

      console.log("[Run Prompt] Selected transcript:", transcript.name);
      console.log("[Run Prompt] transcript_id:", transcriptId);
      console.log("[Run Prompt] Has content:", !!transcriptContent);

      const response = await fetch("/api/prompts/trigger-n8n", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow,
          prompt_id: selectedPromptForRun.id,
          agent_type: selectedPromptForRun.agent_type,
          test_mode: true,
          transcript_id: transcriptId,
          test_transcript: transcriptContent,
          test_transcript_name: transcript.name,
          // Include system/user prompts and temperature
          system_prompt: selectedPromptForRun.system_prompt || selectedPromptForRun.prompt_content,
          user_prompt_template: selectedPromptForRun.user_prompt_template || "",
          temperature: runTemperature,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRunResult({
          success: true,
          message: data.message || "Workflow triggered successfully",
          run_id: data.n8n_response?.run_id,
        });
        toast.success("Prompt run triggered successfully!");
      } else {
        setRunResult({
          success: false,
          error: data.error || "Failed to trigger workflow",
        });
        toast.error(data.error || "Failed to run prompt");
      }
    } catch (error) {
      setRunResult({
        success: false,
        error: "Network error occurred",
      });
      toast.error("Error running prompt");
    } finally {
      setRunLoading(false);
    }
  };

  // Open Edit Dialog
  const handleEditPrompt = (prompt: AgentPrompt) => {
    setSelectedPromptForEdit(prompt);
    // Use system_prompt if available, otherwise fall back to prompt_content
    setEditSystemPrompt(prompt.system_prompt || prompt.prompt_content || "");
    setEditUserPrompt(prompt.user_prompt_template || "");
    setEditTemperature(prompt.temperature ?? 0.3);
    setEditDialogOpen(true);
  };

  // Save Edited Prompt
  const handleSavePrompt = async () => {
    if (!selectedPromptForEdit) return;

    setEditLoading(true);
    try {
      const response = await fetch(`/api/prompts/${selectedPromptForEdit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: editSystemPrompt,
          user_prompt_template: editUserPrompt,
          temperature: editTemperature,
          // Also update prompt_content for backward compatibility
          prompt_content: editSystemPrompt,
        }),
      });

      if (response.ok) {
        toast.success("Prompt saved (previous version archived)");
        setEditDialogOpen(false);
        fetchPrompts();
      } else {
        toast.error("Failed to save prompt");
      }
    } catch {
      toast.error("Error saving prompt");
    } finally {
      setEditLoading(false);
    }
  };

  // Format duration
  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
                <SparklesIcon className="size-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Agent Prompts</h1>
                <p className="text-muted-foreground">
                  7 AI agents for sales call analysis
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Workflow Variables Info */}
              <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                <span className="font-semibold">Workflow Variables:</span>
                <Badge variant="outline" className="text-xs" title="Content to analyze">transcript</Badge>
                <Badge variant="outline" className="text-xs" title="Agent prompt template">prompt_content</Badge>
                <Badge variant="outline" className="text-xs" title="Which agent type">agent_type</Badge>
              </div>

              <Button variant="outline" size="icon" onClick={fetchPrompts}>
                <RefreshCwIcon className="size-4" />
              </Button>

              <Link href="/agent-runs">
                <Button variant="outline" className="gap-2">
                  <BarChart3Icon className="size-4" />
                  View All Runs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Variables Info Card */}
      <div className="container mx-auto px-4 pt-6">
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CodeIcon className="size-4" />
                  n8n Workflow Variables
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="space-y-1">
                    <Badge variant="secondary" className="font-mono">{"{{transcript}}"}</Badge>
                    <p className="text-muted-foreground">The sales call transcript content to analyze</p>
                  </div>
                  <div className="space-y-1">
                    <Badge variant="secondary" className="font-mono">{"{{prompt_content}}"}</Badge>
                    <p className="text-muted-foreground">The agent&apos;s system prompt template</p>
                  </div>
                  <div className="space-y-1">
                    <Badge variant="secondary" className="font-mono">{"{{agent_type}}"}</Badge>
                    <p className="text-muted-foreground">Agent type (pain_points, objection, etc.)</p>
                  </div>
                  <div className="space-y-1">
                    <Badge variant="secondary" className="font-mono">{"{{prompt_id}}"}</Badge>
                    <p className="text-muted-foreground">UUID of the prompt being executed</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCwIcon className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : prompts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <SparklesIcon className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No prompts found</h3>
              <p className="text-muted-foreground">
                Prompts will appear here once configured
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {prompts.map((prompt) => (
              <Card
                key={prompt.id}
                className="transition-all duration-200 hover:shadow-md"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleExpand(prompt.id)}
                        className="mt-1 p-1 rounded hover:bg-muted transition-colors"
                      >
                        {expandedPrompts.has(prompt.id) ? (
                          <ChevronDownIcon className="size-4" />
                        ) : (
                          <ChevronRightIcon className="size-4" />
                        )}
                      </button>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {prompt.name}
                          <Badge variant="secondary" className="text-xs">
                            v{prompt.version}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {prompt.description || `${AGENT_LABELS[prompt.agent_type] || prompt.agent_type} agent`}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {AGENT_LABELS[prompt.agent_type] || prompt.agent_type}
                      </Badge>

                      {/* Run Prompt Button */}
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleRunPrompt(prompt)}
                      >
                        <PlayIcon className="size-3" />
                        Run Prompt
                      </Button>

                      {/* View Versions Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleViewVersions(prompt)}
                      >
                        <HistoryIcon className="size-3" />
                        Versions
                      </Button>

                      {/* View Outputs Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleViewOutputs(prompt)}
                      >
                        <BarChart3Icon className="size-3" />
                        Outputs
                      </Button>

                      {/* Edit Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditPrompt(prompt)}
                      >
                        <EditIcon className="size-4" />
                      </Button>

                      {/* Copy Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(prompt)}
                      >
                        {copiedId === prompt.id ? (
                          <CheckIcon className="size-4 text-green-500" />
                        ) : (
                          <CopyIcon className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expandedPrompts.has(prompt.id) && (
                  <CardContent className="pt-4">
                    {/* Variables */}
                    {prompt.variables && prompt.variables.length > 0 && (
                      <div className="mb-4">
                        <Label className="text-sm font-medium mb-2 block">
                          Variables
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {prompt.variables.map((v) => (
                            <Badge
                              key={v}
                              variant="secondary"
                              className="font-mono text-xs"
                            >
                              {`{{${v}}}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prompt Content */}
                    <div>
                      <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                        <CodeIcon className="size-4" />
                        Prompt Content
                      </Label>
                      <div className="relative">
                        <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap font-mono max-h-[400px] overflow-y-auto">
                          {prompt.prompt_content}
                        </pre>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Updated: {new Date(prompt.updated_at).toLocaleDateString()}
                      </span>
                      <span>{prompt.prompt_content.length} characters</span>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Run Prompt Dialog */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayIcon className="size-5 text-green-500" />
              Run Prompt
            </DialogTitle>
            <DialogDescription>
              Trigger the n8n workflow to run this prompt
            </DialogDescription>
          </DialogHeader>

          {selectedPromptForRun && (
            <div className="space-y-4 py-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{selectedPromptForRun.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {AGENT_LABELS[selectedPromptForRun.agent_type] || selectedPromptForRun.agent_type}
                      </p>
                    </div>
                    <Badge variant="secondary">v{selectedPromptForRun.version}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Test Transcript Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Test Transcript</Label>
                {testTranscriptsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2Icon className="size-4 animate-spin" />
                    Loading transcripts...
                  </div>
                ) : testTranscripts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No test transcripts available
                  </p>
                ) : (
                  <Select value={selectedTestTranscript} onValueChange={setSelectedTestTranscript}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a test transcript..." />
                    </SelectTrigger>
                    <SelectContent>
                      {testTranscripts.map((transcript) => (
                        <SelectItem key={transcript.id} value={transcript.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {transcript.scenario_type}
                            </Badge>
                            <span>{transcript.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedTestTranscript && (
                  <p className="text-xs text-muted-foreground">
                    {testTranscripts.find(t => t.id === selectedTestTranscript)?.description}
                  </p>
                )}
              </div>

              {/* Temperature Control */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Temperature</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[runTemperature]}
                    onValueChange={(v) => setRunTemperature(v[0])}
                    min={0}
                    max={2}
                    step={0.1}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-10 text-center">{runTemperature}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {runTemperature <= 0.3 ? "Lower = more deterministic/consistent" :
                   runTemperature >= 1 ? "Higher = more creative/varied" : "Balanced output"}
                </p>
              </div>

              <Button
                className="w-full gap-2"
                onClick={() => executeRun("testPrompt")}
                disabled={runLoading || !selectedTestTranscript}
              >
                {runLoading ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <ZapIcon className="size-4" />
                    Run Single Agent
                  </>
                )}
              </Button>

              {runResult && (
                <Card className={cn(runResult.success ? "border-green-500/50" : "border-destructive/50")}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {runResult.success ? (
                        <CheckIcon className="size-5 text-green-500 mt-0.5" />
                      ) : (
                        <XIcon className="size-5 text-destructive mt-0.5" />
                      )}
                      <div>
                        <p className={cn("font-medium", runResult.success ? "text-green-600" : "text-destructive")}>
                          {runResult.success ? "Run Started!" : "Run Failed"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {runResult.success ? runResult.message : runResult.error}
                        </p>
                        {runResult.run_id && (
                          <Link
                            href={`/agent-runs?prompt_id=${selectedPromptForRun.id}`}
                            className="text-sm text-primary hover:underline mt-2 inline-block"
                          >
                            View Run Results →
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRunDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={versionsDialogOpen} onOpenChange={setVersionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="size-5" />
              Version History: {selectedPromptForVersions?.name}
            </DialogTitle>
            <DialogDescription>
              View and compare all versions of this prompt
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex gap-4">
            {/* Version List */}
            <div className="w-1/3 border-r pr-4">
              {versionsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2Icon className="size-6 animate-spin" />
                </div>
              ) : versions.length === 0 ? (
                <p className="text-muted-foreground text-center py-10">
                  No version history
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {versions.map((version) => (
                      <button
                        key={version.id}
                        onClick={() => setSelectedVersionContent(version.prompt_content)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-colors",
                          selectedVersionContent === version.prompt_content
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Version {version.version}</span>
                          {version.is_current && (
                            <Badge variant="default" className="text-xs">Current</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(version.created_at).toLocaleString()}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Version Content */}
            <div className="flex-1">
              {selectedVersionContent ? (
                <ScrollArea className="h-[400px]">
                  <pre className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap font-mono">
                    {selectedVersionContent}
                  </pre>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a version to view content
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outputs Dialog */}
      <Dialog open={outputsDialogOpen} onOpenChange={setOutputsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3Icon className="size-5" />
              Outputs: {selectedPromptForOutputs?.name}
            </DialogTitle>
            <DialogDescription>
              View all execution outputs and token usage
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {outputsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2Icon className="size-6 animate-spin" />
              </div>
            ) : outputs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <BarChart3Icon className="size-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No outputs yet</p>
                <p className="text-sm text-muted-foreground">Run the prompt to see outputs here</p>
              </div>
            ) : selectedOutput ? (
              // Detail View
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOutput(null)}
                >
                  ← Back to list
                </Button>

                {/* Token Usage Summary */}
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <ZapIcon className="size-4 text-blue-500" />
                        <span className="text-sm">Input Tokens</span>
                      </div>
                      <p className="text-xl font-bold mt-1">
                        {selectedOutput.input_tokens?.toLocaleString() || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <ZapIcon className="size-4 text-green-500" />
                        <span className="text-sm">Output Tokens</span>
                      </div>
                      <p className="text-xl font-bold mt-1">
                        {selectedOutput.output_tokens?.toLocaleString() || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <CoinsIcon className="size-4 text-yellow-500" />
                        <span className="text-sm">Cost</span>
                      </div>
                      <p className="text-xl font-bold mt-1">
                        ${parseFloat(selectedOutput.cost_usd || "0").toFixed(4)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="size-4 text-purple-500" />
                        <span className="text-sm">Duration</span>
                      </div>
                      <p className="text-xl font-bold mt-1">
                        {formatDuration(selectedOutput.duration_ms)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Output Content */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Output</Label>
                  <ScrollArea className="h-[300px]">
                    <pre className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap font-mono">
                      {selectedOutput.output || JSON.stringify(selectedOutput.output_data, null, 2) || "No output"}
                    </pre>
                  </ScrollArea>
                </div>

                {selectedOutput.error_message && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block text-destructive">Error</Label>
                    <pre className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
                      {selectedOutput.error_message}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              // List View
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outputs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="text-xs">
                          {new Date(run.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">v{run.prompt_version}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{run.model}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {((run.input_tokens || 0) + (run.output_tokens || 0)).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          ${parseFloat(run.cost_usd || "0").toFixed(4)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDuration(run.duration_ms)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={run.status === "completed" ? "default" : "destructive"}
                            className={cn(
                              "text-xs",
                              run.status === "completed" && "bg-green-500/10 text-green-600 border-green-500/20"
                            )}
                          >
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedOutput(run)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>

          <DialogFooter>
            <Link href={`/agent-runs?prompt_id=${selectedPromptForOutputs?.id}`}>
              <Button variant="outline" className="gap-2">
                View Full History
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setOutputsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Prompt Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <EditIcon className="size-5" />
              Edit Prompt: {selectedPromptForEdit?.name}
            </DialogTitle>
            <DialogDescription>
              Modify system and user prompts. Previous version will be archived.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden py-4 space-y-4">
            {/* Temperature Control */}
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium min-w-[100px]">Temperature:</Label>
              <Slider
                value={[editTemperature]}
                onValueChange={(v) => setEditTemperature(v[0])}
                min={0}
                max={2}
                step={0.1}
                className="flex-1 max-w-[200px]"
              />
              <Input
                type="number"
                value={editTemperature}
                onChange={(e) => setEditTemperature(parseFloat(e.target.value) || 0)}
                min={0}
                max={2}
                step={0.1}
                className="w-20 text-center"
              />
              <span className="text-xs text-muted-foreground">
                {editTemperature <= 0.3 ? "More deterministic" : editTemperature >= 1 ? "More creative" : "Balanced"}
              </span>
            </div>

            {/* Tabbed Prompts */}
            <Tabs defaultValue="system" className="flex-1">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="system">System Prompt</TabsTrigger>
                <TabsTrigger value="user">User Prompt Template</TabsTrigger>
              </TabsList>
              <TabsContent value="system" className="mt-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Sets the AI&apos;s behavior, role, and output format
                  </Label>
                  <Textarea
                    value={editSystemPrompt}
                    onChange={(e) => setEditSystemPrompt(e.target.value)}
                    className="min-h-[350px] font-mono text-sm"
                    placeholder="Enter system prompt (e.g., You are a sales coach...)"
                  />
                </div>
              </TabsContent>
              <TabsContent value="user" className="mt-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Template with {"{{variables}}"} for dynamic content (e.g., {"{{transcript}}"})
                  </Label>
                  <Textarea
                    value={editUserPrompt}
                    onChange={(e) => setEditUserPrompt(e.target.value)}
                    className="min-h-[350px] font-mono text-sm"
                    placeholder="Enter user prompt template (e.g., Analyze this transcript: {{transcript}})"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePrompt} disabled={editLoading} className="gap-2">
              {editLoading ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <SaveIcon className="size-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PromptsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCwIcon className="size-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <PromptsPageContent />
    </Suspense>
  );
}
