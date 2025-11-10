"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Info, ArrowLeft, ArrowRight } from "lucide-react";

export default function CompanyInfoStep() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl mx-auto p-6 bg-background">
      {/* ===== LEFT SIDE FORM ===== */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold">Tell Us About Your Company</h2>
          <p className="text-sm text-muted-foreground">
            We’ll use this info to personalize recommendations and automations.
          </p>
        </div>

        {/* Main Content Area with Form and Sidebar aligned */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
          {/* Form Section */}
          <div className="flex-1 flex flex-col space-y-6">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company-name">
                Company name{" "}
                <span className="text-red-500 text-xs align-top">Required</span>
              </Label>
              <Input
                id="company-name"
                type="text"
                placeholder="Enter your company name"
                className="h-10"
              />
            </div>

            {/* How should we learn section */}
            <Card className="border border-border rounded-xl shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  How should we learn about your business?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup defaultValue="website">
                  {/* Option 1 */}
                  <div className="space-y-2 border border-border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="website" id="website" />
                      <div className="space-y-1">
                        <Label htmlFor="website" className="font-medium">
                          I have a website
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Provide your public website URL so we can analyze it.
                        </p>
                      </div>
                    </div>
                    <Input type="url" placeholder="https://" className="mt-3" />
                  </div>

                  {/* Option 2 */}
                  <div className="space-y-2 border border-border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="describe" id="describe" />
                      <div className="space-y-1">
                        <Label htmlFor="describe" className="font-medium">
                          I’ll describe
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Write a short summary covering what you do, your
                          customers, and offerings.
                        </p>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Type a brief company description..."
                      className="mt-3 min-h-[100px]"
                    />
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Info Alert */}
            <Alert className="border border-dashed border-border bg-muted/30 rounded-xl">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm text-muted-foreground">
                A complete profile helps us tailor onboarding, generate better
                content, and preconfigure integrations. You can edit details
                later in Settings.
              </AlertDescription>
            </Alert>
          </div>

          {/* ===== RIGHT SIDEBAR (Like ConnectTools) ===== */}
          <div className="lg:w-80">
            <Alert className="border border-border bg-muted/30 rounded-xl h-full flex flex-col justify-between p-4">
              <div>
                <AlertTitle className="font-medium text-base mb-1">
                  Why complete this step?
                </AlertTitle>
                <AlertDescription className="text-sm text-muted-foreground mb-4">
                  Filling in your company details now allows us to prefill
                  automations, suggest templates, and customize your dashboard.
                  You can always update this later.
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