"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sendWebsiteToWebhook } from "@/services/onboarding";
import { useRouter } from "next/navigation";
import { Info, Loader2, Sparkles } from "lucide-react";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";

export default function Step3() {
  const router = useRouter();
  const { checking } = useOnboardingGuard();

  const [companyName, setCompanyName] = useState("");
  const [companyLink, setCompanyLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleNext = async () => {
    // Validation
    if (!companyName.trim() || !companyLink.trim()) {
      setError("Company name & website link are required.");
      return;
    }

    setError(null);
    setIsAnalyzing(true);

    // Save to localStorage
    const info = {
      companyName: companyName.trim(),
      companyLink: companyLink.trim(),
      website: companyLink.trim(),
    };
    localStorage.setItem("onboarding_company_info", JSON.stringify(info));

    try {
      const result = await sendWebsiteToWebhook(info.website, info.companyName);

      if (!result.success) {
        setIsAnalyzing(false);
        setError("Failed to analyze your company. Please try again.");
        return;
      }

      // Store webhook response data to localStorage
      if (result.markdown) {
        localStorage.setItem("webhook_markdown", result.markdown);
      }
      if (result.json_val) {
        // If json_val is already a string, store it directly; otherwise stringify it
        const jsonString =
          typeof result.json_val === "string"
            ? result.json_val
            : JSON.stringify(result.json_val);
        localStorage.setItem("company_json_data", jsonString);
      }

      localStorage.setItem("onboarding_current_step", "4");
      router.push("/onboarding/step4");
    } catch (err) {
      setIsAnalyzing(false);
      setError("An error occurred. Please try again.");
    }
  };

  // Show loader when checking auth
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show loader when analyzing
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 w-full max-w-4xl mx-auto p-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary/60 rounded-full blur-xl opacity-30 animate-pulse" />
          <div className="relative bg-background border border-border/60 rounded-full p-6">
            <Sparkles className="h-12 w-12 text-primary animate-pulse" />
          </div>
        </div>

        <div className="text-center space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            AI is analyzing your company
          </h2>
          <p className="text-muted-foreground max-w-md">
            We&apos;re scanning your website to understand your products, ideal
            customers, and sales positioning. This may take a few minutes.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Processing {companyLink}...</span>
        </div>

        <div className="w-full max-w-xs">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 rounded-full animate-[loading_2s_ease-in-out_infinite]" />
          </div>
        </div>

        <style jsx>{`
          @keyframes loading {
            0% {
              width: 0%;
              margin-left: 0;
            }
            50% {
              width: 70%;
              margin-left: 15%;
            }
            100% {
              width: 0%;
              margin-left: 100%;
            }
          }
        `}</style>
      </div>
    );
  }

  // Show form when not analyzing
  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-4xl mx-auto p-6 bg-background">
      <div className="flex-1 flex flex-col">
        {/* Heading */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold">Tell Us About Your Company</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll use this info to personalize recommendations and
            automations.
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
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            {/* Company Link */}
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

            {/* Error Message */}
            {error && (
              <p className="text-red-500 text-sm" role="alert">
                {error}
              </p>
            )}

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
                  It allows us to auto-prefill workflows, suggest templates, and
                  customize your dashboard experience.
                </AlertDescription>

                <h3 className="font-medium text-base mt-2">Need help?</h3>
                <AlertDescription className="text-sm text-muted-foreground">
                  Check our quickstart guide or contact support anytime.
                </AlertDescription>
              </div>
            </Alert>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => router.push("/onboarding/step2")}
          >
            Back
          </Button>

          <Button
            onClick={handleNext}
            disabled={!companyName.trim() || !companyLink.trim()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
