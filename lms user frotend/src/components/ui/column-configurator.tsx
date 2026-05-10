import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings2, RotateCcw } from 'lucide-react';
import type { ColumnDef, ColumnState } from '@/hooks/useColumnConfig';

interface ColumnConfiguratorProps {
  allColumns: ColumnDef[];
  colState: Record<string, ColumnState>;
  onToggle: (key: string) => void;
  onReset: () => void;
}

const ColumnConfigurator: React.FC<ColumnConfiguratorProps> = ({
  allColumns,
  colState,
  onToggle,
  onReset,
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-1.5">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Columns</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Toggle Columns</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onReset}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {allColumns.map(col => {
            const isVisible = colState[col.key]?.visible !== false;
            const isLocked = col.locked === true;
            return (
              <label
                key={col.key}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-accent ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <Checkbox
                  checked={isVisible}
                  onCheckedChange={() => !isLocked && onToggle(col.key)}
                  disabled={isLocked}
                />
                <span className="truncate">{typeof col.header === 'string' ? col.header : col.key}</span>
                {isLocked && <span className="text-[10px] text-muted-foreground ml-auto">(locked)</span>}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColumnConfigurator;
