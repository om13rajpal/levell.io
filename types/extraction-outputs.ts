import { z } from "zod";

// ============================================
// Agent 1: Pain Points Extractor
// ============================================

export const PainPointDepthSchema = z.enum(["surface", "acknowledged", "quantified"]);
export type PainPointDepth = z.infer<typeof PainPointDepthSchema>;

export const PainPointItemSchema = z.object({
  /** Exact quote from the transcript */
  quote: z.string(),
  /** The underlying problem identified */
  pain_point: z.string(),
  /** How deeply the pain was explored */
  depth: PainPointDepthSchema,
  /** What this reveals about their situation */
  analysis: z.string(),
  /** Question to dig deeper next time */
  follow_up_question: z.string(),
});
export type PainPointItem = z.infer<typeof PainPointItemSchema>;

export const PainPointExtractionSchema = z.object({
  items: z.array(PainPointItemSchema),
  score: z.number().min(0).max(100),
  summary: z.string(),
  missed_opportunities: z.array(z.string()).optional(),
  score_rationale: z.string().optional(),
});
export type PainPointExtraction = z.infer<typeof PainPointExtractionSchema>;

// ============================================
// Agent 2: Objections Extractor
// ============================================

export const ObjectionEffectivenessSchema = z.enum(["weak", "adequate", "strong"]);
export type ObjectionEffectiveness = z.infer<typeof ObjectionEffectivenessSchema>;

export const ObjectionItemSchema = z.object({
  /** What the prospect pushed back on */
  objection: z.string(),
  /** Exact quote from transcript */
  quote: z.string(),
  /** How the rep handled it */
  rep_response: z.string(),
  /** How effective was the response */
  effectiveness: ObjectionEffectivenessSchema,
  /** What the rep should have said instead */
  better_response: z.string(),
});
export type ObjectionItem = z.infer<typeof ObjectionItemSchema>;

export const ObjectionExtractionSchema = z.object({
  items: z.array(ObjectionItemSchema),
  score: z.number().min(0).max(100),
  summary: z.string(),
  unaddressed_objections: z.array(z.string()).optional(),
  patterns: z.array(z.string()).optional(),
});
export type ObjectionExtraction = z.infer<typeof ObjectionExtractionSchema>;

// ============================================
// Agent 3: Engagement Scorer
// ============================================

export const EngagementSignalTypeSchema = z.enum(["positive", "negative"]);
export type EngagementSignalType = z.infer<typeof EngagementSignalTypeSchema>;

export const EngagementSignalSchema = z.object({
  type: EngagementSignalTypeSchema,
  /** What happened */
  signal: z.string(),
  /** Exact quote if applicable */
  quote: z.string().optional(),
  /** What this means */
  implication: z.string(),
});
export type EngagementSignal = z.infer<typeof EngagementSignalSchema>;

export const ProspectEnergySchema = z.enum(["low", "neutral", "high"]);
export type ProspectEnergy = z.infer<typeof ProspectEnergySchema>;

export const EngagementScoreSchema = z.object({
  talk_ratio: z.object({
    rep_percent: z.number().min(0).max(100),
    prospect_percent: z.number().min(0).max(100),
  }),
  engagement_signals: z.array(EngagementSignalSchema),
  prospect_energy: ProspectEnergySchema,
  score: z.number().min(0).max(100),
  summary: z.string(),
  energy_shifts: z.array(z.object({
    moment: z.string(),
    direction: z.enum(["up", "down"]),
    trigger: z.string(),
  })).optional(),
  red_flags: z.array(z.string()).optional(),
  rep_adjustments: z.array(z.string()).optional(),
});
export type EngagementScore = z.infer<typeof EngagementScoreSchema>;

// ============================================
// Agent 4: Next Steps Analyzer
// ============================================

export const ActionOwnerSchema = z.enum(["rep", "prospect", "unclear"]);
export type ActionOwner = z.infer<typeof ActionOwnerSchema>;

export const ActionClaritySchema = z.enum(["vague", "specific", "time-bound"]);
export type ActionClarity = z.infer<typeof ActionClaritySchema>;

export const CommittedActionSchema = z.object({
  /** What was agreed */
  action: z.string(),
  /** Who owns the action */
  owner: ActionOwnerSchema,
  /** When it should happen */
  timeline: z.string(),
  /** How clear was the commitment */
  clarity: ActionClaritySchema,
});
export type CommittedAction = z.infer<typeof CommittedActionSchema>;

export const MomentumAssessmentSchema = z.enum(["stalled", "weak", "strong"]);
export type MomentumAssessment = z.infer<typeof MomentumAssessmentSchema>;

export const NextStepsAnalysisSchema = z.object({
  committed_actions: z.array(CommittedActionSchema),
  meeting_scheduled: z.union([
    z.boolean(),
    z.object({
      scheduled: z.boolean(),
      date: z.string().optional(),
      attendees: z.array(z.string()).optional(),
      purpose: z.string().optional(),
    }),
  ]),
  momentum_assessment: MomentumAssessmentSchema,
  score: z.number().min(0).max(100),
  summary: z.string(),
  who_has_the_ball: z.enum(["rep", "prospect", "unclear"]).optional(),
  risk_factors: z.array(z.string()).optional(),
  closing_quote: z.string().optional(),
});
export type NextStepsAnalysis = z.infer<typeof NextStepsAnalysisSchema>;

// ============================================
// Agent 5: Call Structure Reviewer
// ============================================

export const CallPhaseSchema = z.enum(["opener", "agenda", "discovery", "presentation", "close"]);
export type CallPhase = z.infer<typeof CallPhaseSchema>;

export const CallSectionSchema = z.object({
  phase: CallPhaseSchema,
  /** Brief description of what happened */
  what_happened: z.string(),
  /** Positive observation */
  what_worked: z.string().optional(),
  /** Issue if any */
  what_didnt: z.string().optional(),
  /** How to improve */
  suggestion: z.string().optional(),
});
export type CallSection = z.infer<typeof CallSectionSchema>;

export const TimeManagementSchema = z.enum(["rushed", "balanced", "dragged"]);
export type TimeManagement = z.infer<typeof TimeManagementSchema>;

export const CallStructureReviewSchema = z.object({
  sections: z.array(CallSectionSchema),
  agenda_set: z.boolean(),
  transitions_smooth: z.boolean(),
  time_management: TimeManagementSchema,
  score: z.number().min(0).max(100),
  summary: z.string(),
  structure_issues: z.array(z.string()).optional(),
});
export type CallStructureReview = z.infer<typeof CallStructureReviewSchema>;

// ============================================
// Agent 6: Rep Technique Analyzer
// ============================================

export const TechniqueIssueTypeSchema = z.enum([
  "interruption",
  "monologue",
  "missed_follow_up",
  "filler_words",
  "other",
]);
export type TechniqueIssueType = z.infer<typeof TechniqueIssueTypeSchema>;

export const TechniqueIssueSchema = z.object({
  type: TechniqueIssueTypeSchema,
  /** Exact moment from transcript */
  quote: z.string(),
  /** What was happening */
  context: z.string(),
  /** Why this hurts */
  impact: z.string(),
  /** What to do instead */
  suggestion: z.string(),
});
export type TechniqueIssue = z.infer<typeof TechniqueIssueSchema>;

export const TechniqueStrengthTypeSchema = z.enum([
  "active_listening",
  "good_follow_up",
  "clear_articulation",
  "other",
]);
export type TechniqueStrengthType = z.infer<typeof TechniqueStrengthTypeSchema>;

export const TechniqueStrengthSchema = z.object({
  type: TechniqueStrengthTypeSchema,
  /** Exact moment from transcript */
  quote: z.string(),
  /** Why this worked */
  why_effective: z.string(),
});
export type TechniqueStrength = z.infer<typeof TechniqueStrengthSchema>;

export const RepTechniqueAnalysisSchema = z.object({
  issues: z.array(TechniqueIssueSchema),
  strengths: z.array(TechniqueStrengthSchema),
  interruption_count: z.number().min(0),
  average_monologue_length: z.number().min(0), // in seconds
  score: z.number().min(0).max(100),
  summary: z.string(),
  metrics: z.object({
    monologue_count: z.number().optional(),
    longest_monologue: z.number().optional(),
    missed_follow_up_count: z.number().optional(),
    good_follow_up_count: z.number().optional(),
  }).optional(),
  patterns: z.array(z.string()).optional(),
  top_priority_fix: z.string().optional(),
});
export type RepTechniqueAnalysis = z.infer<typeof RepTechniqueAnalysisSchema>;

// ============================================
// Combined Extraction Output
// ============================================

export const AllExtractionsSchema = z.object({
  pain_points: PainPointExtractionSchema,
  objections: ObjectionExtractionSchema,
  engagement: EngagementScoreSchema,
  next_steps: NextStepsAnalysisSchema,
  call_structure: CallStructureReviewSchema,
  rep_technique: RepTechniqueAnalysisSchema,
});
export type AllExtractions = z.infer<typeof AllExtractionsSchema>;

// ============================================
// Deal Signal (shared, defined early for reuse)
// ============================================

export const DealSignalSchema = z.enum(["strong", "positive", "healthy", "at_risk", "critical"]);
export type DealSignal = z.infer<typeof DealSignalSchema>;

// ============================================
// Context Object (from Context Loader)
// ============================================

export const CallSummarySchema = z.object({
  transcript_id: z.number(),
  title: z.string().optional(),
  summary: z.string().optional(),
  overall_score: z.number().optional(),
  deal_signal: DealSignalSchema.optional(),
  created_at: z.string(),
});
export type CallSummary = z.infer<typeof CallSummarySchema>;

export const CompanyProfileSchema = z.object({
  id: z.string(),
  company_name: z.string(),
  domain: z.string().optional(),
  pain_points: z.array(z.string()).optional(),
  contacts: z.array(z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    title: z.string().optional(),
  })).optional(),
  company_goal_objective: z.string().optional(),
});
export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

export const UserProfileSchema = z.object({
  icp: z.object({
    company_size: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    industries: z.array(z.string()).optional(),
    tech_stack: z.array(z.string()).optional(),
  }).optional(),
  products: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
  })).optional(),
  buyer_personas: z.array(z.object({
    role: z.string(),
    notes: z.string().optional(),
  })).optional(),
  talk_tracks: z.array(z.string()).optional(),
  objection_handling: z.array(z.object({
    objection: z.string(),
    rebuttal: z.string(),
  })).optional(),
  elevator_pitch: z.string().optional(),
  sales_motion: z.string().optional(),
  team_roles: z.array(z.object({
    role_name: z.string(),
    role_type: z.enum(["role", "department"]),
    description: z.string().optional(),
  })).optional(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const CallTypeSchema = z.enum(["discovery", "followup", "demo", "closing", "other"]);
export type CallType = z.infer<typeof CallTypeSchema>;

export const ContextObjectSchema = z.object({
  previous_calls: z.array(CallSummarySchema),
  company: CompanyProfileSchema.nullable(),
  user_profile: UserProfileSchema.nullable(),
  call_type: CallTypeSchema.optional(),
});
export type ContextObject = z.infer<typeof ContextObjectSchema>;

// ============================================
// Synthesis Agent Output
// ============================================

export const WhatWorkedItemSchema = z.object({
  moment: z.string(),
  quote: z.string(),
  why_effective: z.string(),
  keep_doing: z.string().optional(),
});
export type WhatWorkedItem = z.infer<typeof WhatWorkedItemSchema>;

export const MissedOpportunitySchema = z.object({
  moment: z.string(),
  prospect_said: z.string().optional(),
  rep_said: z.string().optional(),
  why_it_matters: z.string(),
  what_to_do: z.string(),
  suggested_phrasing: z.string().optional(),
});
export type MissedOpportunity = z.infer<typeof MissedOpportunitySchema>;

export const DealRiskAlertSchema = z.object({
  risk_type: z.string(),
  severity: z.enum(["high", "medium", "low"]).optional(),
  what_happened: z.string(),
  why_risky: z.string(),
  how_to_address: z.string(),
  suggested_question: z.string().optional(),
});
export type DealRiskAlert = z.infer<typeof DealRiskAlertSchema>;

export const PatternToWatchSchema = z.object({
  pattern: z.string(),
  occurrences: z.number(),
  impact: z.string(),
  recommendation: z.string(),
});
export type PatternToWatch = z.infer<typeof PatternToWatchSchema>;

export const NextCallActionSchema = z.object({
  action: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  category: z.enum(["question", "topic", "avoid"]),
  success_criteria: z.string().optional(),
});
export type NextCallAction = z.infer<typeof NextCallActionSchema>;

export const PerformanceBreakdownSchema = z.object({
  pain_points: z.number().min(0).max(100),
  objections: z.number().min(0).max(100),
  engagement: z.number().min(0).max(100),
  next_steps: z.number().min(0).max(100),
  call_structure: z.number().min(0).max(100),
  rep_technique: z.number().min(0).max(100),
});
export type PerformanceBreakdown = z.infer<typeof PerformanceBreakdownSchema>;

export const CoachingReportSchema = z.object({
  what_worked: z.array(WhatWorkedItemSchema),
  missed_opportunities: z.array(MissedOpportunitySchema),
  deal_risk_alerts: z.array(DealRiskAlertSchema),
  patterns_to_watch: z.array(PatternToWatchSchema),
  next_call_game_plan: z.array(NextCallActionSchema),
  performance_breakdown: PerformanceBreakdownSchema,
  overall_score: z.number().min(0).max(100),
  call_summary: z.string(), // 4-5 sentences for DB storage
  deal_signal: DealSignalSchema,
  call_type: z.string().optional(),
  overall_assessment: z.string().optional(),
  deal_signal_reason: z.string().optional(),
  critical_improvements: z.array(z.object({
    area: z.string(),
    issue: z.string(),
    practice_drill: z.string().optional(),
  })).optional(),
  the_one_thing: z.object({
    what: z.string(),
    how: z.string(),
    measure: z.string(),
  }).optional(),
  coaching_notes: z.array(z.string()).optional(),
  rep_scored: z.object({
    name: z.string(),
    email: z.string().optional(),
    transcript_speaker_name: z.string().optional(),
  }).optional(),
});
export type CoachingReport = z.infer<typeof CoachingReportSchema>;

// ============================================
// Full Analysis Result
// ============================================

export const AnalysisResultSchema = z.object({
  transcript_id: z.number(),
  extractions: AllExtractionsSchema,
  coaching_report: CoachingReportSchema,
  processed_at: z.string(),
  processing_time_ms: z.number(),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
