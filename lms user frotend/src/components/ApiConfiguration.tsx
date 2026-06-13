import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import { getBaseUrl } from '@/contexts/utils/auth.api';

const ApiConfiguration = () => {
  const configuredUrl = getBaseUrl();

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          API Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Current API Base URL:</strong> {configuredUrl}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            The API URL is configured via environment variables (VITE_LMS_BASE_URL).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiConfiguration;