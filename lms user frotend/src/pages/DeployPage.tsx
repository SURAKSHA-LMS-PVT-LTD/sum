import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DeployPage = () => {
  const navigate = useNavigate();

  const handleDeploy = () => {
    // Add deployment logic here
    alert('Deploying application...');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Deploy Application</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Deploy to Production</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Click the button below to deploy the latest version of the application.
          </p>
          <Button className="mt-4" onClick={handleDeploy}>
            <Rocket className="mr-2 h-4 w-4" />
            Deploy Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeployPage;
