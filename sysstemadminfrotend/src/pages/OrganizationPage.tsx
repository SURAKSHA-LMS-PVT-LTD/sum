import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader, ActionButton } from "@/components/shared/PageComponents";
import { Building, Users, Clock, Settings, Plus, Eye, Trash2, UserCheck, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { DataTable, Column, PaginationMeta } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateOrganizationForm } from "@/components/forms/CreateOrganizationForm";
import { OrganizationMembersPanel } from "@/components/organization/OrganizationMembersPanel";
import { OrganizationPendingPanel } from "@/components/organization/OrganizationPendingPanel";
import { OrganizationSettingsPanel } from "@/components/organization/OrganizationSettingsPanel";
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

interface Organization {
  organizationId: string;
  name: string;
  type: string;
  isPublic: boolean;
  enrollmentKey?: string;
  needEnrollmentVerification: boolean;
  enabledEnrollments: boolean;
  imageUrl?: string;
  instituteId?: string;
  instituteName?: string;
  memberCount: number;
  causeCount: number;
  verifiedMemberCount?: number;
  pendingMemberCount?: number;
  createdAt: string;
  updatedAt: string;
  userRole?: string;
  isEnrolled?: boolean;
  enrollmentStatus?: string;
  canManage?: boolean;
  canDelete?: boolean;
}

export default function OrganizationPage() {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, [page, limit]);

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true);
      const response = await api.getOrganizations({ page, limit });
      setOrganizations(response.data || []);
      if (response.meta) {
        setPagination({
          page: response.meta.page,
          limit: response.meta.limit,
          total: response.meta.total,
          totalPages: response.meta.totalPages,
          hasNext: response.meta.hasNext,
          hasPrev: response.meta.hasPrev,
        });
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
      toast({
        title: "Error",
        description: "Failed to load organizations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrganization = () => {
    setCreateDialogOpen(true);
  };

  const handleView = (org: Organization) => {
    setSelectedOrg(org);
    setViewDialogOpen(true);
  };

  const handleManage = (org: Organization) => {
    setSelectedOrg(org);
    setActiveTab("members");
  };

  const handleDeleteClick = (org: Organization) => {
    setOrgToDelete(org);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!orgToDelete) return;
    
    try {
      await api.deleteOrganization(orgToDelete.organizationId);
      toast({
        title: "Success",
        description: "Organization deleted successfully",
      });
      fetchOrganizations();
      setDeleteDialogOpen(false);
      setOrgToDelete(null);
    } catch (error) {
      console.error("Failed to delete organization:", error);
      toast({
        title: "Error",
        description: "Failed to delete organization. Only the President can delete an organization.",
        variant: "destructive",
      });
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleImageClick = (imageUrl: string) => {
    setImagePreview(imageUrl);
  };

  const getTypeColor = (type: string) => {
    switch (type?.toUpperCase()) {
      case "INSTITUTE":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "GLOBAL":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "CLUB":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "DEPARTMENT":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const columns: Column[] = [
    { key: "imageUrl", label: "Logo", type: "image" },
    { key: "organizationId", label: "ID" },
    { key: "name", label: "Name" },
    { 
      key: "type", 
      label: "Type",
      render: (value) => (
        <Badge className={getTypeColor(value)} variant="secondary">
          {value || "N/A"}
        </Badge>
      ),
    },
    { 
      key: "isPublic", 
      label: "Visibility",
      render: (value) => (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? "Public" : "Private"}
        </Badge>
      ),
    },
    { key: "memberCount", label: "Members" },
    { key: "instituteName", label: "Institute" },
    {
      key: "actions",
      label: "Manage",
      render: (_, row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleManage(row as Organization);
            }}
          >
            <Users className="w-4 h-4 mr-1" />
            Manage
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row as Organization);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Stats
  const totalOrgs = pagination?.total || organizations.length;
  const publicOrgs = organizations.filter(o => o.isPublic).length;
  const privateOrgs = organizations.filter(o => !o.isPublic).length;

  return (
    <DashboardLayout>
      <PageHeader
        title="Organizations"
        description="Manage organizations and their members"
        icon={Building}
        actions={
          <ActionButton label="Create Organization" onClick={handleCreateOrganization} />
        }
      />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2" disabled={!selectedOrg}>
            <Users className="w-4 h-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2" disabled={!selectedOrg}>
            <Clock className="w-4 h-4" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2" disabled={!selectedOrg}>
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrgs}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Public</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{publicOrgs}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Private</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{privateOrgs}</div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Org Info */}
          {selectedOrg && (
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Crown className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle>Currently Managing: {selectedOrg.name}</CardTitle>
                      <CardDescription>
                        {selectedOrg.memberCount} members • {selectedOrg.type}
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedOrg(null)}>
                    Clear Selection
                  </Button>
                </div>
              </CardHeader>
            </Card>
          )}

          <DataTable
            columns={columns}
            data={organizations}
            isLoading={isLoading}
            onView={handleView}
            pagination={pagination || undefined}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            onImageClick={handleImageClick}
          />
        </TabsContent>

        <TabsContent value="members">
          {selectedOrg ? (
            <OrganizationMembersPanel 
              organization={selectedOrg} 
              onRefresh={fetchOrganizations}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select an organization from the Overview tab to manage members</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending">
          {selectedOrg ? (
            <OrganizationPendingPanel 
              organization={selectedOrg} 
              onRefresh={fetchOrganizations}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select an organization from the Overview tab to view pending members</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings">
          {selectedOrg ? (
          <OrganizationSettingsPanel 
              organization={selectedOrg} 
              onRefresh={fetchOrganizations}
              onOrganizationUpdated={(updatedOrg) => setSelectedOrg({ ...selectedOrg, ...updatedOrg })}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select an organization from the Overview tab to manage settings</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={selectedOrg}
        title={selectedOrg?.name || "Organization Details"}
      />

      <CreateOrganizationForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchOrganizations}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{orgToDelete?.name}"? This action cannot be undone.
              All members will be removed from this organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setImagePreview(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setImagePreview(null)}
          >
            <Trash2 className="h-6 w-6" />
          </Button>
          <img
            src={imagePreview}
            alt="Organization Logo Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
