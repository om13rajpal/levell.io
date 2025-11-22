"use client";

import { useState } from "react";
import ConfigureSalesProcessStep from "@/components/Sales";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { updateSalesProcess } from "@/services/onboarding";

export default function Step6() {
  const router = useRouter();
  const [sales, setSales] = useState({
    sales_motion: "mid-market",
    framework: "meddic",
  });

  const handleFinish = async () => {
    await updateSalesProcess(sales.sales_motion, sales.framework);

    localStorage.setItem("onboarding_current_step", "completed");
    router.replace("/dashboard");
  };

  return (
    <div className="flex flex-col gap-8">
      <ConfigureSalesProcessStep onChange={setSales} />

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push("/onboarding/step5")}>
          Back
        </Button>

        <Button onClick={handleFinish}>Finish</Button>
      </div>
    </div>
  );
}