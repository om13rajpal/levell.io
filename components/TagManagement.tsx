"use client";

import React from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  Tag,
  Shield,
  Crown,
  Users,
} from "lucide-react";

// Type definition for TeamRole (from global team_roles table)
type TeamRole = {
  id: number;
  role_name: string;
  description: string | null;
  created_at: string;
};

// Role icon and color mapping
const ROLE_STYLES: Record<number, { icon: typeof Shield; color: string; bg: string }> = {
  1: { icon: Shield, color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-500" },
  2: { icon: Crown, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500" },
  3: { icon: Users, color: "text-slate-700 dark:text-slate-400", bg: "bg-slate-500" },
};

const DEFAULT_DESCRIPTIONS: Record<number, string> = {
  1: "Can invite/remove members and manage team settings.",
  2: "Team leader with full administrative access.",
  3: "Can view team content and participate in calls.",
};

interface TagManagementProps {
  teamId: number;
  roles: TeamRole[];
  isAdmin: boolean;
  onTagsChange: () => void;
}

export default function TagManagement({
  teamId,
  roles,
  isAdmin,
  onTagsChange,
}: TagManagementProps) {
  return (
    <Card className="@container/card shadow-sm border-0 bg-gradient-to-b from-card to-card/80">
      <CardHeader className="pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Tag className="h-4 w-4 text-primary" />
            </div>
            Team Roles
          </CardTitle>
          <CardDescription className="text-sm">
            Global roles that define member permissions and responsibilities
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        {roles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border rounded-xl bg-muted/5 border-dashed">
            <Shield className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No roles configured</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {roles.map((role) => {
              const style = ROLE_STYLES[role.id] || ROLE_STYLES[3];
              const IconComponent = style.icon;
              const description = role.description || DEFAULT_DESCRIPTIONS[role.id] || "No description";

              return (
                <div
                  key={role.id}
                  className="group relative flex items-start gap-3 p-4 rounded-xl border bg-card border-dashed bg-muted/30"
                >
                  {/* Color indicator */}
                  <div
                    className={`h-10 w-10 rounded-lg shrink-0 flex items-center justify-center shadow-sm ${style.bg}`}
                  >
                    <IconComponent className="h-5 w-5 text-white" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{role.role_name}</span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4 bg-muted border-0"
                      >
                        Global
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
