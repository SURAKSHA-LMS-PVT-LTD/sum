import { useState, useEffect, useCallback, useMemo } from 'react';

type ViewMode = 'card' | 'table';

const sanitizePath = (path: string) => {
  const cleaned = path.replace(/^\/+|\/+$/g, '');
  return cleaned || 'root';
};

const readMode = (key: string): ViewMode => {
  const scoped = localStorage.getItem(key) as ViewMode | null;
  if (scoped === 'card' || scoped === 'table') return scoped;

  // Backward compatibility: migrate old global value once.
  const legacy = localStorage.getItem('viewMode') as ViewMode | null;
  if (legacy === 'card' || legacy === 'table') {
    localStorage.setItem(key, legacy);
    return legacy;
  }

  // Fall back to user's global default preference (Settings page).
  const globalDefault = localStorage.getItem('viewMode:global') as ViewMode | null;
  if (globalDefault === 'card' || globalDefault === 'table') return globalDefault;

  return 'card';
};

export function useViewMode(scopeKey?: string) {
  const storageKey = useMemo(() => {
    if (scopeKey) return `viewMode:${scopeKey}`;
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    return `viewMode:${sanitizePath(path)}`;
  }, [scopeKey]);

  const [viewMode, setViewModeState] = useState<'card' | 'table'>(() => {
    return readMode(storageKey);
  });

  useEffect(() => {
    // Keep state aligned when scope changes (route change or explicit key change).
    setViewModeState(readMode(storageKey));

    const handleViewModeChange = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string; mode: ViewMode }>).detail;
      if (!detail || detail.key !== storageKey) return;

      const mode = detail.mode;
      if (mode === 'card' || mode === 'table') {
        setViewModeState(mode);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key !== storageKey) return;
      const mode = readMode(storageKey);
      setViewModeState(mode);
    };

    window.addEventListener('viewModeChange', handleViewModeChange);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('viewModeChange', handleViewModeChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [storageKey]);

  const setViewMode = useCallback((mode: 'card' | 'table') => {
    setViewModeState(mode);
    localStorage.setItem(storageKey, mode);
    window.dispatchEvent(new CustomEvent('viewModeChange', { detail: { key: storageKey, mode } }));
  }, [storageKey]);

  return { viewMode, setViewMode } as const;
}
