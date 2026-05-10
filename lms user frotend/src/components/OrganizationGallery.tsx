
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera } from 'lucide-react';

interface OrganizationGalleryProps {
  organizationId: string;
}

const OrganizationGallery = ({ organizationId }: OrganizationGalleryProps) => {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Gallery</h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Organization photos and media
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
          <Camera className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-gray-400 mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">No Photos Available</h3>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center">
            Gallery feature will be implemented soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizationGallery;
