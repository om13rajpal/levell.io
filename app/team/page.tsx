"use client";

import React, { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { supabase } from "@/lib/supabaseClient";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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

  const [openCreateTeam, setOpenCreateTeam] = useState(false);
  const [openJoinTeam, setOpenJoinTeam] = useState(false);
  const [openInviteDialog, setOpenInviteDialog] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTeamName, setSettingsTeamName] = useState("");

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserRow | null>(null);
  const [selectedRole, setSelectedRole] = useState<"admin" | "member">("member");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("sb-rpowalzrbddorfnnmccp-auth-token");

    if (!token) return;

    try {
      const parsed = JSON.parse(token);
      setUserId(parsed.user.id);
    } catch {}
  }, []);

  const getRoleForUser = (
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
  };

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

      const { data: teamRow } = await supabase
        .from("teams")
        .select("*")
        .contains("members", [userId])
        .limit(1)
        .maybeSingle();

      if (!teamRow) {
        setTeam(null);
        setMembers([]);
        setTags([]);
        setMemberTags([]);
        setLoading(false);
        return;
      }

      setTeam(teamRow as Team);
      setSettingsTeamName(teamRow.team_name);

      if ((teamRow.members || []).length > 0) {
        const { data: m } = await supabase
          .from("users")
          .select("id, name, email")
          .in("id", teamRow.members as string[]);
        setMembers(m || []);
      } else {
        setMembers([]);
      }

      if (teamRow.owner) {
        const { data: owner } = await supabase
          .from("users")
          .select("id, name, email")
          .eq("id", teamRow.owner)
          .single();
        setOwnerUser(owner);
      }

      const { data: tagRows } = await supabase
        .from("team_tags")
        .select("*")
        .eq("team_id", teamRow.id);

      setTags(tagRows || []);

      const { data: mt } = await supabase
        .from("team_member_tags")
        .select("*")
        .eq("team_id", teamRow.id);

      setMemberTags(mt || []);

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
  }, [team, userId, tags, memberTags]);

  const isInTeam = !!team;

  const handleCreateTeam = async () => {
    if (!createTeamName.trim() || !userId) return;

    const members = [userId];

    const { error } = await supabase
      .from("teams")
      .insert({
        team_name: createTeamName.trim(),
        owner: userId,
        members,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setOpenCreateTeam(false);
    window.location.reload();
  };

  const handleJoinTeam = async () => {
    if (!joinTeamId.trim() || !userId) return;

    const teamIdNum = Number(joinTeamId.trim());
    if (isNaN(teamIdNum)) return alert("Team ID must be numeric");

    const { data: teamRow, error } = await supabase
      .from("teams")
      .select("id, members")
      .eq("id", teamIdNum)
      .single();

    if (error || !teamRow) return alert("Team not found");

    const newMembers = [...teamRow.members];
    if (!newMembers.includes(userId)) newMembers.push(userId);

    await supabase
      .from("teams")
      .update({ members: newMembers })
      .eq("id", teamIdNum);

    setOpenJoinTeam(false);
    window.location.reload();
  };

  const leaveTeam = async () => {
    if (!team || !userId) return;
    if (team.owner === userId)
      return alert("Owner cannot leave. Transfer ownership first.");

    const newMembers = team.members.filter((id) => id !== userId);

    await supabase.from("teams").update({ members: newMembers }).eq("id", team.id);

    await supabase
      .from("team_member_tags")
      .delete()
      .eq("team_id", team.id)
      .eq("user_id", userId);

    window.location.reload();
  };

  const removeMember = async (memberId: string) => {
    if (!team || !isAdmin) return;
    if (!confirm("Remove this member?")) return;
    if (memberId === team.owner) return alert("Cannot remove owner.");

    const newMembers = team.members.filter((id) => id !== memberId);

    const { error } = await supabase
      .from("teams")
      .update({ members: newMembers })
      .eq("id", team.id);

    if (error) return alert(error.message);

    await supabase
      .from("team_member_tags")
      .delete()
      .eq("team_id", team.id)
      .eq("user_id", memberId);

    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setMemberTags((prev) =>
      prev.filter((mt) => !(mt.user_id === memberId && mt.team_id === team.id))
    );
    setTeam((prev) => (prev ? { ...prev, members: newMembers } : prev));
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return;

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "invite",
      email: inviteEmail.trim(),
    });

    if (error) return alert(error.message);

    alert("Invite link generated: " + data.properties.action_link);
    setInviteEmail("");
    setOpenInviteDialog(false);
  };

  const saveSettings = async () => {
    if (!team || !isAdmin) return;

    await supabase
      .from("teams")
      .update({ team_name: settingsTeamName.trim() })
      .eq("id", team.id);

    setSettingsOpen(false);
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

    const adminTag = tags.find(
      (t) => t.team_id === team.id && t.tag_name.toLowerCase() === "admin"
    );
    const memberTag = tags.find(
      (t) => t.team_id === team.id && t.tag_name.toLowerCase() === "member"
    );

    if (!adminTag || !memberTag) {
      alert("Admin/Member tags not configured.");
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

        setMemberTags((prev) => [...prev, data as MemberTag]);
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

        setMemberTags((prev) => [...prev, data as MemberTag]);
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

    setRoleDialogOpen(false);
  };

  const renderRoleBadge = (role: "admin" | "member" | null) => {
    if (role === "admin") {
      return (
        <Badge className="bg-indigo-500/10 text-indigo-700 border-indigo-500/40 flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Admin
        </Badge>
      );
    }
    if (role === "member") {
      return (
        <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
          Member
        </Badge>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  };

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader heading="Team" />

        <div className="flex flex-col px-4 py-8 lg:py-10 max-w-5xl lg:max-w-6xl mx-auto gap-8">

          {/* ---------------- LOADING ---------------- */}
          {loading && (
            <Card className="border-dashed bg-muted/40 shadow-none">
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">
                  Loading team…
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-3 w-40 rounded-full bg-muted animate-pulse" />
                <div className="h-3 w-72 rounded-full bg-muted animate-pulse" />
              </CardContent>
            </Card>
          )}

          {/* ---------------- NO TEAM ---------------- */}
          {!loading && !isInTeam && (
            <Card className="mt-4 border-0 shadow-lg rounded-2xl bg-gradient-to-br from-card via-card to-card/80">
              <CardHeader className="text-center space-y-3 pb-4">
                <div className="inline-flex items-center justify-center rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/20 mx-auto">
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  No Team Yet
                </div>
                <CardTitle className="text-2xl font-bold">Build Your First Workspace</CardTitle>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Create a shared space for your sales calls, transcripts and AI analysis,
                  or join an existing team with an invite ID.
                </p>
              </CardHeader>

              <CardContent className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center pb-8">
                {/* CREATE TEAM */}
                <Dialog open={openCreateTeam} onOpenChange={setOpenCreateTeam}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto px-8 py-6 rounded-xl shadow-sm hover:shadow-md transition-all">
                      <Plus className="h-4 w-4 mr-2" /> Create Team
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Team</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 mt-2">
                      <Label>Team Name</Label>
                      <Input
                        placeholder="e.g., GTMB Squad"
                        value={createTeamName}
                        onChange={(e) => setCreateTeamName(e.target.value)}
                      />
                    </div>

                    <DialogFooter className="mt-4">
                      <Button onClick={handleCreateTeam}>
                        <Plus className="h-4 w-4 mr-1" /> Create
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* JOIN TEAM */}
                <Dialog open={openJoinTeam} onOpenChange={setOpenJoinTeam}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto px-8 py-6 rounded-xl border-dashed shadow-sm hover:shadow-md transition-all">
                      Join by ID
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Join an Existing Team</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 mt-2">
                      <Label>Team ID</Label>
                      <Input
                        placeholder="Paste numeric ID"
                        value={joinTeamId}
                        onChange={(e) => setJoinTeamId(e.target.value)}
                      />
                    </div>

                    <DialogFooter className="mt-4">
                      <Button onClick={handleJoinTeam}>Join Team</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}

          {/* ---------------- TEAM PAGE ---------------- */}
          {!loading && isInTeam && team && (
            <>
              {/* -------------------------------- Team Header -------------------------------- */}
              <Card className="overflow-hidden border-0 shadow-lg rounded-2xl bg-gradient-to-br from-card via-card to-card/80 backdrop-blur">
                <CardHeader className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between pb-6">
                  <div className="space-y-4 flex-1">
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/20">
                      <Users className="h-3.5 w-3.5" />
                      Collaborative Workspace
                    </div>

                    <div className="space-y-2">
                      <CardTitle className="text-3xl font-bold tracking-tight">
                        {team.team_name}
                      </CardTitle>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                            ID: {team.id}
                          </span>
                        </div>
                        <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/40" />
                        <span className="font-medium">{members.length} {members.length === 1 ? 'member' : 'members'}</span>
                      </div>

                      {ownerUser && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-xs font-semibold text-amber-600">
                            {ownerUser.name ? ownerUser.name[0].toUpperCase() : ownerUser.email[0].toUpperCase()}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            Owned by{" "}
                            <span className="font-semibold text-foreground">
                              {ownerUser.name || ownerUser.email}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:items-end">
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/20">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      Active Now
                    </div>

                    <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                      {isAdmin && (
                        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 rounded-xl shadow-sm hover:shadow">
                              <Settings className="h-4 w-4" />
                              Settings
                            </Button>
                          </DialogTrigger>

                          <DialogContent className="max-w-md rounded-2xl">
                            <DialogHeader>
                              <DialogTitle>Team Settings</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4 mt-3">
                              <div className="space-y-2">
                                <Label>Team Name</Label>
                                <Input
                                  value={settingsTeamName}
                                  onChange={(e) => setSettingsTeamName(e.target.value)}
                                />
                              </div>
                            </div>

                            <DialogFooter className="mt-4">
                              <Button onClick={saveSettings}>Save Changes</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}

                      {!isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={leaveTeam}
                        >
                          <LogOut className="h-4 w-4" />
                          Leave Team
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* -------------------------------- Members Table -------------------------------- */}
              <Card className="rounded-2xl border-0 shadow-md bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-4 flex flex-row justify-between items-center border-b">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold">Team Members</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {members.length} {members.length === 1 ? 'member' : 'members'} in your workspace
                    </p>
                  </div>

                  {isAdmin && (
                    <Dialog open={openInviteDialog} onOpenChange={setOpenInviteDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="rounded-xl gap-2 shadow-sm">
                          <UserPlus className="h-4 w-4" /> Invite Member
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="max-w-md rounded-2xl">
                        <DialogHeader>
                          <DialogTitle>Invite a teammate</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-3 mt-3">
                          <Label>Email</Label>
                          <Input
                            placeholder="person@company.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            They will receive an email with the join link.
                          </p>
                        </div>

                        <DialogFooter className="mt-4">
                          <Button onClick={inviteMember}>Send Invite</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardHeader>

                <CardContent className="pt-0 px-0">
                  <div className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 border-b hover:bg-muted/30">
                          <TableHead className="w-1/3 font-semibold">Name</TableHead>
                          <TableHead className="w-1/3 font-semibold">Email</TableHead>
                          <TableHead className="w-1/6 font-semibold">Role</TableHead>
                          {isAdmin && <TableHead className="text-right w-1/6 font-semibold">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {members.map((m) => {
                          const role = getRoleForUser(m.id);
                          const isMemberOwner = team.owner === m.id;

                          return (
                            <TableRow
                              key={m.id}
                              className="hover:bg-muted/20 transition-all duration-200 border-b last:border-b-0"
                            >
                              <TableCell className="flex items-center gap-3 py-4">
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-sm font-semibold text-primary">
                                  {m.name ? m.name[0].toUpperCase() : m.email[0].toUpperCase()}
                                </span>

                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{m.name || "No name"}</span>
                                  {isMemberOwner && (
                                    <span className="text-[11px] text-amber-600 font-medium">
                                      Team Owner
                                    </span>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>

                              <TableCell>{renderRoleBadge(role)}</TableCell>

                              {isAdmin && (
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {m.id !== userId && !isMemberOwner && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-xs h-8 px-3 hover:bg-primary/10"
                                          onClick={() => openRoleDialog(m)}
                                        >
                                          Change Role
                                        </Button>

                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SidebarInset>

      {/* ---------------- ROLE DIALOG ---------------- */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              Change role {selectedMember && `· ${selectedMember.name || selectedMember.email}`}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <RadioGroup
              value={selectedRole}
              onValueChange={(val) => setSelectedRole(val as "admin" | "member")}
            >
              <label className="flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="admin" />
                <div className="space-y-0.5">
                  <Badge className="bg-indigo-500/10 text-indigo-700 border-indigo-500/40 flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Admin
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Can invite/remove members and manage settings.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/40 mt-2">
                <RadioGroupItem value="member" />
                <div className="space-y-0.5">
                  <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                    Member
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Can view workspace but cannot manage members.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <DialogFooter className="mt-4">
            <Button onClick={saveMemberRole}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}