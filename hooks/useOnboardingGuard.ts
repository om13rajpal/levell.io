"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useOnboardingGuard() {
  const router = useRouter();
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
          .select("is_onboarding_done")
          .eq("id", user.id)
          .single();

        if (userData?.is_onboarding_done) {
          // Onboarding already complete, redirect to dashboard
          router.replace("/dashboard");
          return;
        }

        // Onboarding not complete, allow access
        setChecking(false);
      } catch (err) {
        console.error("Onboarding guard error:", err);
        setChecking(false);
      }
    };

    checkOnboarding();
  }, [router]);

  return { checking };
}
