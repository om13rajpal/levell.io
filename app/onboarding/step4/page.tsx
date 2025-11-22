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

  // ----------------------------
  // 1️⃣ LocalStorage Polling
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
    return () => clearInterval(interval);
  }, []);

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
            payload.new?.markdown ||
            payload.new?.payload?.markdown ||
            payload.new?.payload?.data ||
            "";

          if (md) {
            localStorage.setItem("webhook_markdown", md);
            setHasData(true);
            setPending(false);
          }

          // extract JSON
          let jsonVal = payload.new?.json_val;
          if (!jsonVal && payload.new?.payload?.json_val) {
            jsonVal = payload.new?.payload?.json_val;
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
      ) : (
        <Tiptap />
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push("/onboarding/step3")}>
          Back
        </Button>

        <Button disabled={!hasData} onClick={() => router.push("/onboarding/step5")}>
          Next
        </Button>
      </div>
    </div>
  );
}