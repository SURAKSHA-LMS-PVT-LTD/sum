/**
 * AdminUpgradeUserTypeDialog
 *
 * Allows an institute admin to upgrade a user's global type from
 * USER_WITHOUT_PARENT or USER_WITHOUT_STUDENT to the full USER type.
 *
 * All extra data fields are optional — the admin can submit with nothing filled in.
 * Existing user data is NOT fetched or shown (admin cannot view/edit prior data here).
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usersApi, UpgradeUserTypeData } from '@/api/users.api';
import { getErrorMessage } from '@/api/apiError';

interface AdminUpgradeUserTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The global user type slug/enum, e.g. "USER_WITHOUT_PARENT" */
  globalUserType: string;
  /** Internal user ID (global, not institute-scoped) */
  userId: string;
  userName: string;
  instituteId: string;
  onSuccess: () => void;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const BLOOD_GROUP_VALUES = [
  'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
  'O_POSITIVE', 'O_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE',
];

const AdminUpgradeUserTypeDialog: React.FC<AdminUpgradeUserTypeDialogProps> = ({
  open,
  onOpenChange,
  globalUserType,
  userId,
  userName,
  instituteId,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const isWithoutParent = globalUserType === 'USER_WITHOUT_PARENT';
  const isWithoutStudent = globalUserType === 'USER_WITHOUT_STUDENT';
  const canUpgrade = isWithoutParent || isWithoutStudent;

  const [parentData, setParentData] = useState({
    occupation: '',
    workplace: '',
    workPhone: '',
    educationLevel: '',
  });

  const [studentData, setStudentData] = useState({
    emergencyContact: '',
    medicalConditions: '',
    allergies: '',
    bloodGroup: '',
  });

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const data: UpgradeUserTypeData = {};

      if (isWithoutParent) {
        data.parentData = {
          occupation: parentData.occupation || undefined,
          workplace: parentData.workplace || undefined,
          workPhone: parentData.workPhone || undefined,
          educationLevel: parentData.educationLevel || undefined,
        };
      }
      if (isWithoutStudent) {
        data.studentData = {
          emergencyContact: studentData.emergencyContact || undefined,
          medicalConditions: studentData.medicalConditions || undefined,
          allergies: studentData.allergies || undefined,
          bloodGroup: studentData.bloodGroup || undefined,
        };
      }

      await usersApi.adminUpgradeUserType(instituteId, userId, data);
      toast({ title: 'Upgraded', description: `${userName} has been upgraded to full USER.` });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Upgrade Failed',
        description: getErrorMessage(err, 'Could not upgrade user type'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!canUpgrade) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} routeName="admin-upgrade-user-type-popup">
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-primary" />
            Upgrade User to Full USER
          </DialogTitle>
          <DialogDescription>
            Upgrading <span className="font-semibold">{userName}</span> from{' '}
            <Badge variant="secondary" className="text-[10px] align-middle">
              {isWithoutParent ? 'User Without Parent' : 'User Without Student'}
            </Badge>{' '}
            to full <Badge variant="default" className="text-[10px] align-middle">USER</Badge>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 mb-1">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            All fields below are <strong>optional</strong>. You can upgrade without filling anything in.
            You cannot view or edit the user's existing data here.
          </span>
        </div>

        {isWithoutParent && (
          <div className="space-y-3 py-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Parent / Guardian Details (optional)
            </p>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Occupation</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  placeholder="e.g. Engineer"
                  value={parentData.occupation}
                  onChange={e => setParentData(p => ({ ...p, occupation: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Workplace</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  placeholder="Company name"
                  value={parentData.workplace}
                  onChange={e => setParentData(p => ({ ...p, workplace: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Work Phone</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  placeholder="+94XXXXXXXXX"
                  value={parentData.workPhone}
                  onChange={e => setParentData(p => ({ ...p, workPhone: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Education Level</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  placeholder="e.g. Bachelor's Degree"
                  value={parentData.educationLevel}
                  onChange={e => setParentData(p => ({ ...p, educationLevel: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}

        {isWithoutStudent && (
          <div className="space-y-3 py-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Student Details (optional)
            </p>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Emergency Contact</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  placeholder="+94XXXXXXXXX"
                  value={studentData.emergencyContact}
                  onChange={e => setStudentData(p => ({ ...p, emergencyContact: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Blood Group</Label>
                <Select
                  value={studentData.bloodGroup || '__none__'}
                  onValueChange={v => setStudentData(p => ({ ...p, bloodGroup: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground italic">— None —</span>
                    </SelectItem>
                    {BLOOD_GROUP_VALUES.map((v, i) => (
                      <SelectItem key={v} value={v}>{BLOOD_GROUPS[i]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Medical Conditions</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  placeholder="Any conditions (optional)"
                  value={studentData.medicalConditions}
                  onChange={e => setStudentData(p => ({ ...p, medicalConditions: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Allergies</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  placeholder="Any allergies (optional)"
                  value={studentData.allergies}
                  onChange={e => setStudentData(p => ({ ...p, allergies: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleUpgrade} disabled={loading} className="gap-1.5">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpCircle className="h-4 w-4" />
            )}
            {loading ? 'Upgrading…' : 'Upgrade to USER'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminUpgradeUserTypeDialog;
