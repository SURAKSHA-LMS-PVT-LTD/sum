import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { Building, Users, CheckCircle, RefreshCw, MapPin, Mail, Phone, Youtube, Facebook, Globe, Plus, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cachedApiClient } from '@/api/cachedClient';
import { getBaseUrl } from '@/contexts/utils/auth.api';
import ChildCurrentSelection from '@/components/ChildCurrentSelection';
import { useTenant } from '@/contexts/TenantContext';
import { getImageUrl } from '@/utils/imageUrlHelper';

// Helper function to resolve image URLs
const resolveImageUrl = (val?: string) => {
  if (!val) return '/placeholder.svg';
  return getImageUrl(val);
};
interface InstituteApiResponse {
  id: string;
  name: string;
  shortName?: string;
  instituteId?: string;
  instituteName?: string;
  code?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  district?: string;
  province?: string;
  pinCode?: string;
  type: string;
  isActive: boolean;
  createdAt: string;
  imageUrl?: string;
  logoUrl?: string;
  userImageUrl?: string;
  websiteUrl?: string;
  facebookPageUrl?: string;
  youtubeChannelUrl?: string;
  vision?: string;
  mission?: string;
  tier?: string;
  subdomain?: string;
  // Parent institutes response fields
  primaryColorCode?: string;
  secondaryColorCode?: string;
  role?: string;
  enrollmentStatus?: boolean;
  instituteUserId?: string;
  studentInstituteImageUrl?: string;
  isVerified?: boolean;
  instituteUserStatus?: string;
  isParentInstitute?: boolean;
}
interface InstituteSelectorProps {
  useChildId?: boolean;
}
const InstituteSelector = ({
  useChildId = false
}: InstituteSelectorProps) => {
  const {
    user,
    setSelectedInstitute,
    selectedChild,
    isViewingAsParent
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const { isTenantLogin, branding } = useTenant();
  const [institutes, setInstitutes] = useState<InstituteApiResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  const [expandedInstituteId, setExpandedInstituteId] = useState<string | null>(null);
  const userRole = useInstituteRole();
  const { navigateToPage } = useAppNavigation();
  // Track if auto-skip was already attempted (prevents double-fire)
  const hasAutoSkipped = useRef(false);
  // Sidebar collapse awareness for grid columns
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    typeof document !== 'undefined' && document.documentElement.classList.contains('sidebar-collapsed')
  );
  React.useEffect(() => {
    const handler = () => setSidebarCollapsed(document.documentElement.classList.contains('sidebar-collapsed'));
    window.addEventListener('sidebar:state', handler as any);
    return () => window.removeEventListener('sidebar:state', handler as any);
  }, []);

  // Auto-load institutes on mount (uses cache if available)
  React.useEffect(() => {
    const userId = useChildId && selectedChild ? (selectedChild.userId || selectedChild.id) : user?.id;
    if (userId && !hasAutoLoaded && institutes.length === 0) {
      setHasAutoLoaded(true);
      handleLoadInstitutes();
    }
  }, [user?.id, selectedChild?.userId, selectedChild?.id, useChildId, hasAutoLoaded]);
  const handleLoadInstitutes = async () => {
    // For Parent role, use the selected child's USER ID (not student record ID)
    const userId = useChildId && selectedChild ? (selectedChild.userId || selectedChild.id) : user?.id;
    if (!userId) {
      toast({
        title: "Error",
        description: useChildId ? "No child selected" : "No user ID available",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    // Clear any stale rate limit before loading
    cachedApiClient.clearRateLimit();
    try {

      // For parent selecting child's institutes, use ONLY the parent-institutes endpoint
      // Do NOT fall back to /users/:id/institutes as it returns 403 for other users
      const endpoints = useChildId
        ? [
            // ✅ Parent selecting institutes for child - use ONLY this endpoint
            `/users/${userId}/parent-institutes`
          ]
        : [`/users/${userId}/institutes`];
      let result: InstituteApiResponse[] | null = null;
      let lastErr: any = null;
      for (const ep of endpoints) {
        try {
          console.log('Trying endpoint:', ep);

          // Use cachedApiClient instead of direct fetch
          const data = await cachedApiClient.get(ep, {
            page: 1,
            limit: 10
          }, {
            ttl: 30,
            // Cache for 30 minutes
            forceRefresh: false,
            userId: userId,
            role: userRole || 'User'
          });

          // Handle response - data might be array or wrapped in data property
          if (Array.isArray(data)) {
            result = data;
            console.log('✅ Successful endpoint (cached):', ep);
            break;
          }
          if (data?.data && Array.isArray(data.data)) {
            result = data.data;
            console.log('✅ Successful endpoint (wrapped, cached):', ep);
            break;
          }
          console.warn(`Endpoint ${ep} returned unexpected response shape`);
          lastErr = new Error('Unexpected response shape');
        } catch (e) {
          console.error(`Error calling ${ep}:`, e);
          lastErr = e;
        }
      }
      if (!result) {
        throw lastErr || new Error('No valid endpoint available for institutes');
      }
      console.log('Institutes API Response:', result);

      // Normalize API response to expected shape
      const normalized = (result as any[]).map((raw: any) => ({
        id: raw.id || raw.instituteId || '',
        name: raw.name || raw.instituteName || '',
        shortName: raw.shortName || '',
        code: raw.code || '',
        email: raw.email || raw.instituteEmail || '',
        phone: raw.phone || raw.institutePhone || '',
        address: raw.address || raw.instituteAddress || '',
        city: raw.city || raw.instituteCity || '',
        state: raw.state || raw.instituteState || '',
        country: raw.country || raw.instituteCountry || '',
        district: raw.district || '',
        province: raw.province || '',
        pinCode: raw.pinCode || '',
        type: (() => { const t = raw.type || raw.instituteType || raw.instituteKind || ''; return t ? String(t).toLowerCase() : ''; })(),
        isActive: raw.isActive !== undefined ? raw.isActive : raw.instituteIsActive !== undefined ? raw.instituteIsActive : true,
        createdAt: raw.createdAt || '',
        imageUrl: raw.imageUrl || '',
        logoUrl: raw.logoUrl || raw.instituteLogo || '',
        userImageUrl: raw.instituteUserImageUrl || raw.studentInstituteImageUrl || '',
        websiteUrl: raw.websiteUrl || '',
        facebookPageUrl: raw.facebookPageUrl || '',
        youtubeChannelUrl: raw.youtubeChannelUrl || '',
        vision: raw.vision || '',
        mission: raw.mission || '',
        tier: raw.tier || '',
        subdomain: raw.subdomain || '',
        instituteUserType: raw.instituteUserType || raw.role || '',
        userIdByInstitute: raw.userIdByInstitute || raw.instituteUserId || '',
        status: raw.status || ''
      }));

      // Filter out any invalid institute data
      let validInstitutes = normalized.filter(inst => inst && inst.id && inst.name);

      // 🔒 Subdomain lock: When on tenant subdomain, restrict to ONLY the tenant's institute
      if (isTenantLogin && branding?.id) {
        validInstitutes = validInstitutes.filter(inst => inst.id === branding.id);
      }

      setInstitutes(validInstitutes);

      // 🏢 Multi-tenant auto-skip:
      // When the user logged in from a subdomain/custom domain login page (or via institute-level
      // login form), the instituteId is stored in sessionStorage by auth.api.ts.
      // Read it now, clear it immediately (one-time use), then auto-select the institute.
      // Note: We check for preSelectedInstituteId regardless of isTenantLogin so this
      // also works for institute-level logins on the main domain.
      if (!useChildId && !hasAutoSkipped.current) {
        const preId = sessionStorage.getItem('tenant_preSelectedInstituteId');
        if (preId) {
          // Clear immediately so navigating back to /select-institute shows full list
          sessionStorage.removeItem('tenant_preSelectedInstituteId');
          sessionStorage.removeItem('tenant_preSelectedInstituteName');
          hasAutoSkipped.current = true;
          const match = validInstitutes.find(inst => inst.id === preId);
          if (match) {
            // Small delay to let React finish state update before navigating
            setTimeout(() => handleSelectInstitute(match), 50);
            return; // Skip setInstitutes render — will navigate away
          }
        }
      }
      
    } catch (error: any) { 
      console.error('Error loading institutes:', error);
    } finally {
      setIsLoading(false);
    }
  };
  const handleSelectInstitute = (institute: InstituteApiResponse) => {
    if (!institute || !institute.id) {
      toast({
        title: "Error",
        description: "Invalid institute data",
        variant: "destructive"
      });
      return;
    }
    // CRITICAL: When parent selects institute for child, force role to STUDENT
    // because parent-institutes API returns role=PARENT (parent's relation) not the child's role
    const effectiveRole = isViewingAsParent
      ? 'STUDENT'
      : ((institute as any).instituteUserType || (institute as any).role || '');
    
    const selectedInstitute = {
      id: institute.id,
      name: institute.name,
      code: institute.id,
      description: `${institute.address || ''}, ${institute.city || ''}`.trim(),
      isActive: institute.isActive,
      type: institute.type || '',
      instituteUserType: effectiveRole,
      userRole: effectiveRole,
      userIdByInstitute: (institute as any).userIdByInstitute || (institute as any).instituteUserId || '',
      shortName: institute.shortName || institute.name,
      logo: institute.logoUrl || '',
      instituteUserImageUrl: institute.userImageUrl || institute.imageUrl || ''
    };
    setSelectedInstitute(selectedInstitute);
    toast({
      title: "Institute Selected",
      description: `Selected institute: ${selectedInstitute.name}`
    });

    // When parent is viewing child's data, navigate to child's class selection.
    // replace:true removes /select-institute (or /child/:id/select-institute) from the
    // back stack so the Android back button returns to the page BEFORE the selection flow.
    if (isViewingAsParent && selectedChild) {
      navigate(`/child/${selectedChild.id}/select-class`, { replace: true });
      return;
    }

    // After selecting an institute, always go to institute-scoped class selection.
    // replace:true removes the /select-institute page from history — pressing back will
    // return to wherever the user was BEFORE the selection flow, not back to this selector.
    // IMPORTANT: don't use navigateToPage here because it depends on selectedInstitute state
    // which may not be updated yet (causes route to become /select-class and selection to be cleared).
    navigate(`/institute/${selectedInstitute.id}/select-class`, { replace: true });
    return;
  };
  return <div className="space-y-2 sm:space-y-4 px-1 sm:px-3 md:px-0">
      {/* Header with back button */}
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        {!isTenantLogin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-8 w-8 p-0 rounded-lg hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Building className="h-5 w-5 text-primary" />
          <h1 className="text-base sm:text-lg font-semibold text-foreground">{isTenantLogin ? (branding?.name || 'Your Institute') : 'Select Institute'}</h1>
        </div>
      </div>

      {/* Show Current Child Selection for Parent flow */}
      {useChildId && <ChildCurrentSelection className="mb-4" />}

      <div className="text-center mb-2 sm:mb-4">
        <h1 className="text-sm sm:text-base md:text-lg font-semibold text-foreground mb-0.5">
          {isTenantLogin ? (branding?.name || 'Institute') : 'Institutes'}
        </h1>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          {isTenantLogin
            ? 'You are logged in via institute subdomain. Select your institute to continue.'
            : 'Choose an institute to continue to your dashboard or create a new one'}
        </p>
      </div>

      {institutes.length === 0 && !isLoading && hasAutoLoaded && <div className="flex flex-col items-center justify-center py-6 sm:py-12 px-2">
          <Building className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 dark:text-gray-600 mb-2 sm:mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-3 sm:mb-4 text-center text-xs sm:text-sm">
            No institutes found. Click to retry or create a new one.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={handleLoadInstitutes} variant="outline" className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm h-7 sm:h-8">
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
              Retry
            </Button>
            {!isTenantLogin && (
              <Button onClick={() => navigate('/register/institute')} className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 sm:px-4 py-1.5 text-xs sm:text-sm h-7 sm:h-8">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
                Create New
              </Button>
            )}
          </div>
        </div>}

      {isLoading && <div className="flex flex-col items-center justify-center py-6 sm:py-12">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mb-2 sm:mb-3"></div>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Loading institutes...</p>
        </div>}

      {institutes.length > 0 && <>
          <div className="flex justify-between items-center mb-2 sm:mb-4">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
              Your Institutes ({institutes.length})
            </h2>
            <div className="flex items-center gap-2">
              {!isTenantLogin && (
                <Button onClick={() => navigate('/register/institute')} variant="default" size="sm" className="h-6 sm:h-7 text-[10px] sm:text-xs px-2 sm:px-2.5">
                  <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 sm:mr-1" />
                  <span className="hidden xs:inline">Create New</span>
                </Button>
              )}
              <Button onClick={handleLoadInstitutes} variant="outline" size="sm" disabled={isLoading} className="h-6 sm:h-7 text-[10px] sm:text-xs px-2 sm:px-2.5">
                <RefreshCw className={`h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 sm:mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden xs:inline">Refresh</span>
              </Button>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 sm:grid-cols-2 ${sidebarCollapsed ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-x-3 gap-y-8 sm:gap-x-4 sm:gap-y-10 pt-3 md:pt-6 mb-8`}
          >
            {institutes.map(institute => {
          const showSocial = expandedInstituteId === institute.id;
          return <div key={institute.id} className="relative flex w-full flex-col mt-5 rounded-lg bg-card bg-clip-border text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 border border-border hover:border-primary/50">
                  {/* Institute Image - Gradient Header */}
                  <div className="relative mx-4 -mt-5 h-32 overflow-hidden rounded-lg bg-clip-border text-white shadow-md shadow-primary/20 bg-gradient-to-br from-primary to-primary/80">
                    {(institute.imageUrl || institute.logoUrl) ? (
                      <img 
                        src={resolveImageUrl(institute.imageUrl || institute.logoUrl)} 
                        alt={institute.name || 'Institute'} 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                        }} 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-primary to-primary/80">
                        <Building className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    {/* Institute Name */}
                    <h5 className="mb-1.5 block font-sans text-sm font-semibold leading-snug tracking-normal text-foreground antialiased line-clamp-2">
                      {institute.name}
                    </h5>
                    
                    {/* Institute Type & Status */}
                    <div className="flex items-center justify-start gap-1.5 mb-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {institute.type}
                      </Badge>
                      {institute.isActive && <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 text-[10px] px-1.5 py-0">
                          <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                          Active
                        </Badge>}
                      {(institute as any).instituteUserType && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                          <Users className="h-2.5 w-2.5 mr-0.5" />
                          {(institute as any).instituteUserType}
                        </Badge>
                      )}
                    </div>

                    {/* Subdomain URL if available */}
                    {(institute as any).subdomain && (
                      <div className="flex items-center gap-1 mt-1">
                        <Globe className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                        <a
                          href={`https://${(institute as any).subdomain}.suraksha.lk`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono text-blue-600 dark:text-blue-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(institute as any).subdomain}.suraksha.lk
                        </a>
                      </div>
                    )}

                    {/* Description */}
                    <p className="block font-sans text-xs font-light leading-relaxed text-muted-foreground antialiased line-clamp-2">
                      {institute.address ? `${institute.address}, ${institute.city || ''}` : institute.type}
                    </p>
                    

                    {/* Additional Details - Shown when View More is clicked */}
                    {showSocial && <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300 space-y-3">
                        {/* Social Media Links */}
                        {(institute.websiteUrl || institute.facebookPageUrl || institute.youtubeChannelUrl) && <div className="flex gap-2 justify-start pb-3 border-b border-border">
                            {institute.websiteUrl && <Button variant="outline" size="icon" asChild>
                                <a href={institute.websiteUrl} target="_blank" rel="noopener noreferrer" aria-label="Visit website">
                                  <Globe className="h-4 w-4" />
                                </a>
                              </Button>}
                            {institute.facebookPageUrl && <Button variant="outline" size="icon" asChild>
                                <a href={institute.facebookPageUrl} target="_blank" rel="noopener noreferrer" aria-label="Visit Facebook page">
                                  <Facebook className="h-4 w-4" />
                                </a>
                              </Button>}
                            {institute.youtubeChannelUrl && <Button variant="outline" size="icon" asChild>
                                <a href={institute.youtubeChannelUrl} target="_blank" rel="noopener noreferrer" aria-label="Visit YouTube channel">
                                  <Youtube className="h-4 w-4" />
                                </a>
                              </Button>}
                          </div>}
                        
                        {/* Institute Details */}
                        <div className="space-y-2 text-sm">
                          {institute.code && <div className="flex items-start gap-2">
                              <span className="font-semibold text-foreground min-w-[80px]">Code:</span>
                              <span className="text-muted-foreground">{institute.code}</span>
                            </div>}
                          {institute.shortName && <div className="flex items-start gap-2">
                              <span className="font-semibold text-foreground min-w-[80px]">Short Name:</span>
                              <span className="text-muted-foreground">{institute.shortName}</span>
                            </div>}
                          {institute.email && <div className="flex items-start gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <span className="text-muted-foreground break-all">{institute.email}</span>
                            </div>}
                          {institute.phone && <div className="flex items-start gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <span className="text-muted-foreground">{institute.phone}</span>
                            </div>}
                          {institute.address && <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <span className="text-muted-foreground">
                                {institute.address}
                                {institute.city && `, ${institute.city}`}
                                {institute.state && `, ${institute.state}`}
                                {institute.country && `, ${institute.country}`}
                              </span>
                            </div>}
                        </div>
                      </div>}
                  </div>

                  {/* Action Buttons */}
                  <div className="p-4 pt-0 space-y-2">
                    <button onClick={() => setExpandedInstituteId(showSocial ? null : institute.id)} className="w-full select-none rounded-md border border-border bg-transparent py-2 px-4 text-center align-middle font-sans text-[11px] font-semibold uppercase text-muted-foreground shadow-none transition-all hover:bg-muted hover:text-foreground active:opacity-90">
                      {showSocial ? 'Show Less' : 'Read More'}
                    </button>
                    
                    <button onClick={() => handleSelectInstitute(institute)} className="w-full select-none rounded-md bg-primary py-2 px-4 text-center align-middle font-sans text-[11px] font-semibold uppercase text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/30 active:opacity-90">
                      Select
                    </button>
                  </div>
                </div>;
        })}
          </div>
        </>}
    </div>;
};
export default InstituteSelector;