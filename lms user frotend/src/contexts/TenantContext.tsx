import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { getBaseUrl } from './utils/auth.api';
import { getImageUrl } from '@/utils/imageUrlHelper';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface TenantBranding {
  id: string;
  name: string;
  code: string;
  tier: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'ISOLATED';
  logoUrl: string | null;
  primaryColorCode: string | null;
  secondaryColorCode: string | null;
  loginLogoUrl: string | null;
  loginBackgroundType: 'COLOR' | 'GRADIENT' | 'IMAGE' | 'VIDEO';
  loginBackgroundUrl: string | null;
  loginVideoPosterUrl: string | null;
  loginIllustrationUrl: string | null;
  loginWelcomeTitle: string | null;
  loginWelcomeSubtitle: string | null;
  loginFooterText: string | null;
  loginCustomCss: Record<string, string> | null;
  faviconUrl: string | null;
  customAppName: string | null;
  poweredByVisible: boolean;
  subdomain: string | null;
  customDomain: string | null;
}

export type TenantLoginMethod = 'SURAKSHA_WEB' | 'SURAKSHA_APP' | 'SUBDOMAIN' | 'CUSTOM_DOMAIN';

export interface TenantContextType {
  /** Whether we're on a tenant subdomain/custom domain (not the default lms.suraksha.lk) */
  isTenantLogin: boolean;
  /** Detected subdomain (null if default or custom domain) */
  subdomain: string | null;
  /** Detected custom domain (null if default or subdomain) */
  customDomain: string | null;
  /** Determined login method */
  loginMethod: TenantLoginMethod;
  /** Branding data fetched from the API */
  branding: TenantBranding | null;
  /** Loading state while fetching branding */
  isLoading: boolean;
  /** Error if branding fetch failed */
  error: string | null;
  /** Force-refetch branding (call after saving new branding) */
  refetch: () => void;
}

export const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = (): TenantContextType => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
};

// ═══════════════════════════════════════════════════════════════════
// Branding cache helpers (localStorage)
// ═══════════════════════════════════════════════════════════════════

const CACHE_KEY_PREFIX = 'suraksha_tenant_branding_';

function brandingCacheKey(detected: { subdomain: string | null; customDomain: string | null }): string {
  return CACHE_KEY_PREFIX + (detected.subdomain ?? detected.customDomain ?? 'default');
}

function loadCachedBranding(key: string): TenantBranding | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as TenantBranding;
  } catch {
    return null;
  }
}

function saveCachedBranding(key: string, data: TenantBranding): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // storage quota exceeded — ignore
  }
}

/** Apply branding to the DOM: favicon, title, and SEO meta tags. */
function applyBrandingToDom(data: TenantBranding): void {
  const title = data.customAppName ?? data.name ?? '';

  if (data.faviconUrl) {
    const resolvedFavicon = getImageUrl(data.faviconUrl);
    document.querySelectorAll("link[rel~='icon'], link[rel~='shortcut'], link[rel='apple-touch-icon']").forEach((el) => {
      (el as HTMLLinkElement).href = resolvedFavicon;
    });
    if (!document.querySelector("link[rel~='icon']")) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = resolvedFavicon;
      document.head.appendChild(link);
    }
  }

  if (title) {
    document.title = title;
    const appleMeta = document.getElementById('apple-web-app-title-meta');
    if (appleMeta) appleMeta.setAttribute('content', title);
  }

  // Update SEO meta so JS-rendering crawlers see institute content, not Suraksha's.
  const setMeta = (selector: string, value: string) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', value);
  };
  if (title) {
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[name="twitter:title"]', title);
  }
  // Canonical URL — point to current origin
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', window.location.origin + '/');
}

// ═══════════════════════════════════════════════════════════════════
// Tenant detection from hostname
// ═══════════════════════════════════════════════════════════════════

interface DetectedTenant {
  subdomain: string | null;
  customDomain: string | null;
  loginMethod: TenantLoginMethod;
  isTenantLogin: boolean;
}

function detectTenant(): DetectedTenant {
  const hostname = window.location.hostname;

  // Skip detection for localhost / dev
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Check for dev override: ?subdomain=academy
    const params = new URLSearchParams(window.location.search);
    const devSubdomain = params.get('subdomain');
    if (devSubdomain) {
      return { subdomain: devSubdomain, customDomain: null, loginMethod: 'SUBDOMAIN', isTenantLogin: true };
    }
    return { subdomain: null, customDomain: null, loginMethod: 'SURAKSHA_WEB', isTenantLogin: false };
  }

  // Dev: handle *.localhost subdomains (e.g. royal-science.localhost:5173)
  const localMatch = hostname.match(/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.localhost$/i);
  if (localMatch) {
    return { subdomain: localMatch[1].toLowerCase(), customDomain: null, loginMethod: 'SUBDOMAIN', isTenantLogin: true };
  }

  // Check if this is a *.suraksha.lk subdomain
  const surakshaMatch = hostname.match(/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.suraksha\.lk$/i);
  if (surakshaMatch) {
    const sub = surakshaMatch[1].toLowerCase();
    // Default endpoints — not tenant subdomains
    const defaultSubs = ['lms', 'org', 'admin', 'transport', 'api', 'lmsapi', 'storage', 'www'];
    if (defaultSubs.includes(sub)) {
      return { subdomain: null, customDomain: null, loginMethod: 'SURAKSHA_WEB', isTenantLogin: false };
    }
    return { subdomain: sub, customDomain: null, loginMethod: 'SUBDOMAIN', isTenantLogin: true };
  }

  // Not a suraksha.lk domain — treat as custom domain
  return { subdomain: null, customDomain: hostname, loginMethod: 'CUSTOM_DOMAIN', isTenantLogin: true };
}

// ═══════════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════════

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const detected = useMemo(() => detectTenant(), []);
  const cacheKey = useMemo(() => brandingCacheKey(detected), [detected]);

  // Seed state from localStorage cache so the loading screen can show institute
  // branding immediately on subsequent visits — even before the API responds.
  const cachedBranding = useMemo(() => {
    if (!detected.isTenantLogin) return null;
    return loadCachedBranding(cacheKey);
  }, [detected.isTenantLogin, cacheKey]);

  const [branding, setBranding] = useState<TenantBranding | null>(cachedBranding);
  // If we have a cache hit, skip the loading-spinner gate entirely on first paint.
  const [isLoading, setIsLoading] = useState(detected.isTenantLogin && !cachedBranding);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey(k => k + 1), []);

  // Apply cached branding to DOM immediately (before the API fetch resolves).
  useEffect(() => {
    if (cachedBranding) {
      applyBrandingToDom(cachedBranding);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!detected.isTenantLogin) return;

    let isMounted = true;

    const fetchBranding = async () => {
      try {
        const baseUrl = getBaseUrl();
        let url: string;

        if (detected.subdomain) {
          url = `${baseUrl}/v2/tenant/branding/subdomain/${encodeURIComponent(detected.subdomain)}`;
        } else if (detected.customDomain) {
          url = `${baseUrl}/v2/tenant/branding/domain/${encodeURIComponent(detected.customDomain)}`;
        } else {
          return;
        }

        const res = await fetch(url);
        if (!isMounted) return;
        if (!res.ok) {
          if (res.status === 404) {
            setError('Institute not found for this domain');
          } else {
            setError('Failed to load institute branding');
          }
          return;
        }
        const data: TenantBranding = await res.json();
        if (!isMounted) return;

        // Persist to cache for next visit
        saveCachedBranding(cacheKey, data);
        setBranding(data);
        applyBrandingToDom(data);
      } catch (err) {
        if (isMounted) setError('Failed to connect to server');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchBranding();

    return () => {
      isMounted = false;
    };
  }, [detected, cacheKey, refreshKey]);

  const value: TenantContextType = useMemo(() => ({
    isTenantLogin: detected.isTenantLogin,
    subdomain: detected.subdomain,
    customDomain: detected.customDomain,
    loginMethod: detected.loginMethod,
    branding,
    isLoading,
    error,
    refetch,
  }), [detected, branding, isLoading, error, refetch]);

  // On a tenant domain, block rendering until branding is resolved.
  // With a cache hit this gate is skipped (isLoading starts false).
  // Without a cache the spinner shows until the API responds.
  if (detected.isTenantLogin && isLoading) {
    return <TenantLoadingScreen branding={cachedBranding} />;
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

// ═══════════════════════════════════════════════════════════════════
// Tenant-branded loading screen shown while branding is being fetched
// ═══════════════════════════════════════════════════════════════════

const TenantLoadingScreen: React.FC<{ branding: TenantBranding | null }> = ({ branding }) => {
  const isDark = document.documentElement.classList.contains('dark');

  // Only use branding assets when we actually have cached branding — never show Suraksha assets.
  const gifUrl = branding?.loginBackgroundType === 'IMAGE' && branding.loginBackgroundUrl
    ? getImageUrl(branding.loginBackgroundUrl)
    : null;
  const logoUrl = branding?.loginLogoUrl ?? branding?.logoUrl
    ? getImageUrl(branding.loginLogoUrl ?? branding!.logoUrl ?? '')
    : null;
  const appName = branding?.customAppName ?? branding?.name ?? '';

  // Derive spinner and background from institute primary color when available,
  // otherwise use a neutral theme-aware colour — never hardcode Suraksha blue.
  const primary = branding?.primaryColorCode ?? null;
  const bg = isDark ? '#0f1117' : '#f8fafc';
  const spinnerTrack = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const spinnerFill = primary ?? (isDark ? '#94a3b8' : '#64748b');
  const textColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';

  if (gifUrl) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: bg, zIndex: 9999, gap: 16 }}>
        <img
          src={gifUrl}
          alt={appName}
          style={{ maxWidth: 260, maxHeight: 200, objectFit: 'contain', borderRadius: 12 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        {appName && <p style={{ color: textColor, fontSize: 14, fontWeight: 500, margin: 0 }}>{appName}</p>}
        <style>{`@keyframes _tspin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: bg, zIndex: 9999, gap: 16 }}>
      {logoUrl && (
        <img
          src={logoUrl}
          alt={appName}
          style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 12, marginBottom: 4 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${spinnerTrack}`, borderTopColor: spinnerFill, animation: '_tspin 0.8s linear infinite' }} />
      {appName && <p style={{ color: textColor, fontSize: 13, fontWeight: 500, margin: 0 }}>{appName}</p>}
      <style>{`@keyframes _tspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
