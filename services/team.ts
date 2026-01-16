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
 * Generate a cryptographically secure invitation token
 * Uses Web Crypto API for secure random values
 */
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = new Uint32Array(48); // 48 characters for better entropy
  crypto.getRandomValues(randomValues);

  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(randomValues[i] % chars.length);
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
    const baseUrl = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || "";
    const inviteUrl = `${baseUrl}/team/invite/${token}`;

    // Get inviter's name for the email
    const { data: inviterData } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("id", invitedBy)
      .single();

    const inviterDisplayName = inviterData?.full_name || inviterData?.email || "A team member";

    // Get team name for the email
    const { data: teamData } = await supabase
      .from("teams")
      .select("team_name")
      .eq("id", teamId)
      .single();

    const teamDisplayName = teamData?.team_name || "the team";

    // Send invitation email via custom email service
    try {
      // Import dynamically to avoid build issues
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

    // Assign "Member" tag to the new user by default
    try {
      // Get the Member tag for this team
      const { data: memberTag } = await supabase
        .from("team_tags")
        .select("id")
        .eq("team_id", team.id)
        .ilike("tag_name", "member")
        .maybeSingle();

      if (memberTag) {
        // Check if user already has this tag
        const { data: existingTag } = await supabase
          .from("team_member_tags")
          .select("id")
          .eq("team_id", team.id)
          .eq("user_id", userId)
          .eq("tag_id", memberTag.id)
          .maybeSingle();

        if (!existingTag) {
          // Assign the Member tag to the new user
          await supabase.from("team_member_tags").insert({
            team_id: team.id,
            user_id: userId,
            tag_id: memberTag.id,
          });
          console.log("✅ Assigned Member tag to new team member");
        }
      } else {
        // Member tag doesn't exist - ensure team has default tags
        await ensureTeamTags(team.id);

        // Try again to get and assign the Member tag
        const { data: newMemberTag } = await supabase
          .from("team_tags")
          .select("id")
          .eq("team_id", team.id)
          .ilike("tag_name", "member")
          .maybeSingle();

        if (newMemberTag) {
          await supabase.from("team_member_tags").insert({
            team_id: team.id,
            user_id: userId,
            tag_id: newMemberTag.id,
          });
          console.log("✅ Assigned Member tag to new team member (after creating tags)");
        }
      }
    } catch (tagError) {
      console.error("Error assigning Member tag:", tagError);
      // Don't fail - user is still added to team
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

// ============================================================================
// Tag/Department Management Types
// ============================================================================

export type TagType = "role" | "department";

export interface TeamTag {
  id: number;
  team_id: number;
  tag_name: string;
  tag_color: string;
  tag_type: TagType;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberTag {
  id: number;
  team_id: number;
  user_id: string;
  tag_id: number;
  created_at: string;
}

export interface TagUpdatePayload {
  tag_name?: string;
  tag_color?: string;
  description?: string;
}

export const DEPARTMENT_TYPE_OPTIONS = [
  "HR",
  "Engineering",
  "Sales",
  "Marketing",
  "Finance",
  "Operations",
  "Customer Support",
  "Other",
] as const;

export type DepartmentType = (typeof DEPARTMENT_TYPE_OPTIONS)[number];

// ============================================================================
// Tag/Department Management Functions
// ============================================================================

/**
 * Get all tags for a team, ordered by type then name
 */
export async function getTeamTags(
  teamId: number
): Promise<{ success: boolean; tags?: TeamTag[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("team_tags")
      .select("*")
      .eq("team_id", teamId)
      .order("tag_type", { ascending: true })
      .order("tag_name", { ascending: true });

    if (error) {
      console.error("Error fetching team tags:", error);
      return { success: false, error: "Failed to fetch team tags." };
    }

    return { success: true, tags: data || [] };
  } catch (err) {
    console.error("Get team tags error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Create a new custom tag for a team
 */
export async function createTeamTag(
  teamId: number,
  tagName: string,
  tagColor: string,
  tagType: TagType,
  description?: string
): Promise<{ success: boolean; tag?: TeamTag; error?: string }> {
  try {
    // Validate inputs
    if (!tagName || tagName.trim().length === 0) {
      return { success: false, error: "Tag name is required." };
    }

    if (!tagColor || !/^#[0-9A-Fa-f]{6}$/.test(tagColor)) {
      return { success: false, error: "Invalid tag color. Must be a valid hex color (e.g., #FF0000)." };
    }

    if (!["role", "department"].includes(tagType)) {
      return { success: false, error: "Invalid tag type. Must be 'role' or 'department'." };
    }

    // Check for duplicate tag name in the same team
    const { data: existingTag } = await supabase
      .from("team_tags")
      .select("id")
      .eq("team_id", teamId)
      .ilike("tag_name", tagName.trim())
      .maybeSingle();

    if (existingTag) {
      return { success: false, error: "A tag with this name already exists in the team." };
    }

    // Create the tag
    const { data: newTag, error } = await supabase
      .from("team_tags")
      .insert({
        team_id: teamId,
        tag_name: tagName.trim(),
        tag_color: tagColor,
        tag_type: tagType,
        description: description?.trim() || null,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating team tag:", error);
      return { success: false, error: "Failed to create tag." };
    }

    return { success: true, tag: newTag };
  } catch (err) {
    console.error("Create team tag error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Update an existing tag
 */
export async function updateTeamTag(
  tagId: number,
  updates: TagUpdatePayload
): Promise<{ success: boolean; tag?: TeamTag; error?: string }> {
  try {
    // Fetch the existing tag to check if it's a system tag
    const { data: existingTag, error: fetchError } = await supabase
      .from("team_tags")
      .select("*")
      .eq("id", tagId)
      .single();

    if (fetchError || !existingTag) {
      return { success: false, error: "Tag not found." };
    }

    // System tags can only have their color updated
    if (existingTag.is_system && (updates.tag_name || updates.description)) {
      return { success: false, error: "System tags can only have their color updated." };
    }

    // Validate tag name if provided
    if (updates.tag_name !== undefined) {
      if (!updates.tag_name || updates.tag_name.trim().length === 0) {
        return { success: false, error: "Tag name cannot be empty." };
      }

      // Check for duplicate tag name in the same team (excluding current tag)
      const { data: duplicateTag } = await supabase
        .from("team_tags")
        .select("id")
        .eq("team_id", existingTag.team_id)
        .ilike("tag_name", updates.tag_name.trim())
        .neq("id", tagId)
        .maybeSingle();

      if (duplicateTag) {
        return { success: false, error: "A tag with this name already exists in the team." };
      }
    }

    // Validate color if provided
    if (updates.tag_color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(updates.tag_color)) {
      return { success: false, error: "Invalid tag color. Must be a valid hex color (e.g., #FF0000)." };
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {};
    if (updates.tag_name !== undefined) {
      updatePayload.tag_name = updates.tag_name.trim();
    }
    if (updates.tag_color !== undefined) {
      updatePayload.tag_color = updates.tag_color;
    }
    if (updates.description !== undefined) {
      updatePayload.description = updates.description?.trim() || null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return { success: false, error: "No valid updates provided." };
    }

    // Update the tag
    const { data: updatedTag, error } = await supabase
      .from("team_tags")
      .update(updatePayload)
      .eq("id", tagId)
      .select()
      .single();

    if (error) {
      console.error("Error updating team tag:", error);
      return { success: false, error: "Failed to update tag." };
    }

    return { success: true, tag: updatedTag };
  } catch (err) {
    console.error("Update team tag error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Delete a tag (with validation it's not a system tag)
 */
export async function deleteTeamTag(
  tagId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch the existing tag to check if it's a system tag
    const { data: existingTag, error: fetchError } = await supabase
      .from("team_tags")
      .select("id, is_system")
      .eq("id", tagId)
      .single();

    if (fetchError || !existingTag) {
      return { success: false, error: "Tag not found." };
    }

    if (existingTag.is_system) {
      return { success: false, error: "System tags cannot be deleted." };
    }

    // Delete all member associations for this tag first
    const { error: memberTagError } = await supabase
      .from("team_member_tags")
      .delete()
      .eq("tag_id", tagId);

    if (memberTagError) {
      console.error("Error deleting member tag associations:", memberTagError);
      return { success: false, error: "Failed to delete tag associations." };
    }

    // Delete the tag
    const { error } = await supabase
      .from("team_tags")
      .delete()
      .eq("id", tagId);

    if (error) {
      console.error("Error deleting team tag:", error);
      return { success: false, error: "Failed to delete tag." };
    }

    return { success: true };
  } catch (err) {
    console.error("Delete team tag error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Assign multiple tags to a member (replaces existing non-role tags)
 */
export async function assignTagsToMember(
  teamId: number,
  userId: string,
  tagIds: number[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate that all provided tag IDs belong to this team
    if (tagIds.length > 0) {
      const { data: validTags, error: validateError } = await supabase
        .from("team_tags")
        .select("id, tag_type")
        .eq("team_id", teamId)
        .in("id", tagIds);

      if (validateError) {
        console.error("Error validating tags:", validateError);
        return { success: false, error: "Failed to validate tags." };
      }

      if (!validTags || validTags.length !== tagIds.length) {
        return { success: false, error: "One or more tags do not belong to this team." };
      }
    }

    // Get existing role tags for the user (we'll preserve these)
    const { data: existingRoleTags, error: fetchRoleError } = await supabase
      .from("team_member_tags")
      .select("tag_id, team_tags!inner(tag_type)")
      .eq("team_id", teamId)
      .eq("user_id", userId);

    if (fetchRoleError) {
      console.error("Error fetching existing role tags:", fetchRoleError);
      return { success: false, error: "Failed to fetch existing tags." };
    }

    // Filter to get only role tag IDs that should be preserved
    const roleTagIds = (existingRoleTags || [])
      .filter((t: any) => t.team_tags?.tag_type === "role")
      .map((t: any) => t.tag_id);

    // Delete all existing non-role tags for this member
    const { error: deleteError } = await supabase
      .from("team_member_tags")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .not("tag_id", "in", `(${roleTagIds.length > 0 ? roleTagIds.join(",") : "0"})`);

    if (deleteError) {
      console.error("Error deleting existing member tags:", deleteError);
      return { success: false, error: "Failed to update member tags." };
    }

    // Filter out role tags from the new tag IDs (we already have them preserved)
    const nonRoleTagIds = tagIds.filter((id) => !roleTagIds.includes(id));

    // Insert new non-role tags
    if (nonRoleTagIds.length > 0) {
      const insertPayload = nonRoleTagIds.map((tagId) => ({
        team_id: teamId,
        user_id: userId,
        tag_id: tagId,
      }));

      const { error: insertError } = await supabase
        .from("team_member_tags")
        .insert(insertPayload);

      if (insertError) {
        console.error("Error inserting member tags:", insertError);
        return { success: false, error: "Failed to assign tags to member." };
      }
    }

    return { success: true };
  } catch (err) {
    console.error("Assign tags to member error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Get all tags assigned to a specific member
 */
export async function getMemberTags(
  teamId: number,
  userId: string
): Promise<{ success: boolean; tags?: TeamTag[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("team_member_tags")
      .select("tag_id, team_tags(*)")
      .eq("team_id", teamId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching member tags:", error);
      return { success: false, error: "Failed to fetch member tags." };
    }

    // Extract the tag objects from the join result
    const tags = (data || [])
      .map((item: any) => item.team_tags)
      .filter((tag: TeamTag | null) => tag !== null) as TeamTag[];

    // Sort by type then name
    tags.sort((a, b) => {
      if (a.tag_type !== b.tag_type) {
        return a.tag_type.localeCompare(b.tag_type);
      }
      return a.tag_name.localeCompare(b.tag_name);
    });

    return { success: true, tags };
  } catch (err) {
    console.error("Get member tags error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Returns predefined department type options
 */
export function getTagTypeOptions(): DepartmentType[] {
  return [...DEPARTMENT_TYPE_OPTIONS];
}
