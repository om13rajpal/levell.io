"use client";

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
import { ArrowUp, Plug } from "lucide-react";

export default function ConnectTools() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl mx-auto p-6 bg-background">
      {/* ===== LEFT SECTION ===== */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold">Connect Your Tools</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Link your favorite apps to speed up your setup. You can always add
            more later.
          </p>
        </div>

        {/* Main Content Area with Cards and Right Alert aligned */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
          {/* Cards Column */}
          <div className="flex-1 space-y-4">
            {/* Fireflies */}
            <Card className="border border-border rounded-xl shadow-xs">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Button variant="outline" size="icon" aria-label="Submit" className="w-7 h-7">
                      <ArrowUp />
                    </Button>
                    Fireflies
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Transcribe and summarize your meetings automatically by
                    syncing your calendar and conferencing tools.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Not connected
                </Badge>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button size="sm">
                  <Plug className="h-4 w-4" />
                  Connect
                </Button>
                <Button size="sm" variant="outline">
                  Learn more
                </Button>
              </CardContent>
            </Card>

            {/* HubSpot */}
            <Card className="border border-border rounded-xl shadow-xs">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Button variant="outline" size="icon" aria-label="Submit" className="w-7 h-7">
                      <ArrowUp />
                    </Button>
                    HubSpot
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Sync contacts, deals, and activities to keep your CRM up to
                    date with zero manual work.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Not connected
                </Badge>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button size="sm">
                  <Plug className="h-4 w-4" />
                  Connect
                </Button>{" "}
                <Button size="sm" variant="outline">
                  Learn more
                </Button>
              </CardContent>
            </Card>

            {/* OpenAI */}
            <Card className="border border-dashed border-border bg-muted/30 rounded-xl shadow-xs">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Button variant="outline" size="icon" aria-label="Submit" className="w-7 h-7">
                      <ArrowUp />
                    </Button>
                    OpenAI
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Use your own API key to enable AI features like smart
                    summaries and automations. This step is optional and can be
                    added later.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  Optional
                </Badge>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button size="sm" variant="outline">
                  Show details
                </Button>
                <Button size="sm">
                  <Plug className="h-4 w-4" />
                  Connect
                </Button>{" "}
              </CardContent>
            </Card>
          </div>

          {/* Alert aligned with Cards */}
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
