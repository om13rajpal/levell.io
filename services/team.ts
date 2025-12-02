"use client";

import { supabase } from "@/lib/supabaseClient";

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

/**
 * Generate a unique invitation token
 */
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Check if a user is already in a team
 */
export async function getUserTeam(userId: string): Promise<{ teamId: number | null; teamName: string | null }> {
  // First try the members array contains query
  const { data: teamRow } = await supabase
    .from("teams")
    .select("id, team_name")
    .contains("members", [userId])
    .limit(1)
    .maybeSingle();

  if (teamRow) {
    return {
      teamId: teamRow.id,
      teamName: teamRow.team_name,
    };
  }

  // Fallback: check user's team_id field
  const { data: userData } = await supabase
    .from("users")
    .select("team_id")
    .eq("id", userId)
    .single();

  if (userData?.team_id) {
    const { data: teamByUserId } = await supabase
      .from("teams")
      .select("id, team_name")
      .eq("id", userData.team_id)
      .single();

    if (teamByUserId) {
      return {
        teamId: teamByUserId.id,
        teamName: teamByUserId.team_name,
      };
    }
  }

  return {
    teamId: null,
    teamName: null,
  };
}

/**
 * Check if user can join a team (not already in one)
 */
export async function canUserJoinTeam(userId: string): Promise<{ canJoin: boolean; existingTeam: string | null }> {
  const { teamId, teamName } = await getUserTeam(userId);
  return {
    canJoin: teamId === null,
    existingTeam: teamName,
  };
}

/**
 * Create a team invitation and send email
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
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${baseUrl}/team/invite/${token}`;

    // Send invitation email via Supabase Edge Function or direct email
    // For now, we'll use Supabase's built-in auth magic link system
    try {
      const { error: emailError } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          emailRedirectTo: inviteUrl,
          data: {
            invite_type: "team",
            team_id: teamId,
            token: token,
          },
        },
      });

      if (emailError) {
        console.error("Email sending error:", emailError);
        // Still return success with the invite URL - user can share manually
      }
    } catch (emailErr) {
      console.error("Email error:", emailErr);
    }

    return { success: true, inviteUrl };
  } catch (err) {
    console.error("Invitation error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Validate an invitation token
 */
export async function validateInvitation(token: string): Promise<{
  valid: boolean;
  invitation?: TeamInvitation;
  team?: { id: number; team_name: string; owner: string };
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
      // Check if table doesn't exist
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { valid: false, error: "Team invitations are not configured. Please contact support." };
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

    // Get team details
    const { data: team } = await supabase
      .from("teams")
      .select("id, team_name, owner")
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
 * Accept a team invitation
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

    // Check if user can join (not already in a team)
    const { canJoin, existingTeam } = await canUserJoinTeam(userId);
    if (!canJoin) {
      return { success: false, error: `You are already a member of "${existingTeam}". You can only be in one team at a time.` };
    }

    // Get current team members
    const { data: teamData, error: fetchError } = await supabase
      .from("teams")
      .select("members")
      .eq("id", team.id)
      .single();

    if (fetchError || !teamData) {
      console.error("Error fetching team:", fetchError);
      return { success: false, error: "Team not found." };
    }

    // Add user to team
    const currentMembers = teamData.members || [];
    if (currentMembers.includes(userId)) {
      // Already a member, just mark invitation as accepted
      await supabase
        .from("team_invitations")
        .update({ status: "accepted" })
        .eq("id", invitation.id);
      return { success: true };
    }

    const newMembers = [...currentMembers, userId];

    // Update team members
    const { data: updatedTeam, error: updateError } = await supabase
      .from("teams")
      .update({ members: newMembers })
      .eq("id", team.id)
      .select("members")
      .single();

    if (updateError) {
      console.error("Error updating team members:", updateError);
      return { success: false, error: `Failed to join team: ${updateError.message}` };
    }

    // Verify the update actually worked
    if (!updatedTeam?.members?.includes(userId)) {
      console.error("Member was not added to team - update may have failed silently");
      console.log("Expected userId:", userId);
      console.log("Actual members:", updatedTeam?.members);
      return { success: false, error: "Failed to join team. Please try again." };
    }

    // Update user's team_id BEFORE marking invitation as accepted
    // This ensures user is linked to team even if invitation update fails
    const { error: userUpdateError } = await supabase
      .from("users")
      .update({ team_id: team.id })
      .eq("id", userId);

    if (userUpdateError) {
      console.error("Error updating user team_id:", userUpdateError);
      // Don't fail - the important part (adding to members) worked
    }

    // Mark invitation as accepted
    const { error: inviteUpdateError } = await supabase
      .from("team_invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id);

    if (inviteUpdateError) {
      console.error("Error marking invitation as accepted:", inviteUpdateError);
      // Don't fail - user is already added to team
    }

    return { success: true };
  } catch (err) {
    console.error("Accept invitation error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Get pending invitations for a team
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
 * Cancel/revoke an invitation
 */
export async function revokeInvitation(invitationId: string): Promise<boolean> {
  const { error } = await supabase
    .from("team_invitations")
    .delete()
    .eq("id", invitationId);

  return !error;
}

/**
 * Leave a team
 */
export async function leaveTeam(
  teamId: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get team
    const { data: team } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .single();

    if (!team) {
      return { success: false, error: "Team not found." };
    }

    // Check if owner
    if (team.owner === userId) {
      return { success: false, error: "Team owner cannot leave. Transfer ownership first or delete the team." };
    }

    // Remove from members array
    const newMembers = (team.members || []).filter((id: string) => id !== userId);

    const { error } = await supabase
      .from("teams")
      .update({ members: newMembers })
      .eq("id", teamId);

    if (error) {
      return { success: false, error: "Failed to leave team." };
    }

    // Remove member tags
    await supabase
      .from("team_member_tags")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId);

    // Clear user's team_id
    await supabase
      .from("users")
      .update({ team_id: null })
      .eq("id", userId);

    return { success: true };
  } catch (err) {
    console.error("Leave team error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Ensure Admin and Member tags exist for a team
 * Call this to fix teams that were created without default tags
 */
export async function ensureTeamTags(teamId: number, ownerId?: string): Promise<void> {
  try {
    // Check if Admin tag exists
    const { data: existingAdminTag } = await supabase
      .from("team_tags")
      .select("id")
      .eq("team_id", teamId)
      .ilike("tag_name", "admin")
      .maybeSingle();

    // Check if Member tag exists
    const { data: existingMemberTag } = await supabase
      .from("team_tags")
      .select("id")
      .eq("team_id", teamId)
      .ilike("tag_name", "member")
      .maybeSingle();

    // Create Admin tag if missing
    let adminTagId = existingAdminTag?.id;
    if (!existingAdminTag) {
      const { data: newAdminTag } = await supabase
        .from("team_tags")
        .insert({
          team_id: teamId,
          tag_name: "Admin",
          tag_color: "#ef4444",
        })
        .select("id")
        .single();
      adminTagId = newAdminTag?.id;
    }

    // Create Member tag if missing
    if (!existingMemberTag) {
      await supabase
        .from("team_tags")
        .insert({
          team_id: teamId,
          tag_name: "Member",
          tag_color: "#6366f1",
        });
    }

    // If owner is provided and Admin tag was just created, assign it to owner
    if (ownerId && adminTagId && !existingAdminTag) {
      // Check if owner already has the admin tag
      const { data: existingOwnerTag } = await supabase
        .from("team_member_tags")
        .select("id")
        .eq("team_id", teamId)
        .eq("user_id", ownerId)
        .eq("tag_id", adminTagId)
        .maybeSingle();

      if (!existingOwnerTag) {
        await supabase
          .from("team_member_tags")
          .insert({
            team_id: teamId,
            user_id: ownerId,
            tag_id: adminTagId,
          });
      }
    }
  } catch (err) {
    console.error("Error ensuring team tags:", err);
  }
}

/**
 * Create a new team (with single team check)
 */
export async function createTeam(
  teamName: string,
  userId: string
): Promise<{ success: boolean; team?: any; error?: string }> {
  try {
    // Check if user is already in a team
    const { canJoin, existingTeam } = await canUserJoinTeam(userId);
    if (!canJoin) {
      return { success: false, error: `You are already a member of "${existingTeam}". Leave that team first to create a new one.` };
    }

    // Create team
    const { data: newTeam, error } = await supabase
      .from("teams")
      .insert({
        team_name: teamName.trim(),
        owner: userId,
        members: [userId],
      })
      .select("*")
      .single();

    if (error) {
      console.error("Create team error:", error);
      return { success: false, error: "Failed to create team." };
    }

    // Create default Admin and Member tags for the team
    const { data: adminTag } = await supabase
      .from("team_tags")
      .insert({
        team_id: newTeam.id,
        tag_name: "Admin",
        tag_color: "#ef4444", // Red for admin
      })
      .select("id")
      .single();

    await supabase
      .from("team_tags")
      .insert({
        team_id: newTeam.id,
        tag_name: "Member",
        tag_color: "#6366f1", // Indigo for member
      });

    // Assign Admin tag to team owner
    if (adminTag) {
      await supabase
        .from("team_member_tags")
        .insert({
          team_id: newTeam.id,
          user_id: userId,
          tag_id: adminTag.id,
        });
    }

    // Update user's team_id
    await supabase
      .from("users")
      .update({ team_id: newTeam.id })
      .eq("id", userId);

    return { success: true, team: newTeam };
  } catch (err) {
    console.error("Create team error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
