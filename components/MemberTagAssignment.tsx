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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Tag, Shield, Crown, Users } from "lucide-react";
import { toast } from "sonner";

type TeamRole = {
  id: number;
  role_name: string;
  description: string | null;
  created_at: string;
};

type TeamOrgEntry = {
  id: string;
  team_id: number;
  user_id: string;
  team_role_id: number;
  is_sales_manager: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

interface MemberTagAssignmentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: number;
  member: { id: string; name: string | null; email: string };
  roles: TeamRole[];
  currentOrgEntry: TeamOrgEntry | null;
  onSave: () => void;
  isSalesManager?: boolean;
}

// Role icon mapping
const ROLE_ICONS: Record<number, typeof Shield> = {
  1: Shield,   // Admin
  2: Crown,    // Sales Manager
  3: Users,    // Member
};

const ROLE_COLORS: Record<number, string> = {
  1: "text-indigo-600",
  2: "text-amber-600",
  3: "text-slate-600",
};

export function MemberTagAssignment({
  open,
  onOpenChange,
  teamId,
  member,
  roles,
  currentOrgEntry,
  onSave,
  isSalesManager = false,
}: MemberTagAssignmentProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

  // Initialize selection when dialog opens
  useEffect(() => {
    if (open && currentOrgEntry) {
      setSelectedRoleId(currentOrgEntry.team_role_id);
    }
  }, [open, currentOrgEntry]);

  const handleSave = async () => {
    if (selectedRoleId === null) {
      toast.error("Please select a role");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("team_org")
        .update({ team_role_id: selectedRoleId })
        .eq("team_id", teamId)
        .eq("user_id", member.id)
        .eq("active", true);

      if (error) {
        throw error;
      }

      toast.success("Role updated successfully");
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating member role:", error);
      toast.error("Failed to update role. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Assign Role to {member.name || member.email}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isSalesManager ? (
            <p className="text-sm text-muted-foreground italic">
              Sales manager role cannot be changed through role assignment.
            </p>
          ) : roles.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No roles available.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Select Role</span>
                <span className="text-xs text-muted-foreground">(choose one)</span>
              </div>

              <RadioGroup
                value={selectedRoleId?.toString() ?? ""}
                onValueChange={(value) =>
                  setSelectedRoleId(value ? parseInt(value) : null)
                }
                className="space-y-2 pl-6"
              >
                {roles.map((role) => {
                  const IconComponent = ROLE_ICONS[role.id] || Users;
                  const colorClass = ROLE_COLORS[role.id] || "text-slate-600";

                  return (
                    <label
                      key={role.id}
                      className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
                    >
                      <RadioGroupItem
                        value={role.id.toString()}
                        id={`role-${role.id}`}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <IconComponent className={`h-3.5 w-3.5 ${colorClass}`} />
                          <span className="font-medium text-sm">{role.role_name}</span>
                        </div>
                        {role.description && (
                          <p className="text-xs text-muted-foreground">
                            {role.description}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
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
            disabled={isSaving || isSalesManager || roles.length === 0 || selectedRoleId === null}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Role"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
