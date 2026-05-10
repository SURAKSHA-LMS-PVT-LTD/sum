import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/shared/PageComponents';
import { Users2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateFamilyUnitForm } from '@/components/admin/CreateFamilyUnitForm';
import { IncompleteProfilesList } from '@/components/admin/IncompleteProfilesList';
import { BulkFamilyImport } from '@/components/admin/BulkFamilyImport';

export default function FamilyManagementPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Family Management"
        description="Create and manage student family units"
        icon={Users2}
      />

      <Tabs defaultValue="create" className="mt-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="create">Create Family</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
          <TabsTrigger value="incomplete">Incomplete</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <CreateFamilyUnitForm />
        </TabsContent>

        <TabsContent value="bulk" className="mt-6">
          <BulkFamilyImport />
        </TabsContent>

        <TabsContent value="incomplete" className="mt-6">
          <IncompleteProfilesList />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
