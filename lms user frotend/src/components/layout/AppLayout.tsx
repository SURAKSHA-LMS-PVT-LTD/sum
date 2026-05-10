import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import AppLoadingScreen from '@/components/AppLoadingScreen';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onPageChange?: (page: string) => void;
}

const SCROLL_HIDE_THRESHOLD = 10; // px scrolled down before hiding

const AppLayout = ({ children, currentPage: propCurrentPage, onPageChange }: AppLayoutProps) => {
  const { user, isInitialized } = useAuth();
  const { navigateToPage, getPageFromPath } = useAppNavigation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = React.useRef(0);
  const mainRef = React.useRef<HTMLElement>(null);

  // Scroll-direction detection: hide nav on scroll-down, show on scroll-up
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => {
      const current = el.scrollTop;
      const delta = current - lastScrollY.current;
      if (delta > SCROLL_HIDE_THRESHOLD) {
        setNavHidden(true);
      } else if (delta < -SCROLL_HIDE_THRESHOLD) {
        setNavHidden(false);
      }
      lastScrollY.current = current;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Detect keyboard open/close via visualViewport resize.
  // When the soft keyboard opens, the visual viewport height shrinks significantly.
  // We hide the fixed BottomNav so it doesn't block focused inputs.
  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;
    const handleResize = () => {
      setKeyboardVisible(vp.height < window.outerHeight * 0.75);
    };
    vp.addEventListener('resize', handleResize);
    return () => vp.removeEventListener('resize', handleResize);
  }, [])

  // Scroll focused input/textarea into view after keyboard animation completes.
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 350);
      }
    };
    document.addEventListener('focusin', handleFocus, true);
    return () => document.removeEventListener('focusin', handleFocus, true);
  }, []);

  // Determine current page based on URL if not provided
  const getCurrentPage = () => {
    if (propCurrentPage) return propCurrentPage;
    
    const path = window.location.pathname;
    if (path.startsWith('/payments')) return 'system-payment';
    return 'dashboard';
  };

  const currentPage = getCurrentPage();

  const handleMenuClick = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false);
  };

  const handlePageChange = (page: string) => {
    if (onPageChange) {
      onPageChange(page);
    } else if (page === 'system-payment') {
      navigateToPage('payments');
    } else {
      navigateToPage(page);
    }
    setIsSidebarOpen(false);
  };

  // Show loading screen while auth is still initializing OR user state is not yet set.
  // Without this guard AppLayout would show an infinite loading screen after init
  // when the user is not logged in (it doesn't redirect — AppContent handles that).
  if (!isInitialized || !user) {
    return <AppLoadingScreen message="Loading your workspace..." />;
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <div className="flex-shrink-0">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={handleSidebarClose}
        />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <div className="flex-shrink-0">
          <Header onMenuClick={handleMenuClick} />
        </div>
        <main ref={mainRef} className="flex-1 overflow-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0 min-h-0">
          {children}
        </main>
        {!keyboardVisible && <BottomNav onMenuClick={handleMenuClick} hidden={navHidden} />}
      </div>
    </div>
  );
};

export default AppLayout;
