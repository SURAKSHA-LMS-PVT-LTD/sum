import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import InstituteCarousel from '@/components/dashboard/InstituteCarousel';
import { AttendanceFeedWidget } from '@/components/dashboard/DashboardWidgets';
import DashboardChildrenCard from '@/components/dashboard/DashboardChildrenCard';
import { Building2 } from 'lucide-react';

const MobileDashboard = () => {
  const { user, setSelectedInstitute } = useAuth();
  const userRole = useInstituteRole();

  const firstName = user?.firstName || user?.name?.split(' ')[0] || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const showChildrenCard = userRole === 'Parent' || (user?.userType?.toUpperCase() !== 'USER_WITHOUT_PARENT');

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="px-2 pt-2">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {greeting}{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select an institute to get started.
        </p>
      </div>

      {/* My Institutes */}
      <div className="px-2 pt-2">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">My Institutes</h2>
        </div>
        <InstituteCarousel onSelectInstitute={setSelectedInstitute} />
      </div>

      {/* My Attendance & My Children */}
      <div className="px-2 space-y-4">
        <AttendanceFeedWidget />
        {showChildrenCard && <DashboardChildrenCard />}
      </div>
    </div>
  );
};

export default MobileDashboard;
