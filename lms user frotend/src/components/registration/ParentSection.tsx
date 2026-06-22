import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, Mail, MessageCircle, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import WhatsAppPhoneVerify from '@/components/registration/WhatsAppPhoneVerify';
import { registrationLinksApi } from '@/api/registrationLinks.api';

export interface ParentData {
  firstName?: string;
  lastName?: string;
  nameWithInitials?: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  nic?: string;
  birthCertificateNo?: string;
  educationLevel?: string;
  occupation?: string;
  workplace?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  /** Set once an existing account is matched+prefilled for this parent. */
  existingUserId?: string;
  /** Keys that came prefilled from an existing account (rendered read-only). */
  prefilledKeys?: string[];
}

interface ParentSectionProps {
  token: string;
  label: string;
  value: ParentData;
  onChange: (v: ParentData) => void;
  /** Already on file for an existing student (claim mode) → mark on record. */
  onRecord?: boolean;
  defaultOpen?: boolean;
}

const OCCUPATION_OPTIONS = [
  'TEACHER', 'LECTURER', 'PRINCIPAL', 'TUITION_TEACHER', 'NURSE', 'DOCTOR', 'PHARMACIST',
  'ENGINEER', 'CIVIL_ENGINEER', 'ARCHITECT', 'IT_OFFICER', 'SOFTWARE_DEVELOPER', 'ACCOUNTANT',
  'BANK_OFFICER', 'ENTREPRENEUR', 'BUSINESS_OWNER', 'CLERK', 'CASHIER', 'RECEPTIONIST',
  'SALES_EXECUTIVE', 'DRIVER', 'BUS_DRIVER', 'FARMER', 'FISHERMAN', 'POLICE_OFFICER',
  'SOLDIER', 'MECHANIC', 'ELECTRICIAN', 'PLUMBER', 'CARPENTER', 'TAILOR', 'CHEF', 'COOK',
  'GYM_INSTRUCTOR', 'HOUSEWIFE', 'FACTORY_WORKER', 'CIVIL_SERVANT', 'LAWYER', 'RESEARCHER',
  'SOCIAL_WORKER', 'JOURNALIST', 'STUDENT_SCHOOL', 'STUDENT_UNIVERSITY', 'RETIRED_PERSON', 'UNEMPLOYED',
].map(v => ({ value: v, label: v.replace(/_/g, ' ').split(' ').map((w: string) => w[0] + w.slice(1).toLowerCase()).join(' ') }));

const ParentSection: React.FC<ParentSectionProps> = ({ token, label, value, onChange, onRecord, defaultOpen }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  const [verifyContact, setVerifyContact] = useState<'phone' | 'email' | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailRequested, setEmailRequested] = useState(false);
  const [contactVerified, setContactVerified] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [occupationOpen, setOccupationOpen] = useState(false);
  const [occupationSearch, setOccupationSearch] = useState('');

  const set = (patch: Partial<ParentData>) => onChange({ ...value, ...patch });
  const isPrefilled = (k: string) => value.prefilledKeys?.includes(k);
  const F = (k: keyof ParentData) => ({
    value: (value[k] as string) ?? '',
    disabled: isPrefilled(k),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [k]: e.target.value }),
  });

  const filteredOccupations = useMemo(
    () => OCCUPATION_OPTIONS.filter(o => o.label.toLowerCase().includes(occupationSearch.toLowerCase())),
    [occupationSearch],
  );

  const runLookup = async (params: { phoneNumber?: string; email?: string }) => {
    setLookupBusy(true);
    try {
      const res = await registrationLinksApi.lookupParent(token, params);
      if (res.found && res.filled) {
        const f = res.filled;
        onChange({
          ...value,
          firstName: value.firstName || f.firstName || undefined,
          lastName: value.lastName || f.lastName || undefined,
          nameWithInitials: value.nameWithInitials || f.nameWithInitials || undefined,
          email: value.email || f.email || undefined,
          phoneNumber: value.phoneNumber || f.phoneNumber || undefined,
          dateOfBirth: value.dateOfBirth || f.dateOfBirth || undefined,
          gender: value.gender || f.gender || undefined,
          nic: value.nic || f.nic || undefined,
          occupation: value.occupation || f.occupation || undefined,
          workplace: value.workplace || f.workplace || undefined,
          existingUserId: res.existingUserId,
          prefilledKeys: Object.entries(f).filter(([, v]) => v).map(([k]) => k),
        });
      }
    } catch { /* leave editable */ } finally {
      setLookupBusy(false);
    }
  };

  const requestEmail = async () => {
    if (!value.email || emailBusy) return;
    setEmailBusy(true);
    try {
      await registrationLinksApi.requestEmail(token, value.email);
      setEmailRequested(true);
      setEmailCode('');
    } catch { /* ignore */ } finally { setEmailBusy(false); }
  };

  const confirmEmail = async () => {
    if (!value.email || !emailCode || emailBusy) return;
    setEmailBusy(true);
    try {
      await registrationLinksApi.confirmEmail(token, value.email, emailCode);
      setContactVerified(true);
      await runLookup({ email: value.email });
    } catch { /* ignore */ } finally { setEmailBusy(false); }
  };

  if (onRecord) {
    return (
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        {label} is already on file for this student.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
      >
        <span className="flex items-center gap-1.5">
          {label}
          {value.existingUserId && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
          {(value.firstName || value.phoneNumber || value.email) && !value.existingUserId && (
            <span className="text-[10px] text-muted-foreground font-normal">
              ({value.firstName || value.phoneNumber || value.email})
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 border-t pt-3 space-y-3">
          {/* Name fields */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">First name</Label>
              <Input placeholder="First name" {...F('firstName')} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Last name</Label>
              <Input placeholder="Last name" {...F('lastName')} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Name with initials</Label>
            <Input placeholder="e.g., A. B. Silva" {...F('nameWithInitials')} />
            <p className="text-[10px] text-muted-foreground">Auto-generated from first/last name if left blank</p>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Phone</Label>
              <Input placeholder="+9477XXXXXXX" {...F('phoneNumber')} disabled={isPrefilled('phoneNumber') || contactVerified} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Email</Label>
              <Input type="email" placeholder="parent@example.com" {...F('email')} disabled={isPrefilled('email') || contactVerified} />
            </div>
          </div>

          {/* Identity */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Date of birth</Label>
              <Input type="date" {...F('dateOfBirth')} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Gender</Label>
              {isPrefilled('gender') ? (
                <Input value={value.gender ?? ''} disabled />
              ) : (
                <Select value={value.gender ?? ''} onValueChange={v => set({ gender: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">NIC</Label>
              <Input placeholder="NIC number" maxLength={12} {...F('nic')} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Birth cert. no.</Label>
              <Input placeholder="Birth certificate no." {...F('birthCertificateNo')} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Education level</Label>
              <Input placeholder="e.g., A/L, Degree" {...F('educationLevel')} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Workplace</Label>
              <Input placeholder="Workplace (optional)" {...F('workplace')} />
            </div>
          </div>

          {/* Occupation */}
          <div className="space-y-1">
            <Label className="text-[11px]">Occupation</Label>
            <Popover open={occupationOpen} onOpenChange={setOccupationOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between h-9 text-sm font-normal bg-background">
                  {value.occupation ? OCCUPATION_OPTIONS.find(o => o.value === value.occupation)?.label : 'Select occupation (optional)'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search occupation..." value={occupationSearch} onValueChange={setOccupationSearch} />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty>No occupation found.</CommandEmpty>
                    <CommandGroup>
                      {filteredOccupations.map(opt => (
                        <CommandItem key={opt.value} value={opt.value} onSelect={() => { set({ occupation: opt.value }); setOccupationSearch(''); setOccupationOpen(false); }}>
                          <Check className={cn('mr-2 h-4 w-4', value.occupation === opt.value ? 'opacity-100' : 'opacity-0')} />
                          {opt.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Address (collapsible) */}
          <div>
            <button type="button" onClick={() => setShowAddress(a => !a)} className="text-[11px] text-primary flex items-center gap-1 hover:underline">
              {showAddress ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showAddress ? 'Hide address' : 'Add address'}
            </button>
            {showAddress && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[11px]">Address</Label>
                  <Input placeholder="Street address" {...F('addressLine1')} />
                </div>
                <div className="space-y-1"><Label className="text-[11px]">City</Label><Input placeholder="City" {...F('city')} /></div>
                <div className="space-y-1"><Label className="text-[11px]">District</Label><Input placeholder="District" {...F('district')} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Province</Label><Input placeholder="Province" {...F('province')} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Postal code</Label><Input placeholder="Postal code" maxLength={6} {...F('postalCode')} /></div>
              </div>
            )}
          </div>

          {/* Optional WhatsApp/email verification to link an existing account */}
          {!value.existingUserId && !contactVerified && (value.phoneNumber || value.email) && (
            <div className="rounded-md bg-muted/30 p-2.5 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Optional — verify a contact to link an existing account and auto-fill {label.toLowerCase()} details.
              </p>
              {!verifyContact ? (
                <div className="flex gap-2 flex-wrap">
                  {value.phoneNumber && (
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setVerifyContact('phone')}>
                      <MessageCircle className="h-3.5 w-3.5" /> Verify phone
                    </Button>
                  )}
                  {value.email && (
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setVerifyContact('email')}>
                      <Mail className="h-3.5 w-3.5" /> Verify email
                    </Button>
                  )}
                </div>
              ) : verifyContact === 'phone' ? (
                <WhatsAppPhoneVerify
                  key={value.phoneNumber}
                  phoneNumber={value.phoneNumber!}
                  autoPoll
                  requestFn={async (pn) => {
                    const r = await registrationLinksApi.requestPhone(token, pn);
                    return { waLink: r.waLink, expiresAt: r.expiresAt, existingUserId: r.existingUserId };
                  }}
                  statusFn={(pn) => registrationLinksApi.phoneStatus(token, pn)}
                  onVerified={() => { setContactVerified(true); void runLookup({ phoneNumber: value.phoneNumber }); }}
                />
              ) : (
                <div className="space-y-1.5">
                  {!emailRequested ? (
                    <Button type="button" size="sm" className="h-8 text-xs" onClick={requestEmail} disabled={emailBusy}>
                      {emailBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send email code'}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Input value={emailCode} onChange={e => setEmailCode(e.target.value)} placeholder="6-digit code" maxLength={6} className="h-8" inputMode="numeric" />
                      <Button type="button" size="sm" className="h-8 text-xs" onClick={confirmEmail} disabled={!emailCode || emailBusy}>
                        {emailBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {lookupBusy && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking for existing account…
            </p>
          )}
          {value.existingUserId && (
            <p className="text-[11px] text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Linked to an existing account — known details filled.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ParentSection;
