import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import InstituteCarousel from '@/components/dashboard/InstituteCarousel';
import { AttendanceFeedWidget } from '@/components/dashboard/DashboardWidgets';
import DashboardChildrenCard from '@/components/dashboard/DashboardChildrenCard';
import { Building2 } from 'lucide-react';

const DesktopDashboard = () => {
  const { user, setSelectedInstitute } = useAuth();
  const userRole = useInstituteRole();

  const firstName = user?.firstName || user?.name?.split(' ')[0] || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const showChildrenCard = userRole === 'Parent' || (user?.userType?.toUpperCase() !== 'USER_WITHOUT_PARENT');

  return (
    <div className="w-full p-4 sm:p-8 space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          {greeting}{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Select an institute to get started.
        </p>
      </div>

      {/* My Institutes */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">My Institutes</h2>
        </div>
        <InstituteCarousel onSelectInstitute={setSelectedInstitute} />
      </div>

      {/* My Attendance & My Children */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttendanceFeedWidget />
        {showChildrenCard && <DashboardChildrenCard />}
      </div>
    </div>
  );
};

export default DesktopDashboard;
