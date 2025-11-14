"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Info, Plus, Pencil, Trash2 } from "lucide-react";

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
  talk_tracks: string[] | { text: string }[]; // support both
  company_info: CompanyInfo;
  buyer_personas: BuyerPersona[];
  objection_handling: ObjectionPair[];
  products_and_services: ProductService[];
  ideal_customer_profile: IdealCustomerProfile;
};

/* ---------------- DEFAULT JSON (your NOT@MRP data) ---------------- */
const DEFAULT_PROFILE: ProfileJson = {
  talk_tracks: [],
  company_info: {
    website: "",
    company_name: "NOT@MRP",
    value_proposition:
      'NOT@MRP aims to empower small businesses and simplify shopping for users by creating a seamless platform for local commerce. Key benefits emphasized include: Connecting local stores and services directly with customers. Empowering small businesses and strengthening local economies. Making local shopping rewarding for customers with exclusive deals, cashback, and value. Simplifying services for users (e.g., "hassle-free laundry pickup and delivery," "everything your city offers into one seamless platform"). Building real connections between customers and merchants. Keeping spending within the local community to create jobs and support families. Providing tools for small merchants to compete in the digital world.',
  },
  buyer_personas: [
    {
      name: "The Small Business Owner / Proprietor",
      goals: [
        "Increase sales revenue and business profitability",
        "Secure a sustainable future for the business",
        "Maintain and grow their loyal customer base",
        "Stay competitive in the local market, especially against larger online players",
        "Simplify operations and manage time effectively",
        "Gain wider visibility for their products",
      ],
      job_title:
        "Owner, Proprietor, or Family Head of the local business (e.g., Kirana Store Owner, Bakery Owner)",
      pain_points: [
        "Limited Customer Reach",
        "Difficulty Competing Digitally",
        "Lack of Technical Expertise/Resources",
        "Maintaining Customer Loyalty",
        "Operational Inefficiencies",
        "Low visibility",
      ],
      responsibilities: [
        "Overall business strategy",
        "Daily operations management",
        "Financial oversight",
        "Customer relations",
        "Staff management (if any)",
        "Inventory management",
        "Survival/growth of the business",
        "Increasing sales and profitability",
        "Adopting new methods to stay competitive",
      ],
      decision_influence:
        "The ultimate decision-maker. Their personal conviction about the benefit and ease of use is paramount.",
      information_sources: [
        "Word of mouth from other local business owners",
        "Local business associations",
        "Direct outreach from sales representatives",
        "Local community events/workshops",
        "Easily digestible online resources (WhatsApp groups, local business forums)",
      ],
    },
    {
      name: "The Store Manager / Key Employee",
      goals: [
        "Achieve daily/weekly sales targets",
        "Ensure efficient store operations and inventory management",
        "Provide excellent customer service and build positive customer relationships",
        "Learn and implement new tools that simplify their work and improve efficiency",
        "Contribute to the business's overall growth and success",
      ],
      job_title:
        "Store Manager, Senior Salesperson, or key individual responsible for daily operations or specific functions within a small retail business",
      pain_points: [
        "Manual Order Management",
        "Customer Inquiries",
        "Inventory Discrepancies",
        "Operational Bottlenecks",
        "Lack of Digital Tools",
      ],
      responsibilities: [
        "Ensuring smooth daily operations",
        "Managing stock levels",
        "Directly interacting with customers",
        "Processing sales",
        "Potentially managing other employees",
        "Implementing on-ground strategies set by the owner",
        "Executing daily tasks efficiently",
      ],
      decision_influence:
        "Influencer. They will test and use the system daily and can provide critical feedback to the owner. Their buy-in is essential for successful adoption and operational success.",
      information_sources: [
        "Direct communication with sales representatives",
        "Training provided by NOT@MRP",
        "Observation of how the system impacts their daily tasks",
        "Discussions with the owner",
        "Informal insights from other similar roles",
      ],
    },
  ],
  objection_handling: [],
  products_and_services: [
    {
      name: "LocalMart",
      description:
        "A marketplace for daily needs, connecting users with local stores for groceries, fresh produce, food, bakery items, daily essentials, and dining options.",
    },
    {
      name: "Events",
      description:
        "A platform for discovering and booking tickets for local events such as concerts, parties, college fests, and community gatherings.",
    },
    {
      name: "Laundry",
      description:
        "A service facilitating hassle-free laundry pickup and delivery from local laundromats.",
    },
  ],
  ideal_customer_profile: {
    region:
      "Primarily urban and semi-urban areas within India, potentially growing into Tier 2/3 cities.",
    industry:
      "Local small businesses and service providers: Retail businesses (Grocery stores, Kirana stores, bakeries, daily essentials shops), Food and dining establishments (Cafés, restaurants), Event organizers, Service providers (Laundromats).",
    tech_stack:
      "Generally possess lower technological maturity. May use basic POS systems or manual record-keeping. Limited adoption of e-commerce platforms or advanced digital marketing tools. Preference for easy-to-adopt, standalone solutions.",
    company_size:
      "Micro, small, or medium-sized businesses, typically owner-operated or with a small team (1-15 employees).",
    sales_motion: "",
  },
};

/* ---------------- HELPERS ---------------- */
const STORAGE_KEY = "company_json_data";

function truncate(text: string | undefined, max = 90) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function ensureProfile(data: any): ProfileJson {
  // very light safety cast
  return {
    ...DEFAULT_PROFILE,
    ...data,
    company_info: { ...DEFAULT_PROFILE.company_info, ...data?.company_info },
    ideal_customer_profile: {
      ...DEFAULT_PROFILE.ideal_customer_profile,
      ...data?.ideal_customer_profile,
    },
    products_and_services: data?.products_and_services || DEFAULT_PROFILE.products_and_services,
    buyer_personas: data?.buyer_personas || DEFAULT_PROFILE.buyer_personas,
    talk_tracks: data?.talk_tracks || DEFAULT_PROFILE.talk_tracks,
    objection_handling: data?.objection_handling || DEFAULT_PROFILE.objection_handling,
  };
}

/* ============================ MAIN COMPONENT ============================ */

export default function ReviewBusinessProfile() {
  const [profile, setProfile] = useState<ProfileJson>(DEFAULT_PROFILE);

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

  // Local form state for dialogs
  const [companyDraft, setCompanyDraft] = useState<CompanyInfo>(DEFAULT_PROFILE.company_info);
  const [icpDraft, setIcpDraft] = useState<IdealCustomerProfile>(
    DEFAULT_PROFILE.ideal_customer_profile,
  );
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

  // Load from localStorage once
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const ensured = ensureProfile(parsed);
        setProfile(ensured);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROFILE));
      }
    } catch (err) {
      console.error("Failed to load profile from localStorage:", err);
    }
  }, []);

  // Helper to update and persist
  const updateProfile = (updater: (prev: ProfileJson) => ProfileJson) => {
    setProfile((prev) => {
      const next = updater(prev);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  /* ---------------- COMPANY INFO HANDLERS ---------------- */
  const openCompanyDialog = () => {
    setCompanyDraft(profile.company_info);
    setCompanyOpen(true);
  };

  const saveCompany = () => {
    updateProfile((prev) => ({
      ...prev,
      company_info: { ...companyDraft },
    }));
    setCompanyOpen(false);
  };

  /* ---------------- ICP HANDLERS ---------------- */
  const openIcpDialog = () => {
    setIcpDraft(profile.ideal_customer_profile);
    setIcpOpen(true);
  };

  const saveIcp = () => {
    updateProfile((prev) => ({
      ...prev,
      ideal_customer_profile: { ...icpDraft },
    }));
    setIcpOpen(false);
  };

  /* ---------------- PRODUCT HANDLERS ---------------- */
  const openProductDialog = (index: number | null) => {
    if (index === null) {
      setProductDraft({ name: "", description: "" });
    } else {
      setProductDraft(profile.products_and_services[index]);
    }
    setProductOpen({ open: true, index });
  };

  const saveProduct = () => {
    updateProfile((prev) => {
      const arr = [...prev.products_and_services];
      if (productOpen.index === null) {
        arr.push({ ...productDraft });
      } else {
        arr[productOpen.index] = { ...productDraft };
      }
      return { ...prev, products_and_services: arr };
    });
    setProductOpen({ open: false, index: null });
  };

  const removeProduct = (index: number) => {
    updateProfile((prev) => ({
      ...prev,
      products_and_services: prev.products_and_services.filter((_, i) => i !== index),
    }));
  };

  /* ---------------- PERSONA HANDLERS ---------------- */
  const openPersonaDialog = (index: number | null) => {
    if (index === null) {
      setPersonaDraft({
        name: "",
        goals: [],
        job_title: "",
        pain_points: [],
        responsibilities: [],
        decision_influence: "",
        information_sources: [],
      });
    } else {
      setPersonaDraft(profile.buyer_personas[index]);
    }
    setPersonaOpen({ open: true, index });
  };

  const savePersona = () => {
    updateProfile((prev) => {
      const arr = [...prev.buyer_personas];
      if (personaOpen.index === null) {
        arr.push({ ...personaDraft });
      } else {
        arr[personaOpen.index] = { ...personaDraft };
      }
      return { ...prev, buyer_personas: arr };
    });
    setPersonaOpen({ open: false, index: null });
  };

  const removePersona = (index: number) => {
    updateProfile((prev) => ({
      ...prev,
      buyer_personas: prev.buyer_personas.filter((_, i) => i !== index),
    }));
  };

  /* ---------------- TALK TRACK HANDLERS ---------------- */
  const openTalkDialog = (index: number | null) => {
    if (index === null) {
      setTalkDraft("");
    } else {
      const item = profile.talk_tracks[index];
      setTalkDraft(typeof item === "string" ? item : item.text || "");
    }
    setTalkOpen({ open: true, index });
  };

  const saveTalk = () => {
    updateProfile((prev) => {
      const arr = [...prev.talk_tracks];
      if (talkOpen.index === null) {
        arr.push(talkDraft);
      } else {
        arr[talkOpen.index] = talkDraft;
      }
      return { ...prev, talk_tracks: arr };
    });
    setTalkOpen({ open: false, index: null });
  };

  const removeTalk = (index: number) => {
    updateProfile((prev) => ({
      ...prev,
      talk_tracks: prev.talk_tracks.filter((_, i) => i !== index),
    }));
  };

  /* ---------------- OBJECTION HANDLERS ---------------- */
  const openObjectionDialog = (index: number | null) => {
    if (index === null) {
      setObjectionDraft({ objection: "", response: "" });
    } else {
      setObjectionDraft(profile.objection_handling[index]);
    }
    setObjectionOpen({ open: true, index });
  };

  const saveObjection = () => {
    updateProfile((prev) => {
      const arr = [...prev.objection_handling];
      if (objectionOpen.index === null) {
        arr.push({ ...objectionDraft });
      } else {
        arr[objectionOpen.index] = { ...objectionDraft };
      }
      return { ...prev, objection_handling: arr };
    });
    setObjectionOpen({ open: false, index: null });
  };

  const removeObjection = (index: number) => {
    updateProfile((prev) => ({
      ...prev,
      objection_handling: prev.objection_handling.filter((_, i) => i !== index),
    }));
  };

  /* ============================ RENDER ============================ */

  const { company_info, ideal_customer_profile, products_and_services, buyer_personas, talk_tracks, objection_handling } =
    profile;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* HEADER */}
      <div>
        <h2 className="text-xl font-semibold">Review Your Business Profile</h2>
        <p className="text-sm text-muted-foreground">
          Make quick edits before finalizing. We keep things minimal but editable.
        </p>
      </div>

      {/* INFO ALERT */}
      <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-300/60 dark:border-blue-900/60">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-300" />
        <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
          Confirm your company, ICP, and personas. Edits are saved locally and used to improve AI
          recommendations.
        </AlertDescription>
      </Alert>

      {/* GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMN 1 */}
        <div className="space-y-6">
          {/* Company Info */}
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium">Company Info</CardTitle>
              <Button variant="outline" size="sm" onClick={openCompanyDialog}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Company Name
                </div>
                <div>{company_info.company_name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Website
                </div>
                <a
                  href={company_info.website || "#"}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {company_info.website || "Not provided"}
                </a>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Value Proposition
                </div>
                <p className="text-sm text-muted-foreground">
                  {truncate(company_info.value_proposition, 140)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ICP */}
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium">Ideal Customer Profile</CardTitle>
              <Button variant="outline" size="sm" onClick={openIcpDialog}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <IcpField label="Industry" value={truncate(ideal_customer_profile.industry)} />
              <IcpField label="Company Size" value={ideal_customer_profile.company_size} />
              <IcpField label="Region" value={truncate(ideal_customer_profile.region)} />
              <IcpField label="Tech Stack" value={truncate(ideal_customer_profile.tech_stack)} />
              <IcpField label="Sales Motion" value={ideal_customer_profile.sales_motion || "—"} />
            </CardContent>
          </Card>
        </div>

        {/* COLUMN 2 */}
        <div className="space-y-6">
          {/* Products */}
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium">Products & Services</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => openProductDialog(null)}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {products_and_services.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border border-border rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {truncate(p.description, 80)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openProductDialog(i)}
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => removeProduct(i)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
              {products_and_services.length === 0 && (
                <p className="text-xs text-muted-foreground">No products added yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Buyer Personas */}
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium">Buyer Personas</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => openPersonaDialog(null)}
              >
                <Plus className="h-4 w-4" /> Add Persona
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              {buyer_personas.map((p, i) => (
                <div key={i} className="border border-border rounded-lg p-3 space-y-1 text-sm">
                  <div className="font-medium">{p.name}</div>
                  <PersonaLine label="Job Title" value={truncate(p.job_title, 80)} />
                  <PersonaLine label="Goals" value={truncate(p.goals.join(" · "), 100)} />
                  <PersonaLine
                    label="Pain Points"
                    value={truncate(p.pain_points.join(" · "), 100)}
                  />
                  <PersonaLine
                    label="Responsibilities"
                    value={truncate(p.responsibilities.join(" · "), 100)}
                  />
                  <PersonaLine
                    label="Decision Influence"
                    value={truncate(p.decision_influence, 100)}
                  />
                  <PersonaLine
                    label="Info Sources"
                    value={truncate(p.information_sources.join(" · "), 100)}
                  />
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPersonaDialog(i)}
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => removePersona(i)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
              {buyer_personas.length === 0 && (
                <p className="text-xs text-muted-foreground">No personas yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMN 3 */}
        <div className="space-y-6">
          {/* Talk Tracks */}
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium">Talk Tracks</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => openTalkDialog(null)}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {talk_tracks.map((t, i) => {
                const text = typeof t === "string" ? t : t.text || "";
                return (
                  <div
                    key={i}
                    className="flex justify-between items-center border border-border rounded-lg px-3 py-2"
                  >
                    <p className="text-sm italic">“{truncate(text, 120)}”</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTalkDialog(i)}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => removeTalk(i)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
              {talk_tracks.length === 0 && (
                <p className="text-xs text-muted-foreground">No talk tracks yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Objection Handling */}
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium">Objection Handling</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => openObjectionDialog(null)}
              >
                <Plus className="h-4 w-4" /> Add Pair
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {objection_handling.map((o, i) => (
                <div key={i} className="border border-border rounded-lg p-3 space-y-2 text-sm">
                  <PersonaLine label="Objection" value={truncate(o.objection, 120)} />
                  <PersonaLine label="Response" value={truncate(o.response, 120)} />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openObjectionDialog(i)}
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => removeObjection(i)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
              {objection_handling.length === 0 && (
                <p className="text-xs text-muted-foreground">No objections yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---------------- DIALOGS ---------------- */}

      {/* Company Info Dialog */}
      <Dialog open={companyOpen} onOpenChange={setCompanyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Company Info</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Company Name</Label>
              <Input
                value={companyDraft.company_name}
                onChange={(e) =>
                  setCompanyDraft((p) => ({ ...p, company_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Website</Label>
              <Input
                value={companyDraft.website}
                onChange={(e) =>
                  setCompanyDraft((p) => ({ ...p, website: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Value Proposition</Label>
              <Textarea
                rows={4}
                value={companyDraft.value_proposition}
                onChange={(e) =>
                  setCompanyDraft((p) => ({
                    ...p,
                    value_proposition: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCompany}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ICP Dialog */}
      <Dialog open={icpOpen} onOpenChange={setIcpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Ideal Customer Profile</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <Label>Industry</Label>
              <Textarea
                rows={2}
                value={icpDraft.industry}
                onChange={(e) =>
                  setIcpDraft((p) => ({ ...p, industry: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Company Size</Label>
              <Input
                value={icpDraft.company_size}
                onChange={(e) =>
                  setIcpDraft((p) => ({ ...p, company_size: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Region</Label>
              <Textarea
                rows={2}
                value={icpDraft.region}
                onChange={(e) =>
                  setIcpDraft((p) => ({ ...p, region: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Tech Stack</Label>
              <Textarea
                rows={2}
                value={icpDraft.tech_stack}
                onChange={(e) =>
                  setIcpDraft((p) => ({ ...p, tech_stack: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Sales Motion</Label>
              <Input
                value={icpDraft.sales_motion}
                onChange={(e) =>
                  setIcpDraft((p) => ({ ...p, sales_motion: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIcpOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveIcp}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Dialog */}
      <Dialog open={productOpen.open} onOpenChange={(open) => setProductOpen({ open, index: productOpen.index })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {productOpen.index === null ? "Add Product / Service" : "Edit Product / Service"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={productDraft.name}
                onChange={(e) =>
                  setProductDraft((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={productDraft.description}
                onChange={(e) =>
                  setProductDraft((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProductOpen({ open: false, index: null })}
            >
              Cancel
            </Button>
            <Button onClick={saveProduct}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Persona Dialog */}
      <Dialog open={personaOpen.open} onOpenChange={(open) => setPersonaOpen({ open, index: personaOpen.index })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {personaOpen.index === null ? "Add Buyer Persona" : "Edit Buyer Persona"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={personaDraft.name}
                onChange={(e) =>
                  setPersonaDraft((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Job Title</Label>
              <Input
                value={personaDraft.job_title}
                onChange={(e) =>
                  setPersonaDraft((p) => ({ ...p, job_title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Goals (comma-separated)</Label>
              <Textarea
                rows={2}
                value={personaDraft.goals.join(", ")}
                onChange={(e) =>
                  setPersonaDraft((p) => ({
                    ...p,
                    goals: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Pain Points (comma-separated)</Label>
              <Textarea
                rows={2}
                value={personaDraft.pain_points.join(", ")}
                onChange={(e) =>
                  setPersonaDraft((p) => ({
                    ...p,
                    pain_points: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Responsibilities (comma-separated)</Label>
              <Textarea
                rows={2}
                value={personaDraft.responsibilities.join(", ")}
                onChange={(e) =>
                  setPersonaDraft((p) => ({
                    ...p,
                    responsibilities: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Decision Influence</Label>
              <Textarea
                rows={2}
                value={personaDraft.decision_influence}
                onChange={(e) =>
                  setPersonaDraft((p) => ({
                    ...p,
                    decision_influence: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Information Sources (comma-separated)</Label>
              <Textarea
                rows={2}
                value={personaDraft.information_sources.join(", ")}
                onChange={(e) =>
                  setPersonaDraft((p) => ({
                    ...p,
                    information_sources: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPersonaOpen({ open: false, index: null })}
            >
              Cancel
            </Button>
            <Button onClick={savePersona}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Talk Track Dialog */}
      <Dialog open={talkOpen.open} onOpenChange={(open) => setTalkOpen({ open, index: talkOpen.index })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {talkOpen.index === null ? "Add Talk Track" : "Edit Talk Track"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Talk Track</Label>
            <Textarea
              rows={3}
              value={talkDraft}
              onChange={(e) => setTalkDraft(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTalkOpen({ open: false, index: null })}
            >
              Cancel
            </Button>
            <Button onClick={saveTalk}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Objection Dialog */}
      <Dialog open={objectionOpen.open} onOpenChange={(open) => setObjectionOpen({ open, index: objectionOpen.index })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {objectionOpen.index === null ? "Add Objection Pair" : "Edit Objection Pair"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Objection</Label>
              <Textarea
                rows={2}
                value={objectionDraft.objection}
                onChange={(e) =>
                  setObjectionDraft((p) => ({ ...p, objection: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Response</Label>
              <Textarea
                rows={3}
                value={objectionDraft.response}
                onChange={(e) =>
                  setObjectionDraft((p) => ({ ...p, response: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setObjectionOpen({ open: false, index: null })}
            >
              Cancel
            </Button>
            <Button onClick={saveObjection}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- SMALL PRESENTATION HELPERS ---------------- */

function IcpField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

function PersonaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-xs">{value || "—"}</div>
    </div>
  );
}