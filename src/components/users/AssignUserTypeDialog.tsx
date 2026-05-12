import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { userTypesApi, UserType } from '@/api/userTypes.api';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentUserTypeId?: string;
  onAssigned?: () => void;
}

export const AssignUserTypeDialog: React.FC<Props> = ({
  open, onClose, userId, userName, currentUserTypeId, onAssigned,
}) => {
  const { selectedInstitute } = useAuth();
  const instituteId = selectedInstitute?.id;
  const { toast } = useToast();

  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [selected, setSelected] = useState<string>(currentUserTypeId ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !instituteId) return;
    setLoading(true);
    userTypesApi.list(instituteId)
      .then(list => { setUserTypes(list); setSelected(currentUserTypeId ?? ''); })
      .catch(() => toast({ title: 'Error', description: 'Failed to load user types.', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [open, instituteId, currentUserTypeId, toast]);

  const handleSave = async () => {
    if (!instituteId || !selected) return;
    setSaving(true);
    try {
      await userTypesApi.assignUserType(instituteId, userId, selected);
      toast({ title: 'Updated', description: `User type assigned to ${userName}.` });
      onAssigned?.();
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to assign user type.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign User Type</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1.5 py-2">
            <p className="text-sm text-muted-foreground mb-3">
              Select a user type for <strong>{userName}</strong>:
            </p>
            {userTypes.map(ut => (
              <button
                key={ut.id}
                onClick={() => setSelected(ut.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all',
                  selected === ut.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/40',
                )}
              >
                <div
                  className="w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center text-white text-[11px] font-bold"
                  style={{ backgroundColor: ut.color ?? '#6B7280' }}
                >
                  {ut.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{ut.name}</p>
                  {ut.description && (
                    <p className="text-[11px] text-muted-foreground truncate">{ut.description}</p>
                  )}
                </div>
                {selected === ut.id && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !selected || selected === currentUserTypeId}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
