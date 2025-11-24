"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Tiptap from "@/components/AiAnalysis";
import { useRouter } from "next/navigation";

export default function Step4() {
  const router = useRouter();

  const [hasData, setHasData] = useState(false);

  // Check localStorage on mount for webhook data
  useEffect(() => {
    const markdown = localStorage.getItem("webhook_markdown");
    if (markdown) {
      setHasData(true);
    }
  }, []);

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

        <Button disabled={!hasData} onClick={() => router.push("/onboarding/step5")}>
          Next
        </Button>
      </div>
    </div>
  );
}