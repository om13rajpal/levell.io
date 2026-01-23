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
  companyId: number | null,
  currentTranscriptId: number
): Promise<CallSummary[]> {
  if (!companyId) {
    console.log("[ContextLoader] No company ID provided, skipping previous calls");
    return [];
  }

  try {
    // First get transcript IDs for this company
    const { data: companyCalls, error: companyCallsError } = await getSupabaseAdmin()
      .from("company_calls")
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
      .select("id, title, ai_summary, ai_overall_score, created_at, call_summary, deal_signal")
      .in("id", transcriptIds);

    if (transcriptsError) {
      console.error("[ContextLoader] Error fetching transcripts:", transcriptsError);
      return [];
    }

    const callSummaries: CallSummary[] = (transcripts || []).map((t) => ({
      transcript_id: t.id,
      title: t.title || undefined,
      summary: t.call_summary || t.ai_summary || undefined,
      overall_score: t.ai_overall_score || undefined,
      deal_signal: t.deal_signal || undefined,
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
async function fetchCompanyProfile(companyId: number | null): Promise<CompanyProfile | null> {
  if (!companyId) {
    console.log("[ContextLoader] No company ID provided, skipping company profile");
    return null;
  }

  try {
    const { data: company, error } = await getSupabaseAdmin()
      .from("companies")
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

    const profile: CompanyProfile = {
      id: company.id,
      company_name: company.company_name,
      domain: company.domain || undefined,
      pain_points: company.pain_points || undefined,
      contacts: company.company_contacts?.map((c: { name?: string; email?: string; title?: string }) => ({
        name: c.name,
        email: c.email,
        title: c.title,
      })) || undefined,
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
 * Fetch user's team tags (system roles and custom roles)
 */
async function fetchUserTeamTags(userId: string): Promise<UserProfile["team_tags"]> {
  try {
    // First, get the user's team_id
    const { data: userData, error: userError } = await getSupabaseAdmin()
      .from("users")
      .select("team_id")
      .eq("id", userId)
      .single();

    if (userError || !userData?.team_id) {
      console.log("[ContextLoader] User has no team or error fetching team:", userError?.message);
      return undefined;
    }

    const teamId = userData.team_id;

    // Get the user's tag assignments
    const { data: memberTags, error: memberTagsError } = await getSupabaseAdmin()
      .from("team_member_tags")
      .select("tag_id")
      .eq("user_id", userId)
      .eq("team_id", teamId);

    if (memberTagsError || !memberTags || memberTags.length === 0) {
      console.log("[ContextLoader] No tags found for user:", userId);
      return undefined;
    }

    const tagIds = memberTags.map((mt) => mt.tag_id);

    // Fetch the actual tag details
    const { data: tags, error: tagsError } = await getSupabaseAdmin()
      .from("team_tags")
      .select("tag_name, tag_type, description")
      .in("id", tagIds);

    if (tagsError || !tags || tags.length === 0) {
      console.log("[ContextLoader] Error fetching tag details:", tagsError?.message);
      return undefined;
    }

    console.log(`[ContextLoader] Found ${tags.length} tags for user`);

    return tags.map((tag) => ({
      tag_name: tag.tag_name,
      tag_type: tag.tag_type as "role" | "department",
      description: tag.description || undefined,
    }));
  } catch (error) {
    console.error("[ContextLoader] Error in fetchUserTeamTags:", error);
    return undefined;
  }
}

/**
 * Load user's business profile (ICP, products, personas, etc.)
 */
async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data: user, error } = await getSupabaseAdmin()
      .from("users")
      .select("business_profile")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("[ContextLoader] Error fetching user:", error);
      return null;
    }

    if (!user?.business_profile) {
      console.log("[ContextLoader] No business profile found for user:", userId);
      return null;
    }

    const bp = user.business_profile;

    // Fetch team tags for this user
    const teamTags = await fetchUserTeamTags(userId);

    // Parse business profile into UserProfile format
    const profile: UserProfile = {
      icp: bp.icp ? {
        company_size: bp.icp.company_size || undefined,
        regions: bp.icp.regions || undefined,
        industries: bp.icp.industries || undefined,
        tech_stack: bp.icp.tech_stack || undefined,
      } : undefined,
      products: bp.products?.map((p: { name: string; description?: string }) => ({
        name: p.name,
        description: p.description,
      })) || undefined,
      buyer_personas: bp.buyer_personas?.map((p: { role: string; notes?: string }) => ({
        role: p.role,
        notes: p.notes,
      })) || undefined,
      talk_tracks: bp.talk_tracks || undefined,
      objection_handling: bp.objection_handling?.map((o: { objection: string; rebuttal: string }) => ({
        objection: o.objection,
        rebuttal: o.rebuttal,
      })) || undefined,
      elevator_pitch: bp.elevator_pitch || bp.value_proposition || undefined,
      sales_motion: bp.sales_motion || undefined,
      team_tags: teamTags,
    };

    console.log("[ContextLoader] Loaded user profile with business data and team tags");
    return profile;
  } catch (error) {
    console.error("[ContextLoader] Error in fetchUserProfile:", error);
    return null;
  }
}

/**
 * Get company ID from a transcript via company_calls table
 */
async function getCompanyIdForTranscript(transcriptId: number): Promise<number | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("company_calls")
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

export interface LoadContextParams {
  transcriptId: number;
  companyId?: number;
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

    // Team role tags - CRITICAL FOR SCORING CONTEXT
    if (up.team_tags && up.team_tags.length > 0) {
      formatted += "**Rep's Roles:**\n";

      const systemRoleTags = up.team_tags.filter(t => t.tag_type === "role");
      const customRoleTags = up.team_tags.filter(t => t.tag_type === "department");

      if (systemRoleTags.length > 0) {
        formatted += "- System Role: ";
        systemRoleTags.forEach((tag, index) => {
          formatted += tag.tag_name;
          if (tag.description) formatted += ` (${tag.description})`;
          if (index < systemRoleTags.length - 1) formatted += ", ";
        });
        formatted += "\n";
      }

      if (customRoleTags.length > 0) {
        formatted += "- Custom Role(s): ";
        customRoleTags.forEach((tag, index) => {
          formatted += tag.tag_name;
          if (tag.description) formatted += ` (${tag.description})`;
          if (index < customRoleTags.length - 1) formatted += ", ";
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
