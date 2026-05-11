import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Video, ShieldAlert, Lock, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { useToast } from '@/hooks/use-toast';

export default function LiveLectureEntry() {
  const { urlId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [accessInfo, setAccessInfo] = useState<any>(null);
  const [guestForm, setGuestForm] = useState({ name: '', email: '', phone: '' });
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await enhancedCachedClient.get(`/lecture-tracking/live/access/${urlId}`);
        setAccessInfo(response);
      } catch (err: any) {
        toast({
          title: 'Access Denied',
          description: err.response?.data?.message || 'Invalid or disabled lecture URL',
          variant: 'destructive'
        });
        setAccessInfo(null);
      } finally {
        setLoading(false);
      }
    };
    checkAccess();
  }, [urlId, user]);

  const handleJoin = async () => {
    if (!accessInfo?.hasAccess) return;
    setJoining(true);
    try {
      await enhancedCachedClient.post('/lecture-tracking/live/join', {
        lectureId: accessInfo.lectureId,
        guestName: user ? undefined : guestForm.name,
        guestEmail: user ? undefined : guestForm.email,
        guestPhone: user ? undefined : guestForm.phone,
      });
      toast({ title: 'Success', description: 'Joining lecture...' });
      // In a real app, redirect to the actual meeting URL here.
      // For this structural implementation, we just simulate success.
      setTimeout(() => {
        alert('Redirecting to actual zoom/meet link...');
      }, 1000);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to record join event',
        variant: 'destructive'
      });
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  if (!accessInfo) {
    return (
      <div className="flex justify-center items-center h-screen bg-muted/30">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <CardTitle>Lecture Not Found</CardTitle>
            <CardDescription>This URL is invalid or the session has ended.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center"
      style={{ backgroundImage: accessInfo.bgUrl ? `url(${accessInfo.bgUrl})` : 'none' }}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-0" />
      <Card className="w-full max-w-md z-10 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{accessInfo.title}</CardTitle>
          <CardDescription className="mt-2">
            Hosted by {accessInfo.instituteName || 'Institute'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6">
          {!accessInfo.hasAccess ? (
            <div className="space-y-4 text-center">
              <Lock className="w-12 h-12 text-muted-foreground mx-auto" />
              <h3 className="font-semibold text-lg">Access Restricted</h3>
              <p className="text-sm text-muted-foreground">
                {accessInfo.accessLevel === 'SURAKSHA_USERS' 
                  ? 'You must be logged in to join this session.' 
                  : accessInfo.accessLevel === 'ENROLLED_ONLY'
                  ? 'This session is restricted to enrolled students only.'
                  : 'You need to purchase access to join this session.'}
              </p>
              {!user && (
                <Button className="w-full mt-4" onClick={() => navigate('/login')}>
                  <LogIn className="w-4 h-4 mr-2" /> Login to Continue
                </Button>
              )}
              {accessInfo.requirePayment && (
                <Button className="w-full mt-2" variant="default">
                  Proceed to Payment
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {!user && accessInfo.accessLevel === 'ANYONE' && (
                <div className="space-y-3 mb-6 p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Guest Information</p>
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input 
                      value={guestForm.name} 
                      onChange={e => setGuestForm({...guestForm, name: e.target.value})} 
                      placeholder="Enter your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email (Optional)</Label>
                    <Input 
                      type="email"
                      value={guestForm.email} 
                      onChange={e => setGuestForm({...guestForm, email: e.target.value})} 
                      placeholder="Enter your email"
                    />
                  </div>
                </div>
              )}
              
              <Button 
                className="w-full py-6 text-lg" 
                onClick={handleJoin}
                disabled={joining || (!user && accessInfo.accessLevel === 'ANYONE' && !guestForm.name)}
              >
                {joining ? 'Joining...' : 'Join Lecture Now'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
