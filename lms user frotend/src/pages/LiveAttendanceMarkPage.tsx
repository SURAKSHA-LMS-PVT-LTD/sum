import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { lectureTrackingApi, LiveAttendanceSessionAccessInfo } from '@/api/lectureTracking.api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppLoadingScreen from '@/components/AppLoadingScreen';
import { AlertCircle, CheckCircle2, Clock, Lock } from 'lucide-react';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-LK', {
    timeZone: 'Asia/Colombo',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Status = 'loading' | 'ready' | 'marked' | 'already' | 'expired' | 'no-access' | 'error';

export default function LiveAttendanceMarkPage() {
  const { urlId } = useParams<{ urlId: string }>();
  const { user } = useAuth();

  const [info, setInfo] = useState<LiveAttendanceSessionAccessInfo | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!urlId) {
      setStatus('error');
      setErrorMessage('Invalid attendance link.');
      return;
    }

    setStatus('loading');
    lectureTrackingApi.validateLiveAttendanceSession(urlId)
      .then(data => {
        setInfo(data);
        if (data.alreadyMarked) {
          setStatus('already');
          return;
        }
        if (data.isExpired) {
          setStatus('expired');
          return;
        }
        if (data.loginRequired) {
          setStatus('no-access');
          return;
        }
        if (!data.hasAccess) {
          setStatus('no-access');
          return;
        }
        setStatus('ready');
      })
      .catch((e: any) => {
        const msg = e?.message || 'Attendance link not found.';
        setErrorMessage(msg);
        if (String(msg).toLowerCase().includes('expired')) {
          setStatus('expired');
        } else {
          setStatus('error');
        }
      });
  }, [urlId, user?.id]);

  const handleMark = async () => {
    if (!urlId) return;
    setMarking(true);
    try {
      const res = await lectureTrackingApi.markLiveAttendanceSession(urlId);
      setInfo(prev => prev ? { ...prev, alreadyMarked: true, markedAt: res.markedAt } : prev);
      setStatus(res.status === 'ALREADY_MARKED' ? 'already' : 'marked');
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to mark attendance.');
      setStatus('error');
    } finally {
      setMarking(false);
    }
  };

  if (status === 'loading') {
    return <AppLoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Live Attendance</CardTitle>
          <CardDescription>{info?.title || 'Lecture Attendance'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Session status</span>
            {status === 'marked' || status === 'already' ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Marked</Badge>
            ) : status === 'expired' ? (
              <Badge variant="destructive">Expired</Badge>
            ) : status === 'no-access' ? (
              <Badge variant="outline" className="text-slate-500">Access required</Badge>
            ) : (
              <Badge variant="secondary">Ready</Badge>
            )}
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Created: {formatDateTime(info?.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Expires: {formatDateTime(info?.expiresAt)}</span>
            </div>
            <div>Valid for: {info?.validSeconds ?? 0}s</div>
          </div>

          {status === 'ready' && (
            <Button className="w-full" onClick={handleMark} disabled={marking}>
              {marking ? 'Marking...' : 'Mark Attendance'}
            </Button>
          )}

          {status === 'marked' && (
            <div className="flex items-start gap-2 text-emerald-700 text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5" />
              <div>
                Attendance marked successfully.
                {info?.markedAt && (
                  <div className="text-xs text-emerald-700/70 mt-1">Marked at {formatDateTime(info.markedAt)}</div>
                )}
              </div>
            </div>
          )}

          {status === 'already' && (
            <div className="flex items-start gap-2 text-emerald-700 text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5" />
              <div>
                Attendance already marked.
                {info?.markedAt && (
                  <div className="text-xs text-emerald-700/70 mt-1">Marked at {formatDateTime(info.markedAt)}</div>
                )}
              </div>
            </div>
          )}

          {status === 'expired' && (
            <div className="flex items-start gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              This attendance link has expired.
            </div>
          )}

          {status === 'no-access' && (
            <div className="flex items-start gap-2 text-slate-600 text-sm">
              <Lock className="h-4 w-4 mt-0.5" />
              {info?.requirePayment
                ? 'Payment is required to mark attendance for this lecture.'
                : 'Please log in to mark attendance.'}
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              {errorMessage || 'Something went wrong.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
