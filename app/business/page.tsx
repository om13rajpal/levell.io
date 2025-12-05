"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Plus, RefreshCw, Save, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

import { fetchWebhookData, updateWebhookData, WebhookDataPayload } from "@/services/onboarding";

/* ---------------- TYPES ---------------- */
type CompanyInfo = {
  website: string;
  company_name: string;
  value_proposition: string;
};

type BuyerPersona = {
  name: string;
  goals: string[];
  job_title: string;
  pain_points: string[];
  responsibilities: string[];
  decision_influence: string;
  information_sources: string[];
};

type ProductService = {
  name: string;
  description: string;
};

type IdealCustomerProfile = {
  region: string;
  industry: string;
  tech_stack: string;
  company_size: string;
  sales_motion: string;
};

type ObjectionPair = {
  objection: string;
  response: string;
};

type ProfileJson = {
  talk_tracks: string[] | { text: string }[];
  company_info: CompanyInfo;
  buyer_personas: BuyerPersona[];
  objection_handling: ObjectionPair[];
  products_and_services: ProductService[];
  ideal_customer_profile: IdealCustomerProfile;
};

/* ---------------- DEFAULT JSON ---------------- */
const EMPTY_PROFILE: ProfileJson = {
  talk_tracks: [],
  company_info: {
    website: "",
    company_name: "",
    value_proposition: "",
  },
  buyer_personas: [],
  objection_handling: [],
  products_and_services: [],
  ideal_customer_profile: {
    region: "",
    industry: "",
    tech_stack: "",
    company_size: "",
    sales_motion: "",
  },
};

/* ---------------- HELPERS ---------------- */
const STORAGE_KEY = "company_json_data";

function ensureProfile(data: any): ProfileJson {
  // Handle products_and_services - convert strings to objects if needed
  let products: ProductService[] = [];
  if (Array.isArray(data?.products_and_services)) {
    products = data.products_and_services.map((p: any) => {
      if (typeof p === "string") {
        return { name: p, description: "" };
      }
      return { name: p.name || "", description: p.description || "" };
    });
  }

  // Handle talk_tracks - convert objects to strings if needed
  let talkTracks: string[] = [];
  if (Array.isArray(data?.talk_tracks)) {
    talkTracks = data.talk_tracks.map((t: any) => {
      if (typeof t === "string") return t;
      return t.text || "";
    });
  }

  return {
    ...EMPTY_PROFILE,
    ...data,
    company_info: { ...EMPTY_PROFILE.company_info, ...data?.company_info },
    ideal_customer_profile: {
      ...EMPTY_PROFILE.ideal_customer_profile,
      ...data?.ideal_customer_profile,
    },
    products_and_services: products,
    buyer_personas: data?.buyer_personas || [],
    talk_tracks: talkTracks,
    objection_handling: data?.objection_handling || [],
  };
}

export default function EditBusinessProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileJson>(EMPTY_PROFILE);

  // === Form States (derived from profile) ===
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [salesMotion, setSalesMotion] = useState("");
  const [elevatorPitch, setElevatorPitch] = useState("");

  // === Products ===
  const [products, setProducts] = useState<{ name: string; description: string }[]>([]);

  // === ICP ===
  const [companySize, setCompanySize] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [techStack, setTechStack] = useState<string[]>([]);

  // === Personas ===
  type Persona = { role: string; notes?: string };
  const [personas, setPersonas] = useState<Persona[]>([]);

  // === Talk Tracks & Objections ===
  const [talkTracks, setTalkTracks] = useState<string[]>([]);
  type Objection = { title: string; rebuttal: string };
  const [objections, setObjections] = useState<Objection[]>([]);

  /* ---------------- HELPER: Populate form from profile ---------------- */
  const populateFormFromProfile = (ensured: ProfileJson) => {
    setProfile(ensured);

    // Populate form states
    setCompanyName(ensured.company_info.company_name || "");
    setWebsite(ensured.company_info.website || "");
    setElevatorPitch(ensured.company_info.value_proposition || "");

    // ICP
    const icp = ensured.ideal_customer_profile;
    setIndustry(icp.industry || "");
    setSalesMotion(icp.sales_motion || "");
    setCompanySize(icp.company_size ? [icp.company_size] : []);
    setRegions(icp.region ? icp.region.split(",").map((s) => s.trim()).filter(Boolean) : []);
    setIndustries(icp.industry ? icp.industry.split(",").map((s) => s.trim()).filter(Boolean) : []);
    setTechStack(icp.tech_stack ? icp.tech_stack.split(",").map((s) => s.trim()).filter(Boolean) : []);

    // Products
    setProducts(
      ensured.products_and_services.map((p) => ({
        name: p.name,
        description: p.description,
      }))
    );

    // Personas
    setPersonas(
      ensured.buyer_personas.map((p) => ({
        role: p.name || p.job_title,
        notes: p.job_title || p.decision_influence,
      }))
    );

    // Talk tracks
    const tracks = ensured.talk_tracks.map((t: any) =>
      typeof t === "string" ? t : t.text || ""
    );
    setTalkTracks(tracks);

    // Objections
    setObjections(
      ensured.objection_handling.map((o) => ({
        title: o.objection,
        rebuttal: o.response,
      }))
    );
  };

  /* ---------------- LOAD FROM WEBHOOK_DATA (PRIMARY) OR LOCALSTORAGE (FALLBACK) ---------------- */
  useEffect(() => {
    const loadData = async () => {
      try {
        // First, try to fetch from webhook_data table
        const result = await fetchWebhookData();

        if (result.success && result.data) {
          console.log("📦 Loaded business profile from webhook_data:", result.data);
          const ensured = ensureProfile(result.data);
          populateFormFromProfile(ensured);

          // Sync to localStorage for offline access
          localStorage.setItem(STORAGE_KEY, JSON.stringify(ensured));
          setLoading(false);
          return;
        }

        // If no webhook_data, try users table business_profile as fallback
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // Fetch business_profile from users table
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("business_profile")
            .eq("id", user.id)
            .single();

          if (!userError && userData?.business_profile) {
            console.log("📦 Loaded business profile from users table");
            const ensured = ensureProfile(userData.business_profile);
            populateFormFromProfile(ensured);

            // Sync to localStorage for offline access
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ensured));
            setLoading(false);
            return;
          }

          // If no business_profile in users table, try company table for basic info
          const { data: companyData, error: companyError } = await supabase
            .from("company")
            .select("company_name, company_url")
            .eq("user_id", user.id)
            .single();

          if (!companyError && companyData) {
            console.log("📦 Loaded company data from Supabase");
            // We have basic company info, check localStorage for rest
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
              let parsed: any = stored;
              let parseAttempts = 0;
              while (typeof parsed === "string" && parseAttempts < 5) {
                parsed = JSON.parse(parsed);
                parseAttempts++;
              }

              if (parsed && typeof parsed === "object") {
                // Merge Supabase company data with localStorage profile
                parsed.company_info = {
                  ...parsed.company_info,
                  company_name: companyData.company_name || parsed.company_info?.company_name || "",
                  website: companyData.company_url || parsed.company_info?.website || "",
                };
                const ensured = ensureProfile(parsed);
                populateFormFromProfile(ensured);
                setLoading(false);
                return;
              }
            }

            // Only company data available, create minimal profile
            const minimalProfile = ensureProfile({
              company_info: {
                company_name: companyData.company_name || "",
                website: companyData.company_url || "",
                value_proposition: "",
              },
            });
            populateFormFromProfile(minimalProfile);
            setLoading(false);
            return;
          }
        }

        // Fallback: Load from localStorage if Supabase data not available
        console.log("📦 Falling back to localStorage");
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          let parsed: any = stored;
          let parseAttempts = 0;
          while (typeof parsed === "string" && parseAttempts < 5) {
            parsed = JSON.parse(parsed);
            parseAttempts++;
          }

          if (parsed && typeof parsed === "object") {
            const ensured = ensureProfile(parsed);
            populateFormFromProfile(ensured);
          }
        }
      } catch (err) {
        console.error("Load error:", err);

        // On error, try localStorage as final fallback
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            let parsed: any = stored;
            let parseAttempts = 0;
            while (typeof parsed === "string" && parseAttempts < 5) {
              parsed = JSON.parse(parsed);
              parseAttempts++;
            }
            if (parsed && typeof parsed === "object") {
              const ensured = ensureProfile(parsed);
              populateFormFromProfile(ensured);
            }
          }
        } catch (localErr) {
          console.error("localStorage fallback error:", localErr);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  /* ---------------- SAVE TO WEBHOOK_DATA, SUPABASE & LOCAL STORAGE ---------------- */
  const onSave = async () => {
    setSaving(true);

    try {
      // Build the profile JSON
      const updatedProfile: ProfileJson = {
        company_info: {
          company_name: companyName,
          website: website,
          value_proposition: elevatorPitch,
        },
        ideal_customer_profile: {
          industry: industries.join(", "),
          company_size: companySize.join(", "),
          region: regions.join(", "),
          tech_stack: techStack.join(", "),
          sales_motion: salesMotion,
        },
        products_and_services: products,
        buyer_personas: personas.map((p) => ({
          name: p.role,
          job_title: p.notes || "",
          goals: [],
          pain_points: [],
          responsibilities: [],
          decision_influence: "",
          information_sources: [],
        })),
        talk_tracks: talkTracks,
        objection_handling: objections.map((o) => ({
          objection: o.title,
          response: o.rebuttal,
        })),
      };

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfile));

      // Save to webhook_data table (primary)
      const webhookPayload: WebhookDataPayload = {
        company_info: updatedProfile.company_info,
        products_and_services: updatedProfile.products_and_services,
        ideal_customer_profile: updatedProfile.ideal_customer_profile,
        buyer_personas: updatedProfile.buyer_personas,
        talk_tracks: updatedProfile.talk_tracks,
        objection_handling: updatedProfile.objection_handling,
      };

      const webhookResult = await updateWebhookData(webhookPayload);
      if (!webhookResult.success) {
        console.error("webhook_data save error:", webhookResult.error);
      }

      // Save to Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Update company table
        const { error: companyError } = await supabase
          .from("company")
          .upsert(
            {
              user_id: user.id,
              company_name: companyName,
              company_url: website,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

        if (companyError) {
          console.error("Company save error:", companyError);
        }

        // Update users table with business profile JSON
        const { error: userError } = await supabase
          .from("users")
          .update({
            business_profile: updatedProfile,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (userError) {
          console.error("User save error:", userError);
        }
      }

      toast.success("Business profile saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save business profile.");
    } finally {
      setSaving(false);
    }
  };

  const addPersona = () => setPersonas((p) => [...p, { role: "", notes: "" }]);
  const addObjection = () =>
    setObjections((o) => [...o, { title: "", rebuttal: "" }]);
  const addProduct = () => {
    if (products.length >= 10) return;
    setProducts((arr) => [...arr, { name: "", description: "" }]);
  };
  const addTalkTrack = () => setTalkTracks((t) => [...t, ""]);

  if (loading) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader heading="Business Profile" />
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader heading="Business Profile" />

        <div className="mx-auto w-full max-w-6xl p-6 sm:p-8 space-y-8">
          {/* Header */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Edit Business Profile
              </h1>
              <p className="text-sm text-muted-foreground">
                Update your company information, ICP, and key sales details.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </header>

          {/* PROFILE OVERVIEW */}
          <SectionCard
            title="Profile Overview"
            desc="Updates affect new calls only. You can re-analyze past calls after saving."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Company Name">
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </Field>
              <Field label="Website">
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </Field>
              <Field label="Industry">
                <Input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </Field>
              <Field label="Sales Motion">
                <Input
                  value={salesMotion}
                  onChange={(e) => setSalesMotion(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Elevator Pitch / Value Proposition">
              <Textarea
                rows={3}
                value={elevatorPitch}
                onChange={(e) => setElevatorPitch(e.target.value)}
              />
            </Field>
          </SectionCard>

          {/* PRODUCTS */}
          <SectionCard title="Products & Services" desc="Add up to 10 key offerings.">
            {products.map((prod, i) => (
              <div
                key={i}
                className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1.5fr_1fr_auto]"
              >
                <Field label="Name">
                  <Input
                    value={prod.name}
                    onChange={(e) =>
                      setProducts((arr) =>
                        arr.map((v, idx) =>
                          idx === i ? { ...v, name: e.target.value } : v
                        )
                      )
                    }
                  />
                </Field>
                <Field label="Description">
                  <Input
                    placeholder="Brief description"
                    value={prod.description}
                    onChange={(e) =>
                      setProducts((arr) =>
                        arr.map((v, idx) =>
                          idx === i ? { ...v, description: e.target.value } : v
                        )
                      )
                    }
                  />
                </Field>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setProducts((arr) => arr.filter((_, idx) => idx !== i));
                  }}
                  aria-label="Remove product"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="gap-2"
              onClick={addProduct}
            >
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </SectionCard>

          {/* ICP */}
          <SectionCard
            title="Ideal Customer Profile (ICP)"
            desc="Define who you sell to and key traits."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Company Size">
                <ChipInput
                  values={companySize}
                  setValues={setCompanySize}
                  placeholder="e.g., 11–50"
                />
              </Field>
              <Field label="Regions">
                <ChipInput
                  values={regions}
                  setValues={setRegions}
                  placeholder="e.g., NA"
                />
              </Field>
              <Field label="Industries">
                <ChipInput
                  values={industries}
                  setValues={setIndustries}
                  placeholder="e.g., SaaS"
                />
              </Field>
              <Field label="Tech Stack">
                <ChipInput
                  values={techStack}
                  setValues={setTechStack}
                  placeholder="e.g., Salesforce"
                />
              </Field>
            </div>
          </SectionCard>

          {/* PERSONAS */}
          <SectionCard title="Buyer Personas" desc="Stakeholders you sell to.">
            {personas.map((p, i) => (
              <div
                key={i}
                className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_2fr_auto]"
              >
                <Field label="Role / Name">
                  <Input
                    value={p.role}
                    onChange={(e) =>
                      setPersonas((arr) =>
                        arr.map((it, idx) =>
                          idx === i ? { ...it, role: e.target.value } : it
                        )
                      )
                    }
                  />
                </Field>
                <Field label="Notes">
                  <Input
                    placeholder="Economic buyer, Champion, KPIs…"
                    value={p.notes || ""}
                    onChange={(e) =>
                      setPersonas((arr) =>
                        arr.map((it, idx) =>
                          idx === i ? { ...it, notes: e.target.value } : it
                        )
                      )
                    }
                  />
                </Field>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setPersonas((arr) => arr.filter((_, idx) => idx !== i))
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" className="gap-2" onClick={addPersona}>
              <Plus className="h-4 w-4" /> Add Persona
            </Button>
          </SectionCard>

          {/* TALK TRACKS */}
          <SectionCard
            title="Talk Tracks"
            desc="Key talking points for your sales conversations."
          >
            {talkTracks.map((track, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-1">
                  <Field label={`Track ${i + 1}`}>
                    <Textarea
                      rows={2}
                      value={track}
                      onChange={(e) =>
                        setTalkTracks((arr) =>
                          arr.map((t, idx) => (idx === i ? e.target.value : t))
                        )
                      }
                    />
                  </Field>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="mt-6"
                  onClick={() =>
                    setTalkTracks((arr) => arr.filter((_, idx) => idx !== i))
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" className="gap-2" onClick={addTalkTrack}>
              <Plus className="h-4 w-4" /> Add Talk Track
            </Button>
          </SectionCard>

          {/* OBJECTIONS */}
          <SectionCard
            title="Objection Handling"
            desc="Common concerns and your rebuttals."
          >
            {objections.map((o, i) => (
              <div
                key={i}
                className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_2fr_auto]"
              >
                <Field label="Objection">
                  <Input
                    value={o.title}
                    onChange={(e) =>
                      setObjections((arr) =>
                        arr.map((it, idx) =>
                          idx === i ? { ...it, title: e.target.value } : it
                        )
                      )
                    }
                  />
                </Field>
                <Field label="Rebuttal">
                  <Input
                    value={o.rebuttal}
                    onChange={(e) =>
                      setObjections((arr) =>
                        arr.map((it, idx) =>
                          idx === i ? { ...it, rebuttal: e.target.value } : it
                        )
                      )
                    }
                  />
                </Field>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setObjections((arr) => arr.filter((_, idx) => idx !== i))
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" className="gap-2" onClick={addObjection}>
              <Plus className="h-4 w-4" /> Add Objection
            </Button>
          </SectionCard>

          {/* Footer */}
          <footer className="sticky bottom-0 mt-8 flex items-center justify-between gap-3 border-t border-border/60 bg-background/95 p-3 backdrop-blur-sm rounded-t-lg">
            <p className="text-xs text-muted-foreground">
              Changes are saved to your account and used for AI-powered call analysis.
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={onSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/* === Helper Components === */

function SectionCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-card/60 border-border/60 shadow-sm backdrop-blur-sm space-y-4">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ChipInput({
  values,
  setValues,
  placeholder,
}: {
  values: string[];
  setValues: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    setValues([...values, v]);
    setDraft("");
  };
  const remove = (idx: number) => setValues(values.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-card/50 p-2">
      {values.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-1 text-xs text-foreground/90"
        >
          {v}
          <button
            type="button"
            className="rounded p-0.5 hover:bg-foreground/10"
            onClick={() => remove(i)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        placeholder={placeholder}
        className="h-7 w-40 border-none p-0 text-xs shadow-none focus-visible:ring-0 bg-transparent"
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 gap-1 px-2"
        onClick={add}
      >
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </div>
  );
}
