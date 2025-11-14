"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Power, KeyRound } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6 sm:p-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect and manage external tools that power your workspace.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <IntegrationCard
          name="Fireflies"
          status="Active"
          lastSynced="2h ago"
          actions={["Test", "Reconnect", "Disconnect"]}
        />
        <IntegrationCard
          name="HubSpot"
          status="Needs Attention"
          lastSynced="1d ago"
          actions={["Test", "Reconnect", "Disconnect"]}
          variant="warning"
        />
        <IntegrationCard
          name="OpenAI"
          status="Active"
          lastSynced="30m ago"
          actions={["Test", "Rotate Key", "Disconnect"]}
        />
      </div>
    </div>
  );
}

function IntegrationCard({
  name,
  status,
  lastSynced,
  actions,
  variant = "success",
}: {
  name: string;
  status: string;
  lastSynced: string;
  actions: string[];
  variant?: "success" | "warning";
}) {
  const color =
    variant === "success"
      ? "bg-emerald-950/40 text-emerald-300 border-emerald-900"
      : "bg-amber-950/40 text-amber-300 border-amber-900";

  const icons: Record<string, any> = {
    Reconnect: RefreshCw,
    Disconnect: Power,
    "Rotate Key": KeyRound,
  };

  return (
    <Card className="border-border/60 bg-card/60 shadow-sm backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">{name}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Last synced {lastSynced}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${color}`}
          >
            {status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {actions.map((label, idx) => {
          const Icon = icons[label] || null;
          return (
            <Button
              key={idx}
              size="sm"
              variant={
                label === "Disconnect"
                  ? "outline"
                  : label === "Reconnect"
                  ? "secondary"
                  : "default"
              }
              className="gap-2"
            >
              {Icon && <Icon className="h-4 w-4" />} {label}
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}