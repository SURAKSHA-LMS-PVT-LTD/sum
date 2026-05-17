import React, { useState } from 'react';
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
  onSpeedChange?: (speed: number) => void;
  initialSpeed?: number;
}

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.slice(1).split('?')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {}
  return null;
}

function getDriveEmbedUrl(url: string): string | null {
  try {
    // https://drive.google.com/file/d/FILE_ID/view  →  /preview
    const match = url.match(/\/file\/d\/([^/]+)/);
    if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
    // already an embed/preview url
    if (url.includes('drive.google.com') && url.includes('preview')) return url;
  } catch {}
  return null;
}

const VideoPreviewDialog: React.FC<VideoPreviewDialogProps> = ({
  isOpen,
  open,
  onClose,
  onOpenChange,
  videoUrl,
  url,
  videoType,
  title,
  onSpeedChange,
  initialSpeed = 1,
}) => {
  const dialogOpen = isOpen ?? open ?? false;
  const [liveSpeed, setLiveSpeed] = useState(initialSpeed);

  const handleOpenChange = (v: boolean) => {
    onOpenChange?.(v);
    if (!v) onClose?.();
  };

  const handleSpeedChange = (speed: number) => {
    setLiveSpeed(speed);
    onSpeedChange?.(speed);
  };

  const src = videoUrl ?? url ?? '';

  const youtubeEmbed = src ? getYouTubeEmbedUrl(src) : null;
  const driveEmbed   = !youtubeEmbed && src ? getDriveEmbedUrl(src) : null;
  const isEmbed      = !!(youtubeEmbed || driveEmbed);
  const embedSrc     = youtubeEmbed ?? driveEmbed ?? '';

  const speedBadgeColor =
    liveSpeed >= 2 ? 'bg-red-500' :
    liveSpeed >= 1.5 ? 'bg-orange-500' :
    liveSpeed > 1 ? 'bg-amber-500' :
    liveSpeed < 1 ? 'bg-blue-500' :
    'bg-green-600';

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl p-3 sm:p-4 gap-3">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-6">
            <DialogTitle className="text-sm sm:text-base leading-snug flex-1">{title}</DialogTitle>
            {/* Live speed badge — always visible so student knows their current speed */}
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-white text-xs font-bold ${speedBadgeColor}`}>
              {liveSpeed}x
            </span>
          </div>
        </DialogHeader>

        {/* Responsive 16:9 container */}
        <div className="relative w-full" style={{ paddingBottom: isEmbed ? '56.25%' : undefined }}>
          {isEmbed ? (
            <iframe
              src={embedSrc}
              className="absolute inset-0 w-full h-full rounded-md"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <div className="w-full">
              {dialogOpen && (
                <VideoPlayer
                  src={src}
                  type={videoType ?? 'video/mp4'}
                  onSpeedChange={handleSpeedChange}
                  initialSpeed={initialSpeed}
                />
              )}
            </div>
          )}
        </div>

        {/* Speed note for embed players (YouTube/Drive don't report speed back) */}
        {isEmbed && (
          <p className="text-[10px] text-muted-foreground text-center -mt-1">
            Speed changes inside YouTube/Drive players are not tracked automatically.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VideoPreviewDialog;
