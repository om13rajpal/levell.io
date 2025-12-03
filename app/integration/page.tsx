"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { KeyRound, PlugZap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

export default function IntegrationsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [firefliesKey, setFirefliesKey] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [saving, setSaving] = useState<null | "fireflies" | "openai">(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }
        setUserId(user.id);

        const { data } = await supabase
          .from("api_keys")
          .select("fireflies, openapi")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data?.fireflies) setFirefliesKey(data.fireflies);
        if (data?.openapi) setOpenAiKey(data.openapi);
      } catch (err) {
        console.error("Error loading integrations:", err);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const saveKey = async (
    type: "fireflies" | "openai",
    value: string
  ) => {
    if (!userId) {
      toast.error("Please sign in to save integration keys.");
      return;
    }

    if (!value.trim()) {
      toast.error("API key cannot be empty.");
      return;
    }

    setSaving(type);

    const payload =
      type === "fireflies"
        ? { fireflies: value.trim() }
        : { openapi: value.trim() };

    const { error } = await supabase
      .from("api_keys")
      .upsert({
        user_id: userId,
        ...payload,
      }, { onConflict: "user_id" });

    if (error) {
      toast.error(`Could not save key: ${error.message}`);
    } else {
      toast.success("Key updated successfully.");
    }

    setSaving(null);
  };

  // Loading skeleton
  if (loading) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader heading="Integrations" />
          <div className="mx-auto w-full max-w-5xl p-6 sm:p-8 space-y-8">
            <header className="space-y-2">
              <Skeleton className="h-6 w-40 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-80" />
              </div>
            </header>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i} className="border-border/70 bg-card/70 shadow-sm">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                  <CardFooter className="flex flex-col gap-3">
                    <div className="flex w-full items-center justify-between">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader heading="Integrations" />

        <div className="mx-auto w-full max-w-5xl p-6 sm:p-8 space-y-8">
          <header className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
              <PlugZap className="h-3.5 w-3.5" />
              Connected workspaces
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                Integrations
              </h1>
              <p className="text-sm text-muted-foreground">
                Securely store and manage the API keys that power your automations.
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <IntegrationCard
              title="Fireflies"
              description="Paste your Fireflies API token to sync meeting data."
              value={firefliesKey}
              onChange={setFirefliesKey}
              onSave={() => saveKey("fireflies", firefliesKey)}
              saving={saving === "fireflies"}
            />

            <IntegrationCard
              title="OpenAI"
              description="Use your own OpenAI key for summarization and analysis."
              value={openAiKey}
              onChange={setOpenAiKey}
              onSave={() => saveKey("openai", openAiKey)}
              saving={saving === "openai"}
            />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function IntegrationCard({
  title,
  description,
  value,
  onChange,
  onSave,
  saving,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Card className="border-border/70 bg-card/70 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          API key
        </Label>
        <Input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-..."
        />
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
          <span>Stored securely in Supabase</span>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-primary">Required for automation</span>
        </div>
        <Button className="w-full" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save key"}
        </Button>
      </CardFooter>
    </Card>
  );
}