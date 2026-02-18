"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Tiptap from "@/components/AiAnalysis";
import { useRouter } from "next/navigation";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { Loader2 } from "lucide-react";
import { fetchWebhookData, updateOnboardingStep } from "@/services/onboarding";

export default function Step4() {
  const router = useRouter();
  const { checking } = useOnboardingGuard();

  const [hasData, setHasData] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Check Supabase (primary) or localStorage (fallback) for webhook data
  useEffect(() => {
    if (checking) return;

    const checkData = async () => {
      try {
        // First try Supabase
        const result = await fetchWebhookData();
        if (result.success && (result.data || result.markdown)) {
          setHasData(true);
          setLoadingData(false);
          return;
        }

        // Fallback to localStorage
        const markdown = localStorage.getItem("webhook_markdown");
        const jsonData = localStorage.getItem("company_json_data");
        if (markdown || jsonData) {
          setHasData(true);
        }
      } catch (err) {
        console.error("Error checking data:", err);
        // Fallback to localStorage
        const markdown = localStorage.getItem("webhook_markdown");
        if (markdown) {
          setHasData(true);
        }
      } finally {
        setLoadingData(false);
      }
    };

    checkData();
  }, [checking]);

  if (checking || loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {!hasData ? (
        <div className="flex flex-col items-center gap-4 text-center py-20">
          <p className="text-red-500 font-semibold">No data available</p>
          <p className="text-sm text-muted-foreground max-w-md">
            No analysis data found. Please go back and submit your company information again.
          </p>
        </div>
      ) : (
        <Tiptap />
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push("/onboarding/step3")}>
          Back
        </Button>

        <Button disabled={!hasData} onClick={async () => {
          await updateOnboardingStep(5);
          router.push("/onboarding/step5");
        }}>
          Next
        </Button>
      </div>
    </div>
  );
}