import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Crown, Shield, UserMinus, ArrowRightLeft, Loader2 } from "lucide-react";

interface Member {
  userId: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  joinedAt: string;
  imageUrl?: string;
}

interface Organization {
  organizationId: string;
  name: string;
  memberCount: number;
}

interface OrganizationMembersPanelProps {
  organization: Organization;
  onRefresh: () => void;
}

export function OrganizationMembersPanel({ organization, onRefresh }: OrganizationMembersPanelProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roleBreakdown, setRoleBreakdown] = useState<Record<string, number>>({});
  const [removeMemberDialog, setRemoveMemberDialog] = useState<Member | null>(null);
  const [transferDialog, setTransferDialog] = useState(false);
  const [selectedNewPresident, setSelectedNewPresident] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [organization.organizationId]);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const response = await api.getOrganizationMembers(organization.organizationId);
      setMembers(response.members || []);
      setRoleBreakdown(response.roleBreakdown || {});
    } catch (error) {
      console.error("Failed to fetch members:", error);
      toast({
        title: "Error",
        description: "Failed to load members",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setIsProcessing(true);
      await api.changeRole(organization.organizationId, { userId, newRole });
      toast({
        title: "Success",
        description: "Role updated successfully",
      });
      fetchMembers();
      onRefresh();
    } catch (error) {
      console.error("Failed to change role:", error);
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeMemberDialog) return;
    
    try {
      setIsProcessing(true);
      await api.removeUserFromOrganization(organization.organizationId, removeMemberDialog.userId);
      toast({
        title: "Success",
        description: "Member removed successfully",
      });
      setRemoveMemberDialog(null);
      fetchMembers();
      onRefresh();
    } catch (error) {
      console.error("Failed to remove member:", error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransferPresidency = async () => {
    if (!selectedNewPresident) return;
    
    try {
      setIsProcessing(true);
      await api.transferPresidency(organization.organizationId, selectedNewPresident);
      toast({
        title: "Success",
        description: "Presidency transferred successfully",
      });
      setTransferDialog(false);
      setSelectedNewPresident("");
      fetchMembers();
      onRefresh();
    } catch (error) {
      console.error("Failed to transfer presidency:", error);
      toast({
        title: "Error",
        description: "Failed to transfer presidency",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toUpperCase()) {
      case "PRESIDENT":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "ADMIN":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "MODERATOR":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const eligibleForPresident = members.filter(
    m => m.role !== "PRESIDENT" && m.isVerified
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Role Breakdown */}
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(roleBreakdown).map(([role, count]) => (
          <Card key={role}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {role === "PRESIDENT" && <Crown className="h-4 w-4 text-yellow-500" />}
                {role === "ADMIN" && <Shield className="h-4 w-4 text-purple-500" />}
                {role}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transfer Presidency Button */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Members ({members.length})
              </CardTitle>
              <CardDescription>Manage organization members and their roles</CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setTransferDialog(true)}
              disabled={eligibleForPresident.length === 0}
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Transfer Presidency
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {members.map((member) => (
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
                    <p className="text-xs text-muted-foreground">
                      Joined: {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {member.role === "PRESIDENT" ? (
                    <Badge className={getRoleBadgeColor(member.role)}>
                      <Crown className="h-3 w-3 mr-1" />
                      President
                    </Badge>
                  ) : (
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleRoleChange(member.userId, value)}
                      disabled={isProcessing}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Member</SelectItem>
                        <SelectItem value="MODERATOR">Moderator</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {member.role !== "PRESIDENT" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRemoveMemberDialog(member)}
                      disabled={isProcessing}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Remove Member Dialog */}
      <AlertDialog 
        open={!!removeMemberDialog} 
        onOpenChange={() => setRemoveMemberDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removeMemberDialog?.name} from {organization.name}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Presidency Dialog */}
      <Dialog open={transferDialog} onOpenChange={setTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Presidency</DialogTitle>
            <DialogDescription>
              Select a verified member to become the new president of {organization.name}.
              You will be demoted to Admin role.
            </DialogDescription>
          </DialogHeader>

          <Select
            value={selectedNewPresident}
            onValueChange={setSelectedNewPresident}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a member..." />
            </SelectTrigger>
            <SelectContent>
              {eligibleForPresident.map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {member.name} ({member.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransferPresidency}
              disabled={!selectedNewPresident || isProcessing}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transfer Presidency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
