
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Search, Users, Award, ArrowLeft, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { organizationApi, Organization } from '@/api/organization.api';
import { useAuth } from '@/contexts/AuthContext';

interface OrganizationSelectorProps {
  onOrganizationSelect?: (organization: Organization) => void;
  onBack?: () => void;
  onCreateOrganization?: () => void;
  userPermissions?: {
    organizations: string[];
    isGlobalAdmin: boolean;
  };
}

const OrganizationSelector = ({ 
  onOrganizationSelect, 
  onBack, 
  onCreateOrganization, 
  userPermissions 
}: OrganizationSelectorProps) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'INSTITUTE' | 'GLOBAL'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'PRESIDENT' | 'MEMBER'>('all');
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = useInstituteRole();

  useEffect(() => {
    filterOrganizations();
  }, [organizations, searchTerm, typeFilter, roleFilter]);

  const loadOrganizations = async () => {
    try {
      setIsLoading(true);
      const response = await organizationApi.getUserEnrolledOrganizations({
        page: 1,
        limit: 50,
        userId: user?.id,
        role: userRole || 'User'
      });
      setOrganizations(response.data);
      toast({
        title: "Organizations Loaded",
        description: `Successfully loaded ${response.data.length} organizations.`
      });
    } catch (error: any) {
      console.error('Error loading organizations:', error);
      toast({
        title: "Error",
        description: "Failed to load organizations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterOrganizations = () => {
    let filtered = organizations;

    if (searchTerm) {
      filtered = filtered.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(org => org.type === typeFilter);
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(org => org.userRole === roleFilter);
    }

    setFilteredOrganizations(filtered);
  };

  const handleOrganizationSelect = (organization: Organization) => {
    if (onOrganizationSelect) {
      onOrganizationSelect(organization);
    }
  };

  const getTypeColor = (type: string) => {
    return type === 'INSTITUTE' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  const getRoleColor = (role: string) => {
    return role === 'PRESIDENT' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="p-2 w-fit"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Select Organization</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Choose an organization to manage</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <Button 
              onClick={loadOrganizations} 
              disabled={isLoading}
              variant="outline"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 w-full sm:w-auto"
            >
              Load Organizations
            </Button>
            {/* Show create button only for organization managers */}
            {(user?.role === 'OrganizationManager' || userPermissions?.isGlobalAdmin) && onCreateOrganization && (
              <Button 
                onClick={onCreateOrganization} 
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Create Organization</span>
              </Button>
            )}
          </div>
        </div>

        {organizations.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No organizations loaded
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Click the button above to load your organizations
            </p>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search organizations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="INSTITUTE">Institute</SelectItem>
                  <SelectItem value="GLOBAL">Global</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={(value: any) => setRoleFilter(value)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="PRESIDENT">President</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Organizations Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredOrganizations.map((organization) => (
                <Card
                  key={organization.organizationId}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleOrganizationSelect(organization)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                          <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base sm:text-lg line-clamp-2">{organization.name}</CardTitle>
                          <CardDescription className="text-sm">
                            Joined: {new Date(organization.joinedAt!).toLocaleDateString()}
                          </CardDescription>
                        </div>
                      </div>
                      {organization.isVerified && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 w-fit flex-shrink-0">
                          Verified
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <Badge className={getTypeColor(organization.type)}>
                          {organization.type}
                        </Badge>
                        <Badge className={getRoleColor(organization.userRole!)}>
                          {organization.userRole}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm text-gray-600 dark:text-gray-400 gap-2">
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{organization.memberCount} members</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Award className="h-4 w-4" />
                          <span>{organization.causeCount} causes</span>
                        </div>
                      </div>
                      
                      {organization.isPublic && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 w-fit">
                          Public
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredOrganizations.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No organizations found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm || typeFilter !== 'all' || roleFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'You are not enrolled in any organizations yet'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OrganizationSelector;
