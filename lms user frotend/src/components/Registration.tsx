import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, ChevronRight, Loader2, CheckCircle2, Check,
  Users, GraduationCap, Shield, UserPlus, SkipForward, X,
  UserCircle, ClipboardCheck, Heart,
} from 'lucide-react';
import surakshaLogo from '@/assets/suraksha-logo.png';

import { useToast } from '@/hooks/use-toast';
import {
  registerUser,
  DISTRICT_TO_PROVINCE,
  type CreateUserRequest,
  type Gender,
} from '@/api/registration.api';
import OtpVerificationStep from '@/components/registration/OtpVerificationStep';
import PersonForm, { type PersonFormData, emptyPersonForm } from '@/components/registration/PersonForm';
import StudentForm, { type StudentFormData, emptyStudentForm } from '@/components/registration/StudentForm';

// ============= TYPES =============

type AccountType = 'student-with-parent' | 'student-without-parent' | 'parent' | 'teacher' | 'institute-admin' | 'attendance-marker';
type ParentRole = 'father' | 'mother' | 'guardian';

interface ParentEntry {
  role: ParentRole;
  skipped: boolean;
  skipReason: string;
  verified: boolean;
  email: string;
  phone: string;
  formData: PersonFormData;
  formSection: 'personal' | 'address' | 'parent-extra';
  registeredId?: string;
}

type FlowStep =
  | 'select-type'
  | 'parent-role-question'
  | 'parent-overview'
  | `parent-verify-${ParentRole}`
  | `parent-form-${ParentRole}-${'personal' | 'address' | 'parent-extra'}`
  | `parent-skip-${ParentRole}`
  | 'student-verify'
  | 'student-personal'
  | 'student-address'
  | 'student-info'
  | 'solo-student-verify'
  | 'solo-student-personal'
  | 'solo-student-address'
  | 'solo-student-info'
  | 'parent-only-verify'
  | 'parent-only-personal'
  | 'parent-only-address'
  | 'parent-only-extra'
  | 'simple-verify'
  | 'simple-personal'
  | 'simple-address'
  | 'review'
  | 'submitting'
  | 'success';

interface RegistrationProps {
  onBack: () => void;
  onComplete: () => void;
}

// Step indicator
const StepIndicator: React.FC<{ steps: string[]; current: number }> = ({ steps, current }) => (
  <div className="flex items-center justify-center gap-0 w-full max-w-sm mx-auto">
    {steps.map((label, i) => (
      <React.Fragment key={i}>
        <div className="flex flex-col items-center gap-1">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
            i < current ? 'bg-primary border-primary text-primary-foreground'
              : i === current ? 'bg-primary border-primary text-primary-foreground'
              : 'bg-background border-muted-foreground/30 text-muted-foreground'
          }`}>
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={`text-[10px] font-medium whitespace-nowrap ${i <= current ? 'text-primary' : 'text-muted-foreground'}`}>
            {label}
          </span>
        </div>
        {i < steps.length - 1 && (
          <div className={`flex-1 h-0.5 mx-1 mt-[-16px] min-w-[20px] ${i < current ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// ============= MAIN COMPONENT =============

const Registration: React.FC<RegistrationProps> = ({ onBack, onComplete }) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [flowStep, setFlowStep] = useState<FlowStep>('select-type');
  const [accountType, setAccountType] = useState<AccountType>('student-with-parent');

  // Parent entries for student-with-parent flow
  const [parents, setParents] = useState<ParentEntry[]>([
    { role: 'father', skipped: false, skipReason: '', verified: false, email: '', phone: '', formData: emptyPersonForm(), formSection: 'personal' },
    { role: 'mother', skipped: false, skipReason: '', verified: false, email: '', phone: '', formData: emptyPersonForm(), formSection: 'personal' },
    { role: 'guardian', skipped: false, skipReason: '', verified: false, email: '', phone: '', formData: emptyPersonForm(), formSection: 'personal' },
  ]);

  // Student form data
  const [studentVerified, setStudentVerified] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentPersonal, setStudentPersonal] = useState<PersonFormData>(emptyPersonForm());
  const [studentInfo, setStudentInfo] = useState<StudentFormData>(emptyStudentForm());

  // Simple flow (teacher/admin)
  const [simpleVerified, setSimpleVerified] = useState(false);
  const [simpleEmail, setSimpleEmail] = useState('');
  const [simplePhone, setSimplePhone] = useState('');
  const [simplePersonal, setSimplePersonal] = useState<PersonFormData>(emptyPersonForm());

  // Parent role question: does this parent also work as teacher/admin?
  const [parentAlsoWorksAtInstitute, setParentAlsoWorksAtInstitute] = useState(false);

  // Solo student (without parent) form data
  const [soloStudentVerified, setSoloStudentVerified] = useState(false);
  const [soloStudentEmail, setSoloStudentEmail] = useState('');
  const [soloStudentPhone, setSoloStudentPhone] = useState('');
  const [soloStudentPersonal, setSoloStudentPersonal] = useState<PersonFormData>(emptyPersonForm());
  const [soloStudentInfo, setSoloStudentInfo] = useState<StudentFormData>(emptyStudentForm());

  // Parent-only form data
  const [parentOnlyVerified, setParentOnlyVerified] = useState(false);
  const [parentOnlyEmail, setParentOnlyEmail] = useState('');
  const [parentOnlyPhone, setParentOnlyPhone] = useState('');
  const [parentOnlyPersonal, setParentOnlyPersonal] = useState<PersonFormData>(emptyPersonForm());

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ============= URL SYNC =============

  useEffect(() => {
    const routeMap: Record<string, string> = {
      'select-type': '/register/step1',
      'parent-role-question': '/register/step1',
      'parent-overview': '/register/parents',
      'student-verify': '/register/verify',
      'student-personal': '/register/student',
      'student-address': '/register/student',
      'student-info': '/register/student',
      'solo-student-verify': '/register/verify',
      'solo-student-personal': '/register/details/personal-information',
      'solo-student-address': '/register/details/address',
      'solo-student-info': '/register/details/additional',
      'parent-only-verify': '/register/verify',
      'parent-only-personal': '/register/details/personal-information',
      'parent-only-address': '/register/details/address',
      'parent-only-extra': '/register/details/additional',
      'simple-verify': '/register/verify',
      'simple-personal': '/register/details/personal-information',
      'simple-address': '/register/details/address',
      'review': '/register/review',
      'success': '/register/review',
    };

    // Handle dynamic parent steps
    let route = routeMap[flowStep];
    if (!route) {
      if (flowStep.startsWith('parent-verify-') || flowStep.startsWith('parent-skip-')) {
        route = '/register/verify';
      } else if (flowStep.startsWith('parent-form-')) {
        const match = flowStep.match(/-(personal|address|parent-extra)$/);
        if (match) {
          route = match[1] === 'personal' ? '/register/details/personal-information'
            : match[1] === 'address' ? '/register/details/address'
            : '/register/details/additional';
        }
      }
    }

    if (route) {
      navigate(route, { replace: true });
    }
  }, [flowStep, navigate]);

  // ============= HELPERS =============

  const updateParent = (role: ParentRole, updates: Partial<ParentEntry>) => {
    setParents(prev => prev.map(p => p.role === role ? { ...p, ...updates } : p));
  };

  const getParent = (role: ParentRole) => parents.find(p => p.role === role)!;

  const hasAtLeastOneParent = () => parents.some(p => !p.skipped && p.verified);
  const allParentsHandled = () => parents.every(p => p.skipped || p.registeredId);

  const parentRoles: ParentRole[] = ['father', 'mother', 'guardian'];
  const parentLabels: Record<ParentRole, string> = { father: 'Father', mother: 'Mother', guardian: 'Guardian' };

  // ============= STEP INDICATOR LOGIC =============

  const getStepInfo = (): { steps: string[]; current: number } => {
    if (accountType === 'student-with-parent') {
      const steps = ['Type', 'Parents', 'Student', 'Review'];
      if (flowStep === 'select-type') return { steps, current: 0 };
      if (flowStep === 'parent-overview' || flowStep.startsWith('parent-')) return { steps, current: 1 };
      if (flowStep.startsWith('student-')) return { steps, current: 2 };
      return { steps, current: 3 };
    }
    if (accountType === 'student-without-parent') {
      const steps = ['Type', 'Verify', 'Details', 'Review'];
      if (flowStep === 'select-type') return { steps, current: 0 };
      if (flowStep === 'solo-student-verify') return { steps, current: 1 };
      if (flowStep === 'solo-student-personal' || flowStep === 'solo-student-address' || flowStep === 'solo-student-info') return { steps, current: 2 };
      return { steps, current: 3 };
    }
    if (accountType === 'parent') {
      const steps = ['Type', 'Role', 'Verify', 'Details', 'Review'];
      if (flowStep === 'select-type') return { steps, current: 0 };
      if (flowStep === 'parent-role-question') return { steps, current: 1 };
      if (flowStep === 'parent-only-verify') return { steps, current: 2 };
      if (flowStep === 'parent-only-personal' || flowStep === 'parent-only-address' || flowStep === 'parent-only-extra') return { steps, current: 3 };
      return { steps, current: 4 };
    }
    const steps = ['Type', 'Verify', 'Details', 'Review'];
    if (flowStep === 'select-type') return { steps, current: 0 };
    if (flowStep === 'simple-verify') return { steps, current: 1 };
    if (flowStep === 'simple-personal' || flowStep === 'simple-address') return { steps, current: 2 };
    return { steps, current: 3 };
  };

  // ============= PARENT FLOW NAVIGATION =============

  const nextParentFormSection = (role: ParentRole, currentSection: 'personal' | 'address' | 'parent-extra'): FlowStep | null => {
    if (currentSection === 'personal') return `parent-form-${role}-address`;
    if (currentSection === 'address') return `parent-form-${role}-parent-extra`;
    return null; // done with this parent
  };

  const getNextParentStep = (currentRole: ParentRole): FlowStep => {
    const idx = parentRoles.indexOf(currentRole);
    if (idx < parentRoles.length - 1) {
      const nextRole = parentRoles[idx + 1];
      return `parent-verify-${nextRole}`;
    }
    // All parents done, go to student
    return 'student-verify';
  };

  const finishParentForm = (role: ParentRole) => {
    // Register this parent, then move to next
    registerParent(role);
  };

  // ============= API: Register Parent =============

  const registerParent = async (role: ParentRole) => {
    const parent = getParent(role);
    const fd = parent.formData;
    setIsLoading(true);
    setError('');

    const province = DISTRICT_TO_PROVINCE[fd.district] || '';
    const payload: CreateUserRequest = {
      firstName: fd.firstName,
      lastName: fd.lastName,
      nameWithInitials: fd.nameWithInitials || undefined,
      email: parent.email,
      userType: 'USER_WITHOUT_STUDENT',
      gender: (fd.gender || 'OTHER') as Gender,
      district: fd.district,
      province,
      country: 'Sri Lanka',
      phoneNumber: parent.phone || undefined,
      dateOfBirth: fd.dateOfBirth || undefined,
      nic: fd.nic || undefined,
      addressLine1: fd.addressLine1 || undefined,
      city: fd.city || undefined,
      postalCode: fd.postalCode || undefined,
      language: fd.language,
      parentData: {
        occupation: fd.occupation || undefined,
        workplace: fd.workplace || undefined,
        workPhone: fd.workPhone || undefined,
        educationLevel: fd.educationLevel || undefined,
      },
    };

    try {
      const result = await registerUser(payload);
      updateParent(role, { registeredId: result?.user?.id });
      toast({ title: `${parentLabels[role]} Registered`, description: `${fd.firstName} has been registered successfully.` });
      setFlowStep(getNextParentStep(role));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Registration failed';
      const isApiErr = typeof msg === 'string' && !msg.startsWith('Cannot read');
      setError(isApiErr ? msg : 'Registration failed. Please try again.');
      toast({ title: 'Registration Failed', description: isApiErr ? msg : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ============= API: Register Student =============

  const registerStudent = async () => {
    setIsLoading(true);
    setError('');

    const fd = studentPersonal;
    const province = DISTRICT_TO_PROVINCE[fd.district] || '';
    const father = getParent('father');
    const mother = getParent('mother');
    const guardian = getParent('guardian');

    const payload: CreateUserRequest = {
      firstName: fd.firstName,
      lastName: fd.lastName,
      nameWithInitials: fd.nameWithInitials || undefined,
      email: studentEmail || undefined,
      userType: 'USER',
      gender: (fd.gender || 'OTHER') as Gender,
      district: fd.district,
      province,
      country: 'Sri Lanka',
      phoneNumber: studentPhone || undefined,
      dateOfBirth: fd.dateOfBirth || undefined,
      nic: fd.nic || undefined,
      addressLine1: fd.addressLine1 || undefined,
      city: fd.city || undefined,
      postalCode: fd.postalCode || undefined,
      language: fd.language,
      studentData: {
        emergencyContact: studentInfo.emergencyContact || undefined,
        bloodGroup: studentInfo.bloodGroup || undefined,
        medicalConditions: studentInfo.medicalConditions || undefined,
        allergies: studentInfo.allergies || undefined,
        cardDeliveryRecipient: studentInfo.cardDeliveryRecipient || undefined,
        fatherId: father.registeredId || undefined,
        fatherPhoneNumber: father.phone || undefined,
        motherId: mother.registeredId || undefined,
        motherPhoneNumber: mother.phone || undefined,
        guardianId: guardian.registeredId || undefined,
        guardianPhoneNumber: guardian.phone || undefined,
        fatherSkipReason: father.skipped ? father.skipReason : undefined,
        motherSkipReason: mother.skipped ? mother.skipReason : undefined,
        guardianSkipReason: guardian.skipped ? guardian.skipReason : undefined,
      },
    };

    if (fd.instituteCode) {
      payload.institute = { instituteCode: fd.instituteCode };
    }

    try {
      await registerUser(payload);
      toast({ title: 'Account Created!', description: `Welcome ${fd.firstName}!` });
      setFlowStep('success');
      setTimeout(() => onComplete(), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Registration failed';
      const isApiErr = typeof msg === 'string' && !msg.startsWith('Cannot read');
      setError(isApiErr ? msg : 'Registration failed. Please try again.');
      toast({ title: 'Registration Failed', description: isApiErr ? msg : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ============= API: Register Teacher/Admin/Marker =============

  const registerSimple = async () => {
    setIsLoading(true);
    setError('');

    const fd = simplePersonal;
    const province = DISTRICT_TO_PROVINCE[fd.district] || '';
    const payload: CreateUserRequest = {
      firstName: fd.firstName,
      lastName: fd.lastName,
      nameWithInitials: fd.nameWithInitials || undefined,
      email: simpleEmail,
      userType: 'USER_WITHOUT_PARENT',
      gender: (fd.gender || 'OTHER') as Gender,
      district: fd.district,
      province,
      country: 'Sri Lanka',
      phoneNumber: simplePhone || undefined,
      dateOfBirth: fd.dateOfBirth || undefined,
      nic: fd.nic || undefined,
      addressLine1: fd.addressLine1 || undefined,
      city: fd.city || undefined,
      postalCode: fd.postalCode || undefined,
      language: fd.language,
      studentData: {},
    };

    if (fd.instituteCode) {
      payload.institute = { instituteCode: fd.instituteCode };
    }

    try {
      await registerUser(payload);
      toast({ title: 'Account Created!', description: `Welcome ${fd.firstName}!` });
      setFlowStep('success');
      setTimeout(() => onComplete(), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Registration failed';
      const isApiErr = typeof msg === 'string' && !msg.startsWith('Cannot read');
      setError(isApiErr ? msg : 'Registration failed. Please try again.');
      toast({ title: 'Registration Failed', description: isApiErr ? msg : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ============= API: Register Solo Student (without parent) =============

  const registerSoloStudent = async () => {
    setIsLoading(true);
    setError('');

    const fd = soloStudentPersonal;
    const province = DISTRICT_TO_PROVINCE[fd.district] || '';
    const payload: CreateUserRequest = {
      firstName: fd.firstName,
      lastName: fd.lastName,
      nameWithInitials: fd.nameWithInitials || undefined,
      email: soloStudentEmail,
      userType: 'USER_WITHOUT_PARENT',
      gender: (fd.gender || 'OTHER') as Gender,
      district: fd.district,
      province,
      country: 'Sri Lanka',
      phoneNumber: soloStudentPhone || undefined,
      dateOfBirth: fd.dateOfBirth || undefined,
      nic: fd.nic || undefined,
      addressLine1: fd.addressLine1 || undefined,
      city: fd.city || undefined,
      postalCode: fd.postalCode || undefined,
      language: fd.language,
      studentData: {
        emergencyContact: soloStudentInfo.emergencyContact || undefined,
        bloodGroup: soloStudentInfo.bloodGroup || undefined,
        medicalConditions: soloStudentInfo.medicalConditions || undefined,
        allergies: soloStudentInfo.allergies || undefined,
      },
    };

    if (fd.instituteCode) {
      payload.institute = { instituteCode: fd.instituteCode };
    }

    try {
      await registerUser(payload);
      toast({ title: 'Account Created!', description: `Welcome ${fd.firstName}!` });
      setFlowStep('success');
      setTimeout(() => onComplete(), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Registration failed';
      const isApiErr = typeof msg === 'string' && !msg.startsWith('Cannot read');
      setError(isApiErr ? msg : 'Registration failed. Please try again.');
      toast({ title: 'Registration Failed', description: isApiErr ? msg : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ============= API: Register Parent Only =============

  const registerParentOnly = async () => {
    setIsLoading(true);
    setError('');

    const fd = parentOnlyPersonal;
    const province = DISTRICT_TO_PROVINCE[fd.district] || '';

    // If parent also works at institute → USER (full flexibility, creates student+parent)
    // Otherwise → USER_WITHOUT_STUDENT (parent only)
    const userType = parentAlsoWorksAtInstitute ? 'USER' : 'USER_WITHOUT_STUDENT';

    const payload: CreateUserRequest = {
      firstName: fd.firstName,
      lastName: fd.lastName,
      nameWithInitials: fd.nameWithInitials || undefined,
      email: parentOnlyEmail,
      userType,
      gender: (fd.gender || 'OTHER') as Gender,
      district: fd.district,
      province,
      country: 'Sri Lanka',
      phoneNumber: parentOnlyPhone || undefined,
      dateOfBirth: fd.dateOfBirth || undefined,
      nic: fd.nic || undefined,
      addressLine1: fd.addressLine1 || undefined,
      city: fd.city || undefined,
      postalCode: fd.postalCode || undefined,
      language: fd.language,
      parentData: {
        occupation: fd.occupation || undefined,
        workplace: fd.workplace || undefined,
        workPhone: fd.workPhone || undefined,
        educationLevel: fd.educationLevel || undefined,
      },
    };

    // USER type requires studentData too
    if (parentAlsoWorksAtInstitute) {
      payload.studentData = {};
    }

    if (fd.instituteCode) {
      payload.institute = { instituteCode: fd.instituteCode };
    }

    try {
      await registerUser(payload);
      toast({ title: 'Account Created!', description: `Welcome ${fd.firstName}!` });
      setFlowStep('success');
      setTimeout(() => onComplete(), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Registration failed';
      const isApiErr = typeof msg === 'string' && !msg.startsWith('Cannot read');
      setError(isApiErr ? msg : 'Registration failed. Please try again.');
      toast({ title: 'Registration Failed', description: isApiErr ? msg : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ============= VALIDATION =============

  const isPersonalValid = (d: PersonFormData) => !!d.firstName && !!d.lastName && !!d.nameWithInitials && !!d.gender;
  const isAddressValid = (d: PersonFormData) => !!d.district;

  // ============= BACK NAVIGATION =============

  const handleBack = () => {
    switch (flowStep) {
      case 'select-type': onBack(); break;

      // Parent role question
      case 'parent-role-question': setFlowStep('select-type'); break;

      // Student-with-parent flow
      case 'parent-overview': setFlowStep('select-type'); break;
      case 'parent-verify-father': setFlowStep('parent-overview'); break;
      case 'parent-skip-father': setFlowStep('parent-overview'); break;
      case 'parent-form-father-personal': setFlowStep(`parent-verify-father`); break;
      case 'parent-form-father-address': setFlowStep(`parent-form-father-personal`); break;
      case 'parent-form-father-parent-extra': setFlowStep(`parent-form-father-address`); break;

      case 'parent-verify-mother': {
        const f = getParent('father');
        setFlowStep(f.skipped ? 'parent-overview' : (f.registeredId ? 'parent-overview' : 'parent-verify-father'));
        break;
      }
      case 'parent-skip-mother': setFlowStep('parent-verify-mother'); break;
      case 'parent-form-mother-personal': setFlowStep('parent-verify-mother'); break;
      case 'parent-form-mother-address': setFlowStep('parent-form-mother-personal'); break;
      case 'parent-form-mother-parent-extra': setFlowStep('parent-form-mother-address'); break;

      case 'parent-verify-guardian': {
        const m = getParent('mother');
        setFlowStep(m.skipped ? 'parent-verify-mother' : (m.registeredId ? 'parent-verify-mother' : 'parent-verify-mother'));
        break;
      }
      case 'parent-skip-guardian': setFlowStep('parent-verify-guardian'); break;
      case 'parent-form-guardian-personal': setFlowStep('parent-verify-guardian'); break;
      case 'parent-form-guardian-address': setFlowStep('parent-form-guardian-personal'); break;
      case 'parent-form-guardian-parent-extra': setFlowStep('parent-form-guardian-address'); break;

      case 'student-verify': setFlowStep('parent-overview'); break;
      case 'student-personal': setFlowStep('student-verify'); break;
      case 'student-address': setFlowStep('student-personal'); break;
      case 'student-info': setFlowStep('student-address'); break;

      // Solo student flow (without parent)
      case 'solo-student-verify': setFlowStep('select-type'); break;
      case 'solo-student-personal': setFlowStep('solo-student-verify'); break;
      case 'solo-student-address': setFlowStep('solo-student-personal'); break;
      case 'solo-student-info': setFlowStep('solo-student-address'); break;

      // Parent-only flow
      case 'parent-only-verify': setFlowStep('parent-role-question'); break;
      case 'parent-only-personal': setFlowStep('parent-only-verify'); break;
      case 'parent-only-address': setFlowStep('parent-only-personal'); break;
      case 'parent-only-extra': setFlowStep('parent-only-address'); break;

      // Simple flow (teacher/admin/marker)
      case 'simple-verify': setFlowStep('select-type'); break;
      case 'simple-personal': setFlowStep('simple-verify'); break;
      case 'simple-address': setFlowStep('simple-personal'); break;

      case 'review': {
        if (accountType === 'student-with-parent') setFlowStep('student-info');
        else if (accountType === 'student-without-parent') setFlowStep('solo-student-info');
        else if (accountType === 'parent') setFlowStep('parent-only-extra');
        else setFlowStep('simple-address');
        break;
      }
      default: setFlowStep('select-type');
    }
  };

  // ============= SUCCESS SCREEN =============

  if (flowStep === 'success') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-5">
        <Card className="w-full max-w-md border-border/50 shadow-lg">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">Account Created!</h2>
            <p className="text-muted-foreground">
              Your account has been created successfully. You can now activate your account using the "Activate your account" option on the login page.
            </p>
            <Button onClick={onComplete} className="w-full h-11">Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { steps: stepLabels, current: currentStepIdx } = getStepInfo();

  // ============= RENDER FLOW CONTENT =============

  const renderContent = () => {
    // ---- SELECT TYPE ----
    if (flowStep === 'select-type') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Select the type of account you want to create:</p>
          {([
            { value: 'parent' as AccountType, label: 'Parent / Guardian', desc: 'Register as a parent or guardian of a student', icon: Heart },
            { value: 'student-without-parent' as AccountType, label: 'Student (No Parent)', desc: 'Register as a student without parent accounts', icon: UserCircle },
            { value: 'student-with-parent' as AccountType, label: 'Student with Parent', desc: 'Register student with father/mother/guardian accounts', icon: GraduationCap },
            { value: 'teacher' as AccountType, label: 'Teacher', desc: 'Register as a teacher', icon: Users },
            { value: 'institute-admin' as AccountType, label: 'Institute Admin', desc: 'Register as an institute administrator', icon: Shield },
            { value: 'attendance-marker' as AccountType, label: 'Attendance Marker', desc: 'Register as an attendance marker', icon: ClipboardCheck },
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setAccountType(opt.value)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                accountType === opt.value
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <opt.icon className={`h-6 w-6 shrink-0 ${accountType === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex-1">
                <div className="font-medium text-foreground">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </div>
              {accountType === opt.value && <ChevronRight className="h-5 w-5 text-primary" />}
            </button>
          ))}
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="h-11" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button
              className="flex-1 h-11"
              onClick={() => {
                if (accountType === 'student-with-parent') setFlowStep('parent-overview');
                else if (accountType === 'student-without-parent') setFlowStep('solo-student-verify');
                else if (accountType === 'parent') setFlowStep('parent-role-question');
                else setFlowStep('simple-verify');
              }}
            >
              Continue <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    // ---- PARENT OVERVIEW ----
    if (flowStep === 'parent-overview') {
      const anyCreated = parents.some(p => p.registeredId);
      const canGoToStudent = parents.some(p => p.registeredId) && parents.every(p => p.skipped || p.registeredId);

      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">Parent / Guardian Registration</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Register at least one parent or guardian. You can skip the others with a reason.
            </p>
          </div>

          {parentRoles.map(role => {
            const p = getParent(role);
            return (
              <div
                key={role}
                className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${
                  p.registeredId ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                  : p.skipped ? 'border-muted bg-muted/30 opacity-60'
                  : 'border-border'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <UserPlus className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${p.registeredId ? 'text-green-500' : p.skipped ? 'text-muted-foreground' : 'text-primary'}`} />
                    <div className="min-w-0">
                      <div className="font-medium text-foreground text-sm sm:text-base">{parentLabels[role]}</div>
                      {p.registeredId && <div className="text-[10px] sm:text-xs text-green-600 truncate">{p.formData.firstName} {p.formData.lastName} — Registered ✓</div>}
                      {p.skipped && <div className="text-[10px] sm:text-xs text-muted-foreground truncate">Skipped: {p.skipReason}</div>}
                    </div>
                  </div>
                  {!p.registeredId && !p.skipped && (
                    <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3" onClick={() => setFlowStep(`parent-skip-${role}`)}>
                        <SkipForward className="h-3 w-3 mr-0.5 sm:mr-1" /> Skip
                      </Button>
                      <Button size="sm" className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3" onClick={() => setFlowStep(`parent-verify-${role}`)}>
                        <UserPlus className="h-3 w-3 mr-0.5 sm:mr-1" /> Create
                      </Button>
                    </div>
                  )}
                  {p.skipped && (
                    <Button size="sm" variant="ghost" className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3" onClick={() => updateParent(role, { skipped: false, skipReason: '' })}>
                      Undo
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {!parents.some(p => p.registeredId) && parents.every(p => !p.skipped) && (
            <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
              You must register at least one parent/guardian before creating the student account.
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-11" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            {canGoToStudent && (
              <Button className="flex-1 h-11" onClick={() => setFlowStep('student-verify')}>
                Continue to Student <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    // ---- PARENT SKIP ----
    if (flowStep.startsWith('parent-skip-')) {
      const role = flowStep.replace('parent-skip-', '') as ParentRole;
      const parent = getParent(role);

      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground text-base">Skip {parentLabels[role]}</h3>
          <p className="text-sm text-muted-foreground">Please provide a reason for skipping the {parentLabels[role].toLowerCase()} registration:</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason *</Label>
            <Textarea
              value={parent.skipReason}
              onChange={e => updateParent(role, { skipReason: e.target.value })}
              placeholder={`Why is the ${parentLabels[role].toLowerCase()} not being registered?`}
              className="min-h-[80px]"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={() => setFlowStep('parent-overview')}>
              <X className="h-4 w-4 mr-2" /> Cancel
            </Button>
            <Button
              className="flex-1 h-10"
              disabled={!parent.skipReason.trim()}
              onClick={() => {
                updateParent(role, { skipped: true });
                setFlowStep('parent-overview');
              }}
            >
              Confirm Skip
            </Button>
          </div>
        </div>
      );
    }

    // ---- PARENT VERIFY ----
    if (flowStep.startsWith('parent-verify-')) {
      const role = flowStep.replace('parent-verify-', '') as ParentRole;
      return (
        <OtpVerificationStep
          title={`Verify ${parentLabels[role]}'s Contact`}
          subtitle={`Verify the email and phone number for the ${parentLabels[role].toLowerCase()}.`}
          emailRequired={true}
          phoneRequired={true}
          showPhone={true}
          onBack={handleBack}
          onVerified={({ email, phone }) => {
            updateParent(role, {
              verified: true,
              email,
              phone,
              formData: { ...getParent(role).formData, email, phoneNumber: phone },
            });
            setFlowStep(`parent-form-${role}-personal`);
          }}
        />
      );
    }

    // ---- PARENT FORM ----
    if (flowStep.startsWith('parent-form-')) {
      const match = flowStep.match(/^parent-form-(father|mother|guardian)-(personal|address|parent-extra)$/);
      if (!match) return null;
      const role = match[1] as ParentRole;
      const section = match[2] as 'personal' | 'address' | 'parent-extra';
      const parent = getParent(role);

      const sectionLabel = section === 'personal' ? 'Personal Information' : section === 'address' ? 'Address Details' : 'Additional Details';

      const canNext = section === 'personal' ? isPersonalValid(parent.formData) : section === 'address' ? isAddressValid(parent.formData) : true;

      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">{parentLabels[role]} — {sectionLabel}</h3>
            <div className="flex gap-1 mt-2">
              {['personal', 'address', 'parent-extra'].map((s, i) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full ${
                  ['personal', 'address', 'parent-extra'].indexOf(section) >= i ? 'bg-primary' : 'bg-muted'
                }`} />
              ))}
            </div>
          </div>

          <PersonForm
            data={parent.formData}
            onChange={fd => updateParent(role, { formData: fd })}
            section={section}
            emailLocked={true}
            phoneLocked={!!parent.phone && parent.phone.replace(/\D/g, '').length > 2}
            showParentFields={true}
            showInstituteCode={false}
          />

          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            {section === 'parent-extra' ? (
              <Button className="flex-1 h-10" onClick={() => finishParentForm(role)} disabled={isLoading}>
                {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registering...</> : <>Register {parentLabels[role]} <ChevronRight className="h-4 w-4 ml-2" /></>}
              </Button>
            ) : (
              <Button className="flex-1 h-10" onClick={() => {
                const next = nextParentFormSection(role, section);
                if (next) setFlowStep(next);
              }} disabled={!canNext}>
                Next <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    // ---- STUDENT VERIFY ----
    if (flowStep === 'student-verify') {
      // In student-with-parent flow, email is optional since parent has contact info
      return (
        <OtpVerificationStep
          title="Verify Student's Contact"
          subtitle="Email is optional when parents have contact info. Phone number is also optional."
          emailRequired={false}
          phoneRequired={false}
          showPhone={true}
          onBack={handleBack}
          onVerified={({ email, phone }) => {
            setStudentEmail(email);
            setStudentPhone(phone);
            setStudentVerified(true);
            setStudentPersonal(prev => ({ ...prev, email, phoneNumber: phone }));
            setFlowStep('student-personal');
          }}
        />
      );
    }

    // ---- STUDENT PERSONAL / ADDRESS / INFO ----
    if (flowStep === 'student-personal') {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">Student — Personal Information</h3>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
          </div>
          <PersonForm
            data={studentPersonal}
            onChange={setStudentPersonal}
            section="personal"
            emailLocked={true}
            phoneLocked={!!studentPhone && studentPhone.replace(/\D/g, '').length > 2}
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button className="flex-1 h-10" onClick={() => setFlowStep('student-address')} disabled={!isPersonalValid(studentPersonal)}>
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    if (flowStep === 'student-address') {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">Student — Address Details</h3>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= 1 ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
          </div>
          <PersonForm data={studentPersonal} onChange={setStudentPersonal} section="address" showInstituteCode={true} />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button className="flex-1 h-10" onClick={() => setFlowStep('student-info')} disabled={!isAddressValid(studentPersonal)}>
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    if (flowStep === 'student-info') {
      // Build available recipients based on registered parents
      const cardRecipients: { value: import('@/api/registration.api').CardDeliveryRecipient; label: string }[] = [
        { value: 'SELF', label: 'Student (Self)' },
      ];
      if (getParent('father').registeredId) cardRecipients.push({ value: 'FATHER', label: 'Father' });
      if (getParent('mother').registeredId) cardRecipients.push({ value: 'MOTHER', label: 'Mother' });
      if (getParent('guardian').registeredId) cardRecipients.push({ value: 'GUARDIAN', label: 'Guardian' });

      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">Student — Additional Information</h3>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full bg-primary`} />
              ))}
            </div>
          </div>
          <StudentForm
            data={studentInfo}
            onChange={setStudentInfo}
            showCardDelivery={true}
            availableRecipients={cardRecipients}
          />
          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button className="flex-1 h-10" onClick={() => setFlowStep('review')}>
              Review <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    // ---- PARENT ROLE QUESTION ----
    if (flowStep === 'parent-role-question') {
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground text-base">About Your Role</h3>
          <p className="text-sm text-muted-foreground">
            Do you also work at an institute as a teacher, institute admin, or attendance marker?
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setParentAlsoWorksAtInstitute(true)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                parentAlsoWorksAtInstitute
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <Users className={`h-6 w-6 shrink-0 ${parentAlsoWorksAtInstitute ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex-1">
                <div className="font-medium text-foreground">Yes, I work at an institute</div>
                <div className="text-xs text-muted-foreground">I am a teacher, admin, or attendance marker and also a parent</div>
              </div>
              {parentAlsoWorksAtInstitute && <CheckCircle2 className="h-5 w-5 text-primary" />}
            </button>
            <button
              onClick={() => setParentAlsoWorksAtInstitute(false)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                !parentAlsoWorksAtInstitute
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <Heart className={`h-6 w-6 shrink-0 ${!parentAlsoWorksAtInstitute ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex-1">
                <div className="font-medium text-foreground">No, I am a parent only</div>
                <div className="text-xs text-muted-foreground">I only want to manage my children's education</div>
              </div>
              {!parentAlsoWorksAtInstitute && <CheckCircle2 className="h-5 w-5 text-primary" />}
            </button>
          </div>
          <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
            {parentAlsoWorksAtInstitute
              ? 'Your account will be created with full flexibility — you can be assigned as a parent AND work at institutes as teacher/admin/marker.'
              : 'Your account will be created as a parent-only account. You can manage your children\'s education but cannot be assigned staff roles at institutes.'}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-11" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button className="flex-1 h-11" onClick={() => setFlowStep('parent-only-verify')}>
              Continue <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    // ---- PARENT ONLY VERIFY ----
    if (flowStep === 'parent-only-verify') {
      return (
        <OtpVerificationStep
          title="Verify Your Contact — Parent"
          subtitle="Email is required. Phone number is required."
          emailRequired={true}
          phoneRequired={true}
          showPhone={true}
          onBack={handleBack}
          onVerified={({ email, phone }) => {
            setParentOnlyEmail(email);
            setParentOnlyPhone(phone);
            setParentOnlyVerified(true);
            setParentOnlyPersonal(prev => ({ ...prev, email, phoneNumber: phone }));
            setFlowStep('parent-only-personal');
          }}
        />
      );
    }

    // ---- PARENT ONLY PERSONAL ----
    if (flowStep === 'parent-only-personal') {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">Parent — Personal Information</h3>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
          </div>
          <PersonForm
            data={parentOnlyPersonal}
            onChange={setParentOnlyPersonal}
            section="personal"
            emailLocked={true}
            phoneLocked={!!parentOnlyPhone && parentOnlyPhone.replace(/\D/g, '').length > 2}
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button className="flex-1 h-10" onClick={() => setFlowStep('parent-only-address')} disabled={!isPersonalValid(parentOnlyPersonal)}>
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    // ---- PARENT ONLY ADDRESS ----
    if (flowStep === 'parent-only-address') {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">Parent — Address Details</h3>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= 1 ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
          </div>
          <PersonForm data={parentOnlyPersonal} onChange={setParentOnlyPersonal} section="address" showInstituteCode={parentAlsoWorksAtInstitute} />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button className="flex-1 h-10" onClick={() => setFlowStep('parent-only-extra')} disabled={!isAddressValid(parentOnlyPersonal)}>
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    // ---- PARENT ONLY EXTRA (occupation, workplace etc) ----
    if (flowStep === 'parent-only-extra') {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">Parent — Additional Details</h3>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full bg-primary`} />
              ))}
            </div>
          </div>
          <PersonForm
            data={parentOnlyPersonal}
            onChange={setParentOnlyPersonal}
            section="parent-extra"
            showParentFields={true}
            showInstituteCode={false}
          />
          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button className="flex-1 h-10" onClick={() => setFlowStep('review')}>
              Review <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    // ---- SOLO STUDENT VERIFY (Student without parent) ----
    if (flowStep === 'solo-student-verify') {
      return (
        <OtpVerificationStep
          title="Verify Your Contact — Student"
          subtitle="Email is required. Phone number is optional."
          emailRequired={true}
          phoneRequired={false}
          showPhone={true}
          onBack={handleBack}
          onVerified={({ email, phone }) => {
            setSoloStudentEmail(email);
            setSoloStudentPhone(phone);
            setSoloStudentVerified(true);
            setSoloStudentPersonal(prev => ({ ...prev, email, phoneNumber: phone }));
            setFlowStep('solo-student-personal');
          }}
        />
      );
    }

    // ---- SOLO STUDENT PERSONAL ----
    if (flowStep === 'solo-student-personal') {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">Student — Personal Information</h3>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
          </div>
          <PersonForm
            data={soloStudentPersonal}
            onChange={setSoloStudentPersonal}
            section="personal"
            emailLocked={true}
            phoneLocked={!!soloStudentPhone && soloStudentPhone.replace(/\D/g, '').length > 2}
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button className="flex-1 h-10" onClick={() => setFlowStep('solo-student-address')} disabled={!isPersonalValid(soloStudentPersonal)}>
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    // ---- SOLO STUDENT ADDRESS ----
    if (flowStep === 'solo-student-address') {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">Student — Address Details</h3>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= 1 ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
          </div>
          <PersonForm data={soloStudentPersonal} onChange={setSoloStudentPersonal} section="address" showInstituteCode={true} />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button className="flex-1 h-10" onClick={() => setFlowStep('solo-student-info')} disabled={!isAddressValid(soloStudentPersonal)}>
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    // ---- SOLO STUDENT INFO (medical, blood group etc) ----
    if (flowStep === 'solo-student-info') {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">Student — Additional Information</h3>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full bg-primary`} />
              ))}
            </div>
          </div>
          <StudentForm data={soloStudentInfo} onChange={setSoloStudentInfo} />
          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button className="flex-1 h-10" onClick={() => setFlowStep('review')}>
              Review <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    // ---- SIMPLE VERIFY (Teacher/Admin/Marker) ----
    if (flowStep === 'simple-verify') {
      const typeLabel = accountType === 'teacher' ? 'Teacher' : accountType === 'attendance-marker' ? 'Attendance Marker' : 'Institute Admin';
      return (
        <OtpVerificationStep
          title={`Verify Your Contact — ${typeLabel}`}
          subtitle="Email is required. Phone number is required."
          emailRequired={true}
          phoneRequired={true}
          showPhone={true}
          onBack={handleBack}
          onVerified={({ email, phone }) => {
            setSimpleEmail(email);
            setSimplePhone(phone);
            setSimpleVerified(true);
            setSimplePersonal(prev => ({ ...prev, email, phoneNumber: phone }));
            setFlowStep('simple-personal');
          }}
        />
      );
    }

    // ---- SIMPLE PERSONAL ----
    if (flowStep === 'simple-personal') {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">
              {accountType === 'teacher' ? 'Teacher' : accountType === 'attendance-marker' ? 'Attendance Marker' : 'Institute Admin'} — Personal Information
            </h3>
            <div className="flex gap-1 mt-2">
              {[0, 1].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
          </div>
          <PersonForm
            data={simplePersonal}
            onChange={setSimplePersonal}
            section="personal"
            emailLocked={true}
            phoneLocked={!!simplePhone && simplePhone.replace(/\D/g, '').length > 2}
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button className="flex-1 h-10" onClick={() => setFlowStep('simple-address')} disabled={!isPersonalValid(simplePersonal)}>
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    // ---- SIMPLE ADDRESS ----
    if (flowStep === 'simple-address') {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">
              {accountType === 'teacher' ? 'Teacher' : accountType === 'attendance-marker' ? 'Attendance Marker' : 'Institute Admin'} — Address Details
            </h3>
            <div className="flex gap-1 mt-2">
              {[0, 1].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full bg-primary`} />
              ))}
            </div>
          </div>
          <PersonForm data={simplePersonal} onChange={setSimplePersonal} section="address" showInstituteCode={true} />
          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button className="flex-1 h-10" onClick={() => setFlowStep('review')} disabled={!isAddressValid(simplePersonal)}>
              Review <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    // ---- REVIEW ----
    if (flowStep === 'review') {
      if (accountType === 'student-with-parent') {
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground text-base">Review Registration</h3>

            {/* Parents summary */}
            {parentRoles.map(role => {
              const p = getParent(role);
              if (p.skipped) return (
                <div key={role} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="text-sm font-medium text-muted-foreground">{parentLabels[role]} — Skipped</div>
                  <div className="text-xs text-muted-foreground">{p.skipReason}</div>
                </div>
              );
              if (!p.registeredId) return null;
              return (
                <div key={role} className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-500/30">
                  <div className="text-sm font-medium text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {parentLabels[role]} — {p.formData.firstName} {p.formData.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{p.email}</div>
                </div>
              );
            })}

            {/* Student summary */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/30">
              <div className="text-sm font-medium text-foreground">Student</div>
              <div className="space-y-1 mt-2 text-sm">
                {[
                  ['Name', `${studentPersonal.firstName} ${studentPersonal.lastName}`],
                  ['Email', studentEmail],
                  ['Phone', studentPhone],
                  ['Gender', studentPersonal.gender],
                  ['District', studentPersonal.district?.replace(/_/g, ' ')],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-primary/10 p-3 rounded-lg">
              By creating an account, you agree to the terms of service. After registration, you'll need to activate your account.
            </div>

            {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
              <Button className="flex-1 h-10" onClick={registerStudent} disabled={isLoading}>
                {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : 'Create Student Account'}
              </Button>
            </div>
          </div>
        );
      }

      // Teacher / Admin / Marker review
      if (accountType === 'teacher' || accountType === 'institute-admin' || accountType === 'attendance-marker') {
        const typeLabel = accountType === 'teacher' ? 'Teacher' : accountType === 'attendance-marker' ? 'Attendance Marker' : 'Institute Admin';
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground text-base">Review — {typeLabel}</h3>
            <div className="space-y-2 text-sm">
              {[
                ['Account Type', typeLabel],
                ['Name', `${simplePersonal.firstName} ${simplePersonal.lastName}`],
                ['Email', simpleEmail],
                ['Phone', simplePhone],
                ['Gender', simplePersonal.gender],
                ['District', simplePersonal.district?.replace(/_/g, ' ')],
                ...(simplePersonal.instituteCode ? [['Institute Code', simplePersonal.instituteCode]] : []),
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground bg-primary/10 p-3 rounded-lg">
              By creating an account, you agree to the terms of service. After registration, you'll need to activate your account.
            </div>

            {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
              <Button className="flex-1 h-10" onClick={registerSimple} disabled={isLoading}>
                {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : 'Create Account'}
              </Button>
            </div>
          </div>
        );
      }

      // Solo student (without parent) review
      if (accountType === 'student-without-parent') {
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground text-base">Review — Student</h3>
            <div className="space-y-2 text-sm">
              {[
                ['Name', `${soloStudentPersonal.firstName} ${soloStudentPersonal.lastName}`],
                ['Email', soloStudentEmail],
                ['Phone', soloStudentPhone],
                ['Gender', soloStudentPersonal.gender],
                ['District', soloStudentPersonal.district?.replace(/_/g, ' ')],
                ['Blood Group', soloStudentInfo.bloodGroup],
                ...(soloStudentPersonal.instituteCode ? [['Institute Code', soloStudentPersonal.instituteCode]] : []),
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground bg-primary/10 p-3 rounded-lg">
              By creating an account, you agree to the terms of service. After registration, you'll need to activate your account.
            </div>

            {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
              <Button className="flex-1 h-10" onClick={registerSoloStudent} disabled={isLoading}>
                {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : 'Create Student Account'}
              </Button>
            </div>
          </div>
        );
      }

      // Parent-only review
      if (accountType === 'parent') {
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground text-base">Review — Parent</h3>
            <div className="space-y-2 text-sm">
              {[
                ['Account Type', parentAlsoWorksAtInstitute ? 'Parent + Institute Staff' : 'Parent Only'],
                ['Name', `${parentOnlyPersonal.firstName} ${parentOnlyPersonal.lastName}`],
                ['Email', parentOnlyEmail],
                ['Phone', parentOnlyPhone],
                ['Gender', parentOnlyPersonal.gender],
                ['District', parentOnlyPersonal.district?.replace(/_/g, ' ')],
                ['Occupation', parentOnlyPersonal.occupation],
                ['Workplace', parentOnlyPersonal.workplace],
                ...(parentOnlyPersonal.instituteCode ? [['Institute Code', parentOnlyPersonal.instituteCode]] : []),
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>

            {parentAlsoWorksAtInstitute && (
              <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                Your account will have full flexibility — you can be assigned as a parent AND work at institutes as teacher/admin/marker.
              </div>
            )}

            <div className="text-xs text-muted-foreground bg-primary/10 p-3 rounded-lg">
              By creating an account, you agree to the terms of service. After registration, you'll need to activate your account.
            </div>

            {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-10" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
              <Button className="flex-1 h-10" onClick={registerParentOnly} disabled={isLoading}>
                {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : 'Create Parent Account'}
              </Button>
            </div>
          </div>
        );
      }

      return null;
    }

    return null;
  };

  // ============= LAYOUT =============

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background overflow-x-hidden">
      {/* Subtle top accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-primary via-primary/70 to-primary/40 shrink-0" />

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:px-12 overflow-y-auto">
        <div className="w-full max-w-xl lg:max-w-2xl space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl overflow-hidden bg-primary/5 border border-border/50 p-1.5 shrink-0">
              <img src={surakshaLogo} alt="SurakshaLMS" className="w-full h-full object-contain" loading="lazy" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground tracking-tight">Create Account</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Fill in the details to get started</p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
            <StepIndicator steps={stepLabels} current={currentStepIdx} />
          </div>

          {/* Main Content Card */}
          <Card className="border-border/50 shadow-lg rounded-2xl overflow-hidden">
            <CardContent className="p-5 sm:p-6 md:p-8 lg:p-10">
              {renderContent()}
            </CardContent>
          </Card>

          {/* Back to Login link */}
          {flowStep === 'select-type' && (
            <div className="text-center pb-6">
              <Button variant="link" onClick={onBack} className="text-sm text-muted-foreground hover:text-primary">
                Already have an account? Go to Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Registration;
