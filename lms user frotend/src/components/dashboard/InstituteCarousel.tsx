import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Check, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import surakshaLogo from '@/assets/suraksha-logo.png';
import type { Institute } from '@/contexts/types/auth.types';

interface InstituteCarouselProps {
  onSelectInstitute: (institute: Institute) => void;
  compact?: boolean;
}

const InstituteCarousel: React.FC<InstituteCarouselProps> = ({ onSelectInstitute, compact = false }) => {
  const { user, selectedInstitute, loadUserInstitutes, isViewingAsParent, selectedChild } = useAuth();
  const isNativeApp = Capacitor.isNativePlatform();
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current || !user?.id) return;
    hasLoadedRef.current = true;

    const load = async () => {
      try {
        // loadUserInstitutes now handles parent-child mode internally
        if (!isViewingAsParent && user?.institutes?.length) {
          setInstitutes(user.institutes);
          setLoading(false);
        }
        const data = await loadUserInstitutes();
        setInstitutes(data);
      } catch (e) {
        console.error('Failed to load institutes:', e);
        if (!isViewingAsParent && user?.institutes?.length) setInstitutes(user.institutes);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, isViewingAsParent, selectedChild?.userId]);

  // Scroll selected institute into view
  useEffect(() => {
    if (selectedInstitute && scrollRef.current) {
      const selected = scrollRef.current.querySelector(`[data-institute-id="${selectedInstitute.id}"]`);
      selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedInstitute?.id]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const filteredInstitutes = useMemo(() => {
    if (!searchQuery.trim()) return institutes;
    const query = searchQuery.toLowerCase();
    return institutes.filter(inst => {
      const name = inst.name || '';
      const shortName = inst.shortName || '';
      return name.toLowerCase().includes(query) || shortName.toLowerCase().includes(query);
    });
  }, [institutes, searchQuery]);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 w-44 rounded-xl bg-muted animate-pulse shrink-0" />
        ))}
      </div>
    );
  }

  if (institutes.length === 0) return null;

  return (
    <div className="space-y-3">
      {institutes.length > 4 && (
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search institutes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-card border border-border/60 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>
      )}

      {filteredInstitutes.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground bg-card rounded-xl border border-border/50">
          <p className="text-sm">No institutes found matching "{searchQuery}"</p>
        </div>
      ) : (
        <div className="relative group">
          {/* Scroll buttons - visible on hover for desktop */}
          {filteredInstitutes.length > 2 && (
            <>
              <button
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 border border-border shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
              <button
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 border border-border shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
              >
                <ChevronRight className="h-4 w-4 text-foreground" />
              </button>
            </>
          )}

          {/* Scrollable container */}
          <div
            ref={scrollRef}
            className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth px-0.5 py-1"
          >
            {filteredInstitutes.map((inst) => {
              const isSelected = selectedInstitute?.id === inst.id;
              const logoSrc = isNativeApp ? surakshaLogo : inst.logo || '';
              return (
                <button
                  key={inst.id}
                  data-institute-id={inst.id}
                  onClick={() => onSelectInstitute(inst)}
                  title={inst.name}
                  className={`
                    relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl shrink-0
                    border active:scale-[0.97] transition-all
                    min-w-[140px] max-w-[220px]
                    ${isSelected
                      ? 'bg-primary/10 border-primary/30 shadow-sm shadow-primary/10 ring-1 ring-primary/20'
                      : 'bg-card border-border hover:border-primary/20 hover:bg-accent/50'
                    }
                  `}
                >
                  {/* Logo / Icon */}
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={inst.shortName || inst.name}
                      loading="lazy"
                      className="w-9 h-9 rounded-lg object-cover shrink-0 ring-1 ring-border"
                    />
                  ) : (
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      <Building2 className="h-4 w-4" />
                    </div>
                  )}

                  {/* Text */}
                  <div className="min-w-0 text-left flex-1">
                    <p className={`text-sm font-semibold truncate leading-tight ${
                      isSelected ? 'text-primary' : 'text-foreground'
                    }`}>
                      {inst.shortName || inst.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                      {inst.instituteUserType
                        ? inst.instituteUserType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
                        : inst.type || 'Institute'}
                    </p>
                  </div>

                  {/* Selected check */}
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-primary flex items-center justify-center shadow-sm">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstituteCarousel;
