import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { CalendarDays } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDashboard } from "@/components/calendar/CalendarDashboard";
import { OperatingConfigPanel } from "@/components/calendar/OperatingConfigPanel";
import { GenerateCalendarPanel } from "@/components/calendar/GenerateCalendarPanel";
import { CalendarDaysPanel } from "@/components/calendar/CalendarDaysPanel";
import { EventManagementPanel } from "@/components/calendar/EventManagementPanel";
import { BulkDayUpdatePanel } from "@/components/calendar/BulkDayUpdatePanel";
import { CacheManagementPanel } from "@/components/calendar/CacheManagementPanel";

export default function CalendarManagementPage() {
  const [instituteId, setInstituteId] = useState("");

  return (
    <DashboardLayout>
      <PageHeader
        title="Calendar Management"
        description="Configure operating schedules, generate academic calendars, and manage events"
        icon={CalendarDays}
      />

      <div className="mb-6">
        <Label htmlFor="instituteId" className="text-sm font-medium text-foreground">Institute ID</Label>
        <Input
          id="instituteId"
          placeholder="Enter Institute ID"
          value={instituteId}
          onChange={(e) => setInstituteId(e.target.value)}
          className="mt-1 max-w-xs"
        />
      </div>

      {instituteId ? (
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1 rounded-lg">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="operating-config">Operating Config</TabsTrigger>
            <TabsTrigger value="generate">Generate Calendar</TabsTrigger>
            <TabsTrigger value="days">Calendar Days</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Update</TabsTrigger>
            <TabsTrigger value="cache">Cache</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <CalendarDashboard instituteId={instituteId} />
          </TabsContent>
          <TabsContent value="operating-config">
            <OperatingConfigPanel instituteId={instituteId} />
          </TabsContent>
          <TabsContent value="generate">
            <GenerateCalendarPanel instituteId={instituteId} />
          </TabsContent>
          <TabsContent value="days">
            <CalendarDaysPanel instituteId={instituteId} />
          </TabsContent>
          <TabsContent value="events">
            <EventManagementPanel instituteId={instituteId} />
          </TabsContent>
          <TabsContent value="bulk">
            <BulkDayUpdatePanel instituteId={instituteId} />
          </TabsContent>
          <TabsContent value="cache">
            <CacheManagementPanel instituteId={instituteId} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Enter an Institute ID above to manage the calendar</p>
        </div>
      )}
    </DashboardLayout>
  );
}
