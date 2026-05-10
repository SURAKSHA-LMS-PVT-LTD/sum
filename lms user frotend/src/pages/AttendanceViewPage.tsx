import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar, Clock, Building2, GraduationCap, BookOpen,
  MapPin, Smartphone, MessageSquare, ArrowLeft, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { attendanceApi, type AttendanceViewRecord } from '@/api/attendance.api';
import { getImageUrl } from '@/utils/imageUrlHelper';

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_MAP: Record<number, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline'; className: string }> = {
  0: { label: 'Absent',      variant: 'destructive', className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400' },
  1: { label: 'Present',     variant: 'default',     className: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-400' },
  2: { label: 'Late',        variant: 'outline',     className: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400' },
  3: { label: 'Left',        variant: 'secondary',   className: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400' },
  4: { label: 'Left Early',  variant: 'outline',     className: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-400' },
  5: { label: 'Left Lately', variant: 'outline',     className: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-400' },
};

function statusInfo(status: number) {
  return STATUS_MAP[status] ?? { label: 'Unknown', variant: 'secondary' as const, className: 'bg-gray-100 text-gray-600 border-gray-200' };
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-LK', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) return '—';
  try {
    return new Date(timestamp).toLocaleTimeString('en-LK', {
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'Asia/Colombo',
    });
  } catch {
    return '—';
  }
}

// ── Detail row ────────────────────────────────────────────────────────────────

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <div className="mt-0.5 p-1.5 rounded-md bg-muted/60 shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm font-medium mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

// ── Location detail row (with optional map link) ─────────────────────────────

function parseLocation(raw: string | null | undefined): { address: string; mapsUrl?: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.address) {
      const mapsUrl = parsed.latitude != null && parsed.longitude != null
        ? `https://www.google.com/maps?q=${parsed.latitude},${parsed.longitude}`
        : undefined;
      return { address: parsed.address, mapsUrl };
    }
  } catch { /* not JSON — fall through */ }
  return { address: raw };
}

function LocationDetailRow({ location }: { location: string | null | undefined }) {
  const parsed = parseLocation(location);
  if (!parsed) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <div className="mt-0.5 p-1.5 rounded-md bg-muted/60 shrink-0">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Location</p>
        <p className="text-sm font-medium mt-0.5 break-words">{parsed.address}</p>
        {parsed.mapsUrl && (
          <a
            href={parsed.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary underline mt-1"
          >
            <ExternalLink className="h-3 w-3" /> Open in Maps
          </a>
        )}
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="container max-w-lg mx-auto p-4 space-y-4">
      <Skeleton className="h-8 w-32" />
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-7 w-7 rounded-md" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AttendanceViewPage() {
  const [searchParams] = useSearchParams();
  const attendanceId = searchParams.get('id');

  const [record, setRecord] = useState<AttendanceViewRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attendanceId) {
      setError('No attendance ID provided.');
      setLoading(false);
      return;
    }

    attendanceApi.getAttendanceView(attendanceId)
      .then(setRecord)
      .catch((err: any) => {
        if (err?.status === 404 || err?.response?.status === 404) {
          setError('Attendance record not found or is no longer available.');
        } else if (err?.status === 401 || err?.response?.status === 401) {
          setError('Please log in to view this attendance record.');
        } else {
          setError('Failed to load attendance details. Please try again.');
        }
      })
      .finally(() => setLoading(false));
  }, [attendanceId]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="container max-w-lg mx-auto p-4 space-y-4">
        <Link to="/notifications">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="p-4 rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">Unable to Load Record</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Link to="/notifications">
              <Button variant="outline" size="sm">Go to Notifications</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!record) return null;

  const status = statusInfo(record.status);
  const initials = (record.studentName ?? 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="container max-w-lg mx-auto p-4 space-y-4">
      <Link to="/notifications">
        <Button variant="ghost" size="sm" className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </Link>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Attendance Record</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Student identity */}
          <div className="flex flex-col items-center gap-3 py-2">
            <Avatar className="h-24 w-24 ring-2 ring-border">
              <AvatarImage src={getImageUrl(record.studentImageUrl ?? '')} alt={record.studentName ?? ''} />
              <AvatarFallback className="text-xl font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-lg font-semibold">{record.studentName ?? '—'}</p>
              {record.userType && (
                <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">{record.userType}</p>
              )}
            </div>
            <Badge variant={status.variant} className={`text-sm px-4 py-1 ${status.className}`}>
              {status.label}
            </Badge>
          </div>

          {/* Details */}
          <div className="divide-y">
            <DetailRow icon={Calendar} label="Date" value={formatDate(record.date)} />
            <DetailRow icon={Clock} label="Time" value={formatTime(record.timestamp)} />
            <DetailRow icon={Building2} label="Institute" value={record.instituteName} />
            <DetailRow icon={GraduationCap} label="Class" value={record.className} />
            <DetailRow icon={BookOpen} label="Subject" value={record.subjectName} />
            <LocationDetailRow location={record.location} />
            <DetailRow icon={Smartphone} label="Marking Method" value={record.markingMethod} />
            <DetailRow icon={MessageSquare} label="Remarks" value={record.remarks} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
