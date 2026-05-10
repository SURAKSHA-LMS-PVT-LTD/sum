export function buildAttendanceAddress({
  instituteName,
  className,
  subjectName,
  location,
}: {
  instituteName?: string | null;
  className?: string | null;
  subjectName?: string | null;
  location?: string | null;
}): string {
  const path = [instituteName, className, subjectName]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(' → ');

  const loc = location?.trim();
  if (loc) return path ? `${path} - ${loc}` : loc;

  return path;
}
