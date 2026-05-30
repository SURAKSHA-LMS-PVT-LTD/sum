import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { useAuth } from '@/contexts/AuthContext';

interface UserMetadata {
  userId?: string;
  email?: string;
  phoneNumber?: string;
  instituteUserType?: string;
}

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  userMetadata?: UserMetadata;
}

// Generate random invisible marking points for image authentication
const generateInvisibleMarkers = () => {
  const markers = [];
  for (let i = 0; i < 12; i++) {
    markers.push({
      id: i,
      top: Math.random() * 85 + 5,
      left: Math.random() * 85 + 5,
      size: Math.random() * 8 + 3,
    });
  }
  return markers;
};

// Mask email
const maskEmail = (email?: string) => {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.length > 3 ? local.slice(0, 2) : local.slice(0, 1);
  const masked = visible + '*'.repeat(Math.max(3, local.length - visible.length));
  return `${masked}@${domain}`;
};

const InvisibleMarker = ({ marker }: { marker: ReturnType<typeof generateInvisibleMarkers>[0] }) => (
  <div
    className="absolute rounded-full pointer-events-none select-none"
    style={{
      top: `${marker.top}%`,
      left: `${marker.left}%`,
      width: `${marker.size}px`,
      height: `${marker.size}px`,
      backgroundColor: 'rgba(239, 68, 68, 0.04)',
      border: '1px solid rgba(239, 68, 68, 0.06)',
      transform: 'translate(-50%, -50%)',
      boxShadow: '0 0 2px rgba(239, 68, 68, 0.03)',
    }}
  />
);

const ImagePreviewModal = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  userMetadata
}: ImagePreviewModalProps) => {
  const { user } = useAuth();
  const [markers, setMarkers] = useState<ReturnType<typeof generateInvisibleMarkers>>([]);

  useEffect(() => {
    if (isOpen) {
      setMarkers(generateInvisibleMarkers());
    }
  }, [isOpen]);

  return <Dialog open={isOpen} onOpenChange={onClose} routeName="image-preview-modal-popup">
      <DialogContent className="max-w-4xl max-h-[95vh] p-0 border-0">
        <DialogHeader className="p-4 pb-0 sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center p-0">
          <div className="relative inline-block bg-black/5 overflow-hidden">
            <img 
              src={getImageUrl(imageUrl)} 
              alt={title} 
              className="w-full h-auto max-h-[92vh] object-contain select-none block"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
            
            {/* Invisible Micro-markers for Authentication - Overlaid on Image */}
            {markers.map(marker => (
              <InvisibleMarker key={marker.id} marker={marker} />
            ))}

            {/* Very Subtle Watermark Pattern - Overlaid on Image */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 150px,
                rgba(239, 68, 68, 0.05) 150px,
                rgba(239, 68, 68, 0.05) 300px
              )`,
            }} />
            
            {/* Owner Information - Distributed on Image */}
            {/* Name - Center Top */}
            {user?.name && (
              <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-auto">
                <div className="text-white text-[11px] bg-black/40 px-3 py-1.5 rounded font-semibold opacity-85">
                  Opened: {user.name}
                </div>
              </div>
            )}
            
            {/* Email - Bottom Left */}
            {user?.email && (
              <div className="absolute bottom-4 left-4 pointer-events-auto">
                <div className="text-white text-[10px] bg-black/40 px-2 py-1 rounded opacity-85">
                  Email: {maskEmail(user.email)}
                </div>
              </div>
            )}
            
            {/* ID - Bottom Right */}
            {user?.id && (
              <div className="absolute bottom-4 right-4 pointer-events-auto">
                <div className="text-white text-[10px] bg-black/40 px-2 py-1 rounded opacity-85">
                  ID: {user.id}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>;
};
export default ImagePreviewModal;