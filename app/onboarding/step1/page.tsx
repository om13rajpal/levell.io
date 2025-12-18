"use client";

import { useState, useEffect } from "react";
import { SignupForm } from "@/components/signup-form";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { getAuthUserData, updateUserInSupabase, updateOnboardingStep } from "@/services/onboarding";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { Loader2 } from "lucide-react";

export default function Step1() {
  const router = useRouter();
  const { checking } = useOnboardingGuard();

  const [form, setForm] = useState({ fullname: "", email: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (checking) return;

    const loadUserData = async () => {
      const saved = localStorage.getItem("onboarding_signup");

      if (saved) {
        try {
          setForm(JSON.parse(saved));
        } catch {
          // If localStorage is corrupted, clear it and load fresh user data
          localStorage.removeItem("onboarding_signup");
          const userData = await getAuthUserData();
          setForm({ fullname: userData.name, email: userData.email });
        }
      } else {
        // Use async Supabase call to get fresh user data
        const userData = await getAuthUserData();
        setForm({ fullname: userData.name, email: userData.email });
      }
    };

    loadUserData();
  }, [checking]);

  const handleNext = async () => {
    if (!form.fullname || !form.email) {
      setError("Both fields are required.");
      return;
    }

    localStorage.setItem("onboarding_signup", JSON.stringify(form));
    await updateUserInSupabase(form.fullname, form.email);

    // Update step in Supabase and localStorage
    await updateOnboardingStep(2);
    router.push("/onboarding/step2");
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full py-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Form Wrapper */}
      <div className="w-full max-w-md bg-white/70 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 shadow-sm rounded-xl p-8 backdrop-blur-sm">
        <SignupForm
          fullname={form.fullname}
          email={form.email}
          error={error || undefined}
          onChange={(data) => {
            setForm(data);
            setError(null);
          }}
        />

        <div className="flex justify-end mt-6">
          <Button onClick={handleNext} className="px-6">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}