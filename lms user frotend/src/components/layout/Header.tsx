
import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, User, Bell, ChevronDown, ChevronLeft, School, Search, BookOpen } from 'lucide-react';
import GlobalSearch from '@/components/GlobalSearch';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import surakshaLogo from '@/assets/suraksha-logo.png';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { cachedApiClient } from '@/api/cachedClient';
import SafeImage from '@/components/ui/SafeImage';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useNotificationStore } from '@/stores/useNotificationStore';
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
  const { globalUnreadCount: unreadCount, initUnreadCount } = useNotificationStore();
  const { isTenantLogin } = useTenant();
  const [instituteDrawerOpen, setInstituteDrawerOpen] = useState(false);
  const [classDrawerOpen, setClassDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileSwitcherOpen, setProfileSwitcherOpen] = useState(false);

  // Greeting logic
  const firstName = user?.firstName || user?.name?.split(' ')[0] || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  
  // Institute switcher state
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [institutesLoaded, setInstitutesLoaded] = useState(false);
  
  // Class switcher state
  const [classes, setClasses] = useState<any[]>([]);
  const [classesLoaded, setClassesLoaded] = useState(false);

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


  // Reset classes loaded when institute changes
  React.useEffect(() => {
    setClassesLoaded(false);
    setClasses([]);
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

  // Load classes for class switcher
  const loadClasses = async () => {
    if (classesLoaded || !currentInstituteId || !user?.id) return;
    try {
      let endpoint = '';
      if (effectiveRole === 'Student') {
        endpoint = `/institute-classes/${currentInstituteId}/student/${user.id}`;
      } else if (effectiveRole === 'Teacher') {
        endpoint = `/institute-classes/${currentInstituteId}/teacher/${user.id}`;
      } else {
        endpoint = `/institute-classes/institute/${currentInstituteId}`;
      }
      
      const result = await cachedApiClient.get(endpoint, { page: 1, limit: 50 }, {
        ttl: 60,
        forceRefresh: false,
      });
      
      let classesArray: any[] = [];
      if (Array.isArray(result)) {
        classesArray = result;
      } else if (result?.data && Array.isArray(result.data)) {
        classesArray = result.data;
      }
      
      // Normalize class data
      const normalized = classesArray.map((item: any) => {
        const cls = item.class || item;
        return {
          id: cls.id || item.classId,
          name: cls.name || item.className || '',
          code: cls.code || item.classCode || '',
          specialty: cls.specialty || '',
          grade: cls.grade,
          imageUrl: cls.imageUrl || '',
        };
      });
      
      // Deduplicate
      const unique = Array.from(new Map(normalized.filter(c => c.id).map(c => [c.id, c])).values());
      unique.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      setClasses(unique);
      setClassesLoaded(true);
    } catch (err) {
      console.warn('Failed to load classes for switcher:', err);
    }
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

  const handleSwitchClass = (cls: any) => {
    setSelectedClass({
      id: cls.id,
      name: cls.name,
      code: cls.code,
      description: cls.specialty || cls.name,
      grade: cls.grade || 0,
      specialty: cls.specialty || '',
    });
    setSelectedSubject(null);
    
    const instId = currentInstituteId || selectedInstitute?.id;
    if (instId) {
      // Try to preserve current sub-page
      const path = location.pathname;
      const classPageMatch = path.match(/\/class\/[^/]+\/(?:subject\/[^/]+\/)?(.+)$/);
      const page = classPageMatch?.[1] || 'select-subject';
      navigate(`/institute/${instId}/class/${cls.id}/${page}`);
    }
  };

  const handleLogout = () => { logout(); };

  const avatarImageUrl = isViewingAsParent && selectedChild?.user?.imageUrl
    ? getImageUrl(selectedChild.user.imageUrl)
    : (instituteAvatarUrl
      ? getImageUrl(instituteAvatarUrl)
      : (user?.imageUrl ? getImageUrl(user.imageUrl) : ''));

  // Determine switcher context level
  const showClassSwitcher = !!selectedClass && !!selectedInstitute;
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

          {showClassSwitcher ? (
            <Drawer 
              open={classDrawerOpen} 
              onOpenChange={(open) => { 
                if (isSwitcherDisabled) return;
                setClassDrawerOpen(open); 
                if (open) loadClasses(); 
              }}
              routeName="switch-class-drawer"
            >
              <DrawerTrigger asChild>
                <button 
                  disabled={isSwitcherDisabled}
                  className={cn(
                    "flex items-center gap-2 focus:outline-none rounded-xl px-2 py-1.5 transition-all min-w-0",
                    !isSwitcherDisabled ? "hover:bg-muted/50 active:scale-[0.97]" : "cursor-default"
                  )}
                >
                  <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {selectedSubject ? (
                      <BookOpen className="h-[16px] w-[16px] sm:h-[18px] sm:w-[18px] text-primary" />
                    ) : (
                      <School className="h-[16px] w-[16px] sm:h-[18px] sm:w-[18px] text-primary" />
                    )}
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight truncate max-w-[100px] sm:max-w-[130px]">
                      {selectedSubject 
                        ? selectedClass.name 
                        : (selectedInstitute?.shortName || selectedInstitute?.name || '')}
                    </span>
                    <h1 className="text-xs sm:text-sm font-semibold text-foreground truncate leading-tight max-w-[120px] sm:max-w-[140px]">
                      {selectedSubject ? selectedSubject.name : selectedClass.name}
                    </h1>
                  </div>
                  {!isSwitcherDisabled && <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0 ml-0.5" />}
                </button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[75vh] rounded-t-3xl">
                <DrawerHeader className="text-left pb-2">
                  <DrawerTitle className="text-lg font-bold">Switch Class</DrawerTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedInstitute?.shortName || selectedInstitute?.name || ''}</p>
                </DrawerHeader>
                <div className="px-4 pb-6 overflow-y-auto">
                  <button
                    onClick={() => {
                      setClassDrawerOpen(false);
                      setSelectedClass(null);
                      setSelectedSubject(null);
                      navigate(`/institute/${selectedInstitute!.id}/select-class`);
                    }}
                    className="w-full flex items-center gap-2 text-xs text-muted-foreground py-3 px-3 rounded-xl hover:bg-muted/60 active:scale-[0.98] transition-all mb-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back to {selectedInstitute?.shortName || 'Institute'}
                  </button>
                  <div className="h-px bg-border/60 mb-3" />
                  
                  {!classesLoaded ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
                  ) : classes.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">No classes found</div>
                  ) : (
                    <div className="space-y-1.5">
                      {classes.map((cls) => (
                        <button
                          key={cls.id}
                          onClick={() => { handleSwitchClass(cls); setClassDrawerOpen(false); }}
                          className={`w-full flex items-center gap-3 py-3.5 px-3.5 rounded-2xl transition-all active:scale-[0.98] ${selectedClass?.id === cls.id ? 'bg-primary/10 border border-primary/20 shadow-sm' : 'hover:bg-muted/50'}`}
                        >
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${selectedClass?.id === cls.id ? 'bg-primary/20' : 'bg-muted'}`}>
                            <School className={`h-5 w-5 ${selectedClass?.id === cls.id ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="flex flex-col items-start min-w-0">
                            <span className="text-sm font-medium truncate">{cls.name}</span>
                            {cls.specialty && <span className="text-[11px] text-muted-foreground">{cls.specialty}</span>}
                          </div>
                          {selectedClass?.id === cls.id && (
                            <span className="ml-auto h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </DrawerContent>
            </Drawer>
          ) : isParentWithChild ? (
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
                <h1 className="text-sm font-semibold text-foreground truncate leading-tight max-w-[140px]">
                  {selectedChild?.user?.nameWithInitials ||
                    `${selectedChild?.user?.firstName || ''} ${selectedChild?.user?.lastName || ''}`.trim() ||
                    'Child'}
                </h1>
                <span className="text-[10px] text-muted-foreground leading-tight">Child Mode</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-0.5" />
            </button>
          ) : (
            /* Branding (Left Section) - Visible on all screens if no switcher active */
            <div className="flex items-center gap-2 px-1.5 py-1.5 min-w-0">
              <SafeImage 
                src={selectedInstitute?.logo || surakshaLogo} 
                alt={selectedInstitute?.shortName ? "Institute logo" : "SurakshaLMS logo"}
                className="h-9 w-9 sm:h-10 sm:w-10 object-contain rounded-xl shrink-0"
              />
              <div className="flex flex-col items-start min-w-0">
                <h1 className="text-[11px] sm:text-sm font-bold text-foreground truncate leading-tight max-w-[120px] sm:max-w-[180px]">
                  {selectedInstitute?.shortName || 'SurakshaLMS'}
                </h1>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight truncate">
                  {selectedInstitute?.type || displayRole || 'Education Platform'}
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
          
          {/* Desktop Profile & Greeting (Standard Right Alignment) */}
          <div className="hidden lg:flex items-center gap-3 ml-3 pl-3 border-l border-border/50">
            <div className="flex flex-col items-end min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight truncate">
                {greeting}, {firstName}!
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">
                {selectedInstitute?.shortName || selectedInstitute?.name || 'SurakshaLMS'}
              </p>
            </div>
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
