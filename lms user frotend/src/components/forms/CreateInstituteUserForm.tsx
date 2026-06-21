import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { instituteApi } from '@/api/institute.api';
import { instituteClassesApi, InstituteClass } from '@/api/instituteClasses.api';
import { usersApi, UserLookupResult, normalizePhoneNumber } from '@/api/users.api';
import { smartCardsApi } from '@/api/smartCards.api';
import { creditsApi, CreditBalance } from '@/api/credits.api';
import { getSignedUrl, uploadToSignedUrl } from '@/utils/imageUploadHelper';
import PassportImageCropUpload from '@/components/common/PassportImageCropUpload';
import { getErrorMessage } from '@/api/apiError';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { toast as sonnerToast } from 'sonner';
import { Loader2, Plus, X, ChevronDown, ChevronUp, Check, ChevronsUpDown, Search, UserCheck, UserX, Mail, AlertCircle } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ExtraDataFields } from '@/components/users/ExtraDataFields';
import { useInstituteUserColumns } from '@/hooks/useInstituteUserColumns';
import { useUserTypes } from '@/hooks/useUserTypes';
import { UserType } from '@/api/userTypes.api';


import type {
  CreateInstituteUserDto,
  CreateInstituteUserResponse,
  Gender,
  ClassEnrollmentInput,
  InstituteStudentData,
  ParentInput,
} from '@/api/institute.api';

interface CreateInstituteUserFormProps {
  onSubmit?: (data: CreateInstituteUserResponse) => void;
  onCancel?: () => void;
  /** 'dialog' (default) wraps form in a modal; 'page' renders inline for full-page use */
  mode?: 'dialog' | 'page';
}

// Class enrollment UI state (tracks selected subjects per class)
interface ClassEnrollmentState {
  classId: string;
  className: string;
  subjectIds: string[];
}

interface SubjectOption {
  id: string;
  name: string;
}

type ParentMode = 'none' | 'link' | 'create';

const OCCUPATION_OPTIONS = [
  'TEACHER', 'LECTURER', 'PRINCIPAL', 'TUITION_TEACHER', 'SCHOOL_COUNSELOR', 'TUITION_INSTITUTE_OWNER', 'LIBRARIAN',
  'NURSE', 'DOCTOR', 'PHARMACIST', 'LABORATORY_TECHNICIAN', 'MIDWIFE', 'DENTIST', 'VETERINARY_DOCTOR', 'PHARMACIST_ASSISTANT', 'MEDICAL_REPRESENTATIVE',
  'ENGINEER', 'CIVIL_ENGINEER', 'ARCHITECT', 'QUANTITY_SURVEYOR', 'SURVEYOR', 'DRAFTSMAN', 'TECHNICIAN', 'AIR_CONDITIONING_TECHNICIAN', 'AUTO_ELECTRICIAN', 'MOBILE_TECHNICIAN', 'COMPUTER_TECHNICIAN', 'CCTV_INSTALLER',
  'IT_OFFICER', 'SOFTWARE_DEVELOPER', 'WEB_DEVELOPER', 'GRAPHIC_DESIGNER', 'CONTENT_CREATOR', 'YOUTUBER', 'DATA_ENTRY_OPERATOR', 'SOCIAL_MEDIA_MARKETER',
  'ACCOUNTANT', 'BANK_OFFICER', 'INSURANCE_AGENT', 'MARKETING_EXECUTIVE', 'ENTREPRENEUR', 'BUSINESS_OWNER', 'SHOP_OWNER', 'BOUTIQUE_OWNER', 'GROCERY_SHOP_OWNER', 'TAILORING_SHOP_OWNER', 'BEAUTY_SALON_OWNER', 'BARBER_SHOP_OWNER', 'CONSULTANT', 'MANAGER', 'SUPERVISOR', 'HR_OFFICER', 'HR_EXECUTIVE', 'PROCUREMENT_OFFICER',
  'CLERK', 'CASHIER', 'RECEPTIONIST', 'CASH_COLLECTOR', 'STORE_KEEPER', 'STORE_MANAGER', 'WAREHOUSE_ASSISTANT',
  'SALES_EXECUTIVE', 'SALESMAN', 'SHOP_ASSISTANT', 'CALL_CENTER_AGENT', 'CALL_CENTER_SUPERVISOR',
  'DRIVER', 'BUS_DRIVER', 'TUK_TUK_DRIVER', 'TAXI_DRIVER', 'HEAVY_VEHICLE_DRIVER', 'DELIVERY_RIDER', 'DELIVERY_PARTNER', 'DELIVERY_HELPER', 'DELIVERY_DISPATCHER', 'BUS_CONDUCTOR', 'DRIVER_ASSISTANT', 'CRANE_OPERATOR', 'FORKLIFT_OPERATOR', 'BUS_OWNER', 'VEHICLE_INSPECTOR', 'BOATMAN', 'FERRY_OPERATOR',
  'FARMER', 'TEA_ESTATE_WORKER', 'RUBBER_TAPPER', 'COCONUT_FARMER', 'PADDY_FARMER', 'SPICE_CULTIVATOR', 'VEGETABLE_CULTIVATOR', 'POULTRY_FARMER', 'LIVESTOCK_FARMER', 'DAIRY_FARMER',
  'FISHERMAN', 'FISHER', 'NET_REPAIRER', 'FISH_SELLER',
  'POLICE_OFFICER', 'SOLDIER', 'NAVY', 'AIR_FORCE', 'SECURITY_GUARD', 'SECURITY_SUPERVISOR', 'WATCHMAN',
  'MECHANIC', 'BUS_MECHANIC', 'LIGHT_VEHICLE_MECHANIC', 'ELECTRICIAN', 'PLUMBER', 'CARPENTER', 'MASON', 'WELDER', 'PAINTER_BUILDING', 'PAINTER_VEHICLE', 'CONSTRUCTION_WORKER',
  'TAILOR', 'DRESSMAKER', 'FASHION_DESIGNER', 'TAILORING_ASSISTANT', 'HAIRDRESSER', 'BEAUTICIAN', 'BARBER',
  'CHEF', 'COOK', 'BAKER', 'PASTRY_CHEF', 'WAITER', 'WAITRESS', 'HOTEL_STAFF', 'TOUR_GUIDE',
  'ARTIST', 'MUSICIAN', 'DANCER', 'PHOTOGRAPHER', 'VIDEOGRAPHER', 'PHOTOGRAPHER_ASSISTANT', 'CAMERAMAN', 'ACTOR', 'ACTRESS', 'SINGER', 'MUSIC_TEACHER', 'PAINTER_ARTIST',
  'GYM_INSTRUCTOR', 'SPORTS_COACH', 'FITNESS_TRAINER',
  'HOUSEWIFE', 'HOUSEMAID', 'DOMESTIC_WORKER', 'GARDENER', 'CLEANER', 'JANITOR',
  'FACTORY_WORKER', 'LABOURER', 'FRUIT_SELLER', 'STREET_VENDOR', 'SMALL_BUSINESS_VENDOR',
  'CIVIL_SERVANT', 'GOVERNMENT_OFFICER', 'GRAMA_NILADHARI', 'POSTMAN',
  'LAWYER', 'LEGAL_OFFICER',
  'RESEARCHER', 'SCIENTIST',
  'SOCIAL_WORKER', 'NGO_WORKER', 'NGO_FIELD_OFFICER', 'VOLUNTEER_WORKER',
  'PRIEST', 'MONK', 'IMAM', 'RELIGIOUS_LEADER',
  'JOURNALIST', 'REPORTER',
  'LANDLORD', 'LANDLADY',
  'STUDENT_SCHOOL', 'STUDENT_UNIVERSITY', 'RETIRED_PERSON', 'UNEMPLOYED',
].map(v => ({ value: v, label: v.replace(/_/g, ' ').split(' ').map((w: string) => w[0] + w.slice(1).toLowerCase()).join(' ') }));

const BLOOD_GROUPS = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE'] as const;

// ── Bilingual form labels (English / Sinhala) ──────────────────────────────
const FORM_LABELS = {
  en: {
    dialogTitle: 'Create Institute User',
    dialogSubtitle: 'Create a user and automatically enroll to your institute',
    role: 'Institute Role', rolePlaceholder: 'Select role',
    profileImages: 'Profile Images', instituteImage: 'Institute Image', globalImage: 'Global Image',
    autoVerified: 'Auto-verified', pendingApproval: 'Pending approval',
    personalInfo: 'Personal Information',
    firstName: 'First Name', lastName: 'Last Name',
    nameWithInitials: 'Name with Initials', nameWithInitialsPlaceholder: 'e.g., K. D. Perera',
    nameWithInitialsHint: 'Auto-generated from first/last name if left blank',
    email: 'Email', phoneNumber: 'Phone Number',
    gender: 'Gender', genderSelect: 'Select', male: 'Male', female: 'Female', other: 'Other',
    dateOfBirth: 'Date of Birth',
    nic: 'NIC', nicPlaceholder: 'NIC number',
    password: 'Password', passwordPlaceholder: 'Min 8 characters (optional)',
    passwordHint: 'If blank, user will go through first-login flow',
    instituteTracking: 'Institute Tracking',
    userId: 'User ID (by Institute)', userIdPlaceholder: 'Institute-assigned ID',
    cardId: 'Card ID', cardIdPlaceholder: 'Access/library card ID',
    addressDetails: 'Address Details',
    addressLine1: 'Address Line 1', addressLine1Placeholder: 'Street address',
    addressLine2: 'Address Line 2', addressLine2Placeholder: 'Apt, suite, etc.',
    city: 'City', district: 'District', province: 'Province', postalCode: 'Postal Code',
    classEnrollment: 'Class & Subject Enrollment',
    addClassLabel: 'Add Class', selectClass: 'Select a class to enroll',
    loadingClasses: 'Loading classes...', noClassFound: 'No class found.',
    noSubjectsFound: 'No subjects found for this class', loadingSubjects: 'Loading subjects...',
    noClassesEnrolled: 'No classes enrolled yet. Select a class above to enroll the student.',
    studentMedical: 'Student & Medical Details',
    studentId: 'Student ID', studentIdPlaceholder: 'Auto-generated if blank',
    emergencyContact: 'Emergency Contact', emergencyContactPlaceholder: 'Emergency phone',
    bloodGroup: 'Blood Group',
    medicalConditions: 'Medical Conditions', medicalConditionsPlaceholder: 'Any medical conditions',
    allergies: 'Allergies', allergiesPlaceholder: 'Known allergies',
    cardDelivery: 'ID Card Delivery Recipient', cardDeliveryPlaceholder: 'Who should receive the ID card?',
    cardDeliverySelf: 'Student (Self)', cardDeliveryFather: 'Father', cardDeliveryMother: 'Mother', cardDeliveryGuardian: 'Guardian',
    parentGuardian: 'Parent / Guardian Info',
    father: 'Father', mother: 'Mother', guardian: 'Guardian',
    none: 'None', linkExisting: 'Link Existing User', createNew: 'Create New Parent',
    linkHintFather: 'Enter the phone number or email of an existing user to assign them as father.',
    linkHintMother: 'Enter the phone number or email of an existing user to assign them as mother.',
    linkHintGuardian: 'Enter the phone number or email of an existing user to assign them as guardian.',
    linkPlaceholder: 'Phone (0771234567 / +94) or Email',
    isTeacher: 'Is a teacher', useStudentAddress: "Use student's address",
    occupation: 'Occupation (optional)', workplace: 'Workplace (optional)',
    passwordOptional: 'Password (optional, min 8 chars)',
    birthCertNo: 'Birth Certificate No. (optional)', educationLevel: 'Education Level (optional)',
    searchOccupation: 'Search occupation...', noOccupationFound: 'No occupation found.',
    welcomeNotification: 'Send welcome email notification',
    cancel: 'Cancel', creating: 'Creating...', create: 'Create',
    langToggle: 'සිං',
  },
  si: {
    dialogTitle: 'ආයතන පරිශීලකයෙකු සාදන්න',
    dialogSubtitle: 'ආයතනයට ස්වයංක්‍රීයව ඇතුළත් වන පරිශීලකයෙකු සාදන්න',
    role: 'ආයතන භූමිකාව', rolePlaceholder: 'භූමිකාව තෝරන්න',
    profileImages: 'පැතිකඩ රූප', instituteImage: 'ආයතන රූපය', globalImage: 'ගෝලීය රූපය',
    autoVerified: 'ස්වයං-තහවුරු', pendingApproval: 'අනුමැතිය ඉල්ලා',
    personalInfo: 'පෞද්ගලික තොරතුරු',
    firstName: 'මුල් නම', lastName: 'අවසාන නම',
    nameWithInitials: 'මුලාකෘති සහිත නම', nameWithInitialsPlaceholder: 'නිදා: ක. ඩ. පෙරේරා',
    nameWithInitialsHint: 'හිස් නම් විට ස්වයංක්‍රීයව ජනනය වේ',
    email: 'විද්‍යුත් තැපෑල', phoneNumber: 'දුරකථන අංකය',
    gender: 'ලිංගය', genderSelect: 'තෝරන්න', male: 'පිරිමි', female: 'ගැහැණු', other: 'වෙනත්',
    dateOfBirth: 'උපන් දිනය',
    nic: 'ජා.හැ.පත.', nicPlaceholder: 'ජා.හැ.පත. අංකය',
    password: 'මුරපදය', passwordPlaceholder: 'අවම 8 අකුරු (අත්‍යවශ්‍ය නොවේ)',
    passwordHint: 'හිස් නම් ප්‍රථම ලොගිනයේදී සකසනු ලැබේ',
    instituteTracking: 'ආයතන ලේඛනය',
    userId: 'පරිශීලක හැඳුනුම (ආයතනය)', userIdPlaceholder: 'ආයතනය ලබාදුන් හැඳුනුම',
    cardId: 'කාඩ් හැඳුනුම', cardIdPlaceholder: 'ප්‍රවේශ/පුස්තකාල කාඩ් හැඳුනුම',
    addressDetails: 'ලිපින තොරතුරු',
    addressLine1: 'ලිපිනය 1', addressLine1Placeholder: 'වීදි ලිපිනය',
    addressLine2: 'ලිපිනය 2', addressLine2Placeholder: 'ෆ්ලැට්, ශාලාව, ආදිය',
    city: 'නගරය', district: 'දිස්ත්‍රික්කය', province: 'පළාත', postalCode: 'තැපැල් කේතය',
    classEnrollment: 'පන්ති සහ විෂය ඇතුළත් කිරීම',
    addClassLabel: 'පන්තිය එකතු කරන්න', selectClass: 'ඇතුළත් කිරීමට පන්තිය තෝරන්න',
    loadingClasses: 'පන්ති ලූඩ් වෙමින්...', noClassFound: 'පන්තිය හමු නොවීය.',
    noSubjectsFound: 'මෙම පන්තිය සඳහා විෂය නැත', loadingSubjects: 'විෂය ලූඩ් වෙමින්...',
    noClassesEnrolled: 'තවම පන්තියකට ඇතුළත් නැත. ඉහතින් පන්තිය තෝරන්න.',
    studentMedical: 'සිසු හා වෛද්‍ය විස්තර',
    studentId: 'සිසු හැඳුනුම', studentIdPlaceholder: 'හිස් නම් ස්වයංක්‍රීයව',
    emergencyContact: 'හදිසි සම්බන්ධතාව', emergencyContactPlaceholder: 'හදිසි දුරකථන',
    bloodGroup: 'රුධිර කාණ්ඩය',
    medicalConditions: 'වෛද්‍ය තත්ත්වයන්', medicalConditionsPlaceholder: 'ඇතිනම් වෛද්‍ය තත්ත්ව',
    allergies: 'අසාත්මිකතා', allergiesPlaceholder: 'දන්නා අසාත්මිකතා',
    cardDelivery: 'හැ.පත. ලබාගන්නා', cardDeliveryPlaceholder: 'හැ.පත. ලැබිය යුත්තේ කාටද?',
    cardDeliverySelf: 'සිසුවා (ස්වයං)', cardDeliveryFather: 'පිය', cardDeliveryMother: 'මව', cardDeliveryGuardian: 'භාරකරු',
    parentGuardian: 'දෙමාපිය / භාරකාර',
    father: 'පිය', mother: 'මව', guardian: 'භාරකරු',
    none: 'නැත', linkExisting: 'පවතින පරිශීලකයා', createNew: 'නව දෙමාපිය',
    linkHintFather: 'පවතින පරිශීලකයාගේ දුරකථන/ඊමේල් ඇතුළත් කරන්න (පිය ලෙස).',
    linkHintMother: 'පවතින පරිශීලකයාගේ දුරකථන/ඊමේල් ඇතුළත් කරන්න (මව ලෙස).',
    linkHintGuardian: 'පවතින පරිශීලකයාගේ දුරකථන/ඊමේල් ඇතුළත් කරන්න (භාරකරු ලෙස).',
    linkPlaceholder: 'දුරකථන / ඊමේල්',
    isTeacher: 'ගුරුවරයෙකි', useStudentAddress: 'සිසුවාගේ ලිපිනය භාවිත',
    occupation: 'රැකියාව (අත්‍යවශ්‍ය නොවේ)', workplace: 'රැකියා ස්ථානය (අත්‍යවශ්‍ය නොවේ)',
    passwordOptional: 'මුරපදය (අත්‍යවශ්‍ය නොවේ, අවම 8)',
    birthCertNo: 'උප්පැන්න සහතික අංකය (අත්‍ය. නොවේ)', educationLevel: 'අධ්‍යාපන මට්ටම (අත්‍ය. නොවේ)',
    searchOccupation: 'රැකියාව සොයන්න...', noOccupationFound: 'රැකියාව හමු නොවීය.',
    welcomeNotification: 'සාදරයේ ඊමේල් දැනුම්දීම',
    cancel: 'අවලංගු', creating: 'සාදමින්...', create: 'සාදන්න',
    langToggle: 'EN',
  },
} as const;
type Lang = keyof typeof FORM_LABELS;

const CreateInstituteUserForm: React.FC<CreateInstituteUserFormProps> = ({ onSubmit, onCancel, mode = 'dialog' }) => {
  const { toast } = useToast();
  const { currentInstituteId } = useAuth();
  const { isFeatureEnabled } = useFeatures();
  const smartCardsEnabled = isFeatureEnabled('smart-cards');
  const { subjectsLabel } = useInstituteLabels();
  const navigate = useNavigate();
  const isPageMode = mode === 'page';
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── User types ──
  const { userTypes, loading: typesLoading } = useUserTypes();
  const [selectedUserTypeId, setSelectedUserTypeId] = useState<string>('');
  const [selectedUserTypeFull, setSelectedUserTypeFull] = useState<UserType | null>(null);

  useEffect(() => {
    if (userTypes.length > 0 && !selectedUserTypeId) {
      setSelectedUserTypeId(userTypes[0].id);
      setSelectedUserTypeFull(userTypes[0]);
    }
  }, [userTypes, selectedUserTypeId]);

  const handleTypeChange = (id: string) => {
    setSelectedUserTypeId(id);
    setSelectedUserTypeFull(userTypes.find(ut => ut.id === id) ?? null);
  };

  // ── Core fields ──
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameWithInitials, setNameWithInitials] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [nic, setNic] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [userIdByInstitute, setUserIdByInstitute] = useState('');
  const [instituteCardId, setInstituteCardId] = useState('');
  // Smart-card assignment (only when the 'smart-cards' feature is enabled)
  // Legacy state vars kept for DTO compatibility — derived from mode selectors below
  const [surakshaCardId, setSurakshaCardId] = useState('');

  // Suraksha card search UI state (GLOBAL scope)
  const [surakshaCardMode, setSurakshaCardMode] = useState<'manual' | 'auto'>('manual');
  const [surakshaCardSearch, setSurakshaCardSearch] = useState('');
  const [surakshaCardSearching, setSurakshaCardSearching] = useState(false);
  const [surakshaCardResult, setSurakshaCardResult] = useState<any | null>(null);
  const [surakshaCardSelected, setSurakshaCardSelected] = useState<any | null>(null);

  // Institute card search UI state (INSTITUTE scope)
  const [instituteCardMode, setInstituteCardMode] = useState<'manual' | 'auto'>('manual');
  const [instituteCardSearch, setInstituteCardSearch] = useState('');
  const [instituteCardSearching, setInstituteCardSearching] = useState(false);
  const [instituteCardSearchResults, setInstituteCardSearchResults] = useState<any[]>([]);
  const [instituteCardSelected, setInstituteCardSelected] = useState<any | null>(null);
  const [password, setPassword] = useState('');
  const [sendWelcomeNotifications, setSendWelcomeNotifications] = useState(false);
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [creditBalanceLoading, setCreditBalanceLoading] = useState(false);

  // ── Schema-driven extra data (institute custom columns) ──
  const { columns: extraColumns } = useInstituteUserColumns(currentInstituteId);
  const [extraData, setExtraData] = useState<Record<string, string>>({});

  // Legacy ad-hoc rows kept for backward compat (unused when schema columns exist)
  const [extraDataRows, setExtraDataRows] = useState<{ key: string; value: string }[]>([]);

  // ── Images ──
  const [instituteImageUrl, setInstituteImageUrl] = useState('');
  const [globalImageUrl, setGlobalImageUrl] = useState('');

  // ── Student data ──
  const [studentData, setStudentData] = useState<InstituteStudentData>({});

  // ── Parent data ──
  const [father, setFather] = useState<ParentInput>({});
  const [mother, setMother] = useState<ParentInput>({});
  const [guardian, setGuardian] = useState<ParentInput>({});
  const [fatherMode, setFatherMode] = useState<ParentMode>('none');
  const [motherMode, setMotherMode] = useState<ParentMode>('none');
  const [guardianMode, setGuardianMode] = useState<ParentMode>('none');

  // ── Parent address fields ──
  const [fatherAddressLine1, setFatherAddressLine1] = useState('');
  const [fatherAddressLine2, setFatherAddressLine2] = useState('');
  const [fatherCity, setFatherCity] = useState('');
  const [fatherDistrict, setFatherDistrict] = useState('');
  const [fatherProvince, setFatherProvince] = useState('');
  const [fatherPostalCode, setFatherPostalCode] = useState('');
  const [fatherUsesStudentAddress, setFatherUsesStudentAddress] = useState(true);
  const [fatherDateOfBirth, setFatherDateOfBirth] = useState('');
  const [fatherGender, setFatherGender] = useState<Gender | ''>('');
  const [fatherNic, setFatherNic] = useState('');
  const [fatherBirthCertificateNo, setFatherBirthCertificateNo] = useState('');
  const [fatherNameWithInitials, setFatherNameWithInitials] = useState('');
  const [fatherEducationLevel, setFatherEducationLevel] = useState('');

  const [motherAddressLine1, setMotherAddressLine1] = useState('');
  const [motherAddressLine2, setMotherAddressLine2] = useState('');
  const [motherCity, setMotherCity] = useState('');
  const [motherDistrict, setMotherDistrict] = useState('');
  const [motherProvince, setMotherProvince] = useState('');
  const [motherPostalCode, setMotherPostalCode] = useState('');
  const [motherUsesStudentAddress, setMotherUsesStudentAddress] = useState(true);
  const [motherDateOfBirth, setMotherDateOfBirth] = useState('');
  const [motherGender, setMotherGender] = useState<Gender | ''>('');
  const [motherNic, setMotherNic] = useState('');
  const [motherBirthCertificateNo, setMotherBirthCertificateNo] = useState('');
  const [motherNameWithInitials, setMotherNameWithInitials] = useState('');
  const [motherEducationLevel, setMotherEducationLevel] = useState('');

  const [guardianAddressLine1, setGuardianAddressLine1] = useState('');
  const [guardianAddressLine2, setGuardianAddressLine2] = useState('');
  const [guardianCity, setGuardianCity] = useState('');
  const [guardianDistrict, setGuardianDistrict] = useState('');
  const [guardianProvince, setGuardianProvince] = useState('');
  const [guardianPostalCode, setGuardianPostalCode] = useState('');
  const [guardianUsesStudentAddress, setGuardianUsesStudentAddress] = useState(true);
  const [fatherIsTeacher, setFatherIsTeacher] = useState(false);
  const [motherIsTeacher, setMotherIsTeacher] = useState(false);
  const [guardianIsTeacher, setGuardianIsTeacher] = useState(false);
  const [guardianDateOfBirth, setGuardianDateOfBirth] = useState('');
  const [guardianGender, setGuardianGender] = useState<Gender | ''>('');
  const [guardianNic, setGuardianNic] = useState('');
  const [guardianBirthCertificateNo, setGuardianBirthCertificateNo] = useState('');
  const [guardianNameWithInitials, setGuardianNameWithInitials] = useState('');
  const [guardianEducationLevel, setGuardianEducationLevel] = useState('');

  // ── Search inputs ──
  const [classSearchOpen, setClassSearchOpen] = useState(false);
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [fatherOccupationOpen, setFatherOccupationOpen] = useState(false);
  const [motherOccupationOpen, setMotherOccupationOpen] = useState(false);
  const [guardianOccupationOpen, setGuardianOccupationOpen] = useState(false);
  const [fatherOccupationSearchQuery, setFatherOccupationSearchQuery] = useState('');
  const [motherOccupationSearchQuery, setMotherOccupationSearchQuery] = useState('');
  const [guardianOccupationSearchQuery, setGuardianOccupationSearchQuery] = useState('');

  // ── Link existing user search state ──
  const [fatherLinkQuery, setFatherLinkQuery] = useState('');
  const [fatherSearching, setFatherSearching] = useState(false);
  const [fatherLinkedUser, setFatherLinkedUser] = useState<UserLookupResult | null>(null);
  const [motherLinkQuery, setMotherLinkQuery] = useState('');
  const [motherSearching, setMotherSearching] = useState(false);
  const [motherLinkedUser, setMotherLinkedUser] = useState<UserLookupResult | null>(null);
  const [guardianLinkQuery, setGuardianLinkQuery] = useState('');
  const [guardianSearching, setGuardianSearching] = useState(false);
  const [guardianLinkedUser, setGuardianLinkedUser] = useState<UserLookupResult | null>(null);

  // ── Class enrollment ──
  const [classEnrollments, setClassEnrollments] = useState<ClassEnrollmentState[]>([]);
  const [availableClasses, setAvailableClasses] = useState<InstituteClass[]>([]);
  const [classSubjects, setClassSubjects] = useState<Record<string, SubjectOption[]>>({});
  const [loadingClasses, setLoadingClasses] = useState(false);

  // ── UI sections ──
  const [showAddress, setShowAddress] = useState(false);
  const [showParents, setShowParents] = useState(false);
  const [showMedical, setShowMedical] = useState(false);

  const showStudentFields = selectedUserTypeFull?.slug === 'student';

  // ── Language ──
  const [lang, setLang] = useState<Lang>('en');
  const L = FORM_LABELS[lang];

  // ── Critical mobile fix: Android hardware back button closes the dialog ──
  // When the form is open as a Dialog, push a history entry so that the global
  // Capacitor back-button handler (which calls window.history.back()) pops that
  // entry instead of navigating the user away from the parent page.
  useEffect(() => {
    if (isPageMode) return; // page mode uses normal router navigation
    window.history.pushState({ _ciufDialog: true }, '');
    const handlePop = () => {
      if (onCancel) onCancel();
    };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
    };
  }, []);

  // Load classes when component mounts
  useEffect(() => {
    if (!currentInstituteId) return;
    setLoadingClasses(true);
    instituteClassesApi.getByInstitute(currentInstituteId, { page: 1, limit: 200 })
      .then((classes: any) => {
        const list = Array.isArray(classes) ? classes : (classes?.data || []);
        setAvailableClasses(list);
      })
      .catch(err => console.warn('Failed to load classes:', err))
      .finally(() => setLoadingClasses(false));
  }, [currentInstituteId]);

  // Load subjects when a class is added
  const loadSubjectsForClass = async (classId: string) => {
    if (!currentInstituteId || classSubjects[classId]) return;
    try {
      const res: any = await instituteApi.getClassSubjects(currentInstituteId, classId);
      const subjects = Array.isArray(res) ? res : (res?.data || []);
      setClassSubjects(prev => ({
        ...prev,
        [classId]: subjects.map((s: any) => ({
          id: s.subjectId || s.id || s.subject?.id,
          name: s.subject?.name || s.name || s.subjectName || s.subjectId || s.id,
        })).filter((s: any) => s.id),
      }));
    } catch (err) {
      console.warn('Failed to load subjects for class:', classId, err);
    }
  };

  const addClassEnrollment = (classId: string) => {
    const cls = availableClasses.find(c => c.id === classId);
    if (!cls || classEnrollments.some(e => e.classId === classId)) return;
    setClassEnrollments(prev => [...prev, { classId, className: cls.name, subjectIds: [] }]);
    loadSubjectsForClass(classId);
  };

  const removeClassEnrollment = (classId: string) => {
    setClassEnrollments(prev => prev.filter(e => e.classId !== classId));
  };

  const toggleSubject = (classId: string, subjectId: string) => {
    setClassEnrollments(prev => prev.map(e => {
      if (e.classId !== classId) return e;
      const has = e.subjectIds.includes(subjectId);
      return { ...e, subjectIds: has ? e.subjectIds.filter(s => s !== subjectId) : [...e.subjectIds, subjectId] };
    }));
  };

  const availableClassesForDropdown = useMemo(
    () => availableClasses.filter(c => c.isActive && !classEnrollments.some(e => e.classId === c.id)),
    [availableClasses, classEnrollments]
  );

  // ── Link existing user: search by phone or email ──
  const searchParentByContact = async (
    query: string,
    setSearching: (v: boolean) => void,
    setLinkedUser: (u: UserLookupResult | null) => void,
    _setParent: React.Dispatch<React.SetStateAction<ParentInput>>,
  ) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setLinkedUser(null);
    try {
      const isEmail = trimmed.includes('@');
      const result: UserLookupResult = isEmail
        ? await usersApi.lookupByEmail(trimmed)
        : await usersApi.lookupByPhone(trimmed);

      // Block students from being linked as parents
      const type = (result.userType ?? '').toUpperCase();
      if (type === 'STUDENT') {
        toast({
          title: 'Cannot Link Student',
          description: 'This account is registered as a Student and cannot be assigned as a parent/guardian.',
          variant: 'destructive',
        });
        return;
      }

      setLinkedUser(result);
    } catch (err: any) {
      toast({
        title: 'User Not Found',
        description: getErrorMessage(err, 'No user found with that phone number or email'),
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  // ── Suraksha card search (GLOBAL scope) ──
  const searchSurakshaCard = async () => {
    if (!currentInstituteId || !surakshaCardSearch.trim()) return;
    setSurakshaCardSearching(true);
    setSurakshaCardResult(null);
    try {
      const res: any = await smartCardsApi.search(currentInstituteId, {
        scope: 'GLOBAL', search: surakshaCardSearch.trim(), limit: 5,
      });
      const items: any[] = res?.items || [];
      // Only show cards that are in the institute but not yet assigned to a user
      const available = items.find((c: any) =>
        c.status === 'ASSIGNED_INSTITUTE' || c.status === 'ASSIGNED_CLASS',
      );
      setSurakshaCardResult(available || items[0] || null);
    } catch {
      toast({ title: 'Card search failed', variant: 'destructive' });
    } finally {
      setSurakshaCardSearching(false);
    }
  };

  // ── Institute card search (INSTITUTE scope) ──
  const searchInstituteCard = async () => {
    if (!currentInstituteId || !instituteCardSearch.trim()) return;
    setInstituteCardSearching(true);
    setInstituteCardSearchResults([]);
    try {
      const res: any = await smartCardsApi.search(currentInstituteId, {
        scope: 'INSTITUTE', search: instituteCardSearch.trim(), limit: 10,
      });
      setInstituteCardSearchResults(res?.items || []);
    } catch {
      toast({ title: 'Card search failed', variant: 'destructive' });
    } finally {
      setInstituteCardSearching(false);
    }
  };

  // ── Fetch credit balance when welcome email is toggled on ──
  const handleWelcomeToggle = async (checked: boolean) => {
    setSendWelcomeNotifications(checked);
    if (checked && currentInstituteId && !creditBalance) {
      setCreditBalanceLoading(true);
      try {
        const bal = await creditsApi.getBalance(currentInstituteId);
        setCreditBalance(bal);
      } catch { /* silent — show balance as unknown */ } finally {
        setCreditBalanceLoading(false);
      }
    }
  };

  // Accept a found user: store their contact in the parent state
  const acceptLinkedUser = (
    user: UserLookupResult,
    query: string,
    setParent: React.Dispatch<React.SetStateAction<ParentInput>>,
  ) => {
    const isEmail = query.trim().includes('@');
    setParent(p => ({
      ...p,
      email: isEmail ? query.trim() : (user.email || undefined),
      phoneNumber: !isEmail ? normalizePhoneNumber(query.trim()) : (user.phoneNumber || undefined),
    }));
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInstituteId) {
      toast({ title: 'Error', description: 'No institute selected', variant: 'destructive' });
      return;
    }

    // Validation
    const errors: Record<string, string> = {};
    if (!showStudentFields && !email && !phoneNumber) errors.email = 'Email or phone number is required';
    if (!selectedUserTypeId) errors.instituteUserType = 'User type is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const dto: CreateInstituteUserDto = {
        primaryUserTypeId: selectedUserTypeId,
        instituteUserType: selectedUserTypeFull?.slug?.toUpperCase() as any ?? 'STUDENT',
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        nameWithInitials: nameWithInitials || undefined,
        email: email || undefined,
        phoneNumber: phoneNumber || undefined,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
        nic: nic || undefined,
        addressLine1: addressLine1 || undefined,
        addressLine2: addressLine2 || undefined,
        city: city || undefined,
        district: district || undefined,
        province: province || undefined,
        password: password || undefined,
        userIdByInstitute: userIdByInstitute || undefined,
        instituteCardId: smartCardsEnabled
          ? (instituteCardMode === 'manual' ? (instituteCardSelected?.cardId || instituteCardId || undefined) : undefined)
          : (instituteCardId || undefined),
        // Smart-card assignment (ignored server-side unless the feature is enabled)
        ...(smartCardsEnabled ? {
          autoAssignInstituteCard: (instituteCardMode === 'auto') || undefined,
          autoAssignSurakshaCard: (surakshaCardMode === 'auto') || undefined,
          surakshaCardId: surakshaCardMode === 'manual' ? (surakshaCardSelected?.cardId || surakshaCardId || undefined) : undefined,
        } : {}),
        instituteUserImageUrl: instituteImageUrl || undefined,
        globalImageUrl: globalImageUrl || undefined,
        sendWelcomeNotifications,
        // Merge schema-driven extra data and any ad-hoc rows
        extraData: (() => {
          const schemaData = Object.keys(extraData).length > 0 ? extraData : undefined;
          const adHocData = extraDataRows.length > 0
            ? Object.fromEntries(
                extraDataRows
                  .filter(r => r.key.trim() !== '')
                  .map(r => [r.key.trim(), r.value])
              )
            : undefined;
          const merged = { ...adHocData, ...schemaData };
          return Object.keys(merged).length > 0 ? merged : undefined;
        })(),

      };

      // Student-specific
      if (showStudentFields) {
        if (classEnrollments.length > 0) {
          dto.classEnrollments = classEnrollments.map(e => ({
            classId: e.classId,
            subjectEnrollments: e.subjectIds.length > 0 ? e.subjectIds.map(sid => ({ subjectId: sid })) : undefined,
          }));
        }
        if (Object.values(studentData).some(v => v)) {
          dto.studentData = studentData;
        }
        // Father with address
        if (fatherMode !== 'none' && Object.values(father).some(v => v)) {
          const fatherWithAddress: ParentInput = { ...father };
          if (fatherNameWithInitials) fatherWithAddress.nameWithInitials = fatherNameWithInitials;
          if (fatherDateOfBirth) fatherWithAddress.dateOfBirth = fatherDateOfBirth;
          if (fatherGender) fatherWithAddress.gender = fatherGender;
          if (fatherNic) fatherWithAddress.nic = fatherNic;
          if (fatherBirthCertificateNo) fatherWithAddress.birthCertificateNo = fatherBirthCertificateNo;
          if (fatherEducationLevel) fatherWithAddress.educationLevel = fatherEducationLevel;
          fatherWithAddress.userType = fatherIsTeacher ? 'USER' : 'USER_WITHOUT_STUDENT';
          if (!fatherUsesStudentAddress) {
            fatherWithAddress.addressLine1 = fatherAddressLine1 || undefined;
            fatherWithAddress.addressLine2 = fatherAddressLine2 || undefined;
            fatherWithAddress.city = fatherCity || undefined;
            fatherWithAddress.district = fatherDistrict || undefined;
            fatherWithAddress.province = fatherProvince || undefined;
            fatherWithAddress.postalCode = fatherPostalCode || undefined;
          }
          dto.father = fatherWithAddress;
        }
        // Mother with address
        if (motherMode !== 'none' && Object.values(mother).some(v => v)) {
          const motherWithAddress: ParentInput = { ...mother };
          if (motherNameWithInitials) motherWithAddress.nameWithInitials = motherNameWithInitials;
          if (motherDateOfBirth) motherWithAddress.dateOfBirth = motherDateOfBirth;
          if (motherGender) motherWithAddress.gender = motherGender;
          if (motherNic) motherWithAddress.nic = motherNic;
          if (motherBirthCertificateNo) motherWithAddress.birthCertificateNo = motherBirthCertificateNo;
          if (motherEducationLevel) motherWithAddress.educationLevel = motherEducationLevel;
          motherWithAddress.userType = motherIsTeacher ? 'USER' : 'USER_WITHOUT_STUDENT';
          if (!motherUsesStudentAddress) {
            motherWithAddress.addressLine1 = motherAddressLine1 || undefined;
            motherWithAddress.addressLine2 = motherAddressLine2 || undefined;
            motherWithAddress.city = motherCity || undefined;
            motherWithAddress.district = motherDistrict || undefined;
            motherWithAddress.province = motherProvince || undefined;
            motherWithAddress.postalCode = motherPostalCode || undefined;
          }
          dto.mother = motherWithAddress;
        }
        // Guardian with address
        if (guardianMode !== 'none' && Object.values(guardian).some(v => v)) {
          const guardianWithAddress: ParentInput = { ...guardian };
          if (guardianNameWithInitials) guardianWithAddress.nameWithInitials = guardianNameWithInitials;
          if (guardianDateOfBirth) guardianWithAddress.dateOfBirth = guardianDateOfBirth;
          if (guardianGender) guardianWithAddress.gender = guardianGender;
          if (guardianNic) guardianWithAddress.nic = guardianNic;
          if (guardianBirthCertificateNo) guardianWithAddress.birthCertificateNo = guardianBirthCertificateNo;
          if (guardianEducationLevel) guardianWithAddress.educationLevel = guardianEducationLevel;
          guardianWithAddress.userType = guardianIsTeacher ? 'USER' : 'USER_WITHOUT_STUDENT';
          if (!guardianUsesStudentAddress) {
            guardianWithAddress.addressLine1 = guardianAddressLine1 || undefined;
            guardianWithAddress.addressLine2 = guardianAddressLine2 || undefined;
            guardianWithAddress.city = guardianCity || undefined;
            guardianWithAddress.district = guardianDistrict || undefined;
            guardianWithAddress.province = guardianProvince || undefined;
            guardianWithAddress.postalCode = guardianPostalCode || undefined;
          }
          dto.guardian = guardianWithAddress;
        }
      }

      const response = await instituteApi.createUser(currentInstituteId, dto);

      toast({
        title: 'User Created',
        description: response.message || `${selectedUserTypeFull?.name} created and enrolled successfully`,
      });

      // If welcome email was requested but not sent (insufficient credits or no email on user), notify — user is already created, no re-entry needed
      if (sendWelcomeNotifications && response.welcomeNotificationSent === false) {
        sonnerToast.warning('Welcome email not sent', {
          description: 'The user was created successfully. The welcome email could not be sent — your institute may have insufficient credits or the user has no email address.',
          duration: 8000,
        });
      }

      if (onSubmit) onSubmit(response);
      if (isPageMode) navigate(-1);
    } catch (error: any) {
      console.error('Error creating institute user:', error);
      toast({
        title: 'Creation Failed',
        description: getErrorMessage(error, 'Failed to create user'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Helper to clear field error on change ──
  const clearError = (field: string) => setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });

  const formContent = (
    <form id="create-institute-user-form" onSubmit={handleSubmit} className="space-y-5 py-2">

            {/* ── Institute User Type ── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{L.role} *</Label>
              <Select value={selectedUserTypeId} onValueChange={handleTypeChange} disabled={typesLoading}>
                <SelectTrigger className="h-10 sm:h-9 border-border bg-background">
                  <SelectValue placeholder={typesLoading ? 'Loading...' : L.rolePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {userTypes.map(ut => (
                    <SelectItem key={ut.id} value={ut.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ut.color ?? '#6B7280' }} />
                        {ut.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.instituteUserType && <p className="text-xs text-destructive">{fieldErrors.instituteUserType}</p>}
            </div>

            {/* ── Images ── */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-foreground border-l-2 border-primary pl-3 py-1">{L.profileImages}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">{L.instituteImage} <Badge variant="outline" className="ml-1 text-[10px]">{L.autoVerified}</Badge></Label>
                  <PassportImageCropUpload
                    currentImageUrl={instituteImageUrl || null}
                    onImageUpdate={(url) => setInstituteImageUrl(url)}
                    folder="institute-user-images"
                    label=""
                    showCamera={true}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{L.globalImage} <Badge variant="secondary" className="ml-1 text-[10px]">{L.pendingApproval}</Badge></Label>
                  <PassportImageCropUpload
                    currentImageUrl={globalImageUrl || null}
                    onImageUpdate={(url) => setGlobalImageUrl(url)}
                    folder="profile-images"
                    label=""
                    showCamera={true}
                  />
                </div>
              </div>
            </div>

            {/* ── Personal Information ── */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-foreground border-l-2 border-primary pl-3 py-1">{L.personalInfo}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">{L.firstName}</Label>
                  <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={L.firstName} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{L.lastName}</Label>
                  <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={L.lastName} />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1.5">
                  <Label className="text-sm">{L.nameWithInitials}</Label>
                  <Input value={nameWithInitials} onChange={e => setNameWithInitials(e.target.value)} placeholder={L.nameWithInitialsPlaceholder} />
                  <p className="text-[10px] text-muted-foreground">{L.nameWithInitialsHint}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{L.email} {!showStudentFields && !phoneNumber && '*'}</Label>
                  <Input type="email" value={email} onChange={e => { setEmail(e.target.value); clearError('email'); }} placeholder="user@email.com" />
                  {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{L.phoneNumber} {!showStudentFields && !email && '*'}</Label>
                  <Input value={phoneNumber} onChange={e => { setPhoneNumber(e.target.value); clearError('email'); }} placeholder="07XXXXXXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{L.gender}</Label>
                  <Select value={gender} onValueChange={(v: Gender) => setGender(v)}>
                    <SelectTrigger><SelectValue placeholder={L.genderSelect} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">{L.male}</SelectItem>
                      <SelectItem value="FEMALE">{L.female}</SelectItem>
                      <SelectItem value="OTHER">{L.other}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{L.dateOfBirth}</Label>
                  <Input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{L.nic}</Label>
                  <Input value={nic} onChange={e => setNic(e.target.value)} placeholder={L.nicPlaceholder} maxLength={12} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{L.password}</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={L.passwordPlaceholder} />
                  <p className="text-[10px] text-muted-foreground">{L.passwordHint}</p>
                </div>
              </div>
            </div>

            {/* ── Institute Tracking ── */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-foreground border-l-2 border-primary pl-3 py-1">{L.instituteTracking}</h3>
              <div className="space-y-1.5">
                <Label className="text-sm">{L.userId}</Label>
                <Input value={userIdByInstitute} onChange={e => setUserIdByInstitute(e.target.value)} placeholder={L.userIdPlaceholder} maxLength={50} />
              </div>

              {/* ── Institute Card ID (INSTITUTE-scoped smart card) ── */}
              <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{L.cardId}</Label>
                  {smartCardsEnabled && (
                    <div className="flex rounded-md overflow-hidden border text-xs">
                      <button type="button"
                        className={`px-3 py-1 ${instituteCardMode === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                        onClick={() => { setInstituteCardMode('manual'); setInstituteCardSelected(null); setInstituteCardSearchResults([]); }}>
                        Manual
                      </button>
                      <button type="button"
                        className={`px-3 py-1 ${instituteCardMode === 'auto' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                        onClick={() => { setInstituteCardMode('auto'); setInstituteCardSelected(null); }}>
                        Auto
                      </button>
                    </div>
                  )}
                </div>

                {!smartCardsEnabled ? (
                  <Input value={instituteCardId} onChange={e => setInstituteCardId(e.target.value)} placeholder={L.cardIdPlaceholder} maxLength={100} />
                ) : instituteCardMode === 'auto' ? (
                  <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-3 py-2">
                    Will auto-assign the next available INSTITUTE-scoped card from this institute's pool (class pool first, then institute pool). If none available, no card assigned.
                  </p>
                ) : (
                  /* Manual search */
                  <div className="space-y-2">
                    {instituteCardSelected ? (
                      <div className="flex items-center gap-2 border rounded-md p-2 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono font-medium truncate">{instituteCardSelected.cardId}</p>
                          <p className="text-xs text-muted-foreground">{instituteCardSelected.cardName} · {instituteCardSelected.cardType}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{instituteCardSelected.status?.replace(/_/g, ' ')}</Badge>
                        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setInstituteCardSelected(null); setInstituteCardSearch(''); setInstituteCardSearchResults([]); }}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <Input
                            value={instituteCardSearch}
                            onChange={e => setInstituteCardSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchInstituteCard())}
                            placeholder="Search card name or card ID…"
                            className="flex-1"
                          />
                          <Button type="button" variant="secondary" size="sm" onClick={searchInstituteCard} disabled={instituteCardSearching || !instituteCardSearch.trim()}>
                            {instituteCardSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          </Button>
                        </div>
                        {instituteCardSearchResults.length > 0 && (
                          <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                            {instituteCardSearchResults.map((card: any) => {
                              const assignable = card.status === 'ASSIGNED_INSTITUTE' || card.status === 'ASSIGNED_CLASS';
                              return (
                                <button key={card.id} type="button" disabled={!assignable}
                                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors ${assignable ? 'hover:bg-muted cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                                  onClick={() => assignable && (setInstituteCardSelected(card), setInstituteCardSearchResults([]))}>
                                  <span className="font-mono flex-1 truncate">{card.cardId}</span>
                                  <span className="text-xs text-muted-foreground truncate">{card.cardName}</span>
                                  <Badge variant={assignable ? 'outline' : 'secondary'} className="text-[10px] shrink-0">{card.status?.replace(/_/g, ' ')}</Badge>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {instituteCardSearchResults.length === 0 && instituteCardSearch && !instituteCardSearching && (
                          <p className="text-xs text-muted-foreground">Search to find INSTITUTE-scoped cards in the pool.</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* ── Suraksha Card (GLOBAL-scoped smart card) — only when feature enabled ── */}
              {smartCardsEnabled && (
                <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Suraksha Smart Card</Label>
                    <div className="flex rounded-md overflow-hidden border text-xs">
                      <button type="button"
                        className={`px-3 py-1 ${surakshaCardMode === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                        onClick={() => { setSurakshaCardMode('manual'); setSurakshaCardSelected(null); setSurakshaCardResult(null); }}>
                        Manual
                      </button>
                      <button type="button"
                        className={`px-3 py-1 ${surakshaCardMode === 'auto' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                        onClick={() => { setSurakshaCardMode('auto'); setSurakshaCardSelected(null); }}>
                        Auto
                      </button>
                    </div>
                  </div>

                  {surakshaCardMode === 'auto' ? (
                    <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-3 py-2">
                      Will auto-assign the next available GLOBAL card from this institute's pool (class pool first, then institute pool). If none available, no card assigned.
                    </p>
                  ) : (
                    /* Manual search */
                    <div className="space-y-2">
                      {surakshaCardSelected ? (
                        <div className="flex items-center gap-2 border rounded-md p-2 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono font-medium truncate">{surakshaCardSelected.cardId}</p>
                            <p className="text-xs text-muted-foreground">{surakshaCardSelected.cardName} · {surakshaCardSelected.cardType}</p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">{surakshaCardSelected.status?.replace(/_/g, ' ')}</Badge>
                          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setSurakshaCardSelected(null); setSurakshaCardSearch(''); setSurakshaCardResult(null); }}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <Input
                              value={surakshaCardSearch}
                              onChange={e => setSurakshaCardSearch(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchSurakshaCard())}
                              placeholder="Search card name or card ID…"
                              className="flex-1"
                            />
                            <Button type="button" variant="secondary" size="sm" onClick={searchSurakshaCard} disabled={surakshaCardSearching || !surakshaCardSearch.trim()}>
                              {surakshaCardSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                          </div>
                          {surakshaCardResult && (
                            <div className="border rounded-md">
                              {(surakshaCardResult.status === 'ASSIGNED_INSTITUTE' || surakshaCardResult.status === 'ASSIGNED_CLASS') ? (
                                <button type="button" className="w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-muted"
                                  onClick={() => setSurakshaCardSelected(surakshaCardResult)}>
                                  <span className="font-mono flex-1 truncate">{surakshaCardResult.cardId}</span>
                                  <span className="text-xs text-muted-foreground truncate">{surakshaCardResult.cardName}</span>
                                  <Badge variant="outline" className="text-[10px] shrink-0 text-emerald-600">Available</Badge>
                                </button>
                              ) : (
                                <div className="px-3 py-2 flex items-center gap-2 text-sm opacity-60">
                                  <span className="font-mono flex-1 truncate">{surakshaCardResult.cardId}</span>
                                  <Badge variant="secondary" className="text-[10px] shrink-0">
                                    {surakshaCardResult.status === 'ASSIGNED_USER' ? 'Already with a user' : surakshaCardResult.status?.replace(/_/g, ' ')}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          )}
                          {!surakshaCardResult && surakshaCardSearch && !surakshaCardSearching && (
                            <p className="text-xs text-amber-600">No card found in institute pool. Cannot hand over card right now.</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Address (collapsible) ── */}
            <div className="space-y-2">
              <button type="button" onClick={() => setShowAddress(!showAddress)} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                {showAddress ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {L.addressDetails}
              </button>
              {showAddress && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2 border-l-2 border-primary/20">
                  <div className="col-span-1 sm:col-span-2 space-y-1.5">
                    <Label className="text-sm">{L.addressLine1}</Label>
                    <Input value={addressLine1} onChange={e => setAddressLine1(e.target.value)} placeholder={L.addressLine1Placeholder} />
                  </div>
                  <div className="col-span-1 sm:col-span-2 space-y-1.5">
                    <Label className="text-sm">{L.addressLine2}</Label>
                    <Input value={addressLine2} onChange={e => setAddressLine2(e.target.value)} placeholder={L.addressLine2Placeholder} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{L.city}</Label>
                    <Input value={city} onChange={e => setCity(e.target.value)} placeholder={L.city} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{L.district}</Label>
                    <Input value={district} onChange={e => setDistrict(e.target.value)} placeholder={L.district} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{L.province}</Label>
                    <Input value={province} onChange={e => setProvince(e.target.value)} placeholder={L.province} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{L.postalCode}</Label>
                    <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder={L.postalCode} maxLength={6} />
                  </div>
                </div>
              )}
            </div>

            {/* ── Class & Subject Enrollment (STUDENT only) ── */}
            {showStudentFields && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-foreground border-l-2 border-primary pl-3 py-1">{L.classEnrollment}</h3>

            {/* Add class selector */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-sm">{L.addClassLabel}</Label>
                    <Popover open={classSearchOpen} onOpenChange={setClassSearchOpen} modal={false}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={classSearchOpen}
                          className="w-full justify-between h-10 bg-background"
                        >
                          {loadingClasses ? L.loadingClasses : L.selectClass}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput 
                            placeholder="Search classes..." 
                            value={classSearchQuery} 
                            onValueChange={setClassSearchQuery}
                          />
                          <CommandList className="max-h-[200px]">
                            <CommandEmpty>{L.noClassFound}</CommandEmpty>
                            <CommandGroup>
                              {availableClassesForDropdown.filter(cls => 
                                cls.name.toLowerCase().includes(classSearchQuery.toLowerCase()) ||
                                cls.academicYear?.toString().includes(classSearchQuery)
                              ).map(cls => (
                                <CommandItem
                                  key={cls.id}
                                  value={cls.id}
                                  onSelect={() => {
                                    addClassEnrollment(cls.id);
                                    setClassSearchQuery('');
                                    setClassSearchOpen(false);
                                  }}
                                >
                                  {cls.name} ({cls.academicYear})
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Enrolled classes with subjects */}
                {classEnrollments.map(enrollment => (
                  <div key={enrollment.classId} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{enrollment.className}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeClassEnrollment(enrollment.classId)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Subject checkboxes */}
                    {classSubjects[enrollment.classId] ? (
                      <div className="flex flex-wrap gap-2">
                        {classSubjects[enrollment.classId].map(subj => (
                          <label key={subj.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <Checkbox
                              checked={enrollment.subjectIds.includes(subj.id)}
                              onCheckedChange={() => toggleSubject(enrollment.classId, subj.id)}
                            />
                            {subj.name}
                          </label>
                        ))}
                        {classSubjects[enrollment.classId].length === 0 && (
                          <p className="text-xs text-muted-foreground">No {subjectsLabel.toLowerCase()} found for this class</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Loading {subjectsLabel.toLowerCase()}...</p>
                    )}
                  </div>
                ))}

                {classEnrollments.length === 0 && (
                  <p className="text-xs text-muted-foreground">{L.noClassesEnrolled}</p>
                )}
              </div>
            )}

            {/* ── Student Medical Data (STUDENT only, collapsible) ── */}
            {showStudentFields && (
              <div className="space-y-2">
                <button type="button" onClick={() => setShowMedical(!showMedical)} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                  {showMedical ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {L.studentMedical}
                </button>
                {showMedical && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2 border-l-2 border-primary/20">
                    <div className="space-y-1.5">
                      <Label className="text-sm">{L.studentId}</Label>
                      <Input value={studentData.studentId || ''} onChange={e => setStudentData(p => ({ ...p, studentId: e.target.value }))} placeholder={L.studentIdPlaceholder} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{L.emergencyContact}</Label>
                      <Input value={studentData.emergencyContact || ''} onChange={e => setStudentData(p => ({ ...p, emergencyContact: e.target.value }))} placeholder={L.emergencyContactPlaceholder} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{L.bloodGroup}</Label>
                      <Select value={studentData.bloodGroup || undefined} onValueChange={v => setStudentData(p => ({ ...p, bloodGroup: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {BLOOD_GROUPS.map(bg => (
                            <SelectItem key={bg} value={bg}>{bg.replace('_', ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-1.5">
                      <Label className="text-sm">{L.medicalConditions}</Label>
                      <Textarea value={studentData.medicalConditions || ''} onChange={e => setStudentData(p => ({ ...p, medicalConditions: e.target.value }))} placeholder={L.medicalConditionsPlaceholder} rows={2} />
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-1.5">
                      <Label className="text-sm">{L.allergies}</Label>
                      <Textarea value={studentData.allergies || ''} onChange={e => setStudentData(p => ({ ...p, allergies: e.target.value }))} placeholder={L.allergiesPlaceholder} rows={2} />
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-1.5">
                      <Label className="text-sm">{L.cardDelivery}</Label>
                      <Select value={studentData.cardDeliveryRecipient || undefined} onValueChange={v => setStudentData(p => ({ ...p, cardDeliveryRecipient: v as any }))}>
                        <SelectTrigger><SelectValue placeholder={L.cardDeliveryPlaceholder} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SELF">{L.cardDeliverySelf}</SelectItem>
                          <SelectItem value="FATHER">{L.cardDeliveryFather}</SelectItem>
                          <SelectItem value="MOTHER">{L.cardDeliveryMother}</SelectItem>
                          <SelectItem value="GUARDIAN">{L.cardDeliveryGuardian}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Parent/Guardian Info (STUDENT only, collapsible) ── */}
            {showStudentFields && (
              <div className="space-y-2">
                <button type="button" onClick={() => setShowParents(!showParents)} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                  {showParents ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {L.parentGuardian}
                </button>
                {showParents && (
                  <div className="space-y-3 pl-2 border-l-2 border-primary/20">

                    {/* Father */}
                    <div className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Label className="text-sm font-semibold">{L.father}</Label>
                        <Select value={fatherMode} onValueChange={(v: ParentMode) => { setFatherMode(v); setFather({}); setFatherLinkedUser(null); setFatherLinkQuery(''); }}>
                          <SelectTrigger className="w-[190px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{L.none}</SelectItem>
                            <SelectItem value="link">{L.linkExisting}</SelectItem>
                            <SelectItem value="create">{L.createNew}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {fatherMode === 'link' && (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">{L.linkHintFather}</p>
                          {!fatherLinkedUser ? (
                            <div className="flex gap-2">
                              <Input
                                placeholder={L.linkPlaceholder}
                                value={fatherLinkQuery}
                                onChange={e => setFatherLinkQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchParentByContact(fatherLinkQuery, setFatherSearching, setFatherLinkedUser, setFather))}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={fatherSearching || !fatherLinkQuery.trim()}
                                onClick={() => searchParentByContact(fatherLinkQuery, setFatherSearching, setFatherLinkedUser, setFather)}
                              >
                                {fatherSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                              </Button>
                            </div>
                          ) : (
                            <div className="border rounded-lg p-3 bg-muted/40 space-y-2">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12 shrink-0">
                                  <AvatarImage src={fatherLinkedUser.imageUrl ? getImageUrl(fatherLinkedUser.imageUrl) : undefined} />
                                  <AvatarFallback>{(fatherLinkedUser.firstName?.[0] || '?').toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {fatherLinkedUser.fullName || `${fatherLinkedUser.firstName} ${fatherLinkedUser.lastName}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{fatherLinkedUser.userType}</p>
                                  {fatherLinkedUser.id && (
                                    <p className="text-xs text-muted-foreground font-mono">ID: {fatherLinkedUser.id}</p>
                                  )}
                                </div>
                              </div>
                              {!father.email && !father.phoneNumber ? (
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => acceptLinkedUser(fatherLinkedUser, fatherLinkQuery, setFather)}
                                  >
                                    <UserCheck className="h-4 w-4 mr-1.5" /> Accept
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setFatherLinkedUser(null); setFatherLinkQuery(''); }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="text-xs gap-1"><UserCheck className="h-3 w-3" /> Linked</Badge>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {father.phoneNumber || father.email}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto shrink-0 h-7 w-7 p-0"
                                    onClick={() => { setFatherLinkedUser(null); setFatherLinkQuery(''); setFather({}); }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {fatherMode === 'create' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input placeholder={`${L.firstName} *`} value={father.firstName || ''} onChange={e => setFather(p => ({ ...p, firstName: e.target.value }))} />
                          <Input placeholder={L.lastName} value={father.lastName || ''} onChange={e => setFather(p => ({ ...p, lastName: e.target.value }))} />
                          <div className="col-span-1 sm:col-span-2">
                            <Input placeholder={L.nameWithInitials} value={fatherNameWithInitials} onChange={e => setFatherNameWithInitials(e.target.value)} />
                            <p className="text-[10px] text-muted-foreground mt-1">{L.nameWithInitialsHint}</p>
                          </div>
                          <Input type="email" placeholder={L.email} value={father.email || ''} onChange={e => setFather(p => ({ ...p, email: e.target.value }))} />
                          <Input placeholder={L.phoneNumber} value={father.phoneNumber || ''} onChange={e => setFather(p => ({ ...p, phoneNumber: e.target.value }))} />
                          <Input type="date" placeholder={L.dateOfBirth} value={fatherDateOfBirth} onChange={e => setFatherDateOfBirth(e.target.value)} />
                          <Select value={fatherGender} onValueChange={(v: Gender) => setFatherGender(v)}>
                            <SelectTrigger><SelectValue placeholder={L.gender} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MALE">{L.male}</SelectItem>
                              <SelectItem value="FEMALE">{L.female}</SelectItem>
                              <SelectItem value="OTHER">{L.other}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input placeholder={L.nic} value={fatherNic} onChange={e => setFatherNic(e.target.value)} maxLength={12} />
                          <Input placeholder={L.birthCertNo} value={fatherBirthCertificateNo} onChange={e => setFatherBirthCertificateNo(e.target.value)} />
                          <Input placeholder={L.educationLevel} value={fatherEducationLevel} onChange={e => setFatherEducationLevel(e.target.value)} />
                          <div className="col-span-1 sm:col-span-2">
                            <Popover open={fatherOccupationOpen} onOpenChange={setFatherOccupationOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={fatherOccupationOpen}
                                  className="w-full justify-between h-9 bg-background text-sm"
                                >
                                  {father.occupation ? OCCUPATION_OPTIONS.find(o => o.value === father.occupation)?.label : L.occupation}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput 
                                    placeholder={L.searchOccupation} 
                                    value={fatherOccupationSearchQuery} 
                                    onValueChange={setFatherOccupationSearchQuery}
                                  />
                                  <CommandList className="max-h-[200px]">
                                    <CommandEmpty>{L.noOccupationFound}</CommandEmpty>
                                    <CommandGroup>
                                      {OCCUPATION_OPTIONS.filter(opt => 
                                        opt.label.toLowerCase().includes(fatherOccupationSearchQuery.toLowerCase())
                                      ).map(opt => (
                                        <CommandItem
                                          key={opt.value}
                                          value={opt.value}
                                          onSelect={() => {
                                            setFather(p => ({ ...p, occupation: opt.value }));
                                            setFatherOccupationSearchQuery('');
                                            setFatherOccupationOpen(false);
                                          }}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4", father.occupation === opt.value ? "opacity-100" : "opacity-0")} />
                                          {opt.label}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <Input placeholder={L.workplace} value={father.workplace || ''} onChange={e => setFather(p => ({ ...p, workplace: e.target.value }))} />
                          <Input type="password" placeholder={L.passwordOptional} value={father.password || ''} onChange={e => setFather(p => ({ ...p, password: e.target.value }))} />
                          
                          {/* Father — Teacher & Address */}
                          <div className="col-span-1 sm:col-span-2 border-t pt-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Checkbox
                                id="father-is-teacher"
                                checked={fatherIsTeacher}
                                onCheckedChange={(checked) => setFatherIsTeacher(checked === true)}
                              />
                              <Label htmlFor="father-is-teacher" className="text-xs cursor-pointer">{L.isTeacher}</Label>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <Checkbox
                                id="father-use-student-address"
                                checked={fatherUsesStudentAddress}
                                onCheckedChange={(checked) => setFatherUsesStudentAddress(checked === true)}
                              />
                              <Label htmlFor="father-use-student-address" className="text-xs cursor-pointer">{L.useStudentAddress}</Label>
                            </div>
                          </div>
                          {!fatherUsesStudentAddress && (
                            <>
                              <Input placeholder={L.addressLine1} value={fatherAddressLine1} onChange={e => setFatherAddressLine1(e.target.value)} />
                              <Input placeholder={L.addressLine2} value={fatherAddressLine2} onChange={e => setFatherAddressLine2(e.target.value)} />
                              <Input placeholder={L.city} value={fatherCity} onChange={e => setFatherCity(e.target.value)} />
                              <Input placeholder={L.district} value={fatherDistrict} onChange={e => setFatherDistrict(e.target.value)} />
                              <Input placeholder={L.province} value={fatherProvince} onChange={e => setFatherProvince(e.target.value)} />
                              <Input placeholder={L.postalCode} value={fatherPostalCode} onChange={e => setFatherPostalCode(e.target.value)} maxLength={6} />
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Mother */}
                    <div className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Label className="text-sm font-semibold">{L.mother}</Label>
                        <Select value={motherMode} onValueChange={(v: ParentMode) => { setMotherMode(v); setMother({}); setMotherLinkedUser(null); setMotherLinkQuery(''); }}>
                          <SelectTrigger className="w-[190px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{L.none}</SelectItem>
                            <SelectItem value="link">{L.linkExisting}</SelectItem>
                            <SelectItem value="create">{L.createNew}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {motherMode === 'link' && (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">{L.linkHintMother}</p>
                          {!motherLinkedUser ? (
                            <div className="flex gap-2">
                              <Input
                                placeholder={L.linkPlaceholder}
                                value={motherLinkQuery}
                                onChange={e => setMotherLinkQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchParentByContact(motherLinkQuery, setMotherSearching, setMotherLinkedUser, setMother))}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={motherSearching || !motherLinkQuery.trim()}
                                onClick={() => searchParentByContact(motherLinkQuery, setMotherSearching, setMotherLinkedUser, setMother)}
                              >
                                {motherSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                              </Button>
                            </div>
                          ) : (
                            <div className="border rounded-lg p-3 bg-muted/40 space-y-2">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12 shrink-0">
                                  <AvatarImage src={motherLinkedUser.imageUrl ? getImageUrl(motherLinkedUser.imageUrl) : undefined} />
                                  <AvatarFallback>{(motherLinkedUser.firstName?.[0] || '?').toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {motherLinkedUser.fullName || `${motherLinkedUser.firstName} ${motherLinkedUser.lastName}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{motherLinkedUser.userType}</p>
                                  {motherLinkedUser.id && (
                                    <p className="text-xs text-muted-foreground font-mono">ID: {motherLinkedUser.id}</p>
                                  )}
                                </div>
                              </div>
                              {!mother.email && !mother.phoneNumber ? (
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => acceptLinkedUser(motherLinkedUser, motherLinkQuery, setMother)}
                                  >
                                    <UserCheck className="h-4 w-4 mr-1.5" /> Accept
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setMotherLinkedUser(null); setMotherLinkQuery(''); }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="text-xs gap-1"><UserCheck className="h-3 w-3" /> Linked</Badge>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {mother.phoneNumber || mother.email}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto shrink-0 h-7 w-7 p-0"
                                    onClick={() => { setMotherLinkedUser(null); setMotherLinkQuery(''); setMother({}); }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {motherMode === 'create' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input placeholder={`${L.firstName} *`} value={mother.firstName || ''} onChange={e => setMother(p => ({ ...p, firstName: e.target.value }))} />
                          <Input placeholder={L.lastName} value={mother.lastName || ''} onChange={e => setMother(p => ({ ...p, lastName: e.target.value }))} />
                          <div className="col-span-1 sm:col-span-2">
                            <Input placeholder={L.nameWithInitials} value={motherNameWithInitials} onChange={e => setMotherNameWithInitials(e.target.value)} />
                            <p className="text-[10px] text-muted-foreground mt-1">{L.nameWithInitialsHint}</p>
                          </div>
                          <Input type="email" placeholder={L.email} value={mother.email || ''} onChange={e => setMother(p => ({ ...p, email: e.target.value }))} />
                          <Input placeholder={L.phoneNumber} value={mother.phoneNumber || ''} onChange={e => setMother(p => ({ ...p, phoneNumber: e.target.value }))} />
                          <Input type="date" placeholder={L.dateOfBirth} value={motherDateOfBirth} onChange={e => setMotherDateOfBirth(e.target.value)} />
                          <Select value={motherGender} onValueChange={(v: Gender) => setMotherGender(v)}>
                            <SelectTrigger><SelectValue placeholder={L.gender} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MALE">{L.male}</SelectItem>
                              <SelectItem value="FEMALE">{L.female}</SelectItem>
                              <SelectItem value="OTHER">{L.other}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input placeholder={L.nic} value={motherNic} onChange={e => setMotherNic(e.target.value)} maxLength={12} />
                          <Input placeholder={L.birthCertNo} value={motherBirthCertificateNo} onChange={e => setMotherBirthCertificateNo(e.target.value)} />
                          <Input placeholder={L.educationLevel} value={motherEducationLevel} onChange={e => setMotherEducationLevel(e.target.value)} />
                          <div className="col-span-1 sm:col-span-2">
                            <Popover open={motherOccupationOpen} onOpenChange={setMotherOccupationOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={motherOccupationOpen}
                                  className="w-full justify-between h-9 bg-background text-sm"
                                >
                                  {mother.occupation ? OCCUPATION_OPTIONS.find(o => o.value === mother.occupation)?.label : L.occupation}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput 
                                    placeholder={L.searchOccupation} 
                                    value={motherOccupationSearchQuery} 
                                    onValueChange={setMotherOccupationSearchQuery}
                                  />
                                  <CommandList className="max-h-[200px]">
                                    <CommandEmpty>{L.noOccupationFound}</CommandEmpty>
                                    <CommandGroup>
                                      {OCCUPATION_OPTIONS.filter(opt => 
                                        opt.label.toLowerCase().includes(motherOccupationSearchQuery.toLowerCase())
                                      ).map(opt => (
                                        <CommandItem
                                          key={opt.value}
                                          value={opt.value}
                                          onSelect={() => {
                                            setMother(p => ({ ...p, occupation: opt.value }));
                                            setMotherOccupationSearchQuery('');
                                            setMotherOccupationOpen(false);
                                          }}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4", mother.occupation === opt.value ? "opacity-100" : "opacity-0")} />
                                          {opt.label}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <Input placeholder={L.workplace} value={mother.workplace || ''} onChange={e => setMother(p => ({ ...p, workplace: e.target.value }))} />
                          <Input type="password" placeholder={L.passwordOptional} value={mother.password || ''} onChange={e => setMother(p => ({ ...p, password: e.target.value }))} />
                          
                          {/* Mother — Teacher & Address */}
                          <div className="col-span-1 sm:col-span-2 border-t pt-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Checkbox
                                id="mother-is-teacher"
                                checked={motherIsTeacher}
                                onCheckedChange={(checked) => setMotherIsTeacher(checked === true)}
                              />
                              <Label htmlFor="mother-is-teacher" className="text-xs cursor-pointer">{L.isTeacher}</Label>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <Checkbox
                                id="mother-use-student-address"
                                checked={motherUsesStudentAddress}
                                onCheckedChange={(checked) => setMotherUsesStudentAddress(checked === true)}
                              />
                              <Label htmlFor="mother-use-student-address" className="text-xs cursor-pointer">{L.useStudentAddress}</Label>
                            </div>
                          </div>
                          {!motherUsesStudentAddress && (
                            <>
                              <Input placeholder={L.addressLine1} value={motherAddressLine1} onChange={e => setMotherAddressLine1(e.target.value)} />
                              <Input placeholder={L.addressLine2} value={motherAddressLine2} onChange={e => setMotherAddressLine2(e.target.value)} />
                              <Input placeholder={L.city} value={motherCity} onChange={e => setMotherCity(e.target.value)} />
                              <Input placeholder={L.district} value={motherDistrict} onChange={e => setMotherDistrict(e.target.value)} />
                              <Input placeholder={L.province} value={motherProvince} onChange={e => setMotherProvince(e.target.value)} />
                              <Input placeholder={L.postalCode} value={motherPostalCode} onChange={e => setMotherPostalCode(e.target.value)} maxLength={6} />
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Guardian */}
                    <div className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Label className="text-sm font-semibold">{L.guardian}</Label>
                        <Select value={guardianMode} onValueChange={(v: ParentMode) => { setGuardianMode(v); setGuardian({}); setGuardianLinkedUser(null); setGuardianLinkQuery(''); }}>
                          <SelectTrigger className="w-[190px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{L.none}</SelectItem>
                            <SelectItem value="link">{L.linkExisting}</SelectItem>
                            <SelectItem value="create">{L.createNew}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {guardianMode === 'link' && (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">{L.linkHintGuardian}</p>
                          {!guardianLinkedUser ? (
                            <div className="flex gap-2">
                              <Input
                                placeholder={L.linkPlaceholder}
                                value={guardianLinkQuery}
                                onChange={e => setGuardianLinkQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchParentByContact(guardianLinkQuery, setGuardianSearching, setGuardianLinkedUser, setGuardian))}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={guardianSearching || !guardianLinkQuery.trim()}
                                onClick={() => searchParentByContact(guardianLinkQuery, setGuardianSearching, setGuardianLinkedUser, setGuardian)}
                              >
                                {guardianSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                              </Button>
                            </div>
                          ) : (
                            <div className="border rounded-lg p-3 bg-muted/40 space-y-2">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12 shrink-0">
                                  <AvatarImage src={guardianLinkedUser.imageUrl ? getImageUrl(guardianLinkedUser.imageUrl) : undefined} />
                                  <AvatarFallback>{(guardianLinkedUser.firstName?.[0] || '?').toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {guardianLinkedUser.fullName || `${guardianLinkedUser.firstName} ${guardianLinkedUser.lastName}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{guardianLinkedUser.userType}</p>
                                  {guardianLinkedUser.id && (
                                    <p className="text-xs text-muted-foreground font-mono">ID: {guardianLinkedUser.id}</p>
                                  )}
                                </div>
                              </div>
                              {!guardian.email && !guardian.phoneNumber ? (
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => acceptLinkedUser(guardianLinkedUser, guardianLinkQuery, setGuardian)}
                                  >
                                    <UserCheck className="h-4 w-4 mr-1.5" /> Accept
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setGuardianLinkedUser(null); setGuardianLinkQuery(''); }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="text-xs gap-1"><UserCheck className="h-3 w-3" /> Linked</Badge>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {guardian.phoneNumber || guardian.email}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto shrink-0 h-7 w-7 p-0"
                                    onClick={() => { setGuardianLinkedUser(null); setGuardianLinkQuery(''); setGuardian({}); }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {guardianMode === 'create' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input placeholder={`${L.firstName} *`} value={guardian.firstName || ''} onChange={e => setGuardian(p => ({ ...p, firstName: e.target.value }))} />
                          <Input placeholder={L.lastName} value={guardian.lastName || ''} onChange={e => setGuardian(p => ({ ...p, lastName: e.target.value }))} />
                          <div className="col-span-1 sm:col-span-2">
                            <Input placeholder={L.nameWithInitials} value={guardianNameWithInitials} onChange={e => setGuardianNameWithInitials(e.target.value)} />
                            <p className="text-[10px] text-muted-foreground mt-1">{L.nameWithInitialsHint}</p>
                          </div>
                          <Input type="email" placeholder={L.email} value={guardian.email || ''} onChange={e => setGuardian(p => ({ ...p, email: e.target.value }))} />
                          <Input placeholder={L.phoneNumber} value={guardian.phoneNumber || ''} onChange={e => setGuardian(p => ({ ...p, phoneNumber: e.target.value }))} />
                          <Input type="date" placeholder={L.dateOfBirth} value={guardianDateOfBirth} onChange={e => setGuardianDateOfBirth(e.target.value)} />
                          <Select value={guardianGender} onValueChange={(v: Gender) => setGuardianGender(v)}>
                            <SelectTrigger><SelectValue placeholder={L.gender} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MALE">{L.male}</SelectItem>
                              <SelectItem value="FEMALE">{L.female}</SelectItem>
                              <SelectItem value="OTHER">{L.other}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input placeholder={L.nic} value={guardianNic} onChange={e => setGuardianNic(e.target.value)} maxLength={12} />
                          <Input placeholder={L.birthCertNo} value={guardianBirthCertificateNo} onChange={e => setGuardianBirthCertificateNo(e.target.value)} />
                          <Input placeholder={L.educationLevel} value={guardianEducationLevel} onChange={e => setGuardianEducationLevel(e.target.value)} />
                          <div className="col-span-1 sm:col-span-2">
                            <Popover open={guardianOccupationOpen} onOpenChange={setGuardianOccupationOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={guardianOccupationOpen}
                                  className="w-full justify-between h-9 bg-background text-sm"
                                >
                                  {guardian.occupation ? OCCUPATION_OPTIONS.find(o => o.value === guardian.occupation)?.label : L.occupation}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput 
                                    placeholder={L.searchOccupation} 
                                    value={guardianOccupationSearchQuery} 
                                    onValueChange={setGuardianOccupationSearchQuery}
                                  />
                                  <CommandList className="max-h-[200px]">
                                    <CommandEmpty>{L.noOccupationFound}</CommandEmpty>
                                    <CommandGroup>
                                      {OCCUPATION_OPTIONS.filter(opt => 
                                        opt.label.toLowerCase().includes(guardianOccupationSearchQuery.toLowerCase())
                                      ).map(opt => (
                                        <CommandItem
                                          key={opt.value}
                                          value={opt.value}
                                          onSelect={() => {
                                            setGuardian(p => ({ ...p, occupation: opt.value }));
                                            setGuardianOccupationSearchQuery('');
                                            setGuardianOccupationOpen(false);
                                          }}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4", guardian.occupation === opt.value ? "opacity-100" : "opacity-0")} />
                                          {opt.label}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <Input placeholder={L.workplace} value={guardian.workplace || ''} onChange={e => setGuardian(p => ({ ...p, workplace: e.target.value }))} />
                          <Input type="password" placeholder={L.passwordOptional} value={guardian.password || ''} onChange={e => setGuardian(p => ({ ...p, password: e.target.value }))} />
                          
                          {/* Guardian — Teacher & Address */}
                          <div className="col-span-1 sm:col-span-2 border-t pt-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Checkbox
                                id="guardian-is-teacher"
                                checked={guardianIsTeacher}
                                onCheckedChange={(checked) => setGuardianIsTeacher(checked === true)}
                              />
                              <Label htmlFor="guardian-is-teacher" className="text-xs cursor-pointer">{L.isTeacher}</Label>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <Checkbox
                                id="guardian-use-student-address"
                                checked={guardianUsesStudentAddress}
                                onCheckedChange={(checked) => setGuardianUsesStudentAddress(checked === true)}
                              />
                              <Label htmlFor="guardian-use-student-address" className="text-xs cursor-pointer">{L.useStudentAddress}</Label>
                            </div>
                          </div>
                          {!guardianUsesStudentAddress && (
                            <>
                              <Input placeholder={L.addressLine1} value={guardianAddressLine1} onChange={e => setGuardianAddressLine1(e.target.value)} />
                              <Input placeholder={L.addressLine2} value={guardianAddressLine2} onChange={e => setGuardianAddressLine2(e.target.value)} />
                              <Input placeholder={L.city} value={guardianCity} onChange={e => setGuardianCity(e.target.value)} />
                              <Input placeholder={L.district} value={guardianDistrict} onChange={e => setGuardianDistrict(e.target.value)} />
                              <Input placeholder={L.province} value={guardianProvince} onChange={e => setGuardianProvince(e.target.value)} />
                              <Input placeholder={L.postalCode} value={guardianPostalCode} onChange={e => setGuardianPostalCode(e.target.value)} maxLength={6} />
                            </>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* ── Extra / Custom Data ── */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-foreground border-l-2 border-primary pl-3 py-1">
                {lang === 'si' ? 'කත්තරු තොරතුරු (Extra Data)' : 'Extra / Custom Data'}
              </h3>
              {extraColumns.length > 0 ? (
                // Schema-driven: show columns defined in Institute Settings → User Columns
                <ExtraDataFields
                  columns={extraColumns}
                  values={extraData}
                  onChange={setExtraData}
                  userType={selectedUserTypeFull?.slug === 'student' ? 'Student' : selectedUserTypeFull?.slug === 'teacher' ? 'Teacher' : undefined}
                  className="pl-1"
                />
              ) : (
                // Fallback: ad-hoc key-value rows when no schema configured
                <>
                  <p className="text-xs text-muted-foreground">
                    {lang === 'si'
                      ? 'ආයතනය ක්‍රමයක් ගෛ්ඛය කරන්න අපේක්ෂිත තෛරතුරු ඇතුලත් කරන්න.'
                      : 'Add any custom key-value information. Stored as JSON — visible to admins.'}
                  </p>
                  <div className="space-y-2">
                    {extraDataRows.map((row, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input className="flex-1" placeholder={lang === 'si' ? 'ඐඅ (key)' : 'Key (e.g. phone)'} value={row.key} onChange={e => { const next = [...extraDataRows]; next[idx] = { ...next[idx], key: e.target.value }; setExtraDataRows(next); }} />
                        <Input className="flex-1" placeholder={lang === 'si' ? 'ගරිළුම (value)' : 'Value'} value={row.value} onChange={e => { const next = [...extraDataRows]; next[idx] = { ...next[idx], value: e.target.value }; setExtraDataRows(next); }} />
                        <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive" onClick={() => setExtraDataRows(extraDataRows.filter((_, i) => i !== idx))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 mt-1" onClick={() => setExtraDataRows([...extraDataRows, { key: '', value: '' }])}>
                      <Plus className="h-3.5 w-3.5" />
                      {lang === 'si' ? 'තළ එක් කරන්න' : 'Add field'}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* ── Notifications ── */}
            <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="welcome-notifications"
                  checked={sendWelcomeNotifications}
                  onCheckedChange={(checked) => handleWelcomeToggle(checked === true)}
                />
                <Label htmlFor="welcome-notifications" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {L.welcomeNotification}
                </Label>
              </div>
              {sendWelcomeNotifications && (
                <div className="flex items-start gap-2 text-xs rounded-md px-2.5 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Sending a welcome email will deduct <strong>2 credits</strong> from your balance.{' '}
                    {creditBalanceLoading ? (
                      <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading balance…</span>
                    ) : creditBalance !== null ? (
                      <span>
                        Current balance: <strong className={creditBalance.balance < 2 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>{creditBalance.balance} credits</strong>
                        {creditBalance.balance < 2 && <span className="ml-1 text-red-600 dark:text-red-400">— insufficient, email will not be sent.</span>}
                      </span>
                    ) : null}
                  </span>
                </div>
              )}
            </div>

          </form>
  );

  const footerButtons = (
    <div className="flex justify-end gap-2 pt-3 border-t">
      <Button type="button" variant="outline" onClick={() => { if (onCancel) onCancel(); else if (isPageMode) navigate(-1); }} disabled={isLoading}>
        {L.cancel}
      </Button>
      <Button type="submit" form="create-institute-user-form" disabled={isLoading}>
        {isLoading ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {L.creating}</>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-2" />
            {`Create ${selectedUserTypeFull?.name ?? 'User'}`}
          </>
        )}
      </Button>
    </div>
  );

  if (isPageMode) {
    return (
      <div className="flex flex-col gap-4">
        {/* Language toggle for page mode */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => setLang(l => l === 'en' ? 'si' : 'en')}
          >
            {L.langToggle}
          </Button>
        </div>
        {formContent}
        {footerButtons}
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={() => { if (onCancel) onCancel(); }} routeName="create-institute-user-form-popup">
      {/* A4-width consistent container: max-w-[794px] on all screen sizes */}
      <DialogContent className="w-full max-w-[794px] max-h-[95dvh] overflow-hidden flex flex-col p-3 sm:p-5">
        <DialogHeader className="pb-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Visible back/close button for mobile (critical fix) */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={() => { if (onCancel) onCancel(); }}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
            <DialogTitle className="text-base sm:text-lg text-center flex-1 pr-2">
              {L.dialogTitle}
            </DialogTitle>
            {/* Language toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2 shrink-0"
              onClick={() => setLang(l => l === 'en' ? 'si' : 'en')}
            >
              {L.langToggle}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">
            {L.dialogSubtitle}
          </p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {formContent}
        </div>
        {footerButtons}
      </DialogContent>
    </Dialog>
  );
};

export default CreateInstituteUserForm;
