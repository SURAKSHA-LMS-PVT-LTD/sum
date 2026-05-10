import { useAuth } from '@/contexts/AuthContext';

export interface InstituteLabels {
  /** e.g. "Institute" / "School" / "Dhamma School" */
  instituteLabel: string;
  /** e.g. "Class" (same for all types) */
  classLabel: string;
  /** e.g. "Subject" | "Month" | "Module" */
  subjectLabel: string;
  /** Plural form of subjectLabel */
  subjectsLabel: string;
  /** true when type is tuition_institute */
  isTuition: boolean;
  /** true when type is school or dhamma_school */
  isSchool: boolean;
  /** Raw institute type string */
  instituteType: string | null;
}

const LABEL_MAP: Record<string, Pick<InstituteLabels, 'instituteLabel' | 'subjectLabel' | 'subjectsLabel'>> = {
  tuition_institute: { instituteLabel: 'Tuition Institute', subjectLabel: 'Month',   subjectsLabel: 'Months'   },
  school:            { instituteLabel: 'School',            subjectLabel: 'Subject', subjectsLabel: 'Subjects' },
  dhamma_school:     { instituteLabel: 'Dhamma School',     subjectLabel: 'Subject', subjectsLabel: 'Subjects' },
  university:        { instituteLabel: 'University',        subjectLabel: 'Module',  subjectsLabel: 'Modules'  },
};

const DEFAULT_LABELS = { instituteLabel: 'Institute', subjectLabel: 'Subject', subjectsLabel: 'Subjects' };

export function useInstituteLabels(): InstituteLabels {
  const { selectedInstitute } = useAuth();
  const rawType = (selectedInstitute?.type || '').toLowerCase();
  const { instituteLabel, subjectLabel, subjectsLabel } = LABEL_MAP[rawType] ?? DEFAULT_LABELS;

  return {
    instituteLabel,
    classLabel: 'Class',
    subjectLabel,
    subjectsLabel,
    isTuition: rawType === 'tuition_institute',
    isSchool: rawType === 'school' || rawType === 'dhamma_school',
    instituteType: rawType || null,
  };
}
