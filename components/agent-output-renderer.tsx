import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircleIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  TargetIcon,
  LightbulbIcon,
  AlertTriangleIcon,
  StarIcon,
  BookOpenIcon,
  ZapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentOutputRendererProps {
  output: any;
  className?: string;
}

export function AgentOutputRenderer({ output, className }: AgentOutputRendererProps) {
  if (!output || typeof output !== "object") {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No structured output available
      </div>
    );
  }

  // Check if it's a synthesis output
  if (output.executive_summary || output.performance_scorecard) {
    return <SynthesisOutputRenderer output={output} className={className} />;
  }

  // Generic JSON renderer
  return (
    <ScrollArea className={cn("h-[600px]", className)}>
      <pre className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap font-mono">
        {JSON.stringify(output, null, 2)}
      </pre>
    </ScrollArea>
  );
}

function SynthesisOutputRenderer({ output, className }: AgentOutputRendererProps) {
  const {
    executive_summary,
    performance_scorecard,
    cross_analysis_insights,
    prioritized_coaching,
    deal_intelligence,
    development_plan
  } = output;

  return (
    <ScrollArea className={cn("h-[600px] pr-4", className)}>
      <div className="space-y-6">
        {/* Executive Summary */}
        {executive_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StarIcon className="size-5 text-yellow-500" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Call Outcome:</span>
                  <Badge
                    variant={executive_summary.call_outcome === "Advancing" ? "default" : "secondary"}
                    className={cn(
                      executive_summary.call_outcome === "Advancing" && "bg-green-500/10 text-green-600 border-green-500/20"
                    )}
                  >
                    {executive_summary.call_outcome}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Overall Score:</span>
                  <Badge variant="outline" className="text-lg font-bold">
                    {executive_summary.overall_score}/100
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Summary</p>
                <p className="text-sm text-muted-foreground">{executive_summary.one_line_summary}</p>
              </div>

              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <LightbulbIcon className="size-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Key Insight</p>
                    <p className="text-sm text-muted-foreground mt-1">{executive_summary.key_insight}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance Scorecard */}
        {performance_scorecard && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TargetIcon className="size-5 text-blue-500" />
                Performance Scorecard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(performance_scorecard).map(([key, value]) => {
                  const numericValue = typeof value === "number" ? value : 0;
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                        <Badge variant="outline">{numericValue}/10</Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={cn(
                            "h-2 rounded-full transition-all",
                            numericValue >= 8 ? "bg-green-500" : numericValue >= 6 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${numericValue * 10}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cross Analysis Insights */}
        {cross_analysis_insights && cross_analysis_insights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ZapIcon className="size-5 text-purple-500" />
                Cross-Analysis Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cross_analysis_insights.map((insight: any, index: number) => (
                <div key={index} className="border-l-4 border-purple-500/30 pl-4 space-y-2">
                  <p className="text-sm font-medium">{insight.insight}</p>
                  <div className="flex flex-wrap gap-1">
                    {insight.supporting_evidence?.map((evidence: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {evidence}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{insight.significance}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Prioritized Coaching */}
        {prioritized_coaching && prioritized_coaching.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenIcon className="size-5 text-orange-500" />
                Prioritized Coaching Areas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {prioritized_coaching.map((item: any, index: number) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-bold">
                        Priority {item.priority}
                      </Badge>
                      <h4 className="font-semibold">{item.focus_area}</h4>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs font-medium text-red-600">
                        <TrendingDownIcon className="size-3" />
                        Current State
                      </div>
                      <p className="text-sm text-muted-foreground">{item.current_state}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                        <TrendingUpIcon className="size-3" />
                        Target State
                      </div>
                      <p className="text-sm text-muted-foreground">{item.target_state}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium">Action Items</p>
                    <ul className="list-disc list-inside space-y-1">
                      {item.action_items?.map((action: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">{action}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-blue-500/5 border border-blue-500/20 rounded p-2">
                    <p className="text-xs"><span className="font-medium">Expected Impact:</span> {item.expected_impact}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Deal Intelligence */}
        {deal_intelligence && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircleIcon className="size-5 text-blue-500" />
                Deal Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Deal Health:</span>
                <Badge
                  variant={deal_intelligence.deal_health === "Healthy" ? "default" : "destructive"}
                  className={cn(
                    deal_intelligence.deal_health === "Healthy" && "bg-green-500/10 text-green-600 border-green-500/20"
                  )}
                >
                  {deal_intelligence.deal_health}
                </Badge>
              </div>

              {deal_intelligence.key_risks && deal_intelligence.key_risks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                    <AlertTriangleIcon className="size-4" />
                    Key Risks
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {deal_intelligence.key_risks.map((risk: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground">{risk}</li>
                    ))}
                  </ul>
                </div>
              )}

              {deal_intelligence.opportunities && deal_intelligence.opportunities.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                    <CheckCircleIcon className="size-4" />
                    Opportunities
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {deal_intelligence.opportunities.map((opp: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground">{opp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {deal_intelligence.recommended_next_steps && deal_intelligence.recommended_next_steps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Recommended Next Steps</p>
                  <ul className="list-decimal list-inside space-y-1">
                    {deal_intelligence.recommended_next_steps.map((step: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground">{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Development Plan */}
        {development_plan && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUpIcon className="size-5 text-green-500" />
                Development Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {development_plan.immediate_actions && development_plan.immediate_actions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Immediate Actions</p>
                  <ul className="list-disc list-inside space-y-1">
                    {development_plan.immediate_actions.map((action: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground">{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              {development_plan.short_term_focus && development_plan.short_term_focus.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Short-term Focus</p>
                  <ul className="list-disc list-inside space-y-1">
                    {development_plan.short_term_focus.map((focus: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground">{focus}</li>
                    ))}
                  </ul>
                </div>
              )}

              {development_plan.skill_building && development_plan.skill_building.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Skill Building</p>
                  <ul className="list-disc list-inside space-y-1">
                    {development_plan.skill_building.map((skill: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground">{skill}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
