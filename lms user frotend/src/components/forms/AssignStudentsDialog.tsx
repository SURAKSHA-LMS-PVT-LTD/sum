import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Loader2, Plus, X, Clipboard, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { instituteClassesApi, BulkAssignStudentsData } from '@/api/instituteClasses.api';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { Badge } from '@/components/ui/badge';


interface AssignStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignmentComplete: () => void;
}

const AssignStudentsDialog: React.FC<AssignStudentsDialogProps> = ({
  open,
  onOpenChange,
  onAssignmentComplete
}) => {
  const { selectedInstitute, selectedClass } = useAuth();
  const instituteRole = useInstituteRole();
  const { toast } = useToast();
  
  // Check permissions - InstituteAdmin and Teacher only
  const hasPermission = instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher';
  
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userIds, setUserIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addIds = (raw: string) => {
    const newIds = raw
      .split(/[\n,;\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    setUserIds(prev => {
      const merged = [...prev];
      newIds.forEach(id => { if (!merged.includes(id)) merged.push(id); });
      return merged;
    });
  };

  const handleAddUserId = () => {
    if (!currentUserId.trim()) return;
    addIds(currentUserId);
    setCurrentUserId('');
    inputRef.current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (/[\n,;]/.test(text)) {
      e.preventDefault();
      addIds(text);
      setCurrentUserId('');
    }
  };

  const handleRemoveUserId = (idToRemove: string) => {
    setUserIds(prev => prev.filter(id => id !== idToRemove));
  };

  const handleAssignStudents = async () => {
    if (!selectedClass?.id || !selectedInstitute?.id || userIds.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one user ID",
        variant: "destructive"
      });
      return;
    }

    setAssigning(true);
    try {
      const assignData: BulkAssignStudentsData = {
        studentUserIds: userIds,
        skipVerification: true,
        assignmentNotes: "Batch assignment by user IDs"
      };
      
      const result = await instituteClassesApi.teacherAssignStudents(
        selectedInstitute.id, 
        selectedClass.id, 
        assignData
      );
      
      if (result && (result.success !== undefined || result.failed !== undefined)) {
        const successCount = result.success?.length || 0;
        const failedCount = result.failed?.length || 0;
        
        if (failedCount === 0 && successCount > 0) {
          toast({
            title: "Success!",
            description: `Successfully assigned ${successCount} student(s) to ${selectedClass.name}`
          });
          
          onAssignmentComplete();
          onOpenChange(false);
          setUserIds([]);
          setCurrentUserId('');
        } else if (successCount > 0 && failedCount > 0) {
          // Partial success - show failed reasons
          const failedReasons = result.failed?.map((f: any) => f.reason).join('; ') || 'Unknown error';
          toast({
            title: "Partial Success",
            description: `${successCount} assigned, ${failedCount} failed: ${failedReasons}`,
          });
          
          onAssignmentComplete();
          onOpenChange(false);
          setUserIds([]);
          setCurrentUserId('');
        } else if (failedCount > 0) {
          // All failed - show the specific failure reasons
          const failedReasons = result.failed?.map((f: any) => `${f.studentUserId}: ${f.reason}`).join('\n') || 'Unknown error';
          toast({
            title: "Assignment Failed",
            description: failedReasons,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Assignment Complete",
            description: "Users have been assigned to the class"
          });
          
          onAssignmentComplete();
          onOpenChange(false);
          setUserIds([]);
          setCurrentUserId('');
        }
      } else {
        toast({
          title: "Assignment Complete",
          description: "Users have been assigned to the class"
        });
        
        onAssignmentComplete();
        onOpenChange(false);
        setUserIds([]);
        setCurrentUserId('');
      }
    } catch (error: any) {
      console.error('Error assigning students:', error);
      
      let errorMessage = "Failed to assign users to the class";
      
      if (error.response?.data) {
        const errorData = error.response.data;
        
        if (errorData.message && typeof errorData.message === 'string') {
          errorMessage = errorData.message;
        } else if (errorData.details?.message) {
          errorMessage = errorData.details.message;
        } else if (errorData.error) {
          errorMessage = `${errorData.error}: ${errorData.message || 'Unknown error'}`;
        }
        
        if (errorData.statusCode) {
          errorMessage = `[${errorData.statusCode}] ${errorMessage}`;
        }
      }
      
      toast({
        title: "Assignment Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setAssigning(false);
    }
  };

  useEffect(() => {
    if (open && !hasPermission) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to assign students. This feature is only available for Institute Admins and Teachers.",
        variant: "destructive"
      });
      onOpenChange(false);
    }
  }, [open, hasPermission]);

  useEffect(() => {
    if (!open) {
      setUserIds([]);
      setCurrentUserId('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-1rem)] mx-auto rounded-2xl sm:rounded-xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            Assign Users to Class
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Assigning to <strong className="text-foreground">{selectedClass?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add User ID</Label>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                id="userId"
                placeholder="Type ID and press Enter, or paste multiple…"
                value={currentUserId}
                onChange={e => setCurrentUserId(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleAddUserId(); }
                }}
                className="flex-1 text-sm"
                autoFocus
              />
              <Button
                type="button"
                onClick={handleAddUserId}
                disabled={!currentUserId.trim()}
                size="sm"
                className="shrink-0 px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clipboard className="h-3 w-3" />
              Tip: paste a list of IDs separated by commas, spaces, or new lines — they'll all be added at once.
            </p>
          </div>

          {/* ID List */}
          {userIds.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />Users to assign
                  <Badge className="ml-1 h-5 px-1.5 text-[10px]">{userIds.length}</Badge>
                </Label>
                <button
                  type="button"
                  onClick={() => setUserIds([])}
                  className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />Clear all
                </button>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border overflow-hidden">
                {userIds.map((id, i) => (
                  <div key={id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/60 transition-colors">
                    <span className="text-[11px] text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
                    <span className="flex-1 text-sm font-mono font-medium text-foreground truncate">{id}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveUserId(id)}
                      className="shrink-0 h-5 w-5 flex items-center justify-center rounded-full hover:bg-destructive/15 hover:text-destructive text-muted-foreground transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2 rounded-lg border border-dashed border-border bg-muted/20">
              <Users className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No user IDs added yet</p>
              <p className="text-[11px] text-muted-foreground/60">Type above or paste a list to get started</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground">
            Cancel
          </Button>
          <Button
            onClick={handleAssignStudents}
            disabled={userIds.length === 0 || assigning}
            className="gap-2"
          >
            {assigning ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Assigning…</>
            ) : (
              <><UserPlus className="h-4 w-4" />Assign {userIds.length > 0 ? `${userIds.length} User${userIds.length > 1 ? 's' : ''}` : 'Users'}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignStudentsDialog;