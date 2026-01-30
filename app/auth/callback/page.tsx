"use client";

import {
  AnimatedSpan,
  Terminal,
  TypingAnimation,
} from "@/components/ui/terminal";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect");

  useEffect(() => {
    // Helper function to safely redirect
    const safeRedirect = (destination: string, delay: number = 2000) => {
      console.log(`🔄 Redirecting to ${destination} in ${delay}ms...`);
      setTimeout(() => {
        // Try router.replace first, fall back to window.location
        try {
          router.replace(destination);
          // If router.replace doesn't navigate after 500ms, use window.location
          setTimeout(() => {
            if (window.location.pathname === "/auth/callback") {
              console.log("⚠️ Router redirect failed, using window.location");
              window.location.href = destination;
            }
          }, 500);
        } catch (e) {
          console.error("Router error, using window.location:", e);
          window.location.href = destination;
        }
      }, delay);
    };

    const handleAuth = async () => {
      try {
        const { data: sessionData, error } = await supabase.auth.getSession();

        if (error) {
          console.error("❌ Error getting session:", error.message);
          safeRedirect("/login", 1000);
          return;
        }

        const session = sessionData?.session;
        const user = session?.user;

        if (!user) {
          console.warn("⚠️ No user found after login.");
          safeRedirect("/login", 1000);
          return;
        }

        const { id, email, user_metadata, identities } = user;

        // Try multiple fields for name (Google OAuth uses different fields)
        const name =
          user_metadata?.full_name ||
          user_metadata?.name ||
          (user_metadata?.given_name && user_metadata?.family_name
            ? `${user_metadata.given_name} ${user_metadata.family_name}`.trim()
            : user_metadata?.given_name) ||
          identities?.[0]?.identity_data?.full_name ||
          identities?.[0]?.identity_data?.name ||
          "";

        const last_login_time = new Date().toISOString();
        const avatar_url =
          user_metadata?.avatar_url ||
          user_metadata?.picture ||
          identities?.[0]?.identity_data?.avatar_url ||
          identities?.[0]?.identity_data?.picture ||
          "";

        const { data: existingUser, error: fetchError } = await supabase
          .from("users")
          .select("id, is_onboarding_done")
          .eq("id", id)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          console.error("❌ Error checking user:", fetchError.message);
          // Still redirect to dashboard on error - user might exist
          safeRedirect("/dashboard", 2000);
          return;
        }

        if (!existingUser) {
          const { error: insertError } = await supabase.from("users").insert([
            {
              id,
              name, // Column is 'name', not 'full_name'
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
            // Still redirect to onboarding - user table might have triggers
            safeRedirect("/onboarding/step1", 2000);
            return;
          }

          console.log("🆕 New user created, redirecting to onboarding...");
          safeRedirect("/onboarding/step1", 2000);
          return;
        }

        if (existingUser && existingUser.is_onboarding_done === false) {
          console.log("👋 User onboarding not done — redirecting...");
          safeRedirect("/onboarding/step1", 2000);
          return;
        }

        // Update user with latest info from OAuth provider
        const updateData: Record<string, any> = {
          last_login_time,
          is_logged_in: true,
        };

        // Also update name, email, and avatar if they come from OAuth
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (avatar_url) updateData.avatar_url = avatar_url;

        const { error: updateError } = await supabase
          .from("users")
          .update(updateData)
          .eq("id", id);

        if (updateError) {
          console.error("❌ Error updating user:", updateError.message);
          // Still redirect - login should work even if update fails
        }

        // Determine redirect destination
        const destination = redirectUrl ? decodeURIComponent(redirectUrl) : "/dashboard";
        console.log(`✅ Returning user, redirecting to ${destination}...`);
        safeRedirect(destination, 2000);
      } catch (err) {
        console.error("❌ Unexpected error in auth callback:", err);
        // Fallback redirect to dashboard
        safeRedirect("/dashboard", 1000);
      }
    };

    handleAuth();
  }, [router, redirectUrl]);

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

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="w-screen h-screen flex justify-center items-center">
        <Terminal>
          <TypingAnimation>&gt; Authenticating user...</TypingAnimation>
        </Terminal>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
