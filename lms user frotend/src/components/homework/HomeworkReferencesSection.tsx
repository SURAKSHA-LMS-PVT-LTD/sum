import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Loader2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { 
  homeworkReferencesApi, 
  HomeworkReference, 
  ReferenceSummary 
} from '@/api/homeworkReferences.api';
import HomeworkReferenceList from './HomeworkReferenceList';
import AddReferenceDialog from './AddReferenceDialog';
import { getErrorMessage } from '@/api/apiError';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';

interface HomeworkReferencesSectionProps {
  homeworkId: string;
  /** Initial references if already loaded with homework */
  initialReferences?: HomeworkReference[];
  /** Whether to show add/edit controls */
  editable?: boolean;
}

const HomeworkReferencesSection: React.FC<HomeworkReferencesSectionProps> = ({
  homeworkId,
  initialReferences,
  editable: editableProp,
}) => {
  const { toast } = useToast();
  const instituteRole = useInstituteRole();
  
  const [references, setReferences] = useState<HomeworkReference[]>(initialReferences || []);
  const [summary, setSummary] = useState<ReferenceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(!initialReferences);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null; title: string }>({ open: false, id: null, title: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  // Determine if user can edit
  const canEdit = editableProp ?? (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher');

  const fetchReferences = async () => {
    setIsLoading(true);
    try {
      const [refsData, summaryData] = await Promise.all([
        homeworkReferencesApi.getReferencesByHomework(homeworkId),
        homeworkReferencesApi.getReferenceSummary(homeworkId),
      ]);
      setReferences(refsData);
      setSummary(summaryData);
    } catch (error: any) {
      console.error('Failed to fetch references:', error);
      toast({
        title: 'Failed to load references',
        description: getErrorMessage(error, 'Could not load reference materials'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialReferences) {
      fetchReferences();
    }
  }, [homeworkId]);

  const handleAddSuccess = (newReference: HomeworkReference) => {
    setReferences(prev => [...prev, newReference]);
    if (summary) {
      setSummary({
        ...summary,
        total: summary.total + 1,
        byType: {
          ...summary.byType,
          [newReference.referenceType]: (summary.byType[newReference.referenceType] || 0) + 1,
        },
        bySource: {
          ...summary.bySource,
          [newReference.referenceSource]: (summary.bySource[newReference.referenceSource] || 0) + 1,
        },
      });
    }
  };

  const handleDelete = (id: string) => {
    const ref = references.find(r => r.id === id);
    setDeleteDialog({ open: true, id, title: ref?.title || 'this reference' });
  };
  const confirmDelete = async () => {
    if (!deleteDialog.id) return;
    setIsDeleting(true);
    try {
      await homeworkReferencesApi.deleteReference(deleteDialog.id);
      setReferences(prev => prev.filter(ref => ref.id !== deleteDialog.id));
      toast({ title: 'Reference deleted', description: 'The reference has been removed' });
      setDeleteDialog({ open: false, id: null, title: '' });
      const summaryData = await homeworkReferencesApi.getReferenceSummary(homeworkId);
      setSummary(summaryData);
    } catch (error: any) {
      toast({ title: 'Delete failed', description: getErrorMessage(error, 'Could not delete reference'), variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReorder = async (referenceIds: string[]) => {
    try {
      await homeworkReferencesApi.reorderReferences(homeworkId, referenceIds);
      // Reorder local state
      const reorderedRefs = referenceIds
        .map(id => references.find(r => r.id === id))
        .filter(Boolean) as HomeworkReference[];
      setReferences(reorderedRefs);
    } catch (error: any) {
      console.error('Failed to reorder references:', error);
      toast({
        title: 'Reorder failed',
        description: getErrorMessage(error, 'Could not reorder references'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Reference Materials</span>
          {summary && summary.total > 0 && (
            <Badge variant="secondary" className="text-xs h-5">{summary.total}</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchReferences}
            disabled={isLoading}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          {canEdit && (
            <Button
              type="button"
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
              className="h-7 text-xs px-2"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Summary badges */}
      {summary && summary.total > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(summary.byType)
            .filter(([_, count]) => count > 0)
            .map(([type, count]) => (
              <Badge key={type} variant="outline" className="text-[10px] h-5 px-1.5">
                {type}: {count}
              </Badge>
            ))}
        </div>
      )}

      {/* Content */}
      <div className="rounded-lg border bg-muted/30 p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : references.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Paperclip className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">No reference materials</p>
            {canEdit && (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setIsAddDialogOpen(true)}
                className="text-xs h-6 mt-1"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add first reference
              </Button>
            )}
          </div>
        ) : (
          <HomeworkReferenceList
            references={references}
            isEditable={canEdit}
            onDelete={handleDelete}
            onReorder={handleReorder}
          />
        )}
      </div>

      {/* Add Reference Dialog */}
      <AddReferenceDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        homeworkId={homeworkId}
        onSuccess={handleAddSuccess}
      />
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        itemName={deleteDialog.title}
        itemType="reference"
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default HomeworkReferencesSection;
