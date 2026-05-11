import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, ShieldAlert, Lock, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { useToast } from '@/hooks/use-toast';

export default function RecordingEntry() {
  const { urlId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [accessInfo, setAccessInfo] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const activitiesQueue = useRef<Array<{ type: 'PLAY' | 'PAUSE' | 'SEEK' | 'HEARTBEAT'; timestamp: number }>>([]);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await enhancedCachedClient.get(`/lecture-tracking/recording/access/${urlId}`);
        setAccessInfo(response);
        if (response.hasAccess) {
          startSession(response.lectureId);
        }
      } catch (err: any) {
        toast({
          title: 'Access Denied',
          description: err.response?.data?.message || 'Invalid or disabled recording URL',
          variant: 'destructive'
        });
        setAccessInfo(null);
      } finally {
        setLoading(false);
      }
    };
    checkAccess();
    
    return () => {
      if (sessionId) {
        endSession();
      }
    };
  }, [urlId, user]);

  const startSession = async (lectureId: string) => {
    try {
      const res = await enhancedCachedClient.post('/lecture-tracking/recording/session/start', {
        lectureId,
      });
      setSessionId(res.id);
      startHeartbeat(res.id);
    } catch (e) {
      console.error('Failed to start tracking session', e);
    }
  };

  const endSession = async () => {
    if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    if (!sessionId) return;
    
    // Flush remaining activities
    if (activitiesQueue.current.length > 0) {
      await enhancedCachedClient.post('/lecture-tracking/recording/heartbeat', {
        sessionId,
        activities: activitiesQueue.current
      }).catch(console.error);
    }

    await enhancedCachedClient.post('/lecture-tracking/recording/session/end', { sessionId }).catch(console.error);
  };

  const startHeartbeat = (sid: string) => {
    heartbeatInterval.current = setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused) {
        queueActivity('HEARTBEAT');
      }
      
      if (activitiesQueue.current.length > 0) {
        const activitiesToSync = [...activitiesQueue.current];
        activitiesQueue.current = [];
        try {
          await enhancedCachedClient.post('/lecture-tracking/recording/heartbeat', {
            sessionId: sid,
            activities: activitiesToSync
          });
        } catch (e) {
          // Put them back if failed
          activitiesQueue.current = [...activitiesToSync, ...activitiesQueue.current];
        }
      }
    }, 10000); // Sync every 10 seconds
  };

  const queueActivity = (type: 'PLAY' | 'PAUSE' | 'SEEK' | 'HEARTBEAT') => {
    if (videoRef.current) {
      activitiesQueue.current.push({
        type,
        timestamp: Math.floor(videoRef.current.currentTime)
      });
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  if (!accessInfo) {
    return (
      <div className="flex justify-center items-center h-screen bg-muted/30">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <CardTitle>Recording Not Found</CardTitle>
            <CardDescription>This URL is invalid or tracking is disabled.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!accessInfo.hasAccess) {
    return (
      <div className="flex justify-center items-center h-screen bg-muted/30 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Lock className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-xl">Access Restricted</h3>
            <p className="text-sm text-muted-foreground">
              {accessInfo.accessLevel === 'SURAKSHA_USERS' 
                ? 'You must be logged in to view this recording.' 
                : accessInfo.accessLevel === 'ENROLLED_ONLY'
                ? 'This recording is restricted to enrolled students only.'
                : 'You need to purchase access to view this recording.'}
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
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col">
      <div className="max-w-5xl mx-auto w-full space-y-4">
        <div className="flex items-center space-x-3 mb-6">
          <PlayCircle className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{accessInfo.title}</h1>
            <p className="text-muted-foreground">{accessInfo.instituteName || 'Institute'}</p>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden bg-black aspect-video relative border">
          {/* Mock Video Player - In reality, fetch actual video URL */}
          <video
            ref={videoRef}
            className="w-full h-full"
            controls
            onPlay={() => queueActivity('PLAY')}
            onPause={() => queueActivity('PAUSE')}
            onSeeked={() => queueActivity('SEEK')}
            src="https://www.w3schools.com/html/mov_bbb.mp4"
            poster="https://via.placeholder.com/1280x720.png?text=Lecture+Recording"
          >
            Your browser does not support HTML video.
          </video>
        </div>
        
        <Card>
          <CardContent className="p-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Platform: {accessInfo.platform}</span>
            <span>Secure Tracking Enabled</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
