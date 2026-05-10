import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, X, Copy, Check } from 'lucide-react';
import { AddressCoordinates } from '@/types/attendance.types';
import { useState } from 'react';

interface AttendanceLocationViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName?: string;
  studentId?: string;
  address?: AddressCoordinates;
  location?: string;
  date?: string;
  status?: string;
  className?: string;
  instituteName?: string;
  markingTime?: string;
  markingMethod?: string;
}

export const AttendanceLocationViewer: React.FC<AttendanceLocationViewerProps> = ({
  open,
  onOpenChange,
  studentName,
  studentId,
  address,
  location,
  date,
  status,
  className,
  instituteName,
  markingTime,
  markingMethod,
}) => {
  const [copiedCoord, setCopiedCoord] = useState(false);

  const hasCoordinates = address?.latitude && address?.longitude;

  const handleOpenGoogleMaps = () => {
    if (!hasCoordinates) {
      alert('Location coordinates not available');
      return;
    }
    const mapsUrl = `https://www.google.com/maps?q=${address.latitude},${address.longitude}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyCoordinates = () => {
    if (!hasCoordinates) return;
    const coordText = `${address.latitude.toFixed(6)}, ${address.longitude.toFixed(6)}`;
    navigator.clipboard.writeText(coordText).then(() => {
      setCopiedCoord(true);
      setTimeout(() => setCopiedCoord(false), 2000);
    });
  };

  const handleOpenAppleMaps = () => {
    if (!hasCoordinates) {
      alert('Location coordinates not available');
      return;
    }
    const appleMapsUrl = `maps://maps.apple.com/?q=${address.latitude},${address.longitude}`;
    window.open(appleMapsUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[93vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-5 pr-12">
            <div className="p-3 rounded-xl bg-primary/10">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-bold text-xl leading-tight">Attendance Location Details</p>
              <p className="text-sm text-muted-foreground font-normal mt-1">{studentName || 'Attendance record'}</p>
            </div>
          </DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="absolute right-4 top-4">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <p className="text-sm font-bold text-muted-foreground mb-4 flex items-center gap-3">Attendance Summary <span className="flex-1 h-px bg-border/40" /></p>
            <div className="divide-y divide-border/40">
              {studentName && (
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-[15px] text-muted-foreground">Student</span>
                  <span className="text-base font-semibold">{studentName}</span>
                </div>
              )}
              {studentId && (
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-[15px] text-muted-foreground">Student ID</span>
                  <span className="text-lg font-mono font-bold text-primary">{studentId}</span>
                </div>
              )}
              {status && (
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-[15px] text-muted-foreground">Status</span>
                  <span className="text-base font-semibold capitalize text-green-700 dark:text-green-300">{status}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-muted-foreground mb-4 flex items-center gap-3">Location <span className="flex-1 h-px bg-border/40" /></p>
            <div className="space-y-3">
              {location && (
                <div className="py-2">
                  <p className="text-[13px] text-muted-foreground mb-1.5">Display Address</p>
                  <p className="text-base break-words leading-7">{location}</p>
                </div>
              )}

              {hasCoordinates && (
                <div className="rounded-xl border border-border/40 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] text-muted-foreground mb-1">GPS Coordinates</p>
                      <p className="text-lg font-mono font-bold text-primary">
                        {address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyCoordinates}
                      className="h-9 px-4"
                    >
                      {copiedCoord ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                      {copiedCoord ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <Button size="sm" onClick={handleOpenGoogleMaps} className="sm:flex-1 h-10">
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      Open in Google Maps
                    </Button>
                    <Button size="sm" onClick={handleOpenAppleMaps} variant="outline" className="sm:flex-1 h-10">
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      Open in Apple Maps
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-muted-foreground mb-4 flex items-center gap-3">Marking Details <span className="flex-1 h-px bg-border/40" /></p>
            <div className="divide-y divide-border/40">
              {instituteName && (
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-[15px] text-muted-foreground">Institute</span>
                  <span className="text-[15px] font-medium">{instituteName}</span>
                </div>
              )}
              {className && (
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-[15px] text-muted-foreground">Class</span>
                  <span className="text-[15px] font-medium">{className}</span>
                </div>
              )}
              {date && (
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-[15px] text-muted-foreground">Date</span>
                  <span className="text-[15px] font-medium">{new Date(date).toLocaleDateString()}</span>
                </div>
              )}
              {markingTime && (
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-[15px] text-muted-foreground">Marked At</span>
                  <span className="text-[15px] font-medium">{markingTime}</span>
                </div>
              )}
              {markingMethod && (
                <div className="flex items-center justify-between py-3.5">
                  <span className="text-[15px] text-muted-foreground">Method</span>
                  <span className="text-[15px] font-medium capitalize">{markingMethod}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceLocationViewer;
