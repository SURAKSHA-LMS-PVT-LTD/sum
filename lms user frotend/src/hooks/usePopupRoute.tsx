import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildPopupRoutePath, isGenericPopupRouteSegment, isPopupRouteSegment, slugifyPopupRouteName, stripPopupRouteFromPath } from '@/utils/popupRoutes';

type OpenChangeHandler = (open: boolean) => void;

interface PopupRouteContextValue {
  open: boolean;
  registerRouteName: (routeName: string) => void;
  routeName?: string | null;
  syncEnabled: boolean;
}

export const PopupRouteContext = React.createContext<PopupRouteContextValue | null>(null);

const getLastSegment = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
};

const getCurrentPopupRoute = (pathname?: string) => {
  const path = pathname || window.location.pathname;
  const lastSegment = getLastSegment(path);
  return isPopupRouteSegment(lastSegment) ? lastSegment : null;
};

export function usePopupRouteRoot({
  open,
  defaultOpen,
  onOpenChange,
  routeName,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: OpenChangeHandler;
  routeName?: string | null;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const actualOpen = isControlled ? Boolean(open) : internalOpen;
  const activeRouteName = React.useMemo(() => routeName ? slugifyPopupRouteName(routeName, routeName, 'popup') : null, [routeName]);
  const previousPathnameRef = React.useRef(location.pathname);
  const currentRoute = getCurrentPopupRoute(location.pathname);
  const routeMismatchAfterPathChange = Boolean(
    actualOpen &&
    activeRouteName &&
    previousPathnameRef.current !== location.pathname &&
    currentRoute !== activeRouteName,
  );

  const closePopupRoute = React.useCallback(() => {
    const currentRoute = getCurrentPopupRoute(location.pathname);
    if (!currentRoute) {
      return;
    }
    const newPath = `${stripPopupRouteFromPath(location.pathname)}${location.search}`;
    if (newPath !== `${location.pathname}${location.search}`) {
      navigate(newPath, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const handleOpenChange = React.useCallback<OpenChangeHandler>((nextOpen) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    if (!nextOpen) {
      closePopupRoute();
    }
    onOpenChange?.(nextOpen);
  }, [closePopupRoute, isControlled, onOpenChange]);

  React.useEffect(() => {
    if (!actualOpen || !activeRouteName) return;

    if (routeMismatchAfterPathChange) return;

    if (currentRoute !== activeRouteName) {
      const targetPath = buildPopupRoutePath(location.pathname, activeRouteName);
      const targetUrl = `${targetPath}${location.search}`;
      if (targetUrl !== `${location.pathname}${location.search}`) {
        navigate(targetUrl, { replace: false });
      }
    }
  }, [actualOpen, activeRouteName, currentRoute, location.pathname, location.search, navigate, routeMismatchAfterPathChange]);

  React.useEffect(() => {
    const pathnameChanged = previousPathnameRef.current !== location.pathname;

    if (actualOpen && pathnameChanged && activeRouteName && currentRoute !== activeRouteName) {
      if (isControlled) {
        onOpenChange?.(false);
      } else {
        setInternalOpen(false);
        onOpenChange?.(false);
      }
    }
    previousPathnameRef.current = location.pathname;
  }, [location.pathname, actualOpen, activeRouteName, currentRoute, isControlled, onOpenChange]);

  const contextValue = React.useMemo<PopupRouteContextValue>(() => {
    const value = {
      open: routeMismatchAfterPathChange ? false : actualOpen,
      registerRouteName: (routeName: string) => {
        return routeName;
      },
      routeName: activeRouteName,
      syncEnabled: !routeMismatchAfterPathChange,
    };
    return value;
  }, [actualOpen, activeRouteName, routeMismatchAfterPathChange]);

  return { open: routeMismatchAfterPathChange ? false : actualOpen, onOpenChange: handleOpenChange, contextValue };
}

export function usePopupRouteContent(
  contentRef: React.RefObject<HTMLElement>,
  fallbackName?: string,
  suffix = 'form',
  disabled = false,
) {
  const routeContext = React.useContext(PopupRouteContext);
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    // When disabled, this dialog opts out of URL route syncing entirely — it never
    // pushes a /…/<name>-popup segment, so it behaves as a plain in-place dialog.
    if (disabled) return;
    if (!routeContext?.open || !routeContext.syncEnabled) {
      return;
    }

    const existingPopupRoute = getCurrentPopupRoute(location.pathname);
    const title = contentRef.current?.querySelector('[data-popup-route-title="true"]')?.textContent?.trim();
    const routeName = slugifyPopupRouteName(routeContext.routeName || title || fallbackName, fallbackName, suffix);

    routeContext.registerRouteName(routeName);

    if (!existingPopupRoute || existingPopupRoute !== routeName || isGenericPopupRouteSegment(existingPopupRoute)) {
      const newPath = `${buildPopupRoutePath(location.pathname, routeName)}${location.search}`;
      if (newPath !== `${location.pathname}${location.search}`) {
        navigate(newPath, { replace: false });
      }
    }
  }, [contentRef, fallbackName, navigate, routeContext, suffix, location.pathname, location.search]);
}