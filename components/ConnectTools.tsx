"use client";

import React, { useState } from "react";
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

export default function ConnectTools() {
  const [firefliesKey, setFirefliesKey] = useState("");
  const [openAIKey, setOpenAIKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 🔥 Save key to Supabase
  const saveKeyToSupabase = async (
    type: "fireflies" | "openai",
    key: string
  ) => {
    if (!key) {
      toast.error("Please enter a valid API key.");
      return;
    }

    try {
      setIsSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("No authenticated user found.");
        return;
      }

      const now = new Date().toISOString();
      const payload =
        type === "fireflies"
          ? { user_id: user.id, created_at: now, fireflies: key }
          : { user_id: user.id, created_at: now, openapi: key };

      const { error } = await supabase
        .from("api_keys")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        console.error(error);
        toast.error(`Failed to save ${type} key: ${error.message}`);
      } else {
        if (type === "fireflies") setFirefliesKey(key);
        if (type === "openai") setOpenAIKey(key);
        toast.success(
          `${type === "fireflies" ? "Fireflies" : "OpenAI"} key saved!`
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error saving key.");
    } finally {
      setIsSaving(false);
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
                <Dialog>
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
            <Card className="border border-dashed border-border bg-muted/30 rounded-xl shadow-xs">
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
                    summaries and automations. Optional but recommended.
                  </CardDescription>
                </div>
                <Badge
                  variant={openAIKey ? "default" : "outline"}
                  className="text-xs"
                >
                  {openAIKey ? "Connected" : "Optional"}
                </Badge>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Dialog>
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
