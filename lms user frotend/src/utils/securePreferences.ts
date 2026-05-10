/**
 * Secure client-side preference storage using IndexedDB.
 * Unlike localStorage, IndexedDB is not accessible via simple
 * `localStorage.getItem()` calls from XSS payloads and data
 * is not visible in the browser's Storage panel.
 */

const DB_NAME = 'app_prefs';
const STORE_NAME = 'preferences';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

export async function getPreference<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setPreference<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // silently fail
  }
}

export async function removePreference(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // silently fail
  }
}

/**
 * Migrate a key from localStorage to IndexedDB and remove the old entry.
 */
export async function migrateFromLocalStorage(localStorageKey: string, idbKey: string): Promise<void> {
  try {
    const raw = localStorage.getItem(localStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      await setPreference(idbKey, parsed);
      localStorage.removeItem(localStorageKey);
    }
  } catch {
    // silently fail
  }
}
