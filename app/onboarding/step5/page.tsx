"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import ReviewBusinessProfile from "@/components/ReviewProfile";
import ConfigureSalesProcessStep from "@/components/Sales";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { Loader2 } from "lucide-react";
import { completeOnboarding, updateSalesProcess } from "@/services/onboarding";
import { toast } from "sonner";

export default function Step5() {
  const router = useRouter();
  const { checking } = useOnboardingGuard();
  const [saving, setSaving] = useState(false);
  const [salesMotion, setSalesMotion] = useState("mid-market");

  const handleFinish = async () => {
    try {
      setSaving(true);

      // Save sales motion setting
      await updateSalesProcess(salesMotion);

      // Mark onboarding as complete in Supabase
      const success = await completeOnboarding();

      if (!success) {
        toast.error("Failed to complete onboarding. Please try again.");
        setSaving(false);
        return;
      }

      // Redirect to dashboard
      router.replace("/dashboard");
    } catch (err) {
      console.error("Error completing onboarding:", err);
      toast.error("Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-12">
      {/* Review Business Profile */}
      <ReviewBusinessProfile />

      {/* Sales Motion Selector */}
      <div className="border-t border-border/40 pt-8">
        <ConfigureSalesProcessStep onChange={setSalesMotion} />
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-6 border-t border-border/40">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/step4")}
          className="gap-2"
          disabled={saving}
        >
          Back
        </Button>

        <Button
          onClick={handleFinish}
          className="gap-2"
          disabled={saving}
        >
          {saving ? "Completing..." : "Finish"}
        </Button>
      </div>
    </div>
  );
}