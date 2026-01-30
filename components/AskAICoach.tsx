"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
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
 * and opens a side panel with the AI agent interface.
 *
 * Usage:
 * ```tsx
 * <AskAICoach
 *   context={{ type: "dashboard", totalCalls: 100, avgScore: 75 }}
 *   panelTitle="Dashboard Coach"
 *   placeholder="Ask about your performance..."
 *   quickActions={["Show my stats", "What should I focus on?"]}
 * />
 * ```
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

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
  }, []);

  // Default button positioning
  const defaultButtonClass = "fixed bottom-6 right-6 z-40 h-12 gap-2 rounded-full px-5 shadow-lg shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200";

  return (
    <>
      {/* Floating Ask AI Coach button */}
      <Button
        onClick={() => setOpen(true)}
        className={buttonClassName || defaultButtonClass}
      >
        <Sparkles className="h-5 w-5" />
        {buttonText}
      </Button>

      {/* AI Agent Panel (Sheet mode) */}
      <InlineAgentPanel
        open={open}
        onOpenChange={handleOpenChange}
        panelTitle={panelTitle}
        context={context}
        placeholder={placeholder}
        quickActions={quickActions}
        // Transcript-specific props (for call detail page)
        transcriptId={transcriptId}
        transcriptTitle={transcriptTitle}
        transcriptText={transcriptText}
        aiSummary={aiSummary}
      />
    </>
  );
}

export default AskAICoach;
