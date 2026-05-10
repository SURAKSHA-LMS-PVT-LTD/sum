import React from 'react';
import { Settings } from 'lucide-react';

interface UnderMaintenanceProps {
  title?: string;
  description?: string;
}

const UnderMaintenance = ({ 
  title = "Dashboard Under Maintenance",
  description = "We're working on improving the dashboard experience. Please check back later or use the sidebar to navigate to other features."
}: UnderMaintenanceProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Settings className="h-16 w-16 text-muted-foreground" />
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      </div>
    </div>
  );
};

export default UnderMaintenance;
