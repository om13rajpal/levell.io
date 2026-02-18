"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  SparklesIcon,
  Loader2Icon,
  SendIcon,
  StopCircleIcon,
  ZapIcon,
  BrainIcon,
  ChevronDownIcon,
  Trash2Icon,
  RefreshCw,
} from "lucide-react";
import React, { type FormEvent, useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/lib/supabaseClient";
import type { AgentContext } from "@/types/agent-context";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Lazy load ReactMarkdown
const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
  loading: () => <div className="animate-pulse h-4 bg-muted rounded" />,
});

// Models available for inline coaching
const inlineModels = [
  { name: "GPT-4o", value: "gpt-4o", description: "Most capable" },
  { name: "GPT-4o Mini", value: "gpt-4o-mini", description: "Fast & efficient" },
];

// Quick-action suggestion chips for different context types
const quickActionsConfig = {
  call: [
    {
      label: "What did the rep miss?",
      prompt: "Based on this call transcript, what did the sales rep miss? Identify specific moments where the rep could have asked better questions, dug deeper into pain points, or uncovered more information.",
    },
    {
      label: "Handle objections better?",
      prompt: "How could the rep have handled the objections in this call better? Provide specific alternative responses and techniques for each objection that came up.",
    },
    {
      label: "Next call focus?",
      prompt: "Based on this call, what should the rep focus on in the next call? Provide a prioritized game plan with specific questions to ask and topics to address.",
    },
    {
      label: "Score breakdown",
      prompt: "Give me a detailed breakdown of how this call performed across key sales categories: discovery, objection handling, value communication, and next steps. What specific moments drove the score up or down?",
    },
    {
      label: "Coaching tips",
      prompt: "If you were coaching this sales rep after this call, what are the top 3 things you would tell them to work on? Be specific with examples from the transcript.",
    },
  ],
  companies: [
    {
      label: "Companies needing attention",
      prompt: "Based on the companies data, which companies need immediate attention? Look at risk levels, call frequency, scores, and pain points to prioritize.",
    },
    {
      label: "Summarize pain points",
      prompt: "Summarize all the pain points across companies. Group them by theme and identify which are most common or critical.",
    },
    {
      label: "At-risk accounts",
      prompt: "Which accounts are at risk and why? Provide specific recommendations to improve relationships with each at-risk company.",
    },
    {
      label: "Top performers",
      prompt: "Which companies have the strongest relationships? What patterns can we learn from interactions with these top-performing accounts?",
    },
  ],
  company_detail: [
    {
      label: "Summarize company",
      prompt: "Provide a comprehensive summary of this company's relationship with us, including key metrics, risks, pain points, and overall health.",
    },
    {
      label: "Key risks",
      prompt: "What are the main risks with this account? Analyze the risk summary and deal alerts to provide actionable mitigation strategies.",
    },
    {
      label: "Next steps",
      prompt: "Based on recent calls and AI recommendations, what should be the next steps with this company? Prioritize by impact.",
    },
    {
      label: "Improve relationship",
      prompt: "How can we improve the relationship with this company? Consider their pain points, objections, and recent interactions.",
    },
  ],
  team: [
    {
      label: "Team performance",
      prompt: "Provide a comprehensive summary of the team's overall performance. Include member stats, average scores, and identify who needs coaching.",
    },
    {
      label: "Who needs coaching?",
      prompt: "Based on the team data, which team members need the most coaching attention? Consider their scores, call volume, and improvement trends.",
    },
    {
      label: "Top performers",
      prompt: "Who are the top performers on this team? What can other team members learn from their approach?",
    },
    {
      label: "Team improvement plan",
      prompt: "Create a team improvement plan based on common weaknesses and focus areas across all members.",
    },
  ],
  calls_list: [
    {
      label: "Calls overview",
      prompt: "Provide an overview of the recent calls. What are the common themes, average scores, and notable patterns?",
    },
    {
      label: "Worst performing calls",
      prompt: "Which calls performed poorly and why? What common mistakes were made that need to be addressed?",
    },
    {
      label: "Best practices",
      prompt: "Based on the high-scoring calls, what best practices can be identified for the team?",
    },
    {
      label: "Improvement areas",
      prompt: "What are the main improvement areas across all calls? Group by category and prioritize by impact.",
    },
  ],
  dashboard: [
    {
      label: "Performance summary",
      prompt: "Give me a comprehensive performance summary based on my recent calls, scores, and trends.",
    },
    {
      label: "What should I focus on?",
      prompt: "Based on my recent performance data, what should I focus on improving? Provide specific and actionable recommendations.",
    },
    {
      label: "Weekly highlights",
      prompt: "What are the highlights from my recent activity? Include wins, improvements, and areas of concern.",
    },
    {
      label: "Coaching insights",
      prompt: "If you were my coach, what would you tell me to work on based on my recent performance? Be specific.",
    },
  ],
  transcript: [
    {
      label: "What did the rep miss?",
      prompt: "Based on this call transcript, what did the sales rep miss? Identify specific moments where the rep could have asked better questions.",
    },
    {
      label: "Handle objections better?",
      prompt: "How could the rep have handled the objections in this call better? Provide specific alternative responses.",
    },
    {
      label: "Next call focus?",
      prompt: "Based on this call, what should the rep focus on in the next call? Provide a prioritized game plan.",
    },
    {
      label: "Score breakdown",
      prompt: "Give me a detailed breakdown of how this call performed across key sales categories.",
    },
  ],
  companies_list: [
    {
      label: "Companies needing attention",
      prompt: "Based on the companies data, which companies need immediate attention? Look at risk levels and scores.",
    },
    {
      label: "Summarize pain points",
      prompt: "Summarize all the pain points across companies. Group them by theme and identify which are most common.",
    },
    {
      label: "At-risk accounts",
      prompt: "Which accounts are at risk and why? Provide recommendations to improve relationships.",
    },
    {
      label: "Top performers",
      prompt: "Which companies have the strongest relationships? What patterns can we learn from them?",
    },
  ],
};

// Props interface - supports both Sheet mode (for calls) and embedded mode (for companies)
interface InlineAgentPanelProps {
  // Sheet mode props (used for call transcripts)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  transcriptId?: number;
  transcriptTitle?: string;
  transcriptText?: string;
  aiSummary?: string;
  // Generic context props (used for companies pages)
  context?: AgentContext;
  placeholder?: string;
  quickActions?: string[];
  // Optional panel title override
  panelTitle?: string;
}

// Thinking Card (reused pattern from agent page)
function ThinkingCard({
  thinking,
  isStreaming,
}: {
  thinking: string;
  isStreaming?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (!thinking) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 backdrop-blur-sm px-4 py-3 text-sm font-medium transition-all hover:bg-accent/20">
        <BrainIcon className="size-4 text-accent-foreground" />
        <span className="text-accent-foreground">Thinking</span>
        {isStreaming && (
          <Loader2Icon className="ml-2 size-3 animate-spin text-accent-foreground/70" />
        )}
        <ChevronDownIcon
          className={cn(
            "ml-auto size-4 text-accent-foreground/70 transition-transform duration-200",
            !isOpen && "-rotate-90"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
            {thinking}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Markdown renderer (reused pattern from agent page)
function MarkdownContent({ text }: { text: string }) {
  const components: Components = useMemo(
    () => ({
      a: ({ href, children, ...props }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
          {...props}
        >
          {children}
        </a>
      ),
      p: ({ children }) => (
        <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
      ),
      h1: ({ children }) => (
        <h1 className="text-xl font-bold mb-3 mt-4">{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="text-base font-bold mb-2 mt-3">{children}</h3>
      ),
      ul: ({ children }) => (
        <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
      ),
      li: ({ children }) => <li className="mb-0.5">{children}</li>,
      blockquote: ({ children }) => (
        <blockquote className="border-l-4 border-primary/30 pl-3 italic my-3 text-muted-foreground">
          {children}
        </blockquote>
      ),
      code: ({ className, children, ...props }) => {
        const isInline = !className;
        if (isInline) {
          return (
            <code
              className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
              {...props}
            >
              {children}
            </code>
          );
        }
        return (
          <code
            className={cn(
              "block bg-muted p-3 rounded-lg overflow-x-auto text-sm font-mono",
              className
            )}
            {...props}
          >
            {children}
          </code>
        );
      },
      pre: ({ children }) => (
        <pre className="bg-muted p-3 rounded-xl overflow-x-auto mb-3">
          {children}
        </pre>
      ),
      strong: ({ children }) => (
        <strong className="font-semibold">{children}</strong>
      ),
      em: ({ children }) => <em className="italic">{children}</em>,
    }),
    []
  );

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function InlineAgentPanel({
  open,
  onOpenChange,
  transcriptId,
  transcriptTitle,
  transcriptText,
  aiSummary,
  context,
  placeholder,
  quickActions: customQuickActions,
  panelTitle: customPanelTitle,
}: InlineAgentPanelProps) {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(inlineModels[0].value);
  const [userId, setUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = React.useRef<string | null>(null);
  const conversationPromiseRef = React.useRef<Promise<string | null> | null>(null);
  const messageSequenceRef = React.useRef(0);
  const lastSavedMessageCount = React.useRef(0);

  // Fetch user ID on mount
  useEffect(() => {
    async function fetchUserId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    }
    fetchUserId();
  }, []);

  // Create a new conversation on first user message (race-safe via ref guard)
  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    if (!userId) return null;

    // If a creation is already in flight, await it instead of creating a duplicate
    if (conversationPromiseRef.current) return conversationPromiseRef.current;

    const promise = (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          user_id: userId,
          message_count: 0,
          metadata: { model, pageType: context?.type || "unknown" },
        })
        .select("id")
        .single();

      if (error) {
        console.error("Failed to create conversation:", error);
        conversationPromiseRef.current = null;
        return null;
      }

      conversationIdRef.current = data.id;
      setConversationId(data.id);
      messageSequenceRef.current = 0;
      lastSavedMessageCount.current = 0;
      return data.id;
    })();

    conversationPromiseRef.current = promise;
    return promise;
  }, [userId, model, context?.type]);

  // Save a message to the database
  const saveMessage = useCallback(async (
    convId: string,
    role: string,
    content: string,
    meta?: Record<string, unknown>
  ) => {
    messageSequenceRef.current += 1;
    const seqNum = messageSequenceRef.current;

    await supabase.from("messages").insert({
      conversation_id: convId,
      role,
      content,
      sequence_number: seqNum,
      metadata: meta || null,
    });

    // Update message_count on conversation
    await supabase
      .from("conversations")
      .update({ message_count: seqNum })
      .eq("id", convId);
  }, []);

  // Determine context type and normalize context
  const normalizedContext = useMemo(() => {
    if (context) return context;
    // Legacy props - construct call context
    if (transcriptId !== undefined) {
      return {
        type: "call" as const,
        transcriptId,
        transcriptTitle: transcriptTitle || "",
        transcriptText,
        aiSummary,
      };
    }
    return null;
  }, [context, transcriptId, transcriptTitle, transcriptText, aiSummary]);

  const contextType = normalizedContext?.type || "call";
  const isEmbeddedMode = context !== undefined && open === undefined;

  // Get title for the panel
  const panelTitle = useMemo(() => {
    if (customPanelTitle) return customPanelTitle;
    if (!normalizedContext) return "AI Coach";
    switch (normalizedContext.type) {
      case "call":
        return normalizedContext.transcriptTitle || "AI Coach";
      case "companies":
        return "Companies AI Coach";
      case "company_detail":
        return `${normalizedContext.companyName} AI Coach`;
      case "team":
        return "Team Coach";
      case "dashboard":
        return "Dashboard Coach";
      case "calls_list":
        return "Calls Coach";
      default:
        return "AI Coach";
    }
  }, [customPanelTitle, normalizedContext]);

  // Get quick actions based on context type
  const quickActions = useMemo(() => {
    if (customQuickActions) {
      // Convert string array to action objects
      return customQuickActions.map((label) => ({
        label,
        prompt: label,
      }));
    }
    return quickActionsConfig[contextType] || quickActionsConfig.call;
  }, [contextType, customQuickActions]);

  // Map context type to page type for enhanced API
  const pageType = useMemo(() => {
    switch (contextType) {
      case "call": return "call_detail";
      case "transcript": return "call_detail";
      case "companies": return "companies";
      case "companies_list": return "companies";
      case "company_detail": return "company_detail";
      case "team": return "team";
      case "calls_list": return "calls";
      case "dashboard": return "dashboard";
      default: return "dashboard";
    }
  }, [contextType]);

  // Build page context for the API
  const pageContext = useMemo(() => {
    if (!normalizedContext) return undefined;
    switch (normalizedContext.type) {
      case "call":
        return { transcriptId: normalizedContext.transcriptId };
      case "transcript":
        return normalizedContext.transcriptId ? { transcriptId: normalizedContext.transcriptId } : undefined;
      case "company_detail":
        return { companyId: normalizedContext.companyId };
      case "team":
        return { teamId: normalizedContext.teamId };
      default:
        return undefined;
    }
  }, [normalizedContext]);

  // Build the body payload that goes with every request.
  // Uses the new enhanced API with pageType for full database access
  const requestBody = useMemo(
    () => ({
      model,
      userId, // Required for database access
      pageType, // NEW: Page type for enhanced context
      pageContext, // NEW: Page-specific IDs
      // Legacy fields for backwards compatibility
      contextType,
      contextId: normalizedContext?.type === "call"
        ? normalizedContext.transcriptId.toString()
        : normalizedContext?.type === "company_detail"
        ? normalizedContext.companyId.toString()
        : "all",
    }),
    [model, userId, pageType, pageContext, contextType, normalizedContext]
  );

  // Generate unique chat ID based on context
  const chatId = useMemo(() => {
    if (normalizedContext?.type === "call") {
      return `inline-coach-call-${normalizedContext.transcriptId}`;
    } else if (normalizedContext?.type === "company_detail") {
      return `inline-coach-company-${normalizedContext.companyId}`;
    }
    return "inline-coach-companies";
  }, [normalizedContext]);

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: "/api/agent",
      credentials: "include",
    }),
  });

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!input.trim()) return;

      const msgText = input.trim();
      setInput("");

      // Ensure conversation exists and save user message
      const convId = await ensureConversation();
      if (convId) {
        saveMessage(convId, "user", msgText);
      }

      sendMessage(
        { text: msgText },
        { body: requestBody }
      );
    },
    [input, requestBody, sendMessage, ensureConversation, saveMessage]
  );

  const handleQuickAction = useCallback(
    async (prompt: string) => {
      const convId = await ensureConversation();
      if (convId) {
        saveMessage(convId, "user", prompt);
      }

      sendMessage(
        { text: prompt },
        { body: requestBody }
      );
    },
    [requestBody, sendMessage, ensureConversation, saveMessage]
  );

  // Save assistant messages when streaming completes
  useEffect(() => {
    if (status !== "ready" && status !== "error") return;
    if (!conversationId) return;
    if (messages.length <= lastSavedMessageCount.current) return;

    // Find new assistant messages that haven't been saved
    const newMessages = messages.slice(lastSavedMessageCount.current);
    lastSavedMessageCount.current = messages.length;

    for (const msg of newMessages) {
      if (msg.role === "assistant") {
        const textContent = msg.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("\n");

        if (textContent) {
          saveMessage(conversationId, "assistant", textContent, { model });
        }
      }
    }
  }, [status, messages, conversationId, saveMessage, model]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    conversationIdRef.current = null;
    conversationPromiseRef.current = null;
    messageSequenceRef.current = 0;
    lastSavedMessageCount.current = 0;
  }, [setMessages]);

  // Retry the last user message
  const handleRetry = useCallback(() => {
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      // Get the text content from the message
      const textPart = lastUserMessage.parts.find((p: any) => p.type === 'text');
      const text = (textPart as any)?.text || '';
      if (text) {
        // Clear error state by resending
        sendMessage(
          { text },
          { body: requestBody }
        );
      }
    }
  }, [messages, requestBody, sendMessage]);

  // Extract reasoning from message parts
  const getMessageReasoning = (message: (typeof messages)[0]) => {
    let reasoning = "";
    for (const part of message.parts) {
      if (part.type === "reasoning") {
        const reasoningPart = part as { text: string };
        reasoning += reasoningPart.text;
      }
    }
    return reasoning;
  };

  const hasMessages = messages.length > 0;
  const inputPlaceholder = placeholder || (contextType === "call" ? "Ask about this call..." : "Ask about your companies...");

  // Embedded panel content (for companies pages)
  const PanelContent = (
    <>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 shadow-sm">
            <SparklesIcon className="size-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold">AI Assistant</h3>
            <p className="text-xs text-muted-foreground truncate">
              {panelTitle}
            </p>
          </div>
          {hasMessages && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              title="Clear conversation"
            >
              <Trash2Icon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {!hasMessages ? (
          /* Empty state with quick actions */
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-br from-violet-600/20 to-purple-600/20 blur-xl" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg shadow-violet-600/25">
                <SparklesIcon className="size-6 text-white" />
              </div>
            </div>

            <h3 className="text-base font-semibold mb-1">Ask AI Assistant</h3>
            <p className="text-xs text-muted-foreground text-center mb-4 max-w-xs">
              {contextType === "companies"
                ? "Get insights about your companies and accounts"
                : contextType === "company_detail"
                ? "Learn more about this company"
                : "Get personalized coaching insights"}
            </p>

            {/* Quick action chips */}
            <div className="w-full space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground text-center uppercase tracking-wider">
                Quick actions
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {quickActions.slice(0, 4).map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.prompt)}
                    className={cn(
                      "rounded-full border bg-card/50 px-2.5 py-1 text-[11px] font-medium transition-all duration-200",
                      "hover:border-violet-500/40 hover:bg-violet-500/5 hover:text-violet-600",
                      "focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    )}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Conversation messages */
          <Conversation className="flex-1 px-3 max-h-[350px]">
            <ConversationContent className="mx-auto max-w-full py-3">
              {messages.map((message) => {
                const reasoning = getMessageReasoning(message);
                const isLastMessage =
                  message.id === messages[messages.length - 1]?.id;
                const isAssistant = message.role === "assistant";
                const isCurrentlyStreaming =
                  isLastMessage && status === "streaming";

                return (
                  <div
                    key={message.id}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-300 mb-3"
                  >
                    <Message from={message.role}>
                      <MessageContent
                        className={cn(
                          "text-sm",
                          isAssistant && "bg-transparent"
                        )}
                      >
                        {isAssistant && reasoning && (
                          <ThinkingCard
                            thinking={reasoning}
                            isStreaming={isCurrentlyStreaming}
                          />
                        )}

                        {message.parts.map((part, i) => {
                          switch (part.type) {
                            case "text":
                              return isAssistant ? (
                                <MarkdownContent
                                  key={`${message.id}-${i}`}
                                  text={part.text}
                                />
                              ) : (
                                <div
                                  key={`${message.id}-${i}`}
                                  className="prose prose-sm max-w-none dark:prose-invert"
                                >
                                  {part.text}
                                </div>
                              );
                            case "reasoning":
                              return null;
                            default:
                              return null;
                          }
                        })}
                      </MessageContent>
                    </Message>
                  </div>
                );
              })}

              {/* Loading state */}
              {status === "submitted" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 mb-3">
                  <Message from="assistant">
                    <MessageContent>
                      <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-3">
                        <div className="flex items-center gap-2">
                          <BrainIcon className="size-4 text-violet-600" />
                          <p className="text-xs text-foreground/80">
                            Analyzing...
                          </p>
                          <Loader2Icon className="ml-auto size-4 animate-spin text-violet-600" />
                        </div>
                      </div>
                    </MessageContent>
                  </Message>
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-destructive text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Error</p>
                      <p className="mt-1 text-destructive/80">
                        {error.message}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Clear error and retry last message
                        handleRetry();
                      }}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-background/80 backdrop-blur-xl px-3 py-2.5 shrink-0">
        {/* Quick action chips when conversation is active */}
        {hasMessages && (
          <div className="flex flex-wrap gap-1 mb-2">
            {quickActions.slice(0, 3).map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                disabled={status === "streaming"}
                className={cn(
                  "rounded-full border bg-card/50 px-2 py-0.5 text-[10px] font-medium transition-all",
                  "hover:border-violet-500/40 hover:bg-violet-500/5 hover:text-violet-600",
                  "disabled:opacity-50 disabled:pointer-events-none"
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="relative rounded-xl border bg-card/80 backdrop-blur-xl shadow-sm transition-all duration-200 focus-within:shadow-md focus-within:border-violet-500/30">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={inputPlaceholder}
              className="w-full resize-none rounded-t-xl border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 min-h-[40px] max-h-[80px]"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && status !== "streaming") {
                    handleSubmit(
                      e as unknown as FormEvent<HTMLFormElement>
                    );
                  }
                }
              }}
            />

            <div className="flex items-center justify-between gap-2 border-t border-border/30 px-2 py-1.5">
              <div className="flex items-center gap-1">
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-6 w-auto gap-1 rounded-lg border-0 bg-muted/50 px-1.5 text-[10px] font-medium hover:bg-muted transition-colors">
                    <ZapIcon className="size-2.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" className="rounded-xl">
                    {inlineModels.map((m) => (
                      <SelectItem
                        key={m.value}
                        value={m.value}
                        className="rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{m.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                {status === "streaming" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => stop()}
                    className="h-6 gap-1 rounded-lg px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <StopCircleIcon className="size-3" />
                    Stop
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={!input.trim() || status === "streaming"}
                  className="h-7 w-7 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 p-0 shadow-sm shadow-violet-600/20 transition-all hover:shadow-md hover:shadow-violet-600/25 disabled:opacity-50 disabled:shadow-none"
                >
                  <SendIcon className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );

  // Return embedded mode if no open/onOpenChange props
  if (isEmbeddedMode) {
    return (
      <div className="flex flex-col h-full max-h-[600px]">
        {PanelContent}
      </div>
    );
  }

  // Return Sheet mode for call transcripts
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-sm">
              <SparklesIcon className="size-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base">AI Coach</SheetTitle>
              <SheetDescription className="text-xs truncate">
                {transcriptTitle || panelTitle}
              </SheetDescription>
            </div>
            {hasMessages && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title="Clear conversation"
              >
                <Trash2Icon className="size-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {!hasMessages ? (
            /* Empty state with quick actions */
            <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
              <div className="relative mb-5">
                <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 blur-xl" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
                  <SparklesIcon className="size-7 text-primary-foreground" />
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-1">Ask your AI Coach</h3>
              <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
                Get personalized coaching insights about this call
              </p>

              {/* Quick action chips */}
              <div className="w-full space-y-2">
                <p className="text-xs font-medium text-muted-foreground text-center">
                  Quick actions
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.prompt)}
                      className={cn(
                        "rounded-full border bg-card/50 px-3 py-1.5 text-xs font-medium transition-all duration-200",
                        "hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                        "focus:outline-none focus:ring-2 focus:ring-primary/20"
                      )}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Conversation messages */
            <Conversation className="flex-1 px-4">
              <ConversationContent className="mx-auto max-w-full py-4">
                {messages.map((message) => {
                  const reasoning = getMessageReasoning(message);
                  const isLastMessage =
                    message.id === messages[messages.length - 1]?.id;
                  const isAssistant = message.role === "assistant";
                  const isCurrentlyStreaming =
                    isLastMessage && status === "streaming";

                  return (
                    <div
                      key={message.id}
                      className="animate-in fade-in slide-in-from-bottom-2 duration-300 mb-4"
                    >
                      <Message from={message.role}>
                        <MessageContent
                          className={cn(
                            isAssistant && "bg-transparent"
                          )}
                        >
                          {isAssistant && reasoning && (
                            <ThinkingCard
                              thinking={reasoning}
                              isStreaming={isCurrentlyStreaming}
                            />
                          )}

                          {message.parts.map((part, i) => {
                            switch (part.type) {
                              case "text":
                                return isAssistant ? (
                                  <MarkdownContent
                                    key={`${message.id}-${i}`}
                                    text={part.text}
                                  />
                                ) : (
                                  <div
                                    key={`${message.id}-${i}`}
                                    className="prose prose-sm max-w-none dark:prose-invert"
                                  >
                                    {part.text}
                                  </div>
                                );
                              case "reasoning":
                                return null;
                              default:
                                return null;
                            }
                          })}
                        </MessageContent>
                      </Message>
                    </div>
                  );
                })}

                {/* Loading state */}
                {status === "submitted" && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 mb-4">
                    <Message from="assistant">
                      <MessageContent>
                        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
                          <div className="flex items-center gap-3">
                            <BrainIcon className="size-5 text-primary" />
                            <p className="text-sm text-foreground/80">
                              Analyzing call data...
                            </p>
                            <Loader2Icon className="ml-auto size-5 animate-spin text-primary" />
                          </div>
                        </div>
                      </MessageContent>
                    </Message>
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 text-destructive text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Error</p>
                        <p className="mt-1 text-destructive/80">
                          {error.message}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Clear error and retry last message
                          handleRetry();
                        }}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Retry
                      </Button>
                    </div>
                  </div>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          )}
        </div>

        {/* Input area - always visible at bottom */}
        <div className="border-t bg-background/80 backdrop-blur-xl px-4 py-3 shrink-0">
          {/* Quick action chips when conversation is active */}
          {hasMessages && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {quickActions.slice(0, 3).map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.prompt)}
                  disabled={status === "streaming"}
                  className={cn(
                    "rounded-full border bg-card/50 px-2.5 py-1 text-[11px] font-medium transition-all",
                    "hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                    "disabled:opacity-50 disabled:pointer-events-none"
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="relative rounded-2xl border bg-card/80 backdrop-blur-xl shadow-sm transition-all duration-200 focus-within:shadow-md focus-within:border-primary/30">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about this call..."
                className="w-full resize-none rounded-t-2xl border-0 bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 min-h-[48px] max-h-[120px]"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && status !== "streaming") {
                      handleSubmit(
                        e as unknown as FormEvent<HTMLFormElement>
                      );
                    }
                  }
                }}
              />

              <div className="flex items-center justify-between gap-2 border-t border-border/30 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="h-7 w-auto gap-1.5 rounded-lg border-0 bg-muted/50 px-2 text-xs font-medium hover:bg-muted transition-colors">
                      <ZapIcon className="size-3 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start" className="rounded-xl">
                      {inlineModels.map((m) => (
                        <SelectItem
                          key={m.value}
                          value={m.value}
                          className="rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{m.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {m.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  {status === "streaming" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => stop()}
                      className="h-7 gap-1 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                    >
                      <StopCircleIcon className="size-3.5" />
                      Stop
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={!input.trim() || status === "streaming"}
                    className="h-8 w-8 rounded-lg bg-primary p-0 shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
                  >
                    <SendIcon className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
