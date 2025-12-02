"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import ReviewBusinessProfile from "@/components/ReviewProfile";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { Loader2 } from "lucide-react";

export default function Step5() {
  const router = useRouter();
  const { checking } = useOnboardingGuard();

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-12">
      {/* Page Content */}
      <ReviewBusinessProfile />

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-6 border-t border-border/40">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/step4")}
          className="gap-2"
        >
          Back
        </Button>

        <Button
          onClick={() => router.push("/onboarding/step6")}
          className="gap-2"
        >
          Next
        </Button>
      </div>
    </div>
  );
}