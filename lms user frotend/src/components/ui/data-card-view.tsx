
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Trash2 } from 'lucide-react';

interface Column {
  key: string;
  header: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataCardViewProps {
  data: any[];
  columns: Column[];
  onView?: (row: any) => void;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  customActions?: Array<{
    label: string;
    action: (row: any) => void;
    icon?: React.ReactNode;
    variant?: 'default' | 'destructive' | 'outline';
  }>;
  allowEdit?: boolean;
  allowDelete?: boolean;
}

export const DataCardView = ({ 
  data, 
  columns, 
  onView, 
  onEdit, 
  onDelete, 
  customActions = [],
  allowEdit = true,
  allowDelete = true 
}: DataCardViewProps) => {
  const hasActions = onView || (allowEdit && onEdit) || (allowDelete && onDelete) || customActions.length > 0;
  const visibleCardLimit = 8;
  const [showAllCards, setShowAllCards] = React.useState(false);
  const visibleRows = showAllCards ? data : data.slice(0, visibleCardLimit);

  return (
    <div className="block sm:hidden space-y-3 px-2">
      {visibleRows.map((row, index) => (
        <Card key={index} className="w-full shadow-sm border border-border/60 bg-card">
          <CardContent className="p-3 sm:p-4 space-y-3">
            {columns.map((column) => {
              const value = row[column.key];
              
              // Skip rendering if value is empty and it's not a rendered column
              if (!value && !column.render) return null;
              
              return (
                <div key={column.key} className="flex flex-col space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {column.header}:
                  </span>
                  <div className="text-sm text-foreground">
                    {column.render ? column.render(value, row) : (
                      <span className="break-words">{value || '-'}</span>
                    )}
                  </div>
                </div>
              );
            })}
            
            {hasActions && (
              <div className="pt-3 border-t border-border/40">
                {/* Primary Actions Row */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {onView && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onView(row)} 
                      className="flex-1 min-w-[80px] h-8 text-xs font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
                    >
                      <Eye className="h-3 w-3 mr-1.5" />
                      View
                    </Button>
                  )}
                  {allowEdit && onEdit && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onEdit(row)} 
                      className="flex-1 min-w-[80px] h-8 text-xs font-medium border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/15"
                    >
                      <Edit className="h-3 w-3 mr-1.5" />
                      Edit
                    </Button>
                  )}
                </div>
                
                {/* Custom Actions Row */}
                {customActions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {customActions.map((action, actionIndex) => (
                      <Button
                        key={actionIndex}
                        variant={action.variant || "outline"}
                        size="sm"
                        onClick={() => action.action(row)}
                        className="flex-1 min-w-[120px] h-8 text-xs font-medium"
                      >
                        {action.icon && <span className="mr-1.5 flex-shrink-0">{action.icon}</span>}
                        <span className="truncate">{action.label}</span>
                      </Button>
                    ))}
                  </div>
                )}
                
                {/* Delete Action Row */}
                {allowDelete && onDelete && (
                  <div className="flex">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onDelete(row)}
                      className="w-full h-8 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 border-red-200 hover:border-red-300 dark:border-red-800 dark:hover:border-red-700"
                    >
                      <Trash2 className="h-3 w-3 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      
      {data.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No records found</p>
        </Card>
      )}

      {data.length > visibleCardLimit && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setShowAllCards((prev) => !prev)}
        >
          {showAllCards ? 'Show less' : `Show all ${data.length} cards`}
        </Button>
      )}
    </div>
  );
};
