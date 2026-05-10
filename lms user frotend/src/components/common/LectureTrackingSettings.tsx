import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subjectPaymentsApi, SubjectPayment } from '@/api/subjectPayments.api';
import { Loader2 } from 'lucide-react';

export interface TrackingSettingsData {
  liveAttendanceEnabled: boolean;
  liveAccessLevel: 'ANYONE' | 'SURAKSHA_USERS' | 'ENROLLED_ONLY' | 'PAID_ONLY';
  livePaymentId?: string;
  recAttendanceEnabled: boolean;
  recPlatform: 'SYSTEM' | 'YOUTUBE' | 'GOOGLE_DRIVE';
  recAccessLevel: 'ANYONE' | 'SURAKSHA_USERS' | 'ENROLLED_ONLY' | 'PAID_ONLY';
  recPaymentId?: string;
}

export interface LectureTrackingSettingsProps {
  data: TrackingSettingsData;
  onChange: (data: TrackingSettingsData) => void;
  showPayments?: boolean;
  instituteId?: string;
  classId?: string;
  paymentType?: 'class' | 'subject';
}

const LectureTrackingSettings: React.FC<LectureTrackingSettingsProps> = ({
  data,
  onChange,
  showPayments = true,
  instituteId,
  classId,
  paymentType = 'subject',
}) => {
  const [classPayments, setClassPayments] = useState<Array<{ id: string; title: string; amount: string | number; _group?: string }>>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const needsPaymentDropdown =
    showPayments &&
    instituteId &&
    classId &&
    (data.liveAccessLevel === 'PAID_ONLY' || data.recAccessLevel === 'PAID_ONLY');

  useEffect(() => {
    if (!needsPaymentDropdown) return;
    setLoadingPayments(true);
    
    if (paymentType === 'class') {
      import('@/api/classPayments.api').then(({ classPaymentsApi }) => {
        classPaymentsApi
          .getClassPayments(instituteId!, classId!)
          .then((res) => {
            const formatted = (res.data || []).map(p => ({ ...p, _group: 'Class Payments' }));
            setClassPayments(formatted);
          })
          .catch(() => setClassPayments([]))
          .finally(() => setLoadingPayments(false));
      });
    } else {
      Promise.all([
        import('@/api/classPayments.api').then(m => m.classPaymentsApi.getClassPayments(instituteId!, classId!)),
        subjectPaymentsApi.getPaymentsByClass(instituteId!, classId!)
      ])
        .then(([classRes, subjectRes]) => {
          const cPayments = (classRes.data || []).map((p: any) => ({ ...p, _group: 'Class Payments' }));
          const sPayments = (subjectRes.data || []).map((p: any) => ({ ...p, _group: 'Subject Payments' }));
          setClassPayments([...cPayments, ...sPayments]);
        })
        .catch(() => setClassPayments([]))
        .finally(() => setLoadingPayments(false));
    }
  }, [needsPaymentDropdown, instituteId, classId, paymentType]);

  const updateField = (field: keyof TrackingSettingsData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const PaymentSelect = ({
    value,
    onSelect,
  }: {
    value?: string;
    onSelect: (id: string) => void;
  }) => {
    if (loadingPayments) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground h-10 px-3 border rounded-md">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading payments...
        </div>
      );
    }
    if (!classPayments.length) {
      return (
        <div className="flex items-center h-10 px-3 border rounded-md text-sm text-muted-foreground">
          No class payments found
        </div>
      );
    }
    return (
      <Select value={value || ''} onValueChange={onSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Select a payment..." />
        </SelectTrigger>
        <SelectContent>
          {paymentType === 'class' ? (
            classPayments.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title} — Rs. {p.amount}
              </SelectItem>
            ))
          ) : (
            <>
              {classPayments.filter((p) => p._group === 'Class Payments').length > 0 && (
                <SelectGroup>
                  <SelectLabel>Class Payments</SelectLabel>
                  {classPayments
                    .filter((p) => p._group === 'Class Payments')
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title} — Rs. {p.amount}
                      </SelectItem>
                    ))}
                </SelectGroup>
              )}
              {classPayments.filter((p) => p._group === 'Subject Payments').length > 0 && (
                <SelectGroup>
                  <SelectLabel>Subject Payments</SelectLabel>
                  {classPayments
                    .filter((p) => p._group === 'Subject Payments')
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title} — Rs. {p.amount}
                      </SelectItem>
                    ))}
                </SelectGroup>
              )}
            </>
          )}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="space-y-6">
      {/* Live Tracking Settings */}
      <Card className="border-indigo-100 dark:border-indigo-900/50">
        <CardHeader className="pb-3 bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-md">Live Session Tracking & Access</CardTitle>
              <CardDescription>Configure dynamic URLs and access levels for live sessions</CardDescription>
            </div>
            <Switch
              checked={data.liveAttendanceEnabled}
              onCheckedChange={(v) => updateField('liveAttendanceEnabled', v)}
            />
          </div>
        </CardHeader>
        {data.liveAttendanceEnabled && (
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Live Access Level</Label>
                <Select
                  value={data.liveAccessLevel}
                  onValueChange={(v: any) => updateField('liveAccessLevel', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANYONE">Anyone (Guest access allowed)</SelectItem>
                    <SelectItem value="SURAKSHA_USERS">Registered Suraksha Users Only</SelectItem>
                    <SelectItem value="ENROLLED_ONLY">Enrolled Students Only</SelectItem>
                    <SelectItem value="PAID_ONLY">Paid Students Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {data.liveAccessLevel === 'PAID_ONLY' && showPayments && (
                <div className="space-y-2">
                  <Label>Required Payment</Label>
                  {instituteId && classId ? (
                    <PaymentSelect
                      value={data.livePaymentId}
                      onSelect={(id) => updateField('livePaymentId', id)}
                    />
                  ) : (
                    <div className="flex items-center h-10 px-3 border rounded-md text-sm text-muted-foreground">
                      No class context available
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Recording Tracking Settings */}
      <Card className="border-indigo-100 dark:border-indigo-900/50">
        <CardHeader className="pb-3 bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-md">Recording Activity Tracking</CardTitle>
              <CardDescription>Monitor playtime, pauses, and seek events for recordings</CardDescription>
            </div>
            <Switch
              checked={data.recAttendanceEnabled}
              onCheckedChange={(v) => updateField('recAttendanceEnabled', v)}
            />
          </div>
        </CardHeader>
        {data.recAttendanceEnabled && (
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recording Platform</Label>
                <Select
                  value={data.recPlatform}
                  onValueChange={(v: any) => updateField('recPlatform', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SYSTEM">System Video Player (Advanced Telemetry)</SelectItem>
                    <SelectItem value="YOUTUBE">YouTube (Basic Tracking)</SelectItem>
                    <SelectItem value="GOOGLE_DRIVE">Google Drive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Recording Access Level</Label>
                <Select
                  value={data.recAccessLevel}
                  onValueChange={(v: any) => updateField('recAccessLevel', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANYONE">Anyone (Guest access allowed)</SelectItem>
                    <SelectItem value="SURAKSHA_USERS">Registered Suraksha Users Only</SelectItem>
                    <SelectItem value="ENROLLED_ONLY">Enrolled Students Only</SelectItem>
                    <SelectItem value="PAID_ONLY">Paid Students Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {data.recAccessLevel === 'PAID_ONLY' && showPayments && (
                <div className="space-y-2">
                  <Label>Required Payment</Label>
                  {instituteId && classId ? (
                    <PaymentSelect
                      value={data.recPaymentId}
                      onSelect={(id) => updateField('recPaymentId', id)}
                    />
                  ) : (
                    <div className="flex items-center h-10 px-3 border rounded-md text-sm text-muted-foreground">
                      No class context available
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default LectureTrackingSettings;
