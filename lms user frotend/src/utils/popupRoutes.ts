const POPUP_ROUTE_SUFFIXES = [
  '-form',
  '-dialog',
  '-popup',
  '-modal',
  '-sheet',
  '-drawer',
  '-preview',
];

const POPUP_ROUTE_NAMES = new Set([
  'view-details-form',
  'create-details-form',
  'update-details-form',
  'delete-details-form',
  'assign-details-form',
]);

const GENERIC_POPUP_ROUTE_NAMES = new Set([
  'popup',
  'popup-form',
  'sheet-form',
  'drawer-form',
  'confirm-dialog',
]);

export const isPopupRouteSegment = (segment?: string) => {
  if (!segment) return false;
  return GENERIC_POPUP_ROUTE_NAMES.has(segment) || POPUP_ROUTE_NAMES.has(segment) || POPUP_ROUTE_SUFFIXES.some((suffix) => segment.endsWith(suffix));
};

export const isGenericPopupRouteSegment = (segment?: string | null) => {
  if (!segment) return false;
  return GENERIC_POPUP_ROUTE_NAMES.has(segment);
};

export const stripPopupRouteFromPath = (pathname: string) => {
  const cleanPath = pathname || '/';
  const segments = cleanPath.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  if (!isPopupRouteSegment(lastSegment)) return cleanPath;

  const baseSegments = segments.slice(0, -1);
  return baseSegments.length ? `/${baseSegments.join('/')}` : '/';
};

export const slugifyPopupRouteName = (value?: string | null, fallback = 'details-popup', suffix = 'form') => {
  const slug = (value || fallback)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;

  return isPopupRouteSegment(slug) ? slug : `${slug}-${suffix}`;
};

export const buildPopupRoutePath = (pathname: string, popupName: string) => {
  const basePath = stripPopupRouteFromPath(pathname).replace(/\/$/, '') || '/';
  return basePath === '/' ? `/${popupName}` : `${basePath}/${popupName}`;
};