import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Institute } from '@/contexts/types/auth.types';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, Search, X, Building2 } from 'lucide-react';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

interface InstituteCarouselProps {
  institutes?: Institute[];
  onSelectInstitute: (institute: Institute) => void;
  isLoading?: boolean;
  compact?: boolean;
}

const InstituteCarousel: React.FC<InstituteCarouselProps> = ({
  institutes: institutesProp,
  onSelectInstitute,
  isLoading: isLoadingProp,
}) => {
  const { selectedInstitute, user } = useAuth();
  const institutes: Institute[] = institutesProp ?? user?.institutes ?? [];
  const isLoading = isLoadingProp ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) {
      const isAtEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(!isAtEnd);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (el) {
      const scrollAmount = el.clientWidth * 0.8;
      el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const filteredInstitutes = useMemo(() => {
    if (!searchQuery) return institutes;
    return institutes.filter(inst =>
      inst.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [institutes, searchQuery]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll(); 
      
      const resizeObserver = new ResizeObserver(handleScroll);
      resizeObserver.observe(el);

      return () => {
        el.removeEventListener('scroll', handleScroll);
        resizeObserver.unobserve(el);
      }
    }
  }, [isLoading, filteredInstitutes]);

  
  useEffect(() => {
    if (scrollRef.current && selectedInstitute) {
      const selectedElement = scrollRef.current.querySelector(`[data-institute-id="${selectedInstitute.id}"]`) as HTMLElement;
      if (selectedElement) {
        const container = scrollRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = selectedElement.getBoundingClientRect();
        
        if (elementRect.left < containerRect.left || elementRect.right > containerRect.right) {
          const scrollLeft = elementRect.left - containerRect.left + container.scrollLeft;
          const scrollOffset = (container.clientWidth - selectedElement.clientWidth) / 2;
          
          container.scrollTo({
            left: scrollLeft - scrollOffset,
            behavior: 'smooth',
          });
        }
      }
    }
  }, [selectedInstitute, institutes]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <div className="flex space-x-2.5 pb-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-24 flex flex-col items-center gap-1.5 p-2">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!institutes || institutes.length === 0) {
    return (
      <div className="py-2">
        <h2 className="text-sm font-semibold text-muted-foreground pl-1 mb-1.5">My Institutes</h2>
        <div className="border border-dashed rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">No institutes found.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">You are not enrolled in any institute yet.</p>
        </div>
      </div>
    );
  }
  
  const showCarousel = institutes.length > 0;
  const showScrollButtons = filteredInstitutes.length > 5;

  return (
    <div className="py-2">
        <div className="flex items-center gap-2 mb-1.5">
            <h2 className="text-sm font-semibold text-muted-foreground pl-1">My Institutes</h2>
            <div className="relative flex-1 max-w-xs ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                type="text"
                placeholder="Find institute..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg"
            />
            {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
            )}
            </div>
        </div>

        {showCarousel && (
            <div className="relative group">
                {showScrollButtons && canScrollLeft && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/50 backdrop-blur-sm rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>
                )}
                
                <div
                    ref={scrollRef}
                    className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth px-0.5 py-1"
                >
                    {filteredInstitutes.length > 0 ? filteredInstitutes.map((inst) => {
                    const isSelected = selectedInstitute?.id === inst.id;
                    const logoSrc = inst.logo || '';
                    return (
                        <button
                        key={inst.id}
                        data-institute-id={inst.id}
                        onClick={() => onSelectInstitute(inst)}
                        title={inst.name}
                        className={`
                            flex-shrink-0
                            w-24
                            h-full
                            flex flex-col items-center justify-start gap-1.5 p-2
                            rounded-xl
                            border-2 text-center transition-all duration-200
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary
                            ${isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border/20 bg-card hover:bg-muted'
                            }
                        `}
                        >
                        <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {logoSrc ? (
                            <img src={getImageUrl(logoSrc)} alt={inst.name} className="w-full h-full object-cover" />
                            ) : (
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                            )}
                        </div>
                        <p className="text-xs font-medium text-foreground line-clamp-2 w-full">
                            {inst.name}
                        </p>
                        </button>
                    );
                    }) : (
                        <div className="w-full text-center py-8">
                            <p className="text-sm text-muted-foreground">No institutes match your search.</p>
                        </div>
                    )}
                </div>

                {showScrollButtons && canScrollRight && (
                    <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/50 backdrop-blur-sm rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1/2"
                    >
                    <ChevronRight className="h-6 w-6" />
                    </button>
                )}
            </div>
        )}
    </div>
  );
};

export default InstituteCarousel;
