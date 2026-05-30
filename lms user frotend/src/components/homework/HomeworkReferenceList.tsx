import React, { useState } from 'react';
import { 
  Video, 
  Image, 
  FileText, 
  File, 
  Link as LinkIcon, 
  Music, 
  ExternalLink, 
  Download,
  Play,
  Eye,
  Trash2,
  GripVertical,
  MoreVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HomeworkReference, ReferenceType, formatFileSize, formatDuration } from '@/api/homeworkReferences.api';

interface HomeworkReferenceListProps {
  references: HomeworkReference[];
  isEditable?: boolean;
  onDelete?: (id: string) => void;
  onReorder?: (referenceIds: string[]) => void;
}

const getReferenceIcon = (type: ReferenceType) => {
  const icons = {
    VIDEO: Video,
    IMAGE: Image,
    PDF: FileText,
    DOCUMENT: File,
    LINK: LinkIcon,
    AUDIO: Music,
    OTHER: File,
  };
  return icons[type] || File;
};

const getTypeColor = (type: ReferenceType) => {
  const colors: Record<ReferenceType, string> = {
    VIDEO: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    IMAGE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PDF: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    DOCUMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    LINK: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    AUDIO: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return colors[type] || colors.OTHER;
};

const HomeworkReferenceList: React.FC<HomeworkReferenceListProps> = ({
  references,
  isEditable = false,
  onDelete,
  onReorder,
}) => {
  const [previewItem, setPreviewItem] = useState<HomeworkReference | null>(null);

  const getViewUrl = (ref: HomeworkReference): string | undefined => {
    if (ref.viewUrl) return ref.viewUrl;
    if (ref.driveViewUrl) return ref.driveViewUrl;
    if (ref.externalUrl) return ref.externalUrl;
    if (ref.fileUrl) return ref.fileUrl;
    return undefined;
  };

  const handleView = (ref: HomeworkReference) => {
    const url = getViewUrl(ref);
    if (ref.referenceType === 'IMAGE' || ref.referenceType === 'VIDEO' || ref.referenceType === 'PDF') {
      setPreviewItem(ref);
    } else if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = (ref: HomeworkReference) => {
    const url = ref.driveDownloadUrl || ref.viewUrl || ref.fileUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const renderPreviewContent = () => {
    if (!previewItem) return null;

    const url = getViewUrl(previewItem);
    
    switch (previewItem.referenceType) {
      case 'VIDEO':
        if (previewItem.driveEmbedUrl) {
          return (
            <iframe
              src={previewItem.driveEmbedUrl}
              className="w-full aspect-video rounded-lg"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          );
        }
        return (
          <video
            src={url}
            controls
            className="w-full max-h-[70vh] rounded-lg"
          >
            Your browser does not support video playback.
          </video>
        );
      
      case 'IMAGE':
        return (
          <img
            src={url}
            alt={previewItem.title}
            className="w-full max-h-[70vh] object-contain rounded-lg"
          />
        );
      
      case 'PDF':
        return (
          <iframe
            src={url}
            className="w-full h-[70vh] rounded-lg"
            title={previewItem.title}
          />
        );
      
      default:
        return (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Preview not available for this file type.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => handleDownload(previewItem)}
            >
              <Download className="h-4 w-4 mr-2" />
              Download File
            </Button>
          </div>
        );
    }
  };

  if (references.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <File className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No reference materials attached</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {references.map((ref, index) => {
          const Icon = getReferenceIcon(ref.referenceType);
          const url = getViewUrl(ref);
          
          return (
            <div
              key={ref.id}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors group"
            >
              {isEditable && (
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
              
              <div className={`p-2 rounded-lg ${getTypeColor(ref.referenceType)}`}>
                <Icon className="h-5 w-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm truncate">{ref.title}</h4>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {ref.referenceType}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  {ref.fileName && <span className="truncate">{ref.fileName}</span>}
                  {ref.fileSize && <span>• {formatFileSize(ref.fileSize)}</span>}
                  {ref.videoDuration && <span>• {formatDuration(ref.videoDuration)}</span>}
                  {ref.referenceSource === 'GOOGLE_DRIVE' && (
                    <Badge variant="secondary" className="text-xs">Drive</Badge>
                  )}
                  {ref.referenceSource === 'MANUAL_LINK' && (
                    <Badge variant="secondary" className="text-xs">Link</Badge>
                  )}
                </div>
                {ref.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {ref.description}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                {url && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleView(ref)}
                      className="h-8 w-8 p-0"
                    >
                      {ref.referenceType === 'VIDEO' ? (
                        <Play className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {ref.referenceSource !== 'MANUAL_LINK' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(ref)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {ref.referenceSource === 'MANUAL_LINK' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                        className="h-8 w-8 p-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
                
                {isEditable && onDelete && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onDelete(ref.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)} routeName="preview-homework-reference-popup">
        <DialogContent className="max-w-4xl max-h-[95vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewItem && (
                <>
                  {React.createElement(getReferenceIcon(previewItem.referenceType), { className: 'h-5 w-5' })}
                  {previewItem.title}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            {renderPreviewContent()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HomeworkReferenceList;
