"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowUp, Plug } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import axiosClient from "@/lib/axiosClient";

interface ConnectToolsProps {
  onFirefliesStatusChange?: (connected: boolean) => void;
  onOpenAIStatusChange?: (connected: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
}

export default function ConnectTools({
  onFirefliesStatusChange,
  onOpenAIStatusChange,
  onSavingChange,
}: ConnectToolsProps) {
  const [firefliesKey, setFirefliesKey] = useState("");
  const [openAIKey, setOpenAIKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFirefliesDialogOpen, setIsFirefliesDialogOpen] = useState(false);
  const [isOpenAIDialogOpen, setIsOpenAIDialogOpen] = useState(false);

  useEffect(() => {
    const loadKeys = async () => {
      const { data: session } = await supabase.auth.getUser();
      if (!session?.user) return;

      const { data } = await supabase
        .from("api_keys")
        .select("fireflies, openapi")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (data?.fireflies) {
        setFirefliesKey(data.fireflies);
        localStorage.setItem("onboarding_fireflies_connected", "true");
        onFirefliesStatusChange?.(true);
      }

      if (data?.openapi) {
        setOpenAIKey(data.openapi);
        localStorage.setItem("onboarding_openai_connected", "true");
        onOpenAIStatusChange?.(true);
      }
    };

    loadKeys();
  }, [onFirefliesStatusChange, onOpenAIStatusChange]);

  // Helper to rollback DB changes on failure
  const rollbackApiKey = async (userId: string, type: "fireflies" | "openai", previousKey: string | null) => {
    try {
      if (previousKey === null) {
        // No previous key existed - remove the newly inserted key
        const updatePayload = type === "fireflies"
          ? { fireflies: null }
          : { openapi: null };
        await supabase
          .from("api_keys")
          .update(updatePayload)
          .eq("user_id", userId);
      } else {
        // Restore the previous key
        const updatePayload = type === "fireflies"
          ? { fireflies: previousKey }
          : { openapi: previousKey };
        await supabase
          .from("api_keys")
          .update(updatePayload)
          .eq("user_id", userId);
      }
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }
  };

  // Save key to Supabase with proper error handling and rollback
  const saveKeyToSupabase = async (
    type: "fireflies" | "openai",
    key: string
  ) => {
    if (!key) {
      toast.error("Please enter a valid API key.");
      return;
    }

    setIsSaving(true);
    onSavingChange?.(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("No authenticated user found.");
        return;
      }

      // Fetch the current key before making changes (for rollback capability)
      const { data: existingData } = await supabase
        .from("api_keys")
        .select("fireflies, openapi")
        .eq("user_id", user.id)
        .maybeSingle();

      const previousKey = type === "fireflies"
        ? (existingData?.fireflies ?? null)
        : (existingData?.openapi ?? null);

      // Step 1: Save to database
      const now = new Date().toISOString();
      const payload =
        type === "fireflies"
          ? { user_id: user.id, created_at: now, fireflies: key }
          : { user_id: user.id, created_at: now, openapi: key };

      const { error: dbError } = await supabase
        .from("api_keys")
        .upsert(payload, { onConflict: "user_id" });

      if (dbError) {
        console.error(dbError);
        toast.error(`Failed to save ${type} key: ${dbError.message}`);
        return;
      }

      // Step 2: For Fireflies, trigger the webhook BEFORE updating local state
      if (type === "fireflies") {
        try {
          await axiosClient.post("/api/inngest/trigger", {
            event: "transcripts/sync.requested",
            data: {
              token: key,
              user_id: user.id,
              skip: 0,
            },
          });
        } catch (webhookError) {
          console.error("Webhook error:", webhookError);
          // Rollback the database change since webhook failed
          await rollbackApiKey(user.id, type, previousKey);
          toast.error("Failed to sync with Fireflies. Connection was not saved. Please try again.");
          return;
        }
      }

      // Step 3: Only update localStorage and state AFTER all operations succeed
      if (type === "fireflies") {
        setFirefliesKey(key);
        localStorage.setItem("onboarding_fireflies_connected", "true");
        localStorage.setItem("fireflies_syncing", "true");
        onFirefliesStatusChange?.(true);
        setIsFirefliesDialogOpen(false);
      } else {
        setOpenAIKey(key);
        localStorage.setItem("onboarding_openai_connected", "true");
        onOpenAIStatusChange?.(true);
        setIsOpenAIDialogOpen(false);
      }

      toast.success(
        `${type === "fireflies" ? "Fireflies" : "OpenAI"} key saved!`
      );
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error saving key.");
    } finally {
      setIsSaving(false);
      onSavingChange?.(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl mx-auto p-6 bg-background">
      {/* ===== LEFT SECTION ===== */}
      <div className="flex-1 flex flex-col">
        <div>
          <h2 className="text-xl font-semibold">Connect Your Tools</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Link your favorite apps to speed up your setup. You can always add
            more later.
          </p>
        </div>

        {/* ===== MAIN CONTENT ===== */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
          <div className="flex-1 space-y-4">
            {/* Fireflies Card */}
            <Card className="border border-border rounded-xl shadow-xs">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Button variant="outline" size="icon" className="w-7 h-7">
                      <ArrowUp />
                    </Button>
                    Fireflies
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Transcribe and summarize your meetings automatically by
                    syncing your calendar and conferencing tools.
                  </CardDescription>
                </div>
                <Badge
                  variant={firefliesKey ? "default" : "secondary"}
                  className="text-xs"
                >
                  {firefliesKey ? "Connected" : "Not connected"}
                </Badge>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Dialog open={isFirefliesDialogOpen} onOpenChange={setIsFirefliesDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plug className="h-4 w-4" />
                      {firefliesKey ? "Edit key" : "Connect"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Connect Fireflies</DialogTitle>
                      <DialogDescription>
                        Login to your Fireflies account, then click{" "}
                        <a
                          href="https://app.fireflies.ai/settings#DeveloperSettings"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          here
                        </a>{" "}
                        to get your API key.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 space-y-3">
                      <Input
                        type="text"
                        placeholder="Enter Fireflies API key"
                        value={firefliesKey}
                        onChange={(e) => setFirefliesKey(e.target.value)}
                      />
                    </div>
                    <DialogFooter className="mt-4">
                      <Button
                        disabled={isSaving}
                        onClick={() =>
                          saveKeyToSupabase("fireflies", firefliesKey)
                        }
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button size="sm" variant="outline">
                  Learn more
                </Button>
              </CardContent>
            </Card>

            {/* OpenAI Card */}
            <Card className="border border-border rounded-xl shadow-xs">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Button variant="outline" size="icon" className="w-7 h-7">
                      <ArrowUp />
                    </Button>
                    OpenAI
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Use your own API key to enable AI features like smart
                    summaries and automations.
                  </CardDescription>
                </div>
                <Badge
                  variant={openAIKey ? "default" : "secondary"}
                  className="text-xs"
                >
                  {openAIKey ? "Connected" : "Not connected"}
                </Badge>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Dialog open={isOpenAIDialogOpen} onOpenChange={setIsOpenAIDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plug className="h-4 w-4" />
                      {openAIKey ? "Edit key" : "Connect"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Connect OpenAI</DialogTitle>
                      <DialogDescription>
                        Go to{" "}
                        <a
                          href="https://platform.openai.com/account/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          your OpenAI account
                        </a>{" "}
                        and click “Create new secret key”. Paste it below.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 space-y-3">
                      <Input
                        type="text"
                        placeholder="Enter OpenAI API key"
                        value={openAIKey}
                        onChange={(e) => setOpenAIKey(e.target.value)}
                      />
                    </div>
                    <DialogFooter className="mt-4">
                      <Button
                        disabled={isSaving}
                        onClick={() => saveKeyToSupabase("openai", openAIKey)}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button size="sm" variant="outline">
                  Show details
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Info Alert */}
          <div className="lg:w-80">
            <Alert className="border border-border bg-muted/30 rounded-xl h-full flex flex-col justify-between p-4">
              <div>
                <AlertTitle className="font-medium text-base mb-1">
                  Why connect now?
                </AlertTitle>
                <AlertDescription className="text-sm text-muted-foreground mb-4">
                  Connecting at least one integration unlocks recommended
                  defaults and speeds up your onboarding. You can return to this
                  step anytime from Settings.
                </AlertDescription>
                <AlertTitle className="font-medium text-base mt-2">
                  Need help?
                </AlertTitle>
                <AlertDescription className="text-sm text-muted-foreground">
                  Read our quickstart or contact support if you get stuck.
                </AlertDescription>
              </div>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
}
