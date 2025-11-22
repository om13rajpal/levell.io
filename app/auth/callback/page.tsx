"use client";

import {
  AnimatedSpan,
  Terminal,
  TypingAnimation,
} from "@/components/ui/terminal";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      const { data: sessionData, error } = await supabase.auth.getSession();

      if (error) {
        console.error("❌ Error getting session:", error.message);
        return;
      }

      const session = sessionData?.session;
      const user = session?.user;

      if (!user) {
        console.warn("⚠️ No user found after login.");
        router.replace("/login");
        return;
      }

      const { id, email, user_metadata } = user;
      const name = user_metadata?.full_name || user_metadata?.name || "";
      const last_login_time = new Date().toISOString();
      const avatar_url = user_metadata?.avatar_url || "";

      const { data: existingUser, error: fetchError } = await supabase
        .from("users")
        .select("id, is_onboarding_done")
        .eq("id", id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("❌ Error checking user:", fetchError.message);
        return;
      }

      if (!existingUser) {
        const { error: insertError } = await supabase.from("users").insert([
          {
            id,
            name,
            email,
            last_login_time,
            created_at: new Date().toISOString(),
            is_logged_in: true,
            is_onboarding_done: false,
            avatar_url,
          },
        ]);

        if (insertError) {
          console.error("❌ Error inserting new user:", insertError.message);
          return;
        }

        console.log("🆕 New user created, redirecting to onboarding...");
        setTimeout(() => {
          router.replace("/onboarding/step1");
        }, 5500);
        return;
      }

      if (existingUser && existingUser.is_onboarding_done === false) {
        console.log("👋 User onboarding not done — redirecting...");
        setTimeout(() => {
          router.replace("/onboarding/step1");
        }, 5500);
        return;
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({ last_login_time, is_logged_in: true })
        .eq("id", id);

      if (updateError) {
        console.error("❌ Error updating user:", updateError.message);
        return;
      }

      console.log("✅ Returning user, redirecting to dashboard...");

      setTimeout(() => {
        router.replace("/dashboard");
      }, 5500);
    };

    handleAuth();
  }, [router]);

  return (
    <div className="w-screen h-screen flex justify-center items-center">
      <Terminal>
        <TypingAnimation>&gt; Authenticating user...</TypingAnimation>
        <AnimatedSpan className="text-green-500">
          ✔ Google sign-in successful.
        </AnimatedSpan>
        <AnimatedSpan className="text-green-500">
          ✔ Checking user in database.
        </AnimatedSpan>
        <AnimatedSpan className="text-green-500">
          ✔ Updating session info.
        </AnimatedSpan>
        <AnimatedSpan className="text-blue-500">
          <span>ℹ Redirecting to workspace...</span>
        </AnimatedSpan>
        <TypingAnimation className="text-muted-foreground">
          Please wait while we prepare your dashboard 🚀
        </TypingAnimation>
      </Terminal>
    </div>
  );
}
