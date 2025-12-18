"use client";

import { useState } from "react";
import ConfigureSalesProcessStep from "@/components/Sales";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { updateSalesProcess, completeOnboarding } from "@/services/onboarding";
import { toast } from "sonner";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { Loader2 } from "lucide-react";

export default function Step6() {
  const router = useRouter();
  const { checking } = useOnboardingGuard();
  const [saving, setSaving] = useState(false);
  const [sales, setSales] = useState({
    sales_motion: "mid-market",
    framework: "meddic",
  });

  const handleFinish = async () => {
    try {
      setSaving(true);

      // Save sales process settings
      await updateSalesProcess(sales.sales_motion, sales.framework);

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
    <div className="flex flex-col gap-8">
      <ConfigureSalesProcessStep onChange={setSales} />

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/step5")}
          disabled={saving}
        >
          Back
        </Button>

        <Button onClick={handleFinish} disabled={saving}>
          {saving ? "Completing..." : "Finish"}
        </Button>
      </div>
    </div>
  );
}