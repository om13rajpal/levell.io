/**
 * Utility functions for parsing and formatting agent output
 */

/**
 * Parse JSON from code blocks (```json ... ```)
 * Returns the parsed object, or the original string if it can't be parsed
 */
export function parseJsonOutput(output: string | null): any | null {
  if (!output) return null;

  try {
    // First try to parse directly
    return JSON.parse(output);
  } catch {
    // Try to extract JSON from code blocks
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e) {
        console.error("Failed to parse JSON from code block:", e);
        // Return original string for fallback rendering
        return output;
      }
    }

    // Try to extract any JSON object
    const objectMatch = output.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (e) {
        console.error("Failed to parse JSON object:", e);
        // Return original string for fallback rendering
        return output;
      }
    }

    // If we can't parse, return the original string for fallback rendering
    return output;
  }
}

/**
 * Check if output is valid JSON
 */
export function isValidJson(output: string | null): boolean {
  return parseJsonOutput(output) !== null;
}

/**
 * Format cost in USD
 */
export function formatCost(cost: string | number | null): string {
  if (cost === null || cost === undefined) return "$0.0000";
  const numericCost = typeof cost === "string" ? parseFloat(cost) : cost;
  if (isNaN(numericCost)) return "$0.0000";
  return `$${numericCost.toFixed(4)}`;
}

/**
 * Format token count
 */
export function formatTokens(tokens: number | null): string {
  if (tokens === null || tokens === undefined) return "0";
  return tokens.toLocaleString();
}

/**
 * Format duration in milliseconds
 */
export function formatDuration(ms: number | null): string {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Get status color variant
 */
export function getStatusVariant(status: string): "default" | "destructive" | "secondary" {
  switch (status) {
    case "completed":
      return "default";
    case "error":
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
}
