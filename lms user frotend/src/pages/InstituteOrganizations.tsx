import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, RefreshCw, Plus, UserPlus, Eye, Key } from 'lucide-react';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useTableData } from '@/hooks/useTableData';
import MUITable from '@/components/ui/mui-table';
import CreateOrganizationForm from '@/components/forms/CreateOrganizationForm';
import AddOrganizationUserDialog from '@/components/forms/AddOrganizationUserDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { organizationApi } from '@/api/organization.api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast as sonnerToast } from 'sonner';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';

interface Organization {
  organizationId: string;
  name: string;
  type: string;
  isPublic: boolean;
  imageUrl: string;
  instituteId: string;
  memberCount: number;
  causeCount: number;
  createdAt: string;
  institute: {
    instituteId: string;
    name: string;
    imageUrl: string;
  };
}

interface OrganizationMember {
  userId: string;
  studentIdByInstitute: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phoneNumber: string;
  imageUrl: string;
  role: string;
  status: string;
  enrolledDate: string;
}

// Safe image component that doesn't manipulate DOM directly
const ImageCell = ({ imageUrl, name, onImageClick }: { imageUrl: string; name: string; onImageClick?: (url: string, title: string) => void }) => {
  const [hasError, setHasError] = React.useState(false);
  
  if (!imageUrl || hasError) {
    return (
      <div className="flex items-center justify-center">
        <Building2 className="w-8 h-8 text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center">
      <img 
        src={getImageUrl(imageUrl)} 
        alt={name}
        className="w-10 h-10 rounded-md object-cover cursor-pointer hover:ring-2 hover:ring-primary transition-all"
        onError={() => setHasError(true)}
        onClick={() => onImageClick?.(getImageUrl(imageUrl), name)}
      />
    </div>
  );
};

const InstituteOrganizations = () => {
  const { user, selectedInstitute } = useAuth();
  const userRole = useInstituteRole();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [addUserDialog, setAddUserDialog] = useState<{ open: boolean; orgId: string; orgName: string }>({
    open: false,
    orgId: '',
    orgName: '',
  });

  const [viewMembersDialog, setViewMembersDialog] = useState<{ 
    open: boolean; 
    orgId: string; 
    orgName: string;
  }>({
    open: false,
    orgId: '',
    orgName: '',
  });

  const [enrollmentKeyDialog, setEnrollmentKeyDialog] = useState<{
    open: boolean;
    orgId: string;
    orgName: string;
    enrollmentKey: string;
    loading: boolean;
  }>({
    open: false,
    orgId: '',
    orgName: '',
    enrollmentKey: '',
    loading: false,
  });

  const [membersState, setMembersState] = useState<{
    data: OrganizationMember[];
    loading: boolean;
    error: string | null;
    page: number;
    limit: number;
    totalCount: number;
  }>({
    data: [],
    loading: false,
    error: null,
    page: 0,
    limit: 10,
    totalCount: 0,
  });

  // Image preview state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const { state, actions, pagination, availableLimits } = useTableData<Organization>({
    endpoint: `/organizations/institute/${selectedInstitute?.id}`,
    autoLoad: true, // Enable auto-load
    pagination: {
      defaultLimit: 10,
      availableLimits: [10, 25, 50]
    }
  });

  const loadMembers = async (orgId: string, page: number = 0, limit: number = 10, forceRefresh = false) => {
    if (!selectedInstitute) return;

    setMembersState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await enhancedCachedClient.get<{ data: OrganizationMember[]; meta: any }>(
        `/organizations/institute/${selectedInstitute.id}/organization/${orgId}/students`,
        { page: page + 1, limit },
        {
          ttl: CACHE_TTL.ORGANIZATION_MEMBERS,
          forceRefresh,
          userId: user?.id,
          role: userRole,
          instituteId: selectedInstitute.id
        }
      );

      setMembersState({
        data: response.data || [],
        loading: false,
        error: null,
        page,
        limit,
        totalCount: response.meta?.total || 0,
      });
    } catch (error: any) {
      console.error('Failed to load members:', error);
      setMembersState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load members',
      }));
      toast({
        title: 'Error',
        description: 'Failed to load organization members',
        variant: 'destructive',
      });
    }
  };

  const loadEnrollmentKey = async (orgId: string, orgName: string) => {
    setEnrollmentKeyDialog({ open: true, orgId, orgName, enrollmentKey: '', loading: true });

    try {
      const response = await organizationApi.getEnrollmentKey(orgId);
      setEnrollmentKeyDialog({
        open: true,
        orgId,
        orgName,
        enrollmentKey: response.enrollmentKey || 'N/A',
        loading: false,
      });
    } catch (error: any) {
      console.error('Failed to load enrollment key:', error);
      toast({
        title: 'Error',
        description: 'Failed to load enrollment key',
        variant: 'destructive',
      });
      setEnrollmentKeyDialog({ open: false, orgId: '', orgName: '', enrollmentKey: '', loading: false });
    }
  };

  const memberColumns = [
    {
      id: 'imageUrl',
      label: 'Photo',
      minWidth: 80,
      format: (_value: any, row: any) => (
        <Avatar className="h-10 w-10">
          <AvatarImage src={row.imageUrl} alt={row.name} />
          <AvatarFallback>{row.name?.charAt(0) || 'U'}</AvatarFallback>
        </Avatar>
      )
    },
    {
      id: 'userIdByInstitute',
      label: 'User ID',
      minWidth: 120,
    },
    {
      id: 'name',
      label: 'Name',
      minWidth: 180,
    },
    {
      id: 'email',
      label: 'Email',
      minWidth: 200,
    },
    {
      id: 'phoneNumber',
      label: 'Phone',
      minWidth: 140,
    },
    {
      id: 'instituteUserType',
      label: 'User Type',
      minWidth: 120,
      format: (_value: any, row: any) => (
        <Badge variant="outline">
          {row.instituteUserType}
        </Badge>
      )
    },
    {
      id: 'organizationRole',
      label: 'Org Role',
      minWidth: 100,
      format: (_value: any, row: any) => (
        <Badge variant={row.organizationRole === 'ADMIN' ? 'default' : 'secondary'}>
          {row.organizationRole}
        </Badge>
      )
    },
    {
      id: 'verificationStatus',
      label: 'Status',
      minWidth: 100,
      format: (_value: any, row: any) => (
        <Badge variant={row.verificationStatus === 'verified' ? 'default' : 'outline'}>
          {row.verificationStatus}
        </Badge>
      )
    }
  ];

  const columns = [
    {
      id: 'imageUrl',
      label: 'Image',
      minWidth: 100,
      format: (_value: any, row: any) => (
        <ImageCell imageUrl={row.imageUrl} name={row.name} onImageClick={(url, title) => setPreviewImage({ url, title })} />
      )
    },
    {
      id: 'organizationId',
      label: 'Organization ID',
      minWidth: 120,
    },
    {
      id: 'name',
      label: 'Organization Name',
      minWidth: 200,
    },
    {
      id: 'type',
      label: 'Type',
      minWidth: 120,
      format: (_value: any, row: any) => (
        <Badge variant="outline">{row.type}</Badge>
      )
    },
    {
      id: 'isPublic',
      label: 'Visibility',
      minWidth: 120,
      format: (_value: any, row: any) => (
        <Badge variant={row.isPublic ? 'default' : 'secondary'}>
          {row.isPublic ? 'Public' : 'Private'}
        </Badge>
      )
    },
    {
      id: 'instituteId',
      label: 'Institute ID',
      minWidth: 120,
    },
    {
      id: 'memberCount',
      label: 'Members',
      minWidth: 100,
      align: 'center' as const,
    },
    {
      id: 'causeCount',
      label: 'Causes',
      minWidth: 100,
      align: 'center' as const,
    },
    {
      id: 'enrollmentKey',
      label: 'Enrollment Key',
      minWidth: 150,
      align: 'center' as const,
      format: (_value: any, row: any) => (
        <Button
          size="sm"
          onClick={() => loadEnrollmentKey(row.organizationId, row.name)}
          style={{ backgroundColor: '#06923E' }}
          className="gap-1 hover:opacity-90"
        >
          <Key className="h-4 w-4" />
          View Key
        </Button>
      )
    },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 200,
      align: 'center' as const,
      format: (_value: any, row: any) => (
        <div className="flex gap-2 justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setViewMembersDialog({ open: true, orgId: row.organizationId, orgName: row.name });
              loadMembers(row.organizationId);
            }}
            className="gap-1"
          >
            <Eye className="h-4 w-4" />
            View Members
          </Button>
          <Button
            size="sm"
            onClick={() => setAddUserDialog({ open: true, orgId: row.organizationId, orgName: row.name })}
            className="gap-1"
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      )
    },
  ];

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
    actions.loadData(true); // Refresh the list
  };

  if (!selectedInstitute) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Institute Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please select an institute first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Institute Organizations</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Organizations for {selectedInstitute.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="gap-2 text-sm"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create Org</span>
            <span className="sm:hidden">Create</span>
          </Button>
          <Button 
            onClick={() => actions.loadData(true)}
            disabled={state.loading}
            className="gap-2 text-sm"
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{state.loading ? 'Refreshing...' : 'Refresh'}</span>
            <span className="sm:hidden">{state.loading ? 'Refreshing' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl mx-4">
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
          </DialogHeader>
          <CreateOrganizationForm
            instituteId={selectedInstitute.id}
            instituteName={selectedInstitute.name}
            onSuccess={handleCreateSuccess}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AddOrganizationUserDialog
        open={addUserDialog.open}
        onOpenChange={(open) => setAddUserDialog({ ...addUserDialog, open })}
        organizationId={addUserDialog.orgId}
        organizationName={addUserDialog.orgName}
        onSuccess={() => actions.loadData(true)}
      />

      <Dialog open={viewMembersDialog.open} onOpenChange={(open) => setViewMembersDialog({ ...viewMembersDialog, open })}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Members - {viewMembersDialog.orgName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <Card className="h-full flex flex-col border-0 shadow-none">
              <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                {membersState.loading && !membersState.data.length ? (
                  <div className="flex items-center justify-center p-8">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : membersState.error ? (
                  <div className="p-4 text-destructive">{membersState.error}</div>
                ) : (
                  <MUITable
                    title=""
                    columns={memberColumns}
                    data={membersState.data}
                    page={membersState.page}
                    rowsPerPage={membersState.limit}
                    totalCount={membersState.totalCount}
                    onPageChange={(newPage) => loadMembers(viewMembersDialog.orgId, newPage, membersState.limit)}
                    onRowsPerPageChange={(newLimit) => loadMembers(viewMembersDialog.orgId, 0, newLimit)}
                    rowsPerPageOptions={[10, 25, 50]}
                    allowAdd={false}
                    allowEdit={false}
                    allowDelete={false}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={enrollmentKeyDialog.open} onOpenChange={(open) => setEnrollmentKeyDialog({ ...enrollmentKeyDialog, open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Enrollment Code</DialogTitle>
          </DialogHeader>

          {enrollmentKeyDialog.loading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 mb-2">
                <p className="text-sm text-muted-foreground">Organization</p>
                <p className="text-lg font-semibold">{enrollmentKeyDialog.orgName}</p>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Class Enrollment Code</p>
                <p className="text-4xl font-bold tracking-tight">{enrollmentKeyDialog.enrollmentKey}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Enrollment Enabled</span>
                  <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Yes</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Requires Verification</span>
                  <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Yes</Badge>
                </div>
              </div>

              <Button 
                className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                onClick={() => {
                  navigator.clipboard.writeText(enrollmentKeyDialog.enrollmentKey);
                  sonnerToast.success('Enrollment code copied to clipboard!');
                }}
              >
                Copy Code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {state.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{state.error}</p>
          </CardContent>
        </Card>
      )}

      <Card className="flex-1 flex flex-col">
        <CardContent className="p-0 flex-1 flex flex-col">
          <MUITable
            title=""
            columns={columns}
            data={state.data}
            page={pagination.page}
            rowsPerPage={pagination.limit}
            totalCount={pagination.totalCount}
            onPageChange={actions.setPage}
            onRowsPerPageChange={actions.setLimit}
            rowsPerPageOptions={availableLimits}
            allowAdd={false}
            allowEdit={false}
            allowDelete={false}
          />
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{previewImage?.title}</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {previewImage && (
              <img 
                src={previewImage.url} 
                alt={previewImage.title}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstituteOrganizations;
