import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { School, ChevronLeft, ChevronRight, Building2, Video, ExternalLink, RefreshCw, ChevronDown, Loader2, Cloud, HardDrive, Link2, Clock, MapPin, ImageIcon } from 'lucide-react';
import DashboardClassCards from './DashboardClassCards';
import DashboardSubjectCards from './DashboardSubjectCards';
import FeaturesSection from './FeaturesSection';
import { AttendanceFeedWidget } from './DashboardWidgets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cachedApiClient } from '@/api/cachedClient';
import VideoPreviewDialog from '@/components/VideoPreviewDialog';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { buildSidebarUrl } from '@/utils/pageNavigation';

const ClassDashboardView = () => {
  const { user, selectedInstitute, selectedClass, setSelectedClass } = useAuth();
  const navigate = useNavigate();
  const [lectures, setLectures] = useState<any[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [expandedLecture, setExpandedLecture] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoPreviewTitle, setVideoPreviewTitle] = useState('');

  const firstName = user?.name?.split(' ')[0] || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const firstDefined = (...values: any[]) => values.find(v => v !== undefined && v !== null);
  const pickString = (...values: any[]) => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) return value;
    }
    return undefined;
  };
  const normalizeStatus = (value: any) => (value ?? '').toString().toLowerCase();
  const getLectureStatus = (lec: any) => normalizeStatus(firstDefined(lec.status, lec.lectureStatus, lec.lecture_status));
  const getLectureStart = (lec: any) => pickString(lec.startTime, lec.start_time);
  const getLectureEnd = (lec: any) => pickString(lec.endTime, lec.end_time);
  const getMeetingLink = (lec: any) => pickString(lec.meetingLink, lec.meeting_link, lec.meetingUrl, lec.meeting_url);
  const getLiveJoinUrl = (lec: any) => {
    const direct = pickString(lec.liveJoinUrl, lec.live_join_url, lec.customLiveUrl, lec.custom_live_url);
    if (direct) return direct;
    const urlId = pickString(lec.liveUrlId, lec.live_url_id, lec.live_urlID, lec.liveUrlID);
    return urlId ? `${window.location.origin}/live-lecture/${urlId}` : '';
  };
  const getRecordingJoinUrl = (lec: any) => {
    const direct = pickString(
      lec.recordingJoinUrl,
      lec.recording_join_url,
      lec.recJoinUrl,
      lec.rec_join_url,
      lec.customRecordingUrl,
      lec.custom_recording_url
    );
    if (direct) return direct;
    const urlId = pickString(lec.recUrlId, lec.rec_url_id, lec.recordingUrlId, lec.recording_url_id);
    return urlId ? `${window.location.origin}/view-recording/${urlId}` : '';
  };
  const getRecordingUrl = (lec: any) => pickString(lec.recordingUrl, lec.recording_url, lec.recordingLink, lec.recording_link);

  const fetchLectures = useCallback(async (forceRefresh = false) => {
    if (!selectedInstitute?.id || !selectedClass?.id) return;
    setLecturesLoading(true);
    try {
      // Use same endpoint as ClassLecturesPage to get all class lectures with thumbnails
      const res = await cachedApiClient.get('/institute-class-subject-lectures',
        { instituteId: selectedInstitute.id, classId: selectedClass.id, limit: 100 },
        {
          ttl: 10,
          useStaleWhileRevalidate: true,
          instituteId: selectedInstitute.id,
          classId: selectedClass.id,
          forceRefresh
        }
      );
      console.log('📚 Raw response from /institute-class-subject-lectures:', res);
      const data = res;
      const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.lectures) ? data.lectures : [];
      console.log('📚 Parsed lectures array:', arr, { length: arr.length, isArray: Array.isArray(arr) });
      setLectures(arr);
    } catch (err) {
      console.error('❌ Error fetching lectures:', err);
      setLectures([]);
    } finally {
      setLecturesLoading(false);
    }
  }, [selectedInstitute?.id, selectedClass?.id]);

  useEffect(() => { fetchLectures(); }, [fetchLectures]);

  const orderedLectures = useMemo(() => {
    const rank = (status: string) => {
      if (status === 'ongoing' || status === 'live') return 0;
      if (status === 'scheduled') return 1;
      if (status === 'postponed') return 2;
      if (status === 'completed' || status === 'cancelled') return 3;
      return 4;
    };

    const getTime = (lec: any) => {
      const raw = getLectureStart(lec);
      const time = raw ? new Date(raw).getTime() : 0;
      return Number.isFinite(time) ? time : 0;
    };

    return [...lectures].sort((a, b) => {
      const statusA = getLectureStatus(a);
      const statusB = getLectureStatus(b);
      const rankA = rank(statusA);
      const rankB = rank(statusB);
      if (rankA !== rankB) return rankA - rankB;

      const timeA = getTime(a);
      const timeB = getTime(b);
      if (rankA === 1) return timeA - timeB;
      return timeB - timeA;
    });
  }, [lectures]);

  const lectureScrollRef = useRef<HTMLDivElement>(null);
  const scrollLectures = (dir: 'left' | 'right') => {
    if (!lectureScrollRef.current) return;
    const amount = lectureScrollRef.current.clientWidth * 0.7;
    lectureScrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const handleRecording = (lec: any) => {
    const joinUrl = getRecordingJoinUrl(lec);
    if (joinUrl) {
      window.open(joinUrl, '_blank');
      return;
    }

    const url = getRecordingUrl(lec);
    if (!url) return;

    if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('drive.google.com')) {
      setVideoPreviewUrl(url); setVideoPreviewTitle(lec.title);
    } else { window.open(url, '_blank'); }
  };

  const handleJoinLecture = (lec: any) => {
    const joinUrl = getLiveJoinUrl(lec) || getMeetingLink(lec);
    if (!joinUrl) return;
    window.open(joinUrl, '_blank');
  };

  const handleBackToInstitute = () => {
    setSelectedClass(null);
    if (selectedInstitute) {
      navigate(`/institute/${selectedInstitute.id}/dashboard`);
    } else {
      navigate('/dashboard');
    }
  };

  if (!selectedInstitute || !selectedClass) return null;

  return (
    <div className="space-y-4 pb-24 sm:pb-12">
      {/* Greeting Section */}
      <div className="px-2 pt-2 pb-1">
        <h1 className="text-2xl font-bold text-foreground">
          {greeting}, <span className="text-primary">{firstName}</span>!
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          You are currently viewing <span className="font-semibold text-foreground">{selectedClass.name}</span>.
        </p>
      </div>
      {/* Breadcrumb */}
      <div className="px-2 pt-2">
        <button
          onClick={handleBackToInstitute}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <Building2 className="h-3 w-3" />
          <span className="truncate max-w-[160px]">{selectedInstitute.shortName || selectedInstitute.name}</span>
        </button>
      </div>

      {/* Class header */}
      <div className="mx-2 bg-card border border-border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <School className="h-6 w-6 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">
              {selectedClass.name}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {selectedInstitute.name}
            </p>
          </div>
        </div>
      </div>

      {/* Class switcher (compact - switch between classes) */}
      <div className="mx-2 bg-card border border-border rounded-2xl p-4 shadow-sm">
        <DashboardClassCards compact />
      </div>

      {/* Subjects picker */}
      <div className="mx-2 bg-card border border-border rounded-2xl p-4 shadow-sm">
        <DashboardSubjectCards />
      </div>

      {/* Quick Access Features */}
      <div className="mx-2 bg-card border border-border rounded-2xl p-4 shadow-sm">
        <FeaturesSection level="class" />
      </div>

      {/* Class Lectures */}
      <div className="mx-2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 pb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Video className="h-4 w-4 text-blue-500" />
            Class Lectures
            {lectures.length > 0 && <span className="text-xs font-normal text-muted-foreground">({lectures.length})</span>}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => navigate(buildSidebarUrl('class-lectures', { instituteId: selectedInstitute.id, classId: selectedClass.id }))}
            >
              View all
            </Button>
            <button onClick={() => fetchLectures(true)} disabled={lecturesLoading} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${lecturesLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="px-4 pb-4">
          {lecturesLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : lectures.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Video className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No lectures for this class yet</p>
            </div>
          ) : (
            <div className="relative">
              {lectures.length > 2 && (
                <>
                  <button onClick={() => scrollLectures('left')} className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center hover:bg-muted transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => scrollLectures('right')} className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center hover:bg-muted transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
              <div ref={lectureScrollRef} className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {orderedLectures.map((lec: any) => {
                const isOpen = expandedLecture === lec.id;
                const status = getLectureStatus(lec);
                const isLive = status === 'ongoing' || status === 'live';
                const isJoinClosed = status === 'completed' || status === 'cancelled' || status === 'postponed';
                const joinUrl = getLiveJoinUrl(lec) || getMeetingLink(lec);
                const canJoin = !!joinUrl && !isJoinClosed;
                const recUrl = getRecordingJoinUrl(lec) || getRecordingUrl(lec);

                const rawThumb = pickString(
                  lec.thumbnailUrl,
                  lec.thumbnail_url,
                  lec.thumbnail,
                  lec.coverImageUrl,
                  lec.cover_image_url,
                  lec.imageUrl,
                  lec.image_url
                );
                const thumbSrc = rawThumb ? getImageUrl(rawThumb) : '';

                const statusLabel = isLive
                  ? 'Live'
                  : status
                    ? `${status.charAt(0).toUpperCase()}${status.slice(1)}`
                    : 'Scheduled';

                const cardStateClass = isOpen
                  ? 'ring-2 ring-primary shadow-lg'
                  : isLive
                    ? 'ring-2 ring-red-500/50 shadow-lg shadow-red-500/20'
                    : 'hover:shadow-md';

                const startTime = getLectureStart(lec);
                const endTime = getLectureEnd(lec);
                const subjectLabel = pickString(lec.subject, lec.subjectName, lec.subject_name)
                  || (lec.subjectId ? String(lec.subjectId) : '');
                return (
                  <Card key={lec.id} className={`overflow-hidden transition-all duration-200 flex flex-col cursor-pointer w-[260px] sm:w-[280px] shrink-0 snap-start ${cardStateClass}`} onClick={() => setExpandedLecture(isOpen ? null : lec.id)}>
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-muted group">
                      {thumbSrc ? (
                        <img src={thumbSrc} alt={lec.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1">
                          <ImageIcon className="h-8 w-8" />
                          <span className="text-[10px] font-medium">No Thumbnail</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <Badge
                        variant={status === 'scheduled' ? 'default' : status === 'completed' ? 'secondary' : 'destructive'}
                        className={`absolute top-2 left-2 text-[10px] px-1.5 py-0 backdrop-blur-sm ${isLive ? 'bg-red-600/90 text-white border-red-600/80 animate-pulse' : 'bg-background/80'}`}
                      >
                        {statusLabel}
                      </Badge>
                      <div className="absolute bottom-0 left-0 right-0 p-2.5">
                        <p className="font-semibold text-sm text-white line-clamp-2 drop-shadow-md">{lec.title}</p>
                      </div>
                    </div>
                    {/* Card body */}
                    <div className="p-2.5 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{startTime ? new Date(startTime).toLocaleDateString() : 'No date'}</span>
                        {subjectLabel && <span className="text-primary font-medium">· {subjectLabel}</span>}
                      </div>
                      {lec.venue && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />{lec.venue}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/50">
                        {canJoin && (
                          <Button
                            size="sm"
                            className={`${isLive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white h-7 text-xs rounded-lg gap-1`}
                            onClick={(e) => { e.stopPropagation(); handleJoinLecture(lec); }}
                          >
                            <ExternalLink className="h-3 w-3" />{isLive ? 'Live' : 'Join'}
                          </Button>
                        )}
                        {recUrl && (
                          <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg gap-1" onClick={(e) => { e.stopPropagation(); handleRecording(lec); }}>
                            <Video className="h-3 w-3" />Rec
                          </Button>
                        )}
                        <span className="ml-auto flex items-center text-muted-foreground/60">
                          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                        </span>
                      </div>
                    </div>
                    {/* Expanded details — inline inside the card */}
                    {isOpen && (
                      <div className="px-2.5 pb-3 pt-0 flex flex-col gap-2 border-t border-border/60 bg-muted/30" onClick={(e) => e.stopPropagation()}>
                        {lec.description && <p className="text-xs text-muted-foreground pt-2">{lec.description}</p>}
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-background border border-border/50">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Start</span>
                            <span className="text-xs font-medium">{startTime ? new Date(startTime).toLocaleString() : 'N/A'}</span>
                          </div>
                          {endTime && (
                            <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-background border border-border/50">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">End</span>
                              <span className="text-xs font-medium">{new Date(endTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                            </div>
                          )}
                        </div>
                        {Array.isArray(lec.materials) && lec.materials.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Materials</p>
                            {lec.materials.map((m: any, i: number) => {
                              const icon = m.source === 'S3' ? <Cloud className="h-3 w-3 text-emerald-500 shrink-0" />
                                : (m.source === 'GOOGLE_DRIVE' || m.source === 'GOOGLE_DRIVE_INSTITUTE') ? <HardDrive className="h-3 w-3 text-blue-500 shrink-0" />
                                : <Link2 className="h-3 w-3 text-orange-500 shrink-0" />;
                              return (
                                <a key={i} href={m.driveWebViewLink || m.documentUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-1.5 rounded-lg bg-background border border-border/50 text-xs text-muted-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
                                  {icon}<span className="truncate flex-1">{m.documentName}</span><ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* My Attendance */}
      <div className="mx-2">
        <AttendanceFeedWidget filterInstituteId={selectedInstitute.id} />
      </div>

      <VideoPreviewDialog
        open={!!videoPreviewUrl}
        onOpenChange={(open) => { if (!open) { setVideoPreviewUrl(null); setVideoPreviewTitle(''); } }}
        url={videoPreviewUrl || ''}
        title={videoPreviewTitle}
      />
    </div>
  );
};

export default ClassDashboardView;