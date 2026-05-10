import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Mail, Phone, User } from 'lucide-react';
import { useTableData } from '@/hooks/useTableData';
import { useAuth } from '@/contexts/AuthContext';
import UserOrganizationsDialog from './forms/UserOrganizationsDialog';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';

interface OrganizationStudentsProps {
  organizationId: string;
  userRole?: string;
}

interface OrganizationStudent {
  userId: string;
  userIdByInstitute: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phoneNumber: string;
  imageUrl: string | null;
  mainUserType: string;
  instituteUserType: string;
  organizationRole: string;
  verificationStatus: string;
}

const OrganizationStudents = ({ organizationId, userRole }: OrganizationStudentsProps) => {
  const { currentInstituteId } = useAuth();
  const [selectedUser, setSelectedUser] = React.useState<{ userId: string; userName: string } | null>(null);

  const { state, pagination, actions } = useTableData<OrganizationStudent>({
    endpoint: `/organizations/institute/${currentInstituteId}/organization/${organizationId}/students`,
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    autoLoad: true, // Enable auto-loading from cache
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toUpperCase()) {
      case 'ADMIN':
        return 'default';
      case 'MEMBER':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'verified':
        return 'default';
      case 'unverified':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getUserTypeBadgeVariant = (userType: string) => {
    switch (userType.toUpperCase()) {
      case 'INSTITUTE_ADMIN':
        return 'default';
      case 'TEACHER':
        return 'secondary';
      case 'STUDENT':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const allColumnDefs: ColumnDef[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      locked: true,
      defaultVisible: true,
      defaultWidth: 150,
      minWidth: 120,
      render: (_: any, row: OrganizationStudent) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{row.name}</div>
          <div className="text-xs text-muted-foreground truncate">{row.userIdByInstitute}</div>
        </div>
      )
    },
    {
      key: 'userIdByInstitute',
      header: 'User ID',
      defaultVisible: true,
      defaultWidth: 100,
      minWidth: 80,
      render: (_: any, row: OrganizationStudent) => (
        <div className="flex items-center gap-1">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{row.userIdByInstitute}</span>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      defaultVisible: true,
      defaultWidth: 200,
      minWidth: 140,
      render: (_: any, row: OrganizationStudent) => (
        <div className="flex items-center gap-1 truncate max-w-[200px]">
          <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-sm truncate">{row.email}</span>
        </div>
      )
    },
    {
      key: 'phoneNumber',
      header: 'Phone',
      defaultVisible: true,
      defaultWidth: 120,
      minWidth: 90,
      render: (_: any, row: OrganizationStudent) => (
        <div className="flex items-center gap-1">
          <Phone className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{row.phoneNumber}</span>
        </div>
      )
    },
    {
      key: 'instituteUserType',
      header: 'User Type',
      defaultVisible: true,
      defaultWidth: 100,
      minWidth: 80,
      render: (_: any, row: OrganizationStudent) => (
        <Badge variant={getUserTypeBadgeVariant(row.instituteUserType)} className="text-xs">
          {row.instituteUserType.replace('_', ' ')}
        </Badge>
      )
    },
    {
      key: 'organizationRole',
      header: 'Org Role',
      defaultVisible: true,
      defaultWidth: 80,
      minWidth: 60,
      render: (_: any, row: OrganizationStudent) => (
        <Badge variant={getRoleBadgeVariant(row.organizationRole)} className="text-xs">
          {row.organizationRole}
        </Badge>
      )
    },
    {
      key: 'verificationStatus',
      header: 'Status',
      defaultVisible: true,
      defaultWidth: 80,
      minWidth: 60,
      render: (_: any, row: OrganizationStudent) => (
        <Badge variant={getStatusBadgeVariant(row.verificationStatus)} className="text-xs">
          {row.verificationStatus}
        </Badge>
      )
    },
    {
      key: 'userId',
      header: 'System User ID',
      defaultVisible: false,
      defaultWidth: 160,
      minWidth: 100,
      render: (_: any, row: OrganizationStudent) => <span className="font-mono text-sm">{row.userId}</span>
    },
  ], []);

  const { colState, visibleColumns, toggleColumn, resetColumns } = useColumnConfig(allColumnDefs, 'org-students');

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">
            Members ({pagination.totalCount})
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Organization members enrolled from the institute
          </p>
        </div>
        <Button 
          onClick={() => actions.loadData(true)}
          disabled={state.loading}
          className="shrink-0"
        >
          <Users className="h-4 w-4 mr-2" />
          {state.loading ? 'Loading...' : 'Load Members'}
        </Button>
        <ColumnConfigurator
          allColumns={allColumnDefs}
          colState={colState}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members ({pagination.totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {state.data.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No members found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.map(col => (
                    <TableHead key={col.key} style={{ minWidth: col.minWidth }}>
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.data.map((student) => (
                  <TableRow 
                    key={student.userId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedUser({ userId: student.userId, userName: student.name })}
                  >
                    {visibleColumns.map(col => (
                      <TableCell key={col.key}>
                        {col.render ? col.render((student as any)[col.key], student) : (student as any)[col.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* User Organizations Dialog */}
      {selectedUser && (
        <UserOrganizationsDialog
          open={!!selectedUser}
          onOpenChange={(open) => !open && setSelectedUser(null)}
          userId={selectedUser.userId}
          userName={selectedUser.userName}
        />
      )}
    </div>
  );
};

export default OrganizationStudents;
