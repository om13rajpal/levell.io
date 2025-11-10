"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Info, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReviewBusinessProfile({
  companyInfo,
  products,
  idealCustomer,
  buyerPersonas,
  talkTracks,
  objections,
}: {
  companyInfo: any;
  products: any[];
  idealCustomer: any;
  buyerPersonas: any[];
  talkTracks: any[];
  objections: any[];
}) {
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* HEADER */}
      <div>
        <h2 className="text-xl font-semibold">Review Your Business Profile</h2>
        <p className="text-sm text-muted-foreground">
          Make edits before finalizing your setup. Your changes will update
          recommendations.
        </p>
      </div>

      {/* INFO ALERT */}
      <Alert className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300/60 dark:border-yellow-900/60">
        <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-300">
          Please verify key details like company name, ICP, and buyer personas.
          Accurate data improves AI results.
        </AlertDescription>
      </Alert>

      {/* GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* === COLUMN 1 === */}
        <div className="space-y-6">
          <CompanyInfoCard info={companyInfo} />
          <IdealCustomerCard data={idealCustomer} />
        </div>

        {/* === COLUMN 2 === */}
        <div className="space-y-6">
          <ProductsCard products={products} />
          <BuyerPersonasCard personas={buyerPersonas} />
        </div>

        {/* === COLUMN 3 === */}
        <div className="space-y-6">
          <TalkTracksCard tracks={talkTracks} />
          <ObjectionsCard objections={objections} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- COMPANY INFO ---------------- */
function CompanyInfoCard({ info }: { info: any }) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="flex justify-between">
        <CardTitle className="text-base font-medium">Company Info</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div>
          <div className="font-medium">Company Name</div>
          <p className="text-muted-foreground">{info.name}</p>
        </div>
        <div>
          <div className="font-medium">Website</div>
          <a href={info.website} className="text-blue-600 hover:underline">
            {info.website}
          </a>
        </div>
        <div>
          <div className="font-medium">Value Proposition</div>
          <p className="text-muted-foreground">{info.value}</p>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm">
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
          <Button variant="secondary" size="sm">
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- PRODUCTS ---------------- */
function ProductsCard({ products }: { products: any[] }) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="text-base font-medium">Products & Services</CardTitle>
        <Button variant="ghost" size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {products.map((p, i) => (
          <div
            key={i}
            className="flex justify-between items-center border border-border rounded-lg px-3 py-2"
          >
            <p className="text-sm">{p.name}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Trash2 className="h-3 w-3 mr-1" /> Remove
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- IDEAL CUSTOMER ---------------- */
function IdealCustomerCard({ data }: { data: any }) {
  const fields = [
    { label: "Industry", value: data.industry },
    { label: "Company Size", value: data.size },
    { label: "Region", value: data.region },
    { label: "Tech Stack", value: data.techStack },
    { label: "Sales Motion", value: data.salesMotion },
  ];

  return (
    <Card className="rounded-xl">
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="text-base font-medium">Ideal Customer Profile</CardTitle>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f, i) => (
          <div key={i}>
            <div className="font-medium text-sm">{f.label}</div>
            <p className="text-sm text-muted-foreground">{f.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- BUYER PERSONAS ---------------- */
function BuyerPersonasCard({ personas }: { personas: any[] }) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="text-base font-medium">Buyer Personas</CardTitle>
        <Button variant="ghost" size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Add Persona
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {personas.map((p, i) => (
          <div key={i} className="border border-border rounded-lg p-3 space-y-1">
            <div className="font-medium">{p.title}</div>
            <Field label="Goals" value={p.goals} />
            <Field label="Pains" value={p.pains} />
            <Field label="Concerns" value={p.concerns} />
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm">
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Trash2 className="h-3 w-3 mr-1" /> Remove
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- TALK TRACKS ---------------- */
function TalkTracksCard({ tracks }: { tracks: any[] }) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="text-base font-medium">Talk Tracks</CardTitle>
        <Button variant="ghost" size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {tracks.map((t, i) => (
          <div
            key={i}
            className="flex justify-between items-center border border-border rounded-lg px-3 py-2"
          >
            <p className="text-sm italic">{t.text}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Trash2 className="h-3 w-3 mr-1" /> Remove
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- OBJECTIONS ---------------- */
function ObjectionsCard({ objections }: { objections: any[] }) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="text-base font-medium">Objection Handling</CardTitle>
        <Button variant="ghost" size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Add Pair
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {objections.map((o, i) => (
          <div
            key={i}
            className="border border-border rounded-lg p-3 space-y-2"
          >
            <Field label="Objection" value={o.objection} />
            <Field label="Response" value={o.response} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Trash2 className="h-3 w-3 mr-1" /> Remove
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- HELPERS ---------------- */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}