import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, List, BarChart3, Settings, Link, History } from "lucide-react";
import DeviceListPanel from "@/components/devices/DeviceListPanel";
import DeviceStatsPanel from "@/components/devices/DeviceStatsPanel";
import RegisterDevicePanel from "@/components/devices/RegisterDevicePanel";
import DeviceConfigPanel from "@/components/devices/DeviceConfigPanel";
import DeviceEventBindingPanel from "@/components/devices/DeviceEventBindingPanel";
import DeviceAuditPanel from "@/components/devices/DeviceAuditPanel";

const DeviceManagementPage = () => {
  const [activeTab, setActiveTab] = useState("list");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Attendance Device Management"
          description="Register, configure, and manage attendance marking devices across institutes"
          icon={Smartphone}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-3 lg:grid-cols-6 gap-1">
            <TabsTrigger value="list" className="flex items-center gap-2 text-xs sm:text-sm">
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Devices</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2 text-xs sm:text-sm">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="register" className="flex items-center gap-2 text-xs sm:text-sm">
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">Register</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2 text-xs sm:text-sm">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger value="bindings" className="flex items-center gap-2 text-xs sm:text-sm">
              <Link className="w-4 h-4" />
              <span className="hidden sm:inline">Bindings</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2 text-xs sm:text-sm">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <DeviceListPanel />
          </TabsContent>
          <TabsContent value="stats">
            <DeviceStatsPanel />
          </TabsContent>
          <TabsContent value="register">
            <RegisterDevicePanel />
          </TabsContent>
          <TabsContent value="config">
            <DeviceConfigPanel />
          </TabsContent>
          <TabsContent value="bindings">
            <DeviceEventBindingPanel />
          </TabsContent>
          <TabsContent value="audit">
            <DeviceAuditPanel />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DeviceManagementPage;
