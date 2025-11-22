"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft } from "lucide-react";

function industryFromDomain(domain: string) {
  if (!domain) return "Unknown";
  if (domain.includes("tech")) return "Technology";
  if (domain.includes("health")) return "Healthcare";
  if (domain.includes("fin")) return "Finance";
  if (domain.includes("soft")) return "SaaS";
  return "General";
}

export default function CompanyDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [company, setCompany] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: comp } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id)
        .single();

      const { data: callData } = await supabase
        .from("company_calls")
        .select("id, created_at, transcript_id")
        .eq("company_id", id);

      setCompany(comp);
      setCalls(callData || []);
      setLoading(false);
    }

    load();
  }, [id]);

  const industry = useMemo(() => {
    return company?.domain ? industryFromDomain(company.domain) : "Unknown";
  }, [company]);

  if (loading) {
    return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  }

  if (!company) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        Company not found.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Button variant="ghost" className="mb-6" onClick={() => router.push("/companies")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Companies
      </Button>

      {/* Company Info */}
      <Card className="mb-6 bg-card/60 backdrop-blur-sm border-border/60">
        <CardHeader>
          <CardTitle className="text-xl">{company.company_name}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <p><strong>Domain:</strong> {company.domain || "—"}</p>
          <p><strong>Industry:</strong> {industry}</p>
          <p><strong>Created at:</strong> {new Date(company.created_at).toLocaleString()}</p>

          {company.company_goal_objective && (
            <p>
              <strong>Company Goal:</strong><br />
              {company.company_goal_objective}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Calls */}
      <Card className="bg-card/60 backdrop-blur-sm border-border/60">
        <CardHeader>
          <CardTitle>Company Calls ({calls.length})</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {calls.length === 0 ? (
            <p className="text-muted-foreground text-sm">No calls recorded.</p>
          ) : (
            <ul className="space-y-2">
              {calls.map((call) => (
                <li
                  key={call.id}
                  className="border border-border/60 p-3 rounded-lg bg-background/40"
                >
                  <p><strong>Transcript ID:</strong> {call.transcript_id}</p>
                  <p>
                    <strong>Date:</strong>{" "}
                    {new Date(call.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}