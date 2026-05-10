import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Monitor, KeyRound, UserCog } from "lucide-react";
import { ActiveSessionsPanel } from "@/components/session/ActiveSessionsPanel";
import { ChangePasswordPanel } from "@/components/session/ChangePasswordPanel";
import { UserProfilePanel } from "@/components/session/UserProfilePanel";

export default function SessionManagementPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Session Management"
        description="Manage your active sessions, security settings, and profile"
        icon={Shield}
      />

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="sessions" className="gap-2">
            <Monitor className="w-4 h-4" />
            Active Sessions
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <KeyRound className="w-4 h-4" />
            Change Password
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <UserCog className="w-4 h-4" />
            My Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <ActiveSessionsPanel />
        </TabsContent>

        <TabsContent value="password">
          <ChangePasswordPanel />
        </TabsContent>

        <TabsContent value="profile">
          <UserProfilePanel />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
