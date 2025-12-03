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
 * Get transcripts with automatic caching
 * Fetches all transcripts without limit to ensure complete data for filtering
 */
export async function getTranscriptsWithCache(
  userId: string,
  supabase: SupabaseClient
): Promise<any[]> {
  const cacheKey = CACHE_KEYS.TRANSCRIPTS;
  const ttl = CACHE_TTL.TRANSCRIPTS;

  // Check if cache is valid
  if (isCacheValid(cacheKey, ttl, userId)) {
    const cached = getCachedData<any[]>(cacheKey, userId);
    if (cached) {
      return cached;
    }
  }

  // Fetch all transcripts from Supabase (no limit - need full data for filtering)
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transcripts:', error);
    // Return cached data even if expired as fallback
    return getCachedData<any[]>(cacheKey, userId) || [];
  }

  // Cache the results
  setCachedData(cacheKey, data || [], userId);
  return data || [];
}

/**
 * Get companies with automatic caching
 */
export async function getCompaniesWithCache(
  userId: string,
  supabase: SupabaseClient
): Promise<any[]> {
  const cacheKey = CACHE_KEYS.COMPANIES;
  const ttl = CACHE_TTL.COMPANIES;

  // Check if cache is valid
  if (isCacheValid(cacheKey, ttl, userId)) {
    const cached = getCachedData<any[]>(cacheKey, userId);
    if (cached) {
      return cached;
    }
  }

  // Fetch from Supabase
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching companies:', error);
    return getCachedData<any[]>(cacheKey, userId) || [];
  }

  // Cache the results
  setCachedData(cacheKey, data || [], userId);
  return data || [];
}

/**
 * Get user with automatic caching
 */
export async function getUserWithCache(
  userId: string,
  supabase: SupabaseClient
): Promise<any | null> {
  const cacheKey = CACHE_KEYS.USER;
  const ttl = CACHE_TTL.USER;

  // Check if cache is valid
  if (isCacheValid(cacheKey, ttl, userId)) {
    const cached = getCachedData<any>(cacheKey, userId);
    if (cached) {
      return cached;
    }
  }

  // Fetch from Supabase
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return getCachedData<any>(cacheKey, userId) || null;
  }

  // Cache the result
  setCachedData(cacheKey, data, userId);
  return data;
}

/**
 * Get team members with automatic caching
 */
export async function getTeamWithCache(
  userId: string,
  supabase: SupabaseClient
): Promise<any[]> {
  const cacheKey = CACHE_KEYS.TEAM;
  const ttl = CACHE_TTL.TEAM;

  // Check if cache is valid
  if (isCacheValid(cacheKey, ttl, userId)) {
    const cached = getCachedData<any[]>(cacheKey, userId);
    if (cached) {
      return cached;
    }
  }

  // Fetch from Supabase
  const { data, error } = await supabase
    .from('team_members')
    .select('*, users(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching team:', error);
    return getCachedData<any[]>(cacheKey, userId) || [];
  }

  // Cache the results
  setCachedData(cacheKey, data || [], userId);
  return data || [];
}

/**
 * Get calls with automatic caching
 */
export async function getCallsWithCache(
  userId: string,
  supabase: SupabaseClient
): Promise<any[]> {
  const cacheKey = CACHE_KEYS.CALLS;
  const ttl = CACHE_TTL.CALLS;

  // Check if cache is valid
  if (isCacheValid(cacheKey, ttl, userId)) {
    const cached = getCachedData<any[]>(cacheKey, userId);
    if (cached) {
      return cached;
    }
  }

  // Fetch from Supabase
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50); // Initial limit

  if (error) {
    console.error('Error fetching calls:', error);
    return getCachedData<any[]>(cacheKey, userId) || [];
  }

  // Cache the results
  setCachedData(cacheKey, data || [], userId);
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
 * Preload cache with data (useful for initial page load)
 */
export async function preloadCache(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  try {
    // Preload critical data in parallel
    await Promise.allSettled([
      getTranscriptsWithCache(userId, supabase),
      getCompaniesWithCache(userId, supabase),
      getUserWithCache(userId, supabase),
      getTeamWithCache(userId, supabase),
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
 * Get authenticated user ID from stored token
 */
export function getUserIdFromCache(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const tokenStr = localStorage.getItem('sb-rpowalzrbddorfnnmccp-auth-token');
    if (!tokenStr) return null;

    const parsed = JSON.parse(tokenStr);
    return parsed?.user?.id ?? null;
  } catch (error) {
    console.error('Failed to get user ID from cache:', error);
    return null;
  }
}

// Auto-cleanup expired caches every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    clearExpiredCaches();
  }, 5 * 60 * 1000);
}
