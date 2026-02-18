"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Info } from "lucide-react";

interface CompanyInfoStepProps {
  initialCompanyName?: string;
  initialWebsite?: string;
  onChange?: (data: {
    website: string;
    companyName: string;
    companyLink: string;
  }) => void;
}

const CompanyInfoStep = forwardRef((props: CompanyInfoStepProps, ref) => {
  const [companyName, setCompanyName] = useState(props.initialCompanyName || "");
  const [companyLink, setCompanyLink] = useState(props.initialWebsite || "");

  useEffect(() => {
    setCompanyName(props.initialCompanyName || "");
    setCompanyLink(props.initialWebsite || "");
  }, [props.initialCompanyName, props.initialWebsite]);

  useImperativeHandle(ref, () => ({
    getCompanyInfo: () => ({
      companyName,
      companyLink,
      website: companyLink,
    }),
  }));

  useEffect(() => {
    props.onChange?.({
      website: companyLink,
      companyName,
      companyLink,
    });
  }, [companyLink, companyName, props]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-4xl mx-auto p-6 bg-background">
      <div className="flex-1 flex flex-col">

        {/* Heading */}
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
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                }}
              />
            </div>

            {/* Company Link — SAME DESIGN AS COMPANY NAME */}
            <div className="space-y-2">
              <Label htmlFor="company-link">
                Company website / link{" "}
                <span className="text-red-500 text-xs align-top">Required</span>
              </Label>
              <Input
                id="company-link"
                type="url"
                placeholder="https://yourcompany.com"
                className="h-10"
                value={companyLink}
                onChange={(e) => setCompanyLink(e.target.value)}
              />
            </div>

            {/* Info Box */}
            <Alert className="border border-dashed border-border bg-muted/30 rounded-xl">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm text-muted-foreground">
                Adding your company link helps us learn about your brand,
                products, and positioning. This improves automations and
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
                  It allows us to auto-prefill workflows, suggest templates,
                  and customize your dashboard experience.
                </AlertDescription>

                <h3 className="font-medium text-base mt-2">Need help?</h3>
                <AlertDescription className="text-sm text-muted-foreground">
                  Check our quickstart guide or contact support anytime.
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