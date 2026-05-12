import React from 'react';
import { usePermission } from '../../hooks/usePermission';

export const Permission: React.FC<{ required: string; children: React.ReactNode }> = ({ required, children }) => {
  const [featureKey, action] = required.split('.');
  const permission = usePermission(featureKey);

  if (action === 'view' && permission.canView) {
    return <>{children}</>;
  }

  if (action === 'create' && permission.canCreate) {
    return <>{children}</>;
  }

  if (action === 'update' && permission.canUpdate) {
    return <>{children}</>;
  }

  if (action === 'delete' && permission.canDelete) {
    return <>{children}</>;
  }

  return null;
};