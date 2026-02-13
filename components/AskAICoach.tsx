"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Sparkles, X, GripHorizontal } from "lucide-react";
import type { AgentContext } from "@/types/agent-context";

// Dynamically import InlineAgentPanel to avoid SSR issues
const InlineAgentPanel = dynamic(
  () => import("@/components/InlineAgentPanel"),
  { ssr: false }
);

interface AskAICoachProps {
  // Required context for the AI agent
  context: AgentContext;

  // Optional panel title (shown in the sheet header)
  panelTitle?: string;

  // Optional placeholder text for the input
  placeholder?: string;

  // Optional quick action suggestions
  quickActions?: string[];

  // For transcript-specific features (call detail page)
  transcriptId?: number;
  transcriptTitle?: string;
  transcriptText?: string;
  aiSummary?: string;

  // Custom button text (defaults to "Ask AI Coach")
  buttonText?: string;

  // Custom button class for positioning (defaults to fixed bottom-right)
  buttonClassName?: string;
}

/**
 * AskAICoach - Global AI Coach component
 *
 * A reusable component that provides a floating "Ask AI Coach" button
 * and opens a draggable chat window with the AI agent interface.
 */
export function AskAICoach({
  context,
  panelTitle,
  placeholder,
  quickActions,
  transcriptId,
  transcriptTitle,
  transcriptText,
  aiSummary,
  buttonText = "Ask AI Coach",
  buttonClassName,
}: AskAICoachProps) {
  const [open, setOpen] = useState(false);

  // Draggable window position state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // Initialize position to bottom-right when opened
  useEffect(() => {
    if (open && !initialized) {
      const windowWidth = 420;
      const windowHeight = 550;
      setPosition({
        x: Math.max(16, window.innerWidth - windowWidth - 24),
        y: Math.max(16, window.innerHeight - windowHeight - 24),
      });
      setInitialized(true);
    }
  }, [open, initialized]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!windowRef.current) return;
    isDragging.current = true;
    const rect = windowRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !windowRef.current) return;
      const rect = windowRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      setPosition({
        x: Math.min(Math.max(0, e.clientX - dragOffset.current.x), maxX),
        y: Math.min(Math.max(0, e.clientY - dragOffset.current.y), maxY),
      });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    if (open) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [open]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
  }, []);

  // Default button positioning
  const defaultButtonClass = "fixed bottom-6 right-6 z-40 h-12 gap-2 rounded-full px-5 shadow-lg shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200";

  return (
    <>
      {/* Floating Ask AI Coach button - hidden when window is open */}
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className={buttonClassName || defaultButtonClass}
        >
          <Sparkles className="h-5 w-5" />
          {buttonText}
        </Button>
      )}

      {/* Draggable AI Coach Window - always mounted once initialized, hidden via CSS to preserve chat state */}
      <div
        ref={windowRef}
        className="fixed z-50 w-[420px] h-[550px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          display: open ? 'flex' : 'none',
        }}
      >
        {/* Draggable header */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 cursor-grab active:cursor-grabbing select-none shrink-0"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/80">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">AI Coach</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => handleOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Chat panel content - always mounted to preserve chat history */}
        <div style={{ display: initialized ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <InlineAgentPanel
            context={context}
            panelTitle={panelTitle}
            placeholder={placeholder}
            quickActions={quickActions}
            transcriptId={transcriptId}
            transcriptTitle={transcriptTitle}
            transcriptText={transcriptText}
            aiSummary={aiSummary}
          />
        </div>
      </div>
    </>
  );
}

export default AskAICoach;
