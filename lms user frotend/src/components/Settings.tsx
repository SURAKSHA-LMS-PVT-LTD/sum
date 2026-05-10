import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { CustomToggle } from '@/components/ui/custom-toggle';
import { useIsMobile } from '@/hooks/use-mobile';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

import {
  Sun,
  Moon,
  Monitor,
  LayoutGrid,
  Table2,
  Palette,
  ChevronRight,
  Info,
  Smartphone,
  Globe,
  Languages,
  Package,
  Calendar,
  Hash,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { useGoogleTranslate, LANGS, type LangCode } from '@/components/LanguageSwitcher';
import {
  checkForUpdateOnce,
  forceRefreshToLatestBuild,
  ManualCheckResult,
  UpdateInfo,
} from '@/utils/versionChecker';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// ─── Version constants injected at build time by Vite ───────────────────────
const WEB_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.1';
const BUILD_DATE: string =
  typeof __APP_BUILD_DATE__ !== 'undefined'
    ? __APP_BUILD_DATE__
    : new Date().toISOString();

const settingsTabs = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'language',   label: 'Language',   icon: Languages },
  { id: 'about',      label: 'About',      icon: Info },
];

const themeOptions = [
  { id: 'light'  as const, label: 'Light',  icon: Sun,     description: 'Clean and bright interface' },
  { id: 'dark'   as const, label: 'Dark',   icon: Moon,    description: 'Easy on the eyes in low light' },
  { id: 'system' as const, label: 'System', icon: Monitor, description: 'Follows your device settings' },
];

const mobileMenuItems = [
  { id: 'appearance', icon: Palette,   label: 'Appearance', description: 'Theme & display preferences', color: 'text-violet-500' },
  { id: 'language',   icon: Languages, label: 'Language',   description: 'Translation & language',      color: 'text-emerald-500' },
  { id: 'about',      icon: Info,      label: 'About',      description: 'Version & app information',   color: 'text-blue-500'   },
];

// ─── About / Version card ────────────────────────────────────────────────────
const AboutContent = () => {
  const [nativeVersion, setNativeVersion] = useState<string | null>(null);
  const [nativeBuild,   setNativeBuild]   = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkState, setCheckState] = useState<
    'idle' | 'checking' | 'up-to-date' | 'offline' | 'updating' | 'major'
  >('idle');
  const [majorUpdateInfo, setMajorUpdateInfo] = useState<UpdateInfo | null>(null);

  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

  const handleManualCheck = async () => {
    setCheckState('checking');
    const result: ManualCheckResult = await checkForUpdateOnce();
    if (result.status === 'up-to-date') {
      setCheckState('up-to-date');
      setTimeout(() => setCheckState('idle'), 3000);
    } else if (result.status === 'offline') {
      setCheckState('offline');
      setTimeout(() => setCheckState('idle'), 3000);
    } else if (result.status === 'patch') {
      setCheckState('updating');
      setTimeout(() => forceRefreshToLatestBuild(), 1500);
    } else {
      // major:
      //   Native app  → show inline Play Store prompt (new APK required)
      //   Web browser → just reload; the new bundle is already on S3
      if (isNative) {
        setMajorUpdateInfo(result.info);
        setCheckState('major');
      } else {
        setCheckState('updating');
        setTimeout(() => forceRefreshToLatestBuild(), 1500);
      }
    }
  };

  useEffect(() => {
    if (!isNative) return;
    App.getInfo()
      .then(info => {
        setNativeVersion(info.version);
        setNativeBuild(info.build);
      })
      .catch(() => { /* old Capacitor / permission denied — ignore */ });
  }, [isNative]);

  // uiVersion  = web bundle version (package.json, injected at build time)
  // appVersion = native APK/IPA shell version (from Google Play / App Store)
  // These are INDEPENDENT — the app wrapper can be v1.0.1 while the web UI is v1.0.3
  const uiVersion  = WEB_VERSION;
  const appVersion = nativeVersion; // null on web

  const platformLabel = platform === 'android' ? 'Android App'
                      : platform === 'ios'     ? 'iOS App'
                      :                          'Web Browser';

  const PlatformIcon = isNative ? Smartphone : Globe;

  const versionsMismatch = isNative && appVersion && appVersion !== uiVersion;
  const versionsInSync   = isNative && appVersion && appVersion === uiVersion;

  const copyVersion = () => {
    const text = isNative
      ? `App: v${appVersion ?? '…'} | UI: v${uiVersion}`
      : `Web UI: v${uiVersion} (built ${BUILD_DATE.slice(0, 10)})`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Detail rows (always include both versions)
  const rows: {
    Icon: React.ComponentType<{ className?: string }>;
    label: string;
    sublabel?: string;
    value: string;
    badge?: string;
    highlight?: boolean;
  }[] = [
    // ── App shell version (native only) ──────────────────────────────────────
    ...(isNative ? [{
      Icon: Smartphone,
      label: 'App Version',
      sublabel: 'Native shell · Google Play / App Store',
      value: appVersion ? `v${appVersion}` : '…',
      badge: nativeBuild ? `Build ${nativeBuild}` : undefined,
      highlight: true,
    }] : []),
    // ── Web UI bundle (always shown) ─────────────────────────────────────────
    {
      Icon: Globe,
      label: 'UI Version',
      sublabel: 'Web bundle · deployed independently',
      value: `v${uiVersion}`,
      badge: undefined,
      highlight: false,
    },
    // ── Platform ─────────────────────────────────────────────────────────────
    {
      Icon: PlatformIcon,
      label: 'Platform',
      sublabel: undefined,
      value: platformLabel,
      badge: platform.toUpperCase(),
      highlight: false,
    },
    // ── UI build date ─────────────────────────────────────────────────────────
    {
      Icon: Calendar,
      label: 'UI Build Date',
      sublabel: undefined,
      value: new Date(BUILD_DATE).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }),
      badge: undefined,
      highlight: false,
    },
    // ── App ID ────────────────────────────────────────────────────────────────
    {
      Icon: Hash,
      label: 'App ID',
      sublabel: undefined,
      value: 'lk.suraksha.lms',
      badge: undefined,
      highlight: false,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Info className="h-5 w-5" />
          <CardTitle>About</CardTitle>
        </div>
        <CardDescription>Application version and build information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ── Version hero: shows BOTH app shell & UI version separately ─── */}
        <div className="p-5 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-primary/10">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Package className="h-7 w-7 text-primary-foreground" />
            </div>

            {/* Versions */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Suraksha LMS
              </p>

              <div className="flex flex-wrap items-end gap-5">
                {/* Native app shell version — only when running on Android / iOS */}
                {isNative && (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                      App
                    </span>
                    <span className="text-2xl font-bold text-foreground leading-none">
                      v{appVersion ?? '…'}
                    </span>
                    {nativeBuild && (
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        build {nativeBuild}
                      </span>
                    )}
                  </div>
                )}

                {/* Divider between the two versions */}
                {isNative && (
                  <div className="text-muted-foreground/30 text-2xl font-extralight pb-0.5">/</div>
                )}

                {/* Web UI version — always shown */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    UI
                  </span>
                  <span className={cn(
                    'font-bold text-foreground leading-none',
                    isNative ? 'text-2xl' : 'text-3xl',
                  )}>
                    v{uiVersion}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    built {BUILD_DATE.slice(0, 10)}
                  </span>
                </div>
              </div>

              {/* Sync status indicator */}
              {versionsMismatch && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1">
                  ⚠️ App shell and UI are on different versions
                </p>
              )}
              {versionsInSync && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-3">
                  ✓ App and UI are in sync
                </p>
              )}
            </div>

            {/* Copy button */}
            <button
              onClick={copyVersion}
              title="Copy version string"
              className="p-2 rounded-lg hover:bg-muted/70 text-muted-foreground transition-colors shrink-0"
            >
              {copied
                ? <Check className="h-4 w-4 text-emerald-500" />
                : <Copy  className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Separator />

        {/* ── Detail rows ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {rows.map(({ Icon, label, sublabel, value, badge, highlight }) => (
            <div
              key={label}
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-xl border',
                highlight
                  ? 'bg-primary/5 border-primary/20'
                  : 'bg-muted/40 border-border/50',
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('p-1.5 rounded-lg', highlight ? 'bg-primary/15' : 'bg-primary/10')}>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-foreground font-medium">{label}</p>
                  {sublabel && (
                    <p className="text-[11px] text-muted-foreground">{sublabel}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {badge && (
                  <Badge variant="outline" className="text-[10px] h-5">{badge}</Badge>
                )}
                <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* ── Manual update check ─────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3">
          {checkState === 'major' && majorUpdateInfo ? (
            <div className="w-full p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 flex flex-col gap-3">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 text-center">
                Version {majorUpdateInfo.newSemver} requires a Play Store update
              </p>
              <a
                href="https://play.google.com/store/apps/details?id=lk.suraksha.lms"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-[#1976D2] hover:bg-[#1565C0] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Open Play Store
              </a>
              <button
                onClick={() => setCheckState('idle')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <button
              onClick={handleManualCheck}
              disabled={checkState === 'checking' || checkState === 'updating'}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-all disabled:opacity-60',
                checkState === 'up-to-date'
                  ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                  : checkState === 'offline'
                  ? 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                  : 'border-border bg-muted/40 hover:bg-muted/70 text-foreground',
              )}
            >
              {checkState === 'checking' || checkState === 'updating' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : checkState === 'up-to-date' ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {checkState === 'idle'        ? 'Check for Updates'       :
               checkState === 'checking'   ? 'Checking…'              :
               checkState === 'up-to-date' ? 'Already up to date'       :
               checkState === 'offline'    ? 'No connection – try again' :
               checkState === 'updating'   ? 'Applying update…'       :
                                             'Check for Updates'}
            </button>
          )}
        </div>

        <Separator />

        <p className="text-xs text-center text-muted-foreground/70">
          © {new Date().getFullYear()} Suraksha LMS · All rights reserved
        </p>

      </CardContent>
    </Card>
  );
};

// ─── Main Settings component ─────────────────────────────────────────────────
const Settings = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('appearance');
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    return (localStorage.getItem('viewMode') as 'card' | 'table') || 'card';
  });
  const isMobile = useIsMobile();
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const { activeLang, gtReady, switchLanguage } = useGoogleTranslate();

  const handleViewModeChange = (mode: 'card' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
    window.dispatchEvent(new CustomEvent('viewModeChange', { detail: mode }));
  };

  const appearanceContent = (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Palette className="h-5 w-5" />
          <CardTitle>Appearance</CardTitle>
        </div>
        <CardDescription>
          Customize how the application looks and choose your preferred display mode
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Theme Selection */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Theme Mode</Label>
            <p className="text-sm text-muted-foreground mt-1">Choose your preferred color scheme</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  className={cn(
                    'relative p-4 rounded-xl border-2 transition-all duration-200 text-left',
                    isActive
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-full transition-colors',
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.description}</div>
                    </div>
                  </div>
                  {isActive && <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* View Mode Selection */}
        <div className="space-y-5">
          <div>
            <Label className="text-base font-medium">Display Mode</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Choose how data is displayed across all pages — Homework, Lectures, Exams, Results,
              Submissions, Attendance &amp; more
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Card View Option */}
            <button
              onClick={() => handleViewModeChange('card')}
              className={cn(
                'relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 text-center group',
                viewMode === 'card'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md'
                  : 'border-border hover:border-primary/40 hover:bg-muted/50',
              )}
            >
              {viewMode === 'card' && (
                <div className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-primary shadow-sm" />
              )}
              <div className={cn(
                'p-4 rounded-2xl transition-colors',
                viewMode === 'card' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground group-hover:bg-primary/10',
              )}>
                <LayoutGrid className="h-8 w-8" />
              </div>
              <div>
                <div className={cn('font-semibold text-base', viewMode === 'card' ? 'text-primary' : 'text-foreground')}>
                  Card View
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Collapsible cards<br />with expand for details
                </div>
              </div>
              {/* Mini preview */}
              <div className="w-full grid grid-cols-2 gap-1 mt-1 opacity-60">
                {[1,2,3,4].map(i => <div key={i} className={cn('h-5 rounded', viewMode === 'card' ? 'bg-primary/20' : 'bg-muted')} />)}
              </div>
            </button>

            {/* Table View Option */}
            <button
              onClick={() => handleViewModeChange('table')}
              className={cn(
                'relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 text-center group',
                viewMode === 'table'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md'
                  : 'border-border hover:border-primary/40 hover:bg-muted/50',
              )}
            >
              {viewMode === 'table' && (
                <div className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-primary shadow-sm" />
              )}
              <div className={cn(
                'p-4 rounded-2xl transition-colors',
                viewMode === 'table' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground group-hover:bg-primary/10',
              )}>
                <Table2 className="h-8 w-8" />
              </div>
              <div>
                <div className={cn('font-semibold text-base', viewMode === 'table' ? 'text-primary' : 'text-foreground')}>
                  Table View
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Structured rows<br />with all columns
                </div>
              </div>
              {/* Mini preview */}
              <div className="w-full space-y-1 mt-1 opacity-60">
                {[1,2,3].map(i => <div key={i} className={cn('h-3 rounded w-full', viewMode === 'table' ? 'bg-primary/20' : 'bg-muted')} />)}
              </div>
            </button>
          </div>
          <div className={cn(
            'flex items-center gap-3 p-4 rounded-xl border',
            viewMode === 'card' ? 'bg-primary/5 border-primary/20' : 'bg-muted/40 border-border/50',
          )}>
            <div className={cn('p-2 rounded-lg', viewMode === 'card' ? 'bg-primary/15' : 'bg-muted')}>
              {viewMode === 'card' ? <LayoutGrid className="h-4 w-4 text-primary" /> : <Table2 className="h-4 w-4 text-primary" />}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{viewMode === 'card' ? 'Card View' : 'Table View'} active</span> — Content displays in {viewMode === 'card' ? 'organized collapsible cards' : 'structured table format'} across all sections.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const languageContent = (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Languages className="h-5 w-5" />
          <CardTitle>Language</CardTitle>
        </div>
        <CardDescription>
          Translate the interface into your preferred language
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warning banner */}
        <div className="flex gap-3 p-4 rounded-xl border border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/30">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Machine Translation Notice
            </p>
            <p className="text-amber-700/90 dark:text-amber-400/80 leading-relaxed">
              Translation is provided by <strong>Google Translate</strong> and is <strong>not</strong> maintained
              by the developers of this application. Translations may be inaccurate, incomplete, or miss
              context — especially for technical terms. For the best experience we recommend using <strong>English</strong>.
            </p>
          </div>
        </div>

        {/* Language options */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Interface Language</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Choose your preferred language for the interface
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LANGS.map((lang) => {
              const isActive = activeLang === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => switchLanguage(lang.code)}
                  className={cn(
                    'notranslate relative p-4 rounded-xl border-2 transition-all duration-200 text-left',
                    isActive
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{lang.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{lang.nativeLabel}</div>
                      <div className="text-xs text-muted-foreground">{lang.label}</div>
                    </div>
                  </div>
                  {isActive && <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
          {!gtReady && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse inline-block" />
              Google Translate is loading…
            </p>
          )}
        </div>

        <Separator />

        {/* Current status */}
        <div className={cn(
          'flex items-center gap-3 p-4 rounded-xl border',
          activeLang !== 'en' ? 'bg-primary/5 border-primary/20' : 'bg-muted/40 border-border/50',
        )}>
          <div className={cn('p-2 rounded-lg', activeLang !== 'en' ? 'bg-primary/15' : 'bg-muted')}>
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground notranslate">
              {LANGS.find(l => l.code === activeLang)?.nativeLabel ?? 'English'}
            </span>
            {activeLang !== 'en'
              ? ' — Translated via Google Translate. Some content may appear in English.'
              : ' — Default language. No translation applied.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) {
    if (mobileSection) {
      const item = mobileMenuItems.find(m => m.id === mobileSection);
      return (
        <div className="px-3 py-4 pb-20 space-y-4">
          <button
            onClick={() => setMobileSection(null)}
            className="flex items-center gap-2 text-sm font-medium text-primary active:opacity-70 transition-opacity"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back to Settings
          </button>
          <h2 className="text-lg font-bold text-foreground">{item?.label}</h2>
          {mobileSection === 'appearance' && appearanceContent}
          {mobileSection === 'language'   && languageContent}
          {mobileSection === 'about'      && <AboutContent />}
        </div>
      );
    }

    return (
      <div className="px-3 py-4 pb-20 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your preferences</p>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {mobileMenuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setMobileSection(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-muted/60 transition-colors ${
                    index < mobileMenuItems.length - 1 ? 'border-b border-border/40' : ''
                  }`}
                >
                  <div className={`p-2 rounded-xl bg-muted/50 ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your preferences and customize your experience
        </p>
      </div>

      <ScrollArea className="w-full">
        <div className="inline-flex items-center rounded-full border border-border bg-muted/40 p-1 gap-0.5">
          {settingsTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {activeTab === 'appearance' && appearanceContent}
      {activeTab === 'language'   && languageContent}
      {activeTab === 'about'      && <AboutContent />}
    </div>
  );
};

export default Settings;
