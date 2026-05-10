import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { systemAdminUserApi } from '@/api/systemAdminUser.api';
import { IncompleteProfile, ProfileCompletionStatus } from '@/types/user.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Mail, RefreshCw, ChevronLeft, ChevronRight, UserX } from 'lucide-react';

interface IncompleteProfilesListProps {
  onRefresh?: () => void;
}

export function IncompleteProfilesList({ onRefresh }: IncompleteProfilesListProps) {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<IncompleteProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  useEffect(() => {
    fetchProfiles();
  }, [page]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const result = await systemAdminUserApi.getIncompleteProfiles({
        page,
        limit,
      });
      setProfiles(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error: any) {
      console.error('Error fetching profiles:', error);
      toast({
        title: 'Error',
        description: 'Failed to load incomplete profiles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendWelcome = async (userId: string, email?: string) => {
    setResendingId(userId);
    try {
      await systemAdminUserApi.resendWelcomeNotification(userId);
      toast({
        title: 'Success',
        description: `Welcome notification resent to ${email || 'user'}`,
      });
    } catch (error: any) {
      console.error('Error resending notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to resend notification',
        variant: 'destructive',
      });
    } finally {
      setResendingId(null);
    }
  };

  const getStatusColor = (status: ProfileCompletionStatus) => {
    switch (status) {
      case ProfileCompletionStatus.COMPLETE:
        return 'bg-green-500';
      case ProfileCompletionStatus.BASIC:
        return 'bg-yellow-500';
      case ProfileCompletionStatus.INCOMPLETE:
      default:
        return 'bg-red-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Incomplete Profiles</CardTitle>
            <CardDescription>Users who need to complete their first login</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Total: {total} users</Badge>
            <Button variant="outline" size="sm" onClick={fetchProfiles}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UserX className="h-12 w-12 mb-4" />
              <p>No incomplete profiles found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {profile.firstName && profile.lastName
                              ? `${profile.firstName} ${profile.lastName}`
                              : profile.firstName || profile.lastName || 'Unnamed'}
                          </p>
                          <p className="text-xs text-muted-foreground">ID: {profile.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm">{profile.email}</p>
                          {profile.phoneNumber && (
                            <p className="text-xs text-muted-foreground">{profile.phoneNumber}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Progress value={profile.profileCompletionPercentage} className="h-2 w-20" />
                            <span className="text-sm font-medium">
                              {profile.profileCompletionPercentage}%
                            </span>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={`text-white ${getStatusColor(profile.profileCompletionStatus)}`}
                          >
                            {profile.profileCompletionStatus.replace('_', ' ')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {new Date(profile.createdAt).toLocaleDateString()}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendWelcome(profile.id, profile.email)}
                          disabled={resendingId === profile.id}
                        >
                          {resendingId === profile.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Mail className="h-4 w-4 mr-1" />
                              Resend Welcome
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} results
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
