import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { systemAdminUserApi } from '@/api/systemAdminUser.api';
import { 
  CreateFamilyUnitRequest, 
  Gender, 
  Language,
  BloodGroup,
  InstituteUserType,
  UserType,
} from '@/types/user.types';
import { District, Province, Occupation } from '@/lib/enums';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  ChevronDown, 
  ChevronUp, 
  UserPlus, 
  Loader2, 
  Plus, 
  Trash2, 
  Building2,
  GraduationCap,
  BookOpen,
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// ========================================
// ZOD SCHEMAS
// ========================================

const subjectEnrollmentSchema = z.object({
  subjectId: z.string().optional().or(z.literal('')),
});

const classEnrollmentSchema = z.object({
  classId: z.string().min(1, 'Class is required'),
  subjectEnrollments: z.array(subjectEnrollmentSchema).optional(),
});

const instituteEnrollmentSchema = z.object({
  instituteId: z.string().min(1, 'Institute is required'),
  instituteUserType: z.nativeEnum(InstituteUserType).optional(),
  userIdByInstitute: z.string().optional(),
  instituteUserImageUrl: z.string().optional(),
  instituteCardId: z.string().optional(),
  classEnrollments: z.array(classEnrollmentSchema).optional(),
});

// Flexible user schema - all fields optional except email/phone validation
const flexibleUserSchema = z.object({
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phoneNumber: z.string().optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  firstName: z.string().max(50, 'First name too long').optional().or(z.literal('')),
  lastName: z.string().max(50, 'Last name too long').optional().or(z.literal('')),
  nameWithInitials: z.string().max(100, 'Name with initials too long').optional().or(z.literal('')),
  gender: z.nativeEnum(Gender).optional(),
  dateOfBirth: z.string().optional().or(z.literal('')),
  nic: z.string().optional().or(z.literal('')),
  birthCertificateNo: z.string().optional().or(z.literal('')),
  imageUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  rfid: z.string().max(20, 'RFID too long').optional().or(z.literal('')),
  language: z.nativeEnum(Language).optional(),
  addressLine1: z.string().max(200).optional().or(z.literal('')),
  addressLine2: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(50).optional().or(z.literal('')),
  province: z.string().optional().or(z.literal('')),
  district: z.string().optional().or(z.literal('')),
  postalCode: z.string().max(6).optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
});

const studentSchema = flexibleUserSchema.extend({
  studentId: z.string().max(15).optional().or(z.literal('')),
  emergencyContact: z.string().max(15).optional().or(z.literal('')),
  medicalConditions: z.string().optional().or(z.literal('')),
  allergies: z.string().optional().or(z.literal('')),
  bloodGroup: z.string().optional().or(z.literal('')),
  cardDeliveryRecipient: z.enum(['SELF', 'FATHER', 'MOTHER', 'GUARDIAN']).optional().or(z.literal('')),
});

const parentSchema = flexibleUserSchema.extend({
  occupation: z.string().optional().or(z.literal('')),
  workplace: z.string().max(100).optional().or(z.literal('')),
  workPhone: z.string().max(15).optional().or(z.literal('')),
  educationLevel: z.string().max(100).optional().or(z.literal('')),
  relationshipToStudent: z.string().optional().or(z.literal('')),
  isTeacher: z.boolean().default(false),
});

const formSchema = z.object({
  student: studentSchema,
  father: parentSchema.optional(),
  mother: parentSchema.optional(),
  guardian: parentSchema.optional(),
  instituteEnrollments: z.array(instituteEnrollmentSchema).optional(),
  sendWelcomeNotifications: z.boolean().default(true),
  autoActivateEnrollments: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

// ========================================
// CONSTANTS
// ========================================

const bloodGroups = Object.values(BloodGroup);
const languages = Object.values(Language);
const occupations = Object.values(Occupation);
const districts = Object.values(District);
const provinces = Object.values(Province);
const instituteUserTypes = [
  { value: InstituteUserType.STUDENT, label: 'Student' },
  { value: InstituteUserType.TEACHER, label: 'Teacher' },
  { value: InstituteUserType.PARENT, label: 'Parent' },
  { value: InstituteUserType.INSTITUTE_ADMIN, label: 'Institute Admin' },
  { value: InstituteUserType.ATTENDANCE_MARKER, label: 'Attendance Marker' },
];

// ========================================
// TOGGLE SECTION (Module-level to avoid remount on parent re-render)
// ========================================

function ToggleSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  badge,
}: {
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <Card>
      <CardHeader className="py-3 cursor-pointer" onClick={onToggle}>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>{icon}</span> {title}
            <Badge variant="outline" className="text-xs">{badge || 'Optional'}</Badge>
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {isOpen && <CardContent>{children}</CardContent>}
    </Card>
  );
}

// ========================================
// PERSON FIELDS (Module-level to avoid remount on parent re-render)
// ========================================

interface PersonFieldsProps {
  prefix: 'student' | 'father' | 'mother' | 'guardian';
  showStudentFields?: boolean;
  showParentFields?: boolean;
  showRelationship?: boolean;
  form: UseFormReturn<FormData>;
  showPasswords: Record<string, boolean>;
  togglePasswordVisibility: (field: string) => void;
}

function PersonFields({
  prefix,
  showStudentFields = false,
  showParentFields = false,
  showRelationship = false,
  form,
  showPasswords,
  togglePasswordVisibility,
}: PersonFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Teacher checkbox — shown only for parent sections */}
      {showParentFields && (
        <FormField
          control={form.control}
          name={`${prefix}.isTeacher` as any}
          render={({ field }) => (
            <FormItem className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30">
              <FormControl>
                <Checkbox
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                  id={`${prefix}-isTeacher`}
                />
              </FormControl>
              <div className="space-y-0.5">
                <FormLabel htmlFor={`${prefix}-isTeacher`} className="text-sm font-medium cursor-pointer">
                  This parent is also a Teacher
                </FormLabel>
                <FormDescription className="text-xs">
                  ✓ Checked → user type <strong>USER</strong> (can be assigned as parent &amp; teacher)
                  <br />✗ Unchecked → user type <strong>USER_WITHOUT_STUDENT</strong> (parent only)
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
      )}
    <Tabs defaultValue="contact" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="contact">Contact</TabsTrigger>
        <TabsTrigger value="personal">Personal</TabsTrigger>
        <TabsTrigger value="address">Address</TabsTrigger>
        <TabsTrigger value="additional">{showStudentFields ? 'Medical' : 'Work'}</TabsTrigger>
      </TabsList>

      {/* Contact Tab */}
      <TabsContent value="contact" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`${prefix}.email` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>Required if no phone number</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.phoneNumber` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0771234567 or +94771234567"
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>Required if no email</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.password` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Password
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help inline-flex"><Info className="h-3 w-3 text-muted-foreground" /></span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>If provided, user can login immediately. Otherwise, they&apos;ll set password via OTP on first login.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPasswords[`${prefix}.password`] ? 'text' : 'password'}
                      placeholder="Min 8 characters (optional)"
                      value={field.value as string || ''}
                      onChange={field.onChange}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => togglePasswordVisibility(`${prefix}.password`)}
                    >
                      {showPasswords[`${prefix}.password`] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.language` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred Language</FormLabel>
                <Select onValueChange={field.onChange} value={field.value as string || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {lang.charAt(0) + lang.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </TabsContent>

      {/* Personal Tab */}
      <TabsContent value="personal" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name={`${prefix}.firstName` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="First name"
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>Auto: &quot;Unknown&quot; if empty</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.lastName` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Last name"
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>Auto: &quot;User&quot; if empty</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.nameWithInitials` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name with Initials</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., K.M. Silva"
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>Auto-generated if empty</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.gender` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select onValueChange={field.onChange} value={field.value as string || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={Gender.MALE}>Male</SelectItem>
                    <SelectItem value={Gender.FEMALE}>Female</SelectItem>
                    <SelectItem value={Gender.OTHER}>Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.dateOfBirth` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.nic` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>NIC</FormLabel>
                <FormControl>
                  <Input
                    placeholder="10 or 12 characters"
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.birthCertificateNo` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Birth Certificate No</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Birth certificate number"
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.rfid` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  RFID Card
                  <Badge variant="outline" className="text-xs">Unique</Badge>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Physical access card ID"
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.imageUrl` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profile Image URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://..."
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {showStudentFields && (
            <FormField
              control={form.control}
              name="student.studentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student ID</FormLabel>
                  <FormControl>
                    <Input placeholder="Auto: STU-YYYYMMDD-XXX" {...field} />
                  </FormControl>
                  <FormDescription>Auto-generated if empty</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {showRelationship && (
            <FormField
              control={form.control}
              name="guardian.relationshipToStudent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship to Student</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Uncle, Grandfather" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      </TabsContent>

      {/* Address Tab */}
      <TabsContent value="address" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`${prefix}.addressLine1` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 1</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Street address"
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.addressLine2` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 2</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Apartment, suite, etc."
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.city` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input
                    placeholder="City"
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.postalCode` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal Code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="00700"
                    maxLength={6}
                    value={field.value as string || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.district` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>District</FormLabel>
                <Select onValueChange={field.onChange} value={field.value as string || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {districts.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${prefix}.province` as keyof FormData}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Province</FormLabel>
                <Select onValueChange={field.onChange} value={field.value as string || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {provinces.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </TabsContent>

      {/* Additional Tab - Medical for students, Work for parents */}
      <TabsContent value="additional" className="space-y-4">
        {showStudentFields ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="student.emergencyContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact</FormLabel>
                  <FormControl>
                    <Input placeholder="+94771234567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="student.bloodGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Blood Group</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select blood group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {bloodGroups.map((bg) => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="student.medicalConditions"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Medical Conditions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Asthma - mild, Diabetes Type 1"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="student.allergies"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Allergies</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Peanuts, Penicillin"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="student.cardDeliveryRecipient"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>ID Card Delivery Recipient</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Who should receive the physical ID card?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SELF">Student (Self)</SelectItem>
                      <SelectItem value="FATHER">Father</SelectItem>
                      <SelectItem value="MOTHER">Mother</SelectItem>
                      <SelectItem value="GUARDIAN">Guardian</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Select who should receive the physical ID card when it&apos;s printed</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : showParentFields && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name={`${prefix}.occupation` as keyof FormData}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Occupation</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value as string || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select occupation" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {occupations.map((occ) => (
                        <SelectItem key={occ} value={occ}>
                          {occ.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`${prefix}.workplace` as keyof FormData}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workplace</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Company/Organization name"
                      value={field.value as string || ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`${prefix}.workPhone` as keyof FormData}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work Phone</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+94112345678"
                      value={field.value as string || ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`${prefix}.educationLevel` as keyof FormData}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Education Level</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Bachelor's Degree"
                      value={field.value as string || ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </TabsContent>
    </Tabs>
    </div>
  );
}

// ========================================
// INSTITUTE ENROLLMENT FIELDS (Standalone Component)
// ========================================

interface InstituteEnrollmentFieldsProps {
  index: number;
  form: UseFormReturn<FormData>;
  removeInstitute: (index: number) => void;
  institutes: Array<{ id: string; name: string }>;
  institutesLoading?: boolean;
}

function InstituteEnrollmentFields({
  index,
  form,
  removeInstitute,
  institutes,
  institutesLoading = false,
}: InstituteEnrollmentFieldsProps) {
  const [classFields, setClassFields] = useState<number[]>([0]);
  const [subjectFields, setSubjectFields] = useState<Record<number, number[]>>({ 0: [0] });
  const [availableClasses, setAvailableClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Record<number, Array<{ id: string; name: string }>>>({});
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSubjectsFor, setLoadingSubjectsFor] = useState<Record<number, boolean>>({});

  // Use local state instead of form.watch() to avoid re-render cascades
  // form.watch() subscribes to ALL form changes, causing this component to
  // re-render on every keystroke/selection anywhere, which re-triggers the
  // useEffect and reloads classes, wiping selections.
  const [selectedInstituteId, setSelectedInstituteId] = useState(
    () => form.getValues(`instituteEnrollments.${index}.instituteId`) || ''
  );

  useEffect(() => {
    if (!selectedInstituteId) {
      setAvailableClasses([]);
      setAvailableSubjects({});
      return;
    }
    setLoadingClasses(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api.getClassesByInstitute(selectedInstituteId) as Promise<any>)
      .then((res) => {
        const raw = res?.data ?? res?.classes ?? res;
        const list = Array.isArray(raw) ? raw : [];
        setAvailableClasses(
          list.map((c: any) => ({
            id: String(c?.id ?? ''),
            name: c?.className ?? c?.name ?? String(c?.id ?? ''),
          }))
        );
      })
      .catch(() => setAvailableClasses([]))
      .finally(() => setLoadingClasses(false));
  }, [selectedInstituteId]);

  const handleClassChange = async (
    classIndex: number,
    classId: string,
    onChange: (v: string) => void
  ) => {
    onChange(classId);
    if (!classId) {
      setAvailableSubjects((prev) => ({ ...prev, [classIndex]: [] }));
      return;
    }
    setLoadingSubjectsFor((prev) => ({ ...prev, [classIndex]: true }));
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await api.getSubjectsByClass(classId, selectedInstituteId);
      const raw = res?.data ?? res?.subjects ?? res;
      const list = Array.isArray(raw) ? raw : [];
      setAvailableSubjects((prev) => ({
        ...prev,
        [classIndex]: list.map((s: any) => ({
          id: String(s?.subjectId ?? s?.subject?.id ?? s?.id ?? ''),
          name: s?.subject?.name ?? s?.subjectName ?? s?.name ?? String(s?.id ?? ''),
        })),
      }));
    } catch {
      setAvailableSubjects((prev) => ({ ...prev, [classIndex]: [] }));
    } finally {
      setLoadingSubjectsFor((prev) => ({ ...prev, [classIndex]: false }));
    }
  };

  const addClassEnrollment = () => {
    const newIdx = classFields.length > 0 ? Math.max(...classFields) + 1 : 0;
    setClassFields((prev) => [...prev, newIdx]);
    setSubjectFields((prev) => ({ ...prev, [newIdx]: [0] }));
  };

  const removeClassEnrollment = (ci: number) => {
    setClassFields((prev) => prev.filter((i) => i !== ci));
    setSubjectFields((prev) => { const n = { ...prev }; delete n[ci]; return n; });
    setAvailableSubjects((prev) => { const n = { ...prev }; delete n[ci]; return n; });
  };

  const addSubjectEnrollment = (ci: number) => {
    setSubjectFields((prev) => ({
      ...prev,
      [ci]: [...(prev[ci] || []), (prev[ci] && prev[ci].length > 0 ? Math.max(...prev[ci]) + 1 : 0)],
    }));
  };

  const removeSubjectEnrollment = (ci: number, si: number) => {
    setSubjectFields((prev) => ({
      ...prev,
      [ci]: prev[ci].filter((i) => i !== si),
    }));
  };

  return (
    <Card className="border-2 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Institute Enrollment #{index + 1}
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeInstitute(index)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Institute */}
          <FormField
            control={form.control}
            name={`instituteEnrollments.${index}.instituteId`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Institute *</FormLabel>
                <Select
                  onValueChange={(val) => {
                    field.onChange(val);
                    setSelectedInstituteId(val);
                  }}
                  value={field.value}
                  disabled={institutesLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          institutesLoading ? 'Loading institutes...' : 'Select institute'
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {institutes.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name}
                      </SelectItem>
                    ))}
                    {!institutesLoading && institutes.length === 0 && (
                      <SelectItem value="-" disabled>
                        No institutes found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Role in Institute */}
          <FormField
            control={form.control}
            name={`instituteEnrollments.${index}.instituteUserType`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role in Institute</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Default: Student" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {instituteUserTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Institute's User ID */}
          <FormField
            control={form.control}
            name={`instituteEnrollments.${index}.userIdByInstitute`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Institute&apos;s User ID</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., RC-2026-001" {...field} />
                </FormControl>
                <FormDescription>Internal ID used by institute</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Institute Card ID */}
          <FormField
            control={form.control}
            name={`instituteEnrollments.${index}.instituteCardId`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Institute Card ID</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., CARD-001234" {...field} />
                </FormControl>
                <FormDescription>Institute RFID/Barcode</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Institute Photo URL */}
          <FormField
            control={form.control}
            name={`instituteEnrollments.${index}.instituteUserImageUrl`}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Institute Photo URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://... (for ID card)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Class Enrollments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Class Enrollments
              {loadingClasses && (
                <Loader2 className="h-3 w-3 animate-spin ml-1" />
              )}
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addClassEnrollment}
              disabled={!selectedInstituteId}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Class
            </Button>
          </div>

          {!selectedInstituteId && (
            <p className="text-xs text-muted-foreground italic">
              Select an institute above to enable class enrollment.
            </p>
          )}

          {classFields.map((classIndex) => (
            <Card key={classIndex} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Class #{classIndex + 1}</span>
                  {classFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeClassEnrollment(classIndex)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`instituteEnrollments.${index}.classEnrollments.${classIndex}.classId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Class *</FormLabel>
                        <Select
                          onValueChange={(val) =>
                            handleClassChange(classIndex, val, field.onChange)
                          }
                          value={field.value || ''}
                          disabled={loadingClasses || !selectedInstituteId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  loadingClasses
                                    ? 'Loading classes...'
                                    : !selectedInstituteId
                                    ? 'Select institute first'
                                    : availableClasses.length === 0
                                    ? 'No classes available'
                                    : 'Select class'
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableClasses.map((cls) => (
                              <SelectItem key={cls.id} value={cls.id}>
                                {cls.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Subject Enrollments */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-3 w-3" />
                        Subject Enrollments ({subjectFields[classIndex]?.length || 0})
                        {loadingSubjectsFor[classIndex] && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                      </span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {subjectFields[classIndex]?.map((subjectIndex) => (
                      <div key={subjectIndex} className="flex items-center gap-2">
                        <FormField
                          control={form.control}
                          name={`instituteEnrollments.${index}.classEnrollments.${classIndex}.subjectEnrollments.${subjectIndex}.subjectId`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <Select
                                onValueChange={field.onChange}
                                value={field.value || ''}
                                disabled={loadingSubjectsFor[classIndex]}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={
                                        loadingSubjectsFor[classIndex]
                                          ? 'Loading subjects...'
                                          : (availableSubjects[classIndex] || []).length === 0
                                          ? 'Select class first'
                                          : 'Select subject'
                                      }
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {(availableSubjects[classIndex] || []).map((sub) => (
                                    <SelectItem key={sub.id} value={sub.id}>
                                      {sub.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {(subjectFields[classIndex]?.length || 0) > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSubjectEnrollment(classIndex, subjectIndex)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSubjectEnrollment(classIndex)}
                      className="w-full"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Subject
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

interface CreateFamilyUnitFormProps {
  onSuccess?: () => void;
}

export function CreateFamilyUnitForm({ onSuccess }: CreateFamilyUnitFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showFather, setShowFather] = useState(false);
  const [showMother, setShowMother] = useState(false);
  const [showGuardian, setShowGuardian] = useState(false);
  const [showInstituteEnrollment, setShowInstituteEnrollment] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Institutes fetched from API for enrollment
  const [instituteList, setInstituteList] = useState<Array<{ id: string; name: string }>>([]);
  const [institutesLoading, setInstitutesLoading] = useState(false);

  useEffect(() => {
    setInstitutesLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api.getInstitutes(1, 100) as Promise<any>)
      .then((res) => {
        const list = res?.data ?? res?.institutes ?? res;
        setInstituteList(
          (Array.isArray(list) ? list : []).map((i: any) => ({
            id: String(i?.id ?? i?.instituteId ?? ''),
            name: i?.instituteName ?? i?.name ?? String(i?.id ?? ''),
          }))
        );
      })
      .catch(() => setInstituteList([]))
      .finally(() => setInstitutesLoading(false));
  }, []);

  // Default values
  const defaultUserValues = {
    email: '',
    phoneNumber: '',
    password: '',
    firstName: '',
    lastName: '',
    nameWithInitials: '',
    gender: undefined,
    dateOfBirth: '',
    nic: '',
    birthCertificateNo: '',
    imageUrl: '',
    rfid: '',
    language: undefined,
    addressLine1: '',
    addressLine2: '',
    city: '',
    province: '',
    district: '',
    postalCode: '',
    country: '',
  };

  const defaultStudentValues = {
    ...defaultUserValues,
    studentId: '',
    emergencyContact: '',
    medicalConditions: '',
    allergies: '',
    bloodGroup: '',
  };

  const defaultParentValues = {
    ...defaultUserValues,
    occupation: '',
    workplace: '',
    workPhone: '',
    educationLevel: '',
    relationshipToStudent: '',
    isTeacher: false,
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student: defaultStudentValues,
      father: defaultParentValues,
      mother: defaultParentValues,
      guardian: defaultParentValues,
      instituteEnrollments: [],
      sendWelcomeNotifications: true,
      autoActivateEnrollments: true,
    },
  });

  // Institute enrollments field array
  const { fields: instituteFields, append: appendInstitute, remove: removeInstitute } = useFieldArray({
    control: form.control,
    name: 'instituteEnrollments',
  });

  // Validation
  const validateRequest = (data: FormData): string[] => {
    const errors: string[] = [];

    // Check if at least one parent with contact info exists
    const hasParentWithContact = 
      (showFather && data.father && (data.father.email || data.father.phoneNumber)) ||
      (showMother && data.mother && (data.mother.email || data.mother.phoneNumber)) ||
      (showGuardian && data.guardian && (data.guardian.email || data.guardian.phoneNumber));

    // Student must have email OR phone, unless a parent with contact info is provided
    if (!data.student.email && !data.student.phoneNumber && !hasParentWithContact) {
      errors.push('Student must have either email or phone number (or provide a parent with contact info)');
    }

    // Validate phone format if provided
    const phoneRegex = /^(\+94|0)\d{9}$/;
    if (data.student.phoneNumber && !phoneRegex.test(data.student.phoneNumber.replace(/\s/g, ''))) {
      errors.push('Invalid student phone format (use 0XXXXXXXXX or +94XXXXXXXXX)');
    }

    // Validate NIC format if provided
    const nicRegex = /^(\d{9}[VvXx]|\d{12})$/;
    if (data.student.nic && !nicRegex.test(data.student.nic)) {
      errors.push('Invalid NIC format (10 or 12 characters)');
    }

    // Validate parents if provided
    if (showFather && data.father) {
      if (!data.father.email && !data.father.phoneNumber) {
        errors.push('Father must have either email or phone number');
      }
    }

    if (showMother && data.mother) {
      if (!data.mother.email && !data.mother.phoneNumber) {
        errors.push('Mother must have either email or phone number');
      }
    }

    if (showGuardian && data.guardian) {
      if (!data.guardian.email && !data.guardian.phoneNumber) {
        errors.push('Guardian must have either email or phone number');
      }
    }

    return errors;
  };

  const onSubmit = async (data: FormData) => {
    // Validate
    const errors = validateRequest(data);
    if (errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: errors.join('. '),
        variant: 'destructive',
      });
      return;
    }

    // Build request
    const request: CreateFamilyUnitRequest = {
      student: { ...cleanUserData(data.student), userType: UserType.USER_WITHOUT_PARENT },
      sendWelcomeNotifications: data.sendWelcomeNotifications,
      autoActivateEnrollments: data.autoActivateEnrollments,
    };

    // Add parents if toggled and have contact info
    if (showFather && data.father && (data.father.email || data.father.phoneNumber)) {
      request.father = {
        ...cleanUserData(data.father),
        userType: data.father.isTeacher ? UserType.USER : UserType.USER_WITHOUT_STUDENT,
      };
    }
    if (showMother && data.mother && (data.mother.email || data.mother.phoneNumber)) {
      request.mother = {
        ...cleanUserData(data.mother),
        userType: data.mother.isTeacher ? UserType.USER : UserType.USER_WITHOUT_STUDENT,
      };
    }
    if (showGuardian && data.guardian && (data.guardian.email || data.guardian.phoneNumber)) {
      request.guardian = {
        ...cleanUserData(data.guardian),
        userType: data.guardian.isTeacher ? UserType.USER : UserType.USER_WITHOUT_STUDENT,
      };
    }

    // Add institute enrollments
    if (showInstituteEnrollment && data.instituteEnrollments && data.instituteEnrollments.length > 0) {
      request.instituteEnrollments = data.instituteEnrollments
        .filter(e => e && e.instituteId)
        .map(enrollment => ({
          instituteId: enrollment.instituteId,
          instituteUserType: enrollment.instituteUserType,
          userIdByInstitute: enrollment.userIdByInstitute || undefined,
          instituteUserImageUrl: enrollment.instituteUserImageUrl || undefined,
          instituteCardId: enrollment.instituteCardId || undefined,
          classEnrollments: (enrollment.classEnrollments || [])
            .filter((c): c is NonNullable<typeof c> => !!c && !!c.classId)
            .map(classEnr => ({
              classId: classEnr.classId,
              subjectEnrollments: (classEnr.subjectEnrollments || [])
                .filter((s): s is { subjectId: string } => !!s && !!s.subjectId)
                .map(s => ({ subjectId: s.subjectId })),
            })),
        }));
    }

    setLoading(true);
    try {
      const result = await systemAdminUserApi.createFamilyUnit(request);
      
      // Success toast with detailed info
      const summaryParts = [];
      summaryParts.push(`Student ID: ${result.student.studentId}`);
      if (result.summary) {
        if (result.summary.usersCreated > 1) {
          summaryParts.push(`${result.summary.usersCreated} users created`);
        }
        if (result.summary.parentsReused > 0) {
          summaryParts.push(`${result.summary.parentsReused} existing parent(s) linked`);
        }
        if (result.summary.institutesEnrolled > 0) {
          summaryParts.push(`Enrolled in ${result.summary.institutesEnrolled} institute(s)`);
        }
      }

      toast({
        title: 'Family Unit Created Successfully! ðŸŽ‰',
        description: summaryParts.join(' â€¢ '),
      });

      // Show password info if passwords were set
      if (result.student.hasPassword) {
        toast({
          title: 'Login Ready',
          description: 'Student can login immediately with the provided password.',
        });
      }

      // Show notification status
      if (result.notificationsSent?.student) {
        toast({
          title: 'Welcome Notification Sent',
          description: 'SMS/Email sent to student with login instructions.',
        });
      }

      form.reset();
      setShowFather(false);
      setShowMother(false);
      setShowGuardian(false);
      setShowInstituteEnrollment(false);
      onSuccess?.();
    } catch (error: unknown) {
      console.error('Error creating family:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create family unit. Please try again.';
      toast({
        title: 'Error Creating Family',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const cleanUserData = (data: Record<string, unknown>) => {
    const cleaned: Record<string, unknown> = {};
    // UI-only fields that must not be sent to the backend
    const uiOnlyFields = new Set(['isTeacher']);
    Object.entries(data).forEach(([key, value]) => {
      if (uiOnlyFields.has(key)) return;
      if (value !== '' && value !== undefined && value !== null) {
        cleaned[key] = value;
      }
    });
    return cleaned;
  };

  const togglePasswordVisibility = useCallback((field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  }, []);

  // ========================================
  // MAIN RENDER
  // ========================================
  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <ScrollArea className="flex-1">
      <Form {...form}>
        <form id="create-family-form" onSubmit={form.handleSubmit(onSubmit, (errors) => {
          const firstError = Object.values(errors).flatMap((e: any) =>
            typeof e?.message === 'string' ? [e.message] : Object.values(e || {}).map((v: any) => v?.message).filter(Boolean)
          )[0];
          if (firstError) {
            toast({ title: 'Validation Error', description: firstError as string, variant: 'destructive' });
          }
        })} className="space-y-6 p-1">
          {/* Info Banner */}
          <Card className="bg-accent/30 border-accent">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Flexible Data Requirements</p>
                  <p className="text-xs text-muted-foreground">
                    Only <strong>Email OR Phone</strong> is required per person. All other fields are optional.
                    If password is provided, user can login immediately. System admin created users are auto-activated.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Student Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span>ðŸ‘¨â€ðŸŽ“</span> Student
                <Badge>Required</Badge>
              </CardTitle>
              <CardDescription>
                Basic student information. Email or phone number is required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PersonFields prefix="student" showStudentFields form={form} showPasswords={showPasswords} togglePasswordVisibility={togglePasswordVisibility} />
            </CardContent>
          </Card>

          {/* Father Section */}
          <ToggleSection
            title="Add Father"
            icon="ðŸ‘¨"
            isOpen={showFather}
            onToggle={() => setShowFather(!showFather)}
          >
            <PersonFields prefix="father" showParentFields form={form} showPasswords={showPasswords} togglePasswordVisibility={togglePasswordVisibility} />
          </ToggleSection>

          {/* Mother Section */}
          <ToggleSection
            title="Add Mother"
            icon="ðŸ‘©"
            isOpen={showMother}
            onToggle={() => setShowMother(!showMother)}
          >
            <PersonFields prefix="mother" showParentFields form={form} showPasswords={showPasswords} togglePasswordVisibility={togglePasswordVisibility} />
          </ToggleSection>

          {/* Guardian Section */}
          <ToggleSection
            title="Add Guardian"
            icon="ðŸ‘¤"
            isOpen={showGuardian}
            onToggle={() => setShowGuardian(!showGuardian)}
          >
            <PersonFields prefix="guardian" showParentFields showRelationship form={form} showPasswords={showPasswords} togglePasswordVisibility={togglePasswordVisibility} />
          </ToggleSection>

          {/* Institute Enrollments Section */}
          <ToggleSection
            title="Institute Enrollments"
            icon="ðŸ«"
            isOpen={showInstituteEnrollment}
            onToggle={() => setShowInstituteEnrollment(!showInstituteEnrollment)}
            badge="Nested"
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enroll student in institutes with optional class and subject assignments. 
                All enrollments are auto-activated and verified for system admin created users.
              </p>

              {instituteFields.map((field, index) => (
                <InstituteEnrollmentFields
                  key={field.id || index}
                  index={index}
                  form={form}
                  removeInstitute={removeInstitute}
                  institutes={instituteList}
                  institutesLoading={institutesLoading}
                />
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() => appendInstitute({
                  instituteId: '',
                  instituteUserType: InstituteUserType.STUDENT,
                  userIdByInstitute: '',
                  instituteCardId: '',
                  instituteUserImageUrl: '',
                  classEnrollments: [],
                })}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Institute Enrollment
              </Button>
            </div>
          </ToggleSection>

          {/* Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span>âš™ï¸</span> Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="sendWelcomeNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Send welcome notifications</FormLabel>
                      <FormDescription>
                        Send SMS/Email with login instructions (if no password provided, includes OTP setup link)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="autoActivateEnrollments"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Auto-activate enrollments</FormLabel>
                      <FormDescription>
                        Automatically verify and activate all institute/class/subject enrollments (bypasses approval workflow)
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit */}
        </form>
      </Form>
      </ScrollArea>

      {/* Action buttons — outside ScrollArea so they're always visible */}
      <div className="flex gap-3 py-4 border-t bg-background mt-2">
        <Button type="submit" form="create-family-form" disabled={loading} className="flex-1">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Family Unit...
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Create Family Unit
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            form.reset();
            setShowFather(false);
            setShowMother(false);
            setShowGuardian(false);
            setShowInstituteEnrollment(false);
          }}
          disabled={loading}
        >
          Clear Form
        </Button>
      </div>
    </div>
  );
}
