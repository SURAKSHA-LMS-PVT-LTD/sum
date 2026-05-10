import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/shared/PageComponents';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SystemAdminImageQueue } from '@/components/images/SystemAdminImageQueue';
import { InstituteAdminImageQueue } from '@/components/images/InstituteAdminImageQueue';
import { AdminUploadForUser } from '@/components/images/AdminUploadForUser';
import { InstituteEntityImages } from '@/components/images/InstituteEntityImages';
import {
  ImageIcon,
  Shield,
  Building2,
  Upload,
  Palette,
} from 'lucide-react';

export default function ImageManagementPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Image Management"
        description="Manage profile images, verification queues, and institute entity images"
        icon={ImageIcon}
      />

      <Tabs defaultValue="system-queue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="system-queue" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">System Admin Queue</span>
            <span className="sm:hidden">System</span>
          </TabsTrigger>
          <TabsTrigger value="institute-queue" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Institute Queue</span>
            <span className="sm:hidden">Institute</span>
          </TabsTrigger>
          <TabsTrigger value="admin-upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Admin Upload</span>
            <span className="sm:hidden">Upload</span>
          </TabsTrigger>
          <TabsTrigger value="entity-images" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Institute Images</span>
            <span className="sm:hidden">Entity</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system-queue">
          <SystemAdminImageQueue />
        </TabsContent>

        <TabsContent value="institute-queue">
          <InstituteAdminImageQueue />
        </TabsContent>

        <TabsContent value="admin-upload">
          <AdminUploadForUser />
        </TabsContent>

        <TabsContent value="entity-images">
          <InstituteEntityImages />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
