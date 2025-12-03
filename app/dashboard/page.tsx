"use client";

import { useEffect, useCallback } from "react";
import {
  useTranscripts,
  useTranscriptLoading,
  useTranscriptActions,
  useIsDataStale,
} from "@/store/useTranscriptStore";
import { supabase } from "@/lib/supabaseClient";
import { getUserIdFromCache } from "@/lib/supabaseCache";

import { AppSidebar } from "@/components/app-sidebar";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

import { TranscriptTable } from "@/components/transcripts/TranscriptTable";

export default function Page() {
  // Selective subscriptions to prevent unnecessary re-renders
  const transcripts = useTranscripts();
  const { isLoading } = useTranscriptLoading();
  const { setTranscripts, setLoading, setError } = useTranscriptActions();
  const isStale = useIsDataStale(5 * 60 * 1000); // 5 minutes

  // Single optimized data fetching flow
  const fetchTranscripts = useCallback(async () => {
    // Get authenticated user ID
    const userId = getUserIdFromCache();
    if (!userId) {
      return;
    }

    setLoading(true);

    try {
      // Fetch fresh data from Supabase
      const { data, error } = await supabase
        .from("transcripts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
        return;
      }

      // Update store (automatically cached by persist middleware)
      setTranscripts(data ?? []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch transcripts";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [setTranscripts, setLoading, setError]);

  // Fetch on mount and when data is stale
  useEffect(() => {
    if (transcripts.length === 0 || isStale) {
      fetchTranscripts();
    }
  }, [fetchTranscripts, isStale, transcripts.length]);

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

              {isLoading && transcripts.length === 0 ? (
                <LoadingSkeleton />
              ) : (
                <TranscriptTable data={transcripts} />
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * Loading skeleton for transcript table
 * Provides visual feedback while data is being fetched
 */
function LoadingSkeleton() {
  return (
    <div className="px-4 lg:px-6 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}