import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  ContextObject,
  CallSummary,
  CompanyProfile,
  UserProfile,
  CallType,
} from "@/types/extraction-outputs";

// Lazy-loaded admin Supabase client for server-side operations
let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdminInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Supabase environment variables are not configured");
    }

    supabaseAdminInstance = createClient(url, key);
  }
  return supabaseAdminInstance;
}

/**
 * Query previous call summaries for the same company
 * Returns the last 5 calls (excluding the current one)
 */
async function fetchPreviousCalls(
  companyId: string | null,
  currentTranscriptId: number
): Promise<CallSummary[]> {
  if (!companyId) {
    console.log("[ContextLoader] No company ID provided, skipping previous calls");
    return [];
  }

  try {
    // First get transcript IDs for this company
    const { data: companyCalls, error: companyCallsError } = await getSupabaseAdmin()
      .from("external_org_calls")
      .select("transcript_id, created_at")
      .eq("company_id", companyId)
      .neq("transcript_id", currentTranscriptId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (companyCallsError) {
      console.error("[ContextLoader] Error fetching company calls:", companyCallsError);
      return [];
    }

    if (!companyCalls || companyCalls.length === 0) {
      console.log("[ContextLoader] No previous calls found for company:", companyId);
      return [];
    }

    // Fetch transcript details
    const transcriptIds = companyCalls.map((c) => c.transcript_id);
    const { data: transcripts, error: transcriptsError } = await getSupabaseAdmin()
      .from("transcripts")
      .select("id, title, ai_summary, ai_overall_score, created_at, ai_deal_signal")
      .in("id", transcriptIds);

    if (transcriptsError) {
      console.error("[ContextLoader] Error fetching transcripts:", transcriptsError);
      return [];
    }

    const callSummaries: CallSummary[] = (transcripts || []).map((t) => ({
      transcript_id: t.id,
      title: t.title || undefined,
      summary: t.ai_summary || undefined,
      overall_score: t.ai_overall_score || undefined,
      deal_signal: t.ai_deal_signal || undefined,
      created_at: t.created_at,
    }));

    console.log(`[ContextLoader] Found ${callSummaries.length} previous calls for company ${companyId}`);
    return callSummaries;
  } catch (error) {
    console.error("[ContextLoader] Error in fetchPreviousCalls:", error);
    return [];
  }
}

/**
 * Load company profile from companies table
 */
async function fetchCompanyProfile(companyId: string | null): Promise<CompanyProfile | null> {
  if (!companyId) {
    console.log("[ContextLoader] No company ID provided, skipping company profile");
    return null;
  }

  try {
    const { data: company, error } = await getSupabaseAdmin()
      .from("external_org")
      .select("id, company_name, domain, pain_points, company_contacts, company_goal_objective")
      .eq("id", companyId)
      .single();

    if (error) {
      console.error("[ContextLoader] Error fetching company:", error);
      return null;
    }

    if (!company) {
      console.log("[ContextLoader] No company found for ID:", companyId);
      return null;
    }

    // Safely handle company_contacts - might be array, object, or null
    let contacts: CompanyProfile["contacts"] = undefined;
    if (company.company_contacts && Array.isArray(company.company_contacts)) {
      contacts = company.company_contacts.map((c: { name?: string; email?: string; title?: string }) => ({
        name: c.name,
        email: c.email,
        title: c.title,
      }));
    }

    const profile: CompanyProfile = {
      id: company.id,
      company_name: company.company_name,
      domain: company.domain || undefined,
      pain_points: company.pain_points || undefined,
      contacts,
      company_goal_objective: company.company_goal_objective || undefined,
    };

    console.log(`[ContextLoader] Loaded company profile: ${profile.company_name}`);
    return profile;
  } catch (error) {
    console.error("[ContextLoader] Error in fetchCompanyProfile:", error);
    return null;
  }
}

/**
 * Fetch user's team role via team_org + team_roles
 */
async function fetchUserTeamRoles(userId: string): Promise<UserProfile["team_roles"]> {
  try {
    // Get user's active team membership with role info
    const { data: membership, error: membershipError } = await getSupabaseAdmin()
      .from("team_org")
      .select("team_role_id, is_sales_manager, team_roles(role_name, description)")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      console.log("[ContextLoader] User has no active team membership:", membershipError?.message);
      return undefined;
    }

    const role = (membership as any).team_roles;
    if (!role) {
      console.log("[ContextLoader] No role found for user membership");
      return undefined;
    }

    console.log(`[ContextLoader] Found role for user: ${role.role_name}`);

    return [{
      role_name: role.role_name,
      role_type: "role" as const,
      description: role.description || undefined,
    }];
  } catch (error) {
    console.error("[ContextLoader] Error in fetchUserTeamRoles:", error);
    return undefined;
  }
}

/**
 * Load user's business profile (ICP, products, personas, etc.)
 * Note: The users table stores sales_motion and framework directly, not in a business_profile JSONB
 */
async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data: user, error } = await getSupabaseAdmin()
      .from("users")
      .select("sales_motion, framework")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("[ContextLoader] Error fetching user:", error);
      return null;
    }

    // Fetch team roles for this user
    const teamRoles = await fetchUserTeamRoles(userId);

    // If user has no relevant profile data and no team roles, return null
    if (!user?.sales_motion && !teamRoles) {
      console.log("[ContextLoader] No profile data found for user:", userId);
      return null;
    }

    // Build minimal profile from available data
    const profile: UserProfile = {
      sales_motion: user?.sales_motion || undefined,
      team_roles: teamRoles,
    };

    console.log("[ContextLoader] Loaded user profile with available data");
    return profile;
  } catch (error) {
    console.error("[ContextLoader] Error in fetchUserProfile:", error);
    return null;
  }
}

/**
 * Get company ID from a transcript via company_calls table
 */
async function getCompanyIdForTranscript(transcriptId: number): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("external_org_calls")
      .select("company_id")
      .eq("transcript_id", transcriptId)
      .limit(1)
      .single();

    if (error || !data) {
      console.log("[ContextLoader] No company associated with transcript:", transcriptId);
      return null;
    }

    return data.company_id;
  } catch (error) {
    console.error("[ContextLoader] Error getting company ID:", error);
    return null;
  }
}

/**
 * Get the user ID who owns a transcript
 */
async function getUserIdForTranscript(transcriptId: number): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("transcripts")
      .select("user_id")
      .eq("id", transcriptId)
      .single();

    if (error || !data) {
      console.error("[ContextLoader] Error getting user ID for transcript:", error);
      return null;
    }

    return data.user_id;
  } catch (error) {
    console.error("[ContextLoader] Error in getUserIdForTranscript:", error);
    return null;
  }
}

/**
 * Detect call type based on context
 * For now, default to discovery. Future: use AI classification
 */
function detectCallType(
  previousCalls: CallSummary[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _company: CompanyProfile | null
): CallType | undefined {
  // If there are previous calls with this company, it's likely a follow-up
  if (previousCalls.length > 0) {
    return "followup";
  }

  // Default to discovery for first interactions
  return "discovery";
}

// ---------------------------------------------------------------------------
// Enriched Context Types & Helpers
// ---------------------------------------------------------------------------

export interface EnrichedContext extends ContextObject {
  company_info?: { value_proposition?: string; company_url?: string };
  products_and_services?: Array<any>;
  products_and_services_formatted?: string;
  icp?: {
    industry?: string;
    company_size?: string;
    tech_stack?: string;
    sales_motion?: string;
    region?: string;
  };
  buyer_personas?: Array<any>;
  buyer_personas_formatted?: string;
  extracted?: {
    pain_points_formatted?: string;
    goals_formatted?: string;
    job_titles_formatted?: string;
    responsibilities_formatted?: string;
  };
  rep_focus_areas?: any;
  rep_key_strengths?: any;
  rep_ai_recommendations?: any;
}

/**
 * Fetch ICP, products, and buyer persona data from company_icp table.
 * Returns null when no row exists for the given company.
 */
async function fetchICPData(
  companyId: string | null
): Promise<{
  company_info: any;
  products_and_services: any;
  ideal_customer_profile: any;
  buyer_personas: any;
} | null> {
  if (!companyId) {
    console.log("[ContextLoader] No company ID provided, skipping ICP data");
    return null;
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("external_org_icp")
      .select("company_info, products_and_services, ideal_customer_profile, buyer_personas")
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[ContextLoader] Error fetching ICP data:", error);
      return null;
    }

    if (!data) {
      console.log("[ContextLoader] No ICP data found for company:", companyId);
      return null;
    }

    console.log("[ContextLoader] Loaded ICP data for company:", companyId);

    // Parse JSONB fields if they arrive as strings
    const parse = (val: any) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    };

    return {
      company_info: parse(data.company_info),
      products_and_services: parse(data.products_and_services),
      ideal_customer_profile: parse(data.ideal_customer_profile),
      buyer_personas: parse(data.buyer_personas),
    };
  } catch (error) {
    console.error("[ContextLoader] Error in fetchICPData:", error);
    return null;
  }
}

/**
 * Fetch extended rep profile fields from the users table.
 * These columns (focus_areas, key_strengths, ai_recommendations) may not exist yet
 * in the DB schema. The function gracefully returns null if the query fails.
 */
async function fetchRepExtendedProfile(
  userId: string | null
): Promise<{
  focus_areas: any;
  key_strengths: any;
  ai_recommendations: any;
} | null> {
  if (!userId) {
    console.log("[ContextLoader] No user ID provided, skipping extended profile");
    return null;
  }

  try {
    // Query only columns we know exist. The extended columns (focus_areas,
    // key_strengths, ai_recommendations) will be added via migration 005.
    // Until then, this query will simply return null for those fields.
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .select("sales_motion, framework")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.log("[ContextLoader] No extended profile found for user:", userId);
      return null;
    }

    // Try to fetch the extended columns separately - they may not exist yet
    const { data: extData } = await getSupabaseAdmin()
      .from("users")
      .select("focus_areas, key_strengths, ai_recommendations")
      .eq("id", userId)
      .single();

    // If the extended columns don't exist, extData will be null or the query errors
    console.log("[ContextLoader] Loaded extended rep profile for user:", userId);
    return {
      focus_areas: extData?.focus_areas ?? null,
      key_strengths: extData?.key_strengths ?? null,
      ai_recommendations: extData?.ai_recommendations ?? null,
    };
  } catch (error) {
    // Graceful degradation - these columns may not exist yet
    console.log("[ContextLoader] Extended profile columns not available yet (expected before migration):", (error as Error)?.message);
    return null;
  }
}

export interface LoadContextParams {
  transcriptId: number;
  companyId?: string;
  userId?: string;
}

/**
 * Main context loader function
 * Packages all historical context for AI agents
 */
export async function loadContext(params: LoadContextParams): Promise<ContextObject> {
  const { transcriptId, companyId: providedCompanyId, userId: providedUserId } = params;

  console.log("[ContextLoader] Loading context for transcript:", transcriptId);

  // Get company ID if not provided
  const companyId = providedCompanyId ?? await getCompanyIdForTranscript(transcriptId);

  // Get user ID if not provided
  const userId = providedUserId ?? await getUserIdForTranscript(transcriptId);

  // Load all context in parallel for performance
  const [previousCalls, company, userProfile] = await Promise.all([
    fetchPreviousCalls(companyId, transcriptId),
    fetchCompanyProfile(companyId),
    userId ? fetchUserProfile(userId) : Promise.resolve(null),
  ]);

  // Detect call type based on context
  const callType = detectCallType(previousCalls, company);

  const context: ContextObject = {
    previous_calls: previousCalls,
    company,
    user_profile: userProfile,
    call_type: callType,
  };

  console.log("[ContextLoader] Context loaded:", {
    previousCallsCount: previousCalls.length,
    hasCompany: !!company,
    hasUserProfile: !!userProfile,
    callType,
  });

  return context;
}

/**
 * Format context object into a string for AI prompts
 */
export function formatContextForPrompt(context: ContextObject): string {
  let formatted = "## HISTORICAL CONTEXT\n\n";

  // Previous calls
  if (context.previous_calls.length > 0) {
    formatted += "### Previous Calls with This Company\n";
    context.previous_calls.forEach((call, index) => {
      formatted += `\n**Call ${index + 1}** (${call.created_at})\n`;
      if (call.title) formatted += `- Title: ${call.title}\n`;
      if (call.overall_score !== undefined) formatted += `- Score: ${call.overall_score}/100\n`;
      if (call.deal_signal) formatted += `- Deal Signal: ${call.deal_signal}\n`;
      if (call.summary) formatted += `- Summary: ${call.summary}\n`;
    });
    formatted += "\n";
  } else {
    formatted += "### Previous Calls\nThis is the first call with this company.\n\n";
  }

  // Company profile
  if (context.company) {
    formatted += "### Company Profile\n";
    formatted += `- Name: ${context.company.company_name}\n`;
    if (context.company.domain) formatted += `- Domain: ${context.company.domain}\n`;
    if (context.company.company_goal_objective) {
      formatted += `- Goal/Objective: ${context.company.company_goal_objective}\n`;
    }
    if (context.company.pain_points && context.company.pain_points.length > 0) {
      formatted += "- Known Pain Points:\n";
      context.company.pain_points.forEach((pp) => {
        formatted += `  - ${pp}\n`;
      });
    }
    if (context.company.contacts && context.company.contacts.length > 0) {
      formatted += "- Contacts:\n";
      context.company.contacts.forEach((c) => {
        formatted += `  - ${c.name || "Unknown"}`;
        if (c.title) formatted += ` (${c.title})`;
        if (c.email) formatted += ` - ${c.email}`;
        formatted += "\n";
      });
    }
    formatted += "\n";
  }

  // User profile / business context
  if (context.user_profile) {
    const up = context.user_profile;
    formatted += "### Rep's Business Context\n";

    // Team roles - CRITICAL FOR SCORING CONTEXT
    if (up.team_roles && up.team_roles.length > 0) {
      formatted += "**Rep's Roles:**\n";

      const systemRoles = up.team_roles.filter(t => t.role_type === "role");
      const customRoles = up.team_roles.filter(t => t.role_type === "department");

      if (systemRoles.length > 0) {
        formatted += "- System Role: ";
        systemRoles.forEach((role, index) => {
          formatted += role.role_name;
          if (role.description) formatted += ` (${role.description})`;
          if (index < systemRoles.length - 1) formatted += ", ";
        });
        formatted += "\n";
      }

      if (customRoles.length > 0) {
        formatted += "- Custom Role(s): ";
        customRoles.forEach((role, index) => {
          formatted += role.role_name;
          if (role.description) formatted += ` (${role.description})`;
          if (index < customRoles.length - 1) formatted += ", ";
        });
        formatted += "\n";
      }

      formatted += "\n**Important:** When scoring this call, consider the rep's role. Different roles have different expectations:\n";
      formatted += "- HR reps may focus more on people and culture topics\n";
      formatted += "- Sales reps should excel at objection handling and closing techniques\n";
      formatted += "- Engineering reps may dive deeper into technical details\n";
      formatted += "- Customer Success reps prioritize relationship building and support\n";
      formatted += "Adjust your scoring criteria and feedback based on their specific role context.\n\n";
    }

    if (up.elevator_pitch) {
      formatted += `**Value Proposition:** ${up.elevator_pitch}\n\n`;
    }

    if (up.sales_motion) {
      formatted += `**Sales Motion:** ${up.sales_motion}\n\n`;
    }

    if (up.products && up.products.length > 0) {
      formatted += "**Products/Services:**\n";
      up.products.forEach((p) => {
        formatted += `- ${p.name}`;
        if (p.description) formatted += `: ${p.description}`;
        formatted += "\n";
      });
      formatted += "\n";
    }

    if (up.icp) {
      formatted += "**Ideal Customer Profile:**\n";
      if (up.icp.industries?.length) formatted += `- Industries: ${up.icp.industries.join(", ")}\n`;
      if (up.icp.company_size?.length) formatted += `- Company Size: ${up.icp.company_size.join(", ")}\n`;
      if (up.icp.regions?.length) formatted += `- Regions: ${up.icp.regions.join(", ")}\n`;
      formatted += "\n";
    }

    if (up.buyer_personas && up.buyer_personas.length > 0) {
      formatted += "**Buyer Personas:**\n";
      up.buyer_personas.forEach((p) => {
        formatted += `- ${p.role}`;
        if (p.notes) formatted += `: ${p.notes}`;
        formatted += "\n";
      });
      formatted += "\n";
    }

    if (up.talk_tracks && up.talk_tracks.length > 0) {
      formatted += "**Key Talk Tracks:**\n";
      up.talk_tracks.forEach((t) => {
        formatted += `- ${t}\n`;
      });
      formatted += "\n";
    }

    if (up.objection_handling && up.objection_handling.length > 0) {
      formatted += "**Common Objections & Rebuttals:**\n";
      up.objection_handling.forEach((o) => {
        formatted += `- "${o.objection}" → "${o.rebuttal}"\n`;
      });
      formatted += "\n";
    }
  }

  // Call type context
  if (context.call_type) {
    formatted += `### Call Type: ${context.call_type.toUpperCase()}\n`;
    switch (context.call_type) {
      case "discovery":
        formatted += "This is a discovery call - focus on understanding pain points and qualifying the opportunity.\n";
        break;
      case "followup":
        formatted += "This is a follow-up call - build on previous context and advance the deal.\n";
        break;
      case "demo":
        formatted += "This is a demo call - focus on value communication and addressing concerns.\n";
        break;
      case "closing":
        formatted += "This is a closing call - focus on handling objections and securing next steps.\n";
        break;
    }
  }

  return formatted;
}

// ---------------------------------------------------------------------------
// Enriched Context Loader
// ---------------------------------------------------------------------------

/**
 * Load enriched context that includes all base context PLUS ICP data,
 * products/services, buyer personas, and extended rep profile fields.
 *
 * Same signature as loadContext but returns an EnrichedContext.
 */
export async function loadEnrichedContext(
  params: LoadContextParams
): Promise<EnrichedContext> {
  const { transcriptId, companyId: providedCompanyId, userId: providedUserId } = params;

  console.log("[ContextLoader] Loading enriched context for transcript:", transcriptId);

  // Resolve IDs if not provided
  const companyId = providedCompanyId ?? (await getCompanyIdForTranscript(transcriptId));
  const userId = providedUserId ?? (await getUserIdForTranscript(transcriptId));

  // Load ALL data in parallel -- existing fetches + new enrichment fetches
  const [previousCalls, company, userProfile, icpData, repExtended] = await Promise.all([
    fetchPreviousCalls(companyId, transcriptId),
    fetchCompanyProfile(companyId),
    userId ? fetchUserProfile(userId) : Promise.resolve(null),
    fetchICPData(companyId),
    fetchRepExtendedProfile(userId),
  ]);

  // Detect call type
  const callType = detectCallType(previousCalls, company);

  // Start with the base context fields
  const enriched: EnrichedContext = {
    previous_calls: previousCalls,
    company,
    user_profile: userProfile,
    call_type: callType,
  };

  // --- Merge ICP data ---
  if (icpData) {
    // Company info
    if (icpData.company_info) {
      enriched.company_info = {
        value_proposition: icpData.company_info.value_proposition ?? undefined,
        company_url: icpData.company_info.company_url ?? icpData.company_info.url ?? undefined,
      };
    }

    // Products & services
    if (Array.isArray(icpData.products_and_services)) {
      enriched.products_and_services = icpData.products_and_services;
      enriched.products_and_services_formatted = icpData.products_and_services
        .map((p: any, i: number) => {
          const name = p.name ?? p.title ?? `Product ${i + 1}`;
          const desc = p.description ?? p.summary ?? "";
          return desc ? `- ${name}: ${desc}` : `- ${name}`;
        })
        .join("\n");
    }

    // Ideal Customer Profile
    if (icpData.ideal_customer_profile) {
      const icp = icpData.ideal_customer_profile;
      enriched.icp = {
        industry: icp.industry ?? icp.industries ?? undefined,
        company_size: icp.company_size ?? undefined,
        tech_stack: icp.tech_stack ?? undefined,
        sales_motion: icp.sales_motion ?? undefined,
        region: icp.region ?? icp.regions ?? undefined,
      };
    }

    // Buyer personas
    if (Array.isArray(icpData.buyer_personas)) {
      enriched.buyer_personas = icpData.buyer_personas;
      enriched.buyer_personas_formatted = icpData.buyer_personas
        .map((bp: any) => {
          const role = bp.role ?? bp.title ?? "Unknown Role";
          const notes = bp.notes ?? bp.description ?? "";
          return notes ? `- ${role}: ${notes}` : `- ${role}`;
        })
        .join("\n");

      // Extract structured data from personas if available
      const painPoints: string[] = [];
      const goals: string[] = [];
      const jobTitles: string[] = [];
      const responsibilities: string[] = [];

      for (const bp of icpData.buyer_personas) {
        if (bp.pain_points) {
          const pts = Array.isArray(bp.pain_points) ? bp.pain_points : [bp.pain_points];
          painPoints.push(...pts.map(String));
        }
        if (bp.goals) {
          const gs = Array.isArray(bp.goals) ? bp.goals : [bp.goals];
          goals.push(...gs.map(String));
        }
        if (bp.job_title || bp.title || bp.role) {
          jobTitles.push(String(bp.job_title ?? bp.title ?? bp.role));
        }
        if (bp.responsibilities) {
          const rs = Array.isArray(bp.responsibilities) ? bp.responsibilities : [bp.responsibilities];
          responsibilities.push(...rs.map(String));
        }
      }

      enriched.extracted = {
        pain_points_formatted: painPoints.length > 0 ? painPoints.map((p) => `- ${p}`).join("\n") : undefined,
        goals_formatted: goals.length > 0 ? goals.map((g) => `- ${g}`).join("\n") : undefined,
        job_titles_formatted: jobTitles.length > 0 ? jobTitles.join(", ") : undefined,
        responsibilities_formatted:
          responsibilities.length > 0 ? responsibilities.map((r) => `- ${r}`).join("\n") : undefined,
      };
    }
  }

  // --- Merge extended rep profile ---
  if (repExtended) {
    enriched.rep_focus_areas = repExtended.focus_areas ?? undefined;
    enriched.rep_key_strengths = repExtended.key_strengths ?? undefined;
    enriched.rep_ai_recommendations = repExtended.ai_recommendations ?? undefined;
  }

  console.log("[ContextLoader] Enriched context loaded:", {
    previousCallsCount: previousCalls.length,
    hasCompany: !!company,
    hasUserProfile: !!userProfile,
    hasICPData: !!icpData,
    hasRepExtended: !!repExtended,
    callType,
  });

  return enriched;
}

// ---------------------------------------------------------------------------
// Enriched Context Formatter
// ---------------------------------------------------------------------------

/**
 * Format an EnrichedContext into a prompt string.
 *
 * Extends the base formatContextForPrompt output with additional XML-like
 * tagged sections that downstream extraction agents expect:
 *   <company_profile>, <icp>, <buyer_personas>, <rep_context>
 */
export function formatEnrichedContextForPrompt(context: EnrichedContext): string {
  // Start with the existing base formatting
  let formatted = formatContextForPrompt(context);

  // ---- Company Profile Section ----
  const hasCompanyInfo =
    context.company_info?.value_proposition || context.company_info?.company_url || context.products_and_services_formatted;

  if (hasCompanyInfo) {
    formatted += "\n<company_profile>\n";

    if (context.company_info?.value_proposition) {
      formatted += `Value Proposition: ${context.company_info.value_proposition}\n`;
    }
    if (context.company_info?.company_url) {
      formatted += `Company URL: ${context.company_info.company_url}\n`;
    }
    if (context.products_and_services_formatted) {
      formatted += `Products & Services:\n${context.products_and_services_formatted}\n`;
    }

    formatted += "</company_profile>\n";
  }

  // ---- ICP Section ----
  if (context.icp) {
    const icpEntries: string[] = [];
    if (context.icp.industry) icpEntries.push(`Industry: ${context.icp.industry}`);
    if (context.icp.company_size) icpEntries.push(`Company Size: ${context.icp.company_size}`);
    if (context.icp.tech_stack) icpEntries.push(`Tech Stack: ${context.icp.tech_stack}`);
    if (context.icp.sales_motion) icpEntries.push(`Sales Motion: ${context.icp.sales_motion}`);
    if (context.icp.region) icpEntries.push(`Region: ${context.icp.region}`);

    if (icpEntries.length > 0) {
      formatted += "\n<icp>\n";
      formatted += icpEntries.join("\n") + "\n";
      formatted += "</icp>\n";
    }
  }

  // ---- Buyer Personas Section ----
  const hasBuyerData =
    context.buyer_personas_formatted ||
    context.extracted?.pain_points_formatted ||
    context.extracted?.goals_formatted ||
    context.extracted?.job_titles_formatted ||
    context.extracted?.responsibilities_formatted;

  if (hasBuyerData) {
    formatted += "\n<buyer_personas>\n";

    if (context.buyer_personas_formatted) {
      formatted += `Personas:\n${context.buyer_personas_formatted}\n`;
    }

    if (context.extracted?.pain_points_formatted) {
      formatted += `\nPain Points:\n${context.extracted.pain_points_formatted}\n`;
    }
    if (context.extracted?.goals_formatted) {
      formatted += `\nGoals:\n${context.extracted.goals_formatted}\n`;
    }
    if (context.extracted?.job_titles_formatted) {
      formatted += `\nJob Titles: ${context.extracted.job_titles_formatted}\n`;
    }
    if (context.extracted?.responsibilities_formatted) {
      formatted += `\nResponsibilities:\n${context.extracted.responsibilities_formatted}\n`;
    }

    formatted += "</buyer_personas>\n";
  }

  // ---- Rep Context Section ----
  const formatJsonField = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.map(String).join(', ');
    return JSON.stringify(val);
  };

  const hasRepContext =
    context.rep_focus_areas || context.rep_key_strengths || context.rep_ai_recommendations;

  if (hasRepContext) {
    formatted += "\n<rep_context>\n";

    if (context.rep_focus_areas) {
      formatted += `Focus Areas: ${formatJsonField(context.rep_focus_areas)}\n`;
    }
    if (context.rep_key_strengths) {
      formatted += `Key Strengths: ${formatJsonField(context.rep_key_strengths)}\n`;
    }
    if (context.rep_ai_recommendations) {
      formatted += `AI Recommendations: ${formatJsonField(context.rep_ai_recommendations)}\n`;
    }

    formatted += "</rep_context>\n";
  }

  return formatted;
}
