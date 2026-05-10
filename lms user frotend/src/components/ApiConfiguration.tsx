import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';

const ApiConfiguration = () => {
  const { toast } = useToast();
  const [baseUrl, setBaseUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load current configuration
    const currentBaseUrl = localStorage.getItem('baseUrl') || '';
    setBaseUrl(currentBaseUrl);
  }, []);

  const handleSave = () => {
    setIsLoading(true);
    
    try {
      // Ensure URL format is correct
      let formattedUrl = baseUrl;
      if (formattedUrl && !formattedUrl.startsWith('http')) {
        formattedUrl = `http://${formattedUrl}`;
      }
      
      // Remove trailing slash
      if (formattedUrl.endsWith('/')) {
        formattedUrl = formattedUrl.slice(0, -1);
      }
      
      localStorage.setItem('baseUrl', formattedUrl);
      
      toast({
        title: "Configuration Saved",
        description: `API base URL updated to: ${formattedUrl}`,
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: getErrorMessage(error, 'Failed to save API configuration'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSetPort3000 = () => {
    const url = 'http://localhost:3000';
    setBaseUrl(url);
    localStorage.setItem('baseUrl', url);
    
    toast({
      title: "Quick Setup",
      description: "API base URL set to localhost:3000",
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          API Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="baseUrl">API Base URL</Label>
          <Input
            id="baseUrl"
            placeholder="http://localhost:3000"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Enter your backend API URL (e.g., http://localhost:3000)
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
          
          <Button variant="outline" onClick={handleQuickSetPort3000}>
            Quick Setup (Port 3000)
          </Button>
        </div>
        
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Current API Base URL:</strong> {localStorage.getItem('baseUrl') || 'Not configured'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiConfiguration;