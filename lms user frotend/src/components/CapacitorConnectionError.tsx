import React, { useContext, useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { TenantContext } from '@/contexts/TenantContext';
import { getImageUrl } from '@/utils/imageUrlHelper';
import appIcon from '@/assets/app-icon.png';

interface CapacitorConnectionErrorProps {
  onRetry?: () => void;
}

const CapacitorConnectionError: React.FC<CapacitorConnectionErrorProps> = ({ onRetry }) => {
  const tenant = useContext(TenantContext);
  const branding = tenant?.branding ?? null;
  const isTenant = tenant?.isTenantLogin ?? false;
  const [retrying, setRetrying] = useState(false);

  const logoUrl = branding
    ? getImageUrl(branding.loginLogoUrl ?? branding.logoUrl ?? '')
    : null;
  const displayIcon = logoUrl || (isTenant ? null : appIcon);
  const appName = branding?.customAppName ?? branding?.name ?? (isTenant ? '' : 'Suraksha LMS');
  const primaryColor = branding?.primaryColorCode ?? '#3b82f6';

  // Auto-retry every 5 seconds while offline
  useEffect(() => {
    const id = setInterval(() => {
      void handleRetry();
    }, 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    await new Promise(r => setTimeout(r, 600));
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
    setRetrying(false);
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-6 z-50">
      <div className="flex flex-col items-center gap-6 max-w-xs w-full text-center">
        {displayIcon && (
          <img
            src={displayIcon}
            alt={appName}
            className="w-16 h-16 rounded-2xl object-contain shadow-sm"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}

        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: `${primaryColor}18` }}
        >
          <WifiOff className="w-8 h-8" style={{ color: primaryColor }} />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">No Internet Connection</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please check your connection and try again.
          </p>
        </div>

        <button
          onClick={handleRetry}
          disabled={retrying}
          className="w-full py-3 px-6 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: primaryColor }}
        >
          <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying…' : 'Retry'}
        </button>

        <p className="text-xs text-muted-foreground">Checking automatically every 5 seconds</p>
      </div>
    </div>
  );
};

export default CapacitorConnectionError;
