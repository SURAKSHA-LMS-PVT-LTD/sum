import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ArrowUpCircle, Check, ChevronsUpDown, Briefcase, GraduationCap, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usersApi, UpgradeUserTypeData } from '@/api/users.api';
import { useToast } from '@/hooks/use-toast';
import { Occupation } from '@/types/occupation.types';

interface UpgradeUserTypeDialogProps {
  userType: string;
  onUpgradeSuccess: () => void;
}

const occupationOptions = Object.values(Occupation).map(value => ({
  value,
  label: value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
}));

const USER_TYPE_INFO: Record<string, { label: string; description: string; capabilities: string[] }> = {
  USER: {
    label: 'Full User',
    description: 'Full access — can act as both student and parent across institutes.',
    capabilities: ['Play any institute role', 'Can be assigned as parent', 'Student capabilities', 'Parent capabilities'],
  },
  USER_WITHOUT_PARENT: {
    label: 'User Without Parent',
    description: 'Can play student and institute roles, but cannot be assigned as a parent.',
    capabilities: ['Play any institute role', 'Student capabilities'],
  },
  USER_WITHOUT_STUDENT: {
    label: 'User Without Student',
    description: 'Parent-only user — can be assigned as a parent but cannot play student role.',
    capabilities: ['Can be assigned as parent', 'Parent capabilities'],
  },
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'System-wide super admin with global access.',
    capabilities: ['Global access', 'All admin privileges'],
  },
  ORGANIZATION_MANAGER: {
    label: 'Organization Manager',
    description: 'Organization-level management with institute access control.',
    capabilities: ['Manage organizations', 'Institute access control'],
  },
};

const UpgradeUserTypeDialog: React.FC<UpgradeUserTypeDialogProps> = ({ userType, onUpgradeSuccess }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [occupationOpen, setOccupationOpen] = useState(false);

  // Parent data form (for USER_WITHOUT_PARENT → USER)
  const [parentData, setParentData] = useState({
    occupation: '',
    workplace: '',
    workPhone: '',
    educationLevel: '',
  });

  // Student data form (for USER_WITHOUT_STUDENT → USER)
  const [studentData, setStudentData] = useState({
    emergencyContact: '',
    medicalConditions: '',
    allergies: '',
    bloodGroup: '',
  });

  const isWithoutParent = userType === 'USER_WITHOUT_PARENT';
  const isWithoutStudent = userType === 'USER_WITHOUT_STUDENT';
  const canUpgrade = isWithoutParent || isWithoutStudent;

  const typeInfo = USER_TYPE_INFO[userType] || {
    label: userType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: 'Your current account type.',
    capabilities: [],
  };

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

      await usersApi.upgradeUserType(data);
      toast({ title: 'Success', description: 'Your account has been upgraded to full USER.' });
      setOpen(false);
      onUpgradeSuccess();
    } catch (error: any) {
      const message = error?.message || 'Failed to upgrade account. Please try again.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn("border", canUpgrade ? "border-primary/30 bg-primary/5" : "")}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">User Type</h3>
              <Badge variant="secondary" className="text-[10px]">{typeInfo.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{typeInfo.description}</p>

            {typeInfo.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {typeInfo.capabilities.map(cap => (
                  <Badge key={cap} variant="outline" className="text-[10px] font-normal">
                    {cap}
                  </Badge>
                ))}
              </div>
            )}

            {canUpgrade && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <ArrowUpCircle className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-medium text-primary">Upgrade Available</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {isWithoutParent
                    ? 'Add parent/guardian details to unlock parent capabilities and become a full user.'
                    : 'Add student details to unlock student capabilities and become a full user.'}
                </p>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <ArrowUpCircle className="h-4 w-4 mr-1.5" />
                      {isWithoutParent ? 'Add Parent Details' : 'Add Student Details'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Upgrade to Full User</DialogTitle>
                      <DialogDescription>
                        {isWithoutParent
                          ? 'Add your parent/guardian details to unlock parent capabilities and become a full user.'
                          : 'Add your student details to unlock student capabilities and become a full user.'}
                      </DialogDescription>
                    </DialogHeader>

                    {isWithoutParent && (
                      <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                          <Label className="text-sm flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" /> Occupation
                          </Label>
                          <Popover open={occupationOpen} onOpenChange={setOccupationOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full h-9 justify-between font-normal text-left">
                                <span className="truncate">
                                  {parentData.occupation
                                    ? occupationOptions.find(o => o.value === parentData.occupation)?.label
                                    : 'Select occupation'}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover z-50" align="start">
                              <Command>
                                <CommandInput placeholder="Search occupation..." />
                                <CommandList className="max-h-[200px]">
                                  <CommandEmpty>No occupation found.</CommandEmpty>
                                  <CommandGroup>
                                    {occupationOptions.map(occ => (
                                      <CommandItem
                                        key={occ.value}
                                        value={occ.label}
                                        onSelect={() => {
                                          setParentData(p => ({ ...p, occupation: occ.value }));
                                          setOccupationOpen(false);
                                        }}
                                      >
                                        <Check className={cn('mr-2 h-4 w-4', parentData.occupation === occ.value ? 'opacity-100' : 'opacity-0')} />
                                        {occ.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm">Workplace</Label>
                          <Input
                            value={parentData.workplace}
                            onChange={e => setParentData(p => ({ ...p, workplace: e.target.value }))}
                            placeholder="Company or workplace name"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm">Work Phone</Label>
                          <Input
                            value={parentData.workPhone}
                            onChange={e => setParentData(p => ({ ...p, workPhone: e.target.value }))}
                            placeholder="+94XXXXXXXXX"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm flex items-center gap-1.5">
                            <GraduationCap className="h-3.5 w-3.5" /> Education Level
                          </Label>
                          <Input
                            value={parentData.educationLevel}
                            onChange={e => setParentData(p => ({ ...p, educationLevel: e.target.value }))}
                            placeholder="e.g. Bachelor's Degree"
                          />
                        </div>
                      </div>
                    )}

                    {isWithoutStudent && (
                      <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                          <Label className="text-sm">Emergency Contact</Label>
                          <Input
                            value={studentData.emergencyContact}
                            onChange={e => setStudentData(p => ({ ...p, emergencyContact: e.target.value }))}
                            placeholder="+94XXXXXXXXX"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm">Blood Group</Label>
                          <Select value={studentData.bloodGroup} onValueChange={v => setStudentData(p => ({ ...p, bloodGroup: v }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select blood group" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              <SelectItem value="A_POSITIVE">A+</SelectItem>
                              <SelectItem value="A_NEGATIVE">A-</SelectItem>
                              <SelectItem value="B_POSITIVE">B+</SelectItem>
                              <SelectItem value="B_NEGATIVE">B-</SelectItem>
                              <SelectItem value="O_POSITIVE">O+</SelectItem>
                              <SelectItem value="O_NEGATIVE">O-</SelectItem>
                              <SelectItem value="AB_POSITIVE">AB+</SelectItem>
                              <SelectItem value="AB_NEGATIVE">AB-</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm">Medical Conditions</Label>
                          <Input
                            value={studentData.medicalConditions}
                            onChange={e => setStudentData(p => ({ ...p, medicalConditions: e.target.value }))}
                            placeholder="Any medical conditions (optional)"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm">Allergies</Label>
                          <Input
                            value={studentData.allergies}
                            onChange={e => setStudentData(p => ({ ...p, allergies: e.target.value }))}
                            placeholder="Any allergies (optional)"
                          />
                        </div>
                      </div>
                    )}

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancel
                      </Button>
                      <Button onClick={handleUpgrade} disabled={loading}>
                        {loading ? 'Upgrading...' : 'Upgrade Account'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UpgradeUserTypeDialog;
