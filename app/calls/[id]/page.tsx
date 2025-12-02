/**  LINEAR-STYLE CALL DETAIL PAGE  **/

"use client";

import type React from "react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
  const s = Math.floor(Number(seconds));
  if (s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

const CATEGORY_LABELS: Record<string, string> = {
  call_setup_and_control: "Call Setup & Control",
  call_setup_control: "Call Setup & Control",
  discovery_and_qualification: "Discovery & Qualification",
  discovery_qualification: "Discovery & Qualification",
  active_listening: "Active Listening",
  value_communication: "Value Communication",
  next_steps_and_momentum: "Next Steps & Momentum",
  next_steps_momentum: "Next Steps & Momentum",
  objection_handling: "Objection Handling",
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

export default function CallDetailPage() {
  const params = useParams();
  const callId = params.id as string;

  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------------------------------------- */
  /* Load data */
  /* ------------------------------------------------------------- */
  useEffect(() => {
    async function load() {
      setLoading(true);

      // Try to find by numeric ID first, then fallback to fireflies_id
      let data = null;
      let fetchError = null;

      const numId = parseInt(callId, 10);

      if (!isNaN(numId)) {
        // Primary: Fetch by Supabase numeric ID
        const response = await supabase
          .from("transcripts")
          .select("*")
          .eq("id", numId)
          .single();

        if (response.data) {
          data = response.data;
        } else {
          fetchError = response.error;
        }
      }

      // Fallback: If numeric ID failed or wasn't numeric, try fireflies_id
      if (!data) {
        const { data: ffData, error: ffError } = await supabase
          .from("transcripts")
          .select("*")
          .eq("fireflies_id", callId)
          .single();

        if (ffData) {
          data = ffData;
        } else {
          fetchError = ffError;
        }
      }

      if (fetchError || !data) {
        console.error("Error loading transcript:", fetchError);
        setError("Could not load transcript.");
        setRow(null);
      } else {
        setRow(data);
      }
      setLoading(false);
    }
    load();
  }, [callId]);

  /* ------------------------------------------------------------- */
  /* Loading + Error states */
  /* ------------------------------------------------------------- */
  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading call details…</p>
            </div>
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
  /* Extract row fields */
  /* ------------------------------------------------------------- */

  const duration = formatDurationSeconds(row.duration);
  const createdAt = formatDate(row.created_at);
  const attendees = (row.meeting_attendees as any[]) ?? [];
  const timeline = (row.meeting_attendance as any[]) ?? [];
  const sentences = (row.sentences as any[]) ?? [];

  const aiOverallScore = row.ai_overall_score ?? null;
  const aiSummary = row.ai_summary ?? null;
  const aiCategoryBreakdown = row.ai_category_breakdown ?? {};
  const aiWhatWorked = row.ai_what_worked ?? [];
  const aiImprovement = row.ai_improvement_areas ?? [];
  const aiMissed = row.ai_missed_opportunities ?? [];
  const aiQuestions = row.ai_questions ?? [];
  const aiQualGaps = row.ai_qualification_gaps ?? [];
  const aiNextPlan = row.ai_next_call_game_plan ?? [];
  const aiRisks = row.ai_deal_risk_alerts ?? [];

  const categoryEntries = Object.entries(aiCategoryBreakdown);

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
              HEADER WITH SCORE
          ============================================================ */}
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">{row.title}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{createdAt}</span>
                <span>·</span>
                <span>{duration}</span>
              </div>
              {row.fireflies_id && (
                <p className="text-xs text-muted-foreground/60">
                  ID: {row.fireflies_id}
                </p>
              )}
            </div>

            {aiOverallScore !== null && (
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
            )}
          </div>

          {/* ============================================================
              AI SUMMARY
          ============================================================ */}
          {aiSummary && (
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
          )}

          {/* ============================================================
              CATEGORY BREAKDOWN
          ============================================================ */}
          {categoryEntries.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconTrendingUp className="h-5 w-5 text-indigo-500" />
                Performance Breakdown
              </h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryEntries.map(([key, value]: any, index: number) => {
                  const score = value.score ?? 0;
                  const reason = value.reason ?? "";

                  return (
                    <Card
                      key={index}
                      className="border-border/60 hover:border-border transition-colors"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            {formatCategoryLabel(key)}
                          </CardTitle>
                          <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
                            {score}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Progress
                          value={score}
                          className={`h-2 ${score >= 80 ? "[&>div]:bg-emerald-500" : score >= 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-rose-500"}`}
                        />
                        {reason && (
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {reason}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================
              WHAT WORKED
          ============================================================ */}
          {aiWhatWorked.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconCheck className="text-emerald-500 h-5 w-5" />
                What Worked Well
              </h2>

              <div className="space-y-3">
                {aiWhatWorked.map((item: any, i: number) => {
                  // Handle both string format and object format
                  const isString = typeof item === "string";
                  const content = isString ? item : item.behavior_skill || item.text || "";
                  const explanation = isString ? null : item.explanation;
                  const quote = isString ? null : item.quote;

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
                          <div className="space-y-2">
                            <p className="text-sm leading-relaxed">{content}</p>
                            {quote && (
                              <blockquote className="text-xs text-muted-foreground italic border-l-2 border-emerald-300 pl-3">
                                "{quote}"
                              </blockquote>
                            )}
                            {explanation && (
                              <p className="text-xs text-muted-foreground">{explanation}</p>
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
                {aiImprovement.map((item: any, i: number) => (
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================
              MISSED OPPORTUNITIES
          ============================================================ */}
          {aiMissed.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconTarget className="h-5 w-5 text-purple-500" />
                Missed Opportunities
              </h2>

              <div className="space-y-4">
                {aiMissed.map((item: any, i: number) => (
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
                      {(item.what_you_should_have_done || item.what_you_could_have_done) && (
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                            What You Should Have Done
                          </p>
                          <p className="text-purple-800 dark:text-purple-200">
                            {item.what_you_should_have_done || item.what_you_could_have_done}
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
                {aiQualGaps.map((item: any, i: number) => (
                  <Card
                    key={i}
                    className="border-indigo-200/50 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/10"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                        {item.element || item.framework_element || `Gap ${i + 1}`}
                      </CardTitle>
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
                ))}
              </div>
            </div>
          )}

          {/* ============================================================
              NEXT CALL GAME PLAN
          ============================================================ */}
          {aiNextPlan.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconShieldCheck className="h-5 w-5 text-emerald-500" />
                Next Call Game Plan
              </h2>

              <div className="space-y-3">
                {aiNextPlan.map((item: any, i: number) => (
                  <Card
                    key={i}
                    className="border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10"
                  >
                    <CardContent className="pt-4">
                      <div className="flex gap-3">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          {i + 1}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">{item.action}</p>
                          {item.why && (
                            <p className="text-sm text-muted-foreground">{item.why}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================
              DEAL RISK ALERTS
          ============================================================ */}
          {aiRisks.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-rose-500" />
                Deal Risk Alerts
              </h2>

              <div className="space-y-4">
                {aiRisks.map((item: any, i: number) => (
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
                      {(item.why_it_is_a_risk || item.what_this_means) && (
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                            Why It's a Risk
                          </p>
                          <p>{item.why_it_is_a_risk || item.what_this_means}</p>
                        </div>
                      )}
                      {(item.how_to_fix_it || item.how_to_address_it) && (
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                            How to Address
                          </p>
                          <p className="text-rose-800 dark:text-rose-200">
                            {item.how_to_fix_it || item.how_to_address_it}
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
              TRANSCRIPT
          ============================================================ */}
          {sentences.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Full Transcript</h2>

              <div className="space-y-2">
                {(expanded ? sentences : sentences.slice(0, 15)).map(
                  (s: any, i: number) => (
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
                  )
                )}
              </div>

              {sentences.length > 15 && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpanded(!expanded)}
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
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
