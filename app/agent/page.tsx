"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  BrainIcon,
  SparklesIcon,
  Loader2Icon,
  ChevronDownIcon,
  SendIcon,
  StopCircleIcon,
  ZapIcon,
  PhoneIcon,
  BuildingIcon,
  CheckIcon,
  SearchIcon,
} from "lucide-react";
import React, { type FormEvent, useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/lib/supabaseClient";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

// Lazy load ReactMarkdown
const ReactMarkdown = dynamic(
  () => import("react-markdown"),
  { ssr: false, loading: () => <div className="animate-pulse h-4 bg-muted rounded" /> }
);

// Available AI models (OpenAI only)
const models = [
  {
    name: "GPT-4o",
    value: "gpt-4o",
    description: "Most capable",
  },
  {
    name: "GPT-4o Mini",
    value: "gpt-4o-mini",
    description: "Fast & efficient",
  },
  {
    name: "GPT-4 Turbo",
    value: "gpt-4-turbo",
    description: "Advanced reasoning",
  },
  {
    name: "GPT-3.5 Turbo",
    value: "gpt-3.5-turbo",
    description: "Quick & affordable",
  },
];

// Typing animation prompts
const typingPrompts = [
  "What were the main pain points discussed?",
  "How can I improve my sales approach?",
  "What are the deal risks I should address?",
  "Summarize the key action items...",
  "What qualification gaps exist?",
  "How engaged was the prospect?",
];

// Typing animation hook
function useTypingAnimation(prompts: string[], typingSpeed = 50, deletingSpeed = 30, pauseDuration = 2000) {
  const [displayText, setDisplayText] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPrompt = prompts[promptIndex];

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < currentPrompt.length) {
          setDisplayText(currentPrompt.slice(0, displayText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), pauseDuration);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setPromptIndex((prev) => (prev + 1) % prompts.length);
        }
      }
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, promptIndex, prompts, typingSpeed, deletingSpeed, pauseDuration]);

  return displayText;
}

// Thinking Card Component
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

// Markdown Components
function MarkdownContent({ text }: { text: string }) {
  const components: Components = useMemo(
    () => ({
      a: ({ href, children, ...props }) => (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80" {...props}>
          {children}
        </a>
      ),
      p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
      h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
      h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-5">{children}</h2>,
      h3: ({ children }) => <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>,
      h4: ({ children }) => <h4 className="text-base font-bold mb-2 mt-3">{children}</h4>,
      ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
      li: ({ children }) => <li className="mb-1">{children}</li>,
      blockquote: ({ children }) => (
        <blockquote className="border-l-4 border-primary/30 pl-4 italic my-4 text-muted-foreground">
          {children}
        </blockquote>
      ),
      code: ({ className, children, ...props }) => {
        const isInline = !className;
        if (isInline) {
          return <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
        }
        return <code className={cn("block bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono", className)} {...props}>{children}</code>;
      },
      pre: ({ children }) => <pre className="bg-muted p-4 rounded-xl overflow-x-auto mb-4">{children}</pre>,
      table: ({ children }) => (
        <div className="overflow-x-auto mb-4">
          <table className="min-w-full border-collapse border border-border">{children}</table>
        </div>
      ),
      th: ({ children }) => <th className="border border-border bg-muted px-4 py-2 text-left font-semibold">{children}</th>,
      td: ({ children }) => <td className="border border-border px-4 py-2">{children}</td>,
      hr: () => <hr className="my-6 border-border" />,
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
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

// Context types
interface CallOption {
  id: number;
  title: string;
  duration: number | null;
  ai_overall_score: number | null;
  created_at: string;
}

interface CompanyOption {
  id: number;
  company_name: string;
  domain: string;
}

export default function AgentPage() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(models[0].value);
  const [hasStarted, setHasStarted] = useState(false);

  // Context selection state
  const [contextType, setContextType] = useState<"call" | "company" | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Data for dropdowns
  const [calls, setCalls] = useState<CallOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Popover states
  const [callPopoverOpen, setCallPopoverOpen] = useState(false);
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);

  // Typing animation
  const typingText = useTypingAnimation(typingPrompts);

  // Fetch calls
  useEffect(() => {
    async function fetchCalls() {
      setLoadingCalls(true);
      const { data, error } = await supabase
        .from("transcripts")
        .select("id, title, duration, ai_overall_score, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setCalls(data);
      }
      setLoadingCalls(false);
    }
    fetchCalls();
  }, []);

  // Fetch companies
  useEffect(() => {
    async function fetchCompanies() {
      setLoadingCompanies(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: companyRow } = await supabase
          .from("company")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (companyRow) {
          const { data, error } = await supabase
            .from("external_org")
            .select("id, company_name, domain")
            .eq("company_id", companyRow.id)
            .order("company_name", { ascending: true })
            .limit(50);

          if (!error && data) {
            setCompanies(data);
          }
        }
      }
      setLoadingCompanies(false);
    }
    fetchCompanies();
  }, []);

  // Get selected item labels
  const selectedCall = calls.find((c) => c.id.toString() === selectedCallId);
  const selectedCompany = companies.find((c) => c.id.toString() === selectedCompanyId);

  // Handle context type change
  const handleSelectCall = (callId: string) => {
    setSelectedCallId(callId);
    setSelectedCompanyId(null);
    setContextType("call");
    setCallPopoverOpen(false);
  };

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedCallId(null);
    setContextType("company");
    setCompanyPopoverOpen(false);
  };

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agent",
      credentials: "include",
    }),
  });

  const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() && (selectedCallId || selectedCompanyId)) {
      setHasStarted(true);
      sendMessage(
        { text: input },
        {
          body: {
            model,
            contextType,
            contextId: contextType === "call" ? selectedCallId : selectedCompanyId,
          },
        }
      );
      setInput("");
    }
  }, [input, model, contextType, selectedCallId, selectedCompanyId, sendMessage]);

  const handleQuickAction = useCallback((prompt: string) => {
    if (selectedCallId || selectedCompanyId) {
      setHasStarted(true);
      sendMessage(
        { text: prompt },
        {
          body: {
            model,
            contextType,
            contextId: contextType === "call" ? selectedCallId : selectedCompanyId,
          },
        }
      );
    }
  }, [model, contextType, selectedCallId, selectedCompanyId, sendMessage]);

  // Quick action cards
  const quickActions = contextType === "call" ? [
    { title: "Key Insights", prompt: "What are the key insights from this call?" },
    { title: "Pain Points", prompt: "What were the main pain points discussed in this call?" },
    { title: "Action Items", prompt: "List all action items and next steps from this call." },
    { title: "Deal Risks", prompt: "What are the potential deal risks identified in this call?" },
  ] : [
    { title: "Company Overview", prompt: "Give me an overview of this company and our relationship." },
    { title: "Call History", prompt: "Summarize our call history with this company." },
    { title: "Recommendations", prompt: "What are your recommendations for this account?" },
    { title: "Risk Assessment", prompt: "What are the risks associated with this account?" },
  ];

  // Extract reasoning from messages
  const getMessageMetadata = (message: typeof messages[0]) => {
    let reasoning = "";

    for (const part of message.parts) {
      if (part.type === "reasoning") {
        const reasoningPart = part as { text: string };
        reasoning += reasoningPart.text;
      }
    }

    return { reasoning };
  };

  // Check if context is selected
  const hasContext = selectedCallId || selectedCompanyId;

  // Initial state - context selection
  if (!hasStarted && messages.length === 0) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex min-h-[calc(100vh-var(--header-height))] flex-col items-center justify-center px-4 sm:px-6">
            <div className="w-full max-w-2xl space-y-8">
              {/* Hero Section */}
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="relative">
                  <div className="absolute inset-0 animate-pulse rounded-3xl bg-gradient-to-br from-primary/30 to-accent/30 blur-2xl" />
                  <div className="relative flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
                    <SparklesIcon className="size-10 text-primary-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h1 className="font-bold text-4xl tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                    Sales Intelligence Agent
                  </h1>
                  <p className="text-muted-foreground text-lg max-w-md">
                    Select a call or company to analyze with AI-powered insights
                  </p>
                </div>
              </div>

              {/* Context Selection */}
              <div className="grid grid-cols-2 gap-4">
                {/* Call Selection */}
                <Popover open={callPopoverOpen} onOpenChange={setCallPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={selectedCallId ? "default" : "outline"}
                      role="combobox"
                      className={cn(
                        "h-auto flex-col items-start gap-2 p-4 rounded-2xl border-2 transition-all",
                        selectedCallId ? "border-primary bg-primary/10" : "hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <PhoneIcon className="size-5" />
                        <span className="font-semibold">Select Call</span>
                        {selectedCallId && <CheckIcon className="size-4 ml-auto text-primary" />}
                      </div>
                      <span className="text-xs text-muted-foreground text-left line-clamp-1">
                        {selectedCall ? selectedCall.title : "Choose a call to analyze"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search calls..." />
                      <CommandList>
                        <CommandEmpty>
                          {loadingCalls ? "Loading calls..." : "No calls found."}
                        </CommandEmpty>
                        <CommandGroup heading="Recent Calls">
                          {calls.map((call) => (
                            <CommandItem
                              key={call.id}
                              value={call.title || `Call ${call.id}`}
                              onSelect={() => handleSelectCall(call.id.toString())}
                              className="flex flex-col items-start gap-1 py-3"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <PhoneIcon className="size-4 text-muted-foreground" />
                                <span className="font-medium line-clamp-1 flex-1">{call.title || `Call ${call.id}`}</span>
                                {selectedCallId === call.id.toString() && (
                                  <CheckIcon className="size-4 text-primary" />
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground pl-6">
                                <span>{new Date(call.created_at).toLocaleDateString()}</span>
                                {call.ai_overall_score !== null && (
                                  <span className={cn(
                                    "font-medium",
                                    call.ai_overall_score >= 80 ? "text-green-600" :
                                    call.ai_overall_score >= 60 ? "text-yellow-600" : "text-red-600"
                                  )}>
                                    Score: {call.ai_overall_score}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Company Selection */}
                <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={selectedCompanyId ? "default" : "outline"}
                      role="combobox"
                      className={cn(
                        "h-auto flex-col items-start gap-2 p-4 rounded-2xl border-2 transition-all",
                        selectedCompanyId ? "border-primary bg-primary/10" : "hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <BuildingIcon className="size-5" />
                        <span className="font-semibold">Select Company</span>
                        {selectedCompanyId && <CheckIcon className="size-4 ml-auto text-primary" />}
                      </div>
                      <span className="text-xs text-muted-foreground text-left line-clamp-1">
                        {selectedCompany ? selectedCompany.company_name : "Choose a company to analyze"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search companies..." />
                      <CommandList>
                        <CommandEmpty>
                          {loadingCompanies ? "Loading companies..." : "No companies found."}
                        </CommandEmpty>
                        <CommandGroup heading="Companies">
                          {companies.map((company) => (
                            <CommandItem
                              key={company.id}
                              value={company.company_name}
                              onSelect={() => handleSelectCompany(company.id.toString())}
                              className="flex flex-col items-start gap-1 py-3"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <BuildingIcon className="size-4 text-muted-foreground" />
                                <span className="font-medium flex-1">{company.company_name}</span>
                                {selectedCompanyId === company.id.toString() && (
                                  <CheckIcon className="size-4 text-primary" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground pl-6">
                                {company.domain}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Premium Input Box */}
              <form onSubmit={handleSubmit} className="relative">
                <div className={cn(
                  "relative rounded-3xl border bg-card/80 backdrop-blur-xl shadow-xl shadow-black/5 transition-all duration-300",
                  hasContext ? "focus-within:shadow-2xl focus-within:shadow-primary/10 focus-within:border-primary/30" : "opacity-50"
                )}>
                  {/* Textarea */}
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={hasContext ? typingText || "Ask me anything about this data..." : "Select a call or company first..."}
                    disabled={!hasContext}
                    className="w-full resize-none rounded-t-3xl border-0 bg-transparent px-6 py-5 text-base placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 min-h-[100px] max-h-[200px] disabled:cursor-not-allowed"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (input.trim() && hasContext) {
                          handleSubmit(e as unknown as FormEvent<HTMLFormElement>);
                        }
                      }
                    }}
                  />

                  {/* Footer with model selector and submit */}
                  <div className="flex items-center justify-between gap-3 border-t border-border/50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Model Selector */}
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger className="h-9 w-auto gap-2 rounded-xl border-0 bg-muted/50 px-3 text-sm font-medium hover:bg-muted transition-colors">
                          <ZapIcon className="size-3.5 text-muted-foreground" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start" className="rounded-xl">
                          {models.map((m) => (
                            <SelectItem key={m.value} value={m.value} className="rounded-lg">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{m.name}</span>
                                <span className="text-xs text-muted-foreground">{m.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Context indicator */}
                      {hasContext && (
                        <div className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                          {contextType === "call" ? <PhoneIcon className="size-3" /> : <BuildingIcon className="size-3" />}
                          <span className="max-w-[150px] truncate">
                            {contextType === "call" ? selectedCall?.title : selectedCompany?.company_name}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={!input.trim() || !hasContext}
                      className="h-10 w-10 rounded-xl bg-primary p-0 shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:shadow-none"
                    >
                      <SendIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              </form>

              {/* Quick Actions */}
              {hasContext && (
                <div className="space-y-4">
                  <p className="text-center text-sm font-medium text-muted-foreground">
                    Quick actions for {contextType === "call" ? "this call" : "this company"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {quickActions.map((action) => (
                      <button
                        key={action.title}
                        onClick={() => handleQuickAction(action.prompt)}
                        className={cn(
                          "group relative overflow-hidden rounded-2xl border bg-card/50 backdrop-blur-sm p-4 text-left transition-all duration-300",
                          "hover:border-primary/30 hover:bg-card hover:shadow-lg hover:shadow-primary/5",
                          "focus:outline-none focus:ring-2 focus:ring-primary/20"
                        )}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        <div className="relative">
                          <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10">
                            <SearchIcon className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                          </div>
                          <h3 className="font-semibold text-sm">{action.title}</h3>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  // Chat state after user sends a message
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex h-[calc(100vh-var(--header-height))] flex-col">
          {/* Main Chat Area */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-1 flex-col">
              <Conversation className="flex-1 px-4 sm:px-6">
                <ConversationContent className="mx-auto max-w-3xl py-6">
                  {messages.map((message) => {
                    const { reasoning } = getMessageMetadata(message);
                    const isLastMessage = message.id === messages[messages.length - 1]?.id;
                    const isAssistant = message.role === "assistant";
                    const isCurrentlyStreaming = isLastMessage && status === "streaming";

                    return (
                      <div
                        key={message.id}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-300 mb-6"
                      >
                        <Message from={message.role}>
                          <MessageContent className={cn(
                            isAssistant && "bg-transparent"
                          )}>
                            {/* Show thinking/reasoning */}
                            {isAssistant && reasoning && (
                              <ThinkingCard
                                thinking={reasoning}
                                isStreaming={isCurrentlyStreaming}
                              />
                            )}

                            {/* Render message parts */}
                            {message.parts.map((part, i) => {
                              switch (part.type) {
                                case "text":
                                  return isAssistant ? (
                                    <MarkdownContent key={`${message.id}-${i}`} text={part.text} />
                                  ) : (
                                    <div key={`${message.id}-${i}`} className="prose prose-sm max-w-none dark:prose-invert">
                                      {part.text}
                                    </div>
                                  );
                                case "reasoning":
                                  return null; // Handled above
                                default:
                                  return null;
                              }
                            })}
                          </MessageContent>
                        </Message>
                      </div>
                    );
                  })}

                  {/* Show loading state */}
                  {status === "submitted" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 mb-6">
                      <Message from="assistant">
                        <MessageContent>
                          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4">
                            <div className="flex items-center gap-3">
                              <BrainIcon className="size-5 text-primary" />
                              <p className="text-sm text-foreground/80">
                                Analyzing {contextType === "call" ? "call" : "company"} data...
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
                      <p className="font-semibold">Error</p>
                      <p className="mt-1 text-destructive/80">{error.message}</p>
                    </div>
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>

              {/* Input Area - Fixed at bottom */}
              <div className="border-t bg-background/80 backdrop-blur-xl px-4 sm:px-6 py-4">
                <div className="mx-auto max-w-3xl">
                  {/* Context indicator */}
                  {hasContext && (
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                        {contextType === "call" ? <PhoneIcon className="size-3" /> : <BuildingIcon className="size-3" />}
                        <span>Analyzing: {contextType === "call" ? selectedCall?.title : selectedCompany?.company_name}</span>
                      </div>
                    </div>
                  )}

                  {/* Chat Input */}
                  <form onSubmit={handleSubmit} className="relative">
                    <div className="relative rounded-2xl border bg-card/80 backdrop-blur-xl shadow-lg transition-all duration-200 focus-within:shadow-xl focus-within:border-primary/30">
                      {/* Textarea */}
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask anything..."
                        className="w-full resize-none rounded-t-2xl border-0 bg-transparent px-5 py-4 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 min-h-[56px] max-h-[150px]"
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (input.trim() && status !== "streaming") {
                              handleSubmit(e as unknown as FormEvent<HTMLFormElement>);
                            }
                          }
                        }}
                      />

                      {/* Footer */}
                      <div className="flex items-center justify-between gap-2 border-t border-border/30 px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {/* Model Selector */}
                          <Select value={model} onValueChange={setModel}>
                            <SelectTrigger className="h-8 w-auto gap-1.5 rounded-xl border-0 bg-muted/50 px-2.5 text-xs font-medium hover:bg-muted transition-colors">
                              <ZapIcon className="size-3 text-muted-foreground" />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="start" className="rounded-xl">
                              {models.map((m) => (
                                <SelectItem key={m.value} value={m.value} className="rounded-lg text-sm">
                                  <span className="font-medium">{m.name}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {status === "streaming" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => stop()}
                              className="h-8 gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                            >
                              <StopCircleIcon className="size-3.5" />
                              Stop
                            </Button>
                          )}
                          <Button
                            type="submit"
                            disabled={!input.trim() || status === "streaming"}
                            className="h-9 w-9 rounded-xl bg-primary p-0 shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
                          >
                            <SendIcon className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
