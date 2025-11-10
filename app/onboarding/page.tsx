"use client";

import { Suspense } from "react";
import Stepper, { Step } from "@/components/Stepper";
import { SignupForm } from "@/components/signup-form";
import { useRouter, useSearchParams } from "next/navigation";
import ConnectTools from "@/components/ConnectTools";
import CompanyInfoStep from "@/components/CompanyInfo";
import Tiptap from "@/components/AiAnalysis";
import ConfigureSalesProcessStep from "@/components/Sales";
import ReviewBusinessProfile from "@/components/ReviewProfile";

function OnboardingSteps({
  fullname: propFullname,
  email: propEmail,
}: {
  fullname?: string;
  email?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fullname = propFullname || searchParams.get("name") || "";
  const email = propEmail || searchParams.get("email") || "";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-7xl">
        <Stepper
          initialStep={1}
          //@ts-ignore
          onStepChange={(step: number) => console.log("📍 Current step:", step)}
          onFinalStepCompleted={() => {
            console.log("🎉 All steps completed!");
            router.replace("/dashboard");
          }}
          backButtonText="Previous"
          nextButtonText="Next"
        >
          <Step>
            <SignupForm fullname={fullname} email={email} />
          </Step>
          <Step>
            <ConnectTools />
          </Step>
          <Step>
            <CompanyInfoStep />
          </Step>
          <Step>
            <Tiptap />
          </Step>
          <Step>
            <ReviewBusinessProfile
              companyInfo={{
                name: "Example Corp",
                website: "https://example.com",
                value: "We provide exemplary services.",
              }}
              products={[{ name: "Product 1" }, { name: "Product 2" }]}
              idealCustomer={{
                industry: "Tech",
                size: "100-500",
                region: "North America",
                techStack: "React, Node.js",
                salesMotion: "B2B",
              }}
              buyerPersonas={[
                {
                  title: "Persona 1",
                  goals: "Increase revenue",
                  pains: "Lack of time",
                  concerns: "Budget constraints",
                },
              ]}
              talkTracks={[{ title: "Track 1", content: "How to sell Product 1" }]}
              objections={[{ title: "Objection 1", content: "It's too expensive" }]}
            />
          </Step>
          <Step>
            <ConfigureSalesProcessStep />
          </Step>
        </Stepper>
      </div>
    </div>
  );
}

export default function OnboardingPage(props: { fullname?: string; email?: string }) {
  return (
    <Suspense fallback={<div></div>}>
      <OnboardingSteps {...props} />
    </Suspense>
  );
}