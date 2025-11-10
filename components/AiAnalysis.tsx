"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";

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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

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
} from "lucide-react";

import { cn } from "@/lib/utils";

// ---------- COMPONENT ----------
export default function ReviewAIEditor() {
  const [open, setOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline, Highlight],
    content: "<p>Start editing your AI-generated company analysis here...</p>",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert focus:outline-none min-h-[220px] p-4 leading-relaxed",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-5">
      {/* ===== HEADER SECTION ===== */}
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
            This is the raw analysis from your website. Edit anything that’s
            incorrect or incomplete. We’ll use this to fill in your profile
            fields next.
          </AlertDescription>
        </Alert>
      </div>

      {/* ===== RE-RUN AND EDITING TIPS ===== */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          Not happy with the analysis?{" "}
          <button className="text-blue-600 hover:underline inline-flex items-center gap-1">
            <RefreshCcw className="h-3.5 w-3.5" /> Re-run AI Analysis
          </button>
        </span>
      </div>

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
            <li>Include real customer pain points you hear</li>
            <li>Add any industry-specific terminology</li>
            <li>
              Don’t worry about perfect formatting—we’ll structure it next
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>

      {/* ===== TIPTAP EDITOR ===== */}
      <div className="w-full border border-border rounded-2xl bg-background/60 backdrop-blur-sm shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-2 rounded-t-2xl bg-muted/40">
          <TooltipProvider delayDuration={100}>
            <ToolbarButton
              tooltip="Bold"
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              tooltip="Italic"
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              tooltip="Underline"
              active={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              tooltip="Highlight"
              active={editor.isActive("highlight")}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHighlight({ color: "#fde047" })
                  .run()
              }
            >
              <Highlighter className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-1 h-5 w-px bg-border" />

            <ToolbarButton
              tooltip="Heading 1"
              active={editor.isActive("heading", { level: 1 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
            >
              <Heading1 className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              tooltip="Bullet List"
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              tooltip="Numbered List"
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              tooltip="Quote"
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              tooltip="Code Block"
              active={editor.isActive("codeBlock")}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            >
              <Code2 className="h-4 w-4" />
            </ToolbarButton>
          </TooltipProvider>
        </div>

        {/* Editor area */}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ---------- ToolbarButton ----------
function ToolbarButton({
  children,
  tooltip,
  active,
  onClick,
}: {
  children: React.ReactNode;
  tooltip: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
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
  );
}
