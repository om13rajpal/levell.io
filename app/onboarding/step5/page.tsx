"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import ReviewBusinessProfile from "@/components/ReviewProfile";

export default function Step5() {
  const router = useRouter();

  const data =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("company_json_data") || "{}")
      : {};

  return (
    <div className="flex flex-col gap-8">
      <ReviewBusinessProfile
        companyInfo={{
          name: data.company_info?.company_name,
          website: data.company_info?.website,
          value: data.company_info?.value_proposition,
        }}
        products={data.products_and_services || []}
        idealCustomer={{
          industry: data.ideal_customer_profile?.industry,
          size: data.ideal_customer_profile?.company_size,
          region: data.ideal_customer_profile?.region,
          techStack: data.ideal_customer_profile?.tech_stack,
          salesMotion: data.ideal_customer_profile?.sales_motion,
        }}
        buyerPersonas={data.buyer_personas || []}
        talkTracks={data.talk_tracks || []}
        objections={data.objection_handling || []}
      />

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push("/onboarding/step4")}>
          Back
        </Button>

        <Button onClick={() => router.push("/onboarding/step6")}>
          Next
        </Button>
      </div>
    </div>
  );
}