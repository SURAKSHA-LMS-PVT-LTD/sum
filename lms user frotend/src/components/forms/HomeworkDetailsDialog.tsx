import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Calendar, Clock, BookOpen, User, Building, GraduationCap } from 'lucide-react';
import { HomeworkReferencesSection } from '@/components/homework/index';

interface HomeworkDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  homework: any;
}

const HomeworkDetailsDialog = ({ isOpen, onClose, homework }: HomeworkDetailsDialogProps) => {
  if (!homework) return null;

  const formatDate = (dateString: string) => {
    return dateString ? new Date(dateString).toLocaleDateString() : 'N/A';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} routeName="homework-details-dialog-popup">
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/60 shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight line-clamp-2">{homework.title}</p>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">Homework Details</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-3 px-4 py-3">

          {/* Description & Instructions */}
          {(homework.description || homework.instructions) && (
            <>
              {homework.description && (
                <div className="py-3.5">
                  <p className="text-[13px] text-muted-foreground leading-none mb-2">Description</p>
                  <p className="text-base leading-relaxed">{homework.description}</p>
                </div>
              )}
              {homework.instructions && (
                <div className="py-3.5 px-5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/40">
                  <p className="text-[13px] text-blue-500/80 leading-none mb-2">Instructions</p>
                  <p className="text-base leading-relaxed text-blue-700 dark:text-blue-300">{homework.instructions}</p>
                </div>
              )}
            </>
          )}

          {/* Context */}
          {(homework.institute || homework.class || homework.subject || homework.teacher) && (
            <>
              <div className="flex items-center gap-3 pt-3">
                <p className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Context</p>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="divide-y divide-border/40">
                {homework.institute && (
                  <div className="flex items-start gap-4 py-3.5">
                    <span className="mt-0.5 text-muted-foreground/60 shrink-0"><Building className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Institute</p>
                      <p className="text-base truncate">{homework.institute.name}</p>
                    </div>
                  </div>
                )}
                {homework.class && (
                  <div className="flex items-start gap-4 py-3.5">
                    <span className="mt-0.5 text-muted-foreground/60 shrink-0"><GraduationCap className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Class</p>
                      <p className="text-base truncate">{homework.class.name}</p>
                    </div>
                  </div>
                )}
                {homework.subject && (
                  <div className="flex items-start gap-4 py-3.5">
                    <span className="mt-0.5 text-primary/60 shrink-0"><BookOpen className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Subject</p>
                      <p className="text-base font-semibold text-primary truncate">{homework.subject.name}</p>
                    </div>
                  </div>
                )}
                {homework.teacher && (
                  <div className="flex items-start gap-4 py-3.5">
                    <span className="mt-0.5 text-muted-foreground/60 shrink-0"><User className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Teacher</p>
                      <p className="text-base truncate">{homework.teacher.name || homework.teacher.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Schedule & Marks */}
          <div className="flex items-center gap-3 pt-3">
            <p className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Schedule & Marks</p>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="divide-y divide-border/40">
            <div className="flex items-start gap-4 py-3.5">
              <span className="mt-0.5 text-green-500/70 shrink-0"><Calendar className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Start Date</p>
                <p className="text-base">{formatDate(homework.startDate)}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 py-3.5">
              <span className="mt-0.5 text-amber-500/70 shrink-0"><Clock className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Due Date</p>
                <p className="text-base">{formatDate(homework.endDate)}</p>
              </div>
            </div>
            {homework.maxMarks && (
              <div className="flex items-start gap-4 py-3.5">
                <span className="mt-0.5 text-muted-foreground/60 shrink-0"><BookOpen className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Max Marks</p>
                  <p className="text-base font-semibold">{homework.maxMarks}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-4 py-3.5">
              <span className="text-muted-foreground/60 shrink-0"><Calendar className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Status</p>
              </div>
              <Badge variant={homework.isActive ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                {homework.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          {/* Resources */}
          {(homework.referenceLink || homework.attachmentUrl) && (
            <>
              <div className="flex items-center gap-3 pt-3">
                <p className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Resources</p>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="flex flex-wrap gap-2.5 py-2">
                {homework.referenceLink && (
                  <Button size="sm" variant="outline" className="h-10 text-sm" onClick={() => window.open(homework.referenceLink, '_blank')}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Reference Link
                  </Button>
                )}
                {homework.attachmentUrl && (
                  <Button size="sm" variant="outline" className="h-10 text-sm" onClick={() => window.open(homework.attachmentUrl, '_blank')}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Attachment
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Reference Materials */}
          {homework.id && (
            <HomeworkReferencesSection 
              homeworkId={homework.id} 
              initialReferences={homework.references}
              editable={false}
            />
          )}

          {/* Timestamps */}
          <div className="flex items-center gap-3 pt-3">
            <p className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Timestamps</p>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="divide-y divide-border/40">
            <div className="flex items-start gap-4 py-3.5">
              <span className="mt-0.5 text-muted-foreground/60 shrink-0"><Clock className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Created</p>
                <p className="text-base">{homework.createdAt ? new Date(homework.createdAt).toLocaleString() : 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 py-3.5">
              <span className="mt-0.5 text-muted-foreground/60 shrink-0"><Clock className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground leading-none mb-1.5">Updated</p>
                <p className="text-base">{homework.updatedAt ? new Date(homework.updatedAt).toLocaleString() : 'N/A'}</p>
              </div>
            </div>
          </div>

        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HomeworkDetailsDialog;