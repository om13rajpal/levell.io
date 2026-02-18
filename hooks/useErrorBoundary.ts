"use client";

import { useCallback, useState } from "react";

/**
 * Return type for the useErrorBoundary hook
 */
export interface UseErrorBoundaryReturn {
  /** The current error, if any */
  error: Error | null;
  /** Whether an error has been thrown */
  hasError: boolean;
  /** Reset the error state */
  resetError: () => void;
  /** Manually throw an error to be caught by the nearest ErrorBoundary */
  showBoundary: (error: Error) => void;
}

/**
 * A hook that provides programmatic control over error boundaries.
 *
 * This hook allows functional components to:
 * 1. Manually trigger an error boundary by calling `showBoundary(error)`
 * 2. Track error state locally
 * 3. Reset the error state
 *
 * Note: To actually catch and display the error with a fallback UI,
 * wrap the component using this hook with an `<ErrorBoundary>` component.
 *
 * @example
 * // Basic usage - throw errors from async operations
 * function MyComponent() {
 *   const { showBoundary } = useErrorBoundary();
 *
 *   const handleClick = async () => {
 *     try {
 *       await riskyOperation();
 *     } catch (error) {
 *       showBoundary(error instanceof Error ? error : new Error(String(error)));
 *     }
 *   };
 *
 *   return <button onClick={handleClick}>Do Something</button>;
 * }
 *
 * @example
 * // Track error state locally
 * function MyComponent() {
 *   const { error, hasError, resetError, showBoundary } = useErrorBoundary();
 *
 *   if (hasError) {
 *     return (
 *       <div>
 *         <p>Error: {error?.message}</p>
 *         <button onClick={resetError}>Try Again</button>
 *       </div>
 *     );
 *   }
 *
 *   return <NormalUI />;
 * }
 */
export function useErrorBoundary(): UseErrorBoundaryReturn {
  const [error, setError] = useState<Error | null>(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const showBoundary = useCallback((err: Error) => {
    setError(err);
    // Re-throw to be caught by the nearest ErrorBoundary
    // This is wrapped in a setTimeout to ensure React's error boundary
    // mechanism catches it properly
    throw err;
  }, []);

  return {
    error,
    hasError: error !== null,
    resetError,
    showBoundary,
  };
}

/**
 * A simpler version that doesn't throw but just tracks error state.
 * Useful for handling errors within the component without triggering
 * an error boundary.
 *
 * @example
 * function MyComponent() {
 *   const { error, setError, clearError } = useErrorState();
 *
 *   const fetchData = async () => {
 *     try {
 *       clearError();
 *       await loadData();
 *     } catch (e) {
 *       setError(e instanceof Error ? e : new Error(String(e)));
 *     }
 *   };
 *
 *   if (error) {
 *     return <ErrorDisplay error={error} onRetry={fetchData} />;
 *   }
 *
 *   return <DataDisplay />;
 * }
 */
export function useErrorState() {
  const [error, setError] = useState<Error | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err : new Error(String(err)));
  }, []);

  return {
    error,
    hasError: error !== null,
    setError: handleError,
    clearError,
  };
}

export default useErrorBoundary;
