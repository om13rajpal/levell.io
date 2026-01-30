"use client";

/**
 * ErrorBoundary Component
 *
 * A reusable error boundary component that catches JavaScript errors
 * anywhere in its child component tree, logs those errors, and displays
 * a fallback UI instead of the component tree that crashed.
 *
 * @module components/ErrorBoundary
 */

// Re-export everything from the UI component
export {
  ErrorBoundary,
  default,
  type ErrorBoundaryProps,
  type ErrorBoundaryFallbackProps,
  type ErrorInfo,
} from "@/components/ui/error-boundary";

// Re-export hooks for convenience
export {
  useErrorBoundary,
  useErrorState,
  type UseErrorBoundaryReturn,
} from "@/hooks/useErrorBoundary";
