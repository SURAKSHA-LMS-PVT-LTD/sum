import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, Search, Filter, Eye, EyeOff, Users, BookOpen, Plus, UserPlus, LayoutGrid, List } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { organizationApi, Organization, OrganizationQueryParams } from '@/api/organization.api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import OrganizationDetails from './OrganizationDetails';
import CreateOrganizationForm from './forms/CreateOrganizationForm';
import EnrollOrganizationDialog from './EnrollOrganizationDialog';
import OrganizationCard from './OrganizationCard';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';

interface OrganizationManagementProps {
  userRole: string;
  userPermissions?: any;
  currentInstituteId?: string;
}

const OrganizationManagement = ({ userRole, userPermissions, currentInstituteId }: OrganizationManagementProps) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [publicFilter, setPublicFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEnrollmentView, setShowEnrollmentView] = useState(false);
  const [enrollmentOrganizations, setEnrollmentOrganizations] = useState<Organization[]>([]);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [enrollmentViewMode, setEnrollmentViewMode] = useState<'card' | 'table'>(() =>
    (localStorage.getItem('viewMode') as 'card' | 'table') || 'card'
  );
  const [enrollmentSearchTerm, setEnrollmentSearchTerm] = useState('');
  const [enrollmentCurrentPage, setEnrollmentCurrentPage] = useState(1);
  const [enrollmentTotalPages, setEnrollmentTotalPages] = useState(1);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedEnrollOrganization, setSelectedEnrollOrganization] = useState<Organization | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; organization: Organization | null; isDeleting: boolean }>({ open: false, organization: null, isDeleting: false });
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      
      const params: OrganizationQueryParams = {
        page: currentPage,
        limit: 10,
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter !== 'all' && { type: typeFilter as 'INSTITUTE' | 'GLOBAL' }),
        ...(publicFilter !== 'all' && { isPublic: publicFilter === 'public' }),
        userId: user?.id,
        role: userRole || 'User'
      };

      let response;
      if (userRole === 'OrganizationManager') {
        response = await organizationApi.getOrganizations(params);
      } else if (currentInstituteId) {
        response = await organizationApi.getInstituteOrganizations(currentInstituteId, params);
      } else {
        response = await organizationApi.getUserEnrolledOrganizations(params);
      }
      
      setOrganizations(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch (error: any) {
      console.error('Error fetching organizations:', error);
      toast({
        title: "Error",
        description: "Failed to load organizations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = () => {
    setShowCreateForm(true);
  };

  const handleCreateSuccess = (organization: any) => {
    console.log('Organization created successfully:', organization);
    setShowCreateForm(false);
    fetchOrganizations(); // Refresh the list
    toast({
      title: "Success",
      description: "Organization created successfully",
    });
  };

  const handleCreateCancel = () => {
    setShowCreateForm(false);
  };

  useEffect(() => {
    fetchOrganizations();
  }, [currentPage, searchTerm, typeFilter, publicFilter, userRole, currentInstituteId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchOrganizations();
  };

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setPublicFilter('all');
    setCurrentPage(1);
  };

  const handleSelectOrganization = (organization: Organization) => {
    setSelectedOrganization(organization);
  };

  const handleBackToList = () => {
    setSelectedOrganization(null);
  };

  const canEnrollInOrganizations = () => {
    return ['Student', 'Teacher', 'InstituteAdmin'].includes(userRole);
  };

  const fetchEnrollmentOrganizations = async () => {
    try {
      setEnrollmentLoading(true);
      
      const params: OrganizationQueryParams = {
        page: enrollmentCurrentPage,
        limit: 10,
        ...(enrollmentSearchTerm && { search: enrollmentSearchTerm }),
        userId: user?.id,
        role: userRole || 'User'
      };

      const response = await organizationApi.getOrganizations(params);
      setEnrollmentOrganizations(response.data);
      setEnrollmentTotalPages(response.pagination.totalPages);
    } catch (error: any) {
      console.error('Error fetching enrollment organizations:', error);
      toast({
        title: "Error",
        description: "Failed to load organizations for enrollment",
        variant: "destructive",
      });
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const handleEnrollOrganization = (organization: Organization) => {
    setSelectedEnrollOrganization(organization);
    setEnrollDialogOpen(true);
  };

  const handleEnrollmentSuccess = () => {
    fetchEnrollmentOrganizations(); // Refresh the list
  };

  const handleDeleteOrganization = (organization: Organization) => {
    setDeleteDialog({ open: true, organization, isDeleting: false });
  };

  const confirmDeleteOrganization = async () => {
    if (!deleteDialog.organization) return;
    setDeleteDialog(prev => ({ ...prev, isDeleting: true }));
    try {
      await organizationApi.deleteOrganization(deleteDialog.organization.organizationId);
      toast({
        title: "Success",
        description: "Organization deleted successfully",
      });
      setDeleteDialog({ open: false, organization: null, isDeleting: false });
      fetchOrganizations();
    } catch (error: any) {
      console.error('Error deleting organization:', error);
      toast({
        title: "Error",
        description: "Failed to delete organization",
        variant: "destructive",
      });
      setDeleteDialog(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const canDeleteOrganization = (organization: Organization) => {
    return organization.userRole === 'PRESIDENT' || userRole === 'OrganizationManager';
  };

  const handleShowEnrollment = () => {
    setShowEnrollmentView(true);
    fetchEnrollmentOrganizations();
  };

  const handleBackFromEnrollment = () => {
    setShowEnrollmentView(false);
    setEnrollmentSearchTerm('');
    setEnrollmentCurrentPage(1);
  };

  useEffect(() => {
    if (showEnrollmentView) {
      fetchEnrollmentOrganizations();
    }
  }, [enrollmentCurrentPage, enrollmentSearchTerm, showEnrollmentView]);

  if (showCreateForm) {
    return (
      <CreateOrganizationForm
        onSuccess={handleCreateSuccess}
        onCancel={handleCreateCancel}
      />
    );
  }

  if (selectedOrganization) {
    return (
      <OrganizationDetails
        organization={selectedOrganization}
        userRole={userRole}
        onBack={handleBackToList}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getHeaderInfo = () => {
    switch (userRole) {
      case 'OrganizationManager':
        return {
          title: 'Organizations',
          description: 'Manage all organizations in the system'
        };
      case 'InstituteAdmin':
      case 'Student':
      case 'Teacher':
        return {
          title: 'Organizations',
          description: 'View organizations in your institute'
        };
      default:
        return {
          title: 'Organizations',
          description: 'Browse available organizations'
        };
    }
  };

  const headerInfo = getHeaderInfo();

  // Enrollment View Component
  if (showEnrollmentView) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Enroll in Organizations</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Browse and enroll in available organizations
            </p>
          </div>
          <Button onClick={handleBackFromEnrollment} variant="outline">
            Back to Organizations
          </Button>
        </div>

        {/* Search and View Mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search organizations..."
                value={enrollmentSearchTerm}
                onChange={(e) => setEnrollmentSearchTerm(e.target.value)}
                className="pl-10 w-80"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={enrollmentViewMode === 'card' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEnrollmentViewMode('card')}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Cards
            </Button>
            <Button
              variant={enrollmentViewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEnrollmentViewMode('table')}
            >
              <List className="h-4 w-4 mr-1" />
              Table
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {enrollmentLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Content */}
        {!enrollmentLoading && (
          <>
            {enrollmentViewMode === 'card' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
                {enrollmentOrganizations.map((organization) => (
                  <OrganizationCard
                    key={organization.organizationId}
                    organization={organization}
                    onSelect={handleEnrollOrganization}
                    buttonText="Enroll"
                    buttonIcon={<UserPlus className="h-4 w-4" />}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Available Organizations</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Visibility</TableHead>
                        <TableHead>Institute ID</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrollmentOrganizations.map((organization) => (
                        <TableRow key={organization.organizationId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">{organization.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{organization.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={organization.isPublic ? "default" : "secondary"}>
                              {organization.isPublic ? 'Public' : 'Private'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {organization.instituteId || '-'}
                          </TableCell>
                          <TableCell>
                          <Button 
                            onClick={() => handleEnrollOrganization(organization)}
                            size="sm"
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Enroll
                          </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Pagination */}
            {enrollmentTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEnrollmentCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={enrollmentCurrentPage === 1}
                >
                  Previous
                </Button>
                
                <span className="text-sm text-gray-600">
                  Page {enrollmentCurrentPage} of {enrollmentTotalPages}
                </span>
                
                <Button
                  variant="outline"
                  onClick={() => setEnrollmentCurrentPage(prev => Math.min(prev + 1, enrollmentTotalPages))}
                  disabled={enrollmentCurrentPage === enrollmentTotalPages}
                >
                  Next
                </Button>
              </div>
            )}

            {enrollmentOrganizations.length === 0 && !enrollmentLoading && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building2 className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Organizations Found</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-center">
                    {enrollmentSearchTerm
                      ? 'No organizations match your search term.'
                      : 'No organizations available for enrollment.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Enrollment Dialog */}
        {selectedEnrollOrganization && (
          <EnrollOrganizationDialog
            open={enrollDialogOpen}
            onOpenChange={setEnrollDialogOpen}
            organizationId={selectedEnrollOrganization.organizationId}
            organizationName={selectedEnrollOrganization.name}
            organizationType={selectedEnrollOrganization.type}
            onEnrollmentSuccess={handleEnrollmentSuccess}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{headerInfo.title}</h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {headerInfo.description}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {canEnrollInOrganizations() && (
            <Button onClick={handleShowEnrollment} className="flex items-center gap-2 w-full sm:w-auto">
              <UserPlus className="h-4 w-4" />
              Enroll Organization
            </Button>
          )}
          {userRole === 'OrganizationManager' && (
            <Button onClick={handleCreateOrganization} className="flex items-center gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Organization</span>
              <span className="sm:hidden">Create</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search organizations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="INSTITUTE">Institute</SelectItem>
                    <SelectItem value="GLOBAL">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Visibility</label>
                <Select value={publicFilter} onValueChange={setPublicFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 flex items-end">
                <div className="flex gap-2 w-full">
                  <Button type="submit" className="flex-1">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Organizations Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
        {organizations.map((organization) => (
          <OrganizationCard
            key={organization.organizationId}
            organization={organization}
            onSelect={handleSelectOrganization}
            onDelete={handleDeleteOrganization}
            showDeleteButton={canDeleteOrganization(organization)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {organizations.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Organizations Found</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              {searchTerm || typeFilter !== 'all' || publicFilter !== 'all'
                ? 'No organizations match your current filters.'
                : 'No organizations available at the moment.'}
            </p>
          </CardContent>
        </Card>
      )}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        itemName={deleteDialog.organization?.name || ''}
        itemType="organization"
        onConfirm={confirmDeleteOrganization}
        isDeleting={deleteDialog.isDeleting}
      />
    </div>
  );
};

export default OrganizationManagement;
