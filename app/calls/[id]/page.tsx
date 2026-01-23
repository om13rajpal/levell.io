/**  LINEAR-STYLE CALL DETAIL PAGE - OPTIMIZED  **/

"use client";

import type React from "react";
import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, memo, lazy, Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  IconUsers,
  IconExternalLink,
  IconPlayerPlay,
  IconVideo,
  IconChevronDown,
  IconChevronUp,
  IconAlertTriangle,
  IconInfoCircle,
  IconCheck,
  IconSparkles,
  IconTarget,
  IconBulb,
  IconMessageQuestion,
  IconListCheck,
  IconShieldCheck,
  IconTrendingUp,
  IconHelp,
  IconCircleCheck,
  IconSearch,
  IconHeadphones,
  IconDiamond,
  IconRocket,
  IconEye,
  IconRepeat,
} from "@tabler/icons-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { supabase } from "@/lib/supabaseClient";
/* ------------------------------------------------------------- */
/* Helpers */
/* ------------------------------------------------------------- */

function formatTimestamp(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function formatDate(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function formatDurationSeconds(seconds?: number | string | null): string {
  if (!seconds) return "—";
  const totalMinutes = Math.floor(Number(seconds));
  if (totalMinutes <= 0) return "—";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

const CATEGORY_LABELS: Record<string, string> = {
  // V1 categories
  call_setup_and_control: "Call Setup & Control",
  call_setup_control: "Call Setup & Control",
  discovery_and_qualification: "Discovery & Qualification",
  discovery_qualification: "Discovery & Qualification",
  active_listening: "Active Listening",
  value_communication: "Value Communication",
  next_steps_and_momentum: "Next Steps & Momentum",
  next_steps_momentum: "Next Steps & Momentum",
  objection_handling: "Objection Handling",
  // V2 categories
  pain_points: "Pain Points",
  objections: "Objections",
  engagement: "Engagement",
  next_steps: "Next Steps",
  call_structure: "Call Structure",
  rep_technique: "Rep Technique",
};

const DEAL_SIGNAL_CONFIG = {
  healthy: {
    label: "Healthy",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border-emerald-300",
    icon: IconCheck,
  },
  at_risk: {
    label: "At Risk",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border-amber-300",
    icon: IconAlertTriangle,
  },
  critical: {
    label: "Critical",
    color: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400 border-rose-300",
    icon: IconAlertTriangle,
  },
};

function formatCategoryLabel(key: string) {
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function getScoreBgColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function getScoreRingColor(score: number) {
  if (score >= 80) return "stroke-emerald-500";
  if (score >= 60) return "stroke-amber-500";
  return "stroke-rose-500";
}

/* ------------------------------------------------------------- */
/* Memoized Components for Performance */
/* ------------------------------------------------------------- */

// Memoized header with score and deal signal
const CallHeader = memo(({
  title,
  createdAt,
  duration,
  firefliesId,
  aiOverallScore,
  dealSignal,
}: {
  title: string;
  createdAt: string;
  duration: string;
  firefliesId?: string;
  aiOverallScore: number | null;
  dealSignal?: "healthy" | "at_risk" | "critical" | null;
}) => {
  const signalConfig = dealSignal ? DEAL_SIGNAL_CONFIG[dealSignal] : null;
  const SignalIcon = signalConfig?.icon;

  return (
    <div className="flex items-start justify-between flex-wrap gap-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {signalConfig && SignalIcon && (
            <Badge
              variant="outline"
              className={`${signalConfig.color} border flex items-center gap-1.5 px-2.5 py-1`}
            >
              <SignalIcon className="h-3.5 w-3.5" />
              {signalConfig.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{createdAt}</span>
          <span>·</span>
          <span>{duration}</span>
        </div>
        {firefliesId && (
          <p className="text-xs text-muted-foreground/60">
            ID: {firefliesId}
          </p>
        )}
      </div>

      {aiOverallScore !== null ? (
        <div className="flex flex-col items-center">
          <div className="relative h-24 w-24">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                className="stroke-muted"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                className={getScoreRingColor(aiOverallScore)}
                strokeWidth="8"
                strokeDasharray={`${(aiOverallScore / 100) * 251.2} 251.2`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${getScoreColor(aiOverallScore)}`}>
                {aiOverallScore}
              </span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground mt-1">Overall Score</span>
        </div>
      ) : null}
    </div>
  );
});
CallHeader.displayName = "CallHeader";

// Memoized category breakdown with accordion
const CategoryBreakdown = memo(({ categoryEntries }: { categoryEntries: [string, any][] }) => {
  if (categoryEntries.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <IconTrendingUp className="h-5 w-5 text-indigo-500" />
        Performance Breakdown
      </h2>

      <Accordion type="multiple" className="space-y-3">
        {categoryEntries.map(([key, value]: any, index: number) => {
          const score = value.score ?? 0;
          const reason = value.reason ?? "";

          return (
            <AccordionItem
              key={index}
              value={`category-${index}`}
              className="border border-border/60 rounded-lg px-4 bg-card/50 hover:bg-card/80 transition-colors"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      score >= 80
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                        : score >= 60
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400"
                    }`}>
                      {score}
                    </div>
                    <span className="font-medium text-sm">
                      {formatCategoryLabel(key)}
                    </span>
                  </div>
                  <Progress
                    value={score}
                    className={`h-2 w-32 hidden sm:block ${score >= 80 ? "[&>div]:bg-emerald-500" : score >= 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-rose-500"}`}
                  />
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {reason ? (
                  <div className="pt-2 pl-13">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {reason}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic pt-2">
                    No detailed feedback available for this category.
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
});
CategoryBreakdown.displayName = "CategoryBreakdown";

// Score Explainer Card Component
const ScoreExplainerCard = memo(({ score, scoreReason }: { score: number | null; scoreReason: string | null }) => {
  const getScoreLevel = (s: number) => {
    if (s >= 80) return { level: "Excellent", color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/40" };
    if (s >= 60) return { level: "Good", color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/40" };
    if (s >= 40) return { level: "Needs Improvement", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/40" };
    return { level: "Critical", color: "text-rose-600", bgColor: "bg-rose-100 dark:bg-rose-900/40" };
  };

  const scoreInfo = score !== null ? getScoreLevel(score) : { level: "Pending", color: "text-muted-foreground", bgColor: "bg-muted" };

  const scoringCriteria = [
    {
      name: "Call Setup & Control",
      weight: 15,
      description: "Opening, agenda setting, time management",
      tooltip: "Measures how well you establish control at the start of the call. Includes: professional greeting, setting a clear agenda, confirming time availability, and maintaining structure throughout the conversation.",
      icon: IconTarget,
      color: "from-blue-500/20 to-blue-500/5",
      borderColor: "border-blue-500/30",
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-600 dark:text-blue-400"
    },
    {
      name: "Discovery & Qualification",
      weight: 25,
      description: "Understanding needs, BANT criteria, pain points",
      tooltip: "Evaluates your ability to uncover customer needs using BANT (Budget, Authority, Need, Timeline). Includes: asking open-ended questions, identifying pain points, understanding decision-making process, and qualifying the opportunity.",
      icon: IconSearch,
      color: "from-purple-500/20 to-purple-500/5",
      borderColor: "border-purple-500/30",
      iconBg: "bg-purple-500/20",
      iconColor: "text-purple-600 dark:text-purple-400"
    },
    {
      name: "Active Listening",
      weight: 15,
      description: "Engagement, follow-up questions, acknowledgment",
      tooltip: "Assesses how well you listen and respond to the prospect. Includes: verbal acknowledgments, paraphrasing key points, asking relevant follow-up questions, and avoiding interruptions.",
      icon: IconHeadphones,
      color: "from-emerald-500/20 to-emerald-500/5",
      borderColor: "border-emerald-500/30",
      iconBg: "bg-emerald-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-400"
    },
    {
      name: "Value Communication",
      weight: 20,
      description: "Solution alignment, benefits articulation, ROI",
      tooltip: "Measures how effectively you communicate your solution's value. Includes: connecting features to specific customer needs, articulating clear benefits, discussing ROI, and differentiating from competitors.",
      icon: IconDiamond,
      color: "from-amber-500/20 to-amber-500/5",
      borderColor: "border-amber-500/30",
      iconBg: "bg-amber-500/20",
      iconColor: "text-amber-600 dark:text-amber-400"
    },
    {
      name: "Objection Handling",
      weight: 15,
      description: "Addressing concerns, competitive positioning",
      tooltip: "Evaluates your ability to handle pushback professionally. Includes: acknowledging concerns, providing evidence-based responses, reframing objections as opportunities, and maintaining composure under pressure.",
      icon: IconShieldCheck,
      color: "from-rose-500/20 to-rose-500/5",
      borderColor: "border-rose-500/30",
      iconBg: "bg-rose-500/20",
      iconColor: "text-rose-600 dark:text-rose-400"
    },
    {
      name: "Next Steps & Momentum",
      weight: 10,
      description: "Clear action items, timeline, commitment",
      tooltip: "Assesses how well you close the call with forward progress. Includes: summarizing key points, defining specific next steps, setting concrete follow-up dates, and gaining verbal commitment.",
      icon: IconRocket,
      color: "from-indigo-500/20 to-indigo-500/5",
      borderColor: "border-indigo-500/30",
      iconBg: "bg-indigo-500/20",
      iconColor: "text-indigo-600 dark:text-indigo-400"
    },
  ];


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconHelp className="h-5 w-5 text-indigo-500" />
          <h2 className="text-lg font-semibold">Call Score Breakdown</h2>
        </div>
        <Badge variant="outline" className={`${scoreInfo.color} border-current`}>
          {scoreInfo.level}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Understanding how your call is scored
      </p>

      {/* Score Display */}
      <div className="flex items-center gap-4">
        <div className={`h-20 w-20 rounded-2xl ${scoreInfo.bgColor} flex items-center justify-center`}>
          <span className={`text-3xl font-bold ${scoreInfo.color}`}>{score ?? "—"}</span>
        </div>
        <div className="flex-1">
          <p className="font-medium">Overall Call Score</p>
          <p className="text-sm text-muted-foreground">Based on AI analysis of this call</p>
        </div>
      </div>

      {/* Score Reason Section */}
      {scoreReason && (
        <Card className="bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <IconSparkles className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold mb-2">Score Analysis</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {scoreReason}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scoring Criteria */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
          Scoring Criteria
          <span className="text-xs font-normal text-muted-foreground/70 ml-1">(hover for details)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {scoringCriteria.map((criteria, index) => {
            const IconComponent = criteria.icon;
            return (
              <Tooltip key={index} delayDuration={100}>
                <TooltipTrigger asChild>
                  <div className={`group relative p-4 rounded-xl bg-gradient-to-br ${criteria.color} border ${criteria.borderColor} hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-help overflow-hidden`}>
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 opacity-[0.08] transform translate-x-2 -translate-y-2">
                      <IconComponent className="h-16 w-16" />
                    </div>

                    <div className="relative z-10">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`flex items-center justify-center w-9 h-9 rounded-lg ${criteria.iconBg}`}>
                            <IconComponent className={`h-5 w-5 ${criteria.iconColor}`} />
                          </span>
                          <span className="text-sm font-semibold leading-tight">{criteria.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-bold shrink-0 bg-background/80">
                          {criteria.weight}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed pl-[46px]">{criteria.description}</p>
                    </div>

                    {/* Hover indicator */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-sm p-0 bg-popover border shadow-xl rounded-xl overflow-hidden"
                  sideOffset={8}
                >
                  <div className={`px-4 py-2.5 bg-gradient-to-r ${criteria.color} border-b`}>
                    <div className="flex items-center gap-2">
                      <IconComponent className={`h-5 w-5 ${criteria.iconColor}`} />
                      <span className="font-semibold text-sm">{criteria.name}</span>
                      <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 border-current">
                        {criteria.weight}% weight
                      </Badge>
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm leading-relaxed text-muted-foreground">{criteria.tooltip}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Footer Note */}
      <div className="pt-2 border-t border-border/50">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <IconCircleCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <p>Scores are calculated using AI analysis of call transcripts, evaluating sales methodology adherence, customer engagement, and conversion potential.</p>
        </div>
      </div>
    </div>
  );
});
ScoreExplainerCard.displayName = "ScoreExplainerCard";

// Memoized transcript display
const TranscriptDisplay = memo(({
  sentences,
  expanded,
  onToggle
}: {
  sentences: any[];
  expanded: boolean;
  onToggle: () => void;
}) => {
  if (sentences.length === 0) return null;

  const displaySentences = expanded ? sentences : sentences.slice(0, 15);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Full Transcript</h2>

      <div className="space-y-2">
        {displaySentences.map((s: any, i: number) => (
          <div
            key={i}
            className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground shrink-0 h-fit">
              {formatTimestamp(s.start_time)}
            </span>
            <div className="min-w-0">
              <span className="font-medium text-sm text-primary">
                {s.speaker_name}
              </span>
              <p className="text-sm text-muted-foreground mt-0.5">
                {s.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {sentences.length > 15 && (
        <div className="flex justify-center pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
          >
            {expanded ? (
              <>
                Show Less <IconChevronUp className="ml-1 h-4 w-4" />
              </>
            ) : (
              <>
                Show All {sentences.length} Messages <IconChevronDown className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
});
TranscriptDisplay.displayName = "TranscriptDisplay";

/* ------------------------------------------------------------- */

export default function CallDetailPage() {
  const params = useParams();
  const callId = params.id as string;

  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------------------------------------- */
  /* Memoized computed values for performance */
  /* IMPORTANT: All hooks must be called before any early returns */
  /* ------------------------------------------------------------- */

  const duration = useMemo(() => row ? formatDurationSeconds(row.duration) : "—", [row?.duration]);
  const createdAt = useMemo(() => row ? formatDate(row.created_at) : "—", [row?.created_at]);
  const attendees = useMemo(() => (row?.meeting_attendees as any[]) ?? [], [row?.meeting_attendees]);
  const timeline = useMemo(() => (row?.meeting_attendance as any[]) ?? [], [row?.meeting_attendance]);
  const sentences = useMemo(() => (row?.sentences as any[]) ?? [], [row?.sentences]);

  const aiOverallScore = useMemo(() => row?.ai_overall_score ?? null, [row?.ai_overall_score]);
  const aiScoreReason = useMemo(() => row?.ai_score_reason ?? null, [row?.ai_score_reason]);
  const aiSummary = useMemo(() => row?.ai_summary ?? null, [row?.ai_summary]);
  const aiCategoryBreakdown = useMemo(() => row?.ai_category_breakdown ?? {}, [row?.ai_category_breakdown]);
  const aiWhatWorked = useMemo(() => row?.ai_what_worked ?? [], [row?.ai_what_worked]);
  const aiImprovement = useMemo(() => row?.ai_improvement_areas ?? [], [row?.ai_improvement_areas]);
  const aiMissed = useMemo(() => row?.ai_missed_opportunities ?? [], [row?.ai_missed_opportunities]);
  const aiQuestions = useMemo(() => row?.ai_questions ?? [], [row?.ai_questions]);
  const aiQualGaps = useMemo(() => row?.ai_qualification_gaps ?? [], [row?.ai_qualification_gaps]);
  const aiNextPlan = useMemo(() => row?.ai_next_call_game_plan ?? [], [row?.ai_next_call_game_plan]);
  const aiRisks = useMemo(() => row?.ai_deal_risk_alerts ?? [], [row?.ai_deal_risk_alerts]);

  // V2 fields (with V1 fallbacks for backward compatibility)
  const dealSignal = useMemo(() => row?.deal_signal ?? null, [row?.deal_signal]);
  const aiAnalysis = useMemo(() => row?.ai_analysis ?? null, [row?.ai_analysis]);
  const aiCategoryScores = useMemo(() => row?.ai_category_scores ?? null, [row?.ai_category_scores]);

  // V2 coaching sections from ai_analysis (with V1 fallbacks)
  const patternsToWatch = useMemo(() => aiAnalysis?.patterns_to_watch ?? [], [aiAnalysis]);
  const v2WhatWorked = useMemo(() => aiAnalysis?.what_worked ?? [], [aiAnalysis]);
  const v2MissedOpportunities = useMemo(() => aiAnalysis?.missed_opportunities ?? [], [aiAnalysis]);
  const v2DealRisks = useMemo(() => aiAnalysis?.deal_risk_alerts ?? [], [aiAnalysis]);
  const v2NextCallPlan = useMemo(() => aiAnalysis?.next_call_game_plan ?? [], [aiAnalysis]);

  // Use V2 data if available, otherwise fall back to V1
  const effectiveWhatWorked = useMemo(() =>
    v2WhatWorked.length > 0 ? v2WhatWorked : aiWhatWorked,
    [v2WhatWorked, aiWhatWorked]
  );
  const effectiveMissed = useMemo(() =>
    v2MissedOpportunities.length > 0 ? v2MissedOpportunities : aiMissed,
    [v2MissedOpportunities, aiMissed]
  );
  const effectiveRisks = useMemo(() =>
    v2DealRisks.length > 0 ? v2DealRisks : aiRisks,
    [v2DealRisks, aiRisks]
  );
  const effectiveNextPlan = useMemo(() =>
    v2NextCallPlan.length > 0 ? v2NextCallPlan : aiNextPlan,
    [v2NextCallPlan, aiNextPlan]
  );

  // Category entries: prefer V2 6-category scores, fall back to V1 breakdown
  const categoryEntries = useMemo((): [string, any][] => {
    if (aiCategoryScores) {
      // V2 format: just scores, no reason text
      return Object.entries(aiCategoryScores).map(([key, score]): [string, any] => [key, { score, reason: null }]);
    }
    return Object.entries(aiCategoryBreakdown);
  }, [aiCategoryScores, aiCategoryBreakdown]);

  /* ------------------------------------------------------------- */
  /* Data loading - always fetch live to avoid localStorage quota issues */
  /* ------------------------------------------------------------- */
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const numId = parseInt(callId, 10);

      try {
        // Fetch from Supabase with single optimized query
        let query = supabase.from("transcripts").select("*");

        // Single query that handles both ID types
        if (!isNaN(numId)) {
          query = query.or(`id.eq.${numId},fireflies_id.eq.${callId}`);
        } else {
          query = query.eq("fireflies_id", callId);
        }

        const { data, error: fetchError } = await query.limit(1).single();

        if (fetchError || !data) {
          console.error("Error loading transcript:", fetchError);
          setError("Could not load transcript.");
          setRow(null);
        } else {
          setRow(data);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred.");
        setRow(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [callId]);

  /* ------------------------------------------------------------- */
  /* Loading skeleton matching UI design */
  /* ------------------------------------------------------------- */
  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="mx-auto max-w-6xl p-6 space-y-10">
            {/* Header skeleton */}
            <div className="flex items-start justify-between flex-wrap gap-6">
              <div className="space-y-3 flex-1">
                <div className="h-9 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-24 w-24 bg-muted animate-pulse rounded-full" />
            </div>

            {/* Summary card skeleton */}
            <div className="h-32 bg-muted animate-pulse rounded-lg" />

            {/* Category breakdown skeleton */}
            <div className="space-y-4">
              <div className="h-6 w-64 bg-muted animate-pulse rounded" />
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            </div>

            {/* Additional sections skeleton */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <div className="h-6 w-48 bg-muted animate-pulse rounded" />
                <div className="h-24 bg-muted animate-pulse rounded-lg" />
              </div>
            ))}
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (error || !row) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="p-6">
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error || "Transcript not found."}
              </AlertDescription>
            </Alert>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  /* ------------------------------------------------------------- */
  /* UI: LINEAR STYLE */
  /* ------------------------------------------------------------- */

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />

        <div className="mx-auto max-w-6xl p-6 space-y-10">
          {/* ============================================================
              HEADER WITH SCORE (Memoized)
          ============================================================ */}
          <CallHeader
            title={row.title}
            createdAt={createdAt}
            duration={duration}
            firefliesId={row.fireflies_id}
            aiOverallScore={aiOverallScore}
            dealSignal={dealSignal}
          />

          {/* ============================================================
              AI SUMMARY or SCORING IN PROGRESS
          ============================================================ */}
          {aiSummary ? (
            <Card className="border-indigo-200/50 dark:border-indigo-500/20 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <IconSparkles className="h-5 w-5 text-indigo-500" />
                  AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {aiSummary}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  {/* Animated rings */}
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
                    <div className="absolute inset-3 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
                    <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <IconSparkles className="h-10 w-10 text-primary animate-pulse" />
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Analyzing Your Call
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-6">
                    Our AI is processing this call to generate insights, scores, and recommendations. This typically takes a few minutes.
                  </p>

                  {/* What will be analyzed */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
                    {[
                      { icon: IconTrendingUp, label: "Performance Score" },
                      { icon: IconTarget, label: "Key Insights" },
                      { icon: IconBulb, label: "Improvements" },
                      { icon: IconShieldCheck, label: "Next Steps" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/20"
                      >
                        <item.icon className="h-5 w-5 text-muted-foreground/60" />
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Progress dots */}
                  <div className="flex items-center gap-1.5 mt-6">
                    <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ============================================================
              CATEGORY BREAKDOWN (Memoized)
          ============================================================ */}
          <CategoryBreakdown categoryEntries={categoryEntries} />

          {/* ============================================================
              SCORE EXPLAINER CARD
          ============================================================ */}
          <ScoreExplainerCard score={aiOverallScore} scoreReason={aiScoreReason} />

          {/* ============================================================
              WHAT WORKED
          ============================================================ */}
          {effectiveWhatWorked.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconCheck className="text-emerald-500 h-5 w-5" />
                What Worked Well
              </h2>

              <div className="space-y-3">
                {effectiveWhatWorked.map((item: any, i: number) => {
                  // Handle V1 (string), V2 (moment/quote/why_effective), and V3 (point/detail/highlighted_sentence) formats
                  const isString = typeof item === "string";
                  const content = isString ? item : item.point || item.moment || item.behavior_skill || item.text || "";
                  const explanation = isString ? null : item.detail || item.why_effective || item.explanation;
                  const quote = isString ? null : item.quote;
                  // V3 highlighted_sentence support
                  const highlightedSentence = isString ? null : item.highlighted_sentence;
                  const highlightText = highlightedSentence?.text || quote;
                  const highlightSpeaker = highlightedSentence?.speaker;
                  const highlightSentiment = highlightedSentence?.sentiment;

                  return (
                    <Card
                      key={i}
                      className="border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10"
                    >
                      <CardContent className="pt-4">
                        <div className="flex gap-3">
                          <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0 mt-0.5">
                            <IconCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="space-y-2 flex-1">
                            <p className="text-sm font-medium leading-relaxed">{content}</p>
                            {highlightText && (
                              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 border border-emerald-200/50 dark:border-emerald-800/50">
                                {highlightSpeaker && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] px-1.5 py-0.5 ${
                                        highlightSentiment === 'positive'
                                          ? 'border-emerald-400 text-emerald-700 dark:text-emerald-300'
                                          : highlightSentiment === 'negative'
                                          ? 'border-rose-400 text-rose-700 dark:text-rose-300'
                                          : 'border-slate-400 text-slate-700 dark:text-slate-300'
                                      }`}
                                    >
                                      {highlightSpeaker}
                                    </Badge>
                                  </div>
                                )}
                                <blockquote className="text-xs text-muted-foreground italic border-l-2 border-emerald-400 pl-3">
                                  "{highlightText}"
                                </blockquote>
                              </div>
                            )}
                            {explanation && (
                              <p className="text-sm text-muted-foreground leading-relaxed">{explanation}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================
              IMPROVEMENT AREAS
          ============================================================ */}
          {aiImprovement.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconBulb className="text-amber-500 h-5 w-5" />
                Areas for Improvement
              </h2>

              <div className="space-y-4">
                {aiImprovement.map((item: any, i: number) => {
                  // V3 highlighted_sentence support for improvement areas
                  const highlightedSentence = item.highlighted_sentence;
                  const highlightText = highlightedSentence?.text;
                  const highlightSpeaker = highlightedSentence?.speaker;
                  const highlightSentiment = highlightedSentence?.sentiment;

                  return (
                    <Card
                      key={i}
                      className="border-amber-200/50 dark:border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/10"
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-amber-700 dark:text-amber-300">
                          {item.area || item.category_skill || `Improvement ${i + 1}`}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {(item.what_happened || item.what_you_did) && (
                          <div>
                            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                              What Happened
                            </p>
                            <p>{item.what_happened || item.what_you_did}</p>
                          </div>
                        )}
                        {/* V3: Display highlighted sentence from the call */}
                        {highlightText && (
                          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200/50 dark:border-amber-800/50">
                            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-2">
                              From the Call
                            </p>
                            {highlightSpeaker && (
                              <div className="flex items-center gap-2 mb-2">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0.5 ${
                                    highlightSentiment === 'positive'
                                      ? 'border-emerald-400 text-emerald-700 dark:text-emerald-300'
                                      : highlightSentiment === 'negative'
                                      ? 'border-rose-400 text-rose-700 dark:text-rose-300'
                                      : 'border-slate-400 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {highlightSpeaker}
                                </Badge>
                              </div>
                            )}
                            <blockquote className="text-xs text-muted-foreground italic border-l-2 border-amber-400 pl-3">
                              "{highlightText}"
                            </blockquote>
                          </div>
                        )}
                        {(item.what_to_do_instead || item.do_this_instead) && (
                          <div>
                            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                              What To Do Instead
                            </p>
                            <p className="text-amber-800 dark:text-amber-200">
                              {item.what_to_do_instead || item.do_this_instead}
                            </p>
                          </div>
                        )}
                        {(item.why_it_was_not_effective || item.why_this_didnt_work) && (
                          <div>
                            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                              Why It Wasn't Effective
                            </p>
                            <p className="text-muted-foreground">
                              {item.why_it_was_not_effective || item.why_this_didnt_work}
                            </p>
                          </div>
                        )}
                        {/* V3: Display practice framework if available */}
                        {item.practice_framework && (
                          <div className="bg-amber-100/50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-300/50 dark:border-amber-700/50">
                            <p className="font-medium text-amber-700 dark:text-amber-300 text-xs uppercase tracking-wide mb-1">
                              Practice Framework
                            </p>
                            <p className="text-sm text-amber-900 dark:text-amber-100">
                              {item.practice_framework}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================
              MISSED OPPORTUNITIES
          ============================================================ */}
          {effectiveMissed.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconTarget className="h-5 w-5 text-purple-500" />
                Missed Opportunities
              </h2>

              <div className="space-y-4">
                {effectiveMissed.map((item: any, i: number) => {
                  // V3 highlighted_sentence support for missed opportunities
                  const highlightedSentence = item.highlighted_sentence;
                  const highlightText = highlightedSentence?.text;
                  const highlightSpeaker = highlightedSentence?.speaker;
                  const highlightSentiment = highlightedSentence?.sentiment;

                  return (
                    <Card
                      key={i}
                      className="border-purple-200/50 dark:border-purple-500/20 bg-purple-50/30 dark:bg-purple-950/10"
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-purple-700 dark:text-purple-300">
                          {item.moment || item.moment_in_call || `Opportunity ${i + 1}`}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {item.why_it_matters && (
                          <div>
                            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                              Why It Matters
                            </p>
                            <p>{item.why_it_matters}</p>
                          </div>
                        )}
                        {/* V3: Display highlighted sentence from the call */}
                        {highlightText && (
                          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 border border-purple-200/50 dark:border-purple-800/50">
                            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-2">
                              Moment in the Call
                            </p>
                            {highlightSpeaker && (
                              <div className="flex items-center gap-2 mb-2">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0.5 ${
                                    highlightSentiment === 'positive'
                                      ? 'border-emerald-400 text-emerald-700 dark:text-emerald-300'
                                      : highlightSentiment === 'negative'
                                      ? 'border-rose-400 text-rose-700 dark:text-rose-300'
                                      : 'border-slate-400 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {highlightSpeaker}
                                </Badge>
                              </div>
                            )}
                            <blockquote className="text-xs text-muted-foreground italic border-l-2 border-purple-400 pl-3">
                              "{highlightText}"
                            </blockquote>
                          </div>
                        )}
                        {(item.what_to_say || item.what_you_should_have_done || item.what_you_could_have_done) && (
                          <div>
                            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                              What You Should Have Said
                            </p>
                            <p className="text-purple-800 dark:text-purple-200 italic">
                              "{item.what_to_say || item.what_you_should_have_done || item.what_you_could_have_done}"
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================
              SUGGESTED QUESTIONS
          ============================================================ */}
          {aiQuestions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconMessageQuestion className="h-5 w-5 text-sky-500" />
                Questions to Ask
              </h2>

              <div className="grid md:grid-cols-2 gap-4">
                {aiQuestions.map((item: any, i: number) => (
                  <Card
                    key={i}
                    className="border-sky-200/50 dark:border-sky-500/20 bg-sky-50/30 dark:bg-sky-950/10"
                  >
                    <CardHeader className="pb-2">
                      <Badge variant="outline" className="w-fit text-xs border-sky-300 text-sky-700 dark:text-sky-300">
                        {item.category || item.spiced_framework_element || "Question"}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="font-medium text-sky-800 dark:text-sky-200 italic">
                        "{item.question || item.exact_question}"
                      </p>
                      {(item.why_to_ask || item.why_ask_this) && (
                        <p className="text-xs text-muted-foreground">
                          {item.why_to_ask || item.why_ask_this}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================
              QUALIFICATION GAPS
          ============================================================ */}
          {aiQualGaps.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconListCheck className="h-5 w-5 text-indigo-500" />
                Qualification Gaps (BANT)
              </h2>

              <div className="grid md:grid-cols-2 gap-4">
                {aiQualGaps.map((item: any, i: number) => {
                  // V3 highlighted_sentence support for qualification gaps
                  const highlightedSentence = item.highlighted_sentence;
                  const highlightText = highlightedSentence?.text;
                  const highlightSpeaker = highlightedSentence?.speaker;
                  const highlightSentiment = highlightedSentence?.sentiment;
                  const riskLevel = item.risk_level;

                  return (
                    <Card
                      key={i}
                      className="border-indigo-200/50 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/10"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                            {item.element || item.framework_element || `Gap ${i + 1}`}
                          </CardTitle>
                          {riskLevel && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0.5 ${
                                riskLevel === 'high'
                                  ? 'border-rose-400 text-rose-700 dark:text-rose-300'
                                  : riskLevel === 'medium'
                                  ? 'border-amber-400 text-amber-700 dark:text-amber-300'
                                  : 'border-emerald-400 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {riskLevel} risk
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {(item.what_is_missing || item.whats_missing) && (
                          <div>
                            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                              What's Missing
                            </p>
                            <p>{item.what_is_missing || item.whats_missing}</p>
                          </div>
                        )}
                        {/* V3: Display highlighted sentence from the call */}
                        {highlightText && (
                          <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-3 border border-indigo-200/50 dark:border-indigo-800/50">
                            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-2">
                              Evidence from Call
                            </p>
                            {highlightSpeaker && (
                              <div className="flex items-center gap-2 mb-2">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0.5 ${
                                    highlightSentiment === 'positive'
                                      ? 'border-emerald-400 text-emerald-700 dark:text-emerald-300'
                                      : highlightSentiment === 'negative'
                                      ? 'border-rose-400 text-rose-700 dark:text-rose-300'
                                      : 'border-slate-400 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {highlightSpeaker}
                                </Badge>
                              </div>
                            )}
                            <blockquote className="text-xs text-muted-foreground italic border-l-2 border-indigo-400 pl-3">
                              "{highlightText}"
                            </blockquote>
                          </div>
                        )}
                        {(item.how_to_get_it || item.how_to_get_it_next_conversation) && (
                          <div>
                            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                              How to Get It
                            </p>
                            <p className="text-indigo-800 dark:text-indigo-200">
                              {item.how_to_get_it || item.how_to_get_it_next_conversation}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================
              NEXT CALL GAME PLAN
          ============================================================ */}
          {effectiveNextPlan.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconShieldCheck className="h-5 w-5 text-emerald-500" />
                Next Call Game Plan
              </h2>

              <div className="space-y-3">
                {effectiveNextPlan.map((item: any, i: number) => {
                  // V2 format has priority field
                  const priorityColors: Record<string, string> = {
                    high: "border-rose-300 bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400",
                    medium: "border-amber-300 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
                    low: "border-slate-300 bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-400",
                  };
                  // V3 format has specific_questions and success_criteria
                  const specificQuestions = item.specific_questions || [];
                  const successCriteria = item.success_criteria;

                  return (
                    <Card
                      key={i}
                      className="border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10"
                    >
                      <CardContent className="pt-4">
                        <div className="flex gap-3">
                          <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            {i + 1}
                          </div>
                          <div className="space-y-3 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium">{item.action}</p>
                              {item.priority && (
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 text-xs ${priorityColors[item.priority] || ""}`}
                                >
                                  {item.priority}
                                </Badge>
                              )}
                            </div>
                            {item.why && (
                              <p className="text-sm text-muted-foreground">{item.why}</p>
                            )}
                            {/* V3: Display specific questions */}
                            {specificQuestions.length > 0 && (
                              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 border border-emerald-200/50 dark:border-emerald-800/50">
                                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-2">
                                  What to Say
                                </p>
                                <ul className="space-y-1">
                                  {specificQuestions.map((q: string, qi: number) => (
                                    <li key={qi} className="text-sm text-emerald-800 dark:text-emerald-200 italic flex items-start gap-2">
                                      <span className="text-emerald-500 shrink-0">•</span>
                                      <span>"{q}"</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {/* V3: Display success criteria */}
                            {successCriteria && (
                              <div className="flex items-start gap-2 text-sm">
                                <IconCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Success looks like: </span>
                                  <span className="text-muted-foreground">{successCriteria}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================
              PATTERNS TO WATCH (V2)
          ============================================================ */}
          {patternsToWatch.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconRepeat className="h-5 w-5 text-orange-500" />
                Patterns to Watch
              </h2>

              <div className="space-y-4">
                {patternsToWatch.map((item: any, i: number) => (
                  <Card
                    key={i}
                    className="border-orange-200/50 dark:border-orange-500/20 bg-orange-50/30 dark:bg-orange-950/10"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base text-orange-700 dark:text-orange-300">
                          {item.pattern}
                        </CardTitle>
                        {item.occurrences && (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-xs border-orange-300 text-orange-700 dark:text-orange-400"
                          >
                            {item.occurrences}x
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {item.impact && (
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                            Impact
                          </p>
                          <p>{item.impact}</p>
                        </div>
                      )}
                      {item.recommendation && (
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                            Recommendation
                          </p>
                          <p className="text-orange-800 dark:text-orange-200">
                            {item.recommendation}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================
              DEAL RISK ALERTS
          ============================================================ */}
          {effectiveRisks.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-rose-500" />
                Deal Risk Alerts
              </h2>

              <div className="space-y-4">
                {effectiveRisks.map((item: any, i: number) => (
                  <Card
                    key={i}
                    className="border-rose-200/50 dark:border-rose-500/20 bg-rose-50/30 dark:bg-rose-950/10"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base text-rose-700 dark:text-rose-300">
                        <IconAlertTriangle className="h-4 w-4" />
                        {item.risk_type || item.risk_description || `Risk ${i + 1}`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {item.what_happened && (
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                            What Happened
                          </p>
                          <p>{item.what_happened}</p>
                        </div>
                      )}
                      {(item.why_risky || item.why_it_is_a_risk || item.what_this_means) && (
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                            Why It's a Risk
                          </p>
                          <p>{item.why_risky || item.why_it_is_a_risk || item.what_this_means}</p>
                        </div>
                      )}
                      {(item.question_to_ask || item.how_to_fix_it || item.how_to_address_it) && (
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                            How to Address
                          </p>
                          <p className="text-rose-800 dark:text-rose-200">
                            {item.question_to_ask || item.how_to_fix_it || item.how_to_address_it}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* ============================================================
              PARTICIPANTS
          ============================================================ */}
          {attendees.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconUsers className="h-5 w-5 text-indigo-500" />
                Participants
              </h2>

              <div className="flex flex-wrap gap-2">
                {attendees.map((p: any, i: number) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
                  >
                    {p.displayName || p.email || p.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================
              CALL ASSETS
          ============================================================ */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Call Assets</h2>

            <div className="flex flex-wrap gap-2">
              {row.transcript_url && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                >
                  <a href={row.transcript_url} target="_blank" rel="noopener noreferrer">
                    <IconExternalLink className="h-4 w-4 mr-2" />
                    Fireflies Transcript
                  </a>
                </Button>
              )}

              {row.audio_url && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                >
                  <a href={row.audio_url} target="_blank" rel="noopener noreferrer">
                    <IconPlayerPlay className="h-4 w-4 mr-2" />
                    Audio Recording
                  </a>
                </Button>
              )}

              {row.video_url && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                >
                  <a href={row.video_url} target="_blank" rel="noopener noreferrer">
                    <IconVideo className="h-4 w-4 mr-2" />
                    Video Recording
                  </a>
                </Button>
              )}

              {row.meeting_link && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                >
                  <a href={row.meeting_link} target="_blank" rel="noopener noreferrer">
                    <IconExternalLink className="h-4 w-4 mr-2" />
                    Meeting Link
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* ============================================================
              ATTENDANCE TIMELINE
          ============================================================ */}
          {timeline.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Attendance Timeline</h2>

              <div className="relative pl-6 border-l-2 border-indigo-200 dark:border-indigo-500/30 space-y-6">
                {timeline.map((t: any, i: number) => (
                  <div key={i} className="relative group">
                    {/* Dot */}
                    <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-indigo-500 bg-background"></div>

                    {/* Box */}
                    <div className="rounded-lg bg-muted/50 p-4 transition-all duration-200 group-hover:bg-muted">
                      <p className="font-medium">{t.name}</p>
                      <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                        <span>
                          <strong>Joined:</strong> {formatDate(t.join_time)}
                        </span>
                        <span>
                          <strong>Left:</strong> {formatDate(t.leave_time)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* ============================================================
              TRANSCRIPT (Memoized & Lazy Loaded)
          ============================================================ */}
          <TranscriptDisplay
            sentences={sentences}
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
