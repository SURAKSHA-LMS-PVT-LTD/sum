import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface SessionViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: { joinTime?: string }[];
  studentName: string;
  lectureTitle: string;
}

const SessionViewerDialog: React.FC<SessionViewerDialogProps> = ({ open, onOpenChange, sessions, studentName, lectureTitle }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Session History</DialogTitle>
          <DialogDescription>
            {studentName} - {lectureTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Join Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Badge variant="secondary">Session {index + 1}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {session.joinTime ? new Date(session.joinTime).toLocaleString() : 'N/A'}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionViewerDialog;
