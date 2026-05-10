import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi from '@/api/adminAttendance.api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, User, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '@/utils/imageUrlHelper';
import type { CardUserResponse } from '@/types/attendance.types';

const CardUserLookupPage: React.FC = () => {
  const { selectedInstitute, selectedClass, selectedSubject, currentInstituteId } = useAuth();
  const navigate = useNavigate();
  const [cardId, setCardId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CardUserResponse['data'] | null>(null);

  const handleLookup = async () => {
    if (!cardId.trim() || !currentInstituteId) {
      toast.error('Enter a card ID and select an institute');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      let res: CardUserResponse;

      // Use the most specific scope available
      if (selectedSubject?.id && selectedClass?.id) {
        res = await adminAttendanceApi.getSubjectCardUser(
          currentInstituteId,
          selectedClass.id.toString(),
          selectedSubject.id.toString(),
          cardId.trim()
        );
      } else if (selectedClass?.id) {
        res = await adminAttendanceApi.getClassCardUser(
          currentInstituteId,
          selectedClass.id.toString(),
          cardId.trim()
        );
      } else {
        res = await adminAttendanceApi.getCardUser(cardId.trim(), currentInstituteId);
      }

      if (res.success && res.data) {
        setResult(res.data);
        toast.success(`Found: ${res.data.userName}`);
      } else {
        toast.error('No user found for this card ID');
      }
    } catch (error: any) {
      toast.error(error.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLookup();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Card User Lookup</h1>
          <p className="text-xs text-muted-foreground">
            Look up a user by their institute card ID
          </p>
        </div>
      </div>

      {/* Context */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{selectedInstitute?.name || 'No institute'}</Badge>
            {selectedClass && <Badge variant="secondary">Class: {selectedClass.name}</Badge>}
            {selectedSubject && <Badge variant="secondary">Subject: {selectedSubject.name}</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs">Institute Card ID</Label>
              <Input
                value={cardId}
                onChange={e => setCardId(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter or scan card ID..."
                className="mt-1"
                autoFocus
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleLookup} disabled={loading || !cardId.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                Lookup
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">User Found</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              {result.imageUrl ? (
                <img
                  src={getImageUrl(result.imageUrl)}
                  alt={result.userName}
                  className="w-20 h-20 rounded-lg object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-semibold">{result.userName}</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">User ID:</span>
                    <span className="ml-1 font-medium">{result.userId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Card ID:</span>
                    <span className="ml-1 font-medium">{result.instituteCardId}</span>
                  </div>
                  {result.userIdByInstitute && (
                    <div>
                      <span className="text-muted-foreground">Institute ID:</span>
                      <span className="ml-1 font-medium">{result.userIdByInstitute}</span>
                    </div>
                  )}
                  {result.userType && (
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <Badge variant="outline" className="ml-1 text-xs py-0">{result.userType}</Badge>
                    </div>
                  )}
                  {result.className && (
                    <div>
                      <span className="text-muted-foreground">Class:</span>
                      <span className="ml-1 font-medium">{result.className}</span>
                    </div>
                  )}
                  {result.imageVerificationStatus && (
                    <div>
                      <span className="text-muted-foreground">Image:</span>
                      <Badge
                        variant={result.imageVerificationStatus === 'VERIFIED' ? 'default' : 'secondary'}
                        className="ml-1 text-xs py-0"
                      >
                        {result.imageVerificationStatus}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CardUserLookupPage;
