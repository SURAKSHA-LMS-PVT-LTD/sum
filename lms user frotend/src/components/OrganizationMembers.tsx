
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users, UserPlus, Shield, Crown, UserMinus } from 'lucide-react';
import { organizationSpecificApi } from '@/api/organization.api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import AssignRoleDialog from './AssignRoleDialog';
import TransferPresidencyDialog from './forms/TransferPresidencyDialog';
import { OrganizationRoleManager, OrganizationRole } from '@/utils/organizationRoles';

interface OrganizationMembersProps {
  organizationId: string;
  userRole?: string;
}

interface Member {
  userId: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  joinedAt: any;
}

interface MembersResponse {
  members: Member[];
  totalMembers: number;
  roleBreakdown: Record<string, number>;
}

const OrganizationMembers = ({ organizationId, userRole }: OrganizationMembersProps) => {
  const [membersData, setMembersData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssignRoleDialog, setShowAssignRoleDialog] = useState(false);
  const [showTransferPresidencyDialog, setShowTransferPresidencyDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await organizationSpecificApi.get<MembersResponse>(
        `/organizations/${organizationId}/members`
      );
      setMembersData(response);
    } catch (error: any) {
      console.error('Error fetching members:', error);
      toast({
        title: "Error",
        description: "Failed to load organization members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [organizationId]);

  const handleAssignRole = (member: Member) => {
    setSelectedMember(member);
    setShowAssignRoleDialog(true);
  };

  const handleAssignRoleSuccess = () => {
    setShowAssignRoleDialog(false);
    setSelectedMember(null);
    fetchMembers(); // Refresh the members list
  };

  const handleTransferPresidencySuccess = () => {
    setShowTransferPresidencyDialog(false);
    fetchMembers(); // Refresh the members list
  };

  const handleRemoveMember = (member: Member) => {
    setSelectedMember(member);
    setShowRemoveDialog(true);
  };

  const handleRemoveConfirm = async () => {
    if (!selectedMember || isRemoving) return;
    
    try {
      setIsRemoving(true);
      await organizationSpecificApi.removeUserFromOrganization(organizationId, {
        userId: selectedMember.userId
      });
      
      toast({
        title: "Success",
        description: `${selectedMember.name} has been removed from the organization`,
      });
      
      setShowRemoveDialog(false);
      setSelectedMember(null);
      fetchMembers(); // Refresh the members list
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove member from organization",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const getCurrentPresidentId = () => {
    return membersData?.members.find(member => member.role === 'PRESIDENT')?.userId;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'PRESIDENT':
        return 'default';
      case 'ADMIN':
        return 'destructive';
      case 'MODERATOR':
        return 'secondary';
      case 'MEMBER':
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!membersData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Members Data</h3>
          <p className="text-gray-600 dark:text-gray-400 text-center">
            Unable to load organization members at the moment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Members ({membersData.totalMembers})</h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            All organization members and their current roles
          </p>
        </div>
        {(userRole === 'PRESIDENT' || user?.role === 'OrganizationManager') && (
          <Button
            variant="outline"
            onClick={() => setShowTransferPresidencyDialog(true)}
            className="flex items-center gap-2"
          >
            <Crown className="h-4 w-4" />
            Transfer Presidency
          </Button>
        )}
      </div>

      {/* Role Breakdown Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {Object.entries(membersData.roleBreakdown).map(([role, count]) => (
          <Card key={role}>
            <CardContent className="flex items-center justify-between p-3 md:p-4">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{role}</p>
                <p className="text-lg sm:text-2xl font-bold">{count}</p>
              </div>
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members ({membersData.totalMembers})
          </CardTitle>
          <CardDescription>
            All organization members and their current roles
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Name</TableHead>
                <TableHead className="hidden sm:table-cell min-w-[200px]">Email</TableHead>
                <TableHead className="min-w-[80px]">Role</TableHead>
                <TableHead className="hidden md:table-cell min-w-[80px]">Status</TableHead>
                {(user?.role === 'OrganizationManager' || userRole === 'ADMIN' || userRole === 'PRESIDENT') && <TableHead className="min-w-[160px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersData.members.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{member.name}</div>
                      <div className="text-xs text-gray-500 truncate">ID: {member.userId}</div>
                      <div className="sm:hidden text-xs text-gray-500 truncate">{member.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="truncate max-w-[200px]">{member.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(member.role)} className="text-xs">
                      {member.role}
                    </Badge>
                    <div className="md:hidden mt-1">
                      <Badge variant={member.isVerified ? "default" : "secondary"} className="text-xs">
                        {member.isVerified ? "Verified" : "Pending"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={member.isVerified ? "default" : "secondary"}>
                      {member.isVerified ? "Verified" : "Pending"}
                    </Badge>
                  </TableCell>
                  {(user?.role === 'OrganizationManager' || userRole === 'ADMIN' || userRole === 'PRESIDENT') && (
                    <TableCell>
                      <div className="flex gap-2">
                        {OrganizationRoleManager.canManageUser(userRole || '', user?.role || '', member.role as OrganizationRole) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAssignRole(member)}
                            className="flex-1 sm:flex-none"
                          >
                            <UserPlus className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Assign Role</span>
                          </Button>
                        )}
                        {OrganizationRoleManager.canRemoveUser(
                          userRole || '', 
                          user?.role || '', 
                          member.role as OrganizationRole, 
                          user?.id || '', 
                          member.userId
                        ) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveMember(member)}
                            className="flex-1 sm:flex-none text-destructive hover:text-destructive"
                          >
                            <UserMinus className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Remove</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assign Role Dialog */}
      {selectedMember && (
        <AssignRoleDialog
          open={showAssignRoleDialog}
          onOpenChange={setShowAssignRoleDialog}
          member={selectedMember}
          organizationId={organizationId}
          onSuccess={handleAssignRoleSuccess}
          currentUserRole={userRole}
        />
      )}

      {/* Transfer Presidency Dialog */}
      {membersData && (
        <TransferPresidencyDialog
          open={showTransferPresidencyDialog}
          onOpenChange={setShowTransferPresidencyDialog}
          organizationId={organizationId}
          members={membersData.members}
          currentPresidentId={getCurrentPresidentId()}
          onSuccess={handleTransferPresidencySuccess}
        />
      )}

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={(open) => !isRemoving && setShowRemoveDialog(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{selectedMember?.name}</strong> from this organization? 
              This action cannot be undone and they will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? 'Removing...' : 'Remove Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrganizationMembers;
