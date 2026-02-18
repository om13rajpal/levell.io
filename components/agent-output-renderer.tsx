import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';
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
  MessageSquareIcon,
  XCircleIcon,
  ClockIcon,
  UserCheckIcon,
  PhoneIcon,
  AwardIcon,
  FlagIcon,
  ListCheckIcon,
  CalendarIcon,
  ArrowRightIcon,
  BarChart3Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentOutputRendererProps {
  output: any;
  className?: string;
}

export function AgentOutputRenderer({ output, className }: AgentOutputRendererProps) {
  // Handle null/undefined output
  if (!output) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No output available
      </div>
    );
  }

  // Handle string outputs (markdown, raw text, or unparsed JSON)
  if (typeof output === "string") {
    // Check if it's markdown (contains headers or lists)
    if (output.includes("##") || output.includes("- **") || output.includes("### ")) {
      return <MarkdownOutputRenderer output={output} className={className} />;
    }

    // Try to display as formatted text with better readability
    return (
      <ScrollArea className={cn("h-[600px]", className)}>
        <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
          {output}
        </div>
      </ScrollArea>
    );
  }

  // Handle object outputs - route to appropriate renderer based on structure
  if (typeof output === "object") {
    if (output.executive_summary || output.performance_scorecard) {
      return <SynthesisOutputRenderer output={output} className={className} />;
    }

    if (output.explicit_pain_points || output.implicit_pain_points) {
      return <PainPointsOutputRenderer output={output} className={className} />;
    }

    if (output.objections && Array.isArray(output.objections)) {
      return <ObjectionsOutputRenderer output={output} className={className} />;
    }

    if (output.engagement_indicators || output.engagement_timeline) {
      return <EngagementOutputRenderer output={output} className={className} />;
    }

    if (output.commitments || output.next_steps || output.follow_up_tasks) {
      return <NextStepsOutputRenderer output={output} className={className} />;
    }

    if (output.call_phases || output.structure_analysis) {
      return <CallStructureOutputRenderer output={output} className={className} />;
    }

    if (output.technique_evaluation || output.communication_assessment) {
      return <RepTechniqueOutputRenderer output={output} className={className} />;
    }

    // Generic JSON renderer for unrecognized structures
    return (
      <ScrollArea className={cn("h-[600px]", className)}>
        <pre className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap font-mono">
          {JSON.stringify(output, null, 2)}
        </pre>
      </ScrollArea>
    );
  }

  // Final fallback
  return (
    <div className={cn("text-sm text-muted-foreground", className)}>
      Unable to render output
    </div>
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

// Pain Points Renderer
function PainPointsOutputRenderer({ output, className }: AgentOutputRendererProps) {
  const { explicit_pain_points, implicit_pain_points, summary } = output;

  return (
    <ScrollArea className={cn("h-[600px] pr-4", className)}>
      <div className="space-y-6">
        {/* Summary */}
        {summary && (
          <Card className="border-2 border-red-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangleIcon className="size-5 text-red-500" />
                Pain Points Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                <p className="text-sm font-medium mb-1">Primary Pain Point</p>
                <p className="text-sm text-muted-foreground">{summary.primary_pain_point}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Pain Points:</span>
                  <Badge variant="outline">{summary.pain_point_count}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Urgency:</span>
                  <Badge variant={summary.overall_urgency === "High" ? "destructive" : "secondary"}>
                    {summary.overall_urgency}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Explicit Pain Points */}
        {explicit_pain_points && explicit_pain_points.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareIcon className="size-5 text-orange-500" />
                Explicit Pain Points
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {explicit_pain_points.map((pain: any, index: number) => (
                <div key={index} className="border-l-4 border-orange-500/30 pl-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{pain.pain_point}</p>
                    <Badge variant={pain.urgency === "High" ? "destructive" : pain.urgency === "Medium" ? "default" : "secondary"} className="text-xs">
                      {pain.urgency}
                    </Badge>
                  </div>
                  {pain.quote && (
                    <blockquote className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3">
                      "{pain.quote}"
                    </blockquote>
                  )}
                  <p className="text-xs text-muted-foreground"><span className="font-medium">Business Impact:</span> {pain.business_impact}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Implicit Pain Points */}
        {implicit_pain_points && implicit_pain_points.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LightbulbIcon className="size-5 text-yellow-500" />
                Implicit Pain Points
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {implicit_pain_points.map((pain: any, index: number) => (
                <div key={index} className="border-l-4 border-yellow-500/30 pl-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{pain.pain_point}</p>
                    <Badge variant={pain.urgency === "High" ? "destructive" : pain.urgency === "Medium" ? "default" : "secondary"} className="text-xs">
                      {pain.urgency}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground"><span className="font-medium">Evidence:</span> {pain.evidence}</p>
                  <p className="text-xs text-muted-foreground"><span className="font-medium">Business Impact:</span> {pain.business_impact}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

// Objections Renderer
function ObjectionsOutputRenderer({ output, className }: AgentOutputRendererProps) {
  const { objections, summary } = output;

  return (
    <ScrollArea className={cn("h-[600px] pr-4", className)}>
      <div className="space-y-6">
        {/* Summary */}
        {summary && (
          <Card className="border-2 border-blue-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircleIcon className="size-5 text-blue-500" />
                Objections Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{summary.total_objections}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Handled Well</p>
                  <p className="text-2xl font-bold text-green-600">{summary.handled_well}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Needs Work</p>
                  <p className="text-2xl font-bold text-yellow-600">{summary.needs_improvement}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Unaddressed</p>
                  <p className="text-2xl font-bold text-red-600">{summary.unaddressed || 0}</p>
                </div>
              </div>
              {summary.primary_objection_type && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm"><span className="font-medium">Primary Type:</span> <Badge variant="outline">{summary.primary_objection_type}</Badge></p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Objections List */}
        {objections && objections.length > 0 && (
          <div className="space-y-4">
            {objections.map((objection: any, index: number) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{objection.objection}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">{objection.category}</Badge>
                      <Badge variant={
                        objection.response_effectiveness === "Effective" ? "default" :
                        objection.response_effectiveness === "Partial" ? "secondary" : "destructive"
                      } className={cn(
                        "text-xs",
                        objection.response_effectiveness === "Effective" && "bg-green-500/10 text-green-600 border-green-500/20"
                      )}>
                        {objection.response_effectiveness}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {objection.quote && (
                    <blockquote className="text-sm text-muted-foreground italic border-l-2 border-muted pl-3">
                      "{objection.quote}"
                    </blockquote>
                  )}
                  {objection.rep_response && (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded p-3">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Rep Response</p>
                      <p className="text-sm text-muted-foreground">{objection.rep_response}</p>
                    </div>
                  )}
                  {objection.suggested_response && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded p-3">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Suggested Response</p>
                      <p className="text-sm text-muted-foreground">{objection.suggested_response}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// Engagement Renderer
function EngagementOutputRenderer({ output, className }: AgentOutputRendererProps) {
  const { engagement_indicators, engagement_timeline, summary } = output;

  return (
    <ScrollArea className={cn("h-[600px] pr-4", className)}>
      <div className="space-y-6">
        {/* Summary */}
        {summary && (
          <Card className="border-2 border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ZapIcon className="size-5 text-purple-500" />
                Engagement Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Engagement Score:</span>
                <Badge variant="outline" className="text-lg font-bold">{summary.overall_engagement_score}/10</Badge>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                  style={{ width: `${summary.overall_engagement_score * 10}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-green-500/10 rounded p-3">
                  <p className="text-xs text-muted-foreground">Buying Signals</p>
                  <p className="text-xl font-bold text-green-600">{summary.buying_signal_count}</p>
                </div>
                <div className="bg-red-500/10 rounded p-3">
                  <p className="text-xs text-muted-foreground">Disengagement</p>
                  <p className="text-xl font-bold text-red-600">{summary.disengagement_signal_count}</p>
                </div>
                <div className="bg-blue-500/10 rounded p-3">
                  <p className="text-xs text-muted-foreground">Trend</p>
                  <p className="text-xl font-bold text-blue-600">{summary.engagement_trend}</p>
                </div>
              </div>
              {summary.key_engagement_moment && (
                <div className="bg-green-500/5 border border-green-500/20 rounded p-3">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Key Engagement Moment</p>
                  <p className="text-sm text-muted-foreground">{summary.key_engagement_moment}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Engagement Timeline */}
        {engagement_timeline && engagement_timeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClockIcon className="size-5 text-blue-500" />
                Engagement Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {engagement_timeline.map((phase: any, index: number) => (
                <div key={index} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "size-10 rounded-full flex items-center justify-center",
                      phase.engagement_level >= 8 ? "bg-green-500/20" : phase.engagement_level >= 6 ? "bg-yellow-500/20" : "bg-red-500/20"
                    )}>
                      <span className="font-bold text-sm">{phase.engagement_level}</span>
                    </div>
                    {index < engagement_timeline.length - 1 && (
                      <div className="w-0.5 h-full bg-muted my-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium">{phase.phase}</p>
                    <p className="text-sm text-muted-foreground mt-1">{phase.notes}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Engagement Indicators */}
        {engagement_indicators && engagement_indicators.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheckIcon className="size-5 text-green-500" />
                Engagement Indicators
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {engagement_indicators.map((indicator: any, index: number) => (
                <div key={index} className={cn(
                  "border-l-4 pl-4 py-2",
                  indicator.sentiment === "Positive" ? "border-green-500/30 bg-green-500/5" :
                  indicator.sentiment === "Negative" ? "border-red-500/30 bg-red-500/5" :
                  "border-gray-500/30 bg-gray-500/5"
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{indicator.type}</Badge>
                      <Badge variant={
                        indicator.significance === "High" ? "destructive" :
                        indicator.significance === "Medium" ? "default" : "secondary"
                      } className="text-xs">
                        {indicator.significance}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="text-xs">{indicator.sentiment}</Badge>
                  </div>
                  <p className="text-sm mt-2">{indicator.indicator}</p>
                  {indicator.quote && (
                    <blockquote className="text-xs text-muted-foreground italic mt-2 border-l-2 border-muted pl-2">
                      "{indicator.quote}"
                    </blockquote>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

// Next Steps Renderer
function NextStepsOutputRenderer({ output, className }: AgentOutputRendererProps) {
  const { commitments, next_steps, follow_up_tasks, summary } = output;

  return (
    <ScrollArea className={cn("h-[600px] pr-4", className)}>
      <div className="space-y-6">
        {/* Summary */}
        {summary && (
          <Card className="border-2 border-green-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlagIcon className="size-5 text-green-500" />
                Next Steps Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Momentum Score:</span>
                  <Badge variant="outline" className="text-lg font-bold">{summary.momentum_score}/10</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Assessment:</span>
                  <Badge variant={summary.momentum_assessment === "Strong Forward" ? "default" : "secondary"} className={cn(
                    summary.momentum_assessment === "Strong Forward" && "bg-green-500/10 text-green-600 border-green-500/20"
                  )}>
                    {summary.momentum_assessment}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className={cn("size-4", summary.clear_next_step ? "text-green-500" : "text-muted-foreground")} />
                  <span className="text-sm">Clear Next Step</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className={cn("size-4", summary.meeting_scheduled ? "text-green-500" : "text-muted-foreground")} />
                  <span className="text-sm">Meeting Scheduled</span>
                </div>
              </div>
              {summary.decision_timeline && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded p-3 mt-3">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Decision Timeline</p>
                  <p className="text-sm text-muted-foreground">{summary.decision_timeline}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Commitments */}
        {commitments && commitments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListCheckIcon className="size-5 text-blue-500" />
                Commitments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {commitments.map((commitment: any, index: number) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{commitment.commitment}</p>
                    <Badge variant={commitment.specificity === "Specific" ? "default" : "secondary"} className="text-xs">
                      {commitment.specificity}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span><span className="font-medium">Owner:</span> {commitment.owner}</span>
                    <span><span className="font-medium">Deadline:</span> {commitment.deadline}</span>
                  </div>
                  {commitment.quote && (
                    <blockquote className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
                      "{commitment.quote}"
                    </blockquote>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        {next_steps && next_steps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightIcon className="size-5 text-green-500" />
                Action Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {next_steps.map((step: any, index: number) => (
                <div key={index} className="flex gap-3">
                  <div className={cn(
                    "size-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                    step.priority === "High" ? "bg-red-500/20 text-red-600" :
                    step.priority === "Medium" ? "bg-yellow-500/20 text-yellow-600" :
                    "bg-blue-500/20 text-blue-600"
                  )}>
                    <span className="text-xs font-bold">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{step.action}</p>
                      <Badge variant={step.priority === "High" ? "destructive" : step.priority === "Medium" ? "default" : "secondary"} className="text-xs">
                        {step.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span><span className="font-medium">Owner:</span> {step.owner}</span>
                      <span><span className="font-medium">Timeline:</span> {step.timeline}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Follow-up Tasks */}
        {follow_up_tasks && follow_up_tasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="size-5 text-purple-500" />
                Follow-up Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {follow_up_tasks.map((task: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
                    <CheckCircleIcon className="size-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm">{task.task}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span><span className="font-medium">Responsible:</span> {task.responsible}</span>
                        <span><span className="font-medium">Due:</span> {task.due}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

// Call Structure Renderer
function CallStructureOutputRenderer({ output, className }: AgentOutputRendererProps) {
  const { call_phases, structure_analysis, summary } = output;

  return (
    <ScrollArea className={cn("h-[600px] pr-4", className)}>
      <div className="space-y-6">
        {/* Summary */}
        {summary && (
          <Card className="border-2 border-indigo-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhoneIcon className="size-5 text-indigo-500" />
                Call Structure Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Structure Score:</span>
                <Badge variant="outline" className="text-lg font-bold">{summary.overall_structure_score}/10</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-500/10 rounded p-3">
                  <p className="text-xs text-muted-foreground">Strongest Phase</p>
                  <p className="text-sm font-bold text-green-600">{summary.strongest_phase}</p>
                </div>
                <div className="bg-red-500/10 rounded p-3">
                  <p className="text-xs text-muted-foreground">Weakest Phase</p>
                  <p className="text-sm font-bold text-red-600">{summary.weakest_phase}</p>
                </div>
              </div>
              <div className="bg-blue-500/5 border border-blue-500/20 rounded p-3">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Flow Assessment</p>
                <p className="text-sm text-muted-foreground">{summary.flow_assessment}</p>
              </div>
              {summary.recommendations && summary.recommendations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Recommendations</p>
                  <ul className="list-disc list-inside space-y-1">
                    {summary.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Call Phases */}
        {call_phases && call_phases.length > 0 && (
          <div className="space-y-4">
            {call_phases.map((phase: any, index: number) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "size-10 rounded-full flex items-center justify-center font-bold",
                        phase.quality_score >= 8 ? "bg-green-500/20 text-green-600" :
                        phase.quality_score >= 6 ? "bg-yellow-500/20 text-yellow-600" :
                        "bg-red-500/20 text-red-600"
                      )}>
                        {phase.quality_score}
                      </div>
                      <div>
                        <CardTitle className="text-base">{phase.phase}</CardTitle>
                        <p className="text-xs text-muted-foreground">{phase.duration_percentage} of call</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {phase.key_observations && phase.key_observations.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-2">Key Observations</p>
                      <ul className="list-disc list-inside space-y-1">
                        {phase.key_observations.map((obs: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {phase.best_practices_followed && phase.best_practices_followed.length > 0 && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded p-3">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">Best Practices Followed</p>
                      <ul className="list-disc list-inside space-y-1">
                        {phase.best_practices_followed.map((practice: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{practice}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {phase.missed_opportunities && phase.missed_opportunities.length > 0 && (
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded p-3">
                      <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-2">Missed Opportunities</p>
                      <ul className="list-disc list-inside space-y-1">
                        {phase.missed_opportunities.map((opp: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{opp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Structure Analysis */}
        {structure_analysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3Icon className="size-5 text-blue-500" />
                Structure Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium">Talk Time Distribution</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Rep</span>
                      <span className="font-mono">{structure_analysis.time_allocation?.rep_talk_time}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: structure_analysis.time_allocation?.rep_talk_time }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Prospect</span>
                      <span className="font-mono">{structure_analysis.time_allocation?.prospect_talk_time}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="h-2 rounded-full bg-green-500" style={{ width: structure_analysis.time_allocation?.prospect_talk_time }} />
                    </div>
                  </div>
                </div>
                {structure_analysis.question_types && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Question Types</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span>Open-ended:</span>
                        <span className="font-bold">{structure_analysis.question_types.open_ended}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Closed:</span>
                        <span className="font-bold">{structure_analysis.question_types.closed_ended}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Probing:</span>
                        <span className="font-bold">{structure_analysis.question_types.probing}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Confirming:</span>
                        <span className="font-bold">{structure_analysis.question_types.confirming}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

// Rep Technique Renderer
function RepTechniqueOutputRenderer({ output, className }: AgentOutputRendererProps) {
  const { technique_evaluation, communication_assessment, strengths, improvement_areas, summary } = output;

  return (
    <ScrollArea className={cn("h-[600px] pr-4", className)}>
      <div className="space-y-6">
        {/* Summary */}
        {summary && (
          <Card className="border-2 border-teal-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AwardIcon className="size-5 text-teal-500" />
                Rep Technique Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Technique Score:</span>
                <Badge variant="outline" className="text-lg font-bold">{summary.overall_technique_score}/10</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-500/10 rounded p-3">
                  <p className="text-xs text-muted-foreground">Top Strength</p>
                  <p className="text-sm font-bold text-green-600">{summary.top_strength}</p>
                </div>
                <div className="bg-yellow-500/10 rounded p-3">
                  <p className="text-xs text-muted-foreground">Priority Improvement</p>
                  <p className="text-sm font-bold text-yellow-600">{summary.priority_improvement}</p>
                </div>
              </div>
              {summary.coaching_focus && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded p-3">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Coaching Focus</p>
                  <p className="text-sm text-muted-foreground">{summary.coaching_focus}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Communication Assessment */}
        {communication_assessment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareIcon className="size-5 text-blue-500" />
                Communication Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(communication_assessment).map(([key, value]) => {
                  const numericValue = typeof value === "number" ? value : 0;
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium capitalize">
                          {key.replace(/_score$/, "").replace(/_/g, " ")}
                        </span>
                        <Badge variant="outline" className="text-xs">{numericValue}/10</Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={cn(
                            "h-2 rounded-full",
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

        {/* Technique Evaluation */}
        {technique_evaluation && technique_evaluation.length > 0 && (
          <div className="space-y-4">
            {technique_evaluation.map((technique: any, index: number) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{technique.technique}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant={technique.usage === "Well Applied" ? "default" : technique.usage === "Partially Applied" ? "secondary" : "outline"} className={cn(
                        "text-xs",
                        technique.usage === "Well Applied" && "bg-green-500/10 text-green-600 border-green-500/20"
                      )}>
                        {technique.usage}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{technique.score}/10</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {technique.examples && technique.examples.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-2">Examples</p>
                      <div className="space-y-2">
                        {technique.examples.map((example: string, idx: number) => (
                          <blockquote key={idx} className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3">
                            {example}
                          </blockquote>
                        ))}
                      </div>
                    </div>
                  )}
                  {technique.coaching_note && (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded p-3">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Coaching Note</p>
                      <p className="text-sm text-muted-foreground">{technique.coaching_note}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Strengths */}
        {strengths && strengths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircleIcon className="size-5 text-green-500" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {strengths.map((strength: any, index: number) => (
                <div key={index} className="border-l-4 border-green-500/30 pl-4 bg-green-500/5 p-3 rounded-r">
                  <p className="text-sm font-medium">{strength.strength}</p>
                  {strength.example && (
                    <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Example:</span> {strength.example}</p>
                  )}
                  {strength.impact && (
                    <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Impact:</span> {strength.impact}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Improvement Areas */}
        {improvement_areas && improvement_areas.length > 0 && (
          <div className="space-y-4">
            {improvement_areas.map((area: any, index: number) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUpIcon className="size-4" />
                    {area.area}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-red-500/5 border border-red-500/20 rounded p-3">
                      <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Current Behavior</p>
                      <p className="text-sm text-muted-foreground">{area.current_behavior}</p>
                    </div>
                    <div className="bg-green-500/5 border border-green-500/20 rounded p-3">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Recommended Behavior</p>
                      <p className="text-sm text-muted-foreground">{area.recommended_behavior}</p>
                    </div>
                  </div>
                  {area.practice_suggestion && (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded p-3">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Practice Suggestion</p>
                      <p className="text-sm text-muted-foreground">{area.practice_suggestion}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// Markdown Renderer (for sales_intelligence)
function MarkdownOutputRenderer({ output, className }: AgentOutputRendererProps) {
  return (
    <ScrollArea className={cn("h-[600px] pr-4", className)}>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{output}</ReactMarkdown>
      </div>
    </ScrollArea>
  );
}
