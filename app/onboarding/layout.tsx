"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { usePathname } from "next/navigation";
import { isInviteOnboarding } from "@/services/onboarding";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const rawStep = Number(pathname.split("step")[1]) || 1;
  const [isInviteFlow, setIsInviteFlow] = useState(false);

  // Check if this is an invite-based onboarding
  useEffect(() => {
    setIsInviteFlow(isInviteOnboarding());
  }, []);

  // For invite flow: only 2 steps (step 1 = profile, step 2 = connect tools)
  // For normal flow: 6 steps
  const totalSteps = isInviteFlow ? 2 : 6;
  const step = isInviteFlow ? Math.min(rawStep, 2) : rawStep;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Centered Navbar */}
      <div className="w-full flex justify-center border-b-0 py-4 mt-5">
          <Navbar />
      </div>

      {/* Centered Progress Bar (40% width) */}
      <div className="w-full flex justify-center py-4">
        <div className="w-[40%]">
          <OnboardingProgress step={step} totalSteps={totalSteps} />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto p-6 w-full">
        {children}
      </main>
    </div>
  );
}