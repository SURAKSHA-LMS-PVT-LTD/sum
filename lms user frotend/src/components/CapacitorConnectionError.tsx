import React from 'react';
import { RefreshCw, Wifi, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface CapacitorConnectionErrorProps {
  onRetry?: () => void;
}

const CapacitorConnectionError: React.FC<CapacitorConnectionErrorProps> = ({ onRetry }) => {
  const handleRefresh = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Wifi className="h-16 w-16 text-gray-300" />
              <AlertCircle className="h-8 w-8 text-red-500 absolute -bottom-1 -right-1" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            Connection Error
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Unable to connect to the server
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              Please make sure:
            </p>
            <ul className="list-disc list-inside text-sm text-amber-700 mt-2 space-y-1">
              <li>Development server is running</li>
              <li>Your device is connected to the same network</li>
              <li>Firewall is not blocking the connection</li>
            </ul>
          </div>
          
          <div className="text-center text-sm text-gray-600">
            <p>Server: <code className="bg-gray-100 px-2 py-1 rounded text-xs">lms.suraksha.lk</code></p>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-3">
          <Button 
            onClick={handleRefresh} 
            className="w-full"
            size="lg"
          >
            <RefreshCw className="mr-2 h-5 w-5" />
            Retry Connection
          </Button>
          
          <p className="text-xs text-center text-gray-500">
            If the problem persists, check the terminal logs
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CapacitorConnectionError;
