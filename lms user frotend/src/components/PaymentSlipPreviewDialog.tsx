import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Download, FileText, Loader2 } from 'lucide-react';

interface PaymentSlipPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
const PDF_EXTENSIONS = ['pdf'];

function getFileType(url: string): 'image' | 'pdf' | 'unknown' {
  if (!url) return 'unknown';
  // Strip query params and hash before checking extension
  const cleanUrl = url.split('?')[0].split('#')[0];
  const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (PDF_EXTENSIONS.includes(ext)) return 'pdf';
  // Check common content-type hints in signed URLs
  if (url.includes('content-type=image') || url.includes('response-content-type=image')) return 'image';
  if (url.includes('content-type=application%2Fpdf') || url.includes('response-content-type=application%2Fpdf')) return 'pdf';
  return 'unknown';
}

const PaymentSlipPreviewDialog: React.FC<PaymentSlipPreviewDialogProps> = ({
  open,
  onOpenChange,
  url,
  title = 'Payment Slip',
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const fileType = useMemo(() => getFileType(url), [url]);

  // Reset loading state when url or dialog changes
  React.useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [url, open]);

  const handleOpenExternal = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] p-0 flex flex-col">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="truncate">{title}</DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleOpenExternal}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in New Tab
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 pt-0">
          {fileType === 'image' && !imgError && (
            <div className="relative flex items-center justify-center min-h-[200px]">
              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              <img
                src={url}
                alt={title}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            </div>
          )}

          {fileType === 'pdf' && (
            <iframe
              src={url}
              title={title}
              className="w-full rounded-lg border"
              style={{ height: '70vh' }}
            />
          )}

          {(fileType === 'unknown' || imgError) && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
              <FileText className="h-16 w-16" />
              <p className="text-center">
                {imgError
                  ? 'Could not load the image preview.'
                  : 'This file type cannot be previewed inline.'}
              </p>
              <div className="flex gap-2">
                <Button variant="default" onClick={handleOpenExternal}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open in New Tab
                </Button>
                <Button variant="outline" asChild>
                  <a href={url} download rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentSlipPreviewDialog;
