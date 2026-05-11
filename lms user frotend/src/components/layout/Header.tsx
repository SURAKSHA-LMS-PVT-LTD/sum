
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { User, Bell, ChevronDown, ChevronLeft, Search } from 'lucide-react';
import GlobalSearch from '@/components/GlobalSearch';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useNotificationStore, refreshContextCount } from '@/stores/useNotificationStore';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import ProfileSwitcherSheet from './ProfileSwitcherSheet';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const { 
    user, logout, 
    selectedInstitute, setSelectedInstitute, loadUserInstitutes,
    selectedClass, setSelectedClass, selectedSubject, setSelectedSubject,
    selectedChild, selectedOrganization, selectedTransport,
    currentInstituteId, isViewingAsParent
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const effectiveRole = useInstituteRole();
  const { contextUnreadCount: unreadCount, initUnreadCount } = useNotificationStore();
  const { isTenantLogin } = useTenant();
  const [instituteDrawerOpen, setInstituteDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileSwitcherOpen, setProfileSwitcherOpen] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  
  // Institute switcher state
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [institutesLoaded, setInstitutesLoaded] = useState(false);
  
  // Map backend instituteUserType to display role
  const mapInstituteRoleToDisplayRole = (raw?: string) => {
    switch (raw) {
      case 'INSTITUTE_ADMIN': return 'InstituteAdmin';
      case 'STUDENT': return 'Student';
      case 'TEACHER': return 'Teacher';
      case 'ATTENDANCE_MARKER': return 'AttendanceMarker';
      case 'PARENT': return 'Parent';
      case 'ORGANIZATION_MANAGER': return 'OrganizationManager';
      default: return undefined;
    }
  };

  const displayRole = selectedInstitute?.userRole 
    ? mapInstituteRoleToDisplayRole(selectedInstitute.userRole) || mapInstituteRoleToDisplayRole(selectedInstitute.instituteUserType)
    : user?.role;

  const [instituteAvatarUrl, setInstituteAvatarUrl] = useState<string>('');

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!selectedInstitute?.id) { setInstituteAvatarUrl(''); return; }
        const resp = await enhancedCachedClient.get<any>(
          `/institute-users/institute/${selectedInstitute.id}/me`,
          {},
          { ttl: 300, forceRefresh: false, userId: selectedInstitute.id }
        );
        if (!cancelled) setInstituteAvatarUrl(resp?.instituteUserImageUrl || '');
      } catch (err: any) {
        if (cancelled) return;
        console.warn('Failed to load institute avatar:', err?.message);
        if (!err?.message?.includes('Too many requests')) setInstituteAvatarUrl('');
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedInstitute?.id]);

  // Init unread count ONCE on mount
  React.useEffect(() => {
    initUnreadCount();
  }, [initUnreadCount]);

  // Refresh context-specific unread count when selection changes
  React.useEffect(() => {
    refreshContextCount(selectedInstitute?.id);
  }, [selectedInstitute?.id]);

  // Load institutes for switcher
  const loadInstitutes = async () => {
    if (institutesLoaded) return;
    try {
      const data = await loadUserInstitutes();
      setInstitutes(data);
      setInstitutesLoaded(true);
    } catch { /* silent */ }
  };

  const handleSwitchInstitute = (inst: any) => {
    setSelectedInstitute(inst);
    setSelectedClass(null);
    setSelectedSubject(null);
    
    // Keep existing cache intact — components will load new data
    // based on the updated instituteId from context. No need to
    // clear cache; if the new institute's data is already cached
    // it will be served instantly, otherwise fetched fresh.
    
    // Dispatch event so any listening components know to re-fetch
    window.dispatchEvent(new CustomEvent('institute:switched', { detail: { instituteId: inst.id } }));
    
    const path = location.pathname;
    const match = path.match(/^\/institute\/[^/]+\/(.*)$/);
    if (match) {
      navigate(`/institute/${inst.id}/${match[1]}`);
    } else {
      navigate(`/institute/${inst.id}/dashboard`);
    }
  };

  const handleLogout = () => { logout(); };

  const avatarImageUrl = isViewingAsParent && selectedChild?.user?.imageUrl
    ? getImageUrl(selectedChild.user.imageUrl)
    : (instituteAvatarUrl
      ? getImageUrl(instituteAvatarUrl)
      : (user?.imageUrl ? getImageUrl(user.imageUrl) : ''));

  const isParentWithChild = isViewingAsParent && !!selectedChild;

  // Disable switcher if it's a tenant login (locked to one institute)
  const isSwitcherDisabled = isTenantLogin;

  return (
    <header className="bg-background/95 backdrop-blur-md border-b border-border/50 px-2 sm:px-4 py-2 sm:py-2.5 sticky top-0 z-40 pt-safe-top">
      <div className="flex items-center justify-between h-12 sm:h-14">
        {/* Left Section: Profile (Desktop) / Menu (Mobile) / Switcher */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Mobile Back Button (Hidden on /dashboard or tenant-locked dashboards) */}
          {location.pathname !== '/' && location.pathname !== '/dashboard' && !location.pathname.endsWith('/dashboard') && !isTenantLogin && (
            <button
              onClick={() => window.history.back()}
              className="p-1.5 -ml-1 rounded-xl hover:bg-muted/60 active:scale-95 transition-all shrink-0 lg:hidden"
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
          )}

          {isParentWithChild ? (
            <button
              onClick={() => navigate('/my-children')}
              className="flex items-center gap-2 focus:outline-none hover:bg-muted/50 active:scale-[0.97] rounded-xl px-1.5 py-1.5 transition-all min-w-0"
            >
              <Avatar className="h-9 w-9 shrink-0 border border-border">
                {selectedChild?.user?.imageUrl ? (
                  <AvatarImage
                    src={getImageUrl(selectedChild.user.imageUrl)}
                    alt={selectedChild.user.nameWithInitials || selectedChild.user.firstName || 'Child'}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {(selectedChild?.user?.nameWithInitials || selectedChild?.user?.firstName || '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start min-w-0">
                <h1 className="text-base sm:text-lg font-semibold text-foreground truncate leading-tight max-w-[180px]">
                  {selectedChild?.user?.nameWithInitials ||
                    `${selectedChild?.user?.firstName || ''} ${selectedChild?.user?.lastName || ''}`.trim() ||
                    'Child'}
                </h1>
                <span className="text-xs sm:text-sm text-muted-foreground leading-tight">Child Mode</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-0.5" />
            </button>
          ) : (
            <div className="flex items-center gap-2 px-1.5 py-1.5 min-w-0">
              <div className="flex flex-col items-start min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                  {`${greeting}, ${user?.name || user?.nameWithInitials || 'User'}!`}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground leading-tight">
                  {selectedClass?.grade ? `Grade ${selectedClass.grade}` : (selectedInstitute?.shortName || selectedInstitute?.name || displayRole || 'SurakshaLMS')}
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {/* Global Search */}
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2.5 rounded-xl hover:bg-muted/60 active:scale-95 transition-all"
            aria-label="Search"
          >
            <Search className="h-5 w-5 text-foreground" />
          </button>
          {/* Notification Bell */}
          <button
            onClick={() => {
              if (selectedInstitute?.id) {
                const context = {
                  instituteId: selectedInstitute.id,
                  classId: selectedClass?.id,
                  subjectId: selectedSubject?.id,
                  childId: selectedChild?.id,
                  organizationId: selectedOrganization?.id,
                  transportId: selectedTransport?.id,
                };
                navigate(buildSidebarUrl('institute-notifications', context));
              } else {
                navigate('/all-notifications');
              }
            }}
            className="relative p-2.5 rounded-xl hover:bg-muted/60 active:scale-95 transition-all"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          
          {/* Desktop Profile (icons + avatar only) */}
          <div className="hidden lg:flex items-center gap-3 ml-3 pl-3 border-l border-border/50">
            <button
              onClick={() => setProfileSwitcherOpen(true)}
              className="focus:outline-none rounded-full active:scale-95 transition-transform shrink-0 relative"
              aria-label="Switch profile"
            >
              <Avatar className="h-12 w-12 border-2 border-border shadow-sm cursor-pointer hover:border-primary/50 transition-colors">
                {avatarImageUrl && (
                  <AvatarImage 
                    src={avatarImageUrl}
                    alt={user?.name}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              {isViewingAsParent && selectedChild && (
                <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-orange-500 border-2 border-background shadow-sm" />
              )}
            </button>
          </div>

          {/* Profile / Account Switcher Avatar (Mobile only) */}
          <div className="relative lg:hidden">
            <button
              onClick={() => setProfileSwitcherOpen(true)}
              className="focus:outline-none rounded-full active:scale-95 transition-transform relative"
              aria-label="Switch profile"
            >
              <Avatar className="h-10 w-10 border border-border cursor-pointer">
                {avatarImageUrl && (
                  <AvatarImage 
                    src={avatarImageUrl}
                    alt={user?.name}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              {/* Orange dot when viewing a child profile */}
              {isViewingAsParent && selectedChild && (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-orange-500 border-2 border-background" />
              )}
            </button>
          </div>
          <ProfileSwitcherSheet open={profileSwitcherOpen} onOpenChange={setProfileSwitcherOpen} />
        </div>
      </div>
    </header>
  );
};

export default Header;
