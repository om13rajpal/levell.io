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
import { Loader2, Tag, Shield, Building2 } from "lucide-react";
import { toast } from "sonner";

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
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [selectedDepartments, setSelectedDepartments] = useState<Set<number>>(
    new Set()
  );

  // Separate tags by type
  const roleTags = allTags.filter((tag) => tag.tag_type === "role");
  const departmentTags = allTags.filter((tag) => tag.tag_type === "department");

  // Get current tag IDs for this member
  const currentTagIds = new Set(currentMemberTags.map((mt) => mt.tag_id));

  // Initialize selections when dialog opens or member changes
  useEffect(() => {
    if (open) {
      // Find currently assigned role
      const currentRole = roleTags.find((tag) => currentTagIds.has(tag.id));
      setSelectedRole(currentRole?.id ?? null);

      // Find currently assigned departments
      const currentDepts = departmentTags
        .filter((tag) => currentTagIds.has(tag.id))
        .map((tag) => tag.id);
      setSelectedDepartments(new Set(currentDepts));
    }
  }, [open, member.id, currentMemberTags]);

  const handleDepartmentToggle = (tagId: number) => {
    setSelectedDepartments((prev) => {
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

      // Add selected role (if not owner, otherwise keep existing role)
      if (isOwner) {
        // Keep the current role for owners
        const currentRole = roleTags.find((tag) => currentTagIds.has(tag.id));
        if (currentRole) {
          newTagIds.add(currentRole.id);
        }
      } else if (selectedRole !== null) {
        newTagIds.add(selectedRole);
      }

      // Add selected departments
      selectedDepartments.forEach((id) => newTagIds.add(id));

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

      toast.success("Tags updated successfully");
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating member tags:", error);
      toast.error("Failed to update tags. Please try again.");
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
            Assign Tags to {member.name || member.email}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Roles Section */}
          {roleTags.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Shield className="h-4 w-4" />
                Role
                <span className="text-xs font-normal">(select one)</span>
              </div>

              {isOwner ? (
                <p className="text-sm text-muted-foreground italic">
                  Team owner role cannot be changed.
                </p>
              ) : (
                <RadioGroup
                  value={selectedRole?.toString() ?? ""}
                  onValueChange={(value) =>
                    setSelectedRole(value ? parseInt(value) : null)
                  }
                  className="space-y-2"
                >
                  {roleTags.map((tag) => (
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
                          className="px-2 py-0.5 rounded-full text-xs font-medium border"
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

          {/* Departments Section */}
          {departmentTags.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Departments
                <span className="text-xs font-normal">(select multiple)</span>
              </div>

              <div className="space-y-2">
                {departmentTags.map((tag) => (
                  <div key={tag.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`dept-${tag.id}`}
                      checked={selectedDepartments.has(tag.id)}
                      onCheckedChange={() => handleDepartmentToggle(tag.id)}
                    />
                    <Label
                      htmlFor={`dept-${tag.id}`}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium border"
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
          {roleTags.length === 0 && departmentTags.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No tags available for this team.</p>
              <p className="text-sm">Create tags in team settings first.</p>
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
            disabled={isSaving || (roleTags.length === 0 && departmentTags.length === 0)}
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
