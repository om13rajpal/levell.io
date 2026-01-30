"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AskAICoach } from "@/components/AskAICoach";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  createTeam,
  createTeamInvitation,
  canUserJoinTeam,
  getTeamPendingInvitations,
  revokeInvitation,
  leaveTeam,
  ensureTeamTags,
  TeamInvitation,
} from "@/services/team";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";

import {
  Users,
  LogOut,
  Settings,
  Plus,
  UserPlus,
  Shield,
  Trash2,
  BarChart3,
  Eye,
  Copy,
  Mail,
  Clock,
  X,
  Loader2,
  Crown,
  Sparkles,
  ArrowRight,
  Hash,
  CheckCircle2,
  Calendar,
  UserCircle,
  Link2,
  MessageSquare,
  MessageCircle,
  Phone,
  TrendingUp,
  Tag,
  Building2,
} from "lucide-react";

import TagManagement from "@/components/TagManagement";
import { MemberTagAssignment } from "@/components/MemberTagAssignment";

type Team = {
  id: number;
  team_name: string;
  owner: string;
  members: string[];
  created_at: string;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
};

type TeamTag = {
  id: number;
  team_id: number;
  tag_name: string;
  tag_color: string | null;
  tag_type?: "role" | "department";
  created_at: string;
};

type MemberTag = {
  id: number;
  team_id: number;
  user_id: string;
  tag_id: number;
  created_at: string;
};

export default function TeamPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<UserRow[]>([]);
  const [ownerUser, setOwnerUser] = useState<UserRow | null>(null);

  const [tags, setTags] = useState<TeamTag[]>([]);
  const [memberTags, setMemberTags] = useState<MemberTag[]>([]);

  const [createTeamName, setCreateTeamName] = useState("");
  const [joinTeamId, setJoinTeamId] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<TeamInvitation[]>([]);

  const [openCreateTeam, setOpenCreateTeam] = useState(false);
  const [openJoinTeam, setOpenJoinTeam] = useState(false);
  const [openInviteDialog, setOpenInviteDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTeamName, setSettingsTeamName] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserRow | null>(null);
  const [selectedRole, setSelectedRole] = useState<"admin" | "member">("member");
  const [roleSaving, setRoleSaving] = useState(false);

  // Tag assignment dialog state
  const [tagAssignmentOpen, setTagAssignmentOpen] = useState(false);
  const [tagAssignmentMember, setTagAssignmentMember] = useState<UserRow | null>(null);

  const [loading, setLoading] = useState(true);


  // Coaching notes and stats for current user
  const [coachingNotes, setCoachingNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [myStats, setMyStats] = useState<{
    totalCalls: number;
    avgScore: number;
    recentCalls: number;
  }>({ totalCalls: 0, avgScore: 0, recentCalls: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };

    getUser();
  }, []);

  const getRoleForUser = useCallback((
    uid: string | null | undefined
  ): "admin" | "member" | null => {
    if (!uid || !team) return null;
    if (!tags.length || !memberTags.length) return null;

    const userMappings = memberTags.filter(
      (mt) => mt.user_id === uid && mt.team_id === team.id
    );

    if (!userMappings.length) return null;

    const adminTag = tags.find(
      (t) => t.team_id === team.id && t.tag_name.toLowerCase() === "admin"
    );
    const memberTag = tags.find(
      (t) => t.team_id === team.id && t.tag_name.toLowerCase() === "member"
    );

    if (adminTag && userMappings.some((mt) => mt.tag_id === adminTag.id))
      return "admin";
    if (memberTag && userMappings.some((mt) => mt.tag_id === memberTag.id))
      return "member";

    return null;
  }, [team, tags, memberTags]);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      setLoading(true);

      const { data: u } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("id", userId)
        .single();
      setUser(u);

      const { data: teamRow, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .contains("members", [userId])
        .limit(1)
        .maybeSingle();

      if (teamError) {
        console.error("Error fetching team:", teamError);
      }

      // Debug: Also check user's team_id as fallback
      if (!teamRow) {
        // Try to find team by user's team_id field
        const { data: userData } = await supabase
          .from("users")
          .select("team_id")
          .eq("id", userId)
          .single();

        if (userData?.team_id) {
          const { data: teamByUserTeamId } = await supabase
            .from("teams")
            .select("*")
            .eq("id", userData.team_id)
            .single();

          if (teamByUserTeamId) {
            console.log("Found team via user.team_id, members array might be out of sync");
            // The team exists but user isn't in members array - this is the bug!
            // Fix it by adding user to members
            const currentMembers = teamByUserTeamId.members || [];
            if (!currentMembers.includes(userId)) {
              const newMembers = [...currentMembers, userId];
              await supabase
                .from("teams")
                .update({ members: newMembers })
                .eq("id", teamByUserTeamId.id);

              // Refetch the team
              const { data: fixedTeam } = await supabase
                .from("teams")
                .select("*")
                .eq("id", teamByUserTeamId.id)
                .single();

              if (fixedTeam) {
                setTeam(fixedTeam as Team);
                setSettingsTeamName(fixedTeam.team_name);

                // Ensure Admin and Member tags exist for the team (fixes legacy teams)
                await ensureTeamTags(fixedTeam.id, fixedTeam.owner);

                const [membersResult, ownerResult, tagsResult, memberTagsResult] = await Promise.all([
                  fixedTeam.members?.length > 0
                    ? supabase.from("users").select("id, name, email").in("id", fixedTeam.members)
                    : Promise.resolve({ data: [] }),
                  fixedTeam.owner
                    ? supabase.from("users").select("id, name, email").eq("id", fixedTeam.owner).single()
                    : Promise.resolve({ data: null }),
                  supabase.from("team_tags").select("*").eq("team_id", fixedTeam.id),
                  supabase.from("team_member_tags").select("*").eq("team_id", fixedTeam.id)
                ]);

                setMembers(membersResult.data || []);
                setOwnerUser(ownerResult.data);
                setTags(tagsResult.data || []);
                setMemberTags(memberTagsResult.data || []);

                const invitations = await getTeamPendingInvitations(fixedTeam.id);
                setPendingInvitations(invitations);

                setLoading(false);
                return;
              }
            }
          }
        }

        setTeam(null);
        setMembers([]);
        setTags([]);
        setMemberTags([]);
        setLoading(false);
        return;
      }

      setTeam(teamRow as Team);
      setSettingsTeamName(teamRow.team_name);

      // Ensure Admin and Member tags exist for the team (fixes legacy teams)
      await ensureTeamTags(teamRow.id, teamRow.owner);

      const [membersResult, ownerResult, tagsResult, memberTagsResult] = await Promise.all([
        teamRow.members?.length > 0
          ? supabase.from("users").select("id, name, email").in("id", teamRow.members)
          : Promise.resolve({ data: [] }),
        teamRow.owner
          ? supabase.from("users").select("id, name, email").eq("id", teamRow.owner).single()
          : Promise.resolve({ data: null }),
        supabase.from("team_tags").select("*").eq("team_id", teamRow.id),
        supabase.from("team_member_tags").select("*").eq("team_id", teamRow.id)
      ]);

      setMembers(membersResult.data || []);
      setOwnerUser(ownerResult.data);
      setTags(tagsResult.data || []);
      setMemberTags(memberTagsResult.data || []);

      const invitations = await getTeamPendingInvitations(teamRow.id);
      setPendingInvitations(invitations);

      setLoading(false);
    };

    load();
  }, [userId]);

  useEffect(() => {
    if (!team || !userId) {
      setIsOwner(false);
      setIsAdmin(false);
      return;
    }

    const ownerFlag = team.owner === userId;
    const role = getRoleForUser(userId);

    setIsOwner(ownerFlag);
    setIsAdmin(role === "admin" || ownerFlag);
  }, [team, userId, getRoleForUser]);

  const isInTeam = !!team;

  // Fetch coaching notes and stats for current user when in a team
  useEffect(() => {
    if (!userId || !team) {
      setCoachingNotes([]);
      setStatsLoading(false);
      return;
    }

    const fetchNotesAndStats = async () => {
      setNotesLoading(true);
      setStatsLoading(true);

      try {
        // Fetch coaching notes
        const { data: notesData } = await supabase
          .from("coaching_notes")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (notesData && notesData.length > 0) {
          // Get coach info separately
          const coachIds = [...new Set(notesData.map((n) => n.coach_id).filter(Boolean))];
          let coachMap: Record<string, any> = {};
          if (coachIds.length > 0) {
            const { data: coaches } = await supabase
              .from("users")
              .select("id, email, name")
              .in("id", coachIds);
            if (coaches) {
              coachMap = Object.fromEntries(coaches.map((c) => [c.id, c]));
            }
          }
          const notesWithCoach = notesData.map((note) => ({
            ...note,
            coach: coachMap[note.coach_id] || null,
          }));
          setCoachingNotes(notesWithCoach);
        } else {
          setCoachingNotes([]);
        }

        // Fetch user stats - total calls and scores
        // Filter out calls with null duration or duration < 5 minutes
        const { data: transcripts, error: transcriptsError } = await supabase
          .from("transcripts")
          .select("id, ai_overall_score, created_at, duration")
          .eq("user_id", userId)
          .not("duration", "is", null)
          .gte("duration", 5);

        if (transcriptsError) {
          console.error("Error fetching transcripts:", transcriptsError);
          setMyStats({ totalCalls: 0, avgScore: 0, recentCalls: 0 });
        } else if (transcripts && transcripts.length > 0) {
          const totalCalls = transcripts.length;

          // Calculate average score using ai_overall_score field
          let totalScore = 0;
          let scoredCalls = 0;
          transcripts.forEach((t: any) => {
            if (t.ai_overall_score != null && !isNaN(Number(t.ai_overall_score))) {
              totalScore += Number(t.ai_overall_score);
              scoredCalls++;
            }
          });
          const avgScore = scoredCalls > 0 ? Math.round(totalScore / scoredCalls) : 0;

          // Count recent calls (last 7 days)
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const recentCalls = transcripts.filter(
            (t) => new Date(t.created_at) >= weekAgo
          ).length;

          setMyStats({ totalCalls, avgScore, recentCalls });
        } else {
          setMyStats({ totalCalls: 0, avgScore: 0, recentCalls: 0 });
        }
      } catch (err) {
        console.error("Error fetching stats:", err);
        setMyStats({ totalCalls: 0, avgScore: 0, recentCalls: 0 });
      } finally {
        setNotesLoading(false);
        setStatsLoading(false);
      }
    };

    fetchNotesAndStats();
  }, [userId, team]);

  const handleCreateTeam = async () => {
    if (!createTeamName.trim() || !userId) return;

    setCreateLoading(true);

    const { success, team: newTeam, error } = await createTeam(createTeamName.trim(), userId);

    if (!success || !newTeam) {
      toast.error(error || "Failed to create team");
      setCreateLoading(false);
      return;
    }

    setOpenCreateTeam(false);
    setCreateLoading(false);
    setCreateTeamName("");
    toast.success("Team created successfully!");

    setTeam(newTeam as Team);
    setSettingsTeamName(newTeam.team_name);
    setMembers([user!]);
    setOwnerUser(user);
    setTags([]);
    setMemberTags([]);
    setPendingInvitations([]);
  };

  const handleJoinTeam = async () => {
    if (!joinTeamId.trim() || !userId) return;

    const teamIdNum = Number(joinTeamId.trim());
    if (isNaN(teamIdNum)) {
      toast.error("Team ID must be numeric");
      return;
    }

    setJoinLoading(true);

    const { canJoin, existingTeam } = await canUserJoinTeam(userId);
    if (!canJoin) {
      toast.error(`You are already a member of "${existingTeam}". Leave that team first.`);
      setJoinLoading(false);
      return;
    }

    const { data: teamRow, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamIdNum)
      .single();

    if (error || !teamRow) {
      toast.error("Team not found");
      setJoinLoading(false);
      return;
    }

    const currentMembers: string[] = teamRow.members || [];

    // Check if user is already a member
    if (currentMembers.includes(userId)) {
      toast.info("You are already a member of this team");
      setJoinLoading(false);
      return;
    }

    console.log("Current members:", currentMembers);
    console.log("User ID to add:", userId);

    let updatedTeam = null;

    // Try using RPC function first (most reliable for array operations)
    const { error: rpcError } = await supabase.rpc("append_team_member", {
      team_id_input: teamIdNum,
      user_id_input: userId
    });

    if (rpcError) {
      console.log("RPC not available, using direct update:", rpcError.message);

      // Fallback: Use direct update with explicit array
      const newMembers: string[] = [...currentMembers, userId];
      console.log("New members array:", newMembers);

      const { error: directError } = await supabase
        .from("teams")
        .update({ members: newMembers })
        .eq("id", teamIdNum);

      if (directError) {
        console.error("Error joining team:", directError);
        toast.error(`Failed to join team: ${directError.message}`);
        setJoinLoading(false);
        return;
      }
    }

    // Fetch the updated team data
    const { data: verifyTeam, error: fetchError } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamIdNum)
      .single();

    console.log("Team after update:", verifyTeam);

    if (fetchError || !verifyTeam) {
      toast.error("Failed to fetch team data");
      setJoinLoading(false);
      return;
    }

    // Check if user was added
    if (!verifyTeam.members?.includes(userId)) {
      console.error("User was not added to members array");
      console.log("Expected userId:", userId);
      console.log("Actual members:", verifyTeam.members);
      toast.error("Failed to join team - please contact support");
      setJoinLoading(false);
      return;
    }

    updatedTeam = verifyTeam;

    // Update user's team_id
    const { error: userUpdateError } = await supabase
      .from("users")
      .update({ team_id: teamIdNum })
      .eq("id", userId);

    if (userUpdateError) {
      console.error("Error updating user team_id:", userUpdateError);
    }

    setOpenJoinTeam(false);
    setJoinLoading(false);
    setJoinTeamId("");
    toast.success("Successfully joined the team!");

    setTeam(updatedTeam as Team);
    setSettingsTeamName(updatedTeam.team_name);

    // Ensure Admin and Member tags exist for the team (fixes legacy teams)
    await ensureTeamTags(updatedTeam.id, updatedTeam.owner);

    const [membersResult, ownerResult, tagsResult, memberTagsResult] = await Promise.all([
      updatedTeam.members?.length > 0
        ? supabase.from("users").select("id, name, email").in("id", updatedTeam.members)
        : Promise.resolve({ data: [] }),
      updatedTeam.owner
        ? supabase.from("users").select("id, name, email").eq("id", updatedTeam.owner).single()
        : Promise.resolve({ data: null }),
      supabase.from("team_tags").select("*").eq("team_id", updatedTeam.id),
      supabase.from("team_member_tags").select("*").eq("team_id", updatedTeam.id)
    ]);

    setMembers(membersResult.data || []);
    setOwnerUser(ownerResult.data);
    setTags(tagsResult.data || []);
    setMemberTags(memberTagsResult.data || []);

    const invitations = await getTeamPendingInvitations(updatedTeam.id);
    setPendingInvitations(invitations);
  };

  const handleLeaveTeam = async () => {
    if (!team || !userId) return;

    const { success, error } = await leaveTeam(team.id, userId);

    if (!success) {
      toast.error(error || "Failed to leave team");
      return;
    }

    toast.success("You have left the team");

    setTeam(null);
    setMembers([]);
    setTags([]);
    setMemberTags([]);
    setOwnerUser(null);
    setPendingInvitations([]);
  };

  const removeMember = async (memberId: string) => {
    if (!team || !isAdmin) return;
    if (!confirm("Remove this member from the team?")) return;
    if (memberId === team.owner) {
      toast.error("Cannot remove the team owner");
      return;
    }

    const newMembers = team.members.filter((id) => id !== memberId);

    const { error } = await supabase
      .from("teams")
      .update({ members: newMembers })
      .eq("id", team.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Remove member tags
    await supabase
      .from("team_member_tags")
      .delete()
      .eq("team_id", team.id)
      .eq("user_id", memberId);

    // Clear the user's team_id so they're fully removed from the team
    await supabase
      .from("users")
      .update({ team_id: null })
      .eq("id", memberId);

    toast.success("Member removed successfully");
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setMemberTags((prev) =>
      prev.filter((mt) => !(mt.user_id === memberId && mt.team_id === team.id))
    );
    setTeam((prev) => (prev ? { ...prev, members: newMembers } : prev));
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !team || !userId) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    setInviteLoading(true);
    setGeneratedInviteLink(null);

    const { success, inviteUrl, error } = await createTeamInvitation(
      team.id,
      inviteEmail.trim(),
      userId
    );

    if (!success) {
      toast.error(error || "Failed to send invitation");
      setInviteLoading(false);
      return;
    }

    toast.success("Invitation sent successfully!");
    setGeneratedInviteLink(inviteUrl || null);

    const invitations = await getTeamPendingInvitations(team.id);
    setPendingInvitations(invitations);

    setInviteEmail("");
    setInviteLoading(false);
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!confirm("Revoke this invitation?")) return;

    const success = await revokeInvitation(invitationId);

    if (success) {
      toast.success("Invitation revoked");
      setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    } else {
      toast.error("Failed to revoke invitation");
    }
  };

  const copyInviteLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const copyTeamId = async () => {
    if (!team) return;
    try {
      await navigator.clipboard.writeText(String(team.id));
      toast.success("Team ID copied!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const saveSettings = async () => {
    if (!team || !isAdmin || !settingsTeamName.trim()) return;

    setSettingsSaving(true);

    const { error } = await supabase
      .from("teams")
      .update({ team_name: settingsTeamName.trim() })
      .eq("id", team.id);

    if (error) {
      toast.error("Failed to update team name");
      setSettingsSaving(false);
      return;
    }

    toast.success("Settings saved!");
    setSettingsOpen(false);
    setSettingsSaving(false);
    setTeam((prev) =>
      prev ? { ...prev, team_name: settingsTeamName.trim() } : prev
    );
  };

  const openRoleDialog = (member: UserRow) => {
    if (!team || !isAdmin) return;
    setSelectedMember(member);

    const currentRole = getRoleForUser(member.id);
    setSelectedRole(currentRole === "admin" ? "admin" : "member");
    setRoleDialogOpen(true);
  };

  const openTagAssignment = (member: UserRow) => {
    if (!team || !isAdmin) return;
    setTagAssignmentMember(member);
    setTagAssignmentOpen(true);
  };

  const handleTagsChange = async () => {
    if (!team) return;
    // Refresh tags and member tags
    const [tagsResult, memberTagsResult] = await Promise.all([
      supabase.from("team_tags").select("*").eq("team_id", team.id),
      supabase.from("team_member_tags").select("*").eq("team_id", team.id)
    ]);
    setTags(tagsResult.data || []);
    setMemberTags(memberTagsResult.data || []);
  };

  // Get custom role tags for a member
  const getMemberCustomRoleTags = (memberId: string) => {
    if (!team) return [];
    const userMemberTags = memberTags.filter(
      (mt) => mt.user_id === memberId && mt.team_id === team.id
    );
    const customRoleTags = tags.filter(
      (t) => t.tag_type === "department" && userMemberTags.some((mt) => mt.tag_id === t.id)
    );
    return customRoleTags;
  };

  const saveMemberRole = async () => {
    if (!team || !selectedMember || !isAdmin) return;

    setRoleSaving(true);

    const adminTag = tags.find(
      (t) => t.team_id === team.id && t.tag_name.toLowerCase() === "admin"
    );
    const memberTag = tags.find(
      (t) => t.team_id === team.id && t.tag_name.toLowerCase() === "member"
    );

    if (!adminTag || !memberTag) {
      toast.error("Admin/Member tags not configured for this team.");
      setRoleSaving(false);
      return;
    }

    const uid = selectedMember.id;
    const userMappings = memberTags.filter(
      (mt) => mt.user_id === uid && mt.team_id === team.id
    );

    const hasAdmin = userMappings.some((mt) => mt.tag_id === adminTag.id);
    const hasMember = userMappings.some((mt) => mt.tag_id === memberTag.id);

    if (selectedRole === "admin") {
      if (!hasAdmin) {
        const { data } = await supabase
          .from("team_member_tags")
          .insert({
            team_id: team.id,
            user_id: uid,
            tag_id: adminTag.id,
          })
          .select("*")
          .single();

        if (data) setMemberTags((prev) => [...prev, data as MemberTag]);
      }

      if (hasMember) {
        await supabase
          .from("team_member_tags")
          .delete()
          .eq("team_id", team.id)
          .eq("user_id", uid)
          .eq("tag_id", memberTag.id);

        setMemberTags((prev) =>
          prev.filter(
            (mt) =>
              !(mt.team_id === team.id && mt.user_id === uid && mt.tag_id === memberTag.id)
          )
        );
      }
    } else {
      if (!hasMember) {
        const { data } = await supabase
          .from("team_member_tags")
          .insert({
            team_id: team.id,
            user_id: uid,
            tag_id: memberTag.id,
          })
          .select("*")
          .single();

        if (data) setMemberTags((prev) => [...prev, data as MemberTag]);
      }

      if (hasAdmin) {
        await supabase
          .from("team_member_tags")
          .delete()
          .eq("team_id", team.id)
          .eq("user_id", uid)
          .eq("tag_id", adminTag.id);

        setMemberTags((prev) =>
          prev.filter(
            (mt) =>
              !(mt.team_id === team.id && mt.user_id === uid && mt.tag_id === adminTag.id)
          )
        );
      }
    }

    toast.success("Role updated!");
    setRoleSaving(false);
    setRoleDialogOpen(false);
  };

  const renderRoleBadge = (role: "admin" | "member" | null, isOwnerMember: boolean) => {
    if (isOwnerMember) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-xs">
          <Crown className="h-3 w-3" />
          Owner
        </Badge>
      );
    }
    if (role === "admin") {
      return (
        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 gap-1 text-xs">
          <Shield className="h-3 w-3" />
          Admin
        </Badge>
      );
    }
    if (role === "member") {
      return (
        <Badge variant="outline" className="text-muted-foreground gap-1 text-xs">
          <UserCircle className="h-3 w-3" />
          Member
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground/60 border-dashed gap-1 text-xs">
        No Role
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader heading="Team" />

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-6 py-6 px-4 lg:px-6 max-w-7xl mx-auto w-full">

          {/* ---------------- LOADING STATE ---------------- */}
          {loading && (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading your team...</p>
            </div>
          )}

          {/* ---------------- NO TEAM STATE ---------------- */}
          {!loading && !isInTeam && (
            <div className="flex flex-col items-center justify-center min-h-[400px] py-8">
              <Card className="w-full max-w-lg @container/card shadow-xs bg-gradient-to-t from-primary/5 to-card">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Welcome to Teams</CardTitle>
                  <CardDescription className="max-w-sm mx-auto">
                    Create a collaborative workspace to share sales calls and AI-powered insights with your team.
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-4 pb-6">
                  {/* Features Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-muted/30 text-center">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-[10px] text-muted-foreground">Shared Calls</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-muted/30 text-center">
                      <BarChart3 className="h-4 w-4 text-blue-600" />
                      <span className="text-[10px] text-muted-foreground">Analytics</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-muted/30 text-center">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className="text-[10px] text-muted-foreground">AI Insights</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* CREATE TEAM */}
                    <Dialog open={openCreateTeam} onOpenChange={setOpenCreateTeam}>
                      <DialogTrigger asChild>
                        <Button className="flex-1 gap-1.5">
                          <Plus className="h-4 w-4" />
                          Create Team
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" />
                            Create Your Team
                          </DialogTitle>
                          <DialogDescription>
                            Give your team a name to get started.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="team-name">Team Name</Label>
                            <Input
                              id="team-name"
                              placeholder="e.g., Sales Team, Growth Squad..."
                              value={createTeamName}
                              onChange={(e) => setCreateTeamName(e.target.value)}
                              className="h-10"
                            />
                          </div>
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setOpenCreateTeam(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={handleCreateTeam}
                            disabled={createLoading || !createTeamName.trim()}
                            className="gap-2"
                          >
                            {createLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowRight className="h-4 w-4" />
                            )}
                            {createLoading ? "Creating..." : "Create"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* JOIN TEAM */}
                    <Dialog open={openJoinTeam} onOpenChange={setOpenJoinTeam}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex-1 gap-1.5">
                          <Link2 className="h-4 w-4" />
                          Join Team
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Link2 className="h-5 w-5 text-primary" />
                            Join a Team
                          </DialogTitle>
                          <DialogDescription>
                            Enter the Team ID shared by your team admin.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="team-id">Team ID</Label>
                            <div className="relative">
                              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="team-id"
                                placeholder="Enter numeric Team ID"
                                value={joinTeamId}
                                onChange={(e) => setJoinTeamId(e.target.value)}
                                className="h-10 pl-9"
                              />
                            </div>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setOpenJoinTeam(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={handleJoinTeam}
                            disabled={joinLoading || !joinTeamId.trim()}
                            className="gap-2"
                          >
                            {joinLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowRight className="h-4 w-4" />
                            )}
                            {joinLoading ? "Joining..." : "Join"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <p className="text-center text-[10px] text-muted-foreground mt-4">
                    You can only be a member of one team at a time.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ---------------- TEAM EXISTS STATE ---------------- */}
          {!loading && isInTeam && team && (
            <>
              {/* Team Header Card */}
              <Card className="@container/card border-0 shadow-xs overflow-hidden bg-gradient-to-t from-primary/5 to-card">
                <CardHeader className="pb-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    {/* Left Side - Team Info */}
                    <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                        <Users className="h-7 w-7 text-primary" />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3 flex-wrap">
                          <CardTitle className="text-2xl font-bold tracking-tight">
                            {team.team_name}
                          </CardTitle>
                          <Badge variant="outline" className="gap-1 font-mono text-[10px] px-2 py-0.5 bg-muted/50">
                            <Hash className="h-2.5 w-2.5" />
                            {team.id}
                          </Badge>
                        </div>

                        <CardDescription className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            {members.length} {members.length === 1 ? "member" : "members"}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            Created {formatDate(team.created_at)}
                          </span>
                        </CardDescription>

                        {ownerUser && (
                          <div className="flex items-center gap-2 pt-1">
                            <div className="h-5 w-5 rounded-full bg-amber-500/10 flex items-center justify-center">
                              <Crown className="h-2.5 w-2.5 text-amber-600" />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Owned by <span className="font-medium text-foreground">{ownerUser.name || ownerUser.email}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Side - Actions */}
                    <div className="flex flex-col gap-3 lg:items-end">
                      {/* Status Badge */}
                      <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 w-fit">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                        Active Workspace
                      </Badge>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-8 text-xs"
                          onClick={copyTeamId}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy ID
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-8 text-xs"
                          onClick={() => router.push("/team/analytics")}
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                          Analytics
                        </Button>

                        {isAdmin && (
                          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                                <Settings className="h-3.5 w-3.5" />
                                Settings
                              </Button>
                            </DialogTrigger>

                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <Settings className="h-5 w-5 text-primary" />
                                  Team Settings
                                </DialogTitle>
                                <DialogDescription>
                                  Manage your team configuration
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="settings-name">Team Name</Label>
                                  <Input
                                    id="settings-name"
                                    value={settingsTeamName}
                                    onChange={(e) => setSettingsTeamName(e.target.value)}
                                    className="h-10"
                                  />
                                </div>
                              </div>

                              <DialogFooter>
                                <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                                  Cancel
                                </Button>
                                <Button
                                  onClick={saveSettings}
                                  disabled={settingsSaving || !settingsTeamName.trim()}
                                  className="gap-2"
                                >
                                  {settingsSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                  )}
                                  {settingsSaving ? "Saving..." : "Save Changes"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}

                        {!isOwner && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={handleLeaveTeam}
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            Leave
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Members Card */}
              <Card className="@container/card shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Team Members
                      </CardTitle>
                      <CardDescription>
                        {members.length} {members.length === 1 ? "person" : "people"} in your workspace
                        {pendingInvitations.length > 0 && (
                          <span className="ml-1.5">
                            · <span className="text-amber-600 dark:text-amber-400">{pendingInvitations.length} pending</span>
                          </span>
                        )}
                      </CardDescription>
                    </div>

                    {isAdmin && (
                      <Dialog
                        open={openInviteDialog}
                        onOpenChange={(open) => {
                          setOpenInviteDialog(open);
                          if (!open) {
                            setGeneratedInviteLink(null);
                            setInviteEmail("");
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-1.5 h-8">
                            <UserPlus className="h-3.5 w-3.5" />
                            Invite Member
                          </Button>
                        </DialogTrigger>

                        <DialogContent className="sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <UserPlus className="h-5 w-5 text-primary" />
                              Invite Team Member
                            </DialogTitle>
                            <DialogDescription>
                              Send an email invitation. Users can only be in one team at a time.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Email Address</Label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="colleague@company.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    disabled={inviteLoading}
                                    className="pl-9 h-11"
                                  />
                                </div>
                                <Button
                                  onClick={inviteMember}
                                  disabled={inviteLoading || !inviteEmail.trim()}
                                  className="h-11 px-4"
                                >
                                  {inviteLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Send"
                                  )}
                                </Button>
                              </div>
                            </div>

                            {generatedInviteLink && (
                              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Invitation Created!
                                </div>
                                <div className="flex gap-2">
                                  <Input
                                    value={generatedInviteLink}
                                    readOnly
                                    className="text-xs font-mono bg-white"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => copyInviteLink(generatedInviteLink)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}

                            {pendingInvitations.length > 0 && (
                              <div className="pt-4 border-t space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  Pending Invitations ({pendingInvitations.length})
                                </div>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {pendingInvitations.map((inv) => (
                                    <div
                                      key={inv.id}
                                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="truncate">{inv.email}</span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                                        onClick={() => handleRevokeInvitation(inv.id)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <DialogFooter>
                            <Button variant="outline" onClick={() => setOpenInviteDialog(false)}>
                              Done
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                      <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                        <Users className="h-6 w-6 text-muted-foreground/60" />
                      </div>
                      <p className="font-medium text-sm">No members yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Invite your first team member to get started</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-4">Member</TableHead>
                          <TableHead className="hidden sm:table-cell">Email</TableHead>
                          <TableHead>Role</TableHead>
                          {isAdmin && <TableHead className="text-right pr-4">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {members.map((m) => {
                          const role = getRoleForUser(m.id);
                          const isMemberOwner = team.owner === m.id;
                          const isCurrentUser = m.id === userId;

                          return (
                            <TableRow
                              key={m.id}
                              className="group hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => router.push(`/team/member/${m.id}`)}
                            >
                              <TableCell className="py-3 pl-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <div className={`
                                      h-9 w-9 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0
                                      ${isMemberOwner
                                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                        : role === 'admin'
                                          ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                                          : 'bg-muted text-muted-foreground'
                                      }
                                    `}>
                                      {m.name ? m.name[0].toUpperCase() : m.email[0].toUpperCase()}
                                    </div>
                                    {isMemberOwner && (
                                      <div className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center ring-2 ring-background">
                                        <Crown className="h-2 w-2 text-white" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="font-medium text-sm truncate">
                                        {m.name || "Unnamed User"}
                                      </p>
                                      {isCurrentUser && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                          You
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate sm:hidden">
                                      {m.email}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell className="py-3 hidden sm:table-cell">
                                <span className="text-sm text-muted-foreground truncate">
                                  {m.email}
                                </span>
                              </TableCell>

                              <TableCell className="py-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {renderRoleBadge(role, isMemberOwner)}
                                  {getMemberCustomRoleTags(m.id).map((tag) => (
                                    <Badge
                                      key={tag.id}
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0"
                                      style={{
                                        backgroundColor: tag.tag_color ? `${tag.tag_color}15` : undefined,
                                        borderColor: tag.tag_color || undefined,
                                        color: tag.tag_color || undefined,
                                      }}
                                    >
                                      {tag.tag_name}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>

                              {isAdmin && (
                                <TableCell className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/team/member/${m.id}`);
                                      }}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>

                                    {m.id !== userId && !isMemberOwner && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-600"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openRoleDialog(m);
                                          }}
                                          title="Change role"
                                        >
                                          <Shield className="h-3.5 w-3.5" />
                                        </Button>

                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-emerald-600"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openTagAssignment(m);
                                          }}
                                          title="Assign tags"
                                        >
                                          <Tag className="h-3.5 w-3.5" />
                                        </Button>

                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeMember(m.id);
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Tag Management - Only for Admins */}
              {isAdmin && (
                <TagManagement
                  teamId={team.id}
                  tags={tags}
                  isAdmin={isAdmin}
                  onTagsChange={handleTagsChange}
                />
              )}

              {/* My Stats and Coaching Notes - Side by Side Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* My Stats Card */}
                <Card className="@container/card shadow-xs bg-gradient-to-br from-card to-primary/5">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-primary" />
                          </div>
                          My Performance
                        </CardTitle>
                        <CardDescription className="mt-1">Your personal call statistics</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1.5"
                        onClick={() => router.push("/calls")}
                      >
                        View Calls
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {statsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Phone className="h-5 w-5 text-blue-600" />
                          </div>
                          <span className="text-3xl font-bold text-blue-600">{myStats.totalCalls}</span>
                          <span className="text-xs text-muted-foreground text-center font-medium">Total Calls</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <BarChart3 className="h-5 w-5 text-emerald-600" />
                          </div>
                          <span className={`text-3xl font-bold ${
                            myStats.avgScore >= 80 ? "text-emerald-600" :
                            myStats.avgScore >= 60 ? "text-amber-600" : "text-red-500"
                          }`}>
                            {myStats.avgScore > 0 ? myStats.avgScore : "—"}
                          </span>
                          <span className="text-xs text-muted-foreground text-center font-medium">Avg Score</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                          <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-purple-600" />
                          </div>
                          <span className="text-3xl font-bold text-purple-600">{myStats.recentCalls}</span>
                          <span className="text-xs text-muted-foreground text-center font-medium">This Week</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* My Coaching Notes Card */}
                <Card className="@container/card shadow-xs">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <MessageSquare className="h-4 w-4 text-indigo-600" />
                          </div>
                          My Coaching Notes
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {coachingNotes.length > 0
                            ? `${coachingNotes.length} ${coachingNotes.length === 1 ? "note" : "notes"} from your coaches`
                            : "Feedback from your team coaches"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {notesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : coachingNotes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                          <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No coaching notes yet</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Your coaches will add feedback here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                        {coachingNotes.map((note) => (
                          <div
                            key={note.id}
                            className="p-3 rounded-xl border bg-gradient-to-br from-muted/30 to-muted/10 hover:from-muted/40 hover:to-muted/20 transition-all"
                          >
                            <p className="text-sm leading-relaxed">{note.note}</p>
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40">
                              <div className="flex items-center gap-2">
                                <div className="h-5 w-5 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                  <UserCircle className="h-3 w-3 text-indigo-600" />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {note.coach?.name || note.coach?.email || "Admin"}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground/70">
                                {new Date(note.created_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
          </div>
        </div>
      </SidebarInset>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Change Role
            </DialogTitle>
            <DialogDescription>
              {selectedMember && `Update role for ${selectedMember.name || selectedMember.email}`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <RadioGroup
              value={selectedRole}
              onValueChange={(val) => setSelectedRole(val as "admin" | "member")}
              className="space-y-2"
            >
              <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                <RadioGroupItem value="admin" className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="font-medium text-sm">Admin</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Can invite/remove members and manage settings.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                <RadioGroupItem value="member" className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-sm">Member</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Can view content but cannot manage team.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveMemberRole} disabled={roleSaving} className="gap-2">
              {roleSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {roleSaving ? "Saving..." : "Save Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Assignment Dialog */}
      {team && tagAssignmentMember && (
        <MemberTagAssignment
          open={tagAssignmentOpen}
          onOpenChange={setTagAssignmentOpen}
          teamId={team.id}
          member={tagAssignmentMember}
          allTags={tags}
          currentMemberTags={memberTags.filter(
            (mt) => mt.user_id === tagAssignmentMember.id && mt.team_id === team.id
          )}
          onSave={handleTagsChange}
          isOwner={team.owner === tagAssignmentMember.id}
        />
      )}

      {/* AI Coach */}
      {team && (
        <AskAICoach
          context={{
            type: "team",
            teamId: team.id,
            teamName: team.team_name,
            memberCount: members.length,
            members: members.map((m) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              role: memberTags.some(
                (mt) =>
                  mt.user_id === m.id &&
                  mt.team_id === team.id &&
                  tags.find((t) => t.id === mt.tag_id)?.tag_name.toLowerCase() === "admin"
              )
                ? "admin"
                : "member",
            })),
            pendingInvitations: pendingInvitations.length,
            myStats: myStats,
            coachingNotes: coachingNotes.length,
          }}
          panelTitle="Team Coach"
          placeholder="Ask about your team performance, members, coaching..."
          quickActions={[
            "How is my team performing?",
            "Who needs coaching?",
            "Show team statistics",
            "Suggest improvements",
          ]}
        />
      )}
    </SidebarProvider>
  );
}
