import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GraduationCap } from 'lucide-react';
import { BLOOD_GROUPS } from '@/api/registration.api';
import type { CardDeliveryRecipient } from '@/api/registration.api';

export interface StudentFormData {
  emergencyContact: string;
  bloodGroup: string;
  medicalConditions: string;
  allergies: string;
  cardDeliveryRecipient: CardDeliveryRecipient | '';
}

export const emptyStudentForm = (): StudentFormData => ({
  emergencyContact: '',
  bloodGroup: '',
  medicalConditions: '',
  allergies: '',
  cardDeliveryRecipient: '',
});

interface StudentFormProps {
  data: StudentFormData;
  onChange: (data: StudentFormData) => void;
  showCardDelivery?: boolean;
  availableRecipients?: { value: CardDeliveryRecipient; label: string }[];
}

const StudentForm: React.FC<StudentFormProps> = ({ data, onChange, showCardDelivery = false, availableRecipients }) => {
  const update = (field: keyof StudentFormData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1 border-b border-border/50">
        <GraduationCap className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Student Information</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Emergency Contact</Label>
          <Input value={data.emergencyContact} onChange={e => update('emergencyContact', e.target.value)} placeholder="+94771234567" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Blood Group</Label>
          <Select value={data.bloodGroup} onValueChange={v => update('bloodGroup', v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {BLOOD_GROUPS.map(bg => (
                <SelectItem key={bg} value={bg}>{bg}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Medical Conditions</Label>
          <Input value={data.medicalConditions} onChange={e => update('medicalConditions', e.target.value)} placeholder="None" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Allergies</Label>
          <Input value={data.allergies} onChange={e => update('allergies', e.target.value)} placeholder="None" className="h-9" />
        </div>
      </div>
      {showCardDelivery && availableRecipients && availableRecipients.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">ID Card Delivery Recipient</Label>
          <Select value={data.cardDeliveryRecipient} onValueChange={v => update('cardDeliveryRecipient', v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Who should receive the ID card?" /></SelectTrigger>
            <SelectContent>
              {availableRecipients.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};

export default StudentForm;
