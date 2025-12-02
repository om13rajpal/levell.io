"use client";

import { LoginForm } from "@/components/login-form";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const redirectUrl = searchParams.get("redirect");

  useEffect(() => {
    toast.dismiss();

    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // If there's a redirect URL, use it (e.g., team invite)
          if (redirectUrl) {
            router.replace(decodeURIComponent(redirectUrl));
            return;
          }

          // User is logged in, check onboarding status
          const { data: userData } = await supabase
            .from("users")
            .select("is_onboarding_done")
            .eq("id", user.id)
            .single();

          if (userData?.is_onboarding_done) {
            // Onboarding complete, go to dashboard
            router.replace("/dashboard");
            return;
          } else {
            // Onboarding not complete, go to onboarding
            router.replace("/onboarding/step1");
            return;
          }
        }
      } catch (err) {
        console.error("Auth check error:", err);
      }

      setChecking(false);
    };

    checkAuth();
  }, [router, redirectUrl]);

  if (checking) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <Navbar classname="absolute z-10 top-10" />
      <div className="w-full max-w-sm">
        <LoginForm redirectUrl={redirectUrl} />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
