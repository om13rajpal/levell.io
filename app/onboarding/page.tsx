// "use client";

// import { Suspense, useRef, useState, useEffect } from "react";
// import Stepper, { Step } from "@/components/Stepper";
// import { SignupForm } from "@/components/signup-form";
// import { useRouter } from "next/navigation";
// import { supabase } from "@/lib/supabaseClient";

// import ConnectTools from "@/components/ConnectTools";
// import CompanyInfoStep from "@/components/CompanyInfo";
// import Tiptap from "@/components/AiAnalysis";
// import ConfigureSalesProcessStep from "@/components/Sales";
// import ReviewBusinessProfile from "@/components/ReviewProfile";
// import Navbar from "@/components/Navbar";
// import { toast } from "sonner";
// import ClientOnly from "@/components/clientOnly";

// function OnboardingSteps() {
//   const router = useRouter();
//   const companyInfoRef = useRef<any>(null);

//   // FIXED — SSR always step 1, hydrate later
//   const [currentStep, setCurrentStep] = useState(1);

//   useEffect(() => {
//     const saved = Number(
//       localStorage.getItem("onboarding_current_step") || "1"
//     );
//     setCurrentStep(saved);
//   }, []);

//   const getStoredAuthData = () => {
//     if (typeof window === "undefined") return { name: "", email: "" };

//     try {
//       const token = localStorage.getItem("sb-rpowalzrbddorfnnmccp-auth-token");
//       if (token) {
//         const parsed = JSON.parse(token);
//         return {
//           name:
//             parsed?.user?.user_metadata?.full_name ||
//             parsed?.user?.user_metadata?.name ||
//             "",
//           email: parsed?.user?.email || "",
//         };
//       }
//     } catch {}
//     return { name: "", email: "" };
//   };

//   const [storedAuth, setStoredAuth] = useState({ name: "", email: "" });

//   useEffect(() => {
//     setStoredAuth(getStoredAuthData());
//   }, []);

//   const [signupData, setSignupData] = useState({ fullname: "", email: "" });
//   const [signupError, setSignupError] = useState<string | null>(null);

//   const [isNextLoading, setIsNextLoading] = useState(false);

//   const [salesProcess, setSalesProcess] = useState({
//     sales_motion: "mid-market",
//     framework: "meddic",
//   });

//   const [firefliesConnected, setFirefliesConnected] = useState<boolean>(() => {
//     if (typeof window === "undefined") return false;
//     return localStorage.getItem("onboarding_fireflies_connected") === "true";
//   });
//   const [isSavingIntegration, setIsSavingIntegration] = useState(false);

//   const [companyInfo, setCompanyInfo] = useState({
//     website: "",
//     companyName: "",
//     companyEmail: "",
//   });
//   const [companyError, setCompanyError] = useState<string | null>(null);

//   const [isWebhookPending, setIsWebhookPending] = useState(false);
//   const [hasWebhookData, setHasWebhookData] = useState(() => {
//     if (typeof window === "undefined") return false;
//     return Boolean(localStorage.getItem("webhook_markdown"));
//   });

//   useEffect(() => {
//     const savedSignup = localStorage.getItem("onboarding_signup");
//     if (savedSignup) {
//       setSignupData(JSON.parse(savedSignup));
//     } else {
//       setSignupData({
//         fullname: storedAuth.name,
//         email: storedAuth.email,
//       });
//     }

//     const savedCompany = localStorage.getItem("onboarding_company_info");
//     if (savedCompany) {
//       setCompanyInfo(JSON.parse(savedCompany));
//     }
//   }, [storedAuth]);

//   useEffect(() => {
//     const handler = () => {
//       const markdown = localStorage.getItem("webhook_markdown");
//       if (markdown) {
//         setHasWebhookData(true);
//         setIsWebhookPending(false);
//       }
//     };

//     window.addEventListener("storage", handler);
//     return () => window.removeEventListener("storage", handler);
//   }, []);

//   const jsonData =
//     typeof window !== "undefined"
//       ? JSON.parse(localStorage.getItem("company_json_data") || "{}")
//       : {};

//   const updateUserInSupabase = async (fullname: string, email: string) => {
//     try {
//       const {
//         data: { user },
//       } = await supabase.auth.getUser();
//       if (!user) return;

//       const now = new Date().toISOString();

//       await supabase.from("users").upsert(
//         {
//           id: user.id,
//           name: fullname,
//           email,
//           created_at: now,
//           last_login_time: now,
//           is_logged_in: true,
//         },
//         { onConflict: "id" }
//       );
//     } catch {}
//   };

//   const updateSalesProcess = async () => {
//     try {
//       const {
//         data: { user },
//       } = await supabase.auth.getUser();
//       if (!user) return;

//       await supabase
//         .from("users")
//         .update({
//           sales_motion: salesProcess.sales_motion,
//           framework: salesProcess.framework,
//         })
//         .eq("id", user.id);
//     } catch {}
//   };

//   const sendWebsiteToWebhook = async (website: string, company: string) => {
//     try {
//       const {
//         data: { user },
//       } = await supabase.auth.getUser();
//       if (!user) return false;

//       const { data: companyData } = await supabase
//         .from("company")
//         .select("id")
//         .eq("user_id", user.id)
//         .single();

//       if (!companyData?.id) return false;

//       const res = await fetch(
//         "https://omrajpal.app.n8n.cloud/webhook-test/c5b19b00-5069-4884-894a-9807e387555c",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             website,
//             company_id: companyData.id,
//             company_name: company,
//           }),
//         }
//       );

//       return res.ok;
//     } catch {
//       return false;
//     }
//   };

//   const validateConnectedTools = async () => {
//     try {
//       const {
//         data: { user },
//       } = await supabase.auth.getUser();
//       if (!user) return false;

//       const { data } = await supabase
//         .from("api_keys")
//         .select("fireflies, openapi")
//         .eq("user_id", user.id)
//         .single();

//       if (!data || !data.fireflies) {
//         toast.error("Please connect Fireflies before continuing.");
//         return false;
//       }

//       return true;
//     } catch {
//       return false;
//     }
//   };

//   const handleBeforeNext = async (step: number) => {
//     if (currentStep === 1) {
//       if (!signupData.fullname || !signupData.email) {
//         setSignupError("These fields are required");
//         return false;
//       }

//       setSignupError(null);
//       setIsNextLoading(true);

//       await updateUserInSupabase(signupData.fullname, signupData.email);

//       localStorage.setItem("onboarding_signup", JSON.stringify(signupData));
//       setIsNextLoading(false);
//       return true;
//     }

//     if (currentStep === 2) {
//       setIsNextLoading(true);
//       const ok = await validateConnectedTools();
//       setIsNextLoading(false);
//       return ok;
//     }

//     if (currentStep === 3) {
//       const info = companyInfoRef.current?.getCompanyInfo();

//       if (!info?.companyName || !info?.companyEmail) {
//         setCompanyError("Company name and email are required");
//         return false;
//       }

//       setCompanyError(null);

//       setIsNextLoading(true);

//       localStorage.setItem(
//         "onboarding_company_info",
//         JSON.stringify({
//           companyName: info.companyName,
//           companyEmail: info.companyEmail,
//           website: info.website,
//         })
//       );

//       const ok = await sendWebsiteToWebhook(info.website, info.companyName);

//       setIsWebhookPending(true);
//       setIsNextLoading(false);

//       if (!ok) toast.error("Unable to start workflow.");

//       return ok ?? false;
//     }

//     return true;
//   };

//   useEffect(() => {
//     if (!isWebhookPending) return;

//     const poll = setInterval(() => {
//       const saved = localStorage.getItem("webhook_markdown");
//       if (saved) {
//         setHasWebhookData(true);
//         setIsWebhookPending(false);
//       }
//     }, 1500);

//     return () => clearInterval(poll);
//   }, [isWebhookPending]);

//   const handleStepChange = (step: number) => {
//     setCurrentStep(step);
//     localStorage.setItem("onboarding_current_step", String(step));
//   };

//   return (
//     <ClientOnly>
//       <div className="w-full flex justify-center">
//         <div className="w-full max-w-5xl px-4 py-6">
//           <Stepper
//             initialStep={currentStep}
//             onStepChange={handleStepChange}
//             beforeNext={handleBeforeNext}
//             onFinalStepCompleted={async () => {
//               await updateSalesProcess();
//               router.replace("/dashboard");
//             }}
//             nextLoading={isNextLoading || isSavingIntegration}
//             nextButtonDisabled={
//               isNextLoading ||
//               isSavingIntegration ||
//               (currentStep === 1 &&
//                 (!signupData.fullname || !signupData.email)) ||
//               (currentStep === 2 && !firefliesConnected) ||
//               (currentStep === 3 &&
//                 (!companyInfo.companyName || !companyInfo.companyEmail)) ||
//               (currentStep === 4 && isWebhookPending && !hasWebhookData)
//             }
//           >
//             <Step>
//               <div className="pb-10">
//                 <SignupForm
//                   fullname={signupData.fullname || storedAuth.name}
//                   email={signupData.email || storedAuth.email}
//                   onChange={(data) => {
//                     setSignupData(data);
//                     localStorage.setItem(
//                       "onboarding_signup",
//                       JSON.stringify(data)
//                     );
//                   }}
//                   error={signupError || undefined}
//                 />
//               </div>
//             </Step>

//             <Step>
//               <div className="pb-10">
//                 <ConnectTools
//                   onFirefliesStatusChange={setFirefliesConnected}
//                   onSavingChange={setIsSavingIntegration}
//                 />
//               </div>
//             </Step>

//             <Step>
//               <div className="pb-10">
//                 <CompanyInfoStep
//                   ref={companyInfoRef}
//                   initialCompanyName={companyInfo.companyName}
//                   initialWebsite={companyInfo.website}
//                   initialCompanyEmail={companyInfo.companyEmail}
//                   onChange={(data) => {
//                     setCompanyInfo(data);
//                     localStorage.setItem(
//                       "onboarding_company_info",
//                       JSON.stringify(data)
//                     );
//                   }}
//                 />
//                 {companyError && (
//                   <p className="text-sm text-red-500 mt-2" role="alert">
//                     {companyError}
//                   </p>
//                 )}
//               </div>
//             </Step>

//             <Step>
//               <div className="pb-10">
//                 {isWebhookPending && !hasWebhookData ? (
//                   <div className="w-full h-64 flex flex-col items-center gap-3 text-muted-foreground justify-center">
//                     <span className="loader" />
//                     <p className="text-sm">Waiting for workflow…</p>
//                   </div>
//                 ) : (
//                   <Tiptap />
//                 )}
//               </div>
//             </Step>

//             <Step>
//               <div className="pb-10">
//                 <ReviewBusinessProfile
//                   companyInfo={{
//                     name: jsonData.company_info?.company_name,
//                     website: jsonData.company_info?.website,
//                     value: jsonData.company_info?.value_proposition,
//                   }}
//                   products={jsonData.products_and_services || []}
//                   idealCustomer={{
//                     industry: jsonData.ideal_customer_profile?.industry,
//                     size: jsonData.ideal_customer_profile?.company_size,
//                     region: jsonData.ideal_customer_profile?.region,
//                     techStack: jsonData.ideal_customer_profile?.tech_stack,
//                     salesMotion: jsonData.ideal_customer_profile?.sales_motion,
//                   }}
//                   buyerPersonas={jsonData.buyer_personas || []}
//                   talkTracks={jsonData.talk_tracks || []}
//                   objections={jsonData.objection_handling || []}
//                 />
//               </div>
//             </Step>

//             <Step>
//               <div className="pb-10">
//                 <ConfigureSalesProcessStep onChange={setSalesProcess} />
//               </div>
//             </Step>
//           </Stepper>
//         </div>
//       </div>
//     </ClientOnly>
//   );
// }

// export default function OnboardingPage() {
//   return (
//     <div>
//       <Suspense fallback={<div>Loading onboarding...</div>}>
//         <div className="fixed z-10 top-8 left-0 right-0 flex justify-center">
//           <Navbar classname="relative" />
//         </div>

//         <div className="mt-40 min-h-screen flex flex-col bg-background overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/30">
//           <OnboardingSteps />
//         </div>
//       </Suspense>
//     </div>
//   );
// }
