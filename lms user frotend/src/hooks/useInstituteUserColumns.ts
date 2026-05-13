/**
 * useInstituteUserColumns
 * Fetches the institute-wide extra user column schema once per institute.
 * Returns the schema array, loading state, and a save function.
 */
import { useState, useEffect, useCallback } from 'react';
import { instituteApi } from '@/api/institute.api';
import { instituteSettingsApi, ExtraDataColumn } from '@/api/instituteSettings.api'; // Keep for save

interface UseInstituteUserColumnsResult {
  columns: ExtraDataColumn[];
  loading: boolean;
  save: (columns: ExtraDataColumn[]) => Promise<void>;
  refresh: () => void;
}

const _cache: Record<string, ExtraDataColumn[]> = {};

export function useInstituteUserColumns(
  instituteId: string | null | undefined,
): UseInstituteUserColumnsResult {
  const [columns, setColumns] = useState<ExtraDataColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!instituteId) { setColumns([]); return; }
    if (_cache[instituteId]) { setColumns(_cache[instituteId]); return; }
    let cancelled = false;
    setLoading(true);
    instituteApi.getUserColumnSchema(instituteId)
      .then(data => {
        if (!cancelled) {
          const safe = Array.isArray(data) ? data : [];
          _cache[instituteId] = safe;
          setColumns(safe);
        }
      })
      .catch(() => { if (!cancelled) setColumns([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [instituteId, version]);

  const save = useCallback(async (newColumns: ExtraDataColumn[]) => {
    if (!instituteId) return;
    // Note: The save function from instituteSettingsApi is still used here.
    // This might need to be updated if the save logic is also moved to instituteApi.
    const saved = await instituteSettingsApi.updateUserExtraDataSchema(instituteId, newColumns);
    const safe = Array.isArray(saved) ? saved : newColumns;
    _cache[instituteId] = safe;
    setColumns(safe);
  }, [instituteId]);

  const refresh = useCallback(() => {
    if (instituteId) delete _cache[instituteId];
    setVersion(v => v + 1);
  }, [instituteId]);

  return { columns, loading, save, refresh };
}
