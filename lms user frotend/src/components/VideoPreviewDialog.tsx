import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VideoPlayer from './VideoPlayer';

interface VideoPreviewDialogProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  videoUrl?: string;
  url?: string;
  videoType?: string;
  title?: string;
  description?: string;
  materials?: any;
}

const VideoPreviewDialog: React.FC<VideoPreviewDialogProps> = ({ isOpen, open, onClose, onOpenChange, videoUrl, url, videoType, title }) => {
  const dialogOpen = isOpen ?? open ?? false;
  const handleOpenChange = (v: boolean) => { onOpenChange?.(v); if (!v) onClose?.(); };
  const src = videoUrl ?? url ?? '';
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full mt-4">
          {isOpen && <VideoPlayer src={videoUrl} type={videoType} />}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoPreviewDialog;
