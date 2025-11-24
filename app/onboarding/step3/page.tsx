"use client";

import { useRef, useState } from "react";
import CompanyInfoStep from "@/components/CompanyInfo";
import { Button } from "@/components/ui/button";
import { sendWebsiteToWebhook } from "@/services/onboarding";
import { useRouter } from "next/navigation";

export default function Step3() {
  const router = useRouter();
  const ref = useRef<any>(null);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleNext = async () => {
    const info = ref.current?.getCompanyInfo();

    // ✅ FIXED: Updated validation
    if (!info?.companyName || !info?.companyLink) {
      setError("Company name & website link are required.");
      return;
    }

    setError(null);

    localStorage.setItem("onboarding_company_info", JSON.stringify(info));

    setPending(true);
    const result = await sendWebsiteToWebhook(info.website, info.companyName);
    setPending(false);

    if (!result.success) {
      setError("Failed to send data to webhook. Please try again.");
      return;
    }

    // Store webhook response data to localStorage
    if (result.markdown) {
      localStorage.setItem("webhook_markdown", result.markdown);
    }
    if (result.json_val) {
      // If json_val is already a string, store it directly; otherwise stringify it
      const jsonString = typeof result.json_val === "string"
        ? result.json_val
        : JSON.stringify(result.json_val);
      localStorage.setItem("company_json_data", jsonString);
    }

    localStorage.setItem("onboarding_current_step", "4");
    router.push("/onboarding/step4");
  };

  return (
    <div className="flex flex-col gap-8">
      <CompanyInfoStep ref={ref} onChange={() => {}} />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push("/onboarding/step2")}>
          Back
        </Button>

        <Button onClick={handleNext} disabled={pending}>
          {pending ? "Sending..." : "Next"}
        </Button>
      </div>
    </div>
  );
}