import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserCheck, UserX, AlertCircle } from 'lucide-react';
import { organizationApi } from '@/api/organization.api';
import { useToast } from '@/hooks/use-toast';

interface OrganizationUnverifiedMembersProps {
  organizationId: string;
  userRole?: string;
}

interface UnverifiedMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  enrolledAt: any;
}

interface UnverifiedMembersResponse {
  unverifiedMembers: UnverifiedMember[];
  totalUnverified: number;
  status: string;
}

const OrganizationUnverifiedMembers = ({ organizationId, userRole }: OrganizationUnverifiedMembersProps) => {
  const [unverifiedData, setUnverifiedData] = useState<UnverifiedMembersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingUsers, setVerifyingUsers] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchUnverifiedMembers = async () => {
    try {
      setLoading(true);
      const response = await organizationApi.getUnverifiedMembers(organizationId);
      setUnverifiedData(response);
    } catch (error: any) {
      console.error('Error fetching unverified members:', error);
      toast({
        title: "Error",
        description: "Failed to load unverified members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMember = async (userId: string, isVerified: boolean) => {
    if (!userRole || !['PRESIDENT', 'ADMIN', 'OrganizationManager'].includes(userRole)) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to verify members",
        variant: "destructive",
      });
      return;
    }

    try {
      setVerifyingUsers(prev => new Set(prev).add(userId));
      
      await organizationApi.verifyMember(organizationId, {
        userId,
        isVerified
      });

      toast({
        title: isVerified ? "Member Approved" : "Member Rejected",
        description: isVerified 
          ? "The member has been successfully verified and approved"
          : "The member has been rejected",
        variant: isVerified ? "default" : "destructive",
      });

      // Refresh the unverified members list
      await fetchUnverifiedMembers();
    } catch (error: any) {
      console.error('Error verifying member:', error);
      toast({
        title: "Error",
        description: "Failed to verify member. Please try again.",
        variant: "destructive",
      });
    } finally {
      setVerifyingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    fetchUnverifiedMembers();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!unverifiedData || unverifiedData.totalUnverified === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <UserCheck className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">All Members Verified</h3>
          <p className="text-gray-600 dark:text-gray-400 text-center">
            There are no unverified members waiting for approval.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-orange-500" />
            Unverified Members ({unverifiedData.totalUnverified})
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Members waiting for verification approval
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="border-orange-200 dark:border-orange-800">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-full">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Pending Verifications</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {unverifiedData.totalUnverified} member{unverifiedData.totalUnverified !== 1 ? 's' : ''} waiting for approval
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{unverifiedData.totalUnverified}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Unverified</p>
          </div>
        </CardContent>
      </Card>

      {/* Unverified Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-orange-500" />
            Unverified Members ({unverifiedData.totalUnverified})
          </CardTitle>
          <CardDescription>
            Members who have enrolled but are awaiting verification
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Name</TableHead>
                <TableHead className="hidden sm:table-cell min-w-[200px]">Email</TableHead>
                <TableHead className="min-w-[80px]">Role</TableHead>
                <TableHead className="hidden md:table-cell min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unverifiedData.unverifiedMembers.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {member.name || 'No Name Provided'}
                      </div>
                      <div className="text-xs text-gray-500 truncate">ID: {member.userId}</div>
                      <div className="sm:hidden text-xs text-gray-500 truncate">{member.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="truncate max-w-[200px]">{member.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {member.role}
                    </Badge>
                    <div className="md:hidden mt-1">
                      <Badge variant="secondary" className="text-xs">
                        Unverified
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <AlertCircle className="h-3 w-3" />
                      Unverified
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                        onClick={() => handleVerifyMember(member.userId, true)}
                        disabled={verifyingUsers.has(member.userId) || !['PRESIDENT', 'ADMIN', 'OrganizationManager'].includes(userRole || '')}
                      >
                        <UserCheck className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">
                          {verifyingUsers.has(member.userId) ? "Approving..." : "Approve"}
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => handleVerifyMember(member.userId, false)}
                        disabled={verifyingUsers.has(member.userId) || !['PRESIDENT', 'ADMIN', 'OrganizationManager'].includes(userRole || '')}
                      >
                        <UserX className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">
                          {verifyingUsers.has(member.userId) ? "Rejecting..." : "Reject"}
                        </span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizationUnverifiedMembers;