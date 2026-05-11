import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface SessionViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: { joinTime?: string; leaveTime?: string; durationMinutes?: number; ipAddress?: string }[];
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
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Join Time</TableHead>
                  <TableHead>Leave Time</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
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
                    <TableCell className="text-muted-foreground">
                      {session.leaveTime ? new Date(session.leaveTime).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {session.durationMinutes != null ? `${session.durationMinutes}m` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionViewerDialog;
