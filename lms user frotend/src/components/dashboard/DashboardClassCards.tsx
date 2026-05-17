import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { instituteClassesApi } from '@/api/instituteClasses.api';
import { School, ChevronRight, ChevronLeft, Loader2, BookOpen, Search } from 'lucide-react';
import type { Class } from '@/contexts/types/auth.types';
import { getImageUrl } from '@/utils/imageUrlHelper';

// Deterministic color from class name
const getClassColor = (name: string) => {
  const palette = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-600', 'bg-orange-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500'];
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h) + name.charCodeAt(i);
  return palette[Math.abs(h) % palette.length];
};

const DashboardClassCards = ({ compact = false }: { compact?: boolean }) => {
  const { selectedInstitute, selectedClass, setSelectedClass, user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedInstitute?.id) return;

    // Re-fetch if institute changed
    if (hasLoadedRef.current === selectedInstitute.id) return;
    hasLoadedRef.current = selectedInstitute.id;

    setClasses([]);
    setLoading(true);
    let cancelled = false;
    const load = async () => {
      try {
        const result = await instituteClassesApi.getByInstitute(selectedInstitute.id, {
          userId: user?.id,
          role: selectedInstitute.userRole,
        });
        if (cancelled) return;
        const data = (result as any)?.data ?? (Array.isArray(result) ? result : []);
        setClasses(Array.isArray(data) ? data : []);
      } catch (e) {
        if (cancelled) return;
        console.error('Failed to load classes:', e);
        setClasses([]);
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
  }, [selectedInstitute?.id]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -200 : 200,
        behavior: 'smooth',
      });
    }
  };

  const handleSelect = (cls: any) => {
    setSelectedClass({
      id: cls.id,
      name: cls.name || cls.className,
      grade: cls.grade,
      ...cls,
    } as Class);
  };

  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return classes;
    const query = searchQuery.toLowerCase();
    return classes.filter(cls => {
      const name = cls.name || cls.className || '';
      return name.toLowerCase().includes(query);
    });
  }, [classes, searchQuery]);

  if (!selectedInstitute) return null;

  if (loading) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <School className="h-4 w-4 text-primary" />
            Classes
          </h3>
        </div>
        <div className="flex gap-2.5 overflow-hidden">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 w-36 rounded-xl bg-muted animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center">
        <School className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1.5" />
        <p className="text-sm text-muted-foreground">No classes available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <School className="h-4 w-4 text-primary" />
          Classes
          <span className="text-xs font-normal text-muted-foreground">({filteredClasses.length})</span>
        </h3>
        
        <div className="flex items-center gap-2">
          {classes.length > 4 && (
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search classes..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-card border border-border/60 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>
          )}
          {filteredClasses.length > 3 && (
            <div className="hidden sm:flex gap-1">
              <button onClick={() => scroll('left')} className="w-7 h-7 rounded-full bg-muted/80 border border-border flex items-center justify-center hover:bg-accent transition-colors">
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
              <button onClick={() => scroll('right')} className="w-7 h-7 rounded-full bg-muted/80 border border-border flex items-center justify-center hover:bg-accent transition-colors">
                <ChevronRight className="h-4 w-4 text-foreground" />
              </button>
            </div>
          )}
        </div>
      </div>

      {filteredClasses.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground bg-card rounded-xl border border-border/50">
          <p className="text-sm">No classes found matching "{searchQuery}"</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth pb-1"
        >
          {filteredClasses.map((cls) => {
            const isSelected = selectedClass?.id === cls.id;
            const className = cls.name || cls.className || 'Unnamed';
            const subjectCount = cls.subjectCount || cls.subjects?.length || 0;

            const avatarColor = getClassColor(className);
            return (
              <button
                key={cls.id}
                onClick={() => handleSelect(cls)}
                className={`
                  relative flex flex-row items-center gap-3 p-3 rounded-xl shrink-0
                  min-w-[160px] max-w-[240px] border text-left transition-all active:scale-[0.97]
                  ${isSelected
                    ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20'
                    : 'bg-card border-border hover:border-emerald-500/20 hover:bg-accent/40'
                  }
                `}
              >
                {/* Avatar: real image or colored initial */}
                {(cls.imageUrl || cls.image || cls.logo || cls.thumbnail) ? (
                  <img
                    src={getImageUrl(cls.imageUrl || cls.image || cls.logo || cls.thumbnail)}
                    alt={className}
                    loading="lazy"
                    className="w-10 h-10 rounded-xl object-cover shrink-0 ring-1 ring-border"
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-base select-none ${avatarColor}`}>
                    {className.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight truncate ${
                    isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'
                  }`}>
                    {className}
                  </p>
                  {cls.grade && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Grade {cls.grade}</p>
                  )}
                  {subjectCount > 0 && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                      <BookOpen className="h-2.5 w-2.5" />
                      {subjectCount} subjects
                    </p>
                  )}
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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

export default DashboardClassCards;
