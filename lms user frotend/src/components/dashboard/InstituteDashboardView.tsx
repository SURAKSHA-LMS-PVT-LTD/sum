import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { Building2, ChevronLeft } from 'lucide-react';
import DashboardClassCards from './DashboardClassCards';
import FeaturesSection from './FeaturesSection';
import { AttendanceFeedWidget } from './DashboardWidgets';
import InstituteCarousel from './InstituteCarousel';

const InstituteDashboardView = () => {
  const { user, selectedInstitute, setSelectedInstitute } = useAuth();
  const { isTenantLogin } = useTenant();
  const userRole = useInstituteRole();
  const navigate = useNavigate();

  const handleDeselect = () => {
    setSelectedInstitute(null);
    navigate('/dashboard');
  };

  if (!selectedInstitute) return null;

  const roleLabel = userRole?.replace(/_/g, ' ') || '';
  const firstName = user?.name?.split(' ')[0] || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="space-y-4 pb-24 sm:pb-12">
      {/* Greeting Section */}
      <div className="px-2 pt-2 pb-1">
        <h1 className="text-2xl font-bold text-foreground">
          {greeting}, <span className="text-primary">{firstName}</span>!
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Welcome back to {selectedInstitute.shortName || selectedInstitute.name}.
        </p>
      </div>
      {/* Top: institute switcher — hidden on tenant domains (institute is locked) */}
      {!isTenantLogin && (
        <div className="px-2 pt-2">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={handleDeselect}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              All Institutes
            </button>
          </div>
          <InstituteCarousel onSelectInstitute={setSelectedInstitute} compact />
        </div>
      )}

      {/* Institute info header */}
      <div className="mx-2 bg-card border border-border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          {selectedInstitute.logo ? (
            <img
              src={selectedInstitute.logo}
              alt={selectedInstitute.shortName || selectedInstitute.name}
              className="w-12 h-12 rounded-xl object-cover ring-1 ring-border shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">
              {selectedInstitute.name}
            </h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {roleLabel && (
                <span className="text-xs text-primary font-medium capitalize">{roleLabel}</span>
              )}
              {selectedInstitute.code && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                  {selectedInstitute.code}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Classes picker */}
      <div className="mx-2 bg-card border border-border rounded-2xl p-4 shadow-sm">
        <DashboardClassCards />
      </div>

      {/* Quick Access Features */}
      <div className="mx-2 bg-card border border-border rounded-2xl p-4 shadow-sm">
        <FeaturesSection level="institute" />
      </div>

      {/* My Attendance */}
      <div className="mx-2">
        <AttendanceFeedWidget filterInstituteId={selectedInstitute.id} />
      </div>
    </div>
  );
};

export default InstituteDashboardView;
