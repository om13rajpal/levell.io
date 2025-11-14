"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  IconCheck,
  IconAlertTriangle,
  IconAlertOctagon,
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function CallDetailPage() {
  const { id } = useParams();
  const [expanded, setExpanded] = useState(false);

  const call = {
    id,
    title: "Quarterly Planning Call with Acme Corp",
    date: "Apr 16, 2025",
    duration: "53m 12s",
    company: "Acme Corp",
    score: 86,
    categoryBreakdown: [
      { name: "Call Setup & Control", value: 35 },
      { name: "Discovery & Qualification", value: 25 },
      { name: "Active Listening", value: 20 },
      { name: "Value Communication", value: 15 },
      { name: "Next Steps & Momentum", value: 12 },
      { name: "Objection Handling", value: 8 },
    ],
    worked: [
      "Opened with clear agenda and confirmed outcomes (00:45)",
      "Mirrored key points around Q2 headcount freeze (12:10)",
      "Quantified impact of delays with concrete metrics (23:44)",
      "Secured multi-thread intro to Ops Lead (47:02)",
    ],
    improvements: [
      "Talk ratio high: 80% to 20%. Use TED questions.",
      "Driving budget too early. Anchor on metrics first.",
    ],
    risks: [
      "Budget freeze acknowledged, no timeline identified.",
      "Ops Lead not engaged yet.",
    ],
    warnings: ["Competing initiative prioritized this quarter."],
    transcript: [
      "<b>Rep:</b> Thanks for joining, today we’ll align on goals and success criteria.",
      "<b>Prospect:</b> Our onboarding is taking 3–4 weeks, which is hurting activation.",
      "<b>Rep:</b> If we reduced that to a week, would that unblock Q2 targets?",
      "<b>Prospect:</b> Yes, especially for enterprise rollouts, approvals slow us down.",
      "<b>Rep:</b> Let’s include Ops and Finance in the next session to cover approvals.",
      "<b>Prospect:</b> Sounds good. That’ll help us move faster.",
      "<b>Rep:</b> Great, I’ll send a summary and schedule follow-up for next Tuesday.",
    ],
  };

  const transcriptPreview = call.transcript.slice(0, 4);
  const showMore = call.transcript.length > transcriptPreview.length;

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="mx-auto w-full max-w-5xl p-6 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {call.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {call.date} · {call.duration} · {call.company}
              </p>
            </div>
            <Badge
              variant="secondary"
              className="text-base px-3 py-1 bg-primary/10 text-primary"
            >
              Score {call.score}
            </Badge>
          </div>

          {/* Category Breakdown */}
          <Card className="border border-border/40 bg-card/50 backdrop-blur-sm shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-foreground">
                Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {call.categoryBreakdown.map((c, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                    <span>{c.name}</span>
                    <span>{c.value}%</span>
                  </div>
                  <Progress value={c.value} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Highlights Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HighlightAlert
              icon={<IconCheck className="h-4 w-4 text-emerald-400" />}
              title="What Worked"
              color="bg-emerald-950/40 border-emerald-900 text-emerald-300"
              items={call.worked}
            />
            <HighlightAlert
              icon={<IconAlertTriangle className="h-4 w-4 text-amber-400" />}
              title="Areas for Improvement"
              color="bg-amber-950/40 border-amber-900 text-amber-300"
              items={call.improvements}
            />
            <HighlightAlert
              icon={<IconAlertOctagon className="h-4 w-4 text-red-400" />}
              title="Critical Risks"
              color="bg-red-950/40 border-red-900 text-red-300"
              items={call.risks}
            />
            <HighlightAlert
              icon={<IconAlertCircle className="h-4 w-4 text-orange-400" />}
              title="Warning Signs"
              color="bg-orange-950/40 border-orange-900 text-orange-300"
              items={call.warnings}
            />
          </div>

          <Separator className="my-6" />

          {/* Transcript */}
          <Card className="border border-border/40 bg-card/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-medium text-foreground">
                Full Transcript
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              {(expanded ? call.transcript : transcriptPreview).map((line, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: line }} />
              ))}

              {showMore && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    onClick={() => setExpanded(!expanded)}
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
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/* === Dark-Themed Highlight Component === */
function HighlightAlert({
  icon,
  title,
  color,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  items: string[];
}) {
  return (
    <Alert
      className={`border ${color} rounded-xl shadow-sm transition-all hover:shadow-md hover:border-foreground/30`}
    >
      <AlertTitle className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </AlertTitle>
      <AlertDescription className="text-sm mt-2 space-y-1.5">
        {items.map((item, i) => (
          <p key={i} className="leading-snug text-muted-foreground">
            • {item}
          </p>
        ))}
      </AlertDescription>
    </Alert>
  );
}