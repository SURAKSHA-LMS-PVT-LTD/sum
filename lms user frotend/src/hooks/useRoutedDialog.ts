import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildPopupRoutePath, stripPopupRouteFromPath } from '@/utils/popupRoutes';

/**
 * Routed dialog hook.
 *
 * Drives a popup's open/close state from the URL so every popup is deep-linkable.
 *
 * URL shape:
 *   <currentPath>/<dialogName>?<params>
 * Example:
 *   /institute/abc/parents/view-details-form?id=123
 *
 * The dialog name is appended as the LAST path segment when open, and stripped
 * when closed. Underlying page params (instituteId, classId, ...) remain in
 * the URL because we only mutate the trailing segment.
 *
 * Backwards-compatible: returns { isOpen, params, open, close, setOpen } so
 * existing dialogs that accept `open` / `onOpenChange` work unchanged.
 */
export function useRoutedDialog(dialogName: string) {
  const navigate = useNavigate();
  const location = useLocation();

  const segments = location.pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? '';
  const isOpen = lastSegment === dialogName;

  const basePath = useMemo(() => {
    return stripPopupRouteFromPath(location.pathname);
  }, [location.pathname]);

  const params = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const out: Record<string, string> = {};
    sp.forEach((v, k) => { out[k] = v; });
    return out;
  }, [location.search]);

  const open = useCallback((nextParams?: Record<string, string | number | undefined | null>) => {
    const sp = new URLSearchParams();
    if (nextParams) {
      Object.entries(nextParams).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        sp.set(k, String(v));
      });
    }
    const qs = sp.toString();
    const target = `${buildPopupRoutePath(location.pathname, dialogName)}${qs ? `?${qs}` : ''}`;
    navigate(target);
  }, [navigate, location.pathname, dialogName]);

  const close = useCallback(() => {
    if (!isOpen) return;
    navigate(basePath || '/', { replace: false });
  }, [navigate, basePath, isOpen]);

  const setOpen = useCallback((next: boolean) => {
    if (next && !isOpen) open();
    else if (!next && isOpen) close();
  }, [isOpen, open, close]);

  return { isOpen, params, open, close, setOpen };
}

export default useRoutedDialog;
