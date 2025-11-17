"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

import {
  Users,
  LogOut,
  Settings,
  Plus,
  UserPlus,
  Tag,
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
  created_at: string;
};

type TagPermissions = {
  manage_team_name: boolean;
  manage_team_delete: boolean;
  manage_invites: boolean;
  manage_members: boolean;
  remove_members: boolean;
  manage_tags: boolean;
  create_projects: boolean;
  delete_projects: boolean;
  assign_tasks: boolean;
  view_calls: boolean;
  export_calls: boolean;
  analyze_calls: boolean;
  access_ai_tools: boolean;
  configure_ai_settings: boolean;
};

type TeamTag = {
  id: number;
  team_id: number;
  tag_name: string;
  permissions: TagPermissions;
  tag_color: string | null;
  created_at: string;
};

type MemberTag = {
  id: string;
  team_id: number;
  user_id: string;
  tag_ids: number[];
  created_at: string;
};

const defaultPermissions: TagPermissions = {
  manage_team_name: false,
  manage_team_delete: false,
  manage_invites: false,
  manage_members: false,
  remove_members: false,
  manage_tags: false,
  create_projects: false,
  delete_projects: false,
  assign_tasks: false,
  view_calls: true,
  export_calls: false,
  analyze_calls: false,
  access_ai_tools: true,
  configure_ai_settings: false,
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

  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TeamTag | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("");
  const [tagPermissions, setTagPermissions] =
    useState<TagPermissions>(defaultPermissions);

  const [assignTagsOpen, setAssignTagsOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserRow | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTeamName, setSettingsTeamName] = useState("");

  // -------------------------------------------------------
  // 1. READ AUTH USER ID FROM LOCAL STORAGE
  // -------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("sb-rpowalzrbddorfnnmccp-auth-token");

    if (!token) return;

    try {
      const parsed = JSON.parse(token);
      setUserId(parsed.user.id);
    } catch {}
  }, []);

  // -------------------------------------------------------
  // 2. LOAD USER + TEAM
  // -------------------------------------------------------
  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      // get user
      const { data: u } = await supabase
        .from("users")
        .select("id, name, email, created_at")
        .eq("id", userId)
        .single();

      setUser(u);

      // get team where user is inside team.members
      const { data: teamRow, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .contains("members", [userId])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!teamRow || teamError) {
        setTeam(null);
        return;
      }

      setTeam(teamRow as Team);
      setSettingsTeamName(teamRow.team_name);

      // load members
      if ((teamRow.members || []).length > 0) {
        const { data: m } = await supabase
          .from("users")
          .select("id, name, email, created_at")
          .in("id", teamRow.members as string[]);
        setMembers(m || []);
      }

      // load owner
      if (teamRow.owner) {
        const { data: owner } = await supabase
          .from("users")
          .select("id, name, email, created_at")
          .eq("id", teamRow.owner)
          .single();
        setOwnerUser(owner);
      }

      // load tags
      const { data: tagRows } = await supabase
        .from("team_tags")
        .select("*")
        .eq("team_id", teamRow.id);

      setTags(
        (tagRows || []).map((t: any) => ({
          ...t,
          permissions: { ...defaultPermissions, ...(t.permissions || {}) },
        }))
      );

      // load member-tags
      const { data: mt } = await supabase
        .from("team_member_tags")
        .select("*")
        .eq("team_id", teamRow.id);

      setMemberTags(mt || []);
    };

    load();
  }, [userId]);

  const isInTeam = !!team;
  const isOwner = team && userId === team.owner;

  const getTagsForUser = (uid: string) => {
    const row = memberTags.find((m) => m.user_id === uid);
    if (!row) return [];
    return tags.filter((t) => row.tag_ids.includes(t.id));
  };

  // -------------------------------------------------------
  // CREATE TEAM
  // -------------------------------------------------------
  const handleCreateTeam = async () => {
    if (!createTeamName.trim() || !userId) return;

    const members = [userId];

    const { data, error } = await supabase
      .from("teams")
      .insert({
        team_name: createTeamName.trim(),
        owner: userId,
        members,
      })
      .select("*")
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setOpenCreateTeam(false);
    window.location.reload();
  };

  // -------------------------------------------------------
  // JOIN TEAM
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // LEAVE TEAM
  // -------------------------------------------------------
  const leaveTeam = async () => {
    if (!team || !userId) return;
    if (team.owner === userId)
      return alert("Owner cannot leave. Transfer ownership.");

    const newMembers = team.members.filter((id) => id !== userId);

    await supabase
      .from("teams")
      .update({ members: newMembers })
      .eq("id", team.id);

    window.location.reload();
  };

  // -------------------------------------------------------
  // INVITE MEMBER
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // TAG CREATION / EDITING
  // -------------------------------------------------------
  const openCreateTag = () => {
    setEditingTag(null);
    setTagName("");
    setTagColor("");
    setTagPermissions(defaultPermissions);
    setTagDialogOpen(true);
  };

  const openEditTag = (tag: TeamTag) => {
    setEditingTag(tag);
    setTagName(tag.tag_name);
    setTagColor(tag.tag_color || "");
    setTagPermissions({ ...defaultPermissions, ...tag.permissions });
    setTagDialogOpen(true);
  };

  const saveTag = async () => {
    if (!team || !tagName.trim()) return;

    const payload = {
      team_id: team.id,
      tag_name: tagName.trim(),
      tag_color: tagColor || null,
      permissions: tagPermissions,
    };

    if (editingTag) {
      const { data, error } = await supabase
        .from("team_tags")
        .update(payload)
        .eq("id", editingTag.id)
        .select("*")
        .single();

      if (error) return alert(error.message);

      setTags(
        tags.map((t) =>
          t.id === editingTag.id
            ? { ...data, permissions: { ...defaultPermissions, ...data.permissions } }
            : t
        )
      );
    } else {
      const { data, error } = await supabase
        .from("team_tags")
        .insert(payload)
        .select("*")
        .single();

      if (error) return alert(error.message);

      setTags([
        ...tags,
        { ...data, permissions: { ...defaultPermissions, ...data.permissions } },
      ]);
    }

    setTagDialogOpen(false);
  };

  const deleteTag = async (tagId: number) => {
    if (!confirm("Delete tag?")) return;

    await supabase.from("team_tags").delete().eq("id", tagId);

    const updated = memberTags.map((mt) => ({
      ...mt,
      tag_ids: mt.tag_ids.filter((id) => id !== tagId),
    }));

    setMemberTags(updated);
    setTags(tags.filter((t) => t.id !== tagId));
  };

  // -------------------------------------------------------
  // ASSIGN TAGS
  // -------------------------------------------------------
  const openAssignTags = (m: UserRow) => {
    setSelectedMember(m);
    setAssignTagsOpen(true);
  };

  const toggleMemberTag = (tagId: number, checked: boolean) => {
    if (!selectedMember || !team) return;
    const uid = selectedMember.id;

    const existing = memberTags.find(
      (mt) => mt.user_id === uid && mt.team_id === team.id
    );

    if (!existing) {
      if (!checked) return;
      setMemberTags((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          team_id: team.id,
          user_id: uid,
          tag_ids: [tagId],
          created_at: new Date().toISOString(),
        },
      ]);
      return;
    }

    const newSet = new Set(existing.tag_ids);

    if (checked) newSet.add(tagId);
    else newSet.delete(tagId);

    const updated = { ...existing, tag_ids: Array.from(newSet) };

    setMemberTags((prev) =>
      prev.map((mt) => (mt.id === existing.id ? updated : mt))
    );
  };

  const saveMemberTags = async () => {
    if (!selectedMember || !team) return;

    const row = memberTags.find(
      (mt) => mt.user_id === selectedMember.id && mt.team_id === team.id
    );

    if (!row) {
      setAssignTagsOpen(false);
      return;
    }

    await supabase
      .from("team_member_tags")
      .upsert(row, { onConflict: "id" });

    setAssignTagsOpen(false);
  };

  // -------------------------------------------------------
  // SETTINGS
  // -------------------------------------------------------
  const saveSettings = async () => {
    if (!team) return;

    await supabase
      .from("teams")
      .update({ team_name: settingsTeamName.trim() })
      .eq("id", team.id);

    setSettingsOpen(false);
    window.location.reload();
  };

  // -------------------------------------------------------
  // UI STARTS
  // -------------------------------------------------------
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader heading="Team" />

        <div className="flex flex-col px-4 py-8 max-w-5xl mx-auto gap-8">

          {/* NOT IN TEAM */}
          {!isInTeam && (
            <Card className="mt-10 border-dashed bg-muted/40 shadow-none">
              <CardHeader className="text-center space-y-2">
                <CardTitle className="text-xl font-semibold">
                  Build your first team
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Create a workspace for your crew or join an existing one to
                  start collaborating.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                {/* CREATE TEAM BUTTON */}
                <Dialog open={openCreateTeam} onOpenChange={setOpenCreateTeam}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto px-6 py-5 text-lg flex gap-2">
                      <Plus className="h-5 w-5" /> Create Team
                    </Button>
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Team</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 mt-2">
                      <Label>Team Name</Label>
                      <Input
                        placeholder="Sales Team, RevOps Squad..."
                        value={createTeamName}
                        onChange={(e) => setCreateTeamName(e.target.value)}
                      />
                    </div>

                    <DialogFooter>
                      <Button onClick={handleCreateTeam}>Create</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* JOIN TEAM BUTTON */}
                <Dialog open={openJoinTeam} onOpenChange={setOpenJoinTeam}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto px-6 py-5 text-lg"
                    >
                      Join Team
                    </Button>
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Join Team</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 mt-2">
                      <Label>Team ID</Label>
                      <Input
                        placeholder="Numeric Team ID"
                        value={joinTeamId}
                        onChange={(e) => setJoinTeamId(e.target.value)}
                      />
                    </div>

                    <DialogFooter>
                      <Button onClick={handleJoinTeam}>Join</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}

          {/* IN TEAM */}
          {isInTeam && team && (
            <>
              {/* TEAM HEADER */}
              <Card>
                <CardHeader className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg">
                      {team.team_name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Team ID: {team.id} · {members.length} members
                    </p>

                    {ownerUser && !isOwner && (
                      <p className="text-xs text-muted-foreground">
                        Team Leader:{" "}
                        <span className="font-medium">
                          {ownerUser.name || ownerUser.email}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {isOwner && (
                      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4 mr-1" />
                            Settings
                          </Button>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Team Settings</DialogTitle>
                          </DialogHeader>

                          <div className="space-y-4 mt-3">
                            <Label>Team Name</Label>
                            <Input
                              value={settingsTeamName}
                              onChange={(e) =>
                                setSettingsTeamName(e.target.value)
                              }
                            />
                          </div>

                          <DialogFooter>
                            <Button onClick={saveSettings}>Save</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {!isOwner && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={leaveTeam}
                      >
                        <LogOut className="h-4 w-4 mr-1" />
                        Leave
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {/* TABS */}
              <Tabs defaultValue="members">
                <TabsList className="grid grid-cols-2 max-w-md">
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="tags">Tags</TabsTrigger>
                </TabsList>

                {/* MEMBERS TAB */}
                <TabsContent value="members" className="mt-6">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-sm text-muted-foreground">
                      Team Members
                    </h2>

                    {isOwner && (
                      <Dialog
                        open={openInviteDialog}
                        onOpenChange={setOpenInviteDialog}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <UserPlus className="h-4 w-4 mr-1" /> Invite
                          </Button>
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Invite Member</DialogTitle>
                          </DialogHeader>

                          <div className="space-y-3 mt-3">
                            <Label>Email</Label>
                            <Input
                              placeholder="person@company.com"
                              value={inviteEmail}
                              onChange={(e) =>
                                setInviteEmail(e.target.value)
                              }
                            />
                          </div>

                          <DialogFooter>
                            <Button onClick={inviteMember}>Send Invite</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Members</CardTitle>
                    </CardHeader>

                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Tags</TableHead>
                            <TableHead>Joined</TableHead>
                            {isOwner && <TableHead />}
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {members.map((m) => {
                            const userTags = getTagsForUser(m.id);
                            const isMemberOwner = team.owner === m.id;

                            return (
                              <TableRow key={m.id}>
                                <TableCell className="flex items-center gap-2">
                                  {m.name || "No name"}
                                  {isMemberOwner && (
                                    <Badge variant="outline">Owner</Badge>
                                  )}
                                </TableCell>

                                <TableCell>{m.email}</TableCell>

                                <TableCell className="space-x-1">
                                  {userTags.map((t) => (
                                    <Badge key={t.id} variant="outline">
                                      {t.tag_name}
                                    </Badge>
                                  ))}
                                  {userTags.length === 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>

                                <TableCell>
                                  {new Date(m.created_at).toLocaleDateString()}
                                </TableCell>

                                {isOwner && (
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openAssignTags(m)}
                                    >
                                      Manage
                                    </Button>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* TAGS TAB */}
                <TabsContent value="tags" className="mt-6">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-sm text-muted-foreground">Tags</h2>

                    {isOwner && (
                      <Button size="sm" onClick={openCreateTag}>
                        <Tag className="h-4 w-4 mr-1" />
                        Create Tag
                      </Button>
                    )}
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tags</CardTitle>
                    </CardHeader>

                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Permissions</TableHead>
                            <TableHead>Created</TableHead>
                            {isOwner && <TableHead />}
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {tags.map((tag) => (
                            <TableRow key={tag.id}>
                              <TableCell className="flex items-center gap-2">
                                <span
                                  className="h-3 w-3 rounded-full border"
                                  style={{ backgroundColor: tag.tag_color || "transparent" }}
                                />
                                {tag.tag_name}
                              </TableCell>

                              <TableCell>
                                {
                                  Object.values(tag.permissions).filter(Boolean)
                                    .length
                                }{" "}
                                enabled
                              </TableCell>

                              <TableCell>
                                {new Date(tag.created_at).toLocaleDateString()}
                              </TableCell>

                              {isOwner && (
                                <TableCell className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditTag(tag)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => deleteTag(tag.id)}
                                  >
                                    Delete
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </SidebarInset>

      {/* TAG DIALOG */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? "Edit Tag" : "Create Tag"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4 max-h-[60vh] overflow-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tag Name</Label>
                <Input
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                />
              </div>

              <div>
                <Label>Tag Color</Label>
                <Input
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              {Object.keys(defaultPermissions).map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between border-b pb-2"
                >
                  <span className="text-sm">{key.replace(/_/g, " ")}</span>
                  <Switch
                    checked={tagPermissions[key as keyof TagPermissions]}
                    onCheckedChange={(v) =>
                      setTagPermissions((prev) => ({
                        ...prev,
                        [key]: v,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={saveTag}>
              {editingTag ? "Save Changes" : "Create Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ASSIGN TAGS */}
      <Dialog open={assignTagsOpen} onOpenChange={setAssignTagsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assign Tags {selectedMember && `· ${selectedMember.name || selectedMember.email}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[50vh] overflow-auto">
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground">No tags created yet.</p>
            )}

            {tags.map((tag) => {
              const userTags = getTagsForUser(selectedMember?.id || "");
              const hasTag = userTags.some((t) => t.id === tag.id);

              return (
                <div key={tag.id} className="flex justify-between items-center py-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border"
                      style={{ backgroundColor: tag.tag_color || "transparent" }}
                    />
                    <span>{tag.tag_name}</span>
                  </div>

                  <Switch
                    checked={hasTag}
                    onCheckedChange={(v) => toggleMemberTag(tag.id, v)}
                  />
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button onClick={saveMemberTags}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}