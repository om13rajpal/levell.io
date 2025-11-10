"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export default function ConfigureSalesProcessStep() {
  const [salesMotion, setSalesMotion] = useState("mid");
  const [framework, setFramework] = useState("meddic");

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-background flex flex-col lg:flex-row gap-8">
      {/* ===== LEFT SIDE ===== */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold">Configure Your Sales Process</h2>
          <p className="text-sm text-muted-foreground">
            Choose your sales motion and qualification framework. You can adjust
            weights later in settings.
          </p>
        </div>

        {/* Sales Motion + Framework in same vertical stack */}
        <div className="space-y-6">
          {/* Sales Motion */}
          <Card className="border border-border rounded-xl shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-medium">Sales Motion</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                value={salesMotion}
                onValueChange={setSalesMotion}
              >
                <OptionCard
                  id="smb"
                  title="SMB"
                  desc="High velocity, short cycles, lean teams."
                  active={salesMotion === "smb"}
                />
                <OptionCard
                  id="mid"
                  title="Mid-Market"
                  desc="Blend of velocity and depth, multi-stakeholder."
                  active={salesMotion === "mid"}
                />
                <OptionCard
                  id="enterprise"
                  title="Enterprise"
                  desc="Longer cycles, complex procurement, many buyers."
                  active={salesMotion === "enterprise"}
                />
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Framework */}
          <Card className="border border-border rounded-xl shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-medium">Framework</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                value={framework}
                onValueChange={setFramework}
              >
                <OptionCard
                  id="spiced"
                  title="SPICED"
                  desc="Situation, Pain, Impact, Critical Event, Decision."
                  active={framework === "spiced"}
                />
                <OptionCard
                  id="meddic"
                  title="MEDDIC"
                  desc="Metrics, Economic Buyer, Decision Criteria, Identify Pain, Champion."
                  active={framework === "meddic"}
                />
                <OptionCard
                  id="bant"
                  title="BANT"
                  desc="Budget, Authority, Need, Timeline."
                  active={framework === "bant"}
                />
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== RIGHT SIDE (Scoring Preview) ===== */}
      <div className="lg:w-96 flex flex-col justify-start pt-[5.25rem]">
        {/* Pushes down the preview card to align with the Sales Motion card */}
        <Card className="border border-border bg-muted/30 rounded-xl h-fit">
          <CardHeader>
            <CardTitle className="text-base font-medium">Scoring Preview</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Qualification Weights (Preview)
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <SliderGroup label="Fit (ICP Match)" value={80} />
            <SliderGroup label="Pain/Impact Evidence" value={65} />
            <SliderGroup label="Timeline/Urgency" value={70} />
            <SliderGroup label="Engagement (Meetings/Replies)" value={90} />
            <SliderGroup label="Champion Strength" value={85} />
            <SliderGroup label="Deal Economics" value={75} />

            <p className="text-xs text-muted-foreground mt-4">
              These weights are based on{" "}
              <strong>Mid-Market + MEDDIC</strong> defaults.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== Subcomponents =====

function OptionCard({
  id,
  title,
  desc,
  active,
}: {
  id: string;
  title: string;
  desc: string;
  active: boolean;
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex flex-col justify-between border rounded-lg p-4 cursor-pointer transition-all",
        active
          ? "border-primary/60 bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/30 hover:bg-muted/20"
      )}
    >
      <div className="flex items-start gap-2">
        <RadioGroupItem id={id} value={id} />
        <div>
          <div className="font-medium">{title}</div>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
    </Label>
  );
}

function SliderGroup({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <Slider defaultValue={[value]} max={100} step={1} disabled />
    </div>
  );
}