import React from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { Button } from './button';

interface PDFViewerProps {
  url: string;
  title?: string;
  className?: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ url, title = "PDF Document", className = "" }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = title;
    link.click();
  };

  const handleOpenNewTab = () => {
    window.open(url, '_blank');
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleOpenNewTab}
            className="h-8"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Open
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            className="h-8"
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 relative bg-muted/30">
        <embed
          src={url}
          type="application/pdf"
          className="w-full h-full"
          title={title}
        />
      </div>
    </div>
  );
};
