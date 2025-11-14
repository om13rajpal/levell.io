"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, Plus, ChevronRight, RefreshCw } from "lucide-react";

export default function EditBusinessProfilePage() {
  // === Overview ===
  const [companyName, setCompanyName] = useState("Acme Corp");
  const [website, setWebsite] = useState("https://acme.com");
  const [industry, setIndustry] = useState("SaaS");
  const [salesMotion, setSalesMotion] = useState("PLG – Enterprise");
  const [elevatorPitch, setElevatorPitch] = useState(
    "Modern platform for call analytics and revenue insights."
  );

  // === Products ===
  const [products, setProducts] = useState<string[]>([
    "Call Analytics",
    "AI Summarizer",
  ]);
  const [productNotes, setProductNotes] = useState<string[]>([
    "Primary SKU",
    "Add-on",
  ]);

  // === ICP ===
  const [companySize, setCompanySize] = useState<string[]>(["51–500"]);
  const [regions, setRegions] = useState<string[]>(["NA", "EU"]);
  const [industries, setIndustries] = useState<string[]>(["SaaS", "Fintech"]);
  const [techStack, setTechStack] = useState<string[]>([
    "Salesforce",
    "HubSpot",
    "Slack",
  ]);
  const [initiatives, setInitiatives] = useState<string[]>([
    "RevOps",
    "Sales",
    "Fintech",
  ]);
  const [painPoints, setPainPoints] = useState<string[]>([
    "Unstructured calls",
    "Lost insights",
    "Manual follow-ups",
  ]);

  // === Personas ===
  type Persona = { role: string; notes?: string };
  const [personas, setPersonas] = useState<Persona[]>([
    { role: "VP Sales", notes: "Economic Buyer" },
    { role: "RevOps Manager", notes: "Champion" },
    { role: "Executive Buyer", notes: "KPIs: Win rate, cycle time" },
  ]);

  // === Talk Tracks & Objections ===
  const [discoveryQs, setDiscoveryQs] = useState(
    "1) How do you capture call insights today? 2) What does success look like?"
  );
  const [valueProps, setValueProps] = useState(
    "Automated summaries, risk detection, CRM updates"
  );
  const [proofPoints, setProofPoints] = useState(
    "Saved 6+ hrs/wk per rep at Series B fintech"
  );
  type Objection = { title: string; rebuttal: string };
  const [objections, setObjections] = useState<Objection[]>([
    {
      title: "Security concerns",
      rebuttal: "We are SOC2 Type I and never train on your data.",
    },
    {
      title: "Too expensive",
      rebuttal: "ROI proven via time saved and improved conversions.",
    },
  ]);

  const addPersona = () => setPersonas((p) => [...p, { role: "", notes: "" }]);
  const addObjection = () =>
    setObjections((o) => [...o, { title: "", rebuttal: "" }]);
  const onSave = () => console.log("Payload saved");

  return (
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
          <Button variant="secondary" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Re-run All Analysis
          </Button>
          <Button onClick={onSave}>Save Changes</Button>
        </div>
      </header>

      <div className="text-xs text-muted-foreground">
        Last analyzed: 2025-01-04 02:17:08
      </div>

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
        <Field label="Elevator Pitch">
          <Textarea
            rows={3}
            value={elevatorPitch}
            onChange={(e) => setElevatorPitch(e.target.value)}
          />
        </Field>
      </SectionCard>

      {/* PRODUCTS */}
      <SectionCard title="Products" desc="Add up to 5 key offerings.">
        {products.map((prod, i) => (
          <div
            key={i}
            className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1.5fr_1fr_auto]"
          >
            <Field label="Name">
              <Input
                value={prod}
                onChange={(e) =>
                  setProducts((arr) =>
                    arr.map((v, idx) => (idx === i ? e.target.value : v))
                  )
                }
              />
            </Field>
            <Field label="Note">
              <Input
                placeholder="Primary SKU, Add-on, etc."
                value={productNotes[i] || ""}
                onChange={(e) =>
                  setProductNotes((arr) => {
                    const next = [...arr];
                    next[i] = e.target.value;
                    return next;
                  })
                }
              />
            </Field>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setProducts((arr) => arr.filter((_, idx) => idx !== i));
                setProductNotes((arr) => arr.filter((_, idx) => idx !== i));
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
          onClick={() => {
            if (products.length >= 5) return;
            setProducts((arr) => [...arr, ""]);
            setProductNotes((arr) => [...arr, ""]);
          }}
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
          <Field label="Initiatives">
            <ChipInput
              values={initiatives}
              setValues={setInitiatives}
              placeholder="e.g., Fintech"
            />
          </Field>
          <Field label="Tech Stack">
            <ChipInput
              values={techStack}
              setValues={setTechStack}
              placeholder="e.g., Salesforce"
            />
          </Field>
          <Field label="Pain Points">
            <ChipInput
              values={painPoints}
              setValues={setPainPoints}
              placeholder="e.g., Manual follow-ups"
            />
          </Field>
        </div>
      </SectionCard>

      {/* PERSONAS */}
      <SectionCard title="Personas" desc="Stakeholders you sell to.">
        {personas.map((p, i) => (
          <div
            key={i}
            className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_2fr_auto]"
          >
            <Field label="Role">
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
        desc="Prepare your sellers for better conversations."
      >
        <Field label="Discovery Questions">
          <Textarea
            rows={3}
            value={discoveryQs}
            onChange={(e) => setDiscoveryQs(e.target.value)}
          />
        </Field>
        <Field label="Value Props">
          <Textarea
            rows={3}
            value={valueProps}
            onChange={(e) => setValueProps(e.target.value)}
          />
        </Field>
        <Field label="Proof Points">
          <Textarea
            rows={2}
            value={proofPoints}
            onChange={(e) => setProofPoints(e.target.value)}
          />
        </Field>
      </SectionCard>

      {/* OBJECTIONS */}
      <SectionCard
        title="Objections"
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
      <footer className="sticky bottom-0 mt-8 flex items-center justify-between gap-3 border-t border-border/60 bg-card/60 p-3 backdrop-blur-sm">
        <p className="text-xs text-muted-foreground">
          Keep responses concise and relevant.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline">Cancel</Button>
          <Button variant="secondary" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Re-run All Analysis
          </Button>
          <Button onClick={onSave}>Save Changes</Button>
        </div>
      </footer>
    </div>
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
