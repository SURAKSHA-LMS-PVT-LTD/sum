import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useTenant } from '@/contexts/TenantContext';

interface Props {
  pageTitle?: string;   // e.g. "Dashboard" — prepended to site name
  noindex?: boolean;    // defaults to true for all logged-in pages
}

export const TenantHelmet: React.FC<Props> = ({ pageTitle, noindex = true }) => {
  const { branding, isTenantLogin } = useTenant();
  if (!isTenantLogin || !branding) return null;

  const siteName = branding.customAppName || branding.name;
  const fullTitle = pageTitle ? `${pageTitle} — ${siteName}` : siteName;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:site_name" content={siteName} />
    </Helmet>
  );
};
