import { z } from "zod";

// ============================================
// Company Clustering Analysis Schema
// Used for batch analysis of company transcripts
// ============================================

export const ClusteringPatternSchema = z.object({
  pattern_type: z.string(),
  description: z.string(),
  frequency: z.number().optional(),
  examples: z.array(z.string()).optional(),
});
export type ClusteringPattern = z.infer<typeof ClusteringPatternSchema>;

export const ClusteringAnalysisSchema = z.object({
  recommendations: z.array(z.string()).describe("Strategic recommendations for this account"),
  key_strengths: z.array(z.string()).describe("Things going well with this account"),
  focus_areas: z.array(z.string()).describe("Areas needing improvement or attention"),
  relationships: z.array(z.string()).describe("Key relationship dynamics observed"),
  risks: z.array(z.string()).describe("Potential deal risks or concerns"),
  pain_points_objections: z.array(z.string()).describe("Common pain points and objections from this account"),
  patterns: z.array(z.string()).describe("Behavioral or deal patterns across calls").optional(),
});
export type ClusteringAnalysis = z.infer<typeof ClusteringAnalysisSchema>;

// ============================================
// ICP (Ideal Customer Profile) Analysis Schema
// Used for company website scraping and analysis
// ============================================

export const CompanyInfoSchema = z.object({
  name: z.string(),
  industry: z.string().optional(),
  description: z.string().optional(),
  founded_year: z.number().optional(),
  company_size: z.string().optional(),
  headquarters: z.string().optional(),
  mission: z.string().optional(),
  vision: z.string().optional(),
});
export type CompanyInfo = z.infer<typeof CompanyInfoSchema>;

export const ProductServiceSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string().optional(),
  key_features: z.array(z.string()).optional(),
  target_audience: z.string().optional(),
  pricing_model: z.string().optional(),
});
export type ProductService = z.infer<typeof ProductServiceSchema>;

export const IdealCustomerProfileSchema = z.object({
  industries: z.array(z.string()).optional(),
  company_sizes: z.array(z.string()).optional(),
  geographies: z.array(z.string()).optional(),
  job_titles: z.array(z.string()).optional(),
  pain_points: z.array(z.string()).optional(),
  use_cases: z.array(z.string()).optional(),
  budget_range: z.string().optional(),
});
export type IdealCustomerProfile = z.infer<typeof IdealCustomerProfileSchema>;

export const BuyerPersonaSchema = z.object({
  title: z.string(),
  department: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  challenges: z.array(z.string()).optional(),
  decision_criteria: z.array(z.string()).optional(),
  communication_preferences: z.string().optional(),
});
export type BuyerPersona = z.infer<typeof BuyerPersonaSchema>;

export const ObjectionHandlerSchema = z.object({
  objection: z.string(),
  response: z.string(),
  context: z.string().optional(),
  effectiveness: z.enum(["high", "medium", "low"]).optional(),
});
export type ObjectionHandler = z.infer<typeof ObjectionHandlerSchema>;

export const ICPAnalysisSchema = z.object({
  company_info: CompanyInfoSchema,
  products_and_services: z.array(ProductServiceSchema),
  ideal_customer_profile: IdealCustomerProfileSchema,
  buyer_personas: z.array(BuyerPersonaSchema),
  talk_tracks: z.array(z.string()).describe("Key talking points and value propositions"),
  objection_handling: z.array(ObjectionHandlerSchema),
});
export type ICPAnalysis = z.infer<typeof ICPAnalysisSchema>;

// ============================================
// User Recommendations Schema
// Used for personalized coaching insights
// ============================================

export const CoachingInsightSchema = z.object({
  insight_type: z.enum(["strength", "improvement", "trend", "suggestion"]),
  title: z.string(),
  description: z.string(),
  examples: z.array(z.string()).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
});
export type CoachingInsight = z.infer<typeof CoachingInsightSchema>;

export const UserRecommendationsSchema = z.object({
  recommendations: z.array(z.string()).describe("Actionable recommendations for improvement"),
  key_strengths: z.array(z.string()).describe("What this rep does well"),
  focus_areas: z.array(z.string()).describe("Areas to focus on improving"),
  relationships: z.array(z.string()).describe("Relationship management observations"),
  coaching_insights: z.object({
    insights: z.array(CoachingInsightSchema).optional(),
    overall_trend: z.enum(["improving", "stable", "declining"]).optional(),
    suggested_training: z.array(z.string()).optional(),
  }).optional(),
});
export type UserRecommendations = z.infer<typeof UserRecommendationsSchema>;

// ============================================
// Batch Processing Types
// ============================================

export interface BatchJob {
  id: number;
  status: "pending" | "processing" | "completed" | "failed";
  triggered_by: "cron" | "manual";
  total_transcripts: number;
  processed_count: number;
  failed_count: number;
  errors?: Array<{ transcript_id: number; error: string }>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface RecommendationJob {
  id: number;
  job_type: "company_clustering" | "user_recommendations" | "icp_research";
  target_id?: string;
  user_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  total_items: number;
  processed_items: number;
  error_message?: string;
  result?: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// ============================================
// Prompt Cache Types
// ============================================

export interface CachedPrompt {
  transcript_id: number;
  content_hash: string;
  formatted_transcript: string;
  formatted_context: string;
  created_at: string;
  expires_at: string;
}

// ============================================
// API Response Types
// ============================================

export interface BatchScoreResponse {
  success: boolean;
  job_id?: number;
  message?: string;
  stats?: {
    total: number;
    processed: number;
    failed: number;
  };
  error?: string;
}

export interface ClusterResponse {
  success: boolean;
  job_id?: number;
  message?: string;
  companies_processed?: number;
  error?: string;
}

export interface UserRecommendationsResponse {
  success: boolean;
  recommendations?: UserRecommendations;
  last_analyzed_at?: string;
  total_transcripts?: number;
  error?: string;
}

export interface JobProgressResponse {
  job_id: number;
  status: string;
  progress: number;
  total_items: number;
  processed_items: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}
