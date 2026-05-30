/**
 * ProfileSwitcherSheet
 *
 * Facebook-style profile switcher.  One login, multiple "profiles":
 *   • The logged-in user's own profile with current role badge
 *   • Each linked child as a switchable student profile
 *   • Quick actions: Profile Settings, My Children, Log Out
 *
 * Opens as a bottom-sheet drawer.  Tapping a profile:
 *   - Self  → clears child context, navigates to own dashboard
 *   - Child → sets viewAsParent + navigates to child's institute selector
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, LogOut, ChevronRight, RefreshCw, CheckCircle2, Settings,
  UserCog, GraduationCap, School, Shield, BookOpen, Users, UserCheck, Loader2, Baby
} from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { cn } from '@/lib/utils';

interface ProfileSwitcherSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ChildProfile {
  id: string;
  userId: string;
  name: string;
  imageUrl?: string;
  relationship?: string;
  studentId?: string;
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

/** Map role string → display label + icon + color */
function roleInfo(role: string): { label: string; Icon: React.ElementType; color: string } {
  switch (role) {
    case 'InstituteAdmin': return { label: 'Admin', Icon: Shield, color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' };
    case 'Teacher':        return { label: 'Teacher', Icon: BookOpen, color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' };
    case 'Student':        return { label: 'Student', Icon: GraduationCap, color: 'text-green-600 bg-green-500/10 border-green-500/20' };
    case 'Parent':         return { label: 'Parent', Icon: Users, color: 'text-orange-600 bg-orange-500/10 border-orange-500/20' };
    case 'AttendanceMarker': return { label: 'Attendance Marker', Icon: UserCheck, color: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20' };
    case 'OrganizationManager': return { label: 'Org Manager', Icon: School, color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' };
    default:               return { label: role || 'User', Icon: User, color: 'text-muted-foreground bg-muted border-border' };
  }
}

const ProfileSwitcherSheet: React.FC<ProfileSwitcherSheetProps> = ({ open, onOpenChange }) => {
  const { 
    user, children: userChildren, 
    selectedChild, isViewingAsParent,
    validateUserToken, setSelectedChild, logout,
    selectedInstitute,
    selectedClass,
    selectedSubject,
    selectedOrganization,
    selectedTransport,
  } = useAuth();
  const { isTenantLogin } = useTenant();
  const navigate = useNavigate();
  const currentRole = useInstituteRole();

  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  // Prevents double-taps and gates navigation behind a valid token
  const [switching, setSwitching] = useState<string | boolean>(false);

  const loadChildren = useCallback(
    async (forceRefresh = false) => {
      if (!user?.id) return;
      setLoadingChildren(true);
      try {
        const data = await enhancedCachedClient.get<any>(
          `/parents/${user.id}/children`,
          {},
          { ttl: 300, forceRefresh, userId: user.id, role: 'Parent' }
        );
        const raw: any[] = data?.children ?? (Array.isArray(data) ? data : []);
        const mapped: ChildProfile[] = raw.map((c) => ({
          id: c.id || c.studentId || '',
          userId: c.id || c.studentId || '',
          name: c.name || c.nameWithInitials || '',
          imageUrl: c.imageUrl || c.profileImageUrl || '',
          relationship: c.relationship || '',
          studentId: c.studentIdNumber || '',
        }));
        setChildren(mapped);
        setChildrenLoaded(true);
      } catch {
        setChildrenLoaded(true);
      } finally {
        setLoadingChildren(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    if (open && !childrenLoaded) loadChildren();
  }, [open, childrenLoaded, loadChildren]);

  /**
   * Validates (and silently refreshes if near-expiry) the access token before
   * committing a context switch.
   */
  const secureSwitch = async (switchFn: () => void, identifier: string | boolean = true) => {
    if (switching) return;
    setSwitching(identifier);
    try {
      await validateUserToken();
      switchFn();
    } catch {
      onOpenChange(false);
      logout();
    } finally {
      setSwitching(false);
    }
  };

  const handleSelectSelf = () =>
    void secureSwitch(() => {
      setSelectedChild(null, false);
      onOpenChange(false);
      if (selectedInstitute?.id) navigate(`/institute/${selectedInstitute.id}/dashboard`);
      else navigate('/dashboard');
    });

  const handleSelectChild = (child: any) =>
    void secureSwitch(() => {
      setSelectedChild(child, true);
      onOpenChange(false);
      navigate(`/child/${child.id}/select-institute`);
    }, child.id);

  const handleGoToProfile = () => {
    onOpenChange(false);
    const context = {
      instituteId: selectedInstitute?.id,
      classId: selectedClass?.id,
      subjectId: selectedSubject?.id,
      childId: selectedChild?.id,
      organizationId: selectedOrganization?.id,
      transportId: selectedTransport?.id,
    };
    navigate(buildSidebarUrl('profile', context));
  };

  const handleLogout = () => {
    onOpenChange(false);
    logout();
  };

  const isSelfActive = !isViewingAsParent;

  const { label: roleLabel, Icon: RoleIcon, color: roleColor } = roleInfo(
    isViewingAsParent ? 'Parent' : currentRole
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange} routeName="profile-switcher-drawer">
      <DrawerContent className="max-h-[95vh] rounded-t-3xl">
        <DrawerHeader className="pb-0 pt-5 px-5">
          <DrawerTitle className="text-base font-bold text-foreground">Switch Profile</DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-10 pt-3 space-y-1">

          {/* ── Current Role Context Banner ──────────────────────────── */}
          {selectedInstitute && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-muted/50 border border-border/40 mb-2">
              <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center border shrink-0', roleColor)}>
                <RoleIcon className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-muted-foreground leading-tight">Current Role</span>
                <span className="text-xs font-semibold text-foreground truncate">
                  {roleLabel} · {selectedInstitute.shortName || selectedInstitute.name}
                  {selectedClass ? ` · ${selectedClass.name}` : ''}
                </span>
              </div>
            </div>
          )}

          {/* ── Own Profile ──────────────────────────────────────────── */}
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 pt-2 pb-1">
            Your Account
          </p>

          <button
            onClick={handleSelectSelf}
            disabled={!!switching}
            className={cn(
              'w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all active:scale-[0.98]',
              isSelfActive ? 'bg-primary/10 border border-primary/20 shadow-sm' : 'hover:bg-muted/60',
              switching && 'opacity-60 pointer-events-none'
            )}
          >
            <div className="relative shrink-0">
              <Avatar className="h-13 w-13 border-2 border-border" style={{ width: 52, height: 52 }}>
                {user?.imageUrl && (
                  <AvatarImage src={getImageUrl(user.imageUrl)} alt={user.name} className="object-cover" />
                )}
                <AvatarFallback className="bg-muted text-sm font-semibold">
                  {user?.name ? getInitials(user.name) : <User className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
              {isSelfActive && (
                <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                  <CheckCircle2 className="h-2.5 w-2.5 text-primary-foreground" />
                </span>
              )}
            </div>
            <div className="flex flex-col items-start min-w-0 flex-1 text-left gap-0.5">
              <span className="text-sm font-semibold text-foreground truncate max-w-full">
                {user?.name || 'My Account'}
              </span>
              <span className="text-[11px] text-muted-foreground truncate max-w-full">
                {user?.email || user?.phone || 'Your account'}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge
                  variant="outline"
                  className={cn('text-[9px] px-1.5 py-0 h-4 gap-0.5 font-medium border', roleColor)}
                >
                  <RoleIcon className="h-2.5 w-2.5" />
                  {isSelfActive ? roleLabel : 'Your Role'}
                </Badge>
                {isSelfActive && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] px-1.5 py-0 h-4">
                    Active
                  </Badge>
                )}
              </div>
            </div>
            {!isSelfActive && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </button>

          {/* ── Children Profiles ─────────────────────────────────────── */}
          {!isTenantLogin && (children.length > 0 || loadingChildren) && (
            <>
              <div className="flex items-center justify-between px-1 pt-3 pb-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Children
                </p>
                <button
                  onClick={() => loadChildren(true)}
                  disabled={!!switching || loadingChildren}
                  className="text-[10px] text-primary flex items-center gap-1 active:opacity-70"
                >
                  <RefreshCw className={cn('h-3 w-3', loadingChildren && 'animate-spin')} />
                  Refresh
                </button>
              </div>

              {loadingChildren && children.length === 0 ? (
                <div className="h-16 flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  {children.map((child) => {
                    const active = isViewingAsParent && selectedChild?.id === child.id;
                    const rel = child.relationship || '';
                    return (
                      <button
                        key={child.id}
                        onClick={() => handleSelectChild(child)}
                        disabled={!!switching}
                        className={cn(
                          'w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all active:scale-[0.98]',
                          active ? 'bg-primary/10 border border-primary/20 shadow-sm' : 'hover:bg-muted/60',
                          switching && 'opacity-60 pointer-events-none'
                        )}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="border-2 border-border" style={{ width: 52, height: 52 }}>
                            {child.imageUrl && (
                              <AvatarImage src={getImageUrl(child.imageUrl)} alt={child.name} className="object-cover" />
                            )}
                            <AvatarFallback className="bg-muted text-sm font-semibold">
                              {getInitials(child.name)}
                            </AvatarFallback>
                          </Avatar>
                          {active && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                              <CheckCircle2 className="h-2.5 w-2.5 text-primary-foreground" />
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-start min-w-0 flex-1 text-left gap-0.5">
                          <span className="text-sm font-semibold text-foreground truncate max-w-full">
                            {child.name}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {rel && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 capitalize">
                                {rel}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 text-green-600 bg-green-500/10 border-green-500/20">
                              <GraduationCap className="h-2.5 w-2.5" />
                              Student
                            </Badge>
                            {active && (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] px-1.5 py-0 h-4">
                                Active
                              </Badge>
                            )}
                          </div>
                        </div>
                        {switching === child.id ? <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" /> : !active && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Quick Actions ────────────────────────────────────────── */}
          <div className="pt-3 mt-2 border-t border-border/50 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 pb-1">
              Quick Actions
            </p>

            <button
              onClick={handleGoToProfile}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl hover:bg-muted/60 active:scale-[0.98] transition-all text-left"
            >
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <UserCog className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium text-foreground">Profile Settings</span>
                <span className="text-[10px] text-muted-foreground">Edit your personal info</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
            </button>

            {!isTenantLogin && (userChildren?.length || 0) > 0 && (
              <button
                onClick={() => { onOpenChange(false); navigate('/my-children'); }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl hover:bg-muted/60 active:scale-[0.98] transition-all text-left"
              >
                <div className="h-9 w-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Baby className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-medium text-foreground">Manage Children</span>
                  <span className="text-[10px] text-muted-foreground">View {userChildren?.length || 0} linked child{(userChildren?.length || 0) !== 1 ? 'ren' : ''}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl hover:bg-destructive/5 active:scale-[0.98] transition-all text-left"
            >
              <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <LogOut className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium text-destructive">Log Out</span>
                <span className="text-[10px] text-muted-foreground">{user?.email || 'Sign out of this account'}</span>
              </div>
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ProfileSwitcherSheet;
