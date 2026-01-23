"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Tag, Shield, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

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

interface MemberTagAssignmentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: number;
  member: { id: string; name: string | null; email: string };
  allTags: TeamTag[];
  currentMemberTags: MemberTag[];
  onSave: () => void;
  isOwner?: boolean;
}

export function MemberTagAssignment({
  open,
  onOpenChange,
  teamId,
  member,
  allTags,
  currentMemberTags,
  onSave,
  isOwner = false,
}: MemberTagAssignmentProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSystemRole, setSelectedSystemRole] = useState<number | null>(null);
  const [selectedCustomRoles, setSelectedCustomRoles] = useState<Set<number>>(
    new Set()
  );

  // Separate tags by type
  const systemRoleTags = allTags.filter((tag) => tag.tag_type === "role");
  const customRoleTags = allTags.filter((tag) => tag.tag_type === "department");

  // Get current tag IDs for this member
  const currentTagIds = new Set(currentMemberTags.map((mt) => mt.tag_id));

  // Initialize selections when dialog opens or member changes
  useEffect(() => {
    if (open) {
      // Find currently assigned system role
      const currentRole = systemRoleTags.find((tag) => currentTagIds.has(tag.id));
      setSelectedSystemRole(currentRole?.id ?? null);

      // Find currently assigned custom roles
      const currentCustomRoles = customRoleTags
        .filter((tag) => currentTagIds.has(tag.id))
        .map((tag) => tag.id);
      setSelectedCustomRoles(new Set(currentCustomRoles));
    }
  }, [open, member.id, currentMemberTags]);

  const handleCustomRoleToggle = (tagId: number) => {
    setSelectedCustomRoles((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Build the set of all tag IDs that should be assigned
      const newTagIds = new Set<number>();

      // Add selected system role (if not owner, otherwise keep existing role)
      if (isOwner) {
        // Keep the current role for owners
        const currentRole = systemRoleTags.find((tag) => currentTagIds.has(tag.id));
        if (currentRole) {
          newTagIds.add(currentRole.id);
        }
      } else if (selectedSystemRole !== null) {
        newTagIds.add(selectedSystemRole);
      }

      // Add selected custom roles
      selectedCustomRoles.forEach((id) => newTagIds.add(id));

      // Determine tags to add and remove
      const tagsToAdd = [...newTagIds].filter((id) => !currentTagIds.has(id));
      const tagsToRemove = [...currentTagIds].filter((id) => !newTagIds.has(id));

      // Remove tags that are no longer selected
      if (tagsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("team_member_tags")
          .delete()
          .eq("team_id", teamId)
          .eq("user_id", member.id)
          .in("tag_id", tagsToRemove);

        if (deleteError) {
          throw deleteError;
        }
      }

      // Add newly selected tags
      if (tagsToAdd.length > 0) {
        const newMemberTags = tagsToAdd.map((tagId) => ({
          team_id: teamId,
          user_id: member.id,
          tag_id: tagId,
        }));

        const { error: insertError } = await supabase
          .from("team_member_tags")
          .insert(newMemberTags);

        if (insertError) {
          throw insertError;
        }
      }

      toast.success("Roles updated successfully");
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating member roles:", error);
      toast.error("Failed to update roles. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const getTagColorStyle = (color: string | null) => {
    if (!color) return {};
    return {
      backgroundColor: `${color}20`,
      borderColor: color,
      color: color,
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Assign Roles to {member.name || member.email}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* System Roles Section */}
          {systemRoleTags.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold">System Role</span>
                <span className="text-xs text-muted-foreground">(select one)</span>
              </div>

              {isOwner ? (
                <p className="text-sm text-muted-foreground italic pl-6">
                  Team owner role cannot be changed.
                </p>
              ) : (
                <RadioGroup
                  value={selectedSystemRole?.toString() ?? ""}
                  onValueChange={(value) =>
                    setSelectedSystemRole(value ? parseInt(value) : null)
                  }
                  className="space-y-2 pl-6"
                >
                  {systemRoleTags.map((tag) => (
                    <div key={tag.id} className="flex items-center space-x-3">
                      <RadioGroupItem
                        value={tag.id.toString()}
                        id={`role-${tag.id}`}
                      />
                      <Label
                        htmlFor={`role-${tag.id}`}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-medium border"
                          style={getTagColorStyle(tag.tag_color)}
                        >
                          {tag.tag_name}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          {/* Separator between sections */}
          {systemRoleTags.length > 0 && customRoleTags.length > 0 && (
            <Separator />
          )}

          {/* Custom Roles Section */}
          {customRoleTags.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold">Custom Roles</span>
                <span className="text-xs text-muted-foreground">(select multiple)</span>
              </div>

              <div className="space-y-2 pl-6">
                {customRoleTags.map((tag) => (
                  <div key={tag.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`custom-${tag.id}`}
                      checked={selectedCustomRoles.has(tag.id)}
                      onCheckedChange={() => handleCustomRoleToggle(tag.id)}
                    />
                    <Label
                      htmlFor={`custom-${tag.id}`}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-medium border"
                        style={getTagColorStyle(tag.tag_color)}
                      >
                        {tag.tag_name}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No tags message */}
          {systemRoleTags.length === 0 && customRoleTags.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No roles available for this team.</p>
              <p className="text-sm">Create roles in team settings first.</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || (systemRoleTags.length === 0 && customRoleTags.length === 0)}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
