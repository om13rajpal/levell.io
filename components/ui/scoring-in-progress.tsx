"use client";

import { cn } from "@/lib/utils";

interface ScoringInProgressProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "card" | "inline" | "badge";
  message?: string;
}

export function ScoringInProgress({
  className,
  size = "md",
  variant = "default",
  message = "Scoring your calls",
}: ScoringInProgressProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-10 w-10",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  // Inline badge variant for table cells
  if (variant === "badge") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-full",
          "bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10",
          "border border-primary/20",
          className
        )}
      >
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </div>
        <span className="text-[10px] font-medium text-primary/80">Scoring</span>
      </div>
    );
  }

  // Inline variant for small spaces
  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="relative">
          <div
            className={cn(
              "rounded-full border-2 border-primary/30 border-t-primary animate-spin",
              sizeClasses[size]
            )}
          />
        </div>
        <span className={cn("text-muted-foreground", textSizeClasses[size])}>
          {message}...
        </span>
      </div>
    );
  }

  // Card variant for larger empty states
  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12 px-6 text-center",
          "bg-gradient-to-br from-primary/5 via-transparent to-primary/5",
          "rounded-xl border border-dashed border-primary/20",
          className
        )}
      >
        {/* Animated rings */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="absolute inset-2 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
          <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <svg
              className="h-8 w-8 text-primary animate-pulse"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-pulse"
              />
            </svg>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-2">
          {message}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Our AI is analyzing your conversations to provide detailed insights and performance scores.
        </p>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mt-6">
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-8",
        className
      )}
    >
      {/* Animated spinner with glow */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl animate-pulse" />
        <div className="relative">
          <svg
            className={cn("animate-spin text-primary", sizeClasses.lg)}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className={cn("font-medium text-foreground", textSizeClasses[size])}>
          {message}
        </p>
        <p className="text-xs text-muted-foreground">
          This may take a moment...
        </p>
      </div>
    </div>
  );
}
