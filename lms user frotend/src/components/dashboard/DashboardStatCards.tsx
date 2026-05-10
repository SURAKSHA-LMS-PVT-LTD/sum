import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { School, UserCheck, BookOpen, Building2, TrendingUp, CalendarDays } from 'lucide-react';

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
}

// Convert camelCase role names to human-readable format
// e.g. "InstituteAdmin" → "Institute Admin", "AttendanceMarker" → "Attendance Marker"
const formatRoleName = (role: string | null | undefined): string => {
  if (!role) return '—';
  return role
    .replace(/([A-Z])/g, ' $1')
    .trim();
};

const DashboardStatCards = () => {
  const { user, selectedInstitute, selectedClass, selectedSubject, isViewingAsParent } = useAuth();
  const userRole = useInstituteRole();

  const cards: StatCard[] = [];

  // Don't show parent's institute count when viewing as child
  if (!isViewingAsParent) {
    const totalInstitutes = user?.institutes?.length || 0;
    cards.push({
      label: 'Institutes',
      value: totalInstitutes,
      icon: <Building2 className="h-5 w-5" />,
      gradient: 'from-blue-500 to-blue-600',
    });
  }

  if (selectedInstitute) {
    cards.push({
      label: 'Your Role',
      value: formatRoleName(userRole),
      icon: <UserCheck className="h-5 w-5" />,
      gradient: 'from-emerald-500 to-emerald-600',
    });
  }

  if (selectedClass) {
    cards.push({
      label: 'Class',
      value: selectedClass.name?.slice(0, 12) || '—',
      icon: <School className="h-5 w-5" />,
      gradient: 'from-violet-500 to-violet-600',
    });
  }

  if (selectedSubject) {
    cards.push({
      label: 'Subject',
      value: selectedSubject.name?.slice(0, 12) || '—',
      icon: <BookOpen className="h-5 w-5" />,
      gradient: 'from-amber-500 to-amber-600',
    });
  }

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-3.5 shadow-sm"
        >
          {/* Gradient accent bar */}
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient}`} />
          <div className="flex items-center gap-2.5 mt-0.5">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${card.gradient} text-white shadow-sm`}>
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {card.label}
              </p>
              <p className="text-base font-bold text-foreground truncate leading-tight mt-0.5">
                {card.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardStatCards;
