import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock, UserCheck, UserX, Loader2, CheckCircle2 } from "lucide-react";

interface UnverifiedMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  enrolledAt: string;
  imageUrl?: string;
}

interface Organization {
  organizationId: string;
  name: string;
  pendingMemberCount?: number;
}

interface OrganizationPendingPanelProps {
  organization: Organization;
  onRefresh: () => void;
}

export function OrganizationPendingPanel({ organization, onRefresh }: OrganizationPendingPanelProps) {
  const { toast } = useToast();
  const [pendingMembers, setPendingMembers] = useState<UnverifiedMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPendingMembers();
  }, [organization.organizationId]);

  const fetchPendingMembers = async () => {
    try {
      setIsLoading(true);
      const response = await api.getUnverifiedMembers(organization.organizationId);
      setPendingMembers(response.unverifiedMembers || []);
    } catch (error) {
      console.error("Failed to fetch pending members:", error);
      toast({
        title: "Error",
        description: "Failed to load pending members",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (userId: string) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(userId));
      await api.verifyMember(organization.organizationId, userId);
      toast({
        title: "Success",
        description: "Member verified successfully",
      });
      fetchPendingMembers();
      onRefresh();
    } catch (error) {
      console.error("Failed to verify member:", error);
      toast({
        title: "Error",
        description: "Failed to verify member",
        variant: "destructive",
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleReject = async (userId: string) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(userId));
      await api.removeUserFromOrganization(organization.organizationId, userId);
      toast({
        title: "Success",
        description: "Enrollment request rejected",
      });
      fetchPendingMembers();
      onRefresh();
    } catch (error) {
      console.error("Failed to reject member:", error);
      toast({
        title: "Error",
        description: "Failed to reject enrollment",
        variant: "destructive",
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleVerifyAll = async () => {
    for (const member of pendingMembers) {
      await handleVerify(member.userId);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Verifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-9 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (pendingMembers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
          <CardTitle className="mb-2">All Caught Up!</CardTitle>
          <CardDescription>No pending enrollment requests for {organization.name}</CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Verifications ({pendingMembers.length})
            </CardTitle>
            <CardDescription>
              Review and verify enrollment requests for {organization.name}
            </CardDescription>
          </div>
          {pendingMembers.length > 1 && (
            <Button onClick={handleVerifyAll} disabled={processingIds.size > 0}>
              <UserCheck className="h-4 w-4 mr-2" />
              Verify All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {pendingMembers.map((member) => {
            const isProcessing = processingIds.has(member.userId);
            
            return (
              <div
                key={member.userId}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.imageUrl} />
                    <AvatarFallback>
                      {member.name?.charAt(0)?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Enrolled: {new Date(member.enrolledAt).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReject(member.userId)}
                    disabled={isProcessing}
                    className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserX className="h-4 w-4 mr-1" />
                        Reject
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleVerify(member.userId)}
                    disabled={isProcessing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 mr-1" />
                        Verify
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
