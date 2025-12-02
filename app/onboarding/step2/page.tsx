"use client";

import { useState } from "react";
import ConnectTools from "@/components/ConnectTools";
import { Button } from "@/components/ui/button";
import { validateConnectedTools } from "@/services/onboarding";
import { useRouter } from "next/navigation";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { Loader2 } from "lucide-react";

export default function Step2() {
  const router = useRouter();
  const { checking } = useOnboardingGuard();
  const [firefliesConnected, setFirefliesConnected] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    setSaving(true);
    const ok = await validateConnectedTools();
    setSaving(false);

    if (ok) {
      localStorage.setItem("onboarding_current_step", "3");
      router.push("/onboarding/step3");
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
      <ConnectTools
        onFirefliesStatusChange={setFirefliesConnected}
        onSavingChange={setSaving}
      />

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push("/onboarding/step1")}>
          Back
        </Button>

        <Button disabled={!firefliesConnected || saving} onClick={handleNext}>
          Next
        </Button>
      </div>
    </div>
  );
}