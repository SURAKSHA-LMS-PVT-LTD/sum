import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { lectureTrackingApi, LiveAccessInfo } from '@/api/lectureTracking.api';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { getImageUrl } from '@/utils/imageUrlHelper';
import AppLoadingScreen from '@/components/AppLoadingScreen';
import TrackingViewDialog from '@/components/TrackingViewDialog';
import { User, Video, Info, Lock, Key, Mail, LockIcon, MonitorSmartphone, AlertCircle, PlayCircle } from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getLectureState(info: LiveAccessInfo): 'live' | 'upcoming' | 'ended' {
  if (info.status === 'live' || (info.status as any) === 'in_progress') return 'live';
  if (info.status === 'completed' || info.status === 'cancelled') return 'ended';
  if (info.startTime && info.endTime) {
    const now = Date.now();
    const start = new Date(info.startTime).getTime();
    const end = new Date(info.endTime).getTime();
    if (now >= start && now <= end) return 'live';
    if (now > end) return 'ended';
  }
  return 'upcoming';
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

// ─── Types ─────────────────────────────────────────────────────────────────

type Phase =
  | 'loading'
  | 'needs-auth'   // not logged in AND access not granted
  | 'no-access'    // logged in but not enrolled / not paid
  | 'ready'        // access granted, ready to join
  | 'welcome'      // show welcome message before join
  | 'joining'
  | 'joined'
  | 'ended'
  | 'error';

type LiveTab = 'login' | 'welcome' | 'playing';

// ─── Component ─────────────────────────────────────────────────────────────

export default function LiveLecturePage() {
  const { urlId } = useParams<{ urlId: string }>();
  const { user, login, instituteLogin, instituteLoginForce } = useAuth();
  const { branding, isTenantLogin, isLoading } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>('loading');
  const [info, setInfo] = useState<LiveAccessInfo | null>(null);
  const [errMsg, setErrMsg] = useState('');

  const requestedTab = (searchParams.get('tab') as LiveTab | null) || 'login';

  // Join state
  const [joinErr, setJoinErr] = useState('');
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [recDialog, setRecDialog] = useState(false);
  const leaveRef = useRef<(() => void) | null>(null);
  const [pendingJoinAsGuest, setPendingJoinAsGuest] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Inline login form
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [useOtherAccount, setUseOtherAccount] = useState(false);
  const [deviceLimitInfo, setDeviceLimitInfo] = useState<any>(null);

  // Guest form
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestSchool, setGuestSchool] = useState('');
  const [joinMode, setJoinMode] = useState<'guest' | 'institute' | 'suraksha'>('guest');
  const welcomeMessage = info?.welcomeMessageEnabled
    ? formatWelcomeMessage(
        info.welcomeMessageText || 'Hello {{name}}, welcome to this lecture. Please stay connected and complete the session.',
        user?.nameWithInitials || user?.name || guestName || 'Student',
      )
    : '';
  const userDisplayName = user?.nameWithInitials || user?.name || guestName || 'Student';
  const userImageUrl = user?.imageUrl ? getImageUrl(user.imageUrl) : '';
  const [typedWelcome, setTypedWelcome] = useState('');
  const hasSpokeRef = useRef(false); // guard: prevent double-speak on re-renders

  // ── Effective branding (after all state to avoid TDZ) ──────────────
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
      subtitle: branding?.loginWelcomeSubtitle || 'Please sign in to continue',
    };
  }, [joinMode, branding, isTenantLogin, info]);

  const syncTab = useCallback((tab: LiveTab, replace = false) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace });
  }, [searchParams, setSearchParams]);

  // ── Fetch access info (re-runs when user changes after login) ─────────────
  useEffect(() => {
    if (!urlId) { setPhase('error'); setErrMsg('Invalid lecture URL.'); return; }
    setPhase('loading');
    lectureTrackingApi.validateLiveAccess(urlId)
      .then(data => {
        setInfo(data);
        const state = getLectureState(data);
        if (state === 'ended') { setPhase('ended'); return; }
        if (data.hasAccess) {
          if (requestedTab === 'welcome' && data.welcomeMessageEnabled) {
            setPhase('welcome');
            return;
          }
          setPhase('ready');
          return;
        }
        if (user) { setPhase('no-access'); return; }
        setPhase('needs-auth');
        if (data.accessLevel === 'ANYONE') setJoinMode('guest');
        syncTab('login', true);
      })
      .catch(e => {
        const msg: string = e?.message ?? '';
        if (msg.includes('expired')) { setPhase('error'); setErrMsg('This lecture link has expired.'); }
        else { setPhase('error'); setErrMsg(msg || 'Lecture not found.'); }
      });
  }, [urlId, user?.id]);

  // Register leave-on-unmount
  useEffect(() => () => { leaveRef.current?.(); }, []);

  useEffect(() => {
    if (phase !== 'welcome' || !info?.welcomeMessageEnabled) {
      hasSpokeRef.current = false;
      return;
    }
    
    if (!info.welcomeMessageVoiceEnabled || !window.speechSynthesis) return;
    if (hasSpokeRef.current) return;
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
      // Do not cancel here to allow speech to complete naturally
    };
  }, [phase]); // intentionally only phase to prevent re-fires

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

  // ── Join ──────────────────────────────────────────────────────────────────
  const doJoin = useCallback(async (asGuest = false) => {
    if (!info) return;
    setJoinErr('');
    setPhase('joining');
    try {
      const result = await lectureTrackingApi.joinLive({
        lectureId: info.lectureId,
        ...(asGuest ? { 
          guestName: guestName || 'Guest', 
          guestPhone: guestPhone || undefined, 
          guestEmail: guestEmail || undefined,
          guestSchool: guestSchool || undefined
        } : {}),
      });
      setAttendanceId(result.attendanceId);
      syncTab('playing');
      leaveRef.current = () => lectureTrackingApi.leaveLive(result.attendanceId).catch(() => {});
      setPhase('joined');
      if (info.meetingLink) {
        window.open(info.meetingLink, '_blank', 'noopener,noreferrer');
      }
    } catch (e: any) {
      setJoinErr(e?.message ?? 'Failed to join. Please try again.');
      setPhase('ready');
    }
  }, [info, guestName, guestPhone, guestEmail, syncTab]);

  const startJoin = useCallback((asGuest = false) => {
    if (!info) return;
    setJoinErr('');
    if (info.welcomeMessageEnabled) {
      setPendingJoinAsGuest(asGuest);
      syncTab('welcome');
      setPhase('welcome');
      return;
    }
    doJoin(asGuest);
  }, [info, doJoin, syncTab]);

  const continueAfterWelcome = useCallback(() => {
    const asGuest = pendingJoinAsGuest;
    setPendingJoinAsGuest(false);
    syncTab('playing');
    doJoin(asGuest);
  }, [pendingJoinAsGuest, doJoin, syncTab]);

  const skipWelcome = useCallback(() => {
    window.speechSynthesis?.cancel?.();
    setIsSpeaking(false);
    continueAfterWelcome();
  }, [continueAfterWelcome]);

  // ── Inline login → re-access check ────────────────────────────────────────
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
      // useEffect will re-run when user?.id changes and re-check access
      setUseOtherAccount(false);
    } catch (e: any) {
      setLoginErr(e?.message ?? 'Invalid credentials. Please try again.');
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
    } catch (e: any) {
      setLoginErr(e?.message ?? 'Forced login failed. Please try again.');
      setLoginBusy(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  const lectureState = info ? getLectureState(info) : 'upcoming';

  const leftBg =
    lectureState === 'live'     ? 'from-red-600 via-red-700 to-orange-700' :
    lectureState === 'upcoming' ? 'from-[#0f172a] via-[#1e3a5f] to-[#1d4ed8]' :
                                  'from-slate-600 via-slate-700 to-slate-800';

  // ── Full-screen states (loading / error) ──────────────────────────────────
  if (isLoading || (phase === 'loading' && !info)) {
    return <AppLoadingScreen message="Loading lecture..." />;
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Link Not Found</h1>
          <p className="text-slate-500 text-sm">{errMsg}</p>
        </div>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 lg:p-8"
      style={{ background: info?.bgUrl ? `url(${getImageUrl(info.bgUrl)})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {!info?.bgUrl && (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 -z-10" />
      )}
      {info?.bgUrl && <div className="fixed inset-0 bg-black/55 -z-10" />}

      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:h-[650px] border border-white/60">

        {/* ── Left panel — lecture info ─────────────────────────────────── */}
        <div className={`relative flex flex-col overflow-hidden bg-gradient-to-br ${leftBg}`}>
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4 pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-10">
            <div>
              {/* Status badge */}
              <div className="mb-5">
                {lectureState === 'live' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/30 text-white text-sm font-bold">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                    </span>
                    LIVE NOW
                  </span>
                )}
                {lectureState === 'upcoming' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/30 text-white text-sm font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-300" />
                    Upcoming
                  </span>
                )}
                {lectureState === 'ended' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/30 text-white text-sm font-semibold">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    Session Ended
                  </span>
                )}
              </div>

              {/* Thumbnail — cardImageUrl preferred, bgUrl as preview fallback */}
              {(info?.cardImageUrl || info?.bgUrl) && (
                <div className="mb-5 rounded-2xl overflow-hidden ring-2 ring-white/20 shadow-lg">
                  <img 
                    src={getImageUrl(info.cardImageUrl || info.bgUrl || '')} 
                    alt={info?.title} 
                    className="w-full h-40 sm:h-48 object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight mb-2">
                {info?.title ?? '—'}
              </h1>

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

              {/* Access level badge */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white border border-white/20">
                {info?.accessLevel === 'ANYONE' && '🌐 Public'}
                {info?.accessLevel === 'SURAKSHA_USERS' && '👤 Suraksha Users'}
                {info?.accessLevel === 'ENROLLED_ONLY' && '🎓 Enrolled Students'}
                {info?.accessLevel === 'PAID_ONLY' && '💳 Paid Students'}
              </span>
            </div>

            {/* Time info */}
            {info?.startTime && (
              <div className="mt-6">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/10 border border-white/15">
                  <svg className="w-5 h-5 text-white/70 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Scheduled Time</p>
                    <p className="text-white text-sm font-semibold">{formatTime(info.startTime)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel — join flow ───────────────────────────────────── */}
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

            {/* ── Ended ── */}
            {phase === 'ended' && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-1">Session Ended</h2>
                  <p className="text-slate-500 text-sm">This lecture has concluded.</p>
                </div>
                {info?.recAttendanceEnabled && info?.recUrlId ? (
                  <button
                    type="button"
                    onClick={() => setRecDialog(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/20"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Watch Recording
                  </button>
                ) : (
                  <p className="text-slate-400 text-xs">Check your class for a recording.</p>
                )}
              </div>
            )}

            {/* ── Joining spinner ── */}
            {phase === 'joining' && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center">
                  <svg className="w-7 h-7 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-700">Recording attendance…</p>
              </div>
            )}

            {/* ── Joined ── */}
            {phase === 'joined' && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-5">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">You're in!</h2>
                  <p className="text-slate-500 text-sm">
                    {info?.meetingLink
                      ? "The meeting is opening now. Tap below if it didn't open automatically."
                      : 'Your attendance has been recorded.'}
                  </p>
                </div>
                {info?.meetingLink && (
                  <a href={info.meetingLink} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-xs sm:text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/25">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open Meeting
                  </a>
                )}
                {attendanceId && (
                  <button onClick={() => { leaveRef.current?.(); leaveRef.current = null; }}
                    className="text-xs text-slate-400 hover:text-slate-600 transition underline">
                    Leave lecture
                  </button>
                )}
              </div>
            )}

            {/* ── No access (logged in, but not enrolled / not paid) ── */}
            {phase === 'no-access' && info && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-1">Access Denied</h2>
                  <p className="text-slate-500 text-sm">You're logged in but don't have access to this lecture.</p>
                </div>

                {/* Who you are */}
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-base shrink-0">
                    {user?.imageUrl
                      ? <img src={getImageUrl(user.imageUrl)} alt="" className="w-full h-full object-cover rounded-full" />
                      : (user?.nameWithInitials?.[0] || user?.name?.[0] || 'U').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate text-sm">{user?.nameWithInitials || user?.name || user?.email}</p>
                    <p className="text-xs text-slate-500">Currently signed in</p>
                  </div>
                </div>

                {info.requirePayment ? (
                  <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-center space-y-2">
                    <svg className="w-8 h-8 text-rose-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-bold text-rose-800 text-sm">Payment required</p>
                    <p className="text-rose-700 text-xs">Please complete the required payment to access this lecture.</p>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 text-center space-y-2">
                    <svg className="w-8 h-8 text-amber-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="font-bold text-amber-800 text-sm">Not enrolled in this class</p>
                    <p className="text-amber-700 text-xs">Contact your institute to get enrolled.</p>
                  </div>
                )}

                <button onClick={() => { setUseOtherAccount(true); setPhase('needs-auth'); }}
                  className="w-full py-2.5 rounded-2xl border-2 border-slate-200 text-slate-500 font-medium text-sm hover:bg-slate-50 transition">
                  Try a different account
                </button>
              </div>
            )}

            {/* ── Needs auth — ANYONE: guest / login tabs ── */}
            {phase === 'needs-auth' && info?.accessLevel === 'ANYONE' && !useOtherAccount && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-1">Join Lecture</h2>
                  <p className="text-slate-500 text-sm">This lecture is open to everyone.</p>
                </div>

                {/* Tab switcher */}
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

                {/* ── Branding header — centered logo, switches per tab ── */}
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
                  <form className="space-y-3" onSubmit={e => { e.preventDefault(); doJoin(true); }}>
                    {joinErr && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{joinErr}</p>}
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
                    <button type="submit"
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                      Join as Guest
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
                        To join on this device, we need to sign out your oldest active session:
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
                          'Sign Out Oldest Device & Join'
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
                  <LoginForm
                    identifier={identifier} setIdentifier={setIdentifier}
                    password={password} setPassword={setPassword}
                    showPw={showPw} setShowPw={setShowPw}
                    busy={loginBusy} error={loginErr}
                    onSubmit={handleLogin}
                    joinMode={joinMode}
                  />
                )}
              </div>
            )}

            {/* ── Needs auth — requires login (SURAKSHA_USERS / ENROLLED_ONLY / PAID_ONLY) ── */}
            {phase === 'needs-auth' && info?.accessLevel !== 'ANYONE' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-1">Sign in to Join</h2>
                  <p className="text-slate-500 text-sm">
                    {info?.accessLevel === 'PAID_ONLY'
                      ? 'This lecture is available to paid students. Sign in to verify your access.'
                      : info?.accessLevel === 'ENROLLED_ONLY'
                      ? 'This lecture is for enrolled students. Sign in with your Suraksha LMS account.'
                      : 'Sign in to your Suraksha LMS account to join.'}
                  </p>
                </div>

                {/* ── Branding header — centered logo, switches per tab ── */}
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

                {/* If already logged in as someone, show "Is this you?" first */}
                {user && !useOtherAccount ? (
                  <ConfirmIdentity
                    user={user}
                    onConfirm={() => startJoin(false)}
                    onSwitch={() => { setUseOtherAccount(true); setJoinMode('institute'); }}
                    busy={false}
                    error={joinErr}
                  />
                ) : (
                  <LoginForm
                    identifier={identifier} setIdentifier={setIdentifier}
                    password={password} setPassword={setPassword}
                    showPw={showPw} setShowPw={setShowPw}
                    busy={loginBusy} error={loginErr}
                    onSubmit={handleLogin}
                    joinMode={joinMode}
                  />
                )}
              </div>
            )}

            {/* ── Ready to join (has access) ── */}
            {phase === 'ready' && info && (
              <div className="space-y-5">
                {/* Access granted banner */}
                {user && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-800 text-sm">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Access verified — you're good to join.</span>
                  </div>
                )}

                {joinErr && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{joinErr}</p>}

                {/* Logged-in user confirm or guest form */}
                {user && !useOtherAccount ? (
                  <ConfirmIdentity
                    user={user}
                    onConfirm={() => startJoin(false)}
                    onSwitch={() => { setUseOtherAccount(true); setJoinMode('institute'); }}
                    busy={false}
                    error=""
                  />
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
                      <form className="space-y-3" onSubmit={e => { e.preventDefault(); startJoin(true); }}>
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
                        <button type="submit"
                          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                          Join Lecture
                        </button>
                      </form>
                    ) : (
                      <LoginForm
                        identifier={identifier} setIdentifier={setIdentifier}
                        password={password} setPassword={setPassword}
                        showPw={showPw} setShowPw={setShowPw}
                        busy={loginBusy} error={loginErr}
                        onSubmit={handleLogin}
                        joinMode={joinMode}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Welcome ── */}
            {phase === 'welcome' && info && (
              <div className="relative h-full flex flex-col justify-center gap-6 rounded-3xl p-6 lg:p-8 bg-gradient-to-br from-white via-slate-50 to-sky-50 border border-slate-200 overflow-hidden">
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
                      onClick={() => syncTab('login')}
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

      {info?.recAttendanceEnabled && info?.recUrlId && (
        <TrackingViewDialog
          open={recDialog}
          onOpenChange={setRecDialog}
          mode="recording"
          urlId={info.recUrlId}
          title={info.title}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ConfirmIdentity({
  user, onConfirm, onSwitch, busy, error,
}: {
  user: any;
  onConfirm: () => void;
  onSwitch: () => void;
  busy: boolean;
  error: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Is this you?</h2>
        <p className="text-slate-500 text-sm">Confirm your profile to mark attendance and join.</p>
      </div>

      <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50 border-2 border-blue-200">
        {user.imageUrl ? (
          <img src={user.imageUrl} alt="" className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-blue-200" />
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
        {busy ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        Yes, that's me — Join Lecture
      </button>

      <button onClick={onSwitch}
        className="w-full py-2.5 rounded-2xl border-2 border-slate-200 text-slate-500 font-medium text-sm hover:bg-slate-50 transition">
        Not me — use a different account
      </button>
    </div>
  );
}

function LoginForm({
  identifier, setIdentifier, password, setPassword,
  showPw, setShowPw, busy, error, onSubmit, joinMode
}: {
  identifier: string; setIdentifier: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  showPw: boolean; setShowPw: (v: boolean) => void;
  busy: boolean; error: string;
  onSubmit: (e: React.FormEvent) => void;
  joinMode?: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {joinMode === 'institute' ? 'Institute User ID' : 'Email or Phone'}
        </label>
        <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
          required autoComplete="username"
          placeholder={joinMode === 'institute' ? 'e.g. STU2024001' : 'you@example.com'}
          className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {joinMode === 'institute' ? 'Institute Password' : 'Password'}
        </label>
        <div className="relative">
          <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            required autoComplete="current-password" placeholder="••••••••"
            className="w-full px-4 py-3.5 pr-12 rounded-xl border-2 border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition" />
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
            {showPw ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <button type="submit" disabled={busy}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2.5 disabled:opacity-60">
        {busy ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
        )}
        {busy ? 'Signing in…' : 'Sign in & Join'}
      </button>
    </form>
  );
}
