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

import {
  Plus,
  Tag,
  Pencil,
  Trash2,
  Loader2,
  Shield,
  Building2,
  Users,
  AlertTriangle,
  Check,
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
  { name: "Yellow", value: "#eab308", bg: "bg-yellow-500", ring: "ring-yellow-500" },
  { name: "Green", value: "#22c55e", bg: "bg-green-500", ring: "ring-green-500" },
  { name: "Blue", value: "#3b82f6", bg: "bg-blue-500", ring: "ring-blue-500" },
  { name: "Indigo", value: "#6366f1", bg: "bg-indigo-500", ring: "ring-indigo-500" },
  { name: "Purple", value: "#a855f7", bg: "bg-purple-500", ring: "ring-purple-500" },
  { name: "Pink", value: "#ec4899", bg: "bg-pink-500", ring: "ring-pink-500" },
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
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[4].value); // Default to blue
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

  // Separate tags by type
  const roleTags = tags.filter(
    (t) => t.tag_type === "role" || PROTECTED_ROLE_TAGS.includes(t.tag_name.toLowerCase())
  );
  const departmentTags = tags.filter(
    (t) => t.tag_type === "department" && !PROTECTED_ROLE_TAGS.includes(t.tag_name.toLowerCase())
  );

  // Check if a tag is protected (cannot be deleted)
  const isProtectedTag = useCallback((tag: TeamTag): boolean => {
    return PROTECTED_ROLE_TAGS.includes(tag.tag_name.toLowerCase());
  }, []);

  // Reset create form
  const resetCreateForm = () => {
    setNewTagName("");
    setNewTagColor(PRESET_COLORS[4].value);
    setNewTagDescription("");
  };

  // Handle create tag
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error("Tag name is required");
      return;
    }

    // Check for duplicate names
    const nameExists = tags.some(
      (t) => t.tag_name.toLowerCase() === newTagName.trim().toLowerCase()
    );
    if (nameExists) {
      toast.error("A tag with this name already exists");
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
        toast.error("Failed to create tag");
        return;
      }

      toast.success("Tag created successfully");
      setCreateDialogOpen(false);
      resetCreateForm();
      onTagsChange();
    } catch (err) {
      console.error("Error creating tag:", err);
      toast.error("An error occurred while creating the tag");
    } finally {
      setCreateLoading(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (tag: TeamTag) => {
    setEditingTag(tag);
    setEditTagName(tag.tag_name);
    setEditTagColor(tag.tag_color || PRESET_COLORS[4].value);
    setEditTagDescription(tag.description || "");
    setEditDialogOpen(true);
  };

  // Handle edit tag
  const handleEditTag = async () => {
    if (!editingTag || !editTagName.trim()) {
      toast.error("Tag name is required");
      return;
    }

    // Check for duplicate names (excluding current tag)
    const nameExists = tags.some(
      (t) =>
        t.id !== editingTag.id &&
        t.tag_name.toLowerCase() === editTagName.trim().toLowerCase()
    );
    if (nameExists) {
      toast.error("A tag with this name already exists");
      return;
    }

    // Prevent renaming protected tags
    if (isProtectedTag(editingTag)) {
      // Only allow color and description changes for protected tags
      if (editTagName.trim().toLowerCase() !== editingTag.tag_name.toLowerCase()) {
        toast.error("Cannot rename Admin or Member role tags");
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
        toast.error("Failed to update tag");
        return;
      }

      toast.success("Tag updated successfully");
      setEditDialogOpen(false);
      setEditingTag(null);
      onTagsChange();
    } catch (err) {
      console.error("Error updating tag:", err);
      toast.error("An error occurred while updating the tag");
    } finally {
      setEditLoading(false);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (tag: TeamTag) => {
    if (isProtectedTag(tag)) {
      toast.error("Cannot delete Admin or Member role tags");
      return;
    }
    setDeletingTag(tag);
    setDeleteDialogOpen(true);
  };

  // Handle delete tag
  const handleDeleteTag = async () => {
    if (!deletingTag) return;

    if (isProtectedTag(deletingTag)) {
      toast.error("Cannot delete Admin or Member role tags");
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
        toast.error("Failed to delete tag");
        return;
      }

      toast.success("Tag deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingTag(null);
      onTagsChange();
    } catch (err) {
      console.error("Error deleting tag:", err);
      toast.error("An error occurred while deleting the tag");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Render a single tag badge
  const renderTagBadge = (tag: TeamTag, showActions: boolean = true) => {
    const isProtected = isProtectedTag(tag);
    const bgColor = tag.tag_color
      ? { backgroundColor: tag.tag_color }
      : undefined;
    const isRole = tag.tag_type === "role" || isProtected;

    return (
      <div
        key={tag.id}
        className={`
          group flex items-center gap-2 p-2.5 rounded-lg border transition-all
          ${showActions && isAdmin ? "hover:bg-muted/50 cursor-pointer" : ""}
          ${isProtected ? "border-dashed" : ""}
        `}
        onClick={() => showActions && isAdmin && !isProtected && openEditDialog(tag)}
      >
        <div
          className="h-4 w-4 rounded-full shrink-0"
          style={bgColor}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm truncate">{tag.tag_name}</span>
            {isProtected && (
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 h-3.5 bg-muted/50 border-dashed"
              >
                System
              </Badge>
            )}
          </div>
          {tag.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {tag.description}
            </p>
          )}
        </div>

        {showActions && isAdmin && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                openEditDialog(tag);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {!isProtected && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteDialog(tag);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
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
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          className={`
            h-8 w-8 rounded-full transition-all
            ${color.bg}
            ${value === color.value ? "ring-2 ring-offset-2 " + color.ring : "hover:scale-110"}
          `}
          onClick={() => onChange(color.value)}
          title={color.name}
        >
          {value === color.value && (
            <Check className="h-4 w-4 text-white mx-auto" />
          )}
        </button>
      ))}
    </div>
  );

  return (
    <Card className="@container/card shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Team Tags
            </CardTitle>
            <CardDescription>
              Organize team members with roles and departments
            </CardDescription>
          </div>

          {isAdmin && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 h-8">
                  <Plus className="h-3.5 w-3.5" />
                  Add Tag
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" />
                    Create Department Tag
                  </DialogTitle>
                  <DialogDescription>
                    Add a new department tag to categorize team members.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="tag-name">Tag Name *</Label>
                    <Input
                      id="tag-name"
                      placeholder="e.g., Sales, Engineering, Support..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Color</Label>
                    <ColorPicker value={newTagColor} onChange={setNewTagColor} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tag-description">
                      Description <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id="tag-description"
                      placeholder="Brief description of this department..."
                      value={newTagDescription}
                      onChange={(e) => setNewTagDescription(e.target.value)}
                      className="min-h-[80px] resize-none"
                    />
                  </div>

                  {/* Preview */}
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full shrink-0"
                          style={{ backgroundColor: newTagColor }}
                        />
                        <span className="font-medium text-sm">
                          {newTagName || "Tag Name"}
                        </span>
                      </div>
                      {newTagDescription && (
                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          {newTagDescription}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter>
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
                    {createLoading ? "Creating..." : "Create Tag"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Role Tags Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Shield className="h-4 w-4" />
            Roles ({roleTags.length})
          </div>
          {roleTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center border rounded-lg bg-muted/10">
              <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No role tags</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {roleTags.map((tag) => renderTagBadge(tag))}
            </div>
          )}
        </div>

        {/* Department Tags Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Departments ({departmentTags.length})
          </div>
          {departmentTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center border rounded-lg bg-muted/10">
              <Building2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No department tags</p>
              {isAdmin && (
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Add Tag" to create your first department
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {departmentTags.map((tag) => renderTagBadge(tag))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Edit Tag Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Tag
            </DialogTitle>
            <DialogDescription>
              {editingTag && isProtectedTag(editingTag)
                ? "You can only change the color and description of system tags."
                : "Update the tag name, color, and description."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tag-name">Tag Name *</Label>
              <Input
                id="edit-tag-name"
                placeholder="Tag name"
                value={editTagName}
                onChange={(e) => setEditTagName(e.target.value)}
                className="h-10"
                disabled={editingTag ? isProtectedTag(editingTag) : false}
              />
              {editingTag && isProtectedTag(editingTag) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  System tag names cannot be changed
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker value={editTagColor} onChange={setEditTagColor} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tag-description">
                Description <span className="text-muted-foreground">(optional)</span>
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
              <Label>Preview</Label>
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: editTagColor }}
                  />
                  <span className="font-medium text-sm">
                    {editTagName || "Tag Name"}
                  </span>
                </div>
                {editTagDescription && (
                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                    {editTagDescription}
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
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
              <AlertTriangle className="h-5 w-5" />
              Delete Tag
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this tag? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deletingTag && (
            <div className="py-4">
              <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                <div className="flex items-center gap-3">
                  <div
                    className="h-6 w-6 rounded-full shrink-0"
                    style={{
                      backgroundColor: deletingTag.tag_color || "#6366f1",
                    }}
                  />
                  <div>
                    <p className="font-medium">{deletingTag.tag_name}</p>
                    {deletingTag.description && (
                      <p className="text-xs text-muted-foreground">
                        {deletingTag.description}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  All members with this tag will have it removed.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
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
              {deleteLoading ? "Deleting..." : "Delete Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
