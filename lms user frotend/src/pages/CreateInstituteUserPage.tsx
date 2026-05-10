import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import CreateInstituteUserForm from '@/components/forms/CreateInstituteUserForm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowLeft, UserPlus, Printer, Settings2, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  printStudentRegistrationForm,
  DEFAULT_PRINT_FIELDS,
  PrintFormFields,
} from '@/utils/printRegistrationForm';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { instituteSettingsApi } from '@/api/instituteSettings.api';
import surakshaLogo from '@/assets/suraksha-logo.png';

// â”€â”€ Field config: groups with individual field toggles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface FieldItem { key: keyof PrintFormFields; label: string; }
interface FieldGroup {
  groupLabel: string;
  /** When set, the header checkbox IS this master key (section on/off) */
  masterKey?: keyof PrintFormFields;
  fields: FieldItem[];
}

const FIELD_GROUPS: FieldGroup[] = [
  {
    groupLabel: 'Header & Extras',
    fields: [
      { key: 'photoBox',           label: 'Passport photo box' },
      { key: 'accountCredentials', label: 'Account credentials (password fields)' },
    ],
  },
  {
    groupLabel: 'Reference Numbers',
    fields: [
      { key: 'admissionNo',        label: 'Admission / Registration No.' },
      { key: 'dateOfRegistration', label: 'Date of Registration' },
      { key: 'instituteUserId',    label: 'Institute User ID' },
      { key: 'instituteCardId',    label: 'Institute Card ID' },
    ],
  },
  {
    groupLabel: 'Personal Information',
    fields: [
      { key: 'firstName',        label: 'First & Last Name' },
      { key: 'nameWithInitials', label: 'Name with Initials' },
      { key: 'dateOfBirth',      label: 'Date of Birth' },
      { key: 'gender',           label: 'Gender' },
      { key: 'nic',              label: 'NIC / Birth Certificate No.' },
    ],
  },
  {
    groupLabel: 'Contact Details',
    fields: [
      { key: 'phoneNumber',  label: 'Phone Number' },
      { key: 'emailAddress', label: 'Email Address' },
    ],
  },
  {
    groupLabel: 'Residential Address',
    fields: [
      { key: 'addressLine1', label: 'Address Line 1' },
      { key: 'addressLine2', label: 'Address Line 2' },
      { key: 'city',         label: 'City' },
      { key: 'district',     label: 'District' },
      { key: 'province',     label: 'Province' },
      { key: 'postalCode',   label: 'Postal Code' },
    ],
  },
  {
    groupLabel: 'Academic & Health',
    fields: [
      { key: 'studentId',        label: 'Student ID' },
      { key: 'emergencyContact', label: 'Emergency Contact' },
      { key: 'bloodGroup',       label: 'Blood Group' },
      { key: 'medicalConditions',label: 'Medical Conditions' },
      { key: 'allergies',        label: 'Allergies' },
    ],
  },
  {
    groupLabel: "Father's Information",
    masterKey: 'fatherSection',
    fields: [
      { key: 'fatherNameWithInitials', label: 'Name with Initials' },
      { key: 'fatherNic',              label: 'NIC / Passport No.' },
      { key: 'fatherEmail',            label: 'Email Address' },
      { key: 'fatherDob',              label: 'Date of Birth' },
      { key: 'fatherGender',           label: 'Gender' },
      { key: 'fatherOccupation',       label: 'Occupation' },
      { key: 'fatherWorkplace',        label: 'Workplace' },
      { key: 'fatherEducation',        label: 'Education Level' },
      { key: 'fatherAddress',          label: 'Address Fields' },
    ],
  },
  {
    groupLabel: "Mother's Information",
    masterKey: 'motherSection',
    fields: [
      { key: 'motherNameWithInitials', label: 'Name with Initials' },
      { key: 'motherNic',              label: 'NIC / Passport No.' },
      { key: 'motherEmail',            label: 'Email Address' },
      { key: 'motherDob',              label: 'Date of Birth' },
      { key: 'motherGender',           label: 'Gender' },
      { key: 'motherOccupation',       label: 'Occupation' },
      { key: 'motherWorkplace',        label: 'Workplace' },
      { key: 'motherEducation',        label: 'Education Level' },
      { key: 'motherAddress',          label: 'Address Fields' },
    ],
  },
  {
    groupLabel: "Guardian's Information",
    masterKey: 'guardianSection',
    fields: [
      { key: 'guardianNameWithInitials', label: 'Name with Initials' },
      { key: 'guardianNic',              label: 'NIC / Passport No.' },
      { key: 'guardianEmail',            label: 'Email Address' },
      { key: 'guardianDob',              label: 'Date of Birth' },
      { key: 'guardianGender',           label: 'Gender' },
      { key: 'guardianOccupation',       label: 'Occupation' },
      { key: 'guardianWorkplace',        label: 'Workplace' },
      { key: 'guardianEducation',        label: 'Education Level' },
      { key: 'guardianAddress',          label: 'Address Fields' },
    ],
  },
  {
    groupLabel: 'Footer Sections',
    fields: [
      { key: 'cardDelivery', label: 'ID Card Delivery Recipient' },
      { key: 'signatures',   label: 'Signature Areas' },
      { key: 'officeUse',    label: 'Office Use Only' },
      { key: 'instructions', label: 'Instructions for Students' },
    ],
  },
];

// â”€â”€ Page component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CreateInstituteUserPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { instituteId } = useParams<{ instituteId: string }>();
  const { selectedInstitute, setSelectedInstitute, user, loadUserInstitutes } = useAuth();

  // â”€â”€ Print dialog state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printFields, setPrintFields] = useState<PrintFormFields>({ ...DEFAULT_PRINT_FIELDS });
  const [copies, setCopies] = useState(1);
  const [instituteLogoUrl, setInstituteLogoUrl] = useState<string>('');
  const [logoLoading, setLogoLoading] = useState(false);
  // All groups start expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(FIELD_GROUPS.map(g => g.groupLabel)),
  );

  // Restore institute context from URL on page refresh
  useEffect(() => {
    if (!instituteId) return;
    if (selectedInstitute?.id?.toString() === instituteId) return;
    const found = user?.institutes?.find((i: any) => i.id?.toString() === instituteId);
    if (found) { setSelectedInstitute(found); return; }
    loadUserInstitutes().then((institutes) => {
      const inst = institutes?.find((i: any) => i.id?.toString() === instituteId);
      if (inst) setSelectedInstitute(inst);
    }).catch(() => {});
  }, [instituteId]);

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function toggleField(key: keyof PrintFormFields) {
    setPrintFields(prev => ({ ...prev, [key]: !prev[key] }));
  }

  /** Header checkbox click: for masterKey groups toggles the section toggle;
   *  for plain groups toggles all fields on (if any off) or all off. */
  function toggleGroup(group: FieldGroup) {
    if (group.masterKey) {
      setPrintFields(prev => ({ ...prev, [group.masterKey!]: !prev[group.masterKey!] }));
    } else {
      const allOn = group.fields.every(f => printFields[f.key]);
      const val = !allOn;
      setPrintFields(prev => {
        const next = { ...prev };
        group.fields.forEach(f => { (next as any)[f.key] = val; });
        return next;
      });
    }
  }

  function toggleExpand(groupLabel: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupLabel)) next.delete(groupLabel); else next.add(groupLabel);
      return next;
    });
  }

  /** 'all' / 'some' / 'none' â€” drives the header checkbox state */
  function groupCheckState(group: FieldGroup): boolean | 'indeterminate' {
    if (group.masterKey) {
      return printFields[group.masterKey] as boolean;
    }
    const onCount = group.fields.filter(f => printFields[f.key]).length;
    if (onCount === 0) return false;
    if (onCount === group.fields.length) return true;
    return 'indeterminate';
  }

  async function openPrintDialog() {
    setPrintDialogOpen(true);
    const id = instituteId ?? selectedInstitute?.id?.toString() ?? '';
    if (!id) return;
    setLogoLoading(true);
    try {
      const profile = await instituteSettingsApi.getProfile(id);
      setInstituteLogoUrl(getImageUrl(profile.logoUrl ?? ''));
    } catch {
      setInstituteLogoUrl(getImageUrl((selectedInstitute as any)?.logoUrl ?? ''));
    } finally {
      setLogoLoading(false);
    }
  }

  function handleGenerate() {
    setPrintDialogOpen(false);
    printStudentRegistrationForm({
      instituteName: selectedInstitute?.name ?? '',
      instituteLogoUrl,
      appLogoUrl: surakshaLogo,
      copies: Math.max(1, copies),
      fields: printFields,
    });
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-24">
        {/* Page header */}
        <div className="py-4 flex items-center gap-2 sm:gap-3 border-b mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0 h-10 w-10 min-h-[44px] min-w-[44px]">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary shrink-0" />
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">Create Institute User</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Create and enroll a new user into your institute
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5 min-h-[44px]" onClick={openPrintDialog}>
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print Form</span>
          </Button>
        </div>

        <CreateInstituteUserForm
          mode="page"
          onSubmit={(data) => {
            toast({
              title: 'User Created',
              description: data.message || 'User created and enrolled successfully!',
              duration: 3000,
            });
            navigate(-1);
          }}
          onCancel={() => navigate(-1)}
        />
      </div>

      {/* â”€â”€ Print customization dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-md max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Customize Registration Form
            </DialogTitle>
          </DialogHeader>

          {/* Institute logo preview */}
          {(instituteLogoUrl || logoLoading) && (
            <div className="flex items-center gap-3 rounded-md border px-3 py-2 bg-muted/30">
              {logoLoading ? (
                <div className="h-10 w-10 rounded bg-muted animate-pulse shrink-0" />
              ) : (
                <img
                  src={instituteLogoUrl}
                  alt="Institute logo"
                  className="h-10 w-10 object-contain rounded shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <span className="text-xs text-muted-foreground">
                {logoLoading ? 'Loading institute logoâ€¦' : 'Institute logo will appear on the form header'}
              </span>
            </div>
          )}

          <p className="text-xs text-muted-foreground mb-1">
            Expand each group to toggle individual fields. The header checkbox enables / disables the whole group.
          </p>

          {/* Grouped accordion */}
          <div className="space-y-1.5">
            {FIELD_GROUPS.map((group) => {
              const headerState = groupCheckState(group);
              const isExpanded = expandedGroups.has(group.groupLabel);
              const sectionIsOn = group.masterKey ? (printFields[group.masterKey] as boolean) : true;

              return (
                <div key={group.groupLabel} className="rounded-md border overflow-hidden">
                  {/* Group header row */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 select-none">
                    <Checkbox
                      checked={headerState}
                      onCheckedChange={() => toggleGroup(group)}
                      className="shrink-0"
                    />
                    <button
                      type="button"
                      className="flex-1 flex items-center justify-between text-left gap-1 min-w-0"
                      onClick={() => toggleExpand(group.groupLabel)}
                    >
                      <span className="text-sm font-semibold truncate">{group.groupLabel}</span>
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>
                  </div>

                  {/* Individual fields â€” shown when expanded */}
                  {isExpanded && (
                    <div className={`border-t divide-y transition-opacity ${!sectionIsOn ? 'opacity-40 pointer-events-none' : ''}`}>
                      {group.fields.map(({ key, label }) => (
                        <label
                          key={key}
                          className="flex items-center gap-3 px-5 py-1.5 hover:bg-muted/30 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={printFields[key] as boolean}
                            onCheckedChange={() => toggleField(key)}
                            className="shrink-0"
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Copies */}
          <div className="border-t pt-3 mt-1">
            <Label htmlFor="copies-input" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Number of copies
            </Label>
            <Input
              id="copies-input"
              type="number"
              min={1}
              max={50}
              value={copies}
              onChange={(e) => setCopies(Number(e.target.value))}
              className="mt-1 w-24"
            />
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)} className="w-full sm:w-auto min-h-[44px]">Cancel</Button>
            <Button onClick={handleGenerate} className="gap-1.5 w-full sm:w-auto min-h-[44px]">
              <Printer className="h-4 w-4" />
              Generate PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default CreateInstituteUserPage;

