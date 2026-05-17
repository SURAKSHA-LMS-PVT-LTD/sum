import { useAuth } from '@/contexts/AuthContext';
import { useUserTypes } from './useUserTypes';

export const useInstituteLabels = () => {
  const { selectedInstitute } = useAuth();
  const { userTypes } = useUserTypes();

  const isTuition = (selectedInstitute?.type ?? '').toLowerCase() === 'tuition_institute';

  const studentType = userTypes.find(ut => ut.slug === 'student');
  const teacherType = userTypes.find(ut => ut.slug === 'teacher');

  // In a tuition institute: Subject → Month, Subjects → Months
  const subjectLabel   = isTuition ? 'Month'    : 'Subject';
  const subjectsLabel  = isTuition ? 'Months'   : 'Subjects';

  return {
    studentLabel:  studentType?.name ?? 'Student',
    teacherLabel:  teacherType?.name ?? 'Teacher',
    usersLabel:    'Users',
    subjectLabel,
    subjectsLabel,
    classLabel:    'Class',
    classesLabel:  'Classes',
    isTuition,
    instituteLabel: 'Institute',
  };
};
