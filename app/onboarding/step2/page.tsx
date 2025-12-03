"use client";

import { useState, useEffect } from "react";
import ConnectTools from "@/components/ConnectTools";
import { Button } from "@/components/ui/button";
import {
  validateConnectedTools,
  isInviteOnboarding,
  getPendingInviteToken,
  getPendingInviteTeamId,
  completeInviteOnboarding,
  clearInviteData,
} from "@/services/onboarding";
import { useRouter } from "next/navigation";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Users } from "lucide-react";

export default function Step2() {
  const router = useRouter();
  const { checking } = useOnboardingGuard();
  const [firefliesConnected, setFirefliesConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [inviteTeamId, setInviteTeamId] = useState<number | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // Check if this is an invite-based onboarding
  useEffect(() => {
    if (checking) return;

    const inviteMode = isInviteOnboarding();
    const token = getPendingInviteToken();
    const teamId = getPendingInviteTeamId();

    setIsInviteFlow(inviteMode);
    setInviteToken(token);
    setInviteTeamId(teamId);
  }, [checking]);

  const handleNext = async () => {
    setSaving(true);
    const ok = await validateConnectedTools();

    if (!ok) {
      setSaving(false);
      return;
    }

    // Check if this is invite-based onboarding
    if (isInviteFlow && inviteToken && inviteTeamId) {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Please log in to continue");
        setSaving(false);
        return;
      }

      // Complete invite onboarding (copies admin data and accepts invitation)
      const result = await completeInviteOnboarding(user.id, inviteTeamId, inviteToken);

      if (!result.success) {
        toast.error(result.error || "Failed to complete setup");
        setSaving(false);
        return;
      }

      // Clear invite data from localStorage
      clearInviteData();
      localStorage.setItem("onboarding_current_step", "completed");

      toast.success("Welcome to the team! Setup complete.");

      // Redirect to dashboard
      router.replace("/dashboard");
    } else {
      // Standard onboarding flow - continue to step 3
      localStorage.setItem("onboarding_current_step", "3");
      router.push("/onboarding/step3");
    }

    setSaving(false);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Invite flow indicator */}
      {isInviteFlow && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <Users className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-green-700 dark:text-green-400">
              Team Invitation Setup
            </p>
            <p className="text-sm text-muted-foreground">
              Complete this step and you&apos;ll be ready to collaborate with your team!
            </p>
          </div>
        </div>
      )}

      <ConnectTools
        onFirefliesStatusChange={setFirefliesConnected}
        onSavingChange={setSaving}
      />

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push("/onboarding/step1")}>
          Back
        </Button>

        <Button disabled={!firefliesConnected || saving} onClick={handleNext}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isInviteFlow ? "Completing Setup..." : "Saving..."}
            </>
          ) : isInviteFlow ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Complete & Join Team
            </>
          ) : (
            "Next"
          )}
        </Button>
      </div>
    </div>
  );
}