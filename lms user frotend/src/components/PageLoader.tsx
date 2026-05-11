import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

interface PageLoaderProps {
  message?: string;
}

const PageLoader: React.FC<PageLoaderProps> = ({ message = 'Loading...' }) => {
  const { selectedInstitute } = useAuth();
  const { branding } = useTenant();

  const iconUrl = selectedInstitute?.loadingGifUrl || selectedInstitute?.logo || branding?.logoUrl;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      {iconUrl && (
        <img src={iconUrl} alt="Loading Logo" className="h-16 w-16 mb-4 object-contain" />
      )}
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default PageLoader;
