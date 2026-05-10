/**
 * ViewRecordingPage — public page at /view-recording/:urlId
 *
 * Handles all access levels and video platforms:
 *   SYSTEM      → native HTML5 <video> with full PLAY/PAUSE/SEEK/HEARTBEAT
 *   YOUTUBE     → YouTube IFrame API with state-change events
 *   GOOGLE_DRIVE → embedded Drive preview with periodic heartbeats only
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { lectureTrackingApi, RecordingAccessInfo, HeartbeatActivity } from '@/api/lectureTracking.api';
import { Badge } from '@/components/ui/badge';
import {
  PlayCircle, LogIn, AlertCircle, CreditCard,
  ExternalLink, Monitor, Youtube, HardDrive, Clock,
  Lock, FileText, ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen,
  PauseCircle, Maximize, Minimize, Settings, Volume2, VolumeX, FastForward, Play, User, Video, Info, Key, Mail, LockIcon, MonitorSmartphone
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { getImageUrl } from '@/utils/imageUrlHelper';
import AppLoadingScreen from '@/components/AppLoadingScreen';


type Phase = 'loading' | 'auth-required' | 'welcome' | 'join' | 'playing' | 'error' | 'expired';
type RecordingTab = 'login' | 'welcome' | 'playing';

const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_THRESHOLD = 20;
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const INACTIVITY_PROMPT_TIMEOUT_MS = 30 * 1000; // 30 seconds

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

function extractDriveFileId(url: string): string | null {
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function getTimeOfDayLabel(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function formatWelcomeMessage(template: string, name: string) {
  const timeOfDay = getTimeOfDayLabel();
  const greeting = `Good ${timeOfDay}`;
  return template
    .replace(/{{\s*name\s*}}/gi, name)
    .replace(/{{\s*greeting\s*}}/gi, greeting)
    .replace(/{{\s*timeOfDay\s*}}/gi, timeOfDay);
}

function pickWelcomeVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => /male|david|mark|michael|alex/i.test(v.name)) ||
    voices.find(v => /male/i.test(v.name)) ||
    voices[0] ||
    null
  );
}

export default function ViewRecordingPage() {
  const { urlId } = useParams<{ urlId: string }>();
  const { user, login, instituteLogin, instituteLoginForce } = useAuth();
  const { branding, isTenantLogin, isLoading } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [info, setInfo] = useState<RecordingAccessInfo | null>(null);
  const [error, setError] = useState('');

  const requestedTab = (searchParams.get('tab') as RecordingTab | null) || 'login';

  // Guest form
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestSchool, setGuestSchool] = useState('');
  const [joinMode, setJoinMode] = useState<'guest' | 'institute' | 'suraksha'>('guest');

  // Inline login form
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [useOtherAccount, setUseOtherAccount] = useState(false);
  const [deviceLimitInfo, setDeviceLimitInfo] = useState<any>(null);
  const [pendingWatchAsGuest, setPendingWatchAsGuest] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Session
  const [starting, setStarting] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const activitiesRef = useRef<HeartbeatActivity[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef(0);
  const [localActivities, setLocalActivities] = useState<HeartbeatActivity[]>([]);

  // Player refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const userDisplayName = user?.nameWithInitials || user?.name || guestName || 'Student';
  const userImageUrl = user?.imageUrl || '';
  const welcomeMessage = info?.welcomeMessageEnabled
    ? formatWelcomeMessage(
      info.welcomeMessageText || 'Hello {{name}}, welcome to this lecture. Please stay connected and complete the session.',
      userDisplayName,
    )
    : '';
  const [typedWelcome, setTypedWelcome] = useState('');
  const hasSpokeRef = useRef(false); // guard: prevent double-speak on re-renders

  // Inactivity
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showInactivityPrompt, setShowInactivityPrompt] = useState(false);

  // ── Effective branding (placed AFTER all state so no TDZ issue) ──────────
  // Guest / Student tabs → institute identity; Suraksha tab → SurakshaLMS
  const effectiveBranding = useMemo(() => {
    if (joinMode === 'suraksha') {
      return {
        logo: 'https://suraksha.lk/assets/logos/surakshalms-logo.png',
        name: 'SurakshaLMS',
        welcome: 'Welcome back',
        subtitle: 'Sign in with your Suraksha account',
      };
    }
    const instName =
      branding?.customAppName ||
      (isTenantLogin && branding?.name) ||
      info?.instituteName ||
      'Institute';
    const instLogo = branding?.loginLogoUrl
      ? getImageUrl(branding.loginLogoUrl)
      : branding?.logoUrl
        ? getImageUrl(branding.logoUrl)
        : info?.instituteLogoUrl
          ? getImageUrl(info.instituteLogoUrl)
          : 'https://suraksha.lk/assets/logos/surakshalms-logo.png';
    return {
      logo: instLogo,
      name: instName,
      welcome: branding?.loginWelcomeTitle || 'Welcome back',
      subtitle: branding?.loginWelcomeSubtitle || 'Please sign in to continue watching',
    };
  }, [joinMode, branding, isTenantLogin, info]);

  const syncTab = useCallback((tab: RecordingTab, replace = false) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace });
  }, [searchParams, setSearchParams]);

  const goToLogin = useCallback(() => {
    syncTab('login');
    setPhase('auth-required');
  }, [syncTab]);

  const goToWelcome = useCallback(() => {
    syncTab('welcome');
    setPhase('welcome');
  }, [syncTab]);

  const goToPlaying = useCallback(() => {
    syncTab('playing');
    setPhase('playing');
  }, [syncTab]);

  // ── Fetch access info ────────────────────────────────────────────────────

  useEffect(() => {
    if (!urlId) { setPhase('error'); setError('Invalid recording URL.'); return; }
    lectureTrackingApi.validateRecordingAccess(urlId)
      .then(data => {
        setInfo(data);
        if (!data.hasAccess) {
          setPhase('auth-required');
          syncTab('login', true);
          return;
        }

        // Access granted
        if (requestedTab === 'welcome' && data.welcomeMessageEnabled) {
          setPhase('welcome');
          return;
        }

        // Direct link to ?tab=playing — show join panel immediately then auto-start
        if (requestedTab === 'playing') {
          setPhase('join');
          void handleWatch(!user); // auto-start; guest if no user
          return;
        }

        setPhase('join');
      })
      .catch(err => {
        const msg = err?.message ?? 'Could not load recording.';
        if (msg.includes('expired')) setPhase('expired');
        else { setPhase('error'); setError(msg); }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlId, user?.id]);

  // ── Activity helpers ─────────────────────────────────────────────────────

  const flushActivities = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || activitiesRef.current.length === 0) return;
    const batch = activitiesRef.current.splice(0);
    try {
      await lectureTrackingApi.sendHeartbeats(sid, batch);
    } catch {
      activitiesRef.current.unshift(...batch);
    }
  }, []);

  const queueActivity = useCallback((type: HeartbeatActivity['type'], videoTimestamp: number) => {
    positionRef.current = videoTimestamp;
    const act = { type, videoTimestamp, wallTime: Date.now() };
    activitiesRef.current.push(act);
    setLocalActivities(prev => {
      const next = [...prev, act];
      if (next.length > 50) return next.slice(next.length - 50);
      return next;
    });
    if (activitiesRef.current.length >= FLUSH_THRESHOLD) flushActivities();
  }, [flushActivities]);

  // ── Inactivity tracking ──────────────────────────────────────────────────

  const handleInactivityPrompt = useCallback(() => {
    setShowInactivityPrompt(true);
    videoRef.current?.pause();
    ytPlayerRef.current?.pauseVideo?.();
    inactivityPromptTimerRef.current = setTimeout(() => {
      endSession();
      setShowInactivityPrompt(false);
    }, INACTIVITY_PROMPT_TIMEOUT_MS);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (inactivityPromptTimerRef.current) clearTimeout(inactivityPromptTimerRef.current);
    setShowInactivityPrompt(false);
    inactivityTimerRef.current = setTimeout(handleInactivityPrompt, INACTIVITY_TIMEOUT_MS);
  }, [handleInactivityPrompt]);

  const handleUserActivity = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const handleStay = () => {
    resetInactivityTimer();
    videoRef.current?.play();
    ytPlayerRef.current?.playVideo?.();
  };

  useEffect(() => {
    if (phase === 'playing') {
      resetInactivityTimer();
      window.addEventListener('mousemove', handleUserActivity);
      window.addEventListener('keydown', handleUserActivity);
      return () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (inactivityPromptTimerRef.current) clearTimeout(inactivityPromptTimerRef.current);
        window.removeEventListener('mousemove', handleUserActivity);
        window.removeEventListener('keydown', handleUserActivity);
      };
    }
  }, [phase, resetInactivityTimer, handleUserActivity]);

  // ── Cleanup / session end ────────────────────────────────────────────────

  const endSession = useCallback(async () => {
    if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null; }
    await flushActivities();
    const sid = sessionIdRef.current;
    if (sid) {
      sessionIdRef.current = null;
      lectureTrackingApi.endRecordingSession(sid, positionRef.current).catch(() => { });
    }
  }, [flushActivities]);

  useEffect(() => () => { endSession(); }, [endSession]);

  useEffect(() => {
    if (phase !== 'welcome' || !info?.welcomeMessageEnabled) {
      hasSpokeRef.current = false; // reset for next welcome
      return;
    }
    if (!info.welcomeMessageVoiceEnabled || !window.speechSynthesis) return;
    if (hasSpokeRef.current) return; // already started — don't double-play
    hasSpokeRef.current = true;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(welcomeMessage);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;
    const voice = pickWelcomeVoice();
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);

    return () => {
      // Only cancel if this effect is cleaning up due to phase change (not re-render)
      // We do NOT cancel here — let speech finish naturally or until skipWelcome is called
    };
  }, [phase]); // intentionally only phase — avoids double-fire on info/welcomeMessage changes

  useEffect(() => {
    if (phase !== 'welcome') {
      setTypedWelcome('');
      return;
    }

    setTypedWelcome('');
    if (!welcomeMessage) return;

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedWelcome(welcomeMessage.slice(0, index));
      if (index >= welcomeMessage.length) {
        window.clearInterval(timer);
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [phase, welcomeMessage]);

  // ── Inline login ─────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    setLoginBusy(true);
    try {
      if (joinMode === 'institute' && info?.instituteId) {
        const result = await instituteLogin({
          instituteId: info.instituteId,
          userIdByInstitute: identifier,
          password,
        });
        if (result?.deviceLimitReached) {
          setDeviceLimitInfo(result);
          setLoginBusy(false);
          return;
        }
      } else {
        await login({ identifier, password });
      }
      // user?.id change triggers useEffect re-fetch which sets phase to 'join'
      setUseOtherAccount(false);
    } catch (err: any) {
      setLoginErr(err?.message ?? 'Invalid credentials. Please try again.');
      setLoginBusy(false);
    }
  };

  const handleForceLogin = async () => {
    setLoginErr('');
    setLoginBusy(true);
    try {
      if (joinMode === 'institute' && info?.instituteId) {
        await instituteLoginForce({
          instituteId: info.instituteId,
          userIdByInstitute: identifier,
          password,
        });
      }
      setDeviceLimitInfo(null);
      setUseOtherAccount(false);
    } catch (err: any) {
      setLoginErr(err?.message ?? 'Forced login failed. Please try again.');
      setLoginBusy(false);
    }
  };

  // ── Start watching ───────────────────────────────────────────────────────

  const handleWatch = async (asGuest = false) => {
    if (!info) return;
    setStarting(true);
    try {
      const result = await lectureTrackingApi.startRecordingSession({
        lectureId: info.lectureId,
        ...(asGuest ? {
          guestName: guestName || 'Guest',
          guestEmail: guestEmail || undefined,
          guestPhone: guestPhone || undefined,
          guestSchool: guestSchool || undefined
        } : {}),
      });
      sessionIdRef.current = result.sessionId;
      syncTab('playing');

      // Periodic flush + heartbeat
      flushTimerRef.current = setInterval(() => {
        const vid = videoRef.current;
        if (vid && !vid.paused) queueActivity('HEARTBEAT', Math.floor(vid.currentTime));
        else if (ytPlayerRef.current?.getPlayerState?.() === 1) {
          queueActivity('HEARTBEAT', Math.floor(ytPlayerRef.current.getCurrentTime?.() ?? 0));
        }
        flushActivities();
      }, FLUSH_INTERVAL_MS);

      setPhase('playing');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to start session.');
    } finally {
      setStarting(false);
    }
  };

  const startWatch = useCallback((asGuest = false) => {
    if (!info) return;
    if (info.welcomeMessageEnabled) {
      setPendingWatchAsGuest(asGuest);
      goToWelcome();
      return;
    }
    void handleWatch(asGuest);
  }, [info, handleWatch, goToWelcome]);

  const continueAfterWelcome = useCallback(() => {
    const asGuest = pendingWatchAsGuest;
    setPendingWatchAsGuest(false);
    syncTab('playing');
    void handleWatch(asGuest);
  }, [pendingWatchAsGuest, handleWatch, syncTab]);

  const skipWelcome = useCallback(() => {
    window.speechSynthesis?.cancel?.();
    setIsSpeaking(false);
    continueAfterWelcome();
  }, [continueAfterWelcome]);

  // ── YouTube IFrame API init ──────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'playing' || info?.platform !== 'YOUTUBE' || !info.recordingUrl) return;
    const ytId = extractYouTubeId(info.recordingUrl);
    if (!ytId) return;

    const initPlayer = () => {
      if (!document.getElementById('yt-player-container')) return;
      ytPlayerRef.current = new (window as any).YT.Player('yt-player-container', {
        videoId: ytId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 0, modestbranding: 1, rel: 0 },
        events: {
          onStateChange: (e: any) => {
            const pos = Math.floor(ytPlayerRef.current?.getCurrentTime?.() ?? 0);
            if (e.data === 1) queueActivity('PLAY', pos);
            else if (e.data === 2) queueActivity('PAUSE', pos);
            else if (e.data === 3) queueActivity('SEEK', pos);
          },
        },
      });
    };

    if ((window as any).YT?.Player) {
      initPlayer();
    } else {
      if (!document.getElementById('yt-iframe-api')) {
        const s = document.createElement('script');
        s.id = 'yt-iframe-api';
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      }
      const prev = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => { prev?.(); initPlayer(); };
    }

    return () => { ytPlayerRef.current?.destroy?.(); ytPlayerRef.current = null; };
  }, [phase, info, queueActivity]);

  // ─────────────────────────────────────────────────────────────────────────

  const bgStyle = info?.bgUrl
    ? { backgroundImage: `url(${getImageUrl(info.bgUrl)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  // ── Full-screen playing view ─────────────────────────────────────────────

  if (phase === 'playing' && info) {
    const userDisplayName = user?.nameWithInitials || user?.name || user?.email || 'Student';
    const userImageUrl = user?.imageUrl ? getImageUrl(user.imageUrl) : '';

    const Sidebar = (
      <aside className="flex flex-col h-full w-full bg-card overflow-hidden">
        {/* Student identity card */}
        <div className="flex items-center gap-2.5 p-3 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
          {userImageUrl ? (
            <img src={userImageUrl} alt={userDisplayName} className="h-10 w-10 rounded-full object-cover border border-border shrink-0" draggable={false} />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
              {(userDisplayName[0] || 'U').toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{userDisplayName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" /> Secure session
            </p>
          </div>
        </div>

        {/* Description */}
        {info.description && (
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</h4>
              <button type="button" onClick={() => setDescExpanded(s => !s)} className="text-muted-foreground hover:text-foreground transition-colors">
                {descExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className={`text-xs text-foreground/80 leading-relaxed mt-1.5 ${descExpanded ? '' : 'line-clamp-3'}`}>
              {info.description}
            </p>
          </div>
        )}

        {/* Materials & Activities scroll area */}
        <div className="flex-1 overflow-y-auto">
          {/* Materials */}
          <div className="p-3 border-b border-border sticky top-0 bg-card z-10">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Materials {info.materials && info.materials.length > 0 && <span className="ml-1 text-[10px] font-medium text-muted-foreground/70">({info.materials.length})</span>}
            </h4>
          </div>
          {info.materials && info.materials.length > 0 ? (
            <ul className="p-2 space-y-1.5 border-b border-border">
              {info.materials.map((m, i) => (
                <li key={i}>
                  <a href={m.documentUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2 p-2 rounded-md border border-border/50 hover:bg-muted/60 hover:border-border transition-colors text-left group">
                    <HardDrive className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{m.documentName}</p>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground border-b border-border">
              No reference materials.
            </div>
          )}

          {/* Session Activities */}
          <div className="p-3 border-b border-border sticky top-0 bg-card z-10">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Your Session Activity
            </h4>
          </div>
          <div className="p-2 space-y-1.5">
            {localActivities.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No activity recorded yet.
              </div>
            ) : (
              [...localActivities].reverse().slice(0, 15).map((act, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md border border-border/50 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${act.type === 'PLAY' ? 'bg-emerald-500' : act.type === 'PAUSE' ? 'bg-amber-500' : act.type === 'RATE_CHANGE' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                    <span className="text-xs font-medium text-foreground">{act.type}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{formatDuration(act.videoTimestamp)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-border bg-muted/30 text-[10px] text-muted-foreground/80 leading-tight space-y-0.5">
          <p className="flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Copy & download disabled</p>
          <p className="truncate">{new Date().toLocaleDateString()} · Suraksha LMS</p>
        </div>
      </aside>
    );

    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col" onContextMenu={e => e.preventDefault()} style={{ userSelect: 'none' }}>
        {/* Top bar */}
        <header className="flex items-center justify-between gap-2 px-3 py-2 bg-black/90 text-white border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center shrink-0">
              <PlayCircle className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-medium truncate">{info.title || 'Recording'}</span>
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/80">
              {info.platform}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setSidebarOpen(s => !s)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors">
              {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0">
          <div className="flex-1 p-2 sm:p-3 min-h-0 relative">
            <div className="w-full h-full relative rounded-lg overflow-hidden bg-black flex items-center justify-center">
              {showInactivityPrompt && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center gap-4">
                  <p className="text-white text-lg">Are you still there?</p>
                  <button onClick={handleStay} className="px-6 py-2 rounded-lg bg-blue-600 text-white font-bold">I'm here</button>
                </div>
              )}
              {info.platform === 'SYSTEM' && info.recordingUrl && (
                <video
                  ref={videoRef}
                  className="w-full h-full"
                  controls
                  controlsList="nodownload"
                  src={getImageUrl(info.recordingUrl)}
                  onPlay={() => queueActivity('PLAY', Math.floor(videoRef.current?.currentTime ?? 0))}
                  onPause={() => queueActivity('PAUSE', Math.floor(videoRef.current?.currentTime ?? 0))}
                  onSeeked={() => queueActivity('SEEK', Math.floor(videoRef.current?.currentTime ?? 0))}
                  onRateChange={() => queueActivity('RATE_CHANGE', Math.floor(videoRef.current?.currentTime ?? 0))}
                />
              )}
              {info.platform === 'YOUTUBE' && (
                <div id="yt-player-container" className="w-full h-full absolute inset-0" />
              )}
              {info.platform === 'GOOGLE_DRIVE' && info.recordingUrl && (
                <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-5 px-6">
                  <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <HardDrive className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Google Drive Recording</h3>
                  <a href={info.recordingUrl} target="_blank" rel="noopener noreferrer" className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center gap-2">
                    <ExternalLink className="w-5 h-5" /> Open in Google Drive
                  </a>
                </div>
              )}
            </div>
          </div>

          {sidebarOpen && (
            <div className="h-[40vh] sm:h-auto sm:w-[320px] shrink-0 border-t sm:border-t-0 sm:border-l border-white/10 bg-card text-foreground">
              {Sidebar}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Pre-watch / auth + split-panel ──────────────────────────────────────

  // Full-screen loading / error (before info arrives)
  if (isLoading || (phase === 'loading' && !info)) {
    return <AppLoadingScreen message="Loading recording..." />;
  }

  if (phase === 'error' || phase === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">{phase === 'expired' ? 'Link Expired' : 'Not Found'}</h1>
          <p className="text-slate-500 text-sm">{phase === 'expired' ? 'This recording link has expired.' : error || 'This recording could not be found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center p-4 lg:p-8">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:h-[650px] border border-white/60">

        {/* ── Left panel ── */}
        <div className={`relative flex flex-col overflow-hidden ${info?.bgUrl ? '' : 'bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]'}`}>
          {info?.bgUrl && (
            <img src={getImageUrl(info.bgUrl)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className={`absolute inset-0 ${info?.bgUrl ? 'bg-black/60' : 'bg-gradient-to-br from-[#1a1a2e]/90 via-[#16213e]/90 to-[#0f3460]/90'}`} />
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4 pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-10">
            <div>
              {/* Recording badge */}
              <div className="mb-5">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/30 text-white text-sm font-semibold backdrop-blur-sm">
                  <PlayCircle className="w-3.5 h-3.5" />
                  Recording
                </span>
              </div>

              {/* Thumbnail — cardImageUrl preferred, bgUrl as preview fallback */}
              {(info?.cardImageUrl || info?.bgUrl) && (
                <div className="mb-5 rounded-2xl overflow-hidden ring-2 ring-white/20 shadow-lg shadow-black/30">
                  <img
                    src={getImageUrl(info.cardImageUrl || info.bgUrl || '')}
                    alt={info?.title}
                    className="w-full h-40 sm:h-48 object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight mb-2">{info?.title ?? '—'}</h1>

              {/* Institute identity in left panel */}
              {(info?.instituteName || info?.instituteLogoUrl || (isTenantLogin && branding?.logoUrl)) && (
                <div className="flex items-center gap-2.5 mb-4">
                  {(info?.instituteLogoUrl || branding?.logoUrl) && (
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/10 border border-white/20 shrink-0">
                      <img
                        src={getImageUrl(info?.instituteLogoUrl || branding?.logoUrl || '')}
                        alt=""
                        className="w-full h-full object-contain p-0.5"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                  {info?.instituteName && (
                    <p className="text-white/80 text-sm font-medium">{info.instituteName}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white border border-white/20">
                  {info?.accessLevel === 'ANYONE' && '🌐 Public'}
                  {info?.accessLevel === 'SURAKSHA_USERS' && '👤 Suraksha Users'}
                  {info?.accessLevel === 'ENROLLED_ONLY' && '🎓 Enrolled Students'}
                  {info?.accessLevel === 'PAID_ONLY' && '💳 Paid Students'}
                </span>
                {info?.platform && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white border border-white/20">
                    <PlatformIcon platform={info.platform} />
                    {info.platform === 'YOUTUBE' ? 'YouTube' : info.platform === 'GOOGLE_DRIVE' ? 'Google Drive' : 'System'}
                  </span>
                )}
              </div>
            </div>

            {info?.durationSeconds && (
              <div className="mt-6 flex items-center gap-3 p-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm">
                <Clock className="w-5 h-5 text-white/70 shrink-0" />
                <div>
                  <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Duration</p>
                  <p className="text-white text-sm font-semibold">{formatDuration(info.durationSeconds)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex flex-col h-full overflow-hidden bg-gradient-to-b from-white to-slate-50/80">
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">

            {/* ── Loading (re-check after login) ── */}
            {phase === 'loading' && (
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">Checking access…</p>
              </div>
            )}

            {/* Auth required — ANYONE: 3-tab selection */}
            {phase === 'auth-required' && info?.accessLevel === 'ANYONE' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-1">Watch Recording</h2>
                  <p className="text-slate-500 text-sm">This recording is open to everyone. Choose how you want to join.</p>
                </div>

                {/* 3-Tab Join Switcher */}
                <div className="flex rounded-xl border-2 border-slate-100 overflow-hidden bg-slate-50/50 p-1 gap-1">
                  <button type="button" onClick={() => { setJoinMode('guest'); goToLogin(); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${joinMode === 'guest' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                    Guest
                  </button>
                  <button type="button" onClick={() => { setJoinMode('institute'); goToLogin(); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${joinMode === 'institute' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                    Student
                  </button>
                  <button type="button" onClick={() => { setJoinMode('suraksha'); goToLogin(); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${joinMode === 'suraksha' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                    Suraksha User
                  </button>
                </div>

                {/* ── Branding header — hidden on welcome phase (welcome message IS the content) ── */}
                <div className="mb-6 text-center mt-6">
                  <div className="flex justify-center mb-3">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                      <img
                        src={effectiveBranding.logo}
                        alt={effectiveBranding.name}
                        className="w-full h-full object-contain p-2"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-600">{effectiveBranding.name}</p>
                  <h2 className="mt-1 text-xl lg:text-2xl font-bold text-slate-900">{effectiveBranding.welcome}</h2>
                  <p className="mt-1 text-sm text-slate-500">{effectiveBranding.subtitle}</p>
                </div>

                {joinMode === 'guest' && (
                  <form className="space-y-3" onSubmit={e => { e.preventDefault(); startWatch(true); }}>
                    {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                      <input value={guestName} onChange={e => setGuestName(e.target.value)} required placeholder="e.g. Kamal Perera"
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Phone (Optional)</label>
                        <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} type="tel" placeholder="077..."
                          className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">School (Optional)</label>
                        <input value={guestSchool} onChange={e => setGuestSchool(e.target.value)} placeholder="Your school"
                          className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email (Optional)</label>
                      <input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} type="email" placeholder="you@example.com"
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition" />
                    </div>
                    <button type="submit" disabled={starting}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-60">
                      {starting ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <PlayCircle className="w-4 h-4" />}
                      Watch as Guest
                    </button>
                  </form>
                )}

                {deviceLimitInfo ? (
                  <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="text-center space-y-2">
                      <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
                        <MonitorSmartphone className="w-6 h-6 text-amber-600 dark:text-amber-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Device Limit Reached</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        You have reached the maximum number of allowed devices ({deviceLimitInfo.maxDevices}) for this institute.
                      </p>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-3 border border-slate-100 dark:border-slate-700">
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                        To watch on this device, we need to sign out your oldest active session:
                      </p>
                      {deviceLimitInfo.activeSessions?.slice(-1).map((session: any) => (
                        <div key={session.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg shadow-sm">
                          <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                            <MonitorSmartphone className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {session.deviceLabel || 'Unknown Device'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Last active: {new Date(session.lastActiveAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {loginErr && (
                      <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center border border-red-100 dark:border-red-800">
                        <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                        {loginErr}
                      </div>
                    )}

                    <div className="space-y-3 pt-2">
                      <button
                        onClick={handleForceLogin}
                        disabled={loginBusy}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold text-sm hover:from-amber-700 hover:to-amber-800 transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {loginBusy ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          'Sign Out Oldest Device & Watch'
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setDeviceLimitInfo(null);
                          setPassword('');
                          setLoginErr('');
                        }}
                        disabled={loginBusy}
                        className="w-full py-3.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (joinMode === 'institute' || joinMode === 'suraksha') && (
                  <InlineLoginForm
                    identifier={identifier} setIdentifier={setIdentifier}
                    password={password} setPassword={setPassword}
                    showPw={showPw} setShowPw={setShowPw}
                    busy={starting} error={loginErr}
                    onSubmit={handleLogin}
                    joinMode={joinMode}
                    label={joinMode === 'institute' ? 'Institute Sign in' : 'Suraksha Sign in'}
                  />
                )}
              </div>
            )}

            {/* Auth required — gated (SURAKSHA_USERS / ENROLLED_ONLY / PAID_ONLY) */}
            {phase === 'auth-required' && info?.accessLevel !== 'ANYONE' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-1">Sign in to Watch</h2>
                  <p className="text-slate-500 text-sm">
                    {info?.accessLevel === 'PAID_ONLY' ? 'This recording is for paid students. Sign in to verify your access.'
                      : info?.accessLevel === 'ENROLLED_ONLY' ? 'This recording is for enrolled students only.'
                        : 'Sign in to your Suraksha LMS account to watch.'}
                  </p>
                </div>
                {info?.requirePayment && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <CreditCard className="h-4 w-4 shrink-0" />
                    <span>A valid payment is required to access this recording.</span>
                  </div>
                )}

                {/* ── Branding header ── */}
                <div className="mb-6 text-center mt-6">
                  <div className="flex justify-center mb-3">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                      <img
                        src={effectiveBranding.logo}
                        alt={effectiveBranding.name}
                        className="w-full h-full object-contain p-2"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-600">{effectiveBranding.name}</p>
                  <h2 className="mt-1 text-xl lg:text-2xl font-bold text-slate-900">{effectiveBranding.welcome}</h2>
                  <p className="mt-1 text-sm text-slate-500">{effectiveBranding.subtitle}</p>
                </div>

                {/* Already logged in as someone */}
                {user && !useOtherAccount ? (
                  <ConfirmIdentity user={user} busy={starting} error={error}
                    onConfirm={() => startWatch(false)} onSwitch={() => { setUseOtherAccount(true); setJoinMode('institute'); }} />
                ) : (
                  <InlineLoginForm identifier={identifier} setIdentifier={setIdentifier} password={password} setPassword={setPassword}
                    showPw={showPw} setShowPw={setShowPw} busy={loginBusy} error={loginErr} onSubmit={handleLogin}
                    joinMode={joinMode} label="Sign in & Watch" />
                )}
              </div>
            )}

            {/* Access granted — ready to watch */}
            {phase === 'join' && info && (
              <div className="space-y-5">
                {user && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-800 text-sm">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Access verified — ready to watch.</span>
                  </div>
                )}

                {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

                {user && !useOtherAccount ? (
                  <ConfirmIdentity user={user} busy={starting} error=""
                    onConfirm={() => startWatch(false)} onSwitch={() => { setUseOtherAccount(true); setJoinMode('institute'); }} watchMode />
                ) : (
                  <div className="space-y-5">
                    {/* 3-Tab Join Switcher */}
                    <div className="flex rounded-xl border-2 border-slate-100 overflow-hidden bg-slate-50/50 p-1 gap-1">
                      <button type="button" onClick={() => setJoinMode('guest')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${joinMode === 'guest' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                        Guest
                      </button>
                      <button type="button" onClick={() => setJoinMode('institute')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${joinMode === 'institute' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                        Student
                      </button>
                      <button type="button" onClick={() => setJoinMode('suraksha')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${joinMode === 'suraksha' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                        Suraksha User
                      </button>
                    </div>

                    {joinMode === 'guest' ? (
                      <form className="space-y-3" onSubmit={e => { e.preventDefault(); startWatch(true); }}>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                          <input value={guestName} onChange={e => setGuestName(e.target.value)} required placeholder="e.g. Kamal Perera"
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Phone (Optional)</label>
                            <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} type="tel" placeholder="077..."
                              className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">School (Optional)</label>
                            <input value={guestSchool} onChange={e => setGuestSchool(e.target.value)} placeholder="Your school"
                              className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition" />
                          </div>
                        </div>
                        <button type="submit" disabled={starting}
                          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-60">
                          {starting ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <PlayCircle className="w-4 h-4" />}
                          Watch Recording
                        </button>
                      </form>
                    ) : (
                      <InlineLoginForm
                        identifier={identifier} setIdentifier={setIdentifier}
                        password={password} setPassword={setPassword}
                        showPw={showPw} setShowPw={setShowPw}
                        busy={starting} error={loginErr}
                        onSubmit={handleLogin}
                        joinMode={joinMode}
                        label={joinMode === 'institute' ? 'Institute Sign in' : 'Suraksha Sign in'}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {phase === 'welcome' && info && (
              <div className="relative h-full flex flex-col justify-center gap-6 rounded-[1.75rem] p-6 lg:p-8 bg-gradient-to-br from-white via-slate-50 to-sky-50 border border-slate-200 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.08),transparent_28%)]" />
                <button
                  type="button"
                  onClick={() => {
                    if (info.welcomeMessageVoiceEnabled && window.speechSynthesis) {
                      if (isSpeaking) {
                        window.speechSynthesis.cancel();
                        setIsSpeaking(false);
                        return;
                      }
                      const utterance = new SpeechSynthesisUtterance(welcomeMessage);
                      utterance.lang = 'en-US';
                      utterance.rate = 1;
                      utterance.pitch = 1;
                      const voice = pickWelcomeVoice();
                      if (voice) utterance.voice = voice;
                      utterance.onstart = () => setIsSpeaking(true);
                      utterance.onend = () => setIsSpeaking(false);
                      utterance.onerror = () => setIsSpeaking(false);
                      speechRef.current = utterance;
                      window.speechSynthesis.speak(utterance);
                    }
                  }}
                  className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-sky-200 bg-white/95 text-sky-700 shadow-lg shadow-sky-500/10 backdrop-blur-sm transition hover:bg-sky-50"
                  aria-label={isSpeaking ? 'Stop welcome voice' : 'Play welcome voice'}
                  title={isSpeaking ? 'Stop welcome voice' : 'Play welcome voice'}
                >
                  <PlayCircle className="h-4 w-4" />
                </button>
                <div className="relative z-10 space-y-5 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-xl ring-4 ring-sky-100 overflow-hidden">
                    {userImageUrl ? (
                      <img src={userImageUrl} alt={userDisplayName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-500 to-blue-700 text-white text-2xl font-bold">
                        {(userDisplayName[0] || 'S').toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">Welcome</p>
                    <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">Introduction</h2>
                    <p className="text-sm font-semibold text-slate-700">{info.instituteName || 'Cambridge International School'}</p>
                    <p className="text-sm text-slate-500">{userDisplayName}</p>
                  </div>
                  <div className="mx-auto max-w-2xl rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur-sm">
                    <p className="whitespace-pre-wrap text-base lg:text-lg leading-8 text-slate-800 min-h-[5rem]">
                      {typedWelcome}
                      {phase === 'welcome' && typedWelcome.length < welcomeMessage.length && (
                        <span className="ml-0.5 inline-block w-2 animate-pulse">|</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={skipWelcome}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-700"
                    >
                      Skip and continue
                    </button>
                    <button
                      type="button"
                      onClick={() => { goToLogin(); navigate(`/view-recording/${urlId}?tab=login`, { replace: false }); }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Back to login
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfirmIdentity({ user, onConfirm, onSwitch, busy, error, watchMode }: {
  user: any; onConfirm: () => void; onSwitch: () => void;
  busy: boolean; error: string; watchMode?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Is this you?</h2>
        <p className="text-slate-500 text-sm">{watchMode ? 'Confirm your profile to start watching.' : 'Confirm your profile to verify access.'}</p>
      </div>
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50 border-2 border-blue-200">
        {user.imageUrl ? (
          <img src={getImageUrl(user.imageUrl)} alt="" className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-blue-200" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {(user.nameWithInitials?.[0] || user.name?.[0] || 'U').toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-800 truncate">{user.nameWithInitials || user.name || user.email}</p>
          <p className="text-sm text-blue-600 font-medium">Currently signed in</p>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
      <button onClick={onConfirm} disabled={busy}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2.5 disabled:opacity-60">
        {busy ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          : <PlayCircle className="w-4 h-4" />}
        Yes, that's me — {watchMode ? 'Watch Recording' : 'Verify Access'}
      </button>
      <button onClick={onSwitch} className="w-full py-2.5 rounded-2xl border-2 border-slate-200 text-slate-500 font-medium text-sm hover:bg-slate-50 transition">
        Not me — use a different account
      </button>
    </div>
  );
}

function InlineLoginForm({ identifier, setIdentifier, password, setPassword, showPw, setShowPw, busy, error, onSubmit, label, joinMode }: {
  identifier: string; setIdentifier: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  showPw: boolean; setShowPw: (v: boolean) => void;
  busy: boolean; error: string;
  onSubmit: (e: React.FormEvent) => void;
  label?: string;
  joinMode?: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {joinMode === 'institute' ? 'Institute User ID' : 'Email or Phone'}
        </label>
        <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} required autoComplete="username"
          placeholder={joinMode === 'institute' ? 'e.g. STU2024001' : 'you@example.com'}
          className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {joinMode === 'institute' ? 'Institute Password' : 'Password'}
        </label>
        <div className="relative">
          <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••"
            className="w-full px-4 py-3.5 pr-12 rounded-xl border-2 border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition" />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
            {showPw
              ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
          </button>
        </div>
      </div>
      <button type="submit" disabled={busy}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2.5 disabled:opacity-60">
        {busy ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          : <LogIn className="w-4 h-4" />}
        {busy ? 'Signing in…' : (label ?? 'Sign in & Watch')}
      </button>
    </form>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function PlatformIcon({ platform }: { platform: RecordingAccessInfo['platform'] }) {
  if (platform === 'YOUTUBE') return <Youtube className="h-4 w-4 text-red-500" />;
  if (platform === 'GOOGLE_DRIVE') return <HardDrive className="h-4 w-4 text-blue-500" />;
  return <Monitor className="h-4 w-4 text-muted-foreground" />;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
