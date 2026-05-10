import React from 'react';
import ImageCropUpload from '@/components/common/ImageCropUpload';

interface OrganizationImageUploadProps {
  currentImageUrl?: string | null;
  onImageUpdate: (newImageUrl: string) => void;
  organizationName?: string;
}

const OrganizationImageUpload: React.FC<OrganizationImageUploadProps> = ({
  currentImageUrl,
  onImageUpdate,
  organizationName = "Organization"
}) => {
  return (
    <ImageCropUpload
      currentImageUrl={currentImageUrl}
      onImageUpdate={onImageUpdate}
      folder="institute-images"
      aspectRatio={4/3}
      label="Organization Image"
    />
  );
};

export default OrganizationImageUpload;
