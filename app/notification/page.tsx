"use client";

import { useState } from "react";
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

export default function NotificationsPage() {
  const [emailWeekly, setEmailWeekly] = useState(true);
  const [emailReminders, setEmailReminders] = useState(false);
  const [inAppMentions, setInAppMentions] = useState(true);
  const [inAppIntegration, setInAppIntegration] = useState(true);
  const [inAppProcessed, setInAppProcessed] = useState(false);
  const [inAppUpdates, setInAppUpdates] = useState(true);

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
        />
      </div>

      <div className="flex justify-end">
        <Button>Save Changes</Button>
      </div>
    </div>
  );
}

function NotifySection({
  title,
  description,
  toggles,
}: {
  title: string;
  description: string;
  toggles: { label: string; checked: boolean; onChange: (v: boolean) => void }[];
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
            <Switch checked={t.checked} onCheckedChange={t.onChange} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}