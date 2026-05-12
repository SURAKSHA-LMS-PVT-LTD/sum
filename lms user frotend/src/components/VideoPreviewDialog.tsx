import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VideoPlayer from './VideoPlayer';

interface VideoPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoType: string;
  title: string;
}

const VideoPreviewDialog: React.FC<VideoPreviewDialogProps> = ({ isOpen, onClose, videoUrl, videoType, title }) => {
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
