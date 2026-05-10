import React, { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi, { AdminAttendanceRecord } from '@/api/adminAttendance.api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface CardUser {
  userId: string;
  userName: string;
  instituteCardId: string;
  userIdByInstitute?: string;
  imageUrl?: string;
  isInstituteImage?: boolean;
  imageVerificationStatus?: string;
  userType?: string;
  className?: string;
  classId?: string;
  subjectId?: string;
  isActive?: boolean;
  roles?: string[];
}

const CardManagement: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [cardId, setCardId] = useState('');
  const [cardUser, setCardUser] = useState<CardUser | null>(null);
  const [cardRecords, setCardRecords] = useState<AdminAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const lookupCard = useCallback(async () => {
    if (!currentInstituteId || !cardId.trim()) {
      toast.error('Please enter a card ID');
      return;
    }
    setLoading(true);
    setCardUser(null);
    setCardRecords([]);
    try {
      // Look up card user
      const userRes = await adminAttendanceApi.getCardUser(cardId.trim(), currentInstituteId);
      if (userRes?.data) {
        setCardUser(userRes.data);
      }

      // Get recent scans
      const scansRes = await adminAttendanceApi.getAttendanceByCardId(cardId.trim(), { page: 1, limit: 10 });
      setCardRecords(scansRes?.data || []);
    } catch (e: any) {
      toast.error(e.message || 'Card lookup failed');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, cardId]);

  const statusIcon = (s: string) => {
    switch (s) { case 'present': return 'P'; case 'absent': return 'A'; case 'late': return 'L'; default: return '→'; }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Card Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Institute Card ID</Label>
              <Input
                value={cardId}
                onChange={e => setCardId(e.target.value)}
                placeholder="e.g. CARD001"
                className="text-xs"
                onKeyDown={e => e.key === 'Enter' && lookupCard()}
              />
            </div>
            <Button size="sm" onClick={lookupCard} disabled={loading}>
              <Search className="h-3 w-3 mr-1" />
              {loading ? 'Looking up...' : 'Look Up'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card Info */}
      {cardUser && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" /> Card Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              {cardUser.imageUrl && (
                <img src={getImageUrl(cardUser.imageUrl)} alt="User" className="w-12 h-12 rounded-full object-cover border" />
              )}
              <div>
                <div className="font-medium text-sm">{cardUser.userName}</div>
                <div className="text-xs text-muted-foreground">Card: {cardUser.instituteCardId}</div>
                <div className="flex gap-1 mt-1">
                  {cardUser.roles.map(r => (
                    <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                  ))}
                  <Badge variant={cardUser.isActive ? 'default' : 'destructive'} className="text-xs">
                    {cardUser.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Scans */}
      {cardRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Time</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cardRecords.map((r, i) => {
                    const dateStr = r.date || r.markedAt?.split('T')[0] || '';
                    const timeStr = r.markedAt ? new Date(r.markedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-xs">
                          {new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-xs">{timeStr}</TableCell>
                        <TableCell className="text-xs text-center">{statusIcon(r.status)} {r.status}</TableCell>
                        <TableCell className="text-xs">{r.markingMethod || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CardManagement;
