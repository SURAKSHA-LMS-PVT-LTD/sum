import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type ModalName = 'video' | 'student' | 'homework' | 'paymentSubmissions' | 'verifySubmission';

export type ModalParams = Record<string, string | number | undefined | null>;

export interface ActiveModal {
  name: ModalName;
  params: Record<string, string>;
}

/**
 * 🔒 SECURITY: Parse modal state from URL
 * Never includes sensitive data like full URLs or tokens
 */
export const parseModalFromSearch = (search: string): ActiveModal | null => {
  const sp = new URLSearchParams(search);
  const name = sp.get('modal') as ModalName | null;
  if (!name) return null;

  const params: Record<string, string> = {};
  sp.forEach((value, key) => {
    if (key !== 'modal') params[key] = value;
  });
  return { name, params };
};

/**
 * 🔒 SECURE Modal Routing Hook
 * - Never exposes sensitive URLs in browser address bar
 * - Uses resource IDs only (lectureId, videoId, etc.)
 * - Actual URLs fetched server-side when needed
 */
export const useModalRouting = () => {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Open modal with sanitized parameters
   * 🔒 SECURITY: Filters out sensitive data like 'url', 'token', 'secret'
   */
  const openModal = useCallback((name: ModalName, params?: ModalParams, options?: { replace?: boolean }) => {
    const sp = new URLSearchParams(location.search);
    sp.set('modal', name);
    
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        
        // 🔒 SECURITY: Never expose sensitive data in URL
        const sensitiveKeys = ['url', 'token', 'secret', 'key', 'password', 'apiKey'];
        if (sensitiveKeys.some(key => k.toLowerCase().includes(key))) {
          console.warn(`🔒 SECURITY: Blocked sensitive parameter '${k}' from URL`);
          return;
        }
        
        sp.set(k, String(v));
      });
    }
    
    navigate(`${location.pathname}?${sp.toString()}`, { replace: options?.replace ?? false });
  }, [location.pathname, location.search, navigate]);

  const closeModal = useCallback((options?: { replace?: boolean }) => {
    const sp = new URLSearchParams(location.search);
    const modal = sp.get('modal') as ModalName | null;
    if (!modal) return;
    
    // Remove modal and all modal-related params
    sp.delete('modal');
    ['videoRef','studentId','homeworkId','paymentId','paymentTitle','submissionId','lectureId'].forEach(k => sp.delete(k));
    
    const qs = sp.toString();
    navigate(qs ? `${location.pathname}?${qs}` : location.pathname, { replace: options?.replace ?? true });
  }, [location.pathname, location.search, navigate]);

  const active = parseModalFromSearch(location.search);

  return { active, openModal, closeModal };
};
