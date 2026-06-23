import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';

interface TrackingViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'recording' → /view-recording/:urlId, 'live' → /live-lecture/:urlId */
  mode: 'recording' | 'live';
  urlId: string;
  title?: string;
  /** Extra query params forwarded into the iframe URL */
  extraParams?: Record<string, string>;
}

/**
 * Opens a tracked recording or live lecture inside a dialog iframe so the
 * student never leaves the current page. The iframe URL is the same
 * full-page route (/view-recording/:id or /live-lecture/:id), so all
 * activity tracking, session management, and welcome flows work unchanged.
 */
const TrackingViewDialog: React.FC<TrackingViewDialogProps> = ({
  open,
  onOpenChange,
  mode,
  urlId,
  title,
  extraParams = {},
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [expanded, setExpanded] = useState(false);

  const basePath = mode === 'recording' ? '/view-recording' : '/live-lecture';
  const params = new URLSearchParams({ tab: mode === 'live' ? 'login' : 'login', ...extraParams });
  const src = `${window.location.origin}${basePath}/${urlId}?${params.toString()}`;

  // Reset expanded state when dialog closes
  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  const openExternal = () => {
    window.open(src, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`p-0 gap-0 overflow-hidden border-0 shadow-2xl transition-all duration-300 ${
          expanded
            ? 'w-screen h-screen max-w-none rounded-none'
            : 'w-[95vw] max-w-5xl h-[90vh] rounded-2xl'
        }`}
        style={{ maxHeight: expanded ? '100vh' : '90vh' }}
      >
        {/* Thin top bar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900 text-white shrink-0">
          <span className="text-xs font-medium truncate text-white/80 flex-1">{title || (mode === 'live' ? 'Live Lecture' : 'Recording')}</span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={openExternal}
              className="p-1.5 rounded hover:bg-white/10 transition-colors text-white/70 hover:text-white"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded hover:bg-white/10 transition-colors text-white/70 hover:text-white"
              title={expanded ? 'Restore' : 'Fullscreen'}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded hover:bg-white/10 transition-colors text-white/70 hover:text-white"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Iframe */}
        {open && (
          <iframe
            ref={iframeRef}
            src={src}
            className="w-full flex-1 border-0"
            style={{ height: 'calc(100% - 36px)' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; microphone; camera"
            allowFullScreen
            title={title || mode}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TrackingViewDialog;
