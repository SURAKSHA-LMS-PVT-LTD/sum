import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { structuredLecturesApi, StructuredLecture } from '@/api/structuredLectures.api';
import { getErrorMessage } from '@/api/apiError';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';
import { useState } from 'react';

interface DeleteStructuredLectureDialogProps {
  lecture: StructuredLecture;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const DeleteStructuredLectureDialog = ({
  lecture,
  open,
  onOpenChange,
  onSuccess
}: DeleteStructuredLectureDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await structuredLecturesApi.delete(lecture._id);
      toast({
        title: "Success",
        description: "Lecture deleted successfully"
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting lecture:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to delete lecture'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DeleteConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      itemName={lecture.title}
      itemType="lecture"
      bullets={[
        'Lecture will be permanently removed from database',
        'All recordings and files will be deleted from storage',
        'This action is irreversible',
      ]}
      onConfirm={handleDelete}
      isDeleting={loading}
    />
  );
};

export default DeleteStructuredLectureDialog;
