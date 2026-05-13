import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { instituteApi } from '@/api/institute.api';
import { BookOpen, Loader2, Search } from 'lucide-react';
import type { Subject } from '@/contexts/types/auth.types';
import { getImageUrl } from '@/utils/imageUrlHelper';

// Deterministic color from subject name
const getSubjectColor = (name: string) => {
  const palette = ['bg-violet-500', 'bg-indigo-500', 'bg-blue-500', 'bg-cyan-600', 'bg-teal-500', 'bg-rose-500', 'bg-amber-500', 'bg-orange-500', 'bg-pink-500', 'bg-emerald-500'];
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h) + name.charCodeAt(i);
  return palette[Math.abs(h) % palette.length];
};

const DashboardSubjectCards = () => {
  const { selectedInstitute, selectedClass, selectedSubject, setSelectedSubject, user } = useAuth();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const hasLoadedRef = useRef<string | null>(null);

  const cacheKey = `${selectedInstitute?.id}-${selectedClass?.id}`;

  useEffect(() => {
    if (!selectedInstitute?.id || !selectedClass?.id) return;
    if (hasLoadedRef.current === cacheKey) return;
    hasLoadedRef.current = cacheKey;

    setSubjects([]);
    setLoading(true);
    let cancelled = false;

    const load = async () => {
      try {
        const result = await instituteApi.getClassSubjects(
          selectedInstitute.id,
          selectedClass.id,
          { userId: user?.id, role: selectedInstitute.userRole }
        );
        if (cancelled) return;
        const raw = (result as any)?.data || result || [];
        const list = Array.isArray(raw) ? raw : [];
        // Flatten nested { subject: {...}, subjectId, teacher } structure
        const normalized = list.map((item: any) => {
          if (item.subject) {
            return {
              ...item.subject,
              id: item.subjectId || item.subject?.id,
              teacher: item.teacher,
              teacherId: item.teacherId,
              subjectId: item.subjectId || item.subject?.id,
            };
          }
          return { ...item, subjectId: item.subjectId || item.id };
        });
        setSubjects(normalized);
      } catch (e) {
        if (cancelled) return;
        console.error('Failed to load subjects:', e);
        setSubjects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
      // Reset so StrictMode second-run can re-fetch
      hasLoadedRef.current = null;
    };
  }, [cacheKey]);

  const handleSelect = (subj: any) => {
    setSelectedSubject({
      id: subj.subjectId || subj.id,
      name: subj.name || subj.subjectName || subj.title || 'Unnamed',
      ...subj,
    } as Subject);
  };

  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const query = searchQuery.toLowerCase();
    return subjects.filter(subj => {
      const name = subj.name || subj.subjectName || subj.title || '';
      const code = subj.code || subj.subjectCode || '';
      return name.toLowerCase().includes(query) || code.toLowerCase().includes(query);
    });
  }, [subjects, searchQuery]);

  const { subjectsLabel: label } = useInstituteLabels();
  const displayLabel = label || 'Subjects';

  if (!selectedInstitute || !selectedClass) return null;

  if (loading) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            {displayLabel}
          </h3>
        </div>
        <div className="flex gap-2.5 overflow-hidden">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 w-44 rounded-xl bg-muted animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center">
        <BookOpen className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1.5" />
        <p className="text-sm text-muted-foreground">No {displayLabel.toLowerCase()} available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with search */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          {displayLabel}
          <span className="text-xs font-normal text-muted-foreground">({filteredSubjects.length})</span>
        </h3>
        {subjects.length > 5 && (
          <div className="relative w-36">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-border/60 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>
        )}
      </div>

      {filteredSubjects.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground bg-card rounded-xl border border-border/50">
          <p className="text-sm">{searchQuery ? `No ${displayLabel.toLowerCase()} found for "${searchQuery}"` : `No ${displayLabel.toLowerCase()} available`}</p>
        </div>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth pb-1">
          {filteredSubjects.map((subj) => {
            const subjId = subj.subjectId || subj.id;
            const isSelected = !!subjId && selectedSubject?.id === subjId;
            const subjectName = subj.name || subj.subjectName || subj.title || 'Unnamed';
            const subjectCode = subj.code || subj.subjectCode || subj.shortName || '';
            const subjectType = subj.subjectType || subj.type || '';
            const subjectImage = subj.imgUrl || subj.image || subj.thumbnail || subj.logo || '';
            const avatarColor = getSubjectColor(subjectName);

            return (
              <button
                key={subjId || subjectName}
                onClick={() => handleSelect(subj)}
                className={`
                  relative flex flex-row items-center gap-3 p-3 rounded-xl shrink-0
                  min-w-[160px] max-w-[240px] border text-left transition-all active:scale-[0.97]
                  ${isSelected
                    ? 'bg-violet-500/10 border-violet-500/30 ring-1 ring-violet-500/20'
                    : 'bg-card border-border hover:border-violet-500/20 hover:bg-accent/40'
                  }
                `}
              >
                {subjectImage ? (
                  <img
                    src={getImageUrl(subjectImage)}
                    alt={subjectName}
                    loading="lazy"
                    className="w-10 h-10 rounded-xl object-cover shrink-0 ring-1 ring-border"
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-base select-none ${avatarColor}`}>
                    {subjectName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight truncate ${
                    isSelected ? 'text-violet-700 dark:text-violet-300' : 'text-foreground'
                  }`}>
                    {subjectName}
                  </p>
                  {(subjectCode || subjectType) && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {subjectCode || subjectType}
                    </p>
                  )}
                  {isSelected && (
                    <p className="text-[10px] text-violet-500 font-medium mt-0.5">Selected</p>
                  )}
                </div>
                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center shrink-0">
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DashboardSubjectCards;
