// src/pages/NotificationsPage.tsx
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  SystemNotifications, 
  InstituteNotifications, 
  NotificationManagement 
} from '@/components/notifications';
import { Bell, Building2, Settings, Megaphone } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const NotificationsPage: React.FC = () => {
  const { selectedInstitute, user } = useAuth();
  const [activeTab, setActiveTab] = useState('notifications');
  
  const isSuperAdmin = user?.userType === 'SUPERADMIN' || user?.userType === 'SA';
  const instituteUserType = selectedInstitute?.instituteUserType || selectedInstitute?.userRole;
  const isInstituteAdmin = instituteUserType === 'INSTITUTEADMIN' || instituteUserType === 'INSTITUTE_ADMIN';
  const isTeacher = instituteUserType === 'TEACHER';
  const canManageNotifications = selectedInstitute && (isInstituteAdmin || isTeacher || isSuperAdmin);

  // Before institute selection
  if (!selectedInstitute) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Notifications</h1>
              <p className="text-sm text-muted-foreground">System-wide announcements & updates</p>
            </div>
          </div>
        </div>
        <SystemNotifications />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              Updates from {selectedInstitute.name || 'your institute'}
            </p>
          </div>
        </div>
      </div>

      {canManageNotifications ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2 h-10 rounded-xl bg-muted/50 p-0.5">
            <TabsTrigger value="notifications" className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="manage" className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Manage</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="notifications" className="mt-4">
            <InstituteNotifications 
              instituteId={selectedInstitute.id}
              instituteName={selectedInstitute.name}
            />
          </TabsContent>
          
          <TabsContent value="manage" className="mt-4">
            <NotificationManagement instituteId={selectedInstitute.id} />
          </TabsContent>
        </Tabs>
      ) : (
        <InstituteNotifications 
          instituteId={selectedInstitute.id}
          instituteName={selectedInstitute.name}
        />
      )}
    </div>
  );
};

export default NotificationsPage;
