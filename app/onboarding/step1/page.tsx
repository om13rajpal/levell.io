"use client";

import { useState, useEffect } from "react";
import { SignupForm } from "@/components/signup-form";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { getStoredAuth, updateUserInSupabase } from "@/services/onboarding";

export default function Step1() {
  const router = useRouter();

  const [form, setForm] = useState({ fullname: "", email: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredAuth();
    const saved = localStorage.getItem("onboarding_signup");

    if (saved) setForm(JSON.parse(saved));
    else setForm({ fullname: stored.name, email: stored.email });
  }, []);

  const handleNext = async () => {
    if (!form.fullname || !form.email) {
      setError("Both fields are required.");
      return;
    }

    localStorage.setItem("onboarding_signup", JSON.stringify(form));
    await updateUserInSupabase(form.fullname, form.email);

    localStorage.setItem("onboarding_current_step", "2");
    router.push("/onboarding/step2");
  };

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