"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function NotificationsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [emailWeekly, setEmailWeekly] = useState(false);
  const [emailReminders, setEmailReminders] = useState(false);
  const [inAppMentions, setInAppMentions] = useState(false);
  const [inAppIntegration, setInAppIntegration] = useState(false);
  const [inAppProcessed, setInAppProcessed] = useState(false);
  const [inAppUpdates, setInAppUpdates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadNotifications = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data } = await supabase
        .from("notifications")
        .select(
          "weekly_performance, task_reminders, integration_status, call_processed, product_updates, mentions",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setEmailWeekly(Boolean(data.weekly_performance));
        setEmailReminders(Boolean(data.task_reminders));
        setInAppIntegration(Boolean(data.integration_status));
        setInAppProcessed(Boolean(data.call_processed));
        setInAppUpdates(Boolean(data.product_updates));
        setInAppMentions(Boolean(data.mentions));
      } else {
        setEmailWeekly(false);
        setEmailReminders(false);
        setInAppIntegration(false);
        setInAppProcessed(false);
        setInAppUpdates(false);
        setInAppMentions(false);
      }

      setLoading(false);
    };

    loadNotifications();
  }, []);

  const handleSave = async () => {
    if (!userId) {
      toast.error("You need to sign in to update notifications.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("notifications")
      .upsert(
        {
          user_id: userId,
          weekly_performance: emailWeekly,
          task_reminders: emailReminders,
          integration_status: inAppIntegration,
          call_processed: inAppProcessed,
          product_updates: inAppUpdates,
          mentions: inAppMentions,
        },
        { onConflict: "user_id" },
      );

    if (error) {
      toast.error(`Could not save preferences: ${error.message}`);
    } else {
      toast.success("Notification preferences updated.");
    }

    setSaving(false);
  };

  return (
    <div className="mx-auto w-full max-w-6xl p-6 sm:p-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Choose when and how you want to be notified.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <NotifySection
          title="Email Notifications"
          description="Stay updated via email"
          toggles={[
            {
              label: "Weekly performance",
              checked: emailWeekly,
              onChange: setEmailWeekly,
            },
            {
              label: "Task reminders",
              checked: emailReminders,
              onChange: setEmailReminders,
            },
          ]}
          disabled={loading || saving}
        />
        <NotifySection
          title="In-app Notifications"
          description="Control app alerts"
          toggles={[
            { label: "Mentions", checked: inAppMentions, onChange: setInAppMentions },
            { label: "Integration status", checked: inAppIntegration, onChange: setInAppIntegration },
            { label: "Call processed", checked: inAppProcessed, onChange: setInAppProcessed },
            { label: "Product updates", checked: inAppUpdates, onChange: setInAppUpdates },
          ]}
          disabled={loading || saving}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading || saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

function NotifySection({
  title,
  description,
  toggles,
  disabled,
}: {
  title: string;
  description: string;
  toggles: { label: string; checked: boolean; onChange: (v: boolean) => void }[];
  disabled?: boolean;
}) {
  return (
    <Card className="border-border/60 bg-card/60 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {toggles.map((t, i) => (
          <div key={i} className="flex items-center justify-between">
            <Label className="text-sm">{t.label}</Label>
            <Switch
              checked={t.checked}
              onCheckedChange={t.onChange}
              disabled={disabled}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
