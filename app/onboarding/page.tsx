"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAndRedirect = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: userData } = await supabase
          .from("users")
          .select("is_onboarding_done")
          .eq("id", user.id)
          .single();

        if (userData?.is_onboarding_done) {
          router.replace("/dashboard");
        } else {
          router.replace("/onboarding/step1");
        }
      } catch (err) {
        console.error("Onboarding redirect error:", err);
        router.replace("/onboarding/step1");
      }
    };

    checkAndRedirect();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
