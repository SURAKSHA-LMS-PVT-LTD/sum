import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, Lock } from 'lucide-react';

export interface DashboardItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  color: string;
  locked?: boolean;
}

interface DashboardGridProps {
  items: DashboardItem[];
  onNavigate: (id: string) => void;
}

const DashboardGrid: React.FC<DashboardGridProps> = ({ items, onNavigate }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => !item.locked && onNavigate(item.id)}
          disabled={item.locked}
          className={`
            flex items-center gap-3 p-3.5 rounded-xl text-left
            border transition-all duration-150 active:scale-[0.98]
            ${item.locked
              ? 'opacity-40 cursor-not-allowed border-border bg-muted/30'
              : 'border-border bg-card hover:border-primary/20 hover:shadow-sm active:bg-muted/50'
            }
          `}
        >
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center shrink-0
            ${item.color} text-white shadow-sm
          `}>
            <item.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">
              {item.label}
            </p>
            {item.description && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {item.description}
              </p>
            )}
          </div>
          {item.locked ? (
            <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
};

export default DashboardGrid;
