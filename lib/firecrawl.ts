// ============================================
// Firecrawl API Wrapper
// Web scraping service for company website analysis
// ============================================

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1";

interface FirecrawlMapResult {
  success: boolean;
  links: string[];
  error?: string;
}

interface FirecrawlScrapeResult {
  success: boolean;
  data?: {
    markdown: string;
    content: string;
    metadata: {
      title?: string;
      description?: string;
      language?: string;
      ogUrl?: string;
      ogImage?: string;
      sourceURL: string;
    };
  };
  error?: string;
}

interface FirecrawlCrawlResult {
  success: boolean;
  data?: Array<{
    markdown: string;
    content: string;
    metadata: {
      title?: string;
      description?: string;
      sourceURL: string;
    };
  }>;
  error?: string;
}

/**
 * Get Firecrawl API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY environment variable is not set");
  }
  return apiKey;
}

/**
 * Make authenticated request to Firecrawl API
 */
async function firecrawlRequest<T>(
  endpoint: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>
): Promise<T> {
  const apiKey = getApiKey();

  const response = await fetch(`${FIRECRAWL_API_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ============================================
// Map Website
// Discovers URLs on a website for later scraping
// ============================================

/**
 * Map a website to discover all accessible URLs
 * Returns a list of URLs that can be scraped
 */
export async function firecrawlMap(
  website: string,
  options: {
    limit?: number;
    search?: string;
    includeSubdomains?: boolean;
  } = {}
): Promise<FirecrawlMapResult> {
  try {
    const normalizedUrl = normalizeUrl(website);

    console.log(`[Firecrawl] Mapping website: ${normalizedUrl}`);

    const result = await firecrawlRequest<{
      success: boolean;
      links?: string[];
      error?: string;
    }>("/map", "POST", {
      url: normalizedUrl,
      limit: options.limit || 100,
      search: options.search,
      includeSubdomains: options.includeSubdomains ?? false,
    });

    if (!result.success) {
      return {
        success: false,
        links: [],
        error: result.error || "Map failed",
      };
    }

    console.log(`[Firecrawl] Found ${result.links?.length || 0} URLs on ${normalizedUrl}`);

    return {
      success: true,
      links: result.links || [],
    };
  } catch (error) {
    console.error("[Firecrawl] Map error:", error);
    return {
      success: false,
      links: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Scrape Single Page
// Extracts content from a specific URL
// ============================================

/**
 * Scrape a single page and extract markdown content
 */
export async function firecrawlScrape(
  url: string,
  options: {
    formats?: Array<"markdown" | "html" | "rawHtml" | "content" | "links" | "screenshot" | "screenshot@fullPage">;
    onlyMainContent?: boolean;
    waitFor?: number;
    timeout?: number;
  } = {}
): Promise<FirecrawlScrapeResult> {
  try {
    const normalizedUrl = normalizeUrl(url);

    console.log(`[Firecrawl] Scraping page: ${normalizedUrl}`);

    const result = await firecrawlRequest<{
      success: boolean;
      data?: FirecrawlScrapeResult["data"];
      error?: string;
    }>("/scrape", "POST", {
      url: normalizedUrl,
      formats: options.formats || ["markdown"],
      onlyMainContent: options.onlyMainContent ?? true,
      waitFor: options.waitFor,
      timeout: options.timeout || 30000,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Scrape failed",
      };
    }

    console.log(`[Firecrawl] Successfully scraped ${normalizedUrl}`);

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error("[Firecrawl] Scrape error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Crawl Website
// Crawls multiple pages from a starting URL
// ============================================

/**
 * Crawl a website starting from the given URL
 * Returns content from multiple pages
 */
export async function firecrawlCrawl(
  url: string,
  options: {
    limit?: number;
    maxDepth?: number;
    includePaths?: string[];
    excludePaths?: string[];
    allowBackwardLinks?: boolean;
  } = {}
): Promise<FirecrawlCrawlResult> {
  try {
    const normalizedUrl = normalizeUrl(url);

    console.log(`[Firecrawl] Starting crawl from: ${normalizedUrl}`);

    // Start crawl (async)
    const startResult = await firecrawlRequest<{
      success: boolean;
      id?: string;
      error?: string;
    }>("/crawl", "POST", {
      url: normalizedUrl,
      limit: options.limit || 10,
      maxDepth: options.maxDepth || 2,
      includePaths: options.includePaths,
      excludePaths: options.excludePaths,
      allowBackwardLinks: options.allowBackwardLinks ?? false,
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
      },
    });

    if (!startResult.success || !startResult.id) {
      return {
        success: false,
        error: startResult.error || "Crawl start failed",
      };
    }

    // Poll for completion
    const crawlId = startResult.id;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5s intervals)

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;

      const statusResult = await firecrawlRequest<{
        status: "scraping" | "completed" | "failed";
        completed?: number;
        total?: number;
        data?: FirecrawlCrawlResult["data"];
        error?: string;
      }>(`/crawl/${crawlId}`, "GET");

      console.log(`[Firecrawl] Crawl status: ${statusResult.status} (${statusResult.completed || 0}/${statusResult.total || 0})`);

      if (statusResult.status === "completed") {
        console.log(`[Firecrawl] Crawl completed: ${statusResult.data?.length || 0} pages`);
        return {
          success: true,
          data: statusResult.data || [],
        };
      }

      if (statusResult.status === "failed") {
        return {
          success: false,
          error: statusResult.error || "Crawl failed",
        };
      }
    }

    return {
      success: false,
      error: "Crawl timed out",
    };
  } catch (error) {
    console.error("[Firecrawl] Crawl error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Utilities
// ============================================

/**
 * Normalize URL to ensure proper format
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim();

  // Add https:// if no protocol specified
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = `https://${normalized}`;
  }

  // Remove trailing slash
  normalized = normalized.replace(/\/+$/, "");

  return normalized;
}

/**
 * Select the best page URL for ICP analysis
 * Prioritizes about, product, and solution pages
 */
export function selectBestPageForICP(urls: string[], _companyName?: string): string | null {
  if (!urls.length) return null;

  // Priority order for ICP-relevant pages
  const priorityPatterns = [
    /\/about\/?$/i,
    /\/about[-_]?us\/?$/i,
    /\/company\/?$/i,
    /\/who[-_]?we[-_]?are\/?$/i,
    /\/product[s]?\/?$/i,
    /\/solution[s]?\/?$/i,
    /\/service[s]?\/?$/i,
    /\/platform\/?$/i,
    /\/pricing\/?$/i,
    /\/customer[s]?\/?$/i,
    /\/case[-_]?stud(y|ies)\/?$/i,
    /\/use[-_]?cases?\/?$/i,
    /\/industry\/?$/i,
    /\/industries\/?$/i,
  ];

  // Try each priority pattern
  for (const pattern of priorityPatterns) {
    const match = urls.find((url) => pattern.test(url));
    if (match) {
      console.log(`[Firecrawl] Selected page for ICP: ${match}`);
      return match;
    }
  }

  // Fall back to homepage if nothing else matches
  const homepageUrl = urls.find((url) => {
    try {
      const parsed = new URL(url);
      return parsed.pathname === "/" || parsed.pathname === "";
    } catch {
      return false;
    }
  });

  if (homepageUrl) {
    console.log(`[Firecrawl] Using homepage for ICP: ${homepageUrl}`);
    return homepageUrl;
  }

  // Last resort: first URL
  console.log(`[Firecrawl] Using first URL for ICP: ${urls[0]}`);
  return urls[0];
}

/**
 * Extract key pages for comprehensive ICP analysis
 * Returns multiple relevant URLs for thorough scraping
 */
export function selectPagesForICP(
  urls: string[],
  options: { maxPages?: number } = {}
): string[] {
  const maxPages = options.maxPages || 5;
  const selectedPages: string[] = [];
  const seen = new Set<string>();

  // Priority categories with patterns
  const categories: Array<{ name: string; patterns: RegExp[] }> = [
    {
      name: "about",
      patterns: [/\/about\/?$/i, /\/about[-_]?us\/?$/i, /\/company\/?$/i, /\/who[-_]?we[-_]?are\/?$/i],
    },
    {
      name: "products",
      patterns: [/\/product[s]?\/?$/i, /\/solution[s]?\/?$/i, /\/platform\/?$/i, /\/service[s]?\/?$/i],
    },
    {
      name: "pricing",
      patterns: [/\/pricing\/?$/i, /\/plans?\/?$/i],
    },
    {
      name: "customers",
      patterns: [/\/customer[s]?\/?$/i, /\/case[-_]?stud(y|ies)\/?$/i, /\/success[-_]?stories?\/?$/i],
    },
    {
      name: "industries",
      patterns: [/\/industr(y|ies)\/?$/i, /\/use[-_]?cases?\/?$/i, /\/sectors?\/?$/i],
    },
  ];

  // Select one URL per category
  for (const category of categories) {
    if (selectedPages.length >= maxPages) break;

    for (const pattern of category.patterns) {
      const match = urls.find((url) => pattern.test(url) && !seen.has(url));
      if (match) {
        selectedPages.push(match);
        seen.add(match);
        console.log(`[Firecrawl] Selected ${category.name} page: ${match}`);
        break;
      }
    }
  }

  // Add homepage if not at limit
  if (selectedPages.length < maxPages) {
    const homepageUrl = urls.find((url) => {
      try {
        const parsed = new URL(url);
        return (parsed.pathname === "/" || parsed.pathname === "") && !seen.has(url);
      } catch {
        return false;
      }
    });

    if (homepageUrl) {
      selectedPages.unshift(homepageUrl); // Add homepage first
      seen.add(homepageUrl);
    }
  }

  return selectedPages.slice(0, maxPages);
}
