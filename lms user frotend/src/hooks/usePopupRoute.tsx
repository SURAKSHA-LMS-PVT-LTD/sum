import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildPopupRoutePath, isGenericPopupRouteSegment, isPopupRouteSegment, slugifyPopupRouteName, stripPopupRouteFromPath } from '@/utils/popupRoutes';

type OpenChangeHandler = (open: boolean) => void;

interface PopupRouteContextValue {
  open: boolean;
  registerRouteName: (routeName: string) => void;
  routeName?: string | null;
}

export const PopupRouteContext = React.createContext<PopupRouteContextValue | null>(null);

const getLastSegment = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
};

const getCurrentPopupRoute = () => {
  const lastSegment = getLastSegment(window.location.pathname);
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
  const previousOpenRef = React.useRef(actualOpen);
  const routeWasActiveRef = React.useRef(Boolean(getCurrentPopupRoute()));

  const closePopupRoute = React.useCallback(() => {
    if (!getCurrentPopupRoute()) return;
    navigate(`${stripPopupRouteFromPath(window.location.pathname)}${window.location.search}`, { replace: false });
  }, [navigate]);

  const handleOpenChange = React.useCallback<OpenChangeHandler>((nextOpen) => {
    if (!isControlled) setInternalOpen(nextOpen);
    if (!nextOpen) closePopupRoute();
    onOpenChange?.(nextOpen);
  }, [closePopupRoute, isControlled, onOpenChange]);

  React.useEffect(() => {
    if (previousOpenRef.current && !actualOpen) closePopupRoute();
    previousOpenRef.current = actualOpen;
  }, [actualOpen, closePopupRoute]);

  React.useEffect(() => {
    if (!actualOpen) {
      routeWasActiveRef.current = false;
      return;
    }

    const currentPopupRoute = getCurrentPopupRoute();
    if (currentPopupRoute) {
      routeWasActiveRef.current = true;
      return;
    }

    if (routeWasActiveRef.current) handleOpenChange(false);
  }, [actualOpen, handleOpenChange, location.pathname]);

  const contextValue = React.useMemo<PopupRouteContextValue>(() => ({
    open: actualOpen,
    registerRouteName: (routeName: string) => {
      return routeName;
    },
    routeName,
  }), [actualOpen, routeName]);

  return { open: actualOpen, onOpenChange: handleOpenChange, contextValue };
}

export function usePopupRouteContent(
  contentRef: React.RefObject<HTMLElement>,
  fallbackName?: string,
  suffix = 'form',
) {
  const routeContext = React.useContext(PopupRouteContext);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!routeContext?.open) return;

    const existingPopupRoute = getCurrentPopupRoute();
    const title = contentRef.current?.querySelector('[data-popup-route-title="true"]')?.textContent?.trim();
    const routeName = slugifyPopupRouteName(routeContext.routeName || title || fallbackName, fallbackName, suffix);

    routeContext.registerRouteName(routeName);

    if (!existingPopupRoute || isGenericPopupRouteSegment(existingPopupRoute)) {
      navigate(`${buildPopupRoutePath(window.location.pathname, routeName)}${window.location.search}`, { replace: false });
    }
  }, [contentRef, fallbackName, navigate, routeContext, suffix]);
}