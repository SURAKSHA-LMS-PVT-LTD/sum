import React from 'react';
import { useTenant } from '@/contexts/TenantContext';

interface AppLoadingScreenProps {
  message?: string;
  iconUrl?: string;
}

const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  message = 'Loading...',
  iconUrl,
}) => {
  const { branding } = useTenant();
  const resolvedIconUrl = iconUrl || branding?.logoUrl || branding?.loginLogoUrl;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      {resolvedIconUrl && (
        <img src={resolvedIconUrl} alt="Loading Logo" className="mb-4 h-16 w-16 object-contain" />
      )}
      <div className="flex items-center space-x-2">
        <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default AppLoadingScreen;
