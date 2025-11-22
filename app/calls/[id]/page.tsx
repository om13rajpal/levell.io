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

function formatDurationSeconds(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

const CATEGORY_LABELS: Record<string, string> = {
  call_setup_control: "Call Setup & Control",
  discovery_qualification: "Discovery & Qualification",
  active_listening: "Active Listening",
  value_communication: "Value Communication",
  next_steps_momentum: "Next Steps & Momentum",
  objection_handling: "Objection Handling",
};

function formatCategoryLabel(key: string) {
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------- */

export default function CallDetailPage() {
  const params = useParams();
  const firefliesId = params.id as string;

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
      const { data, error } = await supabase
        .from("transcripts")
        .select("*")
        .eq("fireflies_id", firefliesId)
        .single();

      if (error) {
        console.error(error);
        setError("Could not load transcript.");
        setRow(null);
      } else {
        setRow(data);
      }
      setLoading(false);
    }
    load();
  }, [firefliesId]);

  /* ------------------------------------------------------------- */
  /* Loading + Error states */
  /* ------------------------------------------------------------- */
  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="p-6">Loading call details…</div>
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

        <div className="mx-auto max-w-6xl p-6 space-y-12">
          {/* ============================================================
              HEADER
          ============================================================ */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold">{row.title}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {createdAt} · {duration}
              </p>
              <p className="text-muted-foreground text-xs">
                Fireflies ID: {row.fireflies_id}
              </p>
            </div>

            {aiOverallScore && (
              <div className="text-right">
                <Badge className="bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30">
                  AI Score
                </Badge>
                <div className="text-4xl font-bold mt-1">{aiOverallScore}</div>
                <p className="text-[11px] text-muted-foreground">out of 100</p>
              </div>
            )}
          </div>

          {/* ============================================================
              AI SUMMARY
          ============================================================ */}
          {aiSummary && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconSparkles className="h-5 w-5 text-indigo-500" />
                AI Summary
              </h2>

              <Alert className="bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20 text-sm rounded-xl">
                <AlertDescription className="leading-relaxed">
                  {aiSummary}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* ============================================================
              CATEGORY BREAKDOWN
          ============================================================ */}
          {categoryEntries.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconInfoCircle className="h-5 w-5 text-indigo-500" />
                Category Breakdown
              </h2>

              <div className="grid md:grid-cols-2 gap-5">
                {categoryEntries.map(([key, value]: any, index: number) => {
                  const score = value.score ?? 0;
                  const max = value.max_score ?? 100;
                  const pct = Math.round((score / max) * 100);

                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-indigo-200/40 dark:border-indigo-500/20 bg-indigo-500/5 p-4 space-y-1"
                    >
                      <div className="flex justify-between text-sm font-medium">
                        <span>{formatCategoryLabel(key)}</span>
                        <span className="text-muted-foreground">
                          {score}/{max}
                        </span>
                      </div>

                      <Progress
                        value={pct}
                        className="h-1.5 mt-2 bg-indigo-200/30 dark:bg-indigo-900/30"
                      />
                    </div>
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
                What Worked
              </h2>

              <div className="space-y-3">
                {aiWhatWorked.map((item: any, i: number) => (
                  <Alert
                    key={i}
                    className="bg-emerald-500/5 border border-emerald-200/40 dark:border-emerald-500/20 rounded-xl"
                  >
                    <AlertTitle className="text-emerald-700 dark:text-emerald-300">
                      {item.behavior_skill}
                    </AlertTitle>

                    <AlertDescription className="space-y-2 text-sm">
                      {item.quote && (
                        <blockquote className="text-muted-foreground italic border-l-2 pl-3">
                          “{item.quote}”
                        </blockquote>
                      )}

                      <p>{item.explanation}</p>

                      {item.connection_to_icp && (
                        <p className="text-xs text-muted-foreground">
                          <strong>ICP Tie-in: </strong>
                          {item.connection_to_icp}
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================
              IMPROVEMENT AREAS
          ============================================================ */}
          {aiImprovement.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconAlertTriangle className="text-rose-500 h-5 w-5" />
                Improvement Areas
              </h2>

              <div className="space-y-3">
                {aiImprovement.map((item: any, i: number) => (
                  <Alert
                    key={i}
                    className="bg-rose-500/5 border border-rose-200/40 dark:border-rose-500/20 rounded-xl"
                  >
                    <AlertTitle className="text-rose-700 dark:text-rose-300">
                      {item.category_skill}
                    </AlertTitle>

                    <AlertDescription className="space-y-2 text-sm">
                      <p>
                        <strong>What You Did:</strong> {item.what_you_did}
                      </p>
                      <p>
                        <strong>Why It Didn’t Work:</strong>{" "}
                        {item.why_this_didnt_work}
                      </p>
                      <p>
                        <strong>Do This Instead:</strong>{" "}
                        {item.do_this_instead}
                      </p>
                      <p>
                        <strong>Why It Works:</strong>{" "}
                        {item.why_this_works_better}
                      </p>

                      {item.practice_framework && (
                        <p className="text-xs text-muted-foreground">
                          <strong>Framework:</strong> {item.practice_framework}
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
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
                <IconAlertTriangle className="h-5 w-5 text-amber-500" />
                Missed Opportunities
              </h2>

              <div className="space-y-3">
                {aiMissed.map((item: any, i: number) => (
                  <Alert
                    key={i}
                    className="bg-amber-500/5 border border-amber-200/40 dark:border-amber-500/20 rounded-xl"
                  >
                    <AlertTitle className="text-amber-700 dark:text-amber-300">
                      {item.moment_in_call}
                    </AlertTitle>

                    <AlertDescription className="space-y-2 text-sm">
                      {item.spiced_framework_element && (
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          SPICED: {item.spiced_framework_element}
                        </p>
                      )}

                      <p>
                        <strong>What Happened:</strong> {item.what_happened}
                      </p>

                      <p>
                        <strong>You Could Have Done:</strong>{" "}
                        {item.what_you_could_have_done}
                      </p>

                      <p>
                        <strong>Why It Helps:</strong>{" "}
                        {item.why_this_would_have_been_powerful}
                      </p>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================
              QUESTIONS YOU SHOULD HAVE ASKED
          ============================================================ */}
          {aiQuestions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconInfoCircle className="h-5 w-5 text-sky-500" />
                Questions You Should Have Asked
              </h2>

              <div className="space-y-3">
                {aiQuestions.map((item: any, i: number) => (
                  <Alert
                    key={i}
                    className="bg-sky-500/5 border border-sky-200/40 dark:border-sky-500/20 rounded-xl"
                  >
                    <AlertTitle className="flex justify-between items-center">
                      <span className="text-sky-700 dark:text-sky-300">
                        {item.spiced_framework_element}
                      </span>
                    </AlertTitle>

                    <AlertDescription className="space-y-2 text-sm">
                      <p className="font-medium italic">
                        “{item.exact_question}”
                      </p>
                      <p>{item.why_ask_this}</p>
                    </AlertDescription>
                  </Alert>
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
                <IconInfoCircle className="h-5 w-5 text-indigo-500" />
                Qualification Gaps (SPICED)
              </h2>

              <div className="space-y-3">
                {aiQualGaps.map((item: any, i: number) => (
                  <Alert
                    key={i}
                    className="bg-indigo-500/5 border border-indigo-200/40 dark:border-indigo-500/20 rounded-xl"
                  >
                    <AlertTitle className="text-indigo-700 dark:text-indigo-300">
                      {item.framework_element}
                    </AlertTitle>

                    <AlertDescription className="space-y-2 text-sm">
                      <p>
                        <strong>Missing:</strong> {item.whats_missing}
                      </p>
                      <p>
                        <strong>Ask Next Time:</strong>{" "}
                        {item.how_to_get_it_next_conversation}
                      </p>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================
              NEXT CALL PLAN
          ============================================================ */}
          {aiNextPlan.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <IconCheck className="h-5 w-5 text-emerald-500" />
                Next Call Game Plan
              </h2>

              <div className="space-y-3">
                {aiNextPlan.map((item: any, i: number) => (
                  <Alert
                    key={i}
                    className="bg-emerald-500/5 border border-emerald-200/40 dark:border-emerald-500/20 rounded-xl"
                  >
                    <AlertTitle className="text-emerald-700 dark:text-emerald-300">
                      {item.action}
                    </AlertTitle>
                    <AlertDescription className="text-sm mt-1">
                      {item.why}
                    </AlertDescription>
                  </Alert>
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

              <div className="space-y-3">
                {aiRisks.map((item: any, i: number) => (
                  <Alert
                    key={i}
                    className="bg-rose-500/5 border border-rose-200/40 dark:border-rose-500/20 rounded-xl"
                  >
                    <AlertTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                      {item.flag_icon || "⚠️"}
                      {item.risk_description}
                    </AlertTitle>

                    <AlertDescription className="space-y-2 text-sm">
                      <p>
                        <strong>Meaning:</strong> {item.what_this_means}
                      </p>
                      <p>
                        <strong>How to Address:</strong>{" "}
                        {item.how_to_address_it}
                      </p>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================
              PARTICIPANTS
          ============================================================ */}
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
                  {p.email || p.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* ============================================================
              CALL ASSETS
          ============================================================ */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Call Assets</h2>

            <div className="space-y-2">
              {row.transcript_url && (
                <Button
                  asChild
                  variant="outline"
                  className="justify-start w-full"
                >
                  <a href={row.transcript_url} target="_blank">
                    <IconExternalLink className="h-4 w-4 mr-2" />
                    Fireflies Transcript
                  </a>
                </Button>
              )}

              {row.audio_url && (
                <Button
                  asChild
                  variant="outline"
                  className="justify-start w-full"
                >
                  <a href={row.audio_url} target="_blank">
                    <IconPlayerPlay className="h-4 w-4 mr-2" />
                    Audio Recording
                  </a>
                </Button>
              )}

              {row.video_url && (
                <Button
                  asChild
                  variant="outline"
                  className="justify-start w-full"
                >
                  <a href={row.video_url} target="_blank">
                    <IconVideo className="h-4 w-4 mr-2" />
                    Video Recording
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* ============================================================
              ATTENDANCE TIMELINE (IMPROVED)
          ============================================================ */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Attendance Timeline</h2>

            <div className="relative pl-6 border-l border-indigo-300/40 dark:border-indigo-500/20 space-y-6">

              {timeline.map((t: any, i: number) => (
                <div key={i} className="relative group">

                  {/* Dot */}
                  <div className="absolute -left-[10px] top-1 h-3 w-3 rounded-full border-2 border-indigo-500/70 bg-indigo-500/20"></div>

                  {/* Box */}
                  <div className="rounded-xl bg-indigo-500/5 border border-indigo-200/40 dark:border-indigo-500/20 p-4 transition-all duration-200 group-hover:bg-indigo-500/10">
                    <p className="font-medium text-indigo-700 dark:text-indigo-300">
                      {t.name}
                    </p>

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

          <Separator />

          {/* ============================================================
              TRANSCRIPT
          ============================================================ */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Transcript</h2>

            {(expanded ? sentences : sentences.slice(0, 10)).map(
              (s: any, i: number) => (
                <Alert
                  key={i}
                  className="
                    border rounded-xl p-4 shadow-none transition
                    bg-muted/30 backdrop-blur-sm
                  "
                >
                  <AlertTitle className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {s.speaker_name}
                    </span>

                    <span className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground">
                      {formatTimestamp(s.start_time)}
                    </span>
                  </AlertTitle>

                  <AlertDescription className="mt-2 text-sm leading-relaxed">
                    {s.text}
                  </AlertDescription>
                </Alert>
              )
            )}

            {sentences.length > 10 && (
              <div className="flex justify-center pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs"
                >
                  {expanded ? (
                    <>
                      Show Less <IconChevronUp className="ml-1 h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Show More <IconChevronDown className="ml-1 h-3 w-3" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}