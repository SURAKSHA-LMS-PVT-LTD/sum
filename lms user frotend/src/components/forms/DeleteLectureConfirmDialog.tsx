import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';

interface DeleteLectureConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lectureTitle: string;
  onConfirm: () => void;
  isDeleting?: boolean;
}

const DeleteLectureConfirmDialog: React.FC<DeleteLectureConfirmDialogProps> = ({
  open,
  onOpenChange,
  lectureTitle,
  onConfirm,
  isDeleting = false,
}) => {
  const [confirmText, setConfirmText] = useState('');

  const isDeleteEnabled = confirmText.toLowerCase() === 'delete';

  const handleConfirm = () => {
    if (isDeleteEnabled) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">Permanently Delete Lecture?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p className="font-medium text-foreground">
              You are about to permanently delete:
            </p>
            <div className="p-3 bg-muted rounded-md">
              <p className="font-semibold text-foreground">{lectureTitle}</p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-destructive font-medium">⚠️ This action cannot be undone!</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Lecture will be permanently removed from database</li>
                <li>All recordings and files will be deleted from storage</li>
                <li>This action is irreversible</li>
              </ul>
            </div>
            <div className="pt-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Type <span className="font-mono bg-muted px-1 py-0.5 rounded">delete</span> to confirm:
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type 'delete' to confirm"
                className="font-mono"
                autoComplete="off"
                disabled={isDeleting}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isDeleteEnabled || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Permanently Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteLectureConfirmDialog;
