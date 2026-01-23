"use client";

import React, { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import {
  Plus,
  Tag,
  Pencil,
  Trash2,
  Loader2,
  Shield,
  Briefcase,
  Users,
  AlertTriangle,
  Check,
  Sparkles,
} from "lucide-react";

// Type definition for TeamTag
type TeamTag = {
  id: number;
  team_id: number;
  tag_name: string;
  tag_color: string | null;
  tag_type?: "role" | "department";
  description?: string;
  created_at: string;
};

// Preset colors for the color picker
const PRESET_COLORS = [
  { name: "Red", value: "#ef4444", bg: "bg-red-500", ring: "ring-red-500" },
  { name: "Orange", value: "#f97316", bg: "bg-orange-500", ring: "ring-orange-500" },
  { name: "Amber", value: "#f59e0b", bg: "bg-amber-500", ring: "ring-amber-500" },
  { name: "Green", value: "#22c55e", bg: "bg-green-500", ring: "ring-green-500" },
  { name: "Teal", value: "#14b8a6", bg: "bg-teal-500", ring: "ring-teal-500" },
  { name: "Blue", value: "#3b82f6", bg: "bg-blue-500", ring: "ring-blue-500" },
  { name: "Indigo", value: "#6366f1", bg: "bg-indigo-500", ring: "ring-indigo-500" },
  { name: "Purple", value: "#a855f7", bg: "bg-purple-500", ring: "ring-purple-500" },
  { name: "Pink", value: "#ec4899", bg: "bg-pink-500", ring: "ring-pink-500" },
  { name: "Rose", value: "#f43f5e", bg: "bg-rose-500", ring: "ring-rose-500" },
];

// Protected role tag names that cannot be deleted
const PROTECTED_ROLE_TAGS = ["admin", "member"];

interface TagManagementProps {
  teamId: number;
  tags: TeamTag[];
  isAdmin: boolean;
  onTagsChange: () => void;
}

export default function TagManagement({
  teamId,
  tags,
  isAdmin,
  onTagsChange,
}: TagManagementProps) {
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form states for create
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[5].value); // Default to blue
  const [newTagDescription, setNewTagDescription] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Form states for edit
  const [editingTag, setEditingTag] = useState<TeamTag | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");
  const [editTagDescription, setEditTagDescription] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Delete state
  const [deletingTag, setDeletingTag] = useState<TeamTag | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Separate tags by type - system roles vs custom roles
  const systemRoleTags = tags.filter(
    (t) => t.tag_type === "role" || PROTECTED_ROLE_TAGS.includes(t.tag_name.toLowerCase())
  );
  const customRoleTags = tags.filter(
    (t) => t.tag_type === "department" && !PROTECTED_ROLE_TAGS.includes(t.tag_name.toLowerCase())
  );

  // Check if a tag is protected (cannot be deleted)
  const isProtectedTag = useCallback((tag: TeamTag): boolean => {
    return PROTECTED_ROLE_TAGS.includes(tag.tag_name.toLowerCase());
  }, []);

  // Reset create form
  const resetCreateForm = () => {
    setNewTagName("");
    setNewTagColor(PRESET_COLORS[5].value);
    setNewTagDescription("");
  };

  // Handle create tag
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error("Role name is required");
      return;
    }

    // Check for duplicate names
    const nameExists = tags.some(
      (t) => t.tag_name.toLowerCase() === newTagName.trim().toLowerCase()
    );
    if (nameExists) {
      toast.error("A role with this name already exists");
      return;
    }

    setCreateLoading(true);

    try {
      const { error } = await supabase.from("team_tags").insert({
        team_id: teamId,
        tag_name: newTagName.trim(),
        tag_color: newTagColor,
        tag_type: "department",
        description: newTagDescription.trim() || undefined,
      });

      if (error) {
        console.error("Error creating tag:", error);
        toast.error("Failed to create role");
        return;
      }

      toast.success("Role created successfully");
      setCreateDialogOpen(false);
      resetCreateForm();
      onTagsChange();
    } catch (err) {
      console.error("Error creating tag:", err);
      toast.error("An error occurred while creating the role");
    } finally {
      setCreateLoading(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (tag: TeamTag) => {
    setEditingTag(tag);
    setEditTagName(tag.tag_name);
    setEditTagColor(tag.tag_color || PRESET_COLORS[5].value);
    setEditTagDescription(tag.description || "");
    setEditDialogOpen(true);
  };

  // Handle edit tag
  const handleEditTag = async () => {
    if (!editingTag || !editTagName.trim()) {
      toast.error("Role name is required");
      return;
    }

    // Check for duplicate names (excluding current tag)
    const nameExists = tags.some(
      (t) =>
        t.id !== editingTag.id &&
        t.tag_name.toLowerCase() === editTagName.trim().toLowerCase()
    );
    if (nameExists) {
      toast.error("A role with this name already exists");
      return;
    }

    // Prevent renaming protected tags
    if (isProtectedTag(editingTag)) {
      if (editTagName.trim().toLowerCase() !== editingTag.tag_name.toLowerCase()) {
        toast.error("Cannot rename Admin or Member system roles");
        return;
      }
    }

    setEditLoading(true);

    try {
      const updateData: Partial<TeamTag> = {
        tag_color: editTagColor,
        description: editTagDescription.trim() || undefined,
      };

      // Only update name if it's not a protected tag
      if (!isProtectedTag(editingTag)) {
        updateData.tag_name = editTagName.trim();
      }

      const { error } = await supabase
        .from("team_tags")
        .update(updateData)
        .eq("id", editingTag.id);

      if (error) {
        console.error("Error updating tag:", error);
        toast.error("Failed to update role");
        return;
      }

      toast.success("Role updated successfully");
      setEditDialogOpen(false);
      setEditingTag(null);
      onTagsChange();
    } catch (err) {
      console.error("Error updating tag:", err);
      toast.error("An error occurred while updating the role");
    } finally {
      setEditLoading(false);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (tag: TeamTag) => {
    if (isProtectedTag(tag)) {
      toast.error("Cannot delete Admin or Member system roles");
      return;
    }
    setDeletingTag(tag);
    setDeleteDialogOpen(true);
  };

  // Handle delete tag
  const handleDeleteTag = async () => {
    if (!deletingTag) return;

    if (isProtectedTag(deletingTag)) {
      toast.error("Cannot delete Admin or Member system roles");
      setDeleteDialogOpen(false);
      setDeletingTag(null);
      return;
    }

    setDeleteLoading(true);

    try {
      // First, remove all member-tag associations
      await supabase
        .from("team_member_tags")
        .delete()
        .eq("tag_id", deletingTag.id);

      // Then delete the tag
      const { error } = await supabase
        .from("team_tags")
        .delete()
        .eq("id", deletingTag.id);

      if (error) {
        console.error("Error deleting tag:", error);
        toast.error("Failed to delete role");
        return;
      }

      toast.success("Role deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingTag(null);
      onTagsChange();
    } catch (err) {
      console.error("Error deleting tag:", err);
      toast.error("An error occurred while deleting the role");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Render a single tag card
  const renderTagCard = (tag: TeamTag, isSystem: boolean = false) => {
    const isProtected = isProtectedTag(tag);

    return (
      <div
        key={tag.id}
        className={`
          group relative flex items-start gap-3 p-4 rounded-xl border bg-card
          transition-all duration-200
          ${!isProtected && isAdmin ? "hover:shadow-md hover:border-primary/30 cursor-pointer" : ""}
          ${isProtected ? "border-dashed bg-muted/30" : "hover:bg-accent/5"}
        `}
        onClick={() => !isProtected && isAdmin && openEditDialog(tag)}
      >
        {/* Color indicator */}
        <div
          className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center shadow-sm"
          style={{ backgroundColor: tag.tag_color || "#6366f1" }}
        >
          {isSystem ? (
            <Shield className="h-5 w-5 text-white" />
          ) : (
            <Briefcase className="h-5 w-5 text-white" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{tag.tag_name}</span>
            {isProtected && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 bg-muted border-0"
              >
                System
              </Badge>
            )}
          </div>
          {tag.description ? (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {tag.description}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/60 italic">
              No description
            </p>
          )}
        </div>

        {/* Action buttons */}
        {isAdmin && (
          <div className={`
            flex items-center gap-1
            ${isProtected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
            transition-opacity duration-200
          `}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                openEditDialog(tag);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {!isProtected && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteDialog(tag);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Color picker component
  const ColorPicker = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (color: string) => void;
  }) => (
    <div className="grid grid-cols-5 gap-2">
      {PRESET_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          className={`
            h-9 w-full rounded-lg transition-all duration-200 relative
            ${color.bg}
            ${value === color.value
              ? "ring-2 ring-offset-2 ring-offset-background " + color.ring + " scale-105"
              : "hover:scale-110 hover:shadow-md"}
          `}
          onClick={() => onChange(color.value)}
          title={color.name}
        >
          {value === color.value && (
            <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />
          )}
        </button>
      ))}
    </div>
  );

  return (
    <Card className="@container/card shadow-sm border-0 bg-gradient-to-b from-card to-card/80">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Tag className="h-4 w-4 text-primary" />
              </div>
              Team Roles
            </CardTitle>
            <CardDescription className="text-sm">
              Organize and categorize your team members with custom roles
            </CardDescription>
          </div>

          {isAdmin && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 shadow-sm">
                  <Plus className="h-4 w-4" />
                  Add Role
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    Create New Role
                  </DialogTitle>
                  <DialogDescription>
                    Add a custom role to categorize and organize team members.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="tag-name" className="text-sm font-medium">
                      Role Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="tag-name"
                      placeholder="e.g., Sales, Engineering, Support..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Color</Label>
                    <ColorPicker value={newTagColor} onChange={setNewTagColor} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tag-description" className="text-sm font-medium">
                      Description <span className="text-muted-foreground text-xs">(optional)</span>
                    </Label>
                    <Textarea
                      id="tag-description"
                      placeholder="Brief description of this role..."
                      value={newTagDescription}
                      onChange={(e) => setNewTagDescription(e.target.value)}
                      className="min-h-[80px] resize-none"
                    />
                  </div>

                  {/* Preview */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Preview</Label>
                    <div className="p-4 rounded-xl border bg-accent/5">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: newTagColor }}
                        >
                          <Briefcase className="h-5 w-5 text-white" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-semibold text-sm">
                            {newTagName || "Role Name"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {newTagDescription || "No description"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreateDialogOpen(false);
                      resetCreateForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateTag}
                    disabled={createLoading || !newTagName.trim()}
                    className="gap-2"
                  >
                    {createLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {createLoading ? "Creating..." : "Create Role"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* System Roles Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">System Roles</span>
            <Badge variant="secondary" className="text-xs h-5 px-1.5">
              {systemRoleTags.length}
            </Badge>
          </div>
          {systemRoleTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center border rounded-xl bg-muted/5 border-dashed">
              <Shield className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No system roles</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {systemRoleTags.map((tag) => renderTagCard(tag, true))}
            </div>
          )}
        </div>

        <Separator />

        {/* Custom Roles Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Custom Roles</span>
            <Badge variant="secondary" className="text-xs h-5 px-1.5">
              {customRoleTags.length}
            </Badge>
          </div>
          {customRoleTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center border rounded-xl bg-muted/5 border-dashed">
              <Briefcase className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No custom roles yet</p>
              {isAdmin && (
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Add Role" to create your first custom role
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {customRoleTags.map((tag) => renderTagCard(tag, false))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Edit Tag Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Pencil className="h-4 w-4 text-primary" />
              </div>
              Edit Role
            </DialogTitle>
            <DialogDescription>
              {editingTag && isProtectedTag(editingTag)
                ? "System roles can only have their color and description modified."
                : "Update the role name, color, and description."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tag-name" className="text-sm font-medium">
                Role Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-tag-name"
                placeholder="Role name"
                value={editTagName}
                onChange={(e) => setEditTagName(e.target.value)}
                className="h-11"
                disabled={editingTag ? isProtectedTag(editingTag) : false}
              />
              {editingTag && isProtectedTag(editingTag) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  System role names cannot be changed
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Color</Label>
              <ColorPicker value={editTagColor} onChange={setEditTagColor} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tag-description" className="text-sm font-medium">
                Description <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Textarea
                id="edit-tag-description"
                placeholder="Brief description..."
                value={editTagDescription}
                onChange={(e) => setEditTagDescription(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Preview</Label>
              <div className="p-4 rounded-xl border bg-accent/5">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: editTagColor }}
                  >
                    {editingTag && isProtectedTag(editingTag) ? (
                      <Shield className="h-5 w-5 text-white" />
                    ) : (
                      <Briefcase className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm">
                      {editTagName || "Role Name"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {editTagDescription || "No description"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingTag(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditTag}
              disabled={editLoading || !editTagName.trim()}
              className="gap-2"
            >
              {editLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              Delete Role
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The role will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          {deletingTag && (
            <div className="py-4">
              <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: deletingTag.tag_color || "#6366f1" }}
                  >
                    <Briefcase className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">{deletingTag.tag_name}</p>
                    {deletingTag.description && (
                      <p className="text-xs text-muted-foreground">
                        {deletingTag.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    All team members with this role will have it removed.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingTag(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTag}
              disabled={deleteLoading}
              className="gap-2"
            >
              {deleteLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {deleteLoading ? "Deleting..." : "Delete Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
