"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error information passed to callbacks
 */
export interface ErrorInfo {
  error: Error;
  errorInfo: React.ErrorInfo;
  componentStack: string | null;
}

/**
 * Props for the ErrorBoundary component
 */
export interface ErrorBoundaryProps {
  /** Child components to render */
  children: React.ReactNode;
  /** Custom fallback UI to render when an error occurs */
  fallback?: React.ReactNode | ((props: ErrorBoundaryFallbackProps) => React.ReactNode);
  /** Callback fired when an error is caught */
  onError?: (errorInfo: ErrorInfo) => void;
  /** Callback fired when the error boundary resets */
  onReset?: () => void;
}

/**
 * Props passed to the fallback render function
 */
export interface ErrorBoundaryFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary - A React error boundary component that catches JavaScript errors
 * anywhere in its child component tree and displays a fallback UI.
 *
 * @example
 * // Basic usage with default fallback
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * @example
 * // With custom fallback and error logging
 * <ErrorBoundary
 *   fallback={<div>Something went wrong</div>}
 *   onError={(info) => logToService(info)}
 *   onReset={() => refetchData()}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * @example
 * // With render function fallback
 * <ErrorBoundary
 *   fallback={({ error, resetErrorBoundary }) => (
 *     <div>
 *       <p>Error: {error.message}</p>
 *       <button onClick={resetErrorBoundary}>Retry</button>
 *     </div>
 *   )}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Always log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error);
      console.error("Component stack:", errorInfo.componentStack);
    }

    // Call the optional onError callback for external logging
    this.props.onError?.({
      error,
      errorInfo,
      componentStack: errorInfo.componentStack ?? null,
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;

      // If fallback is a function, call it with error and reset function
      if (typeof fallback === "function") {
        return fallback({
          error: this.state.error,
          resetErrorBoundary: this.handleReset,
        });
      }

      // If fallback is a React node, render it directly
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center gap-4 border border-border rounded-lg bg-muted/30">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {process.env.NODE_ENV === "development" && this.state.error ? (
                <span className="font-mono text-xs break-all">
                  {this.state.error.message}
                </span>
              ) : (
                "Failed to load this section. Please try again."
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
