import React from 'react';
import { ChevronRight, School, BookOpen, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';

interface DashboardQuickNavProps {
  onNavigate: (id: string) => void;
  isTuitionInstitute: boolean;
}

const DashboardQuickNav: React.FC<DashboardQuickNavProps> = ({ onNavigate, isTuitionInstitute }) => {
  const { selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const { isTenantLogin } = useTenant();
  const { subjectLabel } = useInstituteLabels();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-0.5 pb-1">
      {/* Institute chip — clicking disabled on tenant domains (institute is locked) */}
      <button
        onClick={() => !isTenantLogin && onNavigate('select-institute')}
        disabled={isTenantLogin}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors
          ${isTenantLogin ? 'cursor-default' : 'active:scale-95'}
          ${selectedInstitute
            ? 'bg-primary/10 text-primary border border-primary/20'
            : 'bg-muted text-muted-foreground border border-border'
          }`}
      >
        <Building2 className="h-3 w-3" />
        <span className="max-w-[100px] truncate">
          {selectedInstitute?.shortName || selectedInstitute?.name || 'Institute'}
        </span>
      </button>

      {selectedInstitute && (
        <>
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          <button
            onClick={() => onNavigate('select-class')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors active:scale-95
              ${selectedClass
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-muted text-muted-foreground border border-border border-dashed'
              }`}
          >
            <School className="h-3 w-3" />
            <span className="max-w-[80px] truncate">
              {(selectedClass as any)?.name || 'Class'}
            </span>
          </button>
        </>
      )}

      {selectedClass && (
        <>
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          <button
            onClick={() => onNavigate(isTuitionInstitute ? 'select-subject' : 'select-subject')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors active:scale-95
              ${selectedSubject
                ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20'
                : 'bg-muted text-muted-foreground border border-border border-dashed'
              }`}
          >
            <BookOpen className="h-3 w-3" />
            <span className="max-w-[80px] truncate">
              {(selectedSubject as any)?.name || subjectLabel}
            </span>
          </button>
        </>
      )}
    </div>
  );
};

export default DashboardQuickNav;
