import React from 'react';
import { useRoutes } from '../routing/hooks';
import { PAGE_REGISTRY } from '../routing/registry';
import { NotFound } from '../components/NotFound';
import { AccessDenied } from '../components/AccessDenied';
import { usePermission } from '../hooks/usePermission';

export function AppContent() {
  const routes = useRoutes();
  const { path, element, featureKey } = routes[0] ?? {};

  if (!element) {
    return <NotFound />;
  }

  if (featureKey) {
    const permission = usePermission(featureKey);
    if (!permission.canView) {
      return <AccessDenied featureKey={featureKey} />;
    }
  }

  const Component = PAGE_REGISTRY.get(element);
  if (!Component) {
    return <NotFound />;
  }

  return <Component />;
}
