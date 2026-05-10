/**
 * Secure Cache Manager
 * Provides encrypted local caching with automatic invalidation and context-aware storage
 * - IndexedDB for large datasets (preferred)
 * - localStorage for fallback
 * - Memory cache for session data
 * - Automatic cache invalidation on mutations
 * - Context-aware caching (institute/class/subject specific)
 *
 * 🔧 ENV FLAG: VITE_ENABLE_CACHE
 *   'true'  → caching active (IndexedDB / localStorage)
 *   'false' (or unset) → all cache operations are no-ops; every request goes to the backend
 */

/** Single source of truth — read once at module load time */
const CACHE_ENABLED = import.meta.env.VITE_ENABLE_CACHE === 'true';
if (!CACHE_ENABLED) {
  console.info('🚫 SecureCache: caching DISABLED (VITE_ENABLE_CACHE != true) — all requests bypass cache');
}

interface SecureCacheEntry<T = any> {
  data: T;
  timestamp: number;
  key: string;
  context?: CacheContext;
  hash?: string; // For data integrity
}

interface CacheContext {
  userId?: string;
  instituteId?: string;
  classId?: string;
  subjectId?: string;
  role?: string;
}

interface SecureCacheOptions {
  ttl?: number; // Time to live in minutes
  forceRefresh?: boolean;
  context?: CacheContext;
  encrypt?: boolean; // Future: Add encryption
}

type CacheInvalidationPattern = {
  pattern: string;
  affectedEndpoints: string[];
};

class SecureCacheManager {
  private static instance: SecureCacheManager;
  private readonly DEFAULT_TTL = 30; // 30 minutes
  private readonly CACHE_PREFIX = 'secure_cache_';
  private readonly DB_NAME = 'SecureCacheDB';
  private readonly DB_VERSION = 2;
  private readonly STORE_NAME = 'cache';
  private readonly METADATA_STORE = 'metadata';
  
  private db: IDBDatabase | null = null;
  private storageType: 'indexeddb' | 'localstorage' | 'memory' = 'memory';
  private memoryCache = new Map<string, SecureCacheEntry>();
  private initPromise: Promise<void> | null = null;
  
  // Cache invalidation rules
  private invalidationRules: Map<string, string[]> = new Map([
    // When homework is created/updated/deleted, invalidate homework list
    ['POST:/institute-class-subject-homeworks', ['/institute-class-subject-homeworks']],
    ['PATCH:/institute-class-subject-homeworks', ['/institute-class-subject-homeworks']],
    ['DELETE:/institute-class-subject-homeworks', ['/institute-class-subject-homeworks']],
    
    // When lectures are modified
    ['POST:/institute-class-subject-lectures', ['/institute-class-subject-lectures', '/institute-lectures']],
    ['PATCH:/institute-class-subject-lectures', ['/institute-class-subject-lectures', '/institute-lectures']],
    ['DELETE:/institute-class-subject-lectures', ['/institute-class-subject-lectures', '/institute-lectures']],
    ['POST:/institute-lectures', ['/institute-lectures', '/institute-class-subject-lectures']],
    ['PATCH:/institute-lectures', ['/institute-lectures', '/institute-class-subject-lectures']],
    ['DELETE:/institute-lectures', ['/institute-lectures', '/institute-class-subject-lectures']],
    
    // When exams are modified
    ['POST:/institute-class-subject-exams', ['/institute-class-subject-exams']],
    ['PATCH:/institute-class-subject-exams', ['/institute-class-subject-exams']],
    ['DELETE:/institute-class-subject-exams', ['/institute-class-subject-exams']],
    
    // When students are modified
    ['POST:/institute-students', ['/institute-students', '/institute-classes']],
    ['PATCH:/institute-students', ['/institute-students', '/institute-classes']],
    ['DELETE:/institute-students', ['/institute-students', '/institute-classes']],
    ['POST:/students', ['/students', '/institute-students', '/institute-classes']],
    ['PATCH:/students', ['/students', '/institute-students', '/institute-classes']],
    ['DELETE:/students', ['/students', '/institute-students', '/institute-classes']],
    
    // When attendance is marked
    ['POST:/student-attendance', ['/student-attendance']],
    ['PATCH:/student-attendance', ['/student-attendance']],
    ['POST:/child-attendance', ['/child-attendance', '/student-attendance']],
    
    // When classes are modified
    ['POST:/institute-classes', ['/institute-classes', '/institute-students']],
    ['PATCH:/institute-classes', ['/institute-classes', '/institute-students']],
    ['DELETE:/institute-classes', ['/institute-classes', '/institute-students']],
    
    // When subjects are modified
    ['POST:/institute-class-subjects', ['/institute-class-subjects', '/institute-classes']],
    ['PATCH:/institute-class-subjects', ['/institute-class-subjects', '/institute-classes']],
    ['DELETE:/institute-class-subjects', ['/institute-class-subjects', '/institute-classes']],
    
    // When enrollments are modified
    ['POST:/institute-class-subject-students', ['/institute-class-subject-students', '/institute-students', '/institute-classes']],
    ['DELETE:/institute-class-subject-students', ['/institute-class-subject-students', '/institute-students', '/institute-classes']],
    
    // When homework submissions are modified
    ['POST:/homework-submissions', ['/homework-submissions', '/institute-class-subject-homeworks']],
    ['PATCH:/homework-submissions', ['/homework-submissions', '/institute-class-subject-homeworks']],
    
    // When exam results are modified
    ['POST:/exam-results', ['/exam-results', '/institute-class-subject-exams']],
    ['PATCH:/exam-results', ['/exam-results', '/institute-class-subject-exams']],
    
    // When payments are modified — full bust of all payment-related caches
    ['POST:/institute-payments',  ['/institute-payments', '/subject-payments']],
    ['PATCH:/institute-payments', ['/institute-payments', '/subject-payments']],
    ['DELETE:/institute-payments',['/institute-payments']],
    // Class payments (new endpoint)
    ['POST:/institute-class-payments',   ['/institute-class-payments', '/institute-class-subject-payments']],
    ['PATCH:/institute-class-payments',  ['/institute-class-payments', '/institute-class-subject-payments']],
    ['DELETE:/institute-class-payments', ['/institute-class-payments', '/institute-class-subject-payments']],
    // Payment submissions
    ['POST:/institute-class-payment-submissions',  ['/institute-class-payment-submissions', '/institute-class-payments', '/institute-class-subject-payments']],
    ['PATCH:/institute-class-payment-submissions', ['/institute-class-payment-submissions', '/institute-class-payments', '/institute-class-subject-payments']],
  ]);

  static getInstance(): SecureCacheManager {
    if (!SecureCacheManager.instance) {
      SecureCacheManager.instance = new SecureCacheManager();
    }
    return SecureCacheManager.instance;
  }

  constructor() {
    this.initPromise = this.initStorage();
  }

  /** Wipe the entire IndexedDB database so disabled-cache mode leaves no stale data */
  private wipeCacheDatabase(): void {
    try {
      // Delete IndexedDB
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase(this.DB_NAME);
        console.info('🧹 SecureCache: wiped IndexedDB (caching disabled)');
      }
      // Clear all localStorage cache keys
      if (typeof localStorage !== 'undefined') {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(this.CACHE_PREFIX)) toRemove.push(k);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
        if (toRemove.length) console.info(`🧹 SecureCache: wiped ${toRemove.length} localStorage entries`);
      }
    } catch { /* ignore */ }
  }

  private async initStorage(): Promise<void> {
    // When caching is disabled, wipe any existing stored data and exit
    if (!CACHE_ENABLED) {
      this.wipeCacheDatabase();
      this.storageType = 'memory'; // memory = volatile, resets each reload
      return;
    }

    try {
      if (this.isIndexedDBSupported()) {
        await this.initIndexedDB();
        this.storageType = 'indexeddb';
        return;
      }
    } catch (error: any) {
      console.warn('⚠️ IndexedDB initialization failed:', error);
    }

    try {
      if (this.isLocalStorageSupported()) {
        this.storageType = 'localstorage';
        return;
      }
    } catch (error: any) {
      console.warn('⚠️ localStorage not available:', error);
    }

    this.storageType = 'memory';
  }

  private isIndexedDBSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  }

  private isLocalStorageSupported(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const testKey = 'test_localStorage_secure';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create cache store
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const cacheStore = db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
          cacheStore.createIndex('context_userId', 'context.userId', { unique: false });
          cacheStore.createIndex('context_instituteId', 'context.instituteId', { unique: false });
        }
        
        // Create metadata store for cache statistics
        if (!db.objectStoreNames.contains(this.METADATA_STORE)) {
          db.createObjectStore(this.METADATA_STORE, { keyPath: 'key' });
        }
      };
    });
  }

  private generateCacheKey(endpoint: string, params?: Record<string, any>, context?: CacheContext): string {
    const parts = [this.CACHE_PREFIX, endpoint];
    
    // Add context to key for context-aware caching
    if (context?.userId) parts.push(`user_${context.userId}`);
    if (context?.instituteId) parts.push(`inst_${context.instituteId}`);
    if (context?.classId) parts.push(`class_${context.classId}`);
    if (context?.subjectId) parts.push(`subj_${context.subjectId}`);
    if (context?.role) parts.push(`role_${context.role}`);
    
    if (params && Object.keys(params).length > 0) {
      // Sort params for consistent keys
      const sortedParams = Object.keys(params)
        .sort()
        .reduce((acc, key) => {
          acc[key] = params[key];
          return acc;
        }, {} as Record<string, any>);
      parts.push(JSON.stringify(sortedParams));
    }
    
    return parts.join('_');
  }

  private generateDataHash(data: any): string {
    // Simple hash function for data integrity
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private isExpired(entry: SecureCacheEntry, ttlMinutes: number): boolean {
    const now = Date.now();
    const expirationTime = entry.timestamp + (ttlMinutes * 60 * 1000);
    return now > expirationTime;
  }

  private async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Set cache data with context awareness.
   * No-op when VITE_ENABLE_CACHE !== 'true'.
   */
  async setCache<T>(
    endpoint: string, 
    data: T, 
    params?: Record<string, any>, 
    options: SecureCacheOptions = {}
  ): Promise<void> {
    if (!CACHE_ENABLED) return; // 🚫 cache disabled
    await this.waitForInit();
    
    try {
      const cacheKey = this.generateCacheKey(endpoint, params, options.context);
      const entry: SecureCacheEntry<T> = {
        data,
        timestamp: Date.now(),
        key: cacheKey,
        context: options.context,
        hash: this.generateDataHash(data)
      };

      switch (this.storageType) {
        case 'indexeddb':
          await this.setIndexedDBCache(cacheKey, entry);
          break;
        case 'localstorage':
          this.setLocalStorageCache(cacheKey, entry);
          break;
        case 'memory':
          this.memoryCache.set(cacheKey, entry);
          break;
      }
    } catch (error: any) {
      console.error('❌ Failed to set cache:', error);
    }
  }

  /**
   * Get cache data with validation.
   * Always returns null when VITE_ENABLE_CACHE !== 'true'.
   */
  async getCache<T>(
    endpoint: string, 
    params?: Record<string, any>, 
    options: SecureCacheOptions = {}
  ): Promise<T | null> {
    if (!CACHE_ENABLED) return null; // 🚫 cache disabled — always fetch fresh
    await this.waitForInit();
    
    try {
      const { ttl = this.DEFAULT_TTL, forceRefresh = false } = options;
      
      if (forceRefresh) return null;

      const cacheKey = this.generateCacheKey(endpoint, params, options.context);
      let entry: SecureCacheEntry<T> | null = null;

      switch (this.storageType) {
        case 'indexeddb':
          entry = await this.getIndexedDBCache<T>(cacheKey);
          break;
        case 'localstorage':
          entry = this.getLocalStorageCache<T>(cacheKey);
          break;
        case 'memory':
          entry = this.memoryCache.get(cacheKey) as SecureCacheEntry<T> || null;
          break;
      }
      
      if (!entry) return null;
      
      // Validate data integrity
      if (entry.hash && entry.hash !== this.generateDataHash(entry.data)) {
        await this.clearCache(endpoint, params, options.context);
        return null;
      }
      
      if (this.isExpired(entry, ttl)) {
        await this.clearCache(endpoint, params, options.context);
        return null;
      }

      return entry.data;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Invalidate cache based on mutation.
   * No-op when caching is disabled.
   */
  async invalidateOnMutation(method: string, endpoint: string, context?: CacheContext): Promise<void> {
    if (!CACHE_ENABLED) return;
    const key = `${method}:${endpoint}`;
    const affectedEndpoints = this.invalidationRules.get(key);
    
    if (affectedEndpoints) {
      console.log(`🗑️ Invalidating cache for ${affectedEndpoints.length} endpoints after ${method} ${endpoint}`);
      
      for (const affectedEndpoint of affectedEndpoints) {
        await this.clearCachePattern(affectedEndpoint, context);
      }
    }
  }

  /**
   * Clear cache by pattern (e.g., all homework-related caches)
   */
  private async clearCachePattern(pattern: string, context?: CacheContext): Promise<void> {
    await this.waitForInit();
    
    try {
      const patternPrefix = this.CACHE_PREFIX + pattern;
      
      switch (this.storageType) {
        case 'indexeddb':
          await this.clearIndexedDBPattern(patternPrefix, context);
          break;
        case 'localstorage':
          this.clearLocalStoragePattern(patternPrefix, context);
          break;
        case 'memory':
          this.clearMemoryPattern(patternPrefix, context);
          break;
      }
      
      console.log(`🗑️ Cleared cache pattern: ${pattern}`, { context });
    } catch (error: any) {
      console.error('❌ Failed to clear cache pattern:', error);
    }
  }

  /**
   * Clear specific cache entry
   */
  async clearCache(endpoint: string, params?: Record<string, any>, context?: CacheContext): Promise<void> {
    await this.waitForInit();
    
    try {
      const cacheKey = this.generateCacheKey(endpoint, params, context);
      
      switch (this.storageType) {
        case 'indexeddb':
          await this.clearIndexedDBCache(cacheKey);
          break;
        case 'localstorage':
          localStorage.removeItem(cacheKey);
          break;
        case 'memory':
          this.memoryCache.delete(cacheKey);
          break;
      }
      
      console.log(`🗑️ Cache cleared: ${endpoint}`);
    } catch (error: any) {
      console.error('❌ Failed to clear cache:', error);
    }
  }

  /**
   * Clear all cache for a specific user
   */
  async clearUserCache(userId: string): Promise<void> {
    await this.waitForInit();
    
    try {
      console.log(`🗑️ Clearing all cache for user: ${userId}`);
      
      switch (this.storageType) {
        case 'indexeddb':
          await this.clearIndexedDBUserCache(userId);
          break;
        case 'localstorage':
          this.clearLocalStorageUserCache(userId);
          break;
        case 'memory':
          this.clearMemoryUserCache(userId);
          break;
      }
    } catch (error: any) {
      console.error('❌ Failed to clear user cache:', error);
    }
  }

  /**
   * Clear all cache for a specific institute
   */
  async clearInstituteCache(instituteId: string): Promise<void> {
    await this.waitForInit();
    
    try {
      console.log(`🗑️ Clearing all cache for institute: ${instituteId}`);
      await this.clearCachePattern('', { instituteId });
    } catch (error: any) {
      console.error('❌ Failed to clear institute cache:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache(): Promise<void> {
    await this.waitForInit();
    
    try {
      let clearedCount = 0;
      
      switch (this.storageType) {
        case 'indexeddb':
          clearedCount = await this.clearAllIndexedDBCache();
          break;
        case 'localstorage':
          clearedCount = this.clearAllLocalStorageCache();
          break;
        case 'memory':
          clearedCount = this.memoryCache.size;
          this.memoryCache.clear();
          break;
      }

      console.log(`🗑️ Cleared all ${clearedCount} cache entries`);
    } catch (error: any) {
      console.error('❌ Failed to clear all cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    storageType: string;
    oldestEntry?: Date;
    newestEntry?: Date;
  }> {
    await this.waitForInit();
    
    let totalEntries = 0;
    let totalSize = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;

    try {
      switch (this.storageType) {
        case 'indexeddb':
          const stats = await this.getIndexedDBStats();
          totalEntries = stats.count;
          totalSize = stats.size;
          oldestTimestamp = stats.oldestTimestamp;
          newestTimestamp = stats.newestTimestamp;
          break;
        case 'localstorage':
          const lsStats = this.getLocalStorageStats();
          totalEntries = lsStats.count;
          totalSize = lsStats.size;
          oldestTimestamp = lsStats.oldestTimestamp;
          newestTimestamp = lsStats.newestTimestamp;
          break;
        case 'memory':
          totalEntries = this.memoryCache.size;
          for (const [_, entry] of this.memoryCache) {
            totalSize += JSON.stringify(entry).length;
            if (entry.timestamp < oldestTimestamp) oldestTimestamp = entry.timestamp;
            if (entry.timestamp > newestTimestamp) newestTimestamp = entry.timestamp;
          }
          break;
      }
    } catch (error: any) {
      console.error('❌ Failed to get cache stats:', error);
    }

    return {
      totalEntries,
      totalSize,
      storageType: this.storageType,
      oldestEntry: totalEntries > 0 ? new Date(oldestTimestamp) : undefined,
      newestEntry: totalEntries > 0 ? new Date(newestTimestamp) : undefined,
    };
  }

  // IndexedDB operations
  private async setIndexedDBCache(key: string, entry: SecureCacheEntry): Promise<void> {
    if (!this.db) throw new Error('IndexedDB not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(entry);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getIndexedDBCache<T>(key: string): Promise<SecureCacheEntry<T> | null> {
    if (!this.db) return null;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async clearIndexedDBCache(key: string): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async clearIndexedDBPattern(pattern: string, context?: CacheContext): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry: SecureCacheEntry = cursor.value;
          let shouldDelete = entry.key.includes(pattern);
          
          // Filter by context if provided
          if (shouldDelete && context) {
            if (context.instituteId && entry.context?.instituteId !== context.instituteId) {
              shouldDelete = false;
            }
            if (context.classId && entry.context?.classId !== context.classId) {
              shouldDelete = false;
            }
            if (context.userId && entry.context?.userId !== context.userId) {
              shouldDelete = false;
            }
          }
          
          if (shouldDelete) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  private async clearIndexedDBUserCache(userId: string): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('context_userId');
      const request = index.openCursor(IDBKeyRange.only(userId));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  private async clearAllIndexedDBCache(): Promise<number> {
    if (!this.db) return 0;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const countRequest = store.count();
      
      countRequest.onsuccess = () => {
        const count = countRequest.result;
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => resolve(count);
        clearRequest.onerror = () => reject(clearRequest.error);
      };
      
      countRequest.onerror = () => reject(countRequest.error);
    });
  }

  private async getIndexedDBStats(): Promise<{ 
    count: number; 
    size: number; 
    oldestTimestamp: number; 
    newestTimestamp: number 
  }> {
    if (!this.db) return { count: 0, size: 0, oldestTimestamp: Date.now(), newestTimestamp: 0 };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.openCursor();
      
      let count = 0;
      let size = 0;
      let oldestTimestamp = Date.now();
      let newestTimestamp = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry: SecureCacheEntry = cursor.value;
          count++;
          size += JSON.stringify(entry).length;
          if (entry.timestamp < oldestTimestamp) oldestTimestamp = entry.timestamp;
          if (entry.timestamp > newestTimestamp) newestTimestamp = entry.timestamp;
          cursor.continue();
        } else {
          resolve({ count, size, oldestTimestamp, newestTimestamp });
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // LocalStorage operations
  private setLocalStorageCache(key: string, entry: SecureCacheEntry): void {
    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error: any) {
      console.warn('⚠️ localStorage quota exceeded, clearing old entries');
      this.clearOldLocalStorageEntries();
      try {
        localStorage.setItem(key, JSON.stringify(entry));
      } catch {
        console.error('❌ Still failed to set localStorage after cleanup');
      }
    }
  }

  private getLocalStorageCache<T>(key: string): SecureCacheEntry<T> | null {
    try {
      const cachedItem = localStorage.getItem(key);
      return cachedItem ? JSON.parse(cachedItem) : null;
    } catch (error: any) {
      console.error('❌ Failed to parse localStorage cache:', error);
      return null;
    }
  }

  private clearLocalStoragePattern(pattern: string, context?: CacheContext): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX) && key.includes(pattern)) {
        // Check context if provided
        if (context) {
          const cached = this.getLocalStorageCache(key);
          if (cached) {
            let matches = true;
            if (context.instituteId && cached.context?.instituteId !== context.instituteId) {
              matches = false;
            }
            if (context.classId && cached.context?.classId !== context.classId) {
              matches = false;
            }
            if (context.userId && cached.context?.userId !== context.userId) {
              matches = false;
            }
            if (matches) {
              keysToRemove.push(key);
            }
          }
        } else {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  private clearLocalStorageUserCache(userId: string): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX) && key.includes(`user_${userId}`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  private clearAllLocalStorageCache(): number {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return keysToRemove.length;
  }

  private clearOldLocalStorageEntries(): void {
    const entries: Array<{ key: string; timestamp: number }> = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX)) {
        const entry = this.getLocalStorageCache(key);
        if (entry) {
          entries.push({ key, timestamp: entry.timestamp });
        }
      }
    }
    
    // Sort by timestamp and remove oldest 25%
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const removeCount = Math.ceil(entries.length * 0.25);
    entries.slice(0, removeCount).forEach(({ key }) => localStorage.removeItem(key));
  }

  private getLocalStorageStats(): { 
    count: number; 
    size: number; 
    oldestTimestamp: number; 
    newestTimestamp: number 
  } {
    let count = 0;
    let size = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX)) {
        count++;
        const item = localStorage.getItem(key);
        if (item) {
          size += item.length;
          try {
            const entry: SecureCacheEntry = JSON.parse(item);
            if (entry.timestamp < oldestTimestamp) oldestTimestamp = entry.timestamp;
            if (entry.timestamp > newestTimestamp) newestTimestamp = entry.timestamp;
          } catch {}
        }
      }
    }
    
    return { count, size, oldestTimestamp, newestTimestamp };
  }

  // Memory cache operations
  private clearMemoryPattern(pattern: string, context?: CacheContext): void {
    const keysToRemove: string[] = [];
    for (const [key, entry] of this.memoryCache) {
      if (key.includes(pattern)) {
        if (context) {
          let matches = true;
          if (context.instituteId && entry.context?.instituteId !== context.instituteId) {
            matches = false;
          }
          if (context.classId && entry.context?.classId !== context.classId) {
            matches = false;
          }
          if (context.userId && entry.context?.userId !== context.userId) {
            matches = false;
          }
          if (matches) {
            keysToRemove.push(key);
          }
        } else {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => this.memoryCache.delete(key));
  }

  private clearMemoryUserCache(userId: string): void {
    const keysToRemove: string[] = [];
    for (const [key, entry] of this.memoryCache) {
      if (entry.context?.userId === userId) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => this.memoryCache.delete(key));
  }
}

export const secureCache = SecureCacheManager.getInstance();
