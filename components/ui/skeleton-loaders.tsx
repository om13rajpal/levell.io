"use client";

import { cn } from "@/lib/utils";

// Base skeleton with shimmer animation
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/50",
        className
      )}
    />
  );
}

// Table skeleton for transcript lists
export function TableSkeleton({
  rows = 5,
  columns = 4
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="w-full space-y-3">
      {/* Table header */}
      <div className="flex gap-4 border-b border-border pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={`header-${i}`}
            className="h-4 flex-1"
          />
        ))}
      </div>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 py-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              className="h-4 flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Card skeleton for stats cards
export function StatsCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

// Grid of stats cards
export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatsCardSkeleton key={`stats-${i}`} />
      ))}
    </div>
  );
}

// Pre-calculated bar heights for consistency
const BAR_HEIGHTS = ["h-[40%]", "h-[60%]", "h-[75%]", "h-[50%]", "h-[85%]", "h-[65%]", "h-[55%]"];

// Chart skeleton
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-60" />
        <div
          className="relative mt-6"
          style={{ height: `${height}px` }}
        >
          {/* Chart bars/lines placeholder */}
          <div className="absolute inset-0 flex items-end justify-around gap-2 px-4 pb-8">
            {BAR_HEIGHTS.map((heightClass, i) => (
              <Skeleton
                key={`bar-${i}`}
                className={cn("w-full", heightClass)}
              />
            ))}
          </div>
          {/* X-axis labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-around px-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={`label-${i}`} className="h-3 w-8" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Call detail page skeleton
export function CallDetailSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats cards */}
      <StatsGridSkeleton count={4} />

      {/* Main content area */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Transcript section */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`transcript-${i}`} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            ))}
          </div>
        </div>

        {/* Analysis section */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <div className="pt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`insight-${i}`} className="flex items-start gap-3">
                  <Skeleton className="h-4 w-4 rounded-full flex-shrink-0 mt-0.5" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Company card skeleton
export function CompanyCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`metric-${i}`} className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Companies page skeleton
export function CompaniesPageSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Search and filters */}
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1 max-w-md" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Company cards grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CompanyCardSkeleton key={`company-${i}`} />
        ))}
      </div>
    </div>
  );
}

// Team page skeleton
export function TeamPageSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Team stats */}
      <StatsGridSkeleton count={3} />

      {/* Team members table */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <TableSkeleton rows={5} columns={5} />
        </div>
      </div>
    </div>
  );
}

// Dashboard page skeleton (combines stats + chart + table)
export function DashboardSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats cards */}
      <StatsGridSkeleton count={4} />

      {/* Chart */}
      <ChartSkeleton height={400} />

      {/* Recent activity table */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <TableSkeleton rows={5} columns={4} />
        </div>
      </div>
    </div>
  );
}

// Transcript table row skeleton
export function TranscriptRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-border last:border-0">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}
