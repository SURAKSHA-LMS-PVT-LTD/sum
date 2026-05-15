import React, { useContext } from 'react';
import appIcon from '@/assets/app-icon.png';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { TenantContext } from '@/contexts/TenantContext';

interface AppLoadingScreenProps {
  message?: string;
  iconUrl?: string | null;
}

const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({ message = 'Loading...', iconUrl }) => {
  const tenant = useContext(TenantContext);
  const branding = tenant?.branding ?? null;

  // Prefer the institute's login GIF/image (loginBackgroundUrl when type=IMAGE)
  // for a branded animated loading screen, then fall back to logo, then app default.
  const gifUrl = branding?.loginBackgroundType === 'IMAGE' && branding.loginBackgroundUrl
    ? getImageUrl(branding.loginBackgroundUrl)
    : null;
  const brandingLogo = branding ? getImageUrl(branding.loginLogoUrl ?? branding.logoUrl ?? '') : null;
  const effectiveIcon = iconUrl ?? brandingLogo;
  const resolvedIcon = effectiveIcon || appIcon;

  if (gifUrl) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center space-y-4">
          <img
            src={gifUrl}
            alt="Loading"
            className="mx-auto rounded-xl shadow-lg object-contain"
            style={{ maxWidth: 260, maxHeight: 200 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <p className="text-sm text-muted-foreground font-medium">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="text-center space-y-5">
        <div className="relative mx-auto w-20 h-20">
          <img
            src={resolvedIcon}
            alt="App Logo"
            className="relative w-20 h-20 rounded-2xl shadow-lg object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = appIcon; }}
          />
        </div>

        <div className="w-48 h-1 bg-muted rounded-full overflow-hidden mx-auto">
          <div
            className="h-full bg-primary rounded-full"
            style={{ animation: 'loading-bar 1.2s ease-in-out infinite' }}
          />
        </div>

        <p className="text-sm text-muted-foreground font-medium">{message}</p>

        <style>{`
          @keyframes loading-bar {
            0% { width: 0%; margin-left: 0%; }
            50% { width: 60%; margin-left: 20%; }
            100% { width: 0%; margin-left: 100%; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default AppLoadingScreen;
