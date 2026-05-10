import React from 'react';
import DataTable from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { AccessControl } from '@/utils/permissions';

const mockAttendanceMarkers = [
  {
    id: '1',
    markerId: 'ATT001',
    name: 'James Wilson',
    email: 'james.wilson@institute.edu',
    phone: '+1 (555) 444-5555',
    assignedClasses: 'Grade 10-A, Grade 10-B',
    assignedSubjects: 'All Subjects',
    shifts: 'Morning, Afternoon',
    joinDate: '2023-06-15',
    status: 'Active',
    lastActivity: '2024-01-15 09:30 AM'
  },
  {
    id: '2',
    markerId: 'ATT002',
    name: 'Maria Garcia',
    email: 'maria.garcia@institute.edu',
    phone: '+1 (555) 555-6666',
    assignedClasses: 'Grade 11-S, Grade 12-S',
    assignedSubjects: 'Science Subjects',
    shifts: 'Morning',
    joinDate: '2023-08-20',
    status: 'Active',
    lastActivity: '2024-01-15 10:15 AM'
  },
  {
    id: '3',
    markerId: 'ATT003',
    name: 'David Lee',
    email: 'david.lee@institute.edu',
    phone: '+1 (555) 666-7777',
    assignedClasses: 'Grade 12-C',
    assignedSubjects: 'Commerce Subjects',
    shifts: 'Afternoon, Evening',
    joinDate: '2023-09-10',
    status: 'Inactive',
    lastActivity: '2024-01-12 03:45 PM'
  }
];

const AttendanceMarkers = () => {
  const { user } = useAuth();

  const markersColumns = [
    { key: 'markerId', header: 'Marker ID' },
    { key: 'name', header: 'Full Name' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'assignedClasses', header: 'Assigned Classes' },
    { key: 'assignedSubjects', header: 'Subject Areas' },
    { key: 'shifts', header: 'Shifts' },
    { key: 'joinDate', header: 'Join Date' },
    { key: 'lastActivity', header: 'Last Activity' },
    { 
      key: 'status', 
      header: 'Status',
      render: (value: string) => (
        <Badge variant={value === 'Active' ? 'default' : 'secondary'}>
          {value}
        </Badge>
      )
    }
  ];

  const handleAddMarker = () => {
    console.log('Add new attendance marker');
  };

  const handleEditMarker = (marker: any) => {
    console.log('Edit attendance marker:', marker);
  };

  const handleDeleteMarker = (marker: any) => {
    console.log('Delete attendance marker:', marker);
  };

  const handleViewMarker = (marker: any) => {
    console.log('View attendance marker details:', marker);
  };

  const userRole = useInstituteRole();
  const canCreate = AccessControl.hasPermission(userRole, 'create-attendance-marker');
  const canEdit = AccessControl.hasPermission(userRole, 'edit-attendance-marker');
  const canDelete = AccessControl.hasPermission(userRole, 'delete-attendance-marker');
  const canView = AccessControl.hasPermission(userRole, 'view-attendance-marker-details');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Attendance Markers Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage attendance marking staff and their assignments
        </p>
      </div>

      <DataTable
        title="Attendance Markers"
        data={mockAttendanceMarkers}
        columns={markersColumns}
        onAdd={canCreate ? handleAddMarker : undefined}
        onEdit={canEdit ? handleEditMarker : undefined}
        onDelete={canDelete ? handleDeleteMarker : undefined}
        onView={canView ? handleViewMarker : undefined}
        searchPlaceholder="Search attendance markers..."
      />
    </div>
  );
};

export default AttendanceMarkers;
