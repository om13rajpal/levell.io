"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileTextIcon,
  PlusIcon,
  SaveIcon,
  XIcon,
  EditIcon,
  TrashIcon,
  CopyIcon,
  CheckIcon,
  CodeIcon,
  RefreshCwIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlayIcon,
  FlaskConicalIcon,
  Loader2Icon,
  DollarSignIcon,
  ClockIcon,
  TargetIcon,
  StarIcon,
  HistoryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AgentPrompt {
  id: string;
  name: string;
  agent_type: string;
  prompt_content: string;
  description: string | null;
  is_active: boolean;
  version: number;
  variables: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TestTranscript {
  id: string;
  transcript_id: number;
  label: string;
  description: string | null;
  call_type: string;
  difficulty: string;
  transcripts: {
    id: number;
    title: string;
    fireflies_id: string;
    duration: number;
    ai_overall_score: number | null;
  };
}

interface TestResult {
  test_transcript_id: string;
  label: string;
  call_type: string;
  transcript_title: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  duration_ms: number;
  output: Record<string, unknown> | null;
  error?: string;
  run_id?: string;
}

interface TestResponse {
  prompt: {
    id: string;
    name: string;
    agent_type: string;
    version: number;
  };
  model: string;
  summary: {
    total_transcripts: number;
    successful: number;
    failed: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cost: string;
    total_duration_ms: number;
  };
  results: TestResult[];
}

const AGENT_TYPES = [
  { value: "sales_intelligence", label: "Sales Intelligence" },
  { value: "pain_points", label: "Pain Points" },
  { value: "objections", label: "Objections" },
  { value: "engagement", label: "Engagement" },
  { value: "next_steps", label: "Next Steps" },
  { value: "call_structure", label: "Call Structure" },
  { value: "rep_technique", label: "Rep Technique" },
  { value: "synthesis", label: "Synthesis" },
  { value: "custom", label: "Custom" },
];

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o", cost: "$2.50/$10.00" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", cost: "$0.15/$0.60" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo", cost: "$10.00/$30.00" },
];

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [testTranscripts, setTestTranscripts] = useState<TestTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<AgentPrompt | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  // Test state
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testPrompt, setTestPrompt] = useState<AgentPrompt | null>(null);
  const [selectedTranscripts, setSelectedTranscripts] = useState<Set<string>>(new Set());
  const [testModel, setTestModel] = useState("gpt-4o");
  const [testResults, setTestResults] = useState<TestResponse | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    agent_type: "sales_intelligence",
    prompt_content: "",
    description: "",
    is_active: true,
    variables: [] as string[],
  });

  // Fetch prompts
  const fetchPrompts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== "all") {
        params.set("agent_type", filterType);
      }

      const response = await fetch(`/api/prompts?${params.toString()}`);
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
  }, [filterType]);

  // Fetch test transcripts
  const fetchTestTranscripts = useCallback(async () => {
    try {
      const response = await fetch("/api/test-transcripts");
      const data = await response.json();
      if (response.ok) {
        setTestTranscripts(data.test_transcripts || []);
        // Select all by default
        setSelectedTranscripts(new Set(data.test_transcripts?.map((t: TestTranscript) => t.id) || []));
      }
    } catch (error) {
      console.error("Failed to fetch test transcripts:", error);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
    fetchTestTranscripts();
  }, [fetchPrompts, fetchTestTranscripts]);

  // Extract variables from prompt content
  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
  };

  // Handle form changes
  const handleContentChange = (content: string) => {
    setFormData((prev) => ({
      ...prev,
      prompt_content: content,
      variables: extractVariables(content),
    }));
  };

  // Open edit dialog
  const handleEdit = (prompt: AgentPrompt) => {
    setSelectedPrompt(prompt);
    setFormData({
      name: prompt.name,
      agent_type: prompt.agent_type,
      prompt_content: prompt.prompt_content,
      description: prompt.description || "",
      is_active: prompt.is_active,
      variables: prompt.variables || [],
    });
    setIsEditing(true);
  };

  // Open create dialog
  const handleCreate = () => {
    setFormData({
      name: "",
      agent_type: "sales_intelligence",
      prompt_content: "",
      description: "",
      is_active: true,
      variables: [],
    });
    setIsCreating(true);
  };

  // Open test dialog
  const handleOpenTest = (prompt: AgentPrompt) => {
    setTestPrompt(prompt);
    setTestResults(null);
    setTestDialogOpen(true);
  };

  // Run test
  const handleRunTest = async () => {
    if (!testPrompt) return;
    if (selectedTranscripts.size === 0) {
      toast.error("Please select at least one test transcript");
      return;
    }

    setTestLoading(true);
    try {
      const response = await fetch("/api/prompts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt_id: testPrompt.id,
          model: testModel,
          test_transcript_ids: Array.from(selectedTranscripts),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResults(data);
        toast.success(`Test completed: ${data.summary.successful}/${data.summary.total_transcripts} successful`);
      } else {
        toast.error(data.error || "Test failed");
      }
    } catch (error) {
      toast.error("Error running test");
      console.error(error);
    } finally {
      setTestLoading(false);
    }
  };

  // Save prompt (create or update)
  const handleSave = async () => {
    try {
      if (!formData.name || !formData.prompt_content) {
        toast.error("Name and prompt content are required");
        return;
      }

      if (isEditing && selectedPrompt) {
        const response = await fetch(`/api/prompts/${selectedPrompt.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          toast.success("Prompt updated (previous version archived)");
          setIsEditing(false);
          fetchPrompts();
        } else {
          toast.error("Failed to update prompt");
        }
      } else {
        const response = await fetch("/api/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          toast.success("Prompt created successfully");
          setIsCreating(false);
          fetchPrompts();
        } else {
          toast.error("Failed to create prompt");
        }
      }
    } catch {
      toast.error("Error saving prompt");
    }
  };

  // Delete prompt
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prompt?")) return;

    try {
      const response = await fetch(`/api/prompts/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Prompt deleted successfully");
        fetchPrompts();
      } else {
        toast.error("Failed to delete prompt");
      }
    } catch {
      toast.error("Error deleting prompt");
    }
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

  // Toggle transcript selection
  const toggleTranscript = (id: string) => {
    setSelectedTranscripts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
                  View, edit, and test AI agent prompts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {AGENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={fetchPrompts}>
                <RefreshCwIcon className="size-4" />
              </Button>

              <Button onClick={handleCreate} className="gap-2">
                <PlusIcon className="size-4" />
                New Prompt
              </Button>
            </div>
          </div>
        </div>
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
              <FileTextIcon className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No prompts found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first agent prompt to get started
              </p>
              <Button onClick={handleCreate} className="gap-2">
                <PlusIcon className="size-4" />
                Create Prompt
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {prompts.map((prompt) => (
              <Card
                key={prompt.id}
                className={cn(
                  "transition-all duration-200",
                  !prompt.is_active && "opacity-60"
                )}
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
                          {!prompt.is_active && (
                            <Badge variant="outline" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {prompt.description ||
                            `${prompt.agent_type} prompt`}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {
                          AGENT_TYPES.find((t) => t.value === prompt.agent_type)
                            ?.label || prompt.agent_type
                        }
                      </Badge>

                      {/* Test Button */}
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleOpenTest(prompt)}
                      >
                        <FlaskConicalIcon className="size-3" />
                        Test
                      </Button>

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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(prompt)}
                      >
                        <EditIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(prompt.id)}
                      >
                        <TrashIcon className="size-4 text-destructive" />
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
                        Created:{" "}
                        {new Date(prompt.created_at).toLocaleDateString()}
                      </span>
                      <span>
                        Updated:{" "}
                        {new Date(prompt.updated_at).toLocaleDateString()}
                      </span>
                      <span>
                        {prompt.prompt_content.length} characters
                      </span>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isEditing || isCreating}
        onOpenChange={() => {
          setIsEditing(false);
          setIsCreating(false);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Prompt" : "Create New Prompt"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Modify the prompt. Previous version will be archived."
                : "Configure your new agent prompt"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Pain Points Extraction"
              />
            </div>

            {/* Agent Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Agent Type</Label>
              <Select
                value={formData.agent_type}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, agent_type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description of this prompt"
              />
            </div>

            {/* Prompt Content */}
            <div className="space-y-2">
              <Label htmlFor="content">Prompt Content</Label>
              <Textarea
                id="content"
                value={formData.prompt_content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Enter your prompt here. Use {{variable_name}} for dynamic content."
                className="min-h-[300px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use {`{{variable_name}}`} syntax for dynamic variables
              </p>
            </div>

            {/* Detected Variables */}
            {formData.variables.length > 0 && (
              <div className="space-y-2">
                <Label>Detected Variables</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.variables.map((v) => (
                    <Badge key={v} variant="secondary" className="font-mono">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Active Switch */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">
                  Only active prompts will be used by agents
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setIsCreating(false);
              }}
            >
              <XIcon className="size-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <SaveIcon className="size-4 mr-2" />
              {isEditing ? "Save Changes" : "Create Prompt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConicalIcon className="size-5" />
              Test Prompt: {testPrompt?.name}
            </DialogTitle>
            <DialogDescription>
              Run this prompt against test transcripts to evaluate output quality
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="config" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="results" disabled={!testResults}>
                Results {testResults && `(${testResults.summary.successful}/${testResults.summary.total_transcripts})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="flex-1 overflow-auto">
              <div className="space-y-6 py-4">
                {/* Model Selection */}
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={testModel} onValueChange={setTestModel}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          <div className="flex items-center justify-between w-full">
                            <span>{model.label}</span>
                            <span className="text-xs text-muted-foreground ml-4">
                              {model.cost}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Cost shown as input/output per 1M tokens
                  </p>
                </div>

                {/* Test Transcripts Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Test Transcripts ({selectedTranscripts.size} selected)</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (selectedTranscripts.size === testTranscripts.length) {
                          setSelectedTranscripts(new Set());
                        } else {
                          setSelectedTranscripts(new Set(testTranscripts.map((t) => t.id)));
                        }
                      }}
                    >
                      {selectedTranscripts.size === testTranscripts.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>

                  <div className="border rounded-lg divide-y">
                    {testTranscripts.map((transcript) => (
                      <div
                        key={transcript.id}
                        className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedTranscripts.has(transcript.id)}
                          onCheckedChange={() => toggleTranscript(transcript.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{transcript.label}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {transcript.transcripts?.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {transcript.call_type}
                          </Badge>
                          <Badge
                            variant={
                              transcript.difficulty === "easy"
                                ? "secondary"
                                : transcript.difficulty === "hard"
                                ? "destructive"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {transcript.difficulty}
                          </Badge>
                          {transcript.transcripts?.ai_overall_score && (
                            <Badge variant="secondary" className="text-xs">
                              Score: {transcript.transcripts.ai_overall_score}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="results" className="flex-1 overflow-auto">
              {testResults && (
                <div className="space-y-6 py-4">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <TargetIcon className="size-4 text-green-500" />
                          <span className="text-sm font-medium">Success Rate</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">
                          {Math.round((testResults.summary.successful / testResults.summary.total_transcripts) * 100)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {testResults.summary.successful}/{testResults.summary.total_transcripts} passed
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <DollarSignIcon className="size-4 text-yellow-500" />
                          <span className="text-sm font-medium">Total Cost</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">
                          ${parseFloat(testResults.summary.total_cost).toFixed(4)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {testResults.summary.total_input_tokens + testResults.summary.total_output_tokens} tokens
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <ClockIcon className="size-4 text-blue-500" />
                          <span className="text-sm font-medium">Duration</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">
                          {(testResults.summary.total_duration_ms / 1000).toFixed(1)}s
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(testResults.summary.total_duration_ms / testResults.summary.total_transcripts / 1000).toFixed(1)}s avg
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <CodeIcon className="size-4 text-purple-500" />
                          <span className="text-sm font-medium">Model</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">
                          {testResults.model}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          v{testResults.prompt.version}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Individual Results */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Individual Results</h3>
                    {testResults.results.map((result, idx) => (
                      <Card key={idx} className={cn(result.error && "border-destructive")}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                {result.error ? (
                                  <XIcon className="size-4 text-destructive" />
                                ) : (
                                  <CheckIcon className="size-4 text-green-500" />
                                )}
                                {result.label}
                              </CardTitle>
                              <CardDescription>{result.transcript_title}</CardDescription>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">{result.call_type}</Badge>
                              <span className="text-muted-foreground">
                                ${result.cost.toFixed(4)} | {result.duration_ms}ms
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {result.error ? (
                            <p className="text-destructive text-sm">{result.error}</p>
                          ) : result.output ? (
                            <ScrollArea className="h-[200px]">
                              <pre className="bg-muted rounded-lg p-4 text-xs font-mono whitespace-pre-wrap">
                                {JSON.stringify(result.output, null, 2)}
                              </pre>
                            </ScrollArea>
                          ) : null}

                          {/* Show score if present in output */}
                          {result.output && typeof result.output === "object" && "score" in result.output && (
                            <div className="mt-3 flex items-center gap-2">
                              <StarIcon className="size-4 text-yellow-500" />
                              <span className="font-medium">Score: {String(result.output.score)}/100</span>
                              {"summary" in result.output && (
                                <span className="text-muted-foreground text-sm">
                                  - {String(result.output.summary)}
                                </span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleRunTest} disabled={testLoading || selectedTranscripts.size === 0}>
              {testLoading ? (
                <>
                  <Loader2Icon className="size-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayIcon className="size-4 mr-2" />
                  Run Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
