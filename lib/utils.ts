import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * List of all localStorage keys used by the app
 * Add new keys here when you create new localStorage items
 */
export const APP_STORAGE_KEYS = [
  // Auth
  "sb-rpowalzrbddorfnnmccp-auth-token",

  // User & Company cache
  "cachedUser",
  "cachedCompany",

  // Onboarding
  "onboarding_signup",
  "onboarding_current_step",
  "onboarding_company_info",
  "onboarding_fireflies_connected",

  // Business profile
  "levell_business_profile",
  "webhook_markdown",
  "company_json_data",

  // Transcripts
  "transcripts-cache",
] as const;

/**
 * Clear all app-related localStorage items
 * Call this on logout to ensure clean state
 */
export function clearAppStorage(): void {
  if (typeof window === "undefined") return;

  APP_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove localStorage key: ${key}`, error);
    }
  });

  // Also clear any keys that might have been added dynamically
  // that start with common prefixes
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith("sb-") ||
      key.startsWith("onboarding_") ||
      key.startsWith("levell_") ||
      key.startsWith("cached")
    )) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove localStorage key: ${key}`, error);
    }
  });
}

/**
 * Check if user has valid auth in localStorage
 */
export function hasAuthToken(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("sb-rpowalzrbddorfnnmccp-auth-token");
}
