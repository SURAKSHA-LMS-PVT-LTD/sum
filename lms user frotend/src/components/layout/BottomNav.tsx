import React, { useCallback, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Bell, User, LayoutGrid, Menu as MenuIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getImageUrl } from '@/utils/imageUrlHelper';
import ServicesDrawer from './ServicesDrawer';
import ProfileSwitcherSheet from './ProfileSwitcherSheet';

interface BottomNavProps {
  onMenuClick: () => void;
  hidden?: boolean;
}

const BottomNav = ({ onMenuClick, hidden = false }: BottomNavProps) => {
  const { user, selectedInstitute, selectedClass, selectedSubject, selectedChild, isViewingAsParent, selectedOrganization, selectedTransport } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [servicesOpen, setServicesOpen] = useState(false);
  const [profileSwitcherOpen, setProfileSwitcherOpen] = useState(false);
  const { globalUnreadCount: unreadCount } = useNotificationStore();

  // Hide bottom nav when virtual keyboard is open
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const threshold = window.innerHeight * 0.75;
    const onResize = () => setKeyboardOpen(vv.height < threshold);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const isActive = useCallback((path: string) => {
    if (path === '/dashboard' || path === '/select-institute') {
      return location.pathname === '/dashboard' || location.pathname === '/select-institute' || location.pathname === '/';
    }
    return location.pathname.includes(path);
  }, [location.pathname]);

  const handleHomeClick = useCallback(() => {
    if (selectedInstitute?.id) {
      navigate(`/institute/${selectedInstitute.id}/dashboard`);
    } else {
      navigate('/dashboard');
    }
  }, [selectedInstitute?.id, navigate]);

  const handleProfileClick = useCallback(() => {
    setProfileSwitcherOpen(true);
  }, []);

  const handleNotificationsClick = useCallback(() => {
    navigate('/all-notifications');
  }, [navigate]);

  const isHomePath = isActive('/dashboard') || (selectedInstitute && isActive(`/institute/${selectedInstitute.id}/dashboard`));
  const isNotifPath = location.pathname === '/all-notifications' || location.pathname.endsWith('/notifications');
  const isProfilePath = location.pathname === '/profile' || location.pathname.endsWith('/profile');

  return (
    <>
      <nav
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 pb-safe-bottom transition-transform duration-300 bg-background",
          (keyboardOpen || hidden) && "translate-y-full"
        )}
      >
        <div className="flex items-center justify-around h-16 relative">
            {/* Home */}
            <button
              onClick={handleHomeClick}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                isHomePath ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Home className="h-5 w-5" />
              <span className="text-[10px] font-medium">Home</span>
            </button>

            {/* Notifications */}
            <button
              onClick={handleNotificationsClick}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors relative",
                isNotifPath ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">Alerts</span>
            </button>

            {/* Center Services Button - Elevated */}
            <div className="flex flex-col items-center justify-center flex-1 h-full">
              <button
                onClick={() => setServicesOpen(true)}
                className="relative -mt-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform"
              >
                <LayoutGrid className="h-6 w-6" />
              </button>
              <span className="text-[10px] font-medium text-muted-foreground -mt-0.5">Services</span>
            </div>

            {/* Profile / Account Switcher */}
            <button
              onClick={handleProfileClick}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                isProfilePath ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Avatar className={cn("h-6 w-6 border", isProfilePath ? "border-primary" : "border-border/60")}>
                  {/* Show active child image if viewing as parent, else own image */}
                  {isViewingAsParent && selectedChild?.imageUrl ? (
                    <AvatarImage src={getImageUrl(selectedChild.imageUrl)} alt={selectedChild.name || 'Child'} className="object-cover" />
                  ) : user?.imageUrl ? (
                    <AvatarImage src={getImageUrl(user.imageUrl)} alt={user.name} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="text-[9px] bg-muted">
                    <User className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                {/* Orange dot indicator when viewing a child profile */}
                {isViewingAsParent && selectedChild && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 border border-background" />
                )}
              </div>
              <span className="text-[10px] font-medium">
                {isViewingAsParent && selectedChild ? 'Child' : 'Profile'}
              </span>
            </button>

            {/* Menu (Sidebar) */}
            <button
              onClick={onMenuClick}
              className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-muted-foreground transition-colors"
            >
              <MenuIcon className="h-5 w-5" />
              <span className="text-[10px] font-medium">Menu</span>
            </button>
          </div>
        </nav>

      <ServicesDrawer open={servicesOpen} onOpenChange={setServicesOpen} />
      <ProfileSwitcherSheet open={profileSwitcherOpen} onOpenChange={setProfileSwitcherOpen} />
    </>
  );
};

export default BottomNav;

