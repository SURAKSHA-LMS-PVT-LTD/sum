import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, RefreshCw, Users as UsersIcon, Search, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getBaseUrl } from '@/contexts/utils/auth.api';
import { DataCardView } from '@/components/ui/data-card-view';
import DataTable from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CreateUserForm from '@/components/forms/CreateUserForm';
import { cachedApiClient } from '@/api/cachedClient';
import { useApiRequest } from '@/hooks/useApiRequest';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  userType: string;
  dateOfBirth?: string;
  gender?: string;
  imageUrl?: string;
  telegramId?: string;
  rfid?: string;
  isActive: boolean;
  subscriptionPlan: string;
  paymentExpiresAt?: string;
  createdAt: string;
}

interface UsersResponse {
  data: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    previousPage: number | null;
    nextPage: number | null;
  };
}

const Users = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const limit = 10;
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [imagePreview, setImagePreview] = useState<{ isOpen: boolean; url: string; title: string }>({
    isOpen: false,
    url: '',
    title: ''
  });

  // Use API request hook for creating users with duplicate prevention
  const createUserRequest = useApiRequest(
    async (userData: any) => {
      console.log('Creating user with data:', userData);
      const response = await cachedApiClient.post('/users', userData);
      return response;
    },
    { preventDuplicates: true, showLoading: false }
  );

  // Use API request hook for fetching users
  const fetchUsersRequest = useApiRequest(
    async (page: number) => {
      console.log(`Fetching users with params: page=${page}&limit=${limit}`);
      const response = await cachedApiClient.get<UsersResponse>(
        '/users',
        { page: page.toString(), limit: limit.toString() },
        { ttl: 15, useStaleWhileRevalidate: true }
      );
      return response;
    },
    { preventDuplicates: true }
  );

  const fetchUsers = async (page = 1) => {
    try {
      const data = await fetchUsersRequest.execute(page);
      console.log('Users data received:', data);
      
      setUsers(data.data);
      setCurrentPage(data.meta.page);
      setTotalPages(data.meta.totalPages);
      setTotalUsers(data.meta.total);
      
      toast({
        title: "Users Loaded",
        description: `Successfully loaded ${data.data.length} users.`
      });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    }
  };

  const handleCreateUser = async (userData: any) => {
    try {
      console.log('Submitting user data with formatted date:', userData);
      
      await createUserRequest.execute(userData);
      
      toast({
        title: "Success",
        description: "User created successfully!",
      });
      
      setShowCreateForm(false);
      
      // Refresh users list after successful creation
      await fetchUsers(currentPage);
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Error", 
        description: "Failed to create user",
        variant: "destructive"
      });
    }
  };

  // Removed automatic API call - users must click Refresh to load data

  const allColumnDefs: ColumnDef[] = useMemo(() => [
    {
      key: 'name',
      header: 'User',
      locked: true,
      defaultVisible: true,
      defaultWidth: 240,
      minWidth: 180,
      render: (value: any, row: User) => (
        <div className="flex items-center space-x-3">
          <div 
            className="cursor-pointer flex-shrink-0"
            onClick={() => {
              if (row.imageUrl) {
                setImagePreview({ 
                  isOpen: true, 
                  url: row.imageUrl, 
                  title: `${row.firstName} ${row.lastName}` 
                });
              }
            }}
          >
            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 hover:opacity-80 transition-opacity">
              <AvatarImage src={row.imageUrl || ''} alt={`${row.firstName} ${row.lastName}`} />
              <AvatarFallback className="text-xs">
                {row.firstName.charAt(0)}{row.lastName.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{row.firstName} {row.lastName}</p>
            <p className="text-sm text-gray-500 truncate">{row.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'userType',
      header: 'Type',
      defaultVisible: true,
      defaultWidth: 120,
      minWidth: 80,
      render: (value: string) => (
        <Badge variant="outline">{value}</Badge>
      )
    },
    {
      key: 'phoneNumber',
      header: 'Phone',
      defaultVisible: true,
      defaultWidth: 150,
      minWidth: 110,
      render: (value: string) => value || 'N/A'
    },
    {
      key: 'email',
      header: 'Email',
      defaultVisible: false,
      defaultWidth: 200,
      minWidth: 140,
      render: (_: any, row: User) => <span className="text-sm truncate">{row.email || 'N/A'}</span>
    },
    {
      key: 'dateOfBirth',
      header: 'Date of Birth',
      defaultVisible: false,
      defaultWidth: 140,
      minWidth: 100,
      render: (_: any, row: User) => (
        <span className="text-sm">
          {row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
        </span>
      )
    },
    {
      key: 'gender',
      header: 'Gender',
      defaultVisible: false,
      defaultWidth: 100,
      minWidth: 80,
      render: (_: any, row: User) => <span className="text-sm">{row.gender || 'N/A'}</span>
    },
    {
      key: 'isActive',
      header: 'Status',
      defaultVisible: true,
      defaultWidth: 110,
      minWidth: 80,
      render: (value: boolean) => (
        <Badge variant={value ? 'default' : 'secondary'}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'createdAt',
      header: 'Created',
      defaultVisible: false,
      defaultWidth: 140,
      minWidth: 100,
      render: (_: any, row: User) => (
        <span className="text-sm">{new Date(row.createdAt).toLocaleDateString()}</span>
      )
    }
  ], []);

  const { colState, visibleColumns, toggleColumn, setColumnWidth, resetColumns } = useColumnConfig(allColumnDefs, 'users');

  const columnWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    for (const col of visibleColumns) {
      widths[col.key] = colState[col.key]?.width || col.defaultWidth || 180;
    }
    return widths;
  }, [visibleColumns, colState]);

  const tableColumns = useMemo(() =>
    visibleColumns.map(col => ({
      key: col.key,
      header: col.header,
      render: col.render,
    })),
    [visibleColumns]
  );

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesUserType = userTypeFilter === 'all' || user.userType === userTypeFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && user.isActive) || 
      (statusFilter === 'inactive' && !user.isActive);
    
    return matchesSearch && matchesUserType && matchesStatus;
  });

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Please log in to view users.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage system users and their roles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <UsersIcon className="h-4 w-4" />
            {totalUsers} Users
          </Badge>
          <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="md:hidden flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="md:hidden flex flex-col max-h-[80vh] rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Filter Users</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-4">
                <div className="space-y-4 px-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="TEACHER">Teacher</SelectItem>
                      <SelectItem value="STUDENT">Student</SelectItem>
                      <SelectItem value="PARENT">Parent</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setUserTypeFilter('all');
                      setStatusFilter('all');
                      setIsFilterSheetOpen(false);
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="hidden md:flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button 
            onClick={() => fetchUsers(currentPage)} 
            disabled={fetchUsersRequest.loading}
            variant="outline"
            size="sm"
          >
            {fetchUsersRequest.loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
          <Button onClick={() => setShowCreateForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      {/* Filter Section - Desktop Only */}
      {showFilters && (
        <ScrollAnimationWrapper animationType="slide-up" className="hidden md:block">
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filter Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="TEACHER">Teacher</SelectItem>
                  <SelectItem value="STUDENT">Student</SelectItem>
                  <SelectItem value="PARENT">Parent</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setUserTypeFilter('all');
                  setStatusFilter('all');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      </ScrollAnimationWrapper>
      )}
      {/* Users Table/Cards */}
      {filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <UsersIcon className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Users Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm || userTypeFilter !== 'all' || statusFilter !== 'all' 
                ? 'No users match your current filters.' 
                : 'No users have been created yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <DataTable
              title=""
              data={filteredUsers}
              columns={tableColumns}
              columnWidths={columnWidths}
              onColumnResize={setColumnWidth}
              headerExtra={
                <ColumnConfigurator
                  allColumns={allColumnDefs}
                  colState={colState}
                  onToggle={toggleColumn}
                  onReset={resetColumns}
                />
              }
              searchPlaceholder="Search users..."
              allowAdd={false}
              allowEdit={false}
              allowDelete={false}
            />
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden">
            <DataCardView
              data={filteredUsers}
              columns={tableColumns}
              allowEdit={false}
              allowDelete={false}
            />
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalUsers)} of {totalUsers} users
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchUsers(currentPage - 1)}
              disabled={currentPage === 1 || fetchUsersRequest.loading}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchUsers(currentPage + 1)}
              disabled={currentPage === totalPages || fetchUsersRequest.loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create User Form Dialog */}
      {showCreateForm && (
        <CreateUserForm
          onSubmit={handleCreateUser}
          onCancel={() => setShowCreateForm(false)}
          loading={createUserRequest.loading}
        />
      )}

      <ImagePreviewModal
        isOpen={imagePreview.isOpen}
        onClose={() => setImagePreview({ isOpen: false, url: '', title: '' })}
        imageUrl={imagePreview.url}
        title={imagePreview.title}
      />
    </div>
  );
};

export default Users;
