"use client";

import { Progress } from "@/components/ui/progress";

interface OnboardingProgressProps {
  step: number;
  totalSteps?: number;
}

export function OnboardingProgress({ step, totalSteps = 6 }: OnboardingProgressProps) {
  const value = (step / totalSteps) * 100;

  return (
    <div className="p-4 bg-background">
      <p className="text-sm text-muted-foreground">
        Step {step} of {totalSteps}
      </p>
      <Progress value={value} />
    </div>
  );
}
