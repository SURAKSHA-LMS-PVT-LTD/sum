import React from 'react';
import ImageCropUpload from '@/components/common/ImageCropUpload';

interface ClassImageUploadProps {
  currentImageUrl?: string | null;
  onImageUpdate: (newImageUrl: string) => void;
  className?: string;
}

const ClassImageUpload: React.FC<ClassImageUploadProps> = ({
  currentImageUrl,
  onImageUpdate,
  className = ""
}) => {
  return (
    <ImageCropUpload
      currentImageUrl={currentImageUrl}
      onImageUpdate={onImageUpdate}
      folder="institute-images"
      aspectRatio={4/3}
      label="Class Image"
      className={className}
    />
  );
};

export default ClassImageUpload;
