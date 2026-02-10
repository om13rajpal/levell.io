"use client";

import { supabase } from "@/lib/supabaseClient";

// ============================================================================
// Types
// ============================================================================

export interface TeamInvitation {
  id: string;
  team_id: number;
  email: string;
  token: string;
  invited_by: string;
  status: "pending" | "accepted" | "expired";
  created_at: string;
  expires_at: string;
}

export type Team = {
  id: number;
  team_name: string;
  created_at: string;
  active: boolean;
  internal_org_id?: string;
};

export interface TeamRole {
  id: number;
  role_name: string;
  description: string | null;
}

export interface TeamMember {
  id: string; // team_org.id
  user_id: string;
  team_id: number;
  team_role_id: number;
  role_name: string;
  is_sales_manager: boolean;
  active: boolean;
  user_name: string | null;
  user_email: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a cryptographically secure invitation token.
 * Uses Web Crypto API for secure random values.
 */
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = new Uint32Array(48);
  crypto.getRandomValues(randomValues);

  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(randomValues[i] % chars.length);
  }
  return token;
}

// ============================================================================
// Core team membership functions
// ============================================================================

/**
 * Get the active team for a user via the team_org junction table.
 */
export async function getUserTeam(
  userId: string
): Promise<{ teamId: number | null; teamName: string | null }> {
  const { data, error } = await supabase
    .from("team_org")
    .select("team_id, teams(id, team_name)")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user team:", error);
    return { teamId: null, teamName: null };
  }

  if (!data) {
    return { teamId: null, teamName: null };
  }

  // Supabase returns the joined relation as an object (single) or array.
  const teamName =
    (data.teams as unknown as { team_name: string } | null)?.team_name ?? null;

  return { teamId: data.team_id, teamName };
}

/**
 * Check if a user can join a team (i.e. has no active team_org entry).
 */
export async function canUserJoinTeam(
  userId: string
): Promise<{ canJoin: boolean; existingTeam: string | null }> {
  const { teamId, teamName } = await getUserTeam(userId);
  return {
    canJoin: teamId === null,
    existingTeam: teamName,
  };
}

// ============================================================================
// Team CRUD
// ============================================================================

/**
 * Create a new team. The creating user becomes Admin (role_id 1) and
 * is_sales_manager = true.
 */
export async function createTeam(
  teamName: string,
  userId: string
): Promise<{ success: boolean; team?: Team; error?: string }> {
  try {
    // Check if user is already in a team
    const { canJoin, existingTeam } = await canUserJoinTeam(userId);
    if (!canJoin) {
      return {
        success: false,
        error: `You are already a member of "${existingTeam}". Leave that team first to create a new one.`,
      };
    }

    // Insert the team (only team_name needed now)
    const { data: newTeam, error: teamError } = await supabase
      .from("teams")
      .insert({ team_name: teamName.trim() })
      .select("*")
      .single();

    if (teamError || !newTeam) {
      console.error("Create team error:", teamError);
      return { success: false, error: "Failed to create team." };
    }

    // Insert team_org entry for the creator as Admin + sales manager
    const { error: orgError } = await supabase.from("team_org").insert({
      team_id: newTeam.id,
      user_id: userId,
      team_role_id: 1, // Admin
      is_sales_manager: true,
      active: true,
    });

    if (orgError) {
      console.error("Error creating team_org entry:", orgError);
      // Attempt cleanup: remove the orphaned team
      await supabase.from("teams").delete().eq("id", newTeam.id);
      return { success: false, error: "Failed to assign team ownership." };
    }

    return { success: true, team: newTeam };
  } catch (err) {
    console.error("Create team error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Soft-delete a team by setting teams.active = false and deactivating all
 * team_org entries for the team.
 */
export async function softDeleteTeam(
  teamId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Deactivate the team itself
    const { error: teamError } = await supabase
      .from("teams")
      .update({ active: false })
      .eq("id", teamId);

    if (teamError) {
      console.error("Error deactivating team:", teamError);
      return { success: false, error: "Failed to deactivate team." };
    }

    // Deactivate all team_org entries for this team
    const { error: orgError } = await supabase
      .from("team_org")
      .update({ active: false })
      .eq("team_id", teamId);

    if (orgError) {
      console.error("Error deactivating team_org entries:", orgError);
      return { success: false, error: "Failed to deactivate team memberships." };
    }

    return { success: true };
  } catch (err) {
    console.error("Soft delete team error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ============================================================================
// Invitation functions
// ============================================================================

/**
 * Create a team invitation and send an email.
 */
export async function createTeamInvitation(
  teamId: number,
  email: string,
  invitedBy: string
): Promise<{ success: boolean; inviteUrl?: string; error?: string }> {
  try {
    // Check if email is already invited to this team
    const { data: existingInvite } = await supabase
      .from("team_invitations")
      .select("id")
      .eq("team_id", teamId)
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      return { success: false, error: "This email has already been invited to the team." };
    }

    // Check if user with this email exists and is already in a team
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      const { canJoin, existingTeam } = await canUserJoinTeam(existingUser.id);
      if (!canJoin) {
        return { success: false, error: `This user is already a member of "${existingTeam}".` };
      }
    }

    // Generate token and expiry
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Insert invitation
    const { data: invitation, error } = await supabase
      .from("team_invitations")
      .insert({
        team_id: teamId,
        email: email.toLowerCase(),
        token,
        invited_by: invitedBy,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating invitation:", error);
      return { success: false, error: "Failed to create invitation." };
    }

    // Generate invite URL
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "";
    const inviteUrl = `${baseUrl}/team/invite/${token}`;

    // Get inviter's name for the email
    const { data: inviterData } = await supabase
      .from("users")
      .select("name, email")
      .eq("id", invitedBy)
      .single();

    const inviterDisplayName = inviterData?.name || inviterData?.email || "A team member";

    // Get team name for the email
    const { data: teamData } = await supabase
      .from("teams")
      .select("team_name")
      .eq("id", teamId)
      .single();

    const teamDisplayName = teamData?.team_name || "the team";

    // Send invitation email via custom email service
    try {
      const { sendTeamInvitationEmail } = await import("./email");

      const emailResult = await sendTeamInvitationEmail(
        email.toLowerCase(),
        inviterDisplayName,
        teamDisplayName,
        inviteUrl,
        7 // 7 days expiry
      );

      if (!emailResult.success) {
        console.error("Email sending error:", emailResult.error);
        // Still return success with the invite URL - user can share manually
      }
    } catch (emailErr) {
      console.error("Email error:", emailErr);
      // Still return success with the invite URL - user can share manually
    }

    return { success: true, inviteUrl };
  } catch (err) {
    console.error("Invitation error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Validate an invitation token.
 */
export async function validateInvitation(token: string): Promise<{
  valid: boolean;
  invitation?: TeamInvitation;
  team?: { id: number; team_name: string };
  error?: string;
}> {
  try {
    const { data: invitation, error } = await supabase
      .from("team_invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (error) {
      console.error("Error validating invitation:", error);
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return {
          valid: false,
          error: "Team invitations are not configured. Please contact support.",
        };
      }
      return { valid: false, error: "Invalid or expired invitation link." };
    }

    if (!invitation) {
      return { valid: false, error: "Invalid or expired invitation link." };
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from("team_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      return { valid: false, error: "This invitation has expired." };
    }

    // Check if already accepted
    if (invitation.status === "accepted") {
      return { valid: false, error: "This invitation has already been used." };
    }

    if (invitation.status === "expired") {
      return { valid: false, error: "This invitation has expired." };
    }

    // Get team details (no owner column)
    const { data: team } = await supabase
      .from("teams")
      .select("id, team_name")
      .eq("id", invitation.team_id)
      .single();

    if (!team) {
      return { valid: false, error: "Team no longer exists." };
    }

    return { valid: true, invitation, team };
  } catch (err) {
    console.error("Validation error:", err);
    return { valid: false, error: "Failed to validate invitation." };
  }
}

/**
 * Accept a team invitation by inserting a team_org entry for the user.
 */
export async function acceptInvitation(
  token: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate the invitation
    const { valid, invitation, team, error } = await validateInvitation(token);

    if (!valid || !invitation || !team) {
      return { success: false, error: error || "Invalid invitation." };
    }

    // Check if user can join (not already in an active team)
    const { canJoin, existingTeam } = await canUserJoinTeam(userId);
    if (!canJoin) {
      return {
        success: false,
        error: `You are already a member of "${existingTeam}". You can only be in one team at a time.`,
      };
    }

    // Insert team_org entry as a Member (role_id 3)
    const { error: orgError } = await supabase.from("team_org").insert({
      team_id: team.id,
      user_id: userId,
      team_role_id: 3, // Member
      is_sales_manager: false,
      active: true,
    });

    if (orgError) {
      console.error("Error inserting team_org entry:", orgError);
      return { success: false, error: `Failed to join team: ${orgError.message}` };
    }

    // Mark invitation as accepted
    const { error: inviteUpdateError } = await supabase
      .from("team_invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id);

    if (inviteUpdateError) {
      console.error("Error marking invitation as accepted:", inviteUpdateError);
      // Don't fail - user is already added to the team
    }

    return { success: true };
  } catch (err) {
    console.error("Accept invitation error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Get pending invitations for a team.
 */
export async function getTeamPendingInvitations(teamId: number): Promise<TeamInvitation[]> {
  const { data } = await supabase
    .from("team_invitations")
    .select("*")
    .eq("team_id", teamId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return data || [];
}

/**
 * Cancel/revoke an invitation.
 */
export async function revokeInvitation(invitationId: string): Promise<boolean> {
  const { error } = await supabase
    .from("team_invitations")
    .delete()
    .eq("id", invitationId);

  return !error;
}

// ============================================================================
// Leave team
// ============================================================================

/**
 * Leave a team. The sole remaining Admin cannot leave; they must transfer the
 * Admin role to another member first, or delete the team.
 * Sets the user's team_org entry to active = false.
 */
export async function leaveTeam(
  teamId: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check the user's team_org entry
    const { data: membership, error: fetchError } = await supabase
      .from("team_org")
      .select("id, team_role_id, is_sales_manager")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle();

    if (fetchError || !membership) {
      return { success: false, error: "You are not an active member of this team." };
    }

    // If the user is an Admin (role_id 1), check whether they are the only one
    if (membership.team_role_id === 1) {
      const { count, error: countError } = await supabase
        .from("team_org")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId)
        .eq("team_role_id", 1) // Admin
        .eq("active", true);

      if (countError) {
        console.error("Error counting admins:", countError);
        return { success: false, error: "Failed to verify admin count." };
      }

      if ((count ?? 0) <= 1) {
        return {
          success: false,
          error:
            "You are the only Admin on this team. Promote another member to Admin first, or delete the team.",
        };
      }
    }

    // Deactivate the team_org entry
    const { error: updateError } = await supabase
      .from("team_org")
      .update({ active: false })
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .eq("active", true);

    if (updateError) {
      console.error("Error deactivating team_org entry:", updateError);
      return { success: false, error: "Failed to leave team." };
    }

    return { success: true };
  } catch (err) {
    console.error("Leave team error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ============================================================================
// Roles and members
// ============================================================================

/**
 * Fetch all global team roles from the team_roles table (read-only).
 */
export async function getTeamRoles(): Promise<{
  success: boolean;
  roles?: TeamRole[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("team_roles")
      .select("id, role_name, description")
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching team roles:", error);
      return { success: false, error: "Failed to fetch team roles." };
    }

    return { success: true, roles: data || [] };
  } catch (err) {
    console.error("Get team roles error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Get the role of a specific user within a team.
 */
export async function getUserRole(
  userId: string,
  teamId: number
): Promise<{
  roleId: number | null;
  roleName: string | null;
  isSalesManager: boolean;
}> {
  const { data } = await supabase
    .from("team_org")
    .select("team_role_id, is_sales_manager, team_roles(role_name)")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .eq("active", true)
    .maybeSingle();

  if (!data) return { roleId: null, roleName: null, isSalesManager: false };

  return {
    roleId: data.team_role_id,
    roleName: (data as any).team_roles?.role_name || null,
    isSalesManager: data.is_sales_manager || false,
  };
}

/**
 * Get all active members for a team, including user details and role name.
 */
export async function getTeamMembers(teamId: number): Promise<{
  success: boolean;
  members?: TeamMember[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("team_org")
      .select(
        "id, user_id, team_id, team_role_id, is_sales_manager, active, users(name, email), team_roles(role_name)"
      )
      .eq("team_id", teamId)
      .eq("active", true);

    if (error) {
      console.error("Error fetching team members:", error);
      return { success: false, error: "Failed to fetch team members." };
    }

    const members: TeamMember[] = (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      team_id: row.team_id,
      team_role_id: row.team_role_id,
      role_name: row.team_roles?.role_name ?? "Unknown",
      is_sales_manager: row.is_sales_manager,
      active: row.active,
      user_name: row.users?.name ?? null,
      user_email: row.users?.email ?? "",
    }));

    return { success: true, members };
  } catch (err) {
    console.error("Get team members error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Update a member's role in a team.
 */
export async function updateMemberRole(
  teamId: number,
  userId: string,
  newRoleId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("team_org")
      .update({ team_role_id: newRoleId })
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .eq("active", true);

    if (error) {
      console.error("Error updating member role:", error);
      return { success: false, error: "Failed to update member role." };
    }

    return { success: true };
  } catch (err) {
    console.error("Update member role error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Change a user's role in a team (alias for updateMemberRole).
 */
export async function changeUserRole(
  teamId: number,
  userId: string,
  newRoleId: number
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("team_org")
    .update({ team_role_id: newRoleId })
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("active", true);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Move a user from one team to another. Deactivates the old team_org entry
 * and creates a new one for the target team.
 */
export async function moveUserBetweenTeams(
  userId: string,
  fromTeamId: number,
  toTeamId: number,
  roleId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Deactivate old membership
    const { error: deactivateError } = await supabase
      .from("team_org")
      .update({ active: false })
      .eq("user_id", userId)
      .eq("team_id", fromTeamId)
      .eq("active", true);

    if (deactivateError) {
      console.error("Error deactivating old team_org entry:", deactivateError);
      return { success: false, error: "Failed to remove user from old team." };
    }

    // Create new membership
    const { error: insertError } = await supabase.from("team_org").insert({
      team_id: toTeamId,
      user_id: userId,
      team_role_id: roleId,
      is_sales_manager: false,
      active: true,
    });

    if (insertError) {
      console.error("Error creating new team_org entry:", insertError);
      // Attempt to reactivate old entry on failure
      await supabase
        .from("team_org")
        .update({ active: true })
        .eq("user_id", userId)
        .eq("team_id", fromTeamId)
        .eq("active", false)
        .order("updated_at", { ascending: false })
        .limit(1);
      return { success: false, error: "Failed to add user to new team." };
    }

    return { success: true };
  } catch (err) {
    console.error("Move user between teams error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ============================================================================
// Legacy stubs (kept for backward compatibility with callers)
// ============================================================================

/**
 * No-op: Roles are now global in the team_roles table.
 * Kept for backward compatibility with callers that still invoke it.
 */
export async function ensureTeamTags(
  _teamId: number,
  _ownerId?: string
): Promise<void> {
  // No-op: Roles are now global in team_roles table
}
