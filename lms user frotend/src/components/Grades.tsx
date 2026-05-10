import React, { useState, useEffect } from 'react';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import DataTable from '@/components/ui/data-table';
import { useAuth } from '@/contexts/AuthContext';
import { AccessControl } from '@/utils/permissions';
import { Plus, Edit, Trash2, Eye, Users, BookOpen, Settings } from 'lucide-react';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';

// Mock organizations data
const mockOrganizations = [{
  id: '1',
  name: 'Primary School Organization',
  level: 10,
  description: 'Primary education organization for younger students',
  studentsCount: 150,
  classesCount: 5,
  subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'],
  createdAt: '2024-01-15',
  isActive: true
}, {
  id: '2',
  name: 'Secondary School Organization',
  level: 11,
  description: 'Secondary education organization for intermediate students',
  studentsCount: 120,
  classesCount: 4,
  subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science'],
  createdAt: '2024-01-15',
  isActive: true
}, {
  id: '3',
  name: 'Advanced School Organization',
  level: 12,
  description: 'Advanced education organization for senior students',
  studentsCount: 100,
  classesCount: 3,
  subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science'],
  createdAt: '2024-01-15',
  isActive: true
}];

// Mock classes data for assignment
const mockClasses = [{
  id: '1',
  name: 'Class 10-A',
  studentsCount: 35
}, {
  id: '2',
  name: 'Class 10-B',
  studentsCount: 30
}, {
  id: '3',
  name: 'Class 11-A',
  studentsCount: 28
}, {
  id: '4',
  name: 'Class 11-B',
  studentsCount: 32
}, {
  id: '5',
  name: 'Class 12-A',
  studentsCount: 25
}];

interface Organization {
  id: string;
  name: string;
  level: number;
  description: string;
  studentsCount: number;
  classesCount: number;
  subjects: string[];
  createdAt: string;
  isActive: boolean;
}

interface Class {
  id: string;
  name: string;
  studentsCount: number;
}

const Grades = () => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>(mockOrganizations);
  const [classes, setClasses] = useState<Class[]>(mockClasses);
  const [currentView, setCurrentView] = useState('list');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; orgId: string; orgName: string }>({ open: false, orgId: '', orgName: '' });
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    level: '',
    description: ''
  });

  // Class assignment states
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [assignedClasses, setAssignedClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const userRole = useInstituteRole();
  const isSystemAdmin = user?.role === 'SystemAdmin'; // Keep global role check for SystemAdmin

  useEffect(() => {
    if (selectedOrganization) {
      // Filter classes - in real app, this would be based on organization level
      const available = classes.filter(cls => !assignedClasses.find(ac => ac.id === cls.id));
      setAvailableClasses(available);
    }
  }, [selectedOrganization, classes, assignedClasses]);

  // Filter organizations based on search and filters
  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         org.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = filterLevel === 'all' || org.level.toString() === filterLevel;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && org.isActive) || 
                         (filterStatus === 'inactive' && !org.isActive);
    return matchesSearch && matchesLevel && matchesStatus;
  });

  // Table columns with proper render functions
  const columns = [{
    key: 'name',
    header: 'Organization Name'
  }, {
    key: 'level',
    header: 'Level',
    render: (value: any, row: any) => <Badge variant="outline">Level {value}</Badge>
  }, {
    key: 'description',
    header: 'Description'
  }, {
    key: 'studentsCount',
    header: 'Students',
    render: (value: any, row: any) => (
      <div className="flex items-center gap-1">
        <Users className="h-4 w-4 text-gray-500" />
        <span>{value}</span>
      </div>
    )
  }, {
    key: 'classesCount',
    header: 'Classes',
    render: (value: any, row: any) => (
      <div className="flex items-center gap-1">
        <BookOpen className="h-4 w-4 text-gray-500" />
        <span>{value}</span>
      </div>
    )
  }, {
    key: 'isActive',
    header: 'Status',
    render: (value: any, row: any) => (
      <Badge variant={value ? 'default' : 'secondary'}>
        {value ? 'Active' : 'Inactive'}
      </Badge>
    )
  }, {
    key: 'viewClasses',
    header: 'View Classes',
    render: (value: any, row: Organization) => (
      <Button variant="outline" size="sm" onClick={() => handleViewClasses(row)} className="flex items-center gap-1">
        <Eye className="h-3 w-3" />
        View
      </Button>
    )
  }, {
    key: 'assignClasses',
    header: 'Assign Classes',
    render: (value: any, row: Organization) => (
      <Button variant="outline" size="sm" onClick={() => handleAssignClasses(row)} className="flex items-center gap-1">
        <Settings className="h-3 w-3" />
        Assign
      </Button>
    )
  }];

  const handleViewOrganization = (org: Organization) => {
    setSelectedOrganization(org);
    setCurrentView('details');
  };

  const handleEditOrganization = (org: Organization) => {
    setSelectedOrganization(org);
    setFormData({
      name: org.name,
      level: org.level.toString(),
      description: org.description
    });
    setIsCreating(true);
    setCurrentView('form');
  };

  const handleCreateOrganization = () => {
    setSelectedOrganization(null);
    setFormData({
      name: '',
      level: '',
      description: ''
    });
    setIsCreating(true);
    setCurrentView('form');
  };

  const handleDeleteOrganization = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    setDeleteDialog({ open: true, orgId, orgName: org?.name || orgId });
  };

  const confirmDeleteOrganization = () => {
    setOrganizations(organizations.filter(g => g.id !== deleteDialog.orgId));
    setDeleteDialog({ open: false, orgId: '', orgName: '' });
  };

  const handleSubmitForm = () => {
    if (selectedOrganization) {
      // Update existing organization
      setOrganizations(organizations.map(g => 
        g.id === selectedOrganization.id ? {
          ...g,
          name: formData.name,
          level: parseInt(formData.level),
          description: formData.description
        } : g
      ));
    } else {
      // Create new organization
      const newOrganization: Organization = {
        id: Date.now().toString(),
        name: formData.name,
        level: parseInt(formData.level),
        description: formData.description,
        studentsCount: 0,
        classesCount: 0,
        subjects: [],
        createdAt: new Date().toISOString().split('T')[0],
        isActive: true
      };
      setOrganizations([...organizations, newOrganization]);
    }
    setCurrentView('list');
    setIsCreating(false);
  };

  const handleAssignClasses = (org: Organization) => {
    setSelectedOrganization(org);
    setCurrentView('assign-classes');
    setAssignedClasses([]); // Reset assigned classes
  };

  const handleViewClasses = (org: Organization) => {
    setSelectedOrganization(org);
    setCurrentView('view-classes');
  };

  const handleAddClassToOrganization = () => {
    if (selectedClass) {
      const classToAdd = availableClasses.find(c => c.id === selectedClass);
      if (classToAdd) {
        setAssignedClasses([...assignedClasses, classToAdd]);
        setSelectedClass('');
      }
    }
  };

  const handleRemoveClassFromOrganization = (classId: string) => {
    setAssignedClasses(assignedClasses.filter(c => c.id !== classId));
  };

  const handleSaveClassAssignments = () => {
    // In real app, save the class assignments to backend
    console.log('Saving class assignments for organization:', selectedOrganization?.name, assignedClasses);
    setCurrentView('details');
  };

  // Add custom actions for View Classes and Assign Classes buttons
  const customActions = [{
    label: 'View Classes',
    action: (row: any) => handleViewClasses(row),
    icon: <Eye className="h-3 w-3" />,
    variant: 'outline' as const,
    condition: () => AccessControl.hasPermission(userRole as any, 'view-classes')
  }, {
    label: 'Assign Classes',
    action: (row: any) => handleAssignClasses(row),
    icon: <Settings className="h-3 w-3" />,
    variant: 'outline' as const,
    condition: () => AccessControl.hasPermission(userRole as any, 'edit-grade')
  }];

  // Render different views
  if (currentView === 'form') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isCreating ? (selectedOrganization ? 'Edit Organization' : 'Create Organization') : 'Organization Details'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {isCreating ? 'Fill in the organization information' : 'View organization details'}
            </p>
          </div>
          <Button variant="outline" onClick={() => setCurrentView('list')}>
            Back to List
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{selectedOrganization ? 'Edit Organization' : 'Create New Organization'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Organization Name</label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  placeholder="Enter organization name" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Organization Level</label>
                <Select value={formData.level} onValueChange={(value) => setFormData({ ...formData, level: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                    <SelectItem value="4">Level 4</SelectItem>
                    <SelectItem value="5">Level 5</SelectItem>
                    <SelectItem value="6">Level 6</SelectItem>
                    <SelectItem value="7">Level 7</SelectItem>
                    <SelectItem value="8">Level 8</SelectItem>
                    <SelectItem value="9">Level 9</SelectItem>
                    <SelectItem value="10">Level 10</SelectItem>
                    <SelectItem value="11">Level 11</SelectItem>
                    <SelectItem value="12">Level 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input 
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                placeholder="Enter organization description" 
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmitForm}>
                {selectedOrganization ? 'Update Organization' : 'Create Organization'}
              </Button>
              <Button variant="outline" onClick={() => setCurrentView('list')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentView === 'details' && selectedOrganization) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {selectedOrganization.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Organization level {selectedOrganization.level} details and management
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCurrentView('list')}>
              Back to List
            </Button>
            {AccessControl.hasPermission(userRole as any, 'edit-grade') && (
              <Button onClick={() => handleEditOrganization(selectedOrganization)}>
                Edit Organization
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {selectedOrganization.studentsCount}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total enrolled students
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-green-600" />
                Classes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {selectedOrganization.classesCount}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total classes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={selectedOrganization.isActive ? 'default' : 'secondary'} className="text-lg px-3 py-1">
                {selectedOrganization.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Organization Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <p className="text-gray-900 dark:text-white">{selectedOrganization.description}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created</label>
                <p className="text-gray-900 dark:text-white">{selectedOrganization.createdAt}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Subjects</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedOrganization.subjects.map((subject, index) => (
                    <Badge key={index} variant="outline">{subject}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button onClick={() => handleAssignClasses(selectedOrganization)}>
                Assign Classes
              </Button>
              <Button variant="outline">
                View Students
              </Button>
              <Button variant="outline">
                Manage Subjects
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentView === 'view-classes' && selectedOrganization) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Classes in {selectedOrganization.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              View all classes assigned to this organization
            </p>
          </div>
          <Button variant="outline" onClick={() => setCurrentView('list')}>
            Back to List
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assigned Classes</CardTitle>
            <CardDescription>
              Classes currently assigned to {selectedOrganization.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.slice(0, selectedOrganization.classesCount).map(cls => (
                <Card key={cls.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <h3 className="font-semibold">{cls.name}</h3>
                      <p className="text-sm text-gray-600">
                        {cls.studentsCount} students
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                        <Button size="sm" variant="outline">
                          Manage
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentView === 'assign-classes' && selectedOrganization) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Assign Classes to {selectedOrganization.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage class assignments for this organization
            </p>
          </div>
          <Button variant="outline" onClick={() => setCurrentView('details')}>
            Back to Details
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Available Classes</CardTitle>
              <CardDescription>Select classes to assign to this organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} ({cls.studentsCount} students)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddClassToOrganization} disabled={!selectedClass}>
                  Add
                </Button>
              </div>
              
              <div className="space-y-2">
                {availableClasses.map(cls => (
                  <div key={cls.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{cls.name}</p>
                      <p className="text-sm text-gray-600">{cls.studentsCount} students</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assigned Classes</CardTitle>
              <CardDescription>Classes currently assigned to this organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {assignedClasses.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No classes assigned yet</p>
                ) : assignedClasses.map(cls => (
                  <div key={cls.id} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <div>
                      <p className="font-medium">{cls.name}</p>
                      <p className="text-sm text-gray-600">{cls.studentsCount} students</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveClassFromOrganization(cls.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              
              {assignedClasses.length > 0 && (
                <div className="pt-4 border-t">
                  <Button onClick={handleSaveClassAssignments} className="w-full">
                    Save Assignments
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isSystemAdmin ? 'Select Island Organizations' : 'Select School Organization'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage academic {isSystemAdmin ? 'island organizations' : 'school organizations'} and levels
          </p>
        </div>
        {AccessControl.hasPermission(userRole as any, 'create-grade') && (
          <Button onClick={handleCreateOrganization} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Organization
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input 
                placeholder={`Search ${isSystemAdmin ? 'island organizations' : 'organizations'}...`}
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="1">Level 1</SelectItem>
                <SelectItem value="2">Level 2</SelectItem>
                <SelectItem value="3">Level 3</SelectItem>
                <SelectItem value="4">Level 4</SelectItem>
                <SelectItem value="5">Level 5</SelectItem>
                <SelectItem value="6">Level 6</SelectItem>
                <SelectItem value="7">Level 7</SelectItem>
                <SelectItem value="8">Level 8</SelectItem>
                <SelectItem value="9">Level 9</SelectItem>
                <SelectItem value="10">Level 10</SelectItem>
                <SelectItem value="11">Level 11</SelectItem>
                <SelectItem value="12">Level 12</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isSystemAdmin ? 'All Island Organizations' : 'All School Organizations'}
          </CardTitle>
          <CardDescription>
            {filteredOrganizations.length} organization{filteredOrganizations.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable 
            title={isSystemAdmin ? 'All Island Organizations' : 'All School Organizations'}
            columns={columns} 
            data={filteredOrganizations} 
            onView={handleViewOrganization} 
            onEdit={AccessControl.hasPermission(userRole as any, 'edit-grade') ? handleEditOrganization : undefined} 
            onDelete={AccessControl.hasPermission(userRole as any, 'delete-grade') ? handleDeleteOrganization : undefined} 
            onAdd={AccessControl.hasPermission(userRole as any, 'create-grade') ? handleCreateOrganization : undefined} 
            searchPlaceholder={`Search ${isSystemAdmin ? 'island organizations' : 'organizations'}...`}
            allowAdd={AccessControl.hasPermission(userRole as any, 'create-grade')} 
            allowEdit={AccessControl.hasPermission(userRole as any, 'edit-grade')} 
            allowDelete={AccessControl.hasPermission(userRole as any, 'delete-grade')} 
          />
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        itemName={deleteDialog.orgName}
        itemType="organization"
        onConfirm={confirmDeleteOrganization}
      />
    </div>
  );
};

export default Grades;
