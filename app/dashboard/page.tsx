"use client";

import { useEffect } from "react";
import { useTranscriptStore } from "@/store/useTranscriptStore";
import { supabase } from "@/lib/supabaseClient";

import { AppSidebar } from "@/components/app-sidebar";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { TranscriptTable } from "@/components/transcripts/TranscriptTable";

export default function Page() {
  const transcripts = useTranscriptStore((s) => s.transcripts);
  const setTranscripts = useTranscriptStore((s) => s.setTranscripts);

  // ---------------------------------------------
  // ⭐ 1. Load transcripts from localStorage on mount
  // ---------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("transcripts-cache");

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log("Loaded transcripts from localStorage:", parsed);
        setTranscripts(parsed);
      } catch (err) {
        console.error("Failed to parse transcripts-cache:", err);
      }
    }
  }, [setTranscripts]);

  // ---------------------------------------------
  // ⭐ 2. Fetch from Supabase and update Zustand + localStorage
  // ---------------------------------------------
  useEffect(() => {
    const fetchTranscripts = async () => {
      try {
        const tokenStr = localStorage.getItem(
          "sb-rpowalzrbddorfnnmccp-auth-token"
        );
        if (!tokenStr) return;

        const parsed = JSON.parse(tokenStr);
        const userId = parsed?.user?.id;
        if (!userId) return;

        const { data, error } = await supabase
          .from("transcripts")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Supabase error:", error);
          return;
        }

        console.log("Fetched from Supabase:", data);

        // Save to Zustand
        setTranscripts(data ?? []);

        // ⭐ Save to localStorage
        localStorage.setItem("transcripts-cache", JSON.stringify(data ?? []));
      } catch (err) {
        console.error("Error fetching transcripts:", err);
      }
    };

    fetchTranscripts();
  }, [setTranscripts]);

  // Debug: log whenever Zustand updates
  useEffect(() => {
    console.log("🔥 Zustand transcripts updated", transcripts);
  }, [transcripts]);

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
        <SiteHeader heading="Dashboard" />

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />

              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>
              {/* @ts-ignore */}
              <TranscriptTable data={transcripts ?? []} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}