import { SupabaseClient } from '@supabase/supabase-js';

// Cache configuration
export const CACHE_KEYS = {
  TRANSCRIPTS: 'transcripts-cache',
  COMPANIES: 'companies-cache',
  TEAM: 'team-cache',
  USER: 'user-cache',
  CALLS: 'calls-cache',
} as const;

export const CACHE_TTL = {
  TRANSCRIPTS: 5 * 60 * 1000, // 5 minutes
  COMPANIES: 10 * 60 * 1000, // 10 minutes
  TEAM: 15 * 60 * 1000, // 15 minutes
  USER: 30 * 60 * 1000, // 30 minutes
  CALLS: 5 * 60 * 1000, // 5 minutes
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  userId?: string;
}

// In-memory fallback cache when localStorage is unavailable
const memoryCache = new Map<string, CacheEntry<any>>();

// Background refresh timers
const refreshTimers = new Map<string, NodeJS.Timeout>();

/**
 * Generate a cache key with optional user scoping
 */
function generateCacheKey(key: string, userId?: string): string {
  return userId ? `${key}-${userId}` : key;
}

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cached data from localStorage or memory fallback
 */
export function getCachedData<T>(key: string, userId?: string): T | null {
  const cacheKey = generateCacheKey(key, userId);

  try {
    // Try localStorage first
    if (isLocalStorageAvailable()) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const entry: CacheEntry<T> = JSON.parse(cached);
        return entry.data;
      }
    }

    // Fallback to memory cache
    const memCached = memoryCache.get(cacheKey);
    if (memCached) {
      return memCached.data as T;
    }
  } catch (error) {
    console.error(`Error reading cache for key ${cacheKey}:`, error);
  }

  return null;
}

/**
 * Set cached data in localStorage or memory fallback
 */
export function setCachedData<T>(key: string, data: T, userId?: string): void {
  const cacheKey = generateCacheKey(key, userId);
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    userId,
  };

  try {
    // Try localStorage first
    if (isLocalStorageAvailable()) {
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    }

    // Always update memory cache as backup
    memoryCache.set(cacheKey, entry);
  } catch (error) {
    console.error(`Error setting cache for key ${cacheKey}:`, error);
    // Ensure memory cache is updated even if localStorage fails
    memoryCache.set(cacheKey, entry);
  }
}

/**
 * Check if cache is still valid based on TTL
 */
export function isCacheValid(key: string, ttl: number, userId?: string): boolean {
  const cacheKey = generateCacheKey(key, userId);

  try {
    // Check localStorage first
    if (isLocalStorageAvailable()) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const entry: CacheEntry<any> = JSON.parse(cached);
        return Date.now() - entry.timestamp < ttl;
      }
    }

    // Check memory cache
    const memCached = memoryCache.get(cacheKey);
    if (memCached) {
      return Date.now() - memCached.timestamp < ttl;
    }
  } catch (error) {
    console.error(`Error checking cache validity for key ${cacheKey}:`, error);
  }

  return false;
}

/**
 * Invalidate a specific cache entry
 */
export function invalidateCache(key: string, userId?: string): void {
  const cacheKey = generateCacheKey(key, userId);

  try {
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(cacheKey);
    }
    memoryCache.delete(cacheKey);

    // Clear any background refresh timer
    const timer = refreshTimers.get(cacheKey);
    if (timer) {
      clearInterval(timer);
      refreshTimers.delete(cacheKey);
    }
  } catch (error) {
    console.error(`Error invalidating cache for key ${cacheKey}:`, error);
  }
}

/**
 * Invalidate all caches
 */
export function invalidateAllCaches(): void {
  try {
    if (isLocalStorageAvailable()) {
      // Remove all cache keys
      Object.values(CACHE_KEYS).forEach((key) => {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const storageKey = localStorage.key(i);
          if (storageKey?.startsWith(key)) {
            keysToRemove.push(storageKey);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      });
    }

    // Clear memory cache
    memoryCache.clear();

    // Clear all refresh timers
    refreshTimers.forEach((timer) => clearInterval(timer));
    refreshTimers.clear();
  } catch (error) {
    console.error('Error invalidating all caches:', error);
  }
}

/**
 * Paginated transcripts result type
 */
export interface PaginatedTranscriptsResult {
  data: any[];
  totalCount: number;
  hasMore: boolean;
  fromCache: boolean;
}

/**
 * Progressive cache structure for transcripts
 */
interface TranscriptPageCache {
  pages: Record<number, any[]>;
  totalCount: number;
  pageSize: number;
  timestamp: number;
  filters: string; // JSON string of filters to invalidate on filter change
}

const TRANSCRIPT_PAGE_CACHE_KEY = 'transcript-pages-cache';
const TRANSCRIPT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached transcript page from localStorage
 */
function getTranscriptPageCache(userId: string, filters: string): TranscriptPageCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(`${TRANSCRIPT_PAGE_CACHE_KEY}-${userId}`);
    if (!cached) return null;

    const cache: TranscriptPageCache = JSON.parse(cached);

    // Check if cache is expired
    if (Date.now() - cache.timestamp > TRANSCRIPT_CACHE_TTL) {
      localStorage.removeItem(`${TRANSCRIPT_PAGE_CACHE_KEY}-${userId}`);
      return null;
    }

    // Check if filters changed - invalidate cache
    if (cache.filters !== filters) {
      localStorage.removeItem(`${TRANSCRIPT_PAGE_CACHE_KEY}-${userId}`);
      return null;
    }

    return cache;
  } catch {
    return null;
  }
}

/**
 * Save transcript page metadata to localStorage cache
 * NOTE: Only saves totalCount and pageSize, NOT the full page data
 * to avoid localStorage quota issues
 */
function saveTranscriptPageCache(
  userId: string,
  page: number,
  data: any[],
  totalCount: number,
  pageSize: number,
  filters: string
): void {
  if (typeof window === 'undefined') return;
  try {
    // Only cache metadata, not full transcript data to avoid quota issues
    const cache: TranscriptPageCache = {
      pages: {}, // Don't cache full page data
      totalCount,
      pageSize,
      timestamp: Date.now(),
      filters,
    };

    localStorage.setItem(`${TRANSCRIPT_PAGE_CACHE_KEY}-${userId}`, JSON.stringify(cache));
  } catch (error) {
    console.error('Error saving transcript page cache:', error);
  }
}

/**
 * Transcript filter options for server-side filtering
 */
export interface TranscriptFilters {
  search?: string;
  scoreMin?: number;
  scoreMax?: number;
  durationMin?: number;
  durationMax?: number;
  onlyScoredCalls?: boolean;
}

/**
 * Get transcripts with server-side pagination
 * Always fetches live data to avoid localStorage quota issues
 */
export async function getTranscriptsPaginated(
  userId: string,
  supabase: SupabaseClient,
  page: number = 1,
  pageSize: number = 10,
  search?: string,
  scoreMin?: number,
  scoreMax?: number,
  filters?: TranscriptFilters
): Promise<PaginatedTranscriptsResult> {
  const offset = (page - 1) * pageSize;

  // Get duration filter - use filters object if provided, otherwise default to 5 min
  const durationMin = filters?.durationMin ?? 5;
  const durationMax = filters?.durationMax;
  const onlyScoredCalls = filters?.onlyScoredCalls ?? false;

  // Build the query - fetch only the current page's batch
  let query = supabase
    .from('transcripts')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .not('duration', 'is', null)
    .order('created_at', { ascending: false });

  // Apply duration min filter
  if (durationMin > 0) {
    query = query.gte('duration', durationMin);
  }

  // Apply duration max filter if provided
  if (durationMax && durationMax > 0) {
    query = query.lte('duration', durationMax);
  }

  // Apply only scored calls filter
  if (onlyScoredCalls) {
    query = query.not('ai_overall_score', 'is', null);
  }

  // Apply search filter if provided
  if (search && search.trim()) {
    query = query.ilike('title', `%${search.trim()}%`);
  }

  // Apply score filters if provided
  if (scoreMin !== undefined && scoreMin > 0) {
    query = query.gte('ai_overall_score', scoreMin);
  }
  if (scoreMax !== undefined && scoreMax < 100) {
    query = query.lte('ai_overall_score', scoreMax);
  }

  // Apply pagination - fetch ONLY this page's batch
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching paginated transcripts:', error);
    return { data: [], totalCount: 0, hasMore: false, fromCache: false };
  }

  const totalCount = count || 0;
  const hasMore = offset + pageSize < totalCount;

  return {
    data: data || [],
    totalCount,
    hasMore,
    fromCache: false,
  };
}

/**
 * Clear transcript page cache for a user
 */
export function clearTranscriptPageCache(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${TRANSCRIPT_PAGE_CACHE_KEY}-${userId}`);
  } catch {
    // Ignore errors
  }
}

/**
 * Get transcripts - fetches live to avoid localStorage quota issues
 * NOTE: Prefer using getTranscriptsPaginated for better performance
 * @deprecated Use getTranscriptsPaginated instead for paginated views
 */
export async function getTranscriptsWithCache(
  userId: string,
  supabase: SupabaseClient
): Promise<any[]> {
  // Fetch all transcripts from Supabase (no caching to avoid quota issues)
  // Filter out calls with null duration or duration < 5 minutes
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('user_id', userId)
    .not('duration', 'is', null)
    .gte('duration', 5)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transcripts:', error);
    return [];
  }

  // Don't cache full transcript data - causes localStorage quota issues
  return data || [];
}

/**
 * Paginated companies result type
 */
export interface PaginatedCompaniesResult {
  data: any[];
  totalCount: number;
  hasMore: boolean;
  fromCache: boolean;
}

/**
 * Progressive cache structure for companies
 */
interface CompanyPageCache {
  pages: Record<number, any[]>;
  totalCount: number;
  pageSize: number;
  timestamp: number;
  filters: string;
}

const COMPANY_PAGE_CACHE_KEY = 'company-pages-cache';
const COMPANY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached company page from localStorage
 */
function getCompanyPageCache(companyId: string, filters: string): CompanyPageCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(`${COMPANY_PAGE_CACHE_KEY}-${companyId}`);
    if (!cached) return null;

    const cache: CompanyPageCache = JSON.parse(cached);

    // Check if cache is expired
    if (Date.now() - cache.timestamp > COMPANY_CACHE_TTL) {
      localStorage.removeItem(`${COMPANY_PAGE_CACHE_KEY}-${companyId}`);
      return null;
    }

    // Check if filters changed - invalidate cache
    if (cache.filters !== filters) {
      localStorage.removeItem(`${COMPANY_PAGE_CACHE_KEY}-${companyId}`);
      return null;
    }

    return cache;
  } catch {
    return null;
  }
}

/**
 * Save company page metadata to localStorage cache
 * NOTE: Only saves totalCount and pageSize, NOT the full page data
 * to avoid localStorage quota issues
 */
function saveCompanyPageCache(
  companyId: string,
  page: number,
  data: any[],
  totalCount: number,
  pageSize: number,
  filters: string
): void {
  if (typeof window === 'undefined') return;
  try {
    // Only cache metadata, not full company data to avoid quota issues
    const cache: CompanyPageCache = {
      pages: {}, // Don't cache full page data
      totalCount,
      pageSize,
      timestamp: Date.now(),
      filters,
    };

    localStorage.setItem(`${COMPANY_PAGE_CACHE_KEY}-${companyId}`, JSON.stringify(cache));
  } catch (error) {
    console.error('Error saving company page cache:', error);
  }
}

/**
 * Get companies with server-side pagination
 * Always fetches live data to avoid localStorage quota issues
 */
export async function getCompaniesPaginated(
  companyId: string,
  supabase: SupabaseClient,
  page: number = 1,
  pageSize: number = 10,
  search?: string
): Promise<PaginatedCompaniesResult> {
  const offset = (page - 1) * pageSize;

  // Build the query - fetch only the current page's batch
  let query = supabase
    .from('companies')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .order('company_name', { ascending: true });

  // Apply search filter if provided
  if (search && search.trim()) {
    query = query.ilike('company_name', `%${search.trim()}%`);
  }

  // Apply pagination - fetch ONLY this page's batch
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching paginated companies:', error);
    return { data: [], totalCount: 0, hasMore: false, fromCache: false };
  }

  const totalCount = count || 0;
  const hasMore = offset + pageSize < totalCount;

  return {
    data: data || [],
    totalCount,
    hasMore,
    fromCache: false,
  };
}

/**
 * Clear company page cache
 */
export function clearCompanyPageCache(companyId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${COMPANY_PAGE_CACHE_KEY}-${companyId}`);
  } catch {
    // Ignore errors
  }
}

/**
 * Get companies - fetches live to avoid localStorage quota issues
 * NOTE: Prefer using getCompaniesPaginated for better performance
 * @deprecated Use getCompaniesPaginated instead for paginated views
 */
export async function getCompaniesWithCache(
  userId: string,
  supabase: SupabaseClient
): Promise<any[]> {
  // Fetch from Supabase (no caching to avoid quota issues)
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching companies:', error);
    return [];
  }

  // Don't cache full company data - causes localStorage quota issues
  return data || [];
}

/**
 * Get user - fetches live to avoid localStorage quota issues
 */
export async function getUserWithCache(
  userId: string,
  supabase: SupabaseClient
): Promise<any | null> {
  // Fetch from Supabase (no caching to avoid quota issues)
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }

  // Don't cache user data - fetches live per user request
  return data;
}

/**
 * Get team members - fetches live to avoid localStorage quota issues
 */
export async function getTeamWithCache(
  userId: string,
  supabase: SupabaseClient
): Promise<any[]> {
  // Fetch from Supabase (no caching to avoid quota issues)
  const { data, error } = await supabase
    .from('team_members')
    .select('*, users(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching team:', error);
    return [];
  }

  // Don't cache team data - fetches live per user request
  return data || [];
}

/**
 * Get calls - fetches live to avoid localStorage quota issues
 */
export async function getCallsWithCache(
  userId: string,
  supabase: SupabaseClient
): Promise<any[]> {
  // Fetch from Supabase (no caching to avoid quota issues)
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50); // Initial limit

  if (error) {
    console.error('Error fetching calls:', error);
    return [];
  }

  // Don't cache calls data - fetches live per user request
  return data || [];
}

/**
 * Schedule background refresh for a cache entry
 */
export function scheduleBackgroundRefresh(
  key: string,
  refreshFn: () => Promise<void>,
  interval: number,
  userId?: string
): void {
  const cacheKey = generateCacheKey(key, userId);

  // Clear existing timer if any
  const existingTimer = refreshTimers.get(cacheKey);
  if (existingTimer) {
    clearInterval(existingTimer);
  }

  // Set up new timer
  const timer = setInterval(async () => {
    try {
      await refreshFn();
    } catch (error) {
      console.error(`Background refresh failed for ${cacheKey}:`, error);
    }
  }, interval);

  refreshTimers.set(cacheKey, timer);
}

/**
 * Preload cache with minimal data (useful for initial page load)
 * Only preloads counts/stats, not full data to avoid quota issues
 */
export async function preloadCache(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  try {
    // Only preload stats (counts), not full data
    await Promise.allSettled([
      getTranscriptStats(userId, supabase),
    ]);
  } catch (error) {
    console.error('Error preloading cache:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalEntries: number;
  cacheKeys: string[];
  memoryCacheSize: number;
} {
  const cacheKeys: string[] = [];

  if (isLocalStorageAvailable()) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && Object.values(CACHE_KEYS).some((ck) => key.startsWith(ck))) {
        cacheKeys.push(key);
      }
    }
  }

  return {
    totalEntries: cacheKeys.length,
    cacheKeys,
    memoryCacheSize: memoryCache.size,
  };
}

/**
 * Clear expired caches
 */
export function clearExpiredCaches(): void {
  try {
    if (isLocalStorageAvailable()) {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // Check if it's a cache key
        const cacheType = Object.entries(CACHE_KEYS).find(([_, value]) =>
          key.startsWith(value)
        );

        if (cacheType) {
          const [type, _] = cacheType;
          const ttl = CACHE_TTL[type as keyof typeof CACHE_TTL];

          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const entry: CacheEntry<any> = JSON.parse(cached);
              if (Date.now() - entry.timestamp >= ttl) {
                keysToRemove.push(key);
              }
            }
          } catch (error) {
            // Invalid cache entry, remove it
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }

    // Clear expired memory cache entries
    const now = Date.now();
    memoryCache.forEach((entry, key) => {
      const cacheType = Object.entries(CACHE_KEYS).find(([_, value]) =>
        key.startsWith(value)
      );

      if (cacheType) {
        const [type, _] = cacheType;
        const ttl = CACHE_TTL[type as keyof typeof CACHE_TTL];

        if (now - entry.timestamp >= ttl) {
          memoryCache.delete(key);
        }
      }
    });
  } catch (error) {
    console.error('Error clearing expired caches:', error);
  }
}

/**
 * Transcript stats result type
 */
export interface TranscriptStats {
  totalCount: number;
  scoredCount: number;
  avgScore: number;
  isScoring: boolean;
}

/**
 * Get transcript stats (count, scored count, avg score) without fetching all records
 * Uses Supabase aggregate queries for efficiency
 */
export async function getTranscriptStats(
  userId: string,
  supabase: SupabaseClient
): Promise<TranscriptStats> {
  try {
    // Get total count (filter out calls with null duration or duration < 5 minutes)
    const { count: totalCount, error: countError } = await supabase
      .from('transcripts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('duration', 'is', null)
      .gte('duration', 5);

    if (countError) throw countError;

    // Get scored transcripts count and sum for average (with duration filter)
    const { data: scoredData, error: scoredError } = await supabase
      .from('transcripts')
      .select('ai_overall_score')
      .eq('user_id', userId)
      .not('ai_overall_score', 'is', null)
      .not('duration', 'is', null)
      .gte('duration', 5);

    if (scoredError) throw scoredError;

    const scoredCount = scoredData?.length || 0;
    let avgScore = 0;

    if (scoredCount > 0) {
      const sum = scoredData.reduce((acc, t) => acc + Number(t.ai_overall_score), 0);
      avgScore = Math.round(sum / scoredCount);
    }

    const total = totalCount || 0;
    const isScoring = total > scoredCount;

    return {
      totalCount: total,
      scoredCount,
      avgScore,
      isScoring,
    };
  } catch (error) {
    console.error('Error fetching transcript stats:', error);
    return { totalCount: 0, scoredCount: 0, avgScore: 0, isScoring: false };
  }
}

/**
 * Get recent scored transcripts for chart (limited to maxDays)
 * Only fetches scored transcripts with dates, ordered by date
 */
export async function getRecentScoredTranscripts(
  userId: string,
  supabase: SupabaseClient,
  maxDays: number = 90
): Promise<Array<{ date: string; score: number }>> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxDays);

    // Filter out calls with null duration or duration < 5 minutes
    const { data, error } = await supabase
      .from('transcripts')
      .select('created_at, ai_overall_score')
      .eq('user_id', userId)
      .not('ai_overall_score', 'is', null)
      .not('duration', 'is', null)
      .gte('duration', 5)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) return [];

    // Group by date and calculate average score per day
    const groupedByDate = data.reduce((acc, item) => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(Number(item.ai_overall_score));
      return acc;
    }, {} as Record<string, number[]>);

    return Object.entries(groupedByDate).map(([date, scores]) => ({
      date,
      score: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    }));
  } catch (error) {
    console.error('Error fetching recent scored transcripts:', error);
    return [];
  }
}

/**
 * Company stats interface
 */
export interface CompanyStats {
  totalCompanies: number;
  totalCalls: number;
  avgScore: number;
  atRiskCount: number;
}

/**
 * Get aggregate company stats from server
 * Fetches totals across ALL companies, not just current page
 */
export async function getCompanyStats(
  companyId: string,
  supabase: SupabaseClient
): Promise<CompanyStats> {
  try {
    // Get total companies count
    const { count: totalCompanies, error: companyError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    if (companyError) throw companyError;

    // Get all company IDs for this user's company
    const { data: companyIds, error: idsError } = await supabase
      .from('companies')
      .select('id')
      .eq('company_id', companyId);

    if (idsError) throw idsError;

    const ids = companyIds?.map((c) => c.id) || [];

    if (ids.length === 0) {
      return { totalCompanies: 0, totalCalls: 0, avgScore: 0, atRiskCount: 0 };
    }

    // Get total calls count
    const { count: totalCalls, error: callsError } = await supabase
      .from('company_calls')
      .select('*', { count: 'exact', head: true })
      .in('company_id', ids);

    if (callsError) throw callsError;

    // Get calls with scores for average calculation
    const { data: callsWithScores, error: scoresError } = await supabase
      .from('company_calls')
      .select('transcript_id')
      .in('company_id', ids);

    if (scoresError) throw scoresError;

    const transcriptIds = callsWithScores?.map((c) => c.transcript_id).filter(Boolean) || [];

    let avgScore = 0;
    if (transcriptIds.length > 0) {
      const { data: transcripts, error: transcriptError } = await supabase
        .from('transcripts')
        .select('ai_overall_score')
        .in('id', transcriptIds)
        .not('ai_overall_score', 'is', null);

      if (!transcriptError && transcripts && transcripts.length > 0) {
        const sum = transcripts.reduce((acc, t) => acc + Number(t.ai_overall_score), 0);
        avgScore = Math.round(sum / transcripts.length);
      }
    }

    // Count companies with 0 calls (at risk)
    const { data: callCounts, error: countError } = await supabase
      .from('company_calls')
      .select('company_id')
      .in('company_id', ids);

    if (countError) throw countError;

    const companiesWithCalls = new Set(callCounts?.map((c) => c.company_id) || []);
    const atRiskCount = ids.length - companiesWithCalls.size;

    return {
      totalCompanies: totalCompanies || 0,
      totalCalls: totalCalls || 0,
      avgScore,
      atRiskCount,
    };
  } catch (error) {
    console.error('Error fetching company stats:', error);
    return { totalCompanies: 0, totalCalls: 0, avgScore: 0, atRiskCount: 0 };
  }
}

/**
 * Get authenticated user ID from stored token
 */
export function getUserIdFromCache(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const tokenStr = localStorage.getItem('sb-tuzuwzglmyajuxytaowi-auth-token');
    if (!tokenStr) return null;

    const parsed = JSON.parse(tokenStr);
    return parsed?.user?.id ?? null;
  } catch (error) {
    console.error('Failed to get user ID from cache:', error);
    return null;
  }
}

/**
 * Clear the old transcript-storage Zustand persisted store
 * This removes the old full transcript data that was cached before pagination
 */
export function clearOldTranscriptStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    const oldStorage = localStorage.getItem('transcript-storage');
    if (oldStorage) {
      const parsed = JSON.parse(oldStorage);
      // If the old storage has more than 50 transcripts, clear it
      // This indicates it was from before pagination was implemented
      if (parsed?.state?.transcripts?.length > 50) {
        localStorage.removeItem('transcript-storage');
        console.log('Cleared old transcript storage with', parsed.state.transcripts.length, 'records');
      }
    }
  } catch (error) {
    // If parsing fails, just remove the corrupted storage
    localStorage.removeItem('transcript-storage');
  }
}

// Auto-cleanup expired caches every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    clearExpiredCaches();
  }, 5 * 60 * 1000);

  // Clear old transcript storage on initial load
  clearOldTranscriptStorage();
}
