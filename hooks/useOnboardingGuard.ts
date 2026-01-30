"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getOnboardingStep, updateOnboardingStep } from "@/services/onboarding";

// Map of step number to path
const STEP_PATHS: Record<number, string> = {
  1: "/onboarding/step1",
  2: "/onboarding/step2",
  3: "/onboarding/step3",
  4: "/onboarding/step4",
  5: "/onboarding/step5",
};

// Map of path to step number
const PATH_TO_STEP: Record<string, number> = {
  "/onboarding/step1": 1,
  "/onboarding/step2": 2,
  "/onboarding/step3": 3,
  "/onboarding/step4": 4,
  "/onboarding/step5": 5,
};

export function useOnboardingGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // Not logged in, go to login
          router.replace("/login");
          return;
        }

        const { data: userData } = await supabase
          .from("users")
          .select("is_onboarding_done, onboarding_step")
          .eq("id", user.id)
          .single();

        if (userData?.is_onboarding_done) {
          // Onboarding already complete, redirect to dashboard
          router.replace("/dashboard");
          return;
        }

        // Get the user's current onboarding step from Supabase
        const savedStep = userData?.onboarding_step || 1;

        // Get the step number from the current path
        const currentPathStep = PATH_TO_STEP[pathname];

        if (currentPathStep) {
          // User is on a specific step page
          if (currentPathStep > savedStep) {
            // User is trying to access a step they haven't reached yet
            // Redirect to their current step
            router.replace(STEP_PATHS[savedStep]);
            return;
          }

          // If user is on a step less than or equal to saved step, allow access
          // and update their step in Supabase if they're advancing
          if (currentPathStep > savedStep - 1) {
            // User is at their correct step, update localStorage
            localStorage.setItem("onboarding_current_step", String(currentPathStep));
          }
        }

        // Onboarding not complete, allow access
        setChecking(false);
      } catch (err) {
        console.error("Onboarding guard error:", err);
        setChecking(false);
      }
    };

    checkOnboarding();
  }, [router, pathname]);

  return { checking };
}

/**
 * Hook to save and advance to the next onboarding step
 */
export function useOnboardingNavigation() {
  const router = useRouter();

  const goToNextStep = async (currentStep: number) => {
    const nextStep = currentStep + 1;

    // Update step in Supabase
    await updateOnboardingStep(nextStep);

    // Navigate to next step
    if (STEP_PATHS[nextStep]) {
      router.push(STEP_PATHS[nextStep]);
    }
  };

  const goToPreviousStep = (currentStep: number) => {
    const prevStep = currentStep - 1;
    if (STEP_PATHS[prevStep]) {
      router.push(STEP_PATHS[prevStep]);
    }
  };

  return { goToNextStep, goToPreviousStep };
}
