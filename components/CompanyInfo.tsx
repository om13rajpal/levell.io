"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Info } from "lucide-react";

const CompanyInfoStep = forwardRef((_props, ref) => {
  const [website, setWebsite] = useState("");
  const [companyName, setCompanyName] = useState("");

  useImperativeHandle(ref, () => ({
    getCompanyInfo: () => ({ website, companyName }),
  }));

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl mx-auto p-6 bg-background">
      <div className="flex-1 flex flex-col">
        <div className="mb-8">
          <h2 className="text-xl font-semibold">Tell Us About Your Company</h2>
          <p className="text-sm text-muted-foreground">
            We’ll use this info to personalize recommendations and automations.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 flex-1">
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
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            {/* Website Input */}
            <Card className="border border-border rounded-xl shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  Company Website
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            {/* Info */}
            <Alert className="border border-dashed border-border bg-muted/30 rounded-xl">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm text-muted-foreground">
                Adding your website helps us learn about your company for better
                recommendations. You can skip this, but including it improves
                personalization.
              </AlertDescription>
            </Alert>
          </div>

          {/* Right Sidebar */}
          <div className="lg:w-80">
            <Alert className="border border-border bg-muted/30 rounded-xl h-full flex flex-col justify-between p-4">
              <div>
                <h3 className="font-medium text-base mb-1">
                  Why complete this step?
                </h3>
                <AlertDescription className="text-sm text-muted-foreground mb-4">
                  It allows us to prefill automations, suggest templates, and
                  customize your dashboard experience.
                </AlertDescription>

                <h3 className="font-medium text-base mt-2">Need help?</h3>
                <AlertDescription className="text-sm text-muted-foreground">
                  Read our quickstart guide or contact support if you get stuck.
                </AlertDescription>
              </div>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
});

CompanyInfoStep.displayName = "CompanyInfoStep";
export default CompanyInfoStep;
