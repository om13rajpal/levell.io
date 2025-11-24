"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Tiptap from "@/components/AiAnalysis";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Step4() {
  const router = useRouter();

  const [pending, setPending] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [timeoutError, setTimeoutError] = useState(false);

  // ----------------------------
  // 1️⃣ LocalStorage Polling with Timeout
  // ----------------------------
  useEffect(() => {
    const check = () => {
      const markdown = localStorage.getItem("webhook_markdown");
      if (markdown) {
        setHasData(true);
        setPending(false);
      }
    };

    check(); // immediate
    const interval = setInterval(check, 1200);

    // Set 5-minute timeout (300000ms)
    const timeout = setTimeout(() => {
      if (!hasData) {
        setPending(false);
        setTimeoutError(true);
      }
    }, 300000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [hasData]);

  // ----------------------------
  // 2️⃣ Supabase Realtime Listener (MATCHES EDITOR)
  // ----------------------------
  useEffect(() => {
    const channel = supabase
      .channel("realtime:webhook_data_step4")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "webhook_data" },
        (payload) => {
          console.log("📡 Step4 got realtime payload:", payload);

          // extract markdown
          const md =
            (payload.new as any)?.markdown ||
            (payload.new as any)?.payload?.markdown ||
            (payload.new as any)?.payload?.data ||
            "";

          if (md) {
            localStorage.setItem("webhook_markdown", md);
            setHasData(true);
            setPending(false);
          }

          // extract JSON
          let jsonVal = (payload.new as any)?.json_val;
          if (!jsonVal && (payload.new as any)?.payload?.json_val) {
            jsonVal = (payload.new as any)?.payload?.json_val;
          }

          if (jsonVal) {
            localStorage.setItem("company_json_data", JSON.stringify(jsonVal));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {pending && !hasData ? (
        <div className="flex flex-col items-center gap-3 text-muted-foreground py-20">
          <span className="loader" />
          <p>Waiting for workflow…</p>
        </div>
      ) : timeoutError ? (
        <div className="flex flex-col items-center gap-4 text-center py-20">
          <p className="text-red-500 font-semibold">Workflow timeout</p>
          <p className="text-sm text-muted-foreground max-w-md">
            The AI analysis is taking longer than expected. Please go back and try again,
            or contact support if the issue persists.
          </p>
        </div>
      ) : (
        <Tiptap />
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push("/onboarding/step3")}>
          Back
        </Button>

        <Button disabled={!hasData || timeoutError} onClick={() => router.push("/onboarding/step5")}>
          Next
        </Button>
      </div>
    </div>
  );
}