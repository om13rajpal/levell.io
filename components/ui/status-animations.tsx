"use client";

import { Sparkles, RefreshCw, BarChart3, TrendingUp } from "lucide-react";

/**
 * Syncing Animation - Shows when calls are being synced from Fireflies
 */
export function SyncingAnimation({
  size = "default",
  showText = true
}: {
  size?: "sm" | "default" | "lg";
  showText?: boolean;
}) {
  const sizeClasses = {
    sm: { container: "h-16 w-16", icon: "h-6 w-6", ring: "h-16 w-16", dot: "h-1.5 w-1.5" },
    default: { container: "h-20 w-20", icon: "h-8 w-8", ring: "h-20 w-20", dot: "h-2 w-2" },
    lg: { container: "h-24 w-24", icon: "h-10 w-10", ring: "h-24 w-24", dot: "h-2.5 w-2.5" },
  };

  const s = sizeClasses[size];

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative mb-4">
        {/* Outer pulsing ring */}
        <div className={`absolute inset-0 ${s.ring} rounded-full border-2 border-primary/20 animate-pulse`} />
        {/* Spinning ring */}
        <div className={`${s.ring} rounded-full border-3 border-transparent border-t-primary animate-spin`} />
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <RefreshCw className={`${s.icon} text-primary animate-spin`} style={{ animationDuration: '2s' }} />
          </div>
        </div>
      </div>
      {showText && (
        <>
          <h4 className="font-semibold text-base bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-1">
            Syncing Calls
          </h4>
          <p className="text-xs text-muted-foreground text-center max-w-[200px]">
            Fetching your call recordings...
          </p>
          <div className="flex items-center gap-1 mt-2">
            <span className={`${s.dot} rounded-full bg-primary animate-bounce`} style={{ animationDelay: '0ms' }} />
            <span className={`${s.dot} rounded-full bg-primary animate-bounce`} style={{ animationDelay: '150ms' }} />
            <span className={`${s.dot} rounded-full bg-primary animate-bounce`} style={{ animationDelay: '300ms' }} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Scoring Animation - Shows when AI is analyzing and scoring calls
 */
export function ScoringAnimation({
  size = "default",
  showText = true,
  scoredCount,
  totalCount,
}: {
  size?: "sm" | "default" | "lg";
  showText?: boolean;
  scoredCount?: number;
  totalCount?: number;
}) {
  const sizeClasses = {
    sm: { container: "h-16 w-16", icon: "h-6 w-6", ring: "h-16 w-16", dot: "h-1.5 w-1.5" },
    default: { container: "h-20 w-20", icon: "h-8 w-8", ring: "h-20 w-20", dot: "h-2 w-2" },
    lg: { container: "h-24 w-24", icon: "h-10 w-10", ring: "h-24 w-24", dot: "h-2.5 w-2.5" },
  };

  const s = sizeClasses[size];

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative mb-4">
        {/* Outer pulsing ring */}
        <div className={`absolute inset-0 ${s.ring} rounded-full border-2 border-amber-500/20 animate-pulse`} />
        {/* Spinning gradient ring */}
        <div className={`${s.ring} rounded-full border-3 border-transparent border-t-amber-500 border-r-amber-400/50 animate-spin`} />
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <BarChart3 className={`${s.icon} text-amber-500 animate-pulse`} />
            {/* Sparkle effects */}
            <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <div className="absolute -bottom-1 -left-1 h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" style={{ animationDelay: '0.5s' }} />
          </div>
        </div>
      </div>
      {showText && (
        <>
          <h4 className="font-semibold text-base bg-gradient-to-r from-amber-500 to-amber-400 bg-clip-text text-transparent mb-1">
            AI Scoring
          </h4>
          <p className="text-xs text-muted-foreground text-center max-w-[200px]">
            {scoredCount !== undefined && totalCount !== undefined
              ? `${scoredCount} of ${totalCount} calls analyzed`
              : "Analyzing call quality..."
            }
          </p>
          <div className="flex items-center gap-1 mt-2">
            <span className={`${s.dot} rounded-full bg-amber-500 animate-bounce`} style={{ animationDelay: '0ms' }} />
            <span className={`${s.dot} rounded-full bg-amber-500 animate-bounce`} style={{ animationDelay: '150ms' }} />
            <span className={`${s.dot} rounded-full bg-amber-500 animate-bounce`} style={{ animationDelay: '300ms' }} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Predicting Animation - Shows when AI is predicting companies from calls
 */
export function PredictingAnimation({
  size = "default",
  showText = true
}: {
  size?: "sm" | "default" | "lg";
  showText?: boolean;
}) {
  const sizeClasses = {
    sm: { container: "h-16 w-16", icon: "h-6 w-6", ring: "h-16 w-16", dot: "h-1.5 w-1.5" },
    default: { container: "h-20 w-20", icon: "h-8 w-8", ring: "h-20 w-20", dot: "h-2 w-2" },
    lg: { container: "h-24 w-24", icon: "h-10 w-10", ring: "h-24 w-24", dot: "h-2.5 w-2.5" },
  };

  const s = sizeClasses[size];

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative mb-4">
        {/* Outer pulsing ring */}
        <div className={`absolute inset-0 ${s.ring} rounded-full border-2 border-primary/20 animate-pulse`} />
        {/* Spinning ring */}
        <div className={`${s.ring} rounded-full border-3 border-transparent border-t-primary animate-spin`} />
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <Sparkles className={`${s.icon} text-primary animate-pulse`} />
            {/* Sparkle effects */}
            <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-ping" />
            <div className="absolute -bottom-1 -left-1 h-1.5 w-1.5 rounded-full bg-primary animate-ping" style={{ animationDelay: '0.5s' }} />
          </div>
        </div>
      </div>
      {showText && (
        <>
          <h4 className="font-semibold text-base bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-1">
            Predicting Companies
          </h4>
          <p className="text-xs text-muted-foreground text-center max-w-[220px]">
            AI is analyzing your call transcripts to detect companies...
          </p>
          <div className="flex items-center gap-1 mt-2">
            <span className={`${s.dot} rounded-full bg-primary animate-bounce`} style={{ animationDelay: '0ms' }} />
            <span className={`${s.dot} rounded-full bg-primary animate-bounce`} style={{ animationDelay: '150ms' }} />
            <span className={`${s.dot} rounded-full bg-primary animate-bounce`} style={{ animationDelay: '300ms' }} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Inline Scoring Indicator - Small inline animation for cards/tables
 */
export function InlineScoringIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-amber-500/10 border border-amber-500/20">
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
      </div>
      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Scoring</span>
    </div>
  );
}

/**
 * Inline Syncing Indicator - Small inline animation for cards/tables
 */
export function InlineSyncingIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20">
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
      </div>
      <span className="text-[10px] font-medium text-primary/80">Syncing</span>
    </div>
  );
}

/**
 * Card Scoring Animation - For use in dashboard cards
 */
export function CardScoringAnimation() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
      </div>
      <span className="text-lg text-muted-foreground">Scoring...</span>
    </div>
  );
}

/**
 * Card Syncing Animation - For use in dashboard cards
 */
export function CardSyncingAnimation() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
      </div>
      <span className="text-lg text-muted-foreground">Syncing...</span>
    </div>
  );
}
