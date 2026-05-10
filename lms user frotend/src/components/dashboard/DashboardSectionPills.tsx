import React from 'react';

interface DashboardSectionPillsProps {
  sections: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

const DashboardSectionPills: React.FC<DashboardSectionPillsProps> = ({
  sections,
  activeIndex,
  onSelect,
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current?.children[activeIndex] as HTMLElement;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeIndex]);

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-0.5"
    >
      {sections.map((title, i) => (
        <button
          key={title}
          onClick={() => onSelect(i)}
          className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-all active:scale-95
            ${i === activeIndex
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
        >
          {title}
        </button>
      ))}
    </div>
  );
};

export default DashboardSectionPills;
