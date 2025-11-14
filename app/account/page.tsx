"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ChevronRight,
  ShieldAlert,
  KeyRound,
  RefreshCw,
  LinkIcon,
  Power,
  Trash2,
} from "lucide-react";

export default function SettingsPage() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  return (
    <div className="mx-auto w-full max-w-4xl p-6 sm:p-8 space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Account Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your account credentials, security settings, and ownership.
        </p>
      </header>

      {/* ACCOUNT CARD */}
      <Card className="bg-card/60 border-border/60 shadow-sm backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Account Overview</CardTitle>
          <CardDescription className="text-xs">
            Review your credentials, security preferences, and ownership
            details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AccountField label="Email" value="chhavi@levellio.io" />
            <AccountField
              label="Role"
              value={<Badge variant="secondary">Owner</Badge>}
            />
            <AccountField label="Account Created" value="March 19, 2024" />
            <AccountField label="Status" value={<Badge>Active</Badge>} />
          </div>

          <Separator className="my-4" />

          {/* Password Section */}
          <div className="rounded-lg border border-border/60 bg-card/50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium">Password</div>
                <div className="text-xs text-muted-foreground">
                  Last changed 90 days ago
                </div>
              </div>
              <Button size="sm" variant="outline" className="gap-2">
                <KeyRound className="h-4 w-4" /> Change Password
              </Button>
            </div>
          </div>

          {/* 2FA Security Section */}
          <div className="rounded-lg border border-border/60 bg-card/50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium">
                  Two-Factor Authentication
                </div>
                <div className="text-xs text-muted-foreground">
                  Adds an extra layer of security to your account
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={twoFactorEnabled}
                  onCheckedChange={setTwoFactorEnabled}
                />
                <span className="text-xs text-muted-foreground">
                  {twoFactorEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>

          {/* OAuth Connection */}
          <div className="rounded-lg border border-border/60 bg-card/50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium">Google OAuth</div>
                <div className="text-xs text-muted-foreground">
                  Connected via Google Account
                </div>
              </div>
              <Button size="sm" variant="outline">
                Disconnect
              </Button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-destructive">
                  Danger Zone
                </div>
                <div className="text-xs text-muted-foreground">
                  Permanently delete your account and all data
                </div>
              </div>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" /> Delete Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* === Components === */

function AccountField({
  label,
  value,
  action,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4 border-border/60 bg-card/50">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">{value}</div>
        {action}
      </div>
    </div>
  );
}
