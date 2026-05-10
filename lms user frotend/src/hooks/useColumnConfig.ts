import { useState, useCallback, useMemo, useEffect } from 'react';
import { getPreference, setPreference, migrateFromLocalStorage } from '@/utils/securePreferences';

export interface ColumnDef {
  key: string;
  header: string | React.ReactNode;
  /** If false, column is hidden by default (user can turn on) */
  defaultVisible?: boolean;
  /** If true, column cannot be hidden */
  locked?: boolean;
  /** Default width in px */
  defaultWidth?: number;
  /** Min width in px for resize */
  minWidth?: number;
  render?: (value: any, row: any) => React.ReactNode;
}

export interface ColumnState {
  visible: boolean;
  width: number;
}

const STORAGE_PREFIX = 'colcfg_';

function buildDefaults(allColumns: ColumnDef[]): Record<string, ColumnState> {
  const initial: Record<string, ColumnState> = {};
  for (const col of allColumns) {
    initial[col.key] = {
      visible: col.defaultVisible !== false,
      width: col.defaultWidth || 180,
    };
  }
  return initial;
}

export function useColumnConfig(allColumns: ColumnDef[], storageKey: string) {
  const fullKey = STORAGE_PREFIX + storageKey;

  // Start with defaults; saved preferences load async from IndexedDB
  const [colState, setColState] = useState<Record<string, ColumnState>>(() => buildDefaults(allColumns));

  // Load saved preferences from IndexedDB on mount (also migrates old localStorage data)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // One-time migration from localStorage → IndexedDB
      await migrateFromLocalStorage(fullKey, fullKey);
      const saved = await getPreference<Record<string, ColumnState>>(fullKey);
      if (cancelled || !saved) return;
      const merged: Record<string, ColumnState> = {};
      for (const col of allColumns) {
        merged[col.key] = saved[col.key] ?? {
          visible: col.defaultVisible !== false,
          width: col.defaultWidth || 180,
        };
      }
      setColState(merged);
    })();
    return () => { cancelled = true; };
  }, [fullKey]);

  const toggleColumn = useCallback((key: string) => {
    setColState(prev => {
      const col = allColumns.find(c => c.key === key);
      if (col?.locked) return prev;
      const next = { ...prev, [key]: { ...prev[key], visible: !prev[key]?.visible } };
      setPreference(fullKey, next);
      return next;
    });
  }, [allColumns, fullKey]);

  const setColumnWidth = useCallback((key: string, width: number) => {
    setColState(prev => {
      const col = allColumns.find(c => c.key === key);
      const minW = col?.minWidth || 80;
      const next = { ...prev, [key]: { ...prev[key], width: Math.max(width, minW) } };
      setPreference(fullKey, next);
      return next;
    });
  }, [allColumns, fullKey]);

  const resetColumns = useCallback(() => {
    const initial = buildDefaults(allColumns);
    setColState(initial);
    setPreference(fullKey, initial);
  }, [allColumns, fullKey]);

  // Visible columns in order (preserving allColumns order)
  const visibleColumns = useMemo(() => {
    return allColumns.filter(col => colState[col.key]?.visible !== false);
  }, [allColumns, colState]);

  return {
    allColumns,
    colState,
    visibleColumns,
    toggleColumn,
    setColumnWidth,
    resetColumns,
  };
}
