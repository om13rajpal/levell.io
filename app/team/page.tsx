"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

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

  const [loading, setLoading] = useState(true);

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

    await supabase
      .from("team_member_tags")
      .delete()
      .eq("team_id", team.id)
      .eq("user_id", memberId);

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
        <Badge className="bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1.5 px-2.5 py-1 font-medium shadow-sm">
          <Crown className="h-3.5 w-3.5" />
          Owner
        </Badge>
      );
    }
    if (role === "admin") {
      return (
        <Badge className="bg-gradient-to-r from-indigo-500/15 to-purple-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 gap-1.5 px-2.5 py-1 font-medium shadow-sm">
          <Shield className="h-3.5 w-3.5" />
          Admin
        </Badge>
      );
    }
    if (role === "member") {
      return (
        <Badge variant="outline" className="bg-slate-500/5 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 gap-1.5 px-2.5 py-1 font-medium">
          <UserCircle className="h-3.5 w-3.5" />
          Member
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted/50 border-dashed border-muted-foreground/20 text-muted-foreground gap-1.5 px-2.5 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
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

        <div className="flex flex-col px-4 py-6 lg:px-8 lg:py-8 max-w-6xl mx-auto gap-6 w-full">

          {/* ---------------- LOADING STATE ---------------- */}
          {loading && (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-primary/10 rounded-full blur-xl animate-pulse" />
                <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="font-medium text-foreground">Loading your team</p>
                <p className="text-sm text-muted-foreground">Please wait a moment...</p>
              </div>
            </div>
          )}

          {/* ---------------- NO TEAM STATE ---------------- */}
          {!loading && !isInTeam && (
            <div className="flex flex-col items-center justify-center min-h-[500px]">
              <Card className="w-full max-w-2xl border-0 shadow-2xl rounded-3xl overflow-hidden bg-gradient-to-b from-card to-card/80">
                {/* Hero Section */}
                <div className="relative px-8 pt-12 pb-8 text-center bg-gradient-to-br from-primary/5 via-primary/10 to-transparent">
                  <div className="absolute top-6 left-1/2 -translate-x-1/2">
                    <Sparkles className="h-6 w-6 text-primary/40 animate-pulse" />
                  </div>

                  <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 shadow-lg">
                    <Users className="h-10 w-10 text-primary" />
                  </div>

                  <h1 className="text-3xl font-bold tracking-tight mb-3">
                    Welcome to Teams
                  </h1>
                  <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Create a collaborative workspace to share sales calls, transcripts,
                    and AI-powered insights with your team.
                  </p>
                </div>

                {/* Features Grid */}
                <div className="px-8 py-6 border-t border-border/50">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Shared Transcripts</p>
                        <p className="text-xs text-muted-foreground">Access all team calls</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Team Analytics</p>
                        <p className="text-xs text-muted-foreground">Track performance</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                      <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">AI Insights</p>
                        <p className="text-xs text-muted-foreground">Smart recommendations</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <CardContent className="px-8 pb-10 pt-2">
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {/* CREATE TEAM */}
                    <Dialog open={openCreateTeam} onOpenChange={setOpenCreateTeam}>
                      <DialogTrigger asChild>
                        <Button size="lg" className="gap-2 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all">
                          <Plus className="h-5 w-5" />
                          Create New Team
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="max-w-md rounded-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" />
                            Create Your Team
                          </DialogTitle>
                          <DialogDescription>
                            Give your team a name to get started. You can invite members after creation.
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
                              className="h-11"
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
                            {createLoading ? "Creating..." : "Create Team"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* JOIN TEAM */}
                    <Dialog open={openJoinTeam} onOpenChange={setOpenJoinTeam}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="lg" className="gap-2 px-8 rounded-xl border-dashed">
                          <Link2 className="h-5 w-5" />
                          Join Existing Team
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="max-w-md rounded-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Link2 className="h-5 w-5 text-primary" />
                            Join a Team
                          </DialogTitle>
                          <DialogDescription>
                            Enter the Team ID shared by your team admin to join.
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
                                className="h-11 pl-9"
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
                            {joinLoading ? "Joining..." : "Join Team"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <p className="text-center text-xs text-muted-foreground mt-6">
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
              <Card className="border-0 shadow-xl rounded-2xl overflow-hidden bg-gradient-to-br from-card via-card to-card/90">
                <div className="relative">
                  {/* Background Pattern */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />

                  <CardHeader className="relative pb-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                      {/* Left Side - Team Info */}
                      <div className="flex items-start gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-lg shrink-0">
                          <Users className="h-8 w-8 text-primary" />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-2xl lg:text-3xl font-bold tracking-tight">
                              {team.team_name}
                            </CardTitle>
                            <Badge variant="outline" className="gap-1 font-mono text-xs">
                              <Hash className="h-3 w-3" />
                              {team.id}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-4 w-4" />
                              <span>{members.length} {members.length === 1 ? "member" : "members"}</span>
                            </div>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-4 w-4" />
                              <span>Created {formatDate(team.created_at)}</span>
                            </div>
                          </div>

                          {ownerUser && (
                            <div className="flex items-center gap-2 pt-1">
                              <div className="h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                                <Crown className="h-3 w-3 text-amber-600" />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Owned by <span className="font-semibold text-foreground">{ownerUser.name || ownerUser.email}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Side - Actions */}
                      <div className="flex flex-col gap-3 lg:items-end">
                        {/* Status Badge */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 text-xs font-medium w-fit">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                          Active Workspace
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 rounded-xl"
                            onClick={copyTeamId}
                          >
                            <Copy className="h-4 w-4" />
                            Copy ID
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 rounded-xl"
                            onClick={() => router.push("/team/analytics")}
                          >
                            <BarChart3 className="h-4 w-4" />
                            Analytics
                          </Button>

                          {isAdmin && (
                            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                                  <Settings className="h-4 w-4" />
                                  Settings
                                </Button>
                              </DialogTrigger>

                              <DialogContent className="max-w-md rounded-2xl">
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
                                      className="h-11"
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
                              className="gap-2 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={handleLeaveTeam}
                            >
                              <LogOut className="h-4 w-4" />
                              Leave
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </div>
              </Card>

              {/* Members Card */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="pb-4 border-b bg-muted/30">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Team Members
                      </CardTitle>
                      <CardDescription>
                        {members.length} {members.length === 1 ? "person" : "people"} in your workspace
                        {pendingInvitations.length > 0 && (
                          <span className="ml-2 text-amber-600">
                            ({pendingInvitations.length} pending)
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
                          <Button className="gap-2 rounded-xl shadow-md">
                            <UserPlus className="h-4 w-4" />
                            Invite Member
                          </Button>
                        </DialogTrigger>

                        <DialogContent className="max-w-lg rounded-2xl">
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
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium">No members yet</p>
                      <p className="text-sm text-muted-foreground">Invite your first team member to get started</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-muted/40 via-muted/30 to-muted/40 hover:bg-muted/40 border-b border-border/50">
                            <TableHead className="font-semibold text-foreground/80 py-4 pl-6">Member</TableHead>
                            <TableHead className="font-semibold text-foreground/80 py-4 hidden sm:table-cell">Email</TableHead>
                            <TableHead className="font-semibold text-foreground/80 py-4">Role</TableHead>
                            {isAdmin && <TableHead className="text-right font-semibold text-foreground/80 py-4 pr-6">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {members.map((m, index) => {
                            const role = getRoleForUser(m.id);
                            const isMemberOwner = team.owner === m.id;
                            const isCurrentUser = m.id === userId;

                            return (
                              <TableRow
                                key={m.id}
                                className={`
                                  group transition-all duration-200
                                  hover:bg-gradient-to-r hover:from-primary/5 hover:via-primary/3 hover:to-transparent
                                  ${index !== members.length - 1 ? 'border-b border-border/30' : ''}
                                  ${isCurrentUser ? 'bg-primary/[0.02]' : ''}
                                `}
                              >
                                <TableCell className="py-5 pl-6">
                                  <div className="flex items-center gap-4">
                                    <div className="relative">
                                      <div className={`
                                        h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0
                                        shadow-sm transition-transform duration-200 group-hover:scale-105
                                        ${isMemberOwner
                                          ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-700 ring-2 ring-amber-500/20'
                                          : role === 'admin'
                                            ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-700 ring-2 ring-indigo-500/20'
                                            : 'bg-gradient-to-br from-slate-200 to-slate-100 text-slate-600 dark:from-slate-700 dark:to-slate-800 dark:text-slate-300'
                                        }
                                      `}>
                                        {m.name ? m.name[0].toUpperCase() : m.email[0].toUpperCase()}
                                      </div>
                                      {isMemberOwner && (
                                        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-card">
                                          <Crown className="h-3 w-3 text-white" />
                                        </div>
                                      )}
                                      {isCurrentUser && !isMemberOwner && (
                                        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-card" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-semibold text-foreground truncate">
                                          {m.name || "Unnamed User"}
                                        </p>
                                        {isCurrentUser && (
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                                            You
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground truncate sm:hidden mt-0.5">
                                        {m.email}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>

                                <TableCell className="py-5 hidden sm:table-cell">
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground/50" />
                                    <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                                      {m.email}
                                    </span>
                                  </div>
                                </TableCell>

                                <TableCell className="py-5">
                                  {renderRoleBadge(role, isMemberOwner)}
                                </TableCell>

                                {isAdmin && (
                                  <TableCell className="py-5 pr-6">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-3 text-xs font-medium hover:bg-primary/10 rounded-lg"
                                        onClick={() => router.push(`/team/member/${m.id}`)}
                                      >
                                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                                        View
                                      </Button>

                                      {m.id !== userId && !isMemberOwner && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-3 text-xs font-medium hover:bg-indigo-500/10 hover:text-indigo-700 rounded-lg"
                                            onClick={() => openRoleDialog(m)}
                                          >
                                            <Shield className="h-3.5 w-3.5 mr-1.5" />
                                            Role
                                          </Button>

                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                            onClick={() => removeMember(m.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
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
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SidebarInset>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
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
              className="space-y-3"
            >
              <label className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="admin" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-indigo-600" />
                    <span className="font-medium">Admin</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Can invite/remove members, manage settings, and access all team features.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="member" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Member</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Can view workspace content but cannot manage team settings or members.
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
    </SidebarProvider>
  );
}
