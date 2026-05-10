import { useEffect, useState, useCallback } from 'react';

declare global {
  interface Window { __GT_READY?: boolean; }
}

export const LANGS = [
  { code: 'en', label: 'EN',  nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'si', label: 'සිං', nativeLabel: 'සිංහල',    flag: '🇱🇰' },
  { code: 'ta', label: 'தமி', nativeLabel: 'தமிழ்',    flag: '🇱🇰' },
] as const;

export type LangCode = typeof LANGS[number]['code'];

const STORAGE_KEY = 'preferred_lang';

export function getSavedLang(): LangCode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'si' || v === 'ta') return v;
  } catch {}
  return 'en';
}

function detectCurrentLang(): LangCode {
  const htmlLang = document.documentElement.lang?.toLowerCase();
  if (htmlLang === 'si') return 'si';
  if (htmlLang === 'ta') return 'ta';
  try {
    const m = document.cookie.match(/googtrans=\/en\/([a-z]+)/);
    if (m?.[1] === 'si' || m?.[1] === 'ta') return m[1] as LangCode;
  } catch {}
  return 'en';
}

function getCombo(): HTMLSelectElement | null {
  return document.querySelector('select.goog-te-combo') as HTMLSelectElement | null;
}

function doTranslate(langCode: LangCode): boolean {
  const combo = getCombo();
  if (!combo) return false;

  if (langCode === 'en') {
    const closeBtn = document.querySelector('.goog-te-banner-frame')
      ?.querySelector?.('.goog-close-link') as HTMLElement | null;
    if (closeBtn) { closeBtn.click(); return true; }
    combo.value = '';
    combo.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => {
      if (detectCurrentLang() !== 'en') {
        clearGTCookies();
        window.location.reload();
      }
    }, 300);
    return true;
  }

  combo.value = langCode;
  combo.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function clearGTCookies() {
  const host = window.location.hostname;
  const exp = 'expires=Thu, 01 Jan 1970 00:00:00 UTC';
  document.cookie = `googtrans=;${exp};path=/`;
  document.cookie = `googtrans=;${exp};path=/;domain=${host}`;
  document.cookie = `googtrans=;${exp};path=/;domain=.${host}`;
}

function setGTCookies(langCode: LangCode) {
  const host = window.location.hostname;
  const val = `/en/${langCode}`;
  document.cookie = `googtrans=${val};path=/`;
  document.cookie = `googtrans=${val};path=/;domain=${host}`;
  document.cookie = `googtrans=${val};path=/;domain=.${host}`;
}

/** Hook that manages GT readiness + auto-applies saved language on load */
export function useGoogleTranslate() {
  const [activeLang, setActiveLang] = useState<LangCode>(getSavedLang);
  const [gtReady, setGtReady] = useState(!!window.__GT_READY);

  useEffect(() => {
    if (gtReady) return;
    const onReady = () => setGtReady(true);
    window.addEventListener('gt-ready', onReady);
    const interval = setInterval(() => {
      if (window.__GT_READY || getCombo()) {
        setGtReady(true);
        clearInterval(interval);
      }
    }, 800);
    return () => { window.removeEventListener('gt-ready', onReady); clearInterval(interval); };
  }, [gtReady]);

  // Auto-apply saved language once GT is ready
  useEffect(() => {
    if (!gtReady) return;
    const saved = getSavedLang();
    if (saved !== 'en') {
      const timer = setTimeout(() => doTranslate(saved), 1000);
      return () => clearTimeout(timer);
    }
  }, [gtReady]);

  const switchLanguage = useCallback((code: LangCode) => {
    setActiveLang(code);
    localStorage.setItem(STORAGE_KEY, code);

    if (code === 'en') {
      clearGTCookies();
      if (!doTranslate('en')) window.location.reload();
      return;
    }

    setGTCookies(code);
    if (gtReady && doTranslate(code)) return;
    window.location.reload();
  }, [gtReady]);

  return { activeLang, gtReady, switchLanguage };
}

/**
 * Invisible component that just initializes GT on mount (auto-applies saved language).
 * Renders nothing — used in App.tsx to ensure GT works on every page.
 */
const GoogleTranslateInit = () => {
  useGoogleTranslate();
  return null;
};

export default GoogleTranslateInit;
