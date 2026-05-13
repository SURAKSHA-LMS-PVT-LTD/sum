import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Lock } from 'lucide-react';

export const AccessDenied: React.FC<{ featureName?: string }> = ({ featureName }) => (
  <Card className="m-4">
    <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold">Access Restricted</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {featureName
          ? `You don't have permission to access ${featureName}.`
          : "You don't have permission to view this page."}
        Contact your institute admin to request access.
      </p>
    </CardContent>
  </Card>
);
