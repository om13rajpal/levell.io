"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Scoring configuration based on sales motion and framework
const SCORING_CONFIG = {
  smb: {
    spiced: {
      fit: 75,
      painImpact: 70,
      timelineUrgency: 80,
      engagement: 85,
      championStrength: 65,
      dealEconomics: 70,
    },
    meddic: {
      fit: 80,
      painImpact: 75,
      timelineUrgency: 70,
      engagement: 85,
      championStrength: 70,
      dealEconomics: 80,
    },
    bant: {
      fit: 85,
      painImpact: 65,
      timelineUrgency: 75,
      engagement: 80,
      championStrength: 60,
      dealEconomics: 85,
    },
  },
  "mid-market": {
    spiced: {
      fit: 80,
      painImpact: 70,
      timelineUrgency: 75,
      engagement: 85,
      championStrength: 75,
      dealEconomics: 75,
    },
    meddic: {
      fit: 80,
      painImpact: 65,
      timelineUrgency: 70,
      engagement: 90,
      championStrength: 85,
      dealEconomics: 75,
    },
    bant: {
      fit: 85,
      painImpact: 70,
      timelineUrgency: 80,
      engagement: 85,
      championStrength: 70,
      dealEconomics: 80,
    },
  },
  enterprise: {
    spiced: {
      fit: 85,
      painImpact: 80,
      timelineUrgency: 70,
      engagement: 90,
      championStrength: 80,
      dealEconomics: 85,
    },
    meddic: {
      fit: 85,
      painImpact: 80,
      timelineUrgency: 75,
      engagement: 90,
      championStrength: 90,
      dealEconomics: 85,
    },
    bant: {
      fit: 80,
      painImpact: 70,
      timelineUrgency: 65,
      engagement: 85,
      championStrength: 75,
      dealEconomics: 80,
    },
  },
};

type SalesMotion = keyof typeof SCORING_CONFIG;
type Framework = "spiced" | "meddic" | "bant";

export default function ConfigureSalesProcessStep({
  onChange,
}: {
  onChange: (values: { sales_motion: string; framework: string }) => void;
}) {
  const [salesMotion, setSalesMotion] = useState<SalesMotion>("mid-market");
  const [framework, setFramework] = useState<Framework>("meddic");

  // Get current scores based on selection
  const scores = useMemo(() => {
    return SCORING_CONFIG[salesMotion][framework];
  }, [salesMotion, framework]);

  // Notify parent on every change
  useEffect(() => {
    onChange({ sales_motion: salesMotion, framework });
  }, [salesMotion, framework]);

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-background flex flex-col lg:flex-row gap-8">
      {/* ===== LEFT SIDE ===== */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold">Configure Your Sales Process</h2>
          <p className="text-sm text-muted-foreground">
            Choose your sales motion and qualification framework.
          </p>
        </div>

        {/* Sales Motion + Framework */}
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
                onValueChange={(value) => setSalesMotion(value as SalesMotion)}
              >
                <OptionCard
                  id="smb"
                  title="SMB"
                  desc="High velocity, short cycles, lean teams."
                  active={salesMotion === "smb"}
                />
                <OptionCard
                  id="mid-market"
                  title="Mid-Market"
                  desc="Blend of velocity and depth, multi-stakeholder."
                  active={salesMotion === "mid-market"}
                />
                <OptionCard
                  id="enterprise"
                  title="Enterprise"
                  desc="Longer cycles, complex procurement."
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
                onValueChange={(value) => setFramework(value as Framework)}
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
                  desc="Metrics, Buyer, Criteria, Pain, Champion."
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

      {/* RIGHT SIDE */}
      <div className="lg:w-96 flex flex-col justify-start pt-[5.25rem]">
        <Card className="border border-border bg-muted/30 rounded-xl h-fit">
          <CardHeader>
            <CardTitle className="text-base font-medium">Scoring Preview</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Qualification Weights (Preview)
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <SliderGroup label="Fit (ICP Match)" value={scores.fit} />
            <SliderGroup label="Pain/Impact Evidence" value={scores.painImpact} />
            <SliderGroup label="Timeline/Urgency" value={scores.timelineUrgency} />
            <SliderGroup label="Engagement" value={scores.engagement} />
            <SliderGroup label="Champion Strength" value={scores.championStrength} />
            <SliderGroup label="Deal Economics" value={scores.dealEconomics} />

            <p className="text-xs text-muted-foreground mt-4">
              Based on <strong>{salesMotion} + {framework.toUpperCase()}</strong> defaults.
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
      <Progress value={value} className="h-2" />
    </div>
  );
}