import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Building2, Trash2 } from 'lucide-react';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { Organization } from '@/api/organization.api';
import ImagePreviewModal from './ImagePreviewModal';
import { Button } from '@/components/ui/button';

interface OrganizationCardProps {
  organization: Organization;
  onSelect: (organization: Organization) => void;
  buttonText?: string;
  buttonIcon?: React.ReactNode;
  showDetails?: boolean;
  onDelete?: (organization: Organization) => void;
  showDeleteButton?: boolean;
}

const OrganizationCard = ({ 
  organization, 
  onSelect, 
  buttonText = "Select Organization",
  buttonIcon,
  showDetails = true,
  onDelete,
  showDeleteButton = false
}: OrganizationCardProps) => {
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageClick = () => {
    if (organization.imageUrl && !imageError) {
      setImagePreviewOpen(true);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden w-full max-w-sm">
        <div className="relative h-48 bg-gray-100 overflow-hidden">
          {organization.imageUrl && !imageError ? (
            <img 
              src={getImageUrl(organization.imageUrl)} 
              alt={organization.name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
              onClick={handleImageClick}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
              <Building2 className="w-16 h-16 text-blue-400" />
            </div>
          )}
        </div>
        
        <div className="p-4 flex-1 flex flex-col">
          <h5 className="mb-2 block font-sans text-lg font-semibold leading-snug tracking-normal text-gray-900 antialiased group-hover:text-blue-600 transition-colors duration-300">
            {organization.name}
          </h5>
          <p className="block font-sans text-sm font-light leading-relaxed text-gray-700 antialiased mb-3">
            {organization.type.toLowerCase()} Organization
          </p>
          
          
          <div className="mt-4 space-y-2">
            <button
              onClick={() => onSelect(organization)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
            >
              {buttonIcon}
              {buttonText}
            </button>
            
            {showDeleteButton && onDelete && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(organization);
                }}
                variant="destructive"
                size="sm"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Organization
              </Button>
            )}
          </div>
        </div>
      </div>

      <ImagePreviewModal
        isOpen={imagePreviewOpen}
        onClose={() => setImagePreviewOpen(false)}
        imageUrl={getImageUrl(organization.imageUrl)}
        title={organization.name}
      />
    </>
  );
};

export default OrganizationCard;