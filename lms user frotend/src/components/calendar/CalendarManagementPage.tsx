import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import calendarApi from '@/api/calendar.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import CalendarDashboard from './CalendarDashboard';
import OperatingSchedule from './OperatingSchedule';
import GenerateCalendarWizard from './GenerateCalendarWizard';
import CalendarDayManagement from './CalendarDayManagement';
import EventManagement from './EventManagement';
import BulkDayUpdate from './BulkDayUpdate';
import CacheManagement from './CacheManagement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, AlertTriangle, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/api/apiError';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'config', label: 'Config' },
  { id: 'generate', label: 'Generate' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'events', label: 'Events' },
  { id: 'bulk', label: 'Bulk Update' },
  { id: 'cache', label: 'Cache' },
];

const CalendarManagementPage: React.FC = () => {
  const { currentInstituteId, selectedInstitute } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set<string>(['dashboard']));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteYear, setDeleteYear] = useState(new Date().getFullYear().toString());
  const [deleting, setDeleting] = useState(false);

  const handleDeleteCalendar = async () => {
    if (!currentInstituteId) return;
    setDeleting(true);
    try {
      const res = await calendarApi.deleteCalendar(currentInstituteId, deleteYear);
      toast.success(res?.message || 'Calendar deleted');
      setShowDeleteConfirm(false);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to delete calendar'));
    } finally {
      setDeleting(false);
    }
  };

  if (!currentInstituteId) {
    return (
      <Card className="border-dashed border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">No Institute Selected</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Choose an institute to access Calendar Management — dashboard, config, generation, events, bulk updates, and cache diagnostics.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeTabData = tabs.find(t => t.id === activeTab);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Calendar Management</h1>
          <p className="text-xs text-muted-foreground">{selectedInstitute?.name || 'Institute'}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center rounded-2xl border border-border bg-muted/40 p-1 gap-0.5 w-full overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setVisitedTabs(prev => {
                  if (prev.has(tab.id)) return prev;
                  const next = new Set(prev);
                  next.add(tab.id);
                  return next;
                });
              }}
              title={tab.label}
              className={cn(
                "flex-shrink-0 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-background text-foreground shadow-sm px-3 sm:px-4"
                  : "text-muted-foreground hover:text-foreground px-2 sm:px-3",
                "sm:flex-1 sm:min-w-0"
              )}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {visitedTabs.has('dashboard') && (
          <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <CalendarDashboard onNavigate={(tab) => {
              setActiveTab(tab);
              setVisitedTabs(prev => { const next = new Set(prev); next.add(tab); return next; });
            }} />
          </div>
        )}

        {visitedTabs.has('config') && (
          <div style={{ display: activeTab === 'config' ? 'block' : 'none' }}>
            <OperatingSchedule />
          </div>
        )}

        {visitedTabs.has('generate') && (
          <div style={{ display: activeTab === 'generate' ? 'block' : 'none' }}>
            <div className="space-y-4">
              <GenerateCalendarWizard />
              <Card className="border-destructive/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-destructive flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <Trash2 className="h-3.5 w-3.5" />
                    </div>
                    Delete Calendar
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">Delete an existing calendar to regenerate it with different settings.</p>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Year:</Label>
                    <Input value={deleteYear} onChange={e => setDeleteYear(e.target.value)} className="w-24 text-xs h-9" />
                    <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} className="h-9">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {visitedTabs.has('calendar') && (
          <div style={{ display: activeTab === 'calendar' ? 'block' : 'none' }}>
            <CalendarDayManagement />
          </div>
        )}
        {visitedTabs.has('events') && (
          <div style={{ display: activeTab === 'events' ? 'block' : 'none' }}>
            <EventManagement />
          </div>
        )}
        {visitedTabs.has('bulk') && (
          <div style={{ display: activeTab === 'bulk' ? 'block' : 'none' }}>
            <BulkDayUpdate />
          </div>
        )}
        {visitedTabs.has('cache') && (
          <div style={{ display: activeTab === 'cache' ? 'block' : 'none' }}>
            <CacheManagement />
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        itemName={`Calendar ${deleteYear}`}
        itemType="calendar"
        bullets={[
          `All calendar days and events for ${deleteYear} will be permanently deleted`,
          'All attendance linkages will be orphaned',
          'This action cannot be undone!',
        ]}
        onConfirm={handleDeleteCalendar}
        isDeleting={deleting}
      />
    </div>
  );
};

export default CalendarManagementPage;
