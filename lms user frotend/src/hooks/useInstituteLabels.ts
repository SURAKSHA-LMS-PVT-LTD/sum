import { useUserTypes } from './useUserTypes';

export const useInstituteLabels = () => {
  const { userTypes } = useUserTypes();

  const studentType = userTypes.find(ut => ut.slug === 'student');
  const teacherType = userTypes.find(ut => ut.slug === 'teacher');

  return {
    studentLabel: studentType?.name ?? 'Student',
    teacherLabel: teacherType?.name ?? 'Teacher',
    usersLabel:   'Users',
  };
};
