"use client";

import { Progress } from "@/components/ui/progress";

export function OnboardingProgress({ step }: { step: number }) {
  const TOTAL = 6;
  const value = (step / TOTAL) * 100;

  return (
    <div className="p-4 bg-background">
      <p className="text-sm text-muted-foreground">
        Step {step} of {TOTAL}
      </p>
      <Progress value={value} />
    </div>
  );
}
