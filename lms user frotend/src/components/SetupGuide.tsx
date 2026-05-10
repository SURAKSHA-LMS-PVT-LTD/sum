import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Settings, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useAppNavigation } from '@/hooks/useAppNavigation';

const SetupGuide = () => {
  const { toast } = useToast();
  const { navigateToPage } = useAppNavigation();
  
  const setupSteps = [
    {
      id: 'api-config',
      title: 'Configure API Base URL',
      description: 'Set your backend API endpoint to connect to your server',
      action: 'Go to Settings',
      status: localStorage.getItem('baseUrl') ? 'completed' : 'pending',
      route: 'settings'
    },
    {
      id: 'institute-select',
      title: 'Institutes',
      description: 'Choose your institute to access institute-specific features',
      action: 'Go to Institutes',
      status: localStorage.getItem('selectedInstitute') ? 'completed' : 'pending',
      route: 'select-institute'
    },
    {
      id: 'attendance-test',
      title: 'Test Attendance System',
      description: 'Verify that the attendance system is working correctly',
      action: 'View Attendance',
      status: 'pending',
      route: 'attendance'
    }
  ];

  const quickSetupPort3000 = () => {
    const url = 'http://localhost:3000';
    localStorage.setItem('baseUrl', url);
    
    toast({
      title: "Quick Setup Complete",
      description: "API base URL configured for localhost:3000",
    });
    
    // Force page refresh to update status
    window.location.reload();
  };

  const handleStepAction = (route: string) => {
    navigateToPage(route);
  };

  const getStatusIcon = (status: string) => {
    if (status === 'completed') {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <AlertCircle className="h-5 w-5 text-amber-500" />;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'completed') {
      return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Settings className="h-8 w-8" />
          Setup Guide
        </h1>
        <p className="text-muted-foreground">
          Get started with configuring your attendance management system
        </p>
      </div>

      {/* Quick Setup Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Quick setup for local development (localhost:3000)</span>
          <Button onClick={quickSetupPort3000} size="sm" variant="outline">
            Quick Setup
          </Button>
        </AlertDescription>
      </Alert>

      {/* Setup Steps */}
      <div className="space-y-4">
        {setupSteps.map((step, index) => (
          <Card key={step.id} className="transition-all hover:shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {step.title}
                      {getStatusIcon(step.status)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {getStatusBadge(step.status)}
                  <Button 
                    onClick={() => handleStepAction(step.route)}
                    variant="outline"
                    size="sm"
                  >
                    {step.action}
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">API Base URL</div>
              <div className="text-sm text-muted-foreground">
                {localStorage.getItem('baseUrl') || 'Not configured'}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Selected Institute</div>
              <div className="text-sm text-muted-foreground">
                {localStorage.getItem('selectedInstitute') ? 
                  JSON.parse(localStorage.getItem('selectedInstitute') || '{}').name || 'Selected' : 
                  'Not selected'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>API Configuration:</strong> Go to Settings to configure your backend API URL. For local development, use http://localhost:3000
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Attendance Issues:</strong> Make sure your API base URL is correct and your backend server is running on the specified port
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Port Problems:</strong> If you see port 3003 errors, update your API base URL to use port 3000 in Settings
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupGuide;