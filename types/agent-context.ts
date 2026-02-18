/**
 * Shared types for AI Agent context
 * Used by InlineAgentPanel, AskAICoach, and related components
 */

// Call context - for individual call/transcript pages
export type CallContext = {
  type: "call";
  transcriptId: number;
  transcriptTitle: string;
  transcriptText?: string;
  aiSummary?: string;
};

// Companies overview context - for companies list page
export type CompaniesContext = {
  type: "companies";
  totalCompanies: number;
  totalCalls: number;
  avgScore: number;
  atRisk: number;
  painPoints?: string[];
  companies?: Array<{
    name: string;
    calls: number;
    score: number | null;
    risk: string;
    lastCall: string;
  }>;
};

// Company detail context - for individual company page
export type CompanyDetailContext = {
  type: "company_detail";
  companyId: number;
  companyName?: string;
  domain?: string;
  industry?: string;
  totalCalls?: number;
  avgScore?: number;
  lastCall?: string;
  primaryContacts?: number;
  painPoints?: string[];
  riskSummary?: string[];
  aiRecommendations?: string[];
  aiRelationship?: string[];
  recentTasks?: string[];
  companyGoal?: string;
};

// Team context - for team management page
export type TeamContext = {
  type: "team";
  teamId: number;
  teamName: string;
  memberCount: number;
  members?: Array<{
    id: string;
    name: string | null;
    email: string;
    role: "admin" | "sales_manager" | "member" | null;
  }>;
  pendingInvitations?: number;
  myStats?: {
    totalCalls: number;
    avgScore: number;
    recentCalls: number;
  };
  coachingNotes?: number;
};

// Calls list context - for calls list page
export type CallsListContext = {
  type: "calls_list";
  totalCalls: number;
  avgScore: number;
  recentCalls?: Array<{
    id: number;
    title: string;
    score: number | null;
    date: string;
    duration: number;
  }>;
  scoreDistribution?: {
    high: number;
    medium: number;
    low: number;
  };
};

// Dashboard context - for main dashboard
export type DashboardContext = {
  type: "dashboard";
  totalCalls: number;
  avgScore: number;
  trend?: number;
  recentActivity?: string[];
};

// Transcript context - for transcript view
export type TranscriptContext = {
  type: "transcript";
  transcriptId?: number;
  transcriptTitle?: string;
  score?: number;
  duration?: string;
};

// Companies list context - simplified companies view
export type CompaniesListContext = {
  type: "companies_list";
  totalCompanies: number;
  avgScore: number;
  recentCompanies?: Array<{
    id: number;
    name: string;
    score: number | null;
    lastCall: string;
  }>;
};

// Union type of all possible agent contexts
export type AgentContext =
  | CallContext
  | CompaniesContext
  | CompanyDetailContext
  | TeamContext
  | CallsListContext
  | DashboardContext
  | TranscriptContext
  | CompaniesListContext;

// Type guard helpers
export function isCallContext(context: AgentContext): context is CallContext {
  return context.type === "call";
}

export function isCompaniesContext(context: AgentContext): context is CompaniesContext {
  return context.type === "companies";
}

export function isCompanyDetailContext(context: AgentContext): context is CompanyDetailContext {
  return context.type === "company_detail";
}

export function isTeamContext(context: AgentContext): context is TeamContext {
  return context.type === "team";
}

export function isCallsListContext(context: AgentContext): context is CallsListContext {
  return context.type === "calls_list";
}

export function isDashboardContext(context: AgentContext): context is DashboardContext {
  return context.type === "dashboard";
}

export function isTranscriptContext(context: AgentContext): context is TranscriptContext {
  return context.type === "transcript";
}

export function isCompaniesListContext(context: AgentContext): context is CompaniesListContext {
  return context.type === "companies_list";
}
