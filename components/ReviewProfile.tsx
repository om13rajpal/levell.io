"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Button
} from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  IconSparkles,
  IconCheck,
  IconInfoCircle,
  IconUsers,
  IconBriefcase,
  IconBuildingStore,
  IconTarget,
  IconMessages,
  IconAlertCircle,
  IconPlus,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";

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
    talk_tracks: data?.talk_tracks || [],
    objection_handling: data?.objection_handling || [],
  };
}

/* ================================================================= */
/* MAIN COMPONENT */
/* ================================================================= */

export default function ReviewBusinessProfile() {
  const [profile, setProfile] = useState<ProfileJson>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [companyOpen, setCompanyOpen] = useState(false);
  const [icpOpen, setIcpOpen] = useState(false);
  const [productOpen, setProductOpen] = useState<{ open: boolean; index: number | null }>({
    open: false,
    index: null,
  });
  const [personaOpen, setPersonaOpen] = useState<{ open: boolean; index: number | null }>({
    open: false,
    index: null,
  });
  const [talkOpen, setTalkOpen] = useState<{ open: boolean; index: number | null }>({
    open: false,
    index: null,
  });
  const [objectionOpen, setObjectionOpen] = useState<{ open: boolean; index: number | null }>({
    open: false,
    index: null,
  });

  // Draft states
  const [companyDraft, setCompanyDraft] = useState<CompanyInfo>(EMPTY_PROFILE.company_info);
  const [icpDraft, setIcpDraft] = useState<IdealCustomerProfile>(EMPTY_PROFILE.ideal_customer_profile);
  const [productDraft, setProductDraft] = useState<ProductService>({ name: "", description: "" });
  const [personaDraft, setPersonaDraft] = useState<BuyerPersona>({
    name: "",
    goals: [],
    job_title: "",
    pain_points: [],
    responsibilities: [],
    decision_influence: "",
    information_sources: [],
  });
  const [talkDraft, setTalkDraft] = useState<string>("");
  const [objectionDraft, setObjectionDraft] = useState<ObjectionPair>({
    objection: "",
    response: "",
  });

  /* ---------------- LOAD FROM SUPABASE (PRIMARY) OR LOCALSTORAGE (FALLBACK) ---------------- */
  useEffect(() => {
    const loadData = async () => {
      try {
        // First try Supabase
        const result = await fetchWebhookData();

        if (result.success && result.data) {
          console.log("📦 Loaded profile from Supabase webhook_data:", result.data);
          const ensured = ensureProfile(result.data);
          setProfile(ensured);
          // Sync to localStorage for offline access
          localStorage.setItem(STORAGE_KEY, JSON.stringify(ensured));
          setLoading(false);
          return;
        }

        // Fallback to localStorage
        console.log("📦 Falling back to localStorage");
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          let parsed: any = stored;

          // Keep parsing while it's a string (handles multiple levels of stringification)
          let parseAttempts = 0;
          while (typeof parsed === "string" && parseAttempts < 5) {
            parsed = JSON.parse(parsed);
            parseAttempts++;
          }

          if (parsed && typeof parsed === "object") {
            const ensured = ensureProfile(parsed);
            setProfile(ensured);
          }
        }
      } catch (err) {
        console.error("Load error:", err);
        // Fallback to localStorage on error
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
              setProfile(ensured);
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

  /* ---------------- SAVE TO SUPABASE & LOCAL STORAGE ---------------- */
  const saveToSupabase = useCallback(async (updatedProfile: ProfileJson) => {
    setSaving(true);
    try {
      // Convert ProfileJson to WebhookDataPayload format
      const payload: WebhookDataPayload = {
        company_info: updatedProfile.company_info,
        products_and_services: updatedProfile.products_and_services,
        ideal_customer_profile: updatedProfile.ideal_customer_profile,
        buyer_personas: updatedProfile.buyer_personas,
        talk_tracks: updatedProfile.talk_tracks,
        objection_handling: updatedProfile.objection_handling,
      };

      const result = await updateWebhookData(payload);
      if (!result.success) {
        console.error("Failed to save to Supabase:", result.error);
        toast.error("Failed to save changes to server");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }, []);

  const updateProfile = useCallback((updater: (prev: ProfileJson) => ProfileJson) => {
    setProfile((prev) => {
      const updated = updater(prev);
      // Save to localStorage immediately
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      // Save to Supabase (debounced/async)
      saveToSupabase(updated);
      return updated;
    });
  }, [saveToSupabase]);

  /* ---------------- LOADING STATE ---------------- */
  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading business profile...</p>
        </div>
      </div>
    );
  }

  /* ================================================================= */
  /* UI LAYOUT (OPTION B — Soft Muted Sections) */
  /* ================================================================= */

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-12">

      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Profile Review</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review and refine your company profile to ensure AI-powered call analysis is accurate and personalized.
          </p>
        </div>
        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving...</span>
          </div>
        )}
      </div>

      {/* INFO */}
      <Alert className="bg-indigo-500/5 border border-indigo-200/40 dark:border-indigo-500/20 rounded-xl">
        <IconInfoCircle className="h-4 w-4 text-indigo-600" />
        <AlertDescription className="text-sm">
          Quickly verify your company details. All edits auto-save locally.
        </AlertDescription>
      </Alert>

      {/* ======================================================= */}
      {/* SECTION: Company Info */}
      {/* ======================================================= */}
      <SectionBlock
        title="Company Information"
        icon={<IconBuildingStore className="h-5 w-5 text-sky-500" />}
        colorScheme="blue"
        onEdit={() => {
          setCompanyDraft(profile.company_info);
          setCompanyOpen(true);
        }}
      >
        <Field label="Company Name" value={profile.company_info.company_name} />
        <Field label="Website" value={profile.company_info.website || "Not provided"} />
        <Field label="Value Proposition" value={profile.company_info.value_proposition} multiline />
      </SectionBlock>

      {/* ======================================================= */}
      {/* SECTION: Ideal Customer Profile */}
      {/* ======================================================= */}
      <SectionBlock
        title="Ideal Customer Profile"
        icon={<IconTarget className="h-5 w-5 text-violet-500" />}
        colorScheme="purple"
        onEdit={() => {
          setIcpDraft(profile.ideal_customer_profile);
          setIcpOpen(true);
        }}
      >
        <Field label="Industry" value={profile.ideal_customer_profile.industry} multiline />
        <Field label="Company Size" value={profile.ideal_customer_profile.company_size} />
        <Field label="Region" value={profile.ideal_customer_profile.region} multiline />
        <Field label="Tech Stack" value={profile.ideal_customer_profile.tech_stack} multiline />
        <Field label="Sales Motion" value={profile.ideal_customer_profile.sales_motion || "—"} />
      </SectionBlock>

      {/* ======================================================= */}
      {/* SECTION: Products & Services */}
      {/* ======================================================= */}
      <SectionBlock
        title="Products & Services"
        icon={<IconBriefcase className="h-5 w-5 text-emerald-500" />}
        colorScheme="emerald"
        actionLabel="Add Product"
        onAction={() => setProductOpen({ open: true, index: null })}
        showOuterBox={false}
      >
        {profile.products_and_services.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products added yet.</p>
        ) : (
          profile.products_and_services.map((p, i) => (
            <SubItem
              key={i}
              title={p.name}
              description={p.description}
              colorScheme="emerald"
              onEdit={() => {
                setProductDraft(p);
                setProductOpen({ open: true, index: i });
              }}
              onDelete={() =>
                updateProfile((prev) => ({
                  ...prev,
                  products_and_services: prev.products_and_services.filter((_, x) => x !== i),
                }))
              }
            />
          ))
        )}
      </SectionBlock>

      {/* ======================================================= */}
      {/* SECTION: Talk Tracks */}
      {/* ======================================================= */}
      <SectionBlock
        title="Talk Tracks"
        icon={<IconMessages className="h-5 w-5 text-amber-500" />}
        colorScheme="amber"
        actionLabel="Add Track"
        onAction={() => setTalkOpen({ open: true, index: null })}
        showOuterBox={false}
      >
        {profile.talk_tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No talk tracks yet.</p>
        ) : (
          profile.talk_tracks.map((t: any, i: number) => {
            const text = typeof t === "string" ? t : t.text || "";
            return (
              <SubItem
                key={i}
                title={`"${text}"`}
                colorScheme="amber"
                onEdit={() => {
                  setTalkDraft(text);
                  setTalkOpen({ open: true, index: i });
                }}
                onDelete={() =>
                  updateProfile((prev) => ({
                    ...prev,
                    talk_tracks: prev.talk_tracks.filter((_, x) => x !== i) as string[] | { text: string }[],
                  }))
                }
              />
            );
          })
        )}
      </SectionBlock>

      {/* ======================================================= */}
      {/* SECTION: Buyer Personas */}
      {/* ======================================================= */}
      <SectionBlock
        title="Buyer Personas"
        icon={<IconUsers className="h-5 w-5 text-rose-500" />}
        colorScheme="rose"
        actionLabel="Add Persona"
        onAction={() => setPersonaOpen({ open: true, index: null })}
        showOuterBox={false}
      >
        {profile.buyer_personas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No personas yet.</p>
        ) : (
          profile.buyer_personas.map((p, i) => (
            <SubItem
              key={i}
              title={p.name}
              description={`${p.job_title}`}
              colorScheme="rose"
              onEdit={() => {
                setPersonaDraft(p);
                setPersonaOpen({ open: true, index: i });
              }}
              onDelete={() =>
                updateProfile((prev) => ({
                  ...prev,
                  buyer_personas: prev.buyer_personas.filter((_, x) => x !== i),
                }))
              }
            />
          ))
        )}
      </SectionBlock>

      {/* ======================================================= */}
      {/* SECTION: Objection Handling */}
      {/* ======================================================= */}
      <SectionBlock
        title="Objection Handling"
        icon={<IconAlertCircle className="h-5 w-5 text-orange-500" />}
        colorScheme="orange"
        actionLabel="Add Objection"
        onAction={() => setObjectionOpen({ open: true, index: null })}
        showOuterBox={false}
      >
        {profile.objection_handling.length === 0 ? (
          <p className="text-sm text-muted-foreground">No objections yet.</p>
        ) : (
          profile.objection_handling.map((o, i) => (
            <SubItem
              key={i}
              title={o.objection}
              description={o.response}
              colorScheme="orange"
              onEdit={() => {
                setObjectionDraft(o);
                setObjectionOpen({ open: true, index: i });
              }}
              onDelete={() =>
                updateProfile((prev) => ({
                  ...prev,
                  objection_handling: prev.objection_handling.filter((_, x) => x !== i),
                }))
              }
            />
          ))
        )}
      </SectionBlock>

      {/* --------------------------- DIALOGS --------------------------- */}
      {/* Company Dialog */}
      <Dialog open={companyOpen} onOpenChange={setCompanyOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Company Info</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <InputField
              label="Company Name"
              value={companyDraft.company_name}
              onChange={(v) => setCompanyDraft((p) => ({ ...p, company_name: v }))}
            />
            <InputField
              label="Website"
              value={companyDraft.website}
              onChange={(v) => setCompanyDraft((p) => ({ ...p, website: v }))}
            />
            <TextareaField
              label="Value Proposition"
              value={companyDraft.value_proposition}
              onChange={(v) => setCompanyDraft((p) => ({ ...p, value_proposition: v }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              updateProfile((prev) => ({ ...prev, company_info: companyDraft }));
              setCompanyOpen(false);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ICP Dialog */}
      <Dialog open={icpOpen} onOpenChange={setIcpOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Ideal Customer Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <TextareaField label="Industry" value={icpDraft.industry} onChange={(v) => setIcpDraft((p) => ({ ...p, industry: v }))} />
            <InputField label="Company Size" value={icpDraft.company_size} onChange={(v) => setIcpDraft((p) => ({ ...p, company_size: v }))} />
            <TextareaField label="Region" value={icpDraft.region} onChange={(v) => setIcpDraft((p) => ({ ...p, region: v }))} />
            <TextareaField label="Tech Stack" value={icpDraft.tech_stack} onChange={(v) => setIcpDraft((p) => ({ ...p, tech_stack: v }))} />
            <InputField label="Sales Motion" value={icpDraft.sales_motion} onChange={(v) => setIcpDraft((p) => ({ ...p, sales_motion: v }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIcpOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                updateProfile((prev) => ({ ...prev, ideal_customer_profile: icpDraft }));
                setIcpOpen(false);
              }}
            >Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Dialog */}
      <Dialog open={productOpen.open} onOpenChange={(open) => setProductOpen({ open, index: productOpen.index })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{productOpen.index === null ? "Add Product" : "Edit Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <InputField label="Name" value={productDraft.name} onChange={(v) => setProductDraft((p) => ({ ...p, name: v }))} />
            <TextareaField label="Description" value={productDraft.description} onChange={(v) => setProductDraft((p) => ({ ...p, description: v }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductOpen({ open: false, index: null })}>Cancel</Button>
            <Button
              onClick={() => {
                updateProfile((prev) => {
                  const arr = [...prev.products_and_services];
                  if (productOpen.index === null) arr.push(productDraft);
                  else arr[productOpen.index] = productDraft;
                  return { ...prev, products_and_services: arr };
                });
                setProductOpen({ open: false, index: null });
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Persona Dialog */}
      <Dialog open={personaOpen.open} onOpenChange={(open) => setPersonaOpen({ open, index: personaOpen.index })}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{personaOpen.index === null ? "Add Buyer Persona" : "Edit Buyer Persona"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <InputField label="Name" value={personaDraft.name} onChange={(v) => setPersonaDraft((p) => ({ ...p, name: v }))} />
            <InputField label="Job Title" value={personaDraft.job_title} onChange={(v) => setPersonaDraft((p) => ({ ...p, job_title: v }))} />

            <TextareaField label="Goals (comma-separated)" 
              value={personaDraft.goals.join(", ")} 
              onChange={(v) => setPersonaDraft((p) => ({ ...p, goals: v.split(",").map((x) => x.trim()).filter(Boolean) }))} />

            <TextareaField label="Pain Points (comma-separated)" 
              value={personaDraft.pain_points.join(", ")} 
              onChange={(v) => setPersonaDraft((p) => ({ ...p, pain_points: v.split(",").map((x) => x.trim()).filter(Boolean) }))} />

            <TextareaField label="Responsibilities (comma-separated)" 
              value={personaDraft.responsibilities.join(", ")} 
              onChange={(v) => setPersonaDraft((p) => ({ ...p, responsibilities: v.split(",").map((x) => x.trim()).filter(Boolean) }))} />

            <TextareaField label="Decision Influence" value={personaDraft.decision_influence} onChange={(v) => setPersonaDraft((p) => ({ ...p, decision_influence: v }))} />

            <TextareaField label="Information Sources (comma-separated)"
              value={personaDraft.information_sources.join(", ")} 
              onChange={(v) => setPersonaDraft((p) => ({ ...p, information_sources: v.split(",").map((x) => x.trim()).filter(Boolean) }))} />

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPersonaOpen({ open: false, index: null })}>Cancel</Button>
            <Button
              onClick={() => {
                updateProfile((prev) => {
                  const arr = [...prev.buyer_personas];
                  if (personaOpen.index === null) arr.push(personaDraft);
                  else arr[personaOpen.index] = personaDraft;
                  return { ...prev, buyer_personas: arr };
                });
                setPersonaOpen({ open: false, index: null });
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Objection Dialog */}
      <Dialog open={objectionOpen.open} onOpenChange={(open) => setObjectionOpen({ open, index: objectionOpen.index })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{objectionOpen.index === null ? "Add Objection" : "Edit Objection"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <TextareaField label="Objection" value={objectionDraft.objection} onChange={(v) => setObjectionDraft((p) => ({ ...p, objection: v }))} />
            <TextareaField label="Response" value={objectionDraft.response} onChange={(v) => setObjectionDraft((p) => ({ ...p, response: v }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObjectionOpen({ open: false, index: null })}>Cancel</Button>
            <Button
              onClick={() => {
                updateProfile((prev) => {
                  const arr = [...prev.objection_handling];
                  if (objectionOpen.index === null) arr.push(objectionDraft);
                  else arr[objectionOpen.index] = objectionDraft;
                  return { ...prev, objection_handling: arr };
                });
                setObjectionOpen({ open: false, index: null });
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

/* ================================================================= */
/* PRESENTATION COMPONENTS */
/* ================================================================= */

function SectionBlock({
  title,
  icon,
  children,
  onEdit,
  onAction,
  actionLabel = "Add",
  colorScheme = "indigo",
  showOuterBox = true,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onEdit?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  colorScheme?: "blue" | "purple" | "emerald" | "amber" | "rose" | "orange" | "indigo";
  showOuterBox?: boolean;
}) {
  const colorMap = {
    blue: "bg-sky-500/5 border-sky-200/40 dark:border-sky-500/20",
    purple: "bg-violet-500/5 border-violet-200/40 dark:border-violet-500/20",
    emerald: "bg-emerald-500/5 border-emerald-200/40 dark:border-emerald-500/20",
    amber: "bg-amber-500/5 border-amber-200/40 dark:border-amber-500/20",
    rose: "bg-rose-500/5 border-rose-200/40 dark:border-rose-500/20",
    orange: "bg-orange-500/5 border-orange-200/40 dark:border-orange-500/20",
    indigo: "bg-indigo-500/5 border-indigo-200/40 dark:border-indigo-500/20",
  };

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          {icon}
          {title}
        </h2>

        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <IconPencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
        )}

        {onAction && (
          <Button variant="outline" size="sm" onClick={onAction} className="gap-1">
            <IconPlus className="h-4 w-4" /> {actionLabel}
          </Button>
        )}
      </div>

      {showOuterBox ? (
        <div className={`${colorMap[colorScheme]} border rounded-xl p-5 space-y-4`}>
          {children}
        </div>
      ) : (
        <div className="space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className={`text-sm ${multiline ? "leading-relaxed" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function SubItem({
  title,
  description,
  onEdit,
  onDelete,
  colorScheme = "indigo",
}: {
  title: string;
  description?: string;
  onEdit: () => void;
  onDelete: () => void;
  colorScheme?: "blue" | "purple" | "emerald" | "amber" | "rose" | "orange" | "indigo";
}) {
  const colorMap = {
    blue: {
      border: "border-sky-200/40 dark:border-sky-500/20",
      bg: "bg-sky-500/5",
      hover: "hover:bg-sky-500/10",
    },
    purple: {
      border: "border-violet-200/40 dark:border-violet-500/20",
      bg: "bg-violet-500/5",
      hover: "hover:bg-violet-500/10",
    },
    emerald: {
      border: "border-emerald-200/40 dark:border-emerald-500/20",
      bg: "bg-emerald-500/5",
      hover: "hover:bg-emerald-500/10",
    },
    amber: {
      border: "border-amber-200/40 dark:border-amber-500/20",
      bg: "bg-amber-500/5",
      hover: "hover:bg-amber-500/10",
    },
    rose: {
      border: "border-rose-200/40 dark:border-rose-500/20",
      bg: "bg-rose-500/5",
      hover: "hover:bg-rose-500/10",
    },
    orange: {
      border: "border-orange-200/40 dark:border-orange-500/20",
      bg: "bg-orange-500/5",
      hover: "hover:bg-orange-500/10",
    },
    indigo: {
      border: "border-indigo-200/40 dark:border-indigo-500/20",
      bg: "bg-indigo-500/5",
      hover: "hover:bg-indigo-500/10",
    },
  };

  const colors = colorMap[colorScheme];

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4 flex flex-col space-y-2 transition-all duration-200 ${colors.hover}`}>
      <div className="font-medium text-sm">{title}</div>
      {description && <div className="text-xs text-muted-foreground leading-relaxed">{description}</div>}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onEdit} className="h-8">
          <IconPencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10">
          <IconTrash className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

/* Input helpers */
function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea value={value} rows={4} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}