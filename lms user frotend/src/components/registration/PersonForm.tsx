import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhoneInput } from '@/components/ui/phone-input';
import { User, MapPin, Lock } from 'lucide-react';
import { DISTRICTS, DISTRICT_TO_PROVINCE } from '@/api/registration.api';
import type { Gender } from '@/api/registration.api';

export interface PersonFormData {
  firstName: string;
  lastName: string;
  nameWithInitials: string;
  email: string;
  phoneNumber: string;
  gender: Gender | '';
  dateOfBirth: string;
  nic: string;
  language: 'S' | 'E' | 'T';
  district: string;
  city: string;
  addressLine1: string;
  postalCode: string;
  instituteCode: string;
  // Parent-specific
  occupation?: string;
  workplace?: string;
  workPhone?: string;
  educationLevel?: string;
}

export const emptyPersonForm = (): PersonFormData => ({
  firstName: '',
  lastName: '',
  nameWithInitials: '',
  email: '',
  phoneNumber: '+94',
  gender: '',
  dateOfBirth: '',
  nic: '',
  language: 'E',
  district: '',
  city: '',
  addressLine1: '',
  postalCode: '',
  instituteCode: '',
  occupation: '',
  workplace: '',
  workPhone: '',
  educationLevel: '',
});

interface PersonFormProps {
  data: PersonFormData;
  onChange: (data: PersonFormData) => void;
  section: 'personal' | 'address' | 'parent-extra';
  emailLocked?: boolean;
  phoneLocked?: boolean;
  showParentFields?: boolean;
  showInstituteCode?: boolean;
}

const PersonForm: React.FC<PersonFormProps> = ({
  data,
  onChange,
  section,
  emailLocked = false,
  phoneLocked = false,
  showParentFields = false,
  showInstituteCode = true,
}) => {
  const update = (field: keyof PersonFormData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  if (section === 'personal') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-border/50">
          <User className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Personal Information</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">First Name *</Label>
            <Input value={data.firstName} onChange={e => update('firstName', e.target.value)} placeholder="John" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Last Name *</Label>
            <Input value={data.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Doe" className="h-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Name with Initials *</Label>
          <Input value={data.nameWithInitials} onChange={e => update('nameWithInitials', e.target.value)} placeholder="J. Doe" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            Email * {emailLocked && <Lock className="h-3 w-3 text-green-500" />}
          </Label>
          <Input type="email" value={data.email} disabled={emailLocked} className="h-9" readOnly={emailLocked} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Gender *</Label>
            <Select value={data.gender} onValueChange={v => update('gender', v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date of Birth</Label>
            <Input type="date" value={data.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} className="h-9" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              Phone {phoneLocked && <Lock className="h-3 w-3 text-green-500" />}
            </Label>
            <PhoneInput value={data.phoneNumber} onChange={v => update('phoneNumber', v)} disabled={phoneLocked} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">NIC Number</Label>
            <Input value={data.nic} onChange={e => update('nic', e.target.value)} placeholder="199512345678" className="h-9" maxLength={12} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Preferred Language</Label>
          <Select value={data.language} onValueChange={v => update('language', v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="E">English</SelectItem>
              <SelectItem value="S">සිංහල (Sinhala)</SelectItem>
              <SelectItem value="T">தமிழ் (Tamil)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (section === 'address') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-border/50">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Address Details</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">District *</Label>
            <Select value={data.district} onValueChange={v => update('district', v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select district" /></SelectTrigger>
              <SelectContent>
                {DISTRICTS.map(d => (
                  <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">City</Label>
            <Input value={data.city} onChange={e => update('city', e.target.value)} placeholder="Colombo" className="h-9" />
          </div>
        </div>
        {data.district && (
          <div className="text-xs text-muted-foreground bg-primary/10 p-2 rounded-lg">
            Province: {(DISTRICT_TO_PROVINCE[data.district] || '').replace(/_/g, ' ')}
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Address</Label>
          <Input value={data.addressLine1} onChange={e => update('addressLine1', e.target.value)} placeholder="123 Main Street" className="h-9" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Postal Code</Label>
            <Input value={data.postalCode} onChange={e => update('postalCode', e.target.value)} placeholder="00100" className="h-9" maxLength={5} />
          </div>
          {showInstituteCode && (
            <div className="space-y-1.5">
              <Label className="text-xs">Institute Code</Label>
              <Input value={data.instituteCode} onChange={e => update('instituteCode', e.target.value)} placeholder="INST-001" className="h-9" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (section === 'parent-extra' && showParentFields) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-border/50">
          <User className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Additional Details</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Occupation</Label>
            <Input value={data.occupation || ''} onChange={e => update('occupation', e.target.value)} placeholder="Engineer" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Workplace</Label>
            <Input value={data.workplace || ''} onChange={e => update('workplace', e.target.value)} placeholder="Company" className="h-9" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Work Phone</Label>
            <Input value={data.workPhone || ''} onChange={e => update('workPhone', e.target.value)} placeholder="+94112345678" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Education Level</Label>
            <Input value={data.educationLevel || ''} onChange={e => update('educationLevel', e.target.value)} placeholder="Bachelor's" className="h-9" />
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PersonForm;
