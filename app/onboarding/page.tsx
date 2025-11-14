"use client";

import { Suspense, useRef, useState, useEffect } from "react";
import Stepper, { Step } from "@/components/Stepper";
import { SignupForm } from "@/components/signup-form";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import ConnectTools from "@/components/ConnectTools";
import CompanyInfoStep from "@/components/CompanyInfo";
import Tiptap from "@/components/AiAnalysis";
import ConfigureSalesProcessStep from "@/components/Sales";
import ReviewBusinessProfile from "@/components/ReviewProfile";
import Navbar from "@/components/Navbar";
import { toast } from "sonner"; // ✅ Needed for validation

function OnboardingSteps() {
  const router = useRouter();
  const companyInfoRef = useRef<any>(null);

  const [signupData, setSignupData] = useState({
    fullname: "",
    email: "",
  });

  const [currentStep, setCurrentStep] = useState(1);

  const [salesProcess, setSalesProcess] = useState({
    sales_motion: "mid-market",
    framework: "meddic",
  });

  // Get stored user details
  const getStoredAuthData = () => {
    if (typeof window === "undefined") return { name: "", email: "" };

    try {
      const token = localStorage.getItem("sb-rpowalzrbddorfnnmccp-auth-token");
      if (token) {
        const parsed = JSON.parse(token);
        return {
          name:
            parsed?.user?.user_metadata?.full_name ||
            parsed?.user?.user_metadata?.name ||
            "",
          email: parsed?.user?.email || "",
        };
      }
    } catch (error) {
      console.error("Error reading auth token:", error);
    }
    return { name: "", email: "" };
  };

  const { name: storedName, email: storedEmail } = getStoredAuthData();

  // Parse company JSON
  const jsonData =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("company_json_data") || "{}")
      : {};

  // ---- Save Basic User Info ----
  const updateUserInSupabase = async (fullname: string, email: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date().toISOString();

      await supabase.from("users").upsert(
        {
          id: user.id,
          name: fullname,
          email,
          created_at: now,
          last_login_time: now,
          is_logged_in: true,
        },
        { onConflict: "id" }
      );
    } catch (err) {
      console.error("User update error:", err);
    }
  };

  // ---- Save Sales Process ----
  const updateSalesProcess = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("users")
        .update({
          sales_motion: salesProcess.sales_motion,
          framework: salesProcess.framework,
        })
        .eq("id", user.id);
    } catch (err) {
      console.error("Error updating sales:", err);
    }
  };

  // ---- Send Website to Webhook ----
  const sendWebsiteToWebhook = async (website: string, company: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: companyData } = await supabase
        .from("company")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!companyData?.id) return;

      await fetch(
        "https://omrajpal.app.n8n.cloud/webhook-test/c5b19b00-5069-4884-894a-9807e387555c",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            website,
            company_id: companyData.id,
            company_name: company,
          }),
        }
      );
    } catch (err) {
      console.error("Webhook error:", err);
    }
  };

  // 🚨 CHECK SUPABASE KEYS BEFORE MOVING PAST CONNECT TOOLS (STEP 2 → STEP 3)
  const validateConnectedTools = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from("api_keys")
        .select("fireflies, openapi")
        .eq("user_id", user.id)
        .single();

      if (!data || (!data.fireflies && !data.openapi)) {
        toast.error("Please connect at least one tool before continuing.");
        return false;
      }

      return true;
    } catch (err) {
      console.error("Validation error:", err);
      toast.error("Unable to verify connected tools.");
      return false;
    }
  };

  // ---- Step Change Logic ----
  const handleStepChange = async (step: number) => {
    // STEP 1 → STEP 2: Save User Info
    if (
      currentStep === 1 &&
      step === 2 &&
      signupData.fullname &&
      signupData.email
    ) {
      await updateUserInSupabase(signupData.fullname, signupData.email);
    }

    // 🔒 STEP 2 → STEP 3: Ensure tools are connected
    if (currentStep === 2 && step === 3) {
      const ok = await validateConnectedTools();
      if (!ok) return; // ⛔ BLOCK MOVING FORWARD
    }

    // STEP 3 → STEP 4: Webhook
    if (currentStep === 3 && step === 4) {
      const info = companyInfoRef.current?.getCompanyInfo();
      if (info) await sendWebsiteToWebhook(info.website, info.companyName);
    }

    setCurrentStep(step);
  };

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-5xl px-4 py-6">
        <Stepper
          initialStep={1}
          // @ts-ignore
          onStepChange={handleStepChange}
          onFinalStepCompleted={async () => {
            await updateSalesProcess();
            router.replace("/dashboard");
          }}
          className="transition-all duration-300"
        >
          <Step>
            <div className="pb-10">
              <SignupForm
                fullname={storedName}
                email={storedEmail}
                onChange={setSignupData}
              />
            </div>
          </Step>

          <Step>
            <div className="pb-10">
              <ConnectTools />
            </div>
          </Step>

          <Step>
            <div className="pb-10">
              <CompanyInfoStep ref={companyInfoRef} />
            </div>
          </Step>

          <Step>
            <div className="pb-10">
              <Tiptap />
            </div>
          </Step>

          <Step>
            <div className="pb-10">
              <ReviewBusinessProfile
                // @ts-ignore
                companyInfo={{
                  name: jsonData.company_info?.company_name,
                  website: jsonData.company_info?.website,
                  value: jsonData.company_info?.value_proposition,
                }}
                products={jsonData.products_and_services || []}
                idealCustomer={{
                  industry: jsonData.ideal_customer_profile?.industry,
                  size: jsonData.ideal_customer_profile?.company_size,
                  region: jsonData.ideal_customer_profile?.region,
                  techStack: jsonData.ideal_customer_profile?.tech_stack,
                  salesMotion: jsonData.ideal_customer_profile?.sales_motion,
                }}
                buyerPersonas={jsonData.buyer_personas || []}
                talkTracks={jsonData.talk_tracks || []}
                objections={jsonData.objection_handling || []}
              />
            </div>
          </Step>

          <Step>
            <div className="pb-10">
              <ConfigureSalesProcessStep onChange={setSalesProcess} />
            </div>
          </Step>
        </Stepper>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <div>
      <Suspense fallback={<div>Loading onboarding...</div>}>
        <Navbar classname="absolute z-10 top-10 mx-auto left-0 right-0" />
        <div
          className="
          mt-40
          min-h-screen
          flex flex-col 
          bg-background 
          overflow-y-auto 
          scrollbar-thin scrollbar-thumb-muted-foreground/30
        "
        >
          <OnboardingSteps />
        </div>
      </Suspense>
    </div>
  );
}
