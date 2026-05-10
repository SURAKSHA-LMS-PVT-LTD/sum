import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileText, ExternalLink, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { safeOpenUrl } from "@/lib/api";

interface Document {
  documentName: string;
  documentUrl: string;
}

interface DocumentsPopoverProps {
  documents: Document[];
}

export function DocumentsPopover({ documents }: DocumentsPopoverProps) {
  if (!documents || documents.length === 0) {
    return (
      <Badge variant="secondary" className="bg-muted text-muted-foreground">
        No Documents
      </Badge>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Documents
          <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
            {documents.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b bg-muted/50">
          <h4 className="font-medium text-sm">Lecture Documents</h4>
          <p className="text-xs text-muted-foreground">{documents.length} document(s) available</p>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {documents.map((doc, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 hover:bg-muted/50 border-b last:border-b-0"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{doc.documentName}</span>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => safeOpenUrl(doc.documentUrl)}
                  title="View"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = doc.documentUrl;
                    link.download = doc.documentName;
                    link.click();
                  }}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
