import { CACHE_TTL, getTTLForEndpoint } from '@/config/cacheTTL';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  key: string;
}

interface CacheOptions {
  ttl?: number; // Time to live in minutes
  forceRefresh?: boolean;
  userId?: string;
  role?: string;
  instituteId?: string;
  classId?: string;
  subjectId?: string;
}

type StorageType = 'indexeddb' | 'localstorage' | 'memory';

class ApiCacheManager {
  private static instance: ApiCacheManager;
  private readonly DEFAULT_TTL = CACHE_TTL.DEFAULT; // 60 minutes default cache (1 hour)
  private readonly CACHE_PREFIX = 'api_cache_';
  private readonly DB_NAME = 'ApiCacheDB';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'cache';
  
  private db: IDBDatabase | null = null;
  private storageType: StorageType = 'memory';
  private memoryCache = new Map<string, CacheEntry>();
  private initPromise: Promise<void> | null = null;

  static getInstance(): ApiCacheManager {
    if (!ApiCacheManager.instance) {
      ApiCacheManager.instance = new ApiCacheManager();
    }
    return ApiCacheManager.instance;
  }

  constructor() {
    this.initPromise = this.initStorage();
  }

  private async initStorage(): Promise<void> {
    try {
      // Try IndexedDB first
      if (this.isIndexedDBSupported()) {
        await this.initIndexedDB();
        this.storageType = 'indexeddb';
        console.log('ApiCache: Using IndexedDB storage');
        return;
      }
    } catch (error: any) {
      console.warn('IndexedDB initialization failed:', error);
    }

    try {
      // Fallback to localStorage
      if (this.isLocalStorageSupported()) {
        this.storageType = 'localstorage';
        console.log('ApiCache: Using localStorage storage');
        return;
      }
    } catch (error: any) {
      console.warn('localStorage not available:', error);
    }

    // Final fallback to memory
    this.storageType = 'memory';
    console.log('ApiCache: Using memory storage (data will not persist)');
  }

  private isIndexedDBSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  }

  private isLocalStorageSupported(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const testKey = 'test_localStorage';
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
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  private generateCacheKey(endpoint: string, params?: Record<string, any>, options?: CacheOptions): string {
    const paramString = params ? JSON.stringify(params) : '';
    // Include user context for proper cache isolation
    const contextString = options ? JSON.stringify({
      userId: options.userId,
      role: options.role,
      instituteId: options.instituteId,
      classId: options.classId,
      subjectId: options.subjectId
    }) : '';
    const cacheKey = `${this.CACHE_PREFIX}${endpoint}_${paramString}_${contextString}`;
    console.log('🔑 Generated cache key:', { 
      endpoint, 
      params, 
      context: options, 
      cacheKey 
    });
    return cacheKey;
  }

  private isExpired(entry: CacheEntry, ttlMinutes: number): boolean {
    const now = Date.now();
    const expirationTime = entry.timestamp + (ttlMinutes * 60 * 1000);
    return now > expirationTime;
  }

  private async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async setCache<T>(endpoint: string, data: T, params?: Record<string, any>, ttlMinutes?: number, options?: CacheOptions): Promise<void> {
    await this.waitForInit();
    
    try {
      // Auto-detect TTL based on endpoint if not provided
      const autoTTL = getTTLForEndpoint(endpoint);
      const effectiveTTL = ttlMinutes || autoTTL;
      
      const cacheKey = this.generateCacheKey(endpoint, params, options);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        key: cacheKey
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
      
      console.log(`✅ Cache SET for ${endpoint}:`, { 
        userId: options?.userId, 
        role: options?.role,
        dataLength: Array.isArray(data) ? data.length : 1, 
        storageType: this.storageType,
        ttl: `${effectiveTTL} minutes`,
        expiresAt: new Date(Date.now() + effectiveTTL * 60 * 1000).toLocaleTimeString()
      });
    } catch (error: any) {
      console.warn('Failed to set cache:', error);
    }
  }

  async getCache<T>(endpoint: string, params?: Record<string, any>, options: CacheOptions = {}): Promise<T | null> {
    await this.waitForInit();
    
    try {
      // Auto-detect TTL based on endpoint if not provided
      const autoTTL = getTTLForEndpoint(endpoint);
      const { ttl = autoTTL, forceRefresh = false } = options;
      
      if (forceRefresh) {
        console.log(`⚠️ Force refresh requested for ${endpoint}`);
        return null;
      }

      const cacheKey = this.generateCacheKey(endpoint, params, options);
      console.log(`🔍 ApiCache.getCache() called:`, { 
        endpoint, 
        cacheKey, 
        storageType: this.storageType,
        userId: options?.userId,
        role: options?.role,
        ttl: `${ttl} minutes`
      });
      
      let entry: CacheEntry<T> | null = null;

      switch (this.storageType) {
        case 'indexeddb':
          entry = await this.getIndexedDBCache<T>(cacheKey);
          break;
        case 'localstorage':
          entry = this.getLocalStorageCache<T>(cacheKey);
          break;
        case 'memory':
          entry = this.memoryCache.get(cacheKey) as CacheEntry<T> || null;
          break;
      }
      
      if (!entry) {
        console.log(`❌ ApiCache: No cache entry found for ${endpoint}`, {
          cacheKey,
          userId: options?.userId,
          role: options?.role,
          storageType: this.storageType
        });
        return null;
      }
      
      if (this.isExpired(entry, ttl)) {
        console.log(`⏰ ApiCache: Cache expired for ${endpoint}`, {
          age: (Date.now() - entry.timestamp) / 1000 / 60,
          ttl
        });
        await this.clearCache(endpoint, params);
        return null;
      }

      console.log(`✅ ApiCache: Cache HIT for ${endpoint}:`, { 
        cacheKey, 
        dataLength: Array.isArray(entry.data) ? entry.data.length : 1, 
        storageType: this.storageType,
        age: `${((Date.now() - entry.timestamp) / 1000 / 60).toFixed(1)} minutes`,
        ttl: `${ttl} minutes`,
        expiresIn: `${(ttl - ((Date.now() - entry.timestamp) / 1000 / 60)).toFixed(1)} minutes`
      });
      return entry.data;
    } catch (error: any) {
      console.warn('Failed to get cache:', error);
      return null;
    }
  }

  private async setIndexedDBCache(key: string, entry: CacheEntry): Promise<void> {
    if (!this.db) throw new Error('IndexedDB not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(entry);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getIndexedDBCache<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) return null;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(key);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private setLocalStorageCache(key: string, entry: CacheEntry): void {
    localStorage.setItem(key, JSON.stringify(entry));
  }

  private getLocalStorageCache<T>(key: string): CacheEntry<T> | null {
    const cachedItem = localStorage.getItem(key);
    return cachedItem ? JSON.parse(cachedItem) : null;
  }

  async clearCache(endpoint: string, params?: Record<string, any>): Promise<void> {
    await this.waitForInit();
    
    try {
      const cacheKey = this.generateCacheKey(endpoint, params);
      
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
      
      console.log(`Cache cleared for ${endpoint}`);
    } catch (error: any) {
      console.warn('Failed to clear cache:', error);
    }
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

  async clearUserCache(userId: string): Promise<void> {
    await this.waitForInit();
    
    try {
      const keysToRemove: string[] = [];
      
      switch (this.storageType) {
        case 'indexeddb':
          await this.clearIndexedDBUserCache(userId);
          break;
        case 'localstorage':
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Match any cache entry that contains the userId in the context
            if (key && key.startsWith(this.CACHE_PREFIX) && key.includes(`"userId":"${userId}"`)) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          break;
        case 'memory':
          for (const [key] of this.memoryCache) {
            // Match any cache entry that contains the userId in the context
            if (key.startsWith(this.CACHE_PREFIX) && key.includes(`"userId":"${userId}"`)) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => this.memoryCache.delete(key));
          break;
      }

      console.log(`🔒 Cleared ${keysToRemove.length} cache entries for user ${userId}`);
    } catch (error: any) {
      console.warn('Failed to clear user cache:', error);
    }
  }

  private async clearIndexedDBUserCache(userId: string): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.openCursor();
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const key = cursor.value.key;
          // Match any cache entry that contains the userId in the context
          if (key.startsWith(this.CACHE_PREFIX) && key.includes(`"userId":"${userId}"`)) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          console.log(`🔒 Deleted ${deletedCount} IndexedDB entries for user ${userId}`);
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllCache(): Promise<void> {
    await this.waitForInit();
    
    try {
      let clearedCount = 0;
      
      switch (this.storageType) {
        case 'indexeddb':
          clearedCount = await this.clearAllIndexedDBCache();
          break;
        case 'localstorage':
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.CACHE_PREFIX)) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          clearedCount = keysToRemove.length;
          break;
        case 'memory':
          clearedCount = this.memoryCache.size;
          this.memoryCache.clear();
          break;
      }

      console.log(`Cleared all ${clearedCount} cache entries`);
    } catch (error: any) {
      console.warn('Failed to clear all cache:', error);
    }
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

  async getCacheStats(): Promise<{ totalEntries: number; totalSize: number; storageType: StorageType }> {
    await this.waitForInit();
    
    let totalEntries = 0;
    let totalSize = 0;

    try {
      switch (this.storageType) {
        case 'indexeddb':
          const stats = await this.getIndexedDBStats();
          totalEntries = stats.count;
          totalSize = stats.size;
          break;
        case 'localstorage':
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.CACHE_PREFIX)) {
              totalEntries++;
              const item = localStorage.getItem(key);
              if (item) {
                totalSize += item.length;
              }
            }
          }
          break;
        case 'memory':
          totalEntries = this.memoryCache.size;
          for (const [key, value] of this.memoryCache) {
            totalSize += JSON.stringify(value).length;
          }
          break;
      }
    } catch (error: any) {
      console.warn('Failed to get cache stats:', error);
    }

    return { totalEntries, totalSize, storageType: this.storageType };
  }

  private async getIndexedDBStats(): Promise<{ count: number; size: number }> {
    if (!this.db) return { count: 0, size: 0 };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.openCursor();
      
      let count = 0;
      let size = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          count++;
          size += JSON.stringify(cursor.value).length;
          cursor.continue();
        } else {
          resolve({ count, size });
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all expired cache entries across all storage types
   * This helps maintain cache hygiene and free up storage space
   */
  async clearExpiredEntries(): Promise<number> {
    await this.waitForInit();
    
    let clearedCount = 0;
    
    try {
      switch (this.storageType) {
        case 'indexeddb':
          clearedCount = await this.clearExpiredIndexedDBEntries();
          break;
        case 'localstorage':
          clearedCount = this.clearExpiredLocalStorageEntries();
          break;
        case 'memory':
          clearedCount = this.clearExpiredMemoryEntries();
          break;
      }
      
      console.log(`🧹 Cleared ${clearedCount} expired cache entries`);
    } catch (error: any) {
      console.warn('Failed to clear expired entries:', error);
    }
    
    return clearedCount;
  }

  private async clearExpiredIndexedDBEntries(): Promise<number> {
    if (!this.db) return 0;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.openCursor();
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry: CacheEntry = cursor.value;
          // Use default TTL for expired check
          if (this.isExpired(entry, this.DEFAULT_TTL)) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  private clearExpiredLocalStorageEntries(): number {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX)) {
        try {
          const cachedItem = localStorage.getItem(key);
          if (cachedItem) {
            const entry: CacheEntry = JSON.parse(cachedItem);
            if (this.isExpired(entry, this.DEFAULT_TTL)) {
              keysToRemove.push(key);
            }
          }
        } catch (error: any) {
          // If parsing fails, remove the corrupted entry
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return keysToRemove.length;
  }

  private clearExpiredMemoryEntries(): number {
    const keysToRemove: string[] = [];
    
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry, this.DEFAULT_TTL)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => this.memoryCache.delete(key));
    return keysToRemove.length;
  }

  /**
   * Initialize periodic cache maintenance
   * Clears expired entries every 5 minutes
   */
  startPeriodicMaintenance(): void {
    // Clear expired entries every 5 minutes
    setInterval(async () => {
      const clearedCount = await this.clearExpiredEntries();
      if (clearedCount > 0) {
        console.log(`🧹 Periodic maintenance: Removed ${clearedCount} expired cache entries`);
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    console.log('🔧 Periodic cache maintenance started (runs every 5 minutes)');
  }
}

export const apiCache = ApiCacheManager.getInstance();

// Start periodic cache maintenance automatically
if (typeof window !== 'undefined') {
  // Start maintenance after a short delay to allow initialization
  setTimeout(() => {
    apiCache.startPeriodicMaintenance();
  }, 10000); // Start after 10 seconds
}
