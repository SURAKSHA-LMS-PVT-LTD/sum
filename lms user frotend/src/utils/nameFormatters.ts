export const formatNameToInitials = (fullName: string): string => {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  const lastName = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + '.').join('');
  const formattedLast = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
  return `${initials} ${formattedLast}`;
};