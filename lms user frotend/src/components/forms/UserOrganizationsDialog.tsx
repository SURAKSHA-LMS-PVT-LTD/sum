import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Calendar, Shield, AlertCircle } from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';

interface Organization {
  organizationId: string;
  name: string;
}

interface OrganizationEnrollment {
  organization: Organization;
  role: string;
  status: string;
  enrolledDate: string;
}

interface UserOrganizationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export default function UserOrganizationsDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: UserOrganizationsDialogProps) {
  const { toast } = useToast();
  const { currentInstituteId } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationEnrollment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && userId && currentInstituteId) {
      fetchOrganizations();
    }
  }, [open, userId, currentInstituteId]);

  const fetchOrganizations = async () => {
    if (!currentInstituteId || !userId) return;

    setLoading(true);
    try {
      const response = await apiClient.get<OrganizationEnrollment[]>(
        `/organizations/institute/${currentInstituteId}/student/${userId}`
      );
      setOrganizations(response || []);
    } catch (error: any) {
      console.error('Error fetching organizations:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to load organizations'),
        variant: 'destructive',
        duration: 2000,
      });
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange} routeName="user-organizations-dialog-popup">
      <DialogContent className="w-[95vw] max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">Organizations</p>
              <p className="text-sm text-muted-foreground font-normal mt-0.5">{userName}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              Loading organizations...
            </div>
          ) : organizations.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No organizations found</p>
              <p className="text-sm text-muted-foreground mt-1">
                This user is not enrolled in any organizations
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary row */}
              <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold text-primary">{organizations.length}</span>
                <span className="text-muted-foreground">organization{organizations.length !== 1 ? 's' : ''}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-green-600 dark:text-green-400">{organizations.filter((item) => item.status.toLowerCase() === 'verified').length} verified</span>
              </div>

              <div className="space-y-3">
              {organizations.map((enrollment, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-base leading-tight truncate">{enrollment.organization.name}</p>
                      <p className="text-[13px] font-mono text-muted-foreground mt-1 truncate">{enrollment.organization.organizationId}</p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(enrollment.status)} className="shrink-0">{enrollment.status}</Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t border-border/30">
                    <span className="flex items-center gap-1.5"><Shield className="h-4 w-4" /><Badge variant={getRoleBadgeVariant(enrollment.role)} className="text-xs px-2 py-0.5">{enrollment.role}</Badge></span>
                    <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />
                      {new Date(enrollment.enrolledDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
