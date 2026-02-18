"use client";

import { useEffect, useState, useCallback } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

import {
  HeadingNode,
  QuoteNode,
  $createHeadingNode,
  $createQuoteNode,
} from "@lexical/rich-text";

import {
  ListNode,
  ListItemNode,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from "@lexical/list";

import { CodeNode, CodeHighlightNode, $createCodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";

import { TRANSFORMERS } from "@lexical/markdown";

import { $getSelection, $isRangeSelection } from "lexical";

import { $setBlocksType } from "@lexical/selection";
import { $convertFromMarkdownString } from "@lexical/markdown";
import { $getRoot } from "lexical";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import {
  Bold,
  Italic,
  UnderlineIcon,
  Highlighter,
  Heading1,
  List,
  ListOrdered,
  Quote,
  Code2,
  ChevronDown,
  Info,
  RefreshCcw,
  Lightbulb,
  Loader2,
  Building2,
  Target,
  Users,
  Package,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { fetchWebhookData, updateWebhookData, WebhookDataPayload } from "@/services/onboarding";
import { toast } from "sonner";

//
// ==========================
// LEXICAL THEME (unchanged)
// ==========================
const theme = {
  paragraph: "mb-2",
  heading: {
    h1: "text-3xl font-bold mb-3 mt-6",
    h2: "text-2xl font-semibold mb-2 mt-5",
    h3: "text-xl font-semibold mb-2 mt-4",
    h4: "text-lg font-semibold mb-2 mt-3",
    h5: "text-base font-semibold mb-2 mt-2",
  },
  list: {
    ul: "list-disc ml-6 mb-2",
    ol: "list-decimal ml-6 mb-2",
    listitem: "mb-1",
  },
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
  },
  quote: "border-l-4 border-gray-300 pl-4 italic my-2",
  code: "bg-gray-100 dark:bg-gray-800 p-4 rounded font-mono text-sm my-2 block",
};

//
// ==========================
// ⭐ FIXED MARKDOWN LOADER
// ==========================
// @ts-ignore

function LoadMarkdownPlugin({ markdown }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!markdown || markdown.trim() === "") return;

    editor.update(() => {
      // ❗THIS IS THE ONLY CORRECT WAY TO RESET
      const root = $getRoot();
      root.clear();

      // Load new markdown
      $convertFromMarkdownString(markdown, TRANSFORMERS);
    });
  }, [markdown, editor]);

  return null;
}

//
// ==========================
// TOOLBAR (unchanged)
// ==========================
function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(updateToolbar);
    });
  }, [editor, updateToolbar]);

  const formatHeading = (level: any) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(level));
      }
    });
  };

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  };

  const formatCode = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createCodeNode());
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border p-2 rounded-t-2xl bg-muted/40">
      <ToolbarButton
        tooltip="Bold"
        active={isBold}
        // @ts-ignore

        onClick={() => editor.dispatchCommand("format_text", "bold")}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        tooltip="Italic"
        active={isItalic}
        // @ts-ignore

        onClick={() => editor.dispatchCommand("format_text", "italic")}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        tooltip="Underline"
        active={isUnderline}
        // @ts-ignore
        onClick={() => editor.dispatchCommand("format_text", "underline")}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      {/* @ts-ignore */}

      <ToolbarButton
        tooltip="Highlight"
        // @ts-ignore

        onClick={() => editor.dispatchCommand("format_text", "highlight")}
      >
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" />
      {/* @ts-ignore */}

      <ToolbarButton tooltip="Heading 1" onClick={() => formatHeading("h1")}>
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      {/* @ts-ignore */}

      <ToolbarButton
        tooltip="Bullet List"
        // @ts-ignore

        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND)}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      {/* @ts-ignore */}

      <ToolbarButton
        tooltip="Numbered List"
        // @ts-ignore

        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND)}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      {/* @ts-ignore */}

      <ToolbarButton tooltip="Quote" onClick={formatQuote}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      {/* @ts-ignore */}

      <ToolbarButton tooltip="Code Block" onClick={formatCode}>
        <Code2 className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

//
// ==========================
// MAIN PAGE — FIXED
// ==========================
export default function ReviewAIEditor() {
  const [open, setOpen] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [jsonData, setJsonData] = useState<WebhookDataPayload | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  //
  // ⭐ Load from Supabase (PRIMARY) or LocalStorage (FALLBACK)
  //
  useEffect(() => {
    const loadData = async () => {
      try {
        // First try Supabase
        const result = await fetchWebhookData();

        if (result.success) {
          if (result.markdown) {
            console.log("📦 Loaded markdown from Supabase");
            setMarkdown(result.markdown);
            localStorage.setItem("webhook_markdown", result.markdown);
          }
          if (result.data) {
            console.log("📦 Loaded json_val from Supabase:", result.data);
            setJsonData(result.data);
            localStorage.setItem("company_json_data", JSON.stringify(result.data));
          }
          setLoading(false);
          return;
        }

        // Fallback to localStorage
        console.log("📦 Falling back to localStorage");
        const savedMarkdown = localStorage.getItem("webhook_markdown");
        if (savedMarkdown) {
          setMarkdown(savedMarkdown);
        }

        const savedJson = localStorage.getItem("company_json_data");
        if (savedJson) {
          try {
            let parsed = savedJson;
            let attempts = 0;
            while (typeof parsed === "string" && attempts < 5) {
              parsed = JSON.parse(parsed);
              attempts++;
            }
            if (parsed && typeof parsed === "object") {
              setJsonData(parsed as WebhookDataPayload);
            }
          } catch (e) {
            console.error("Error parsing JSON from localStorage:", e);
          }
        }
      } catch (err) {
        console.error("Load error:", err);
        // Fallback to localStorage
        const savedMarkdown = localStorage.getItem("webhook_markdown");
        if (savedMarkdown) {
          setMarkdown(savedMarkdown);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  //
  // ⭐ Realtime Supabase listener
  //
  useEffect(() => {
    const channel = supabase
      .channel("realtime:webhook_data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "webhook_data" },
        (payload) => {
          console.log("🔎 Full realtime payload:", payload.new);

          // ===== MARKDOWN =====
          const md =
            // @ts-ignore
            payload.new.markdown ||
            // @ts-ignore
            payload.new?.payload?.markdown ||
            // @ts-ignore
            payload.new?.payload?.data ||
            "";

          if (md) {
            localStorage.setItem("webhook_markdown", md);
            setMarkdown(md);
            console.log("📦 Saved webhook_markdown to localStorage");
          }

          // ===== JSON (AUTO-PARSED FROM JSONB — FIXED) =====
          // @ts-ignore
          let jsonDataPayload = payload.new.json_val;

          // fallback if nested under payload
          // @ts-ignore
          if (!jsonDataPayload && payload.new?.payload?.json_val) {
            // @ts-ignore
            jsonDataPayload = payload.new.payload.json_val;
          }

          console.log("🟢 JSON received:", jsonDataPayload);

          if (jsonDataPayload) {
            // If jsonData is already a string, store it directly; otherwise stringify it
            const jsonString = typeof jsonDataPayload === "string"
              ? jsonDataPayload
              : JSON.stringify(jsonDataPayload);
            localStorage.setItem("company_json_data", jsonString);

            // Update state
            const parsed = typeof jsonDataPayload === "string"
              ? JSON.parse(jsonDataPayload)
              : jsonDataPayload;
            setJsonData(parsed);
            console.log("📦 Saved company_json_data to localStorage");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  //
  // Lexical config (unchanged)
  //
  const initialConfig = {
    namespace: "ReviewAIEditor",
    theme,
    onError: console.error,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
    ],
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading analysis data...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-5">
      {/* HEADER */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Review AI Analysis
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          We analyzed your company. Review and edit the information below before
          we organize it.
        </p>

        <Alert className="bg-blue-50 dark:bg-blue-950/40 border-blue-300/60 dark:border-blue-900/60">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
            This is the raw markdown from AI or your webhook. You can freely
            edit it here.
          </AlertDescription>
        </Alert>
      </div>

      {/* STRUCTURED DATA PREVIEW */}
      {jsonData && (
        <Collapsible open={showPreview} onOpenChange={setShowPreview}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full justify-start"
            >
              <Building2 className="h-4 w-4 text-indigo-500" />
              Extracted Data Preview
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform ml-auto",
                  showPreview && "rotate-180"
                )}
              />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-3 p-4 border border-border/60 rounded-xl bg-muted/30 space-y-4">
              {/* Company Info */}
              {jsonData.company_info && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4 text-sky-500" />
                    Company Information
                  </div>
                  <div className="pl-6 space-y-1 text-sm text-muted-foreground">
                    {jsonData.company_info.company_name && (
                      <p><span className="font-medium text-foreground">Name:</span> {jsonData.company_info.company_name}</p>
                    )}
                    {jsonData.company_info.website && (
                      <p><span className="font-medium text-foreground">Website:</span> {jsonData.company_info.website}</p>
                    )}
                    {jsonData.company_info.value_proposition && (
                      <p><span className="font-medium text-foreground">Value Prop:</span> {jsonData.company_info.value_proposition}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Products & Services */}
              {jsonData.products_and_services && jsonData.products_and_services.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4 text-emerald-500" />
                    Products & Services
                  </div>
                  <div className="pl-6 flex flex-wrap gap-2">
                    {jsonData.products_and_services.map((product, i) => {
                      const name = typeof product === "string" ? product : product.name;
                      return (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ICP */}
              {jsonData.ideal_customer_profile && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Target className="h-4 w-4 text-violet-500" />
                    Ideal Customer Profile
                  </div>
                  <div className="pl-6 space-y-1 text-sm text-muted-foreground">
                    {jsonData.ideal_customer_profile.industry && (
                      <p><span className="font-medium text-foreground">Industry:</span> {jsonData.ideal_customer_profile.industry}</p>
                    )}
                    {jsonData.ideal_customer_profile.company_size && (
                      <p><span className="font-medium text-foreground">Company Size:</span> {jsonData.ideal_customer_profile.company_size}</p>
                    )}
                    {jsonData.ideal_customer_profile.region && (
                      <p><span className="font-medium text-foreground">Region:</span> {jsonData.ideal_customer_profile.region}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Buyer Personas */}
              {jsonData.buyer_personas && jsonData.buyer_personas.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4 text-rose-500" />
                    Buyer Personas ({jsonData.buyer_personas.length})
                  </div>
                  <div className="pl-6 flex flex-wrap gap-2">
                    {jsonData.buyer_personas.map((persona, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {persona.name || persona.job_title}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* RERUN BUTTON */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          Not happy with the analysis?{" "}
          <button className="text-blue-600 hover:underline inline-flex items-center gap-1">
            <RefreshCcw className="h-3.5 w-3.5" /> Re-run AI Analysis
          </button>
        </span>
      </div>

      {/* TIPS */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Editing Tips
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                open && "rotate-180"
              )}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ul className="text-sm text-muted-foreground list-disc ml-6 space-y-1 mt-2">
            <li>Be specific about your products and features</li>
            <li>Include real customer pain points</li>
            <li>Add industry-specific language</li>
            <li>We will clean and structure it afterwards</li>
          </ul>
        </CollapsibleContent>
      </Collapsible>

      {/* EDITOR */}
      <div className="w-full border border-border rounded-2xl bg-background/60 backdrop-blur-sm shadow-sm">
        <LexicalComposer initialConfig={initialConfig}>
          <ToolbarPlugin />

          <div className="relative">
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="min-h-[220px] p-4 focus:outline-none prose prose-sm dark:prose-invert max-w-none" />
              }
              placeholder={
                <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none">
                  Enter some text...
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>

          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />

          {/* ⭐ FIXED MARKDOWN LOADER */}
          <LoadMarkdownPlugin markdown={markdown} />
        </LexicalComposer>
      </div>
    </div>
  );
}

//
// ==========================
// Toolbar Button (unchanged)
// ==========================
// @ts-ignore

function ToolbarButton({ children, tooltip, active, onClick }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon"
            onClick={onClick}
            className={cn(
              "h-8 w-8 rounded-md transition-all duration-100",
              active
                ? "bg-primary/10 text-primary border border-border"
                : "hover:bg-muted"
            )}
          >
            {children}
          </Button>
        </TooltipTrigger>

        <TooltipContent side="bottom" className="text-xs px-2 py-1">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
