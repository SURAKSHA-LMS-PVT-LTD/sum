import React, { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Edit, Trash2, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Column {
  key: string;
  header: string;
  render?: (value: any, row: any) => React.ReactNode;
  width?: string;
}

interface DataTableProps {
  title: string;
  data: any[];
  columns: Column[];
  onAdd?: () => void;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onView?: (row: any) => void;
  onExport?: (row: any) => void;
  searchPlaceholder?: string;
  allowAdd?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  customActions?: Array<{
    label: string;
    action: (row: any) => void;
    icon?: React.ReactNode;
    variant?: 'default' | 'destructive' | 'outline';
    condition?: (row: any) => boolean;
  }>;
  itemsPerPage?: number;
  // Server-side pagination props
  currentPage?: number;
  totalItems?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  // Section-specific props for InstituteAdmin
  sectionType?: 'lectures' | 'homework' | 'exams' | 'students';
  // Column resizing support
  columnWidths?: Record<string, number>;
  onColumnResize?: (key: string, width: number) => void;
  /** Extra element to render in the header bar (e.g. ColumnConfigurator) */
  headerExtra?: React.ReactNode;
}

const getActionText = (
  action: 'edit' | 'view' | 'submit',
  sectionType?: DataTableProps['sectionType']
) => {
  if (action === 'submit') return 'Submit';
  if (action === 'edit') return 'Edit';
  if (sectionType === 'homework') return 'Submissions';
  if (sectionType === 'exams') return 'Results';
  return 'View';
};

const DataTable = ({
  title,
  data,
  columns,
  onAdd,
  onEdit,
  onDelete,
  onView,
  onExport,
  searchPlaceholder = "Search...",
  allowAdd = true,
  allowEdit = true,
  allowDelete = true,
  customActions = [],
  itemsPerPage = 50,
  currentPage = 1,
  totalItems = 0,
  totalPages = 1,
  onPageChange,
  onItemsPerPageChange,
  sectionType,
  columnWidths,
  onColumnResize,
  headerExtra
}: DataTableProps) => {
  const { user } = useAuth();
  const instituteRole = useInstituteRole();
  const [searchTerm, setSearchTerm] = React.useState('');
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  // Column resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, colKey: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { key: colKey, startX: e.clientX, startW: currentWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(80, resizingRef.current.startW + delta);
      onColumnResize?.(resizingRef.current.key, newWidth);
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onColumnResize]);
  
  // Use server-side pagination if props are provided, otherwise use client-side
  const isServerSidePagination = Boolean(onPageChange && totalItems);
  
  // Client-side pagination logic (fallback)
  const filteredData = isServerSidePagination ? data : data.filter(row =>
    Object.values(row).some(value =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const clientTotalPages = isServerSidePagination ? totalPages : Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = isServerSidePagination ? ((currentPage - 1) * itemsPerPage) : ((currentPage - 1) * itemsPerPage);
  const paginatedData = isServerSidePagination ? data : filteredData.slice(startIndex, startIndex + itemsPerPage);
  const displayTotalItems = isServerSidePagination ? totalItems : filteredData.length;
  const displayTotalPages = isServerSidePagination ? totalPages : clientTotalPages;

  // Simplified permission check - if onAdd is provided, show the button
  const canAdd = allowAdd && onAdd && (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher');
  const canEdit = allowEdit && onEdit && (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher');
  const canDelete = allowDelete && onDelete && (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher');

  const hasActions = (canEdit && onEdit) || (canDelete && onDelete) || onView || onExport || customActions.length > 0;
  
  console.log('DataTable Debug:', {
    userRole: instituteRole,
    allowEdit,
    canEdit,
    onEdit: !!onEdit,
    onView: !!onView,
    hasActions,
    customActionsLength: customActions.length
  });

  const goToFirstPage = () => {
    if (onPageChange) {
      onPageChange(1);
    }
  };
  
  const goToLastPage = () => {
    if (onPageChange) {
      onPageChange(displayTotalPages);
    }
  };
  
  const goToNextPage = () => {
    if (onPageChange) {
      onPageChange(Math.min(currentPage + 1, displayTotalPages));
    }
  };
  
  const goToPrevPage = () => {
    if (onPageChange) {
      onPageChange(Math.max(currentPage - 1, 1));
    }
  };

  const handleItemsPerPageChange = (value: string) => {
    const newItemsPerPage = parseInt(value);
    if (onItemsPerPageChange) {
      onItemsPerPageChange(newItemsPerPage);
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-foreground truncate">{title}</h2>
        <div className="flex items-center gap-2">
          {headerExtra}
          {canAdd && (
            <Button 
              onClick={onAdd} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          )}
        </div>
      </div>

      {/* Search - Only show for client-side pagination */}
      {!isServerSidePagination && (
        <div className="relative mb-4">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Search className="h-3.5 w-3.5 text-primary" />
          </div>
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-10 border-border/60 focus:border-primary focus:ring-primary/20 bg-background"
          />
        </div>
      )}

      {/* Table Container - Fixed Height with Scrollbars */}
      <div className="border border-border/60 rounded-lg bg-card shadow-sm">
        <div className="h-[calc(100vh-280px)] overflow-auto">
          <table className="w-full min-w-[800px]">
            {/* Sticky Header */}
            <thead className="bg-muted/70 dark:bg-muted/40 sticky top-0 z-10">
              <tr>
                {columns.map((column) => {
                  const w = columnWidths?.[column.key];
                  return (
                    <th
                      key={column.key}
                      className="relative px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r border-border/40 last:border-r-0 select-none"
                      style={w ? { width: w, minWidth: w, maxWidth: w } : { minWidth: 120 }}
                    >
                      {column.header}
                      {onColumnResize && (
                        <span
                          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 z-20"
                          onMouseDown={(e) => handleResizeStart(e, column.key, w || 180)}
                        />
                      )}
                    </th>
                  );
                })}
                {(onEdit || onView || onDelete || onExport || customActions.length > 0) && (
                  <th className="w-[1%] min-w-[156px] whitespace-nowrap px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-l border-border/40">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            
            {/* Table Body */}
            <tbody className="bg-card divide-y divide-border/40">
              {paginatedData.length > 0 ? (
                paginatedData.map((row, index) => (
                  <tr 
                    key={index} 
                    className="hover:bg-muted/40 transition-colors"
                  >
                    {columns.map((column) => {
                      const w = columnWidths?.[column.key];
                      return (
                        <td 
                          key={column.key} 
                          className="px-4 py-3 text-sm text-foreground border-r border-border/20 last:border-r-0"
                          style={w ? { width: w, minWidth: w, maxWidth: w } : { minWidth: 120 }}
                        >
                          <div className="overflow-hidden" style={w ? { maxWidth: w - 32 } : { maxWidth: 200 }} title={String(row[column.key] || '-')}>
                            {column.render ? column.render(row[column.key], row) : (
                              <span className="truncate block">{row[column.key] || '-'}</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {(onEdit || onView || onDelete || onExport || customActions.length > 0) && (
                      <td className="w-[1%] min-w-[156px] whitespace-nowrap px-2 py-3 align-top text-center border-l border-border/30">
                        <div className="mx-auto flex w-full min-w-[140px] max-w-[168px] flex-col gap-1.5">
                          {onEdit && (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(row)}
                              title={sectionType === 'lectures' ? 'Edit Lectures' : sectionType === 'homework' ? 'Edit Homework' : 'Edit Exam'}
                              className="h-8 w-full justify-center px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/15"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              <span className="truncate">{getActionText('edit', sectionType)}</span>
                            </Button>
                          )}
                          {onView && (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher' || sectionType === 'students') && sectionType !== 'lectures' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onView(row)}
                              title={sectionType === 'homework' ? 'View Submissions' : sectionType === 'students' ? 'View Details' : 'View Results'}
                              className="h-8 w-full justify-center px-2 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              <span className="truncate">{getActionText('view', sectionType)}</span>
                            </Button>
                          )}
                          {/* Student-specific actions */}
                          {instituteRole === 'Student' && sectionType === 'homework' && onEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(row)}
                              title="Submit"
                              className="h-8 w-full justify-center px-2 text-xs border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-500/30 dark:text-violet-400 dark:hover:bg-violet-500/15"
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              <span className="truncate">{getActionText('submit', sectionType)}</span>
                            </Button>
                          )}
                           {instituteRole === 'Student' && sectionType === 'exams' && onView && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onView(row)}
                              title="View Results"
                              className="h-8 w-full justify-center px-2 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              <span className="truncate">{getActionText('view', sectionType)}</span>
                            </Button>
                          )}
                          
                          {/* Custom Actions */}
                          {customActions.map((action, actionIndex) => (
                            <Button
                              key={actionIndex}
                              variant={action.variant || "outline"}
                              size="sm"
                              onClick={() => action.action(row)}
                              title={action.label}
                              className="h-8 w-full justify-center px-2 text-xs border-border/60 hover:bg-accent"
                            >
                              {action.icon && <span className="mr-1">{action.icon}</span>}
                              <span className="truncate">{action.label}</span>
                            </Button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td 
                    colSpan={columns.length + ((onEdit || onView || onDelete || onExport || customActions.length > 0) ? 1 : 0)} 
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <Search className="h-8 w-8 opacity-20" />
                      <p className="text-sm">No records found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-muted/50 dark:bg-muted/30 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              <span>
                Showing {displayTotalItems > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, displayTotalItems)} of {displayTotalItems} results
              </span>
            </div>
            
            {/* Items per page selector */}
            {onItemsPerPageChange && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show:</span>
                <Select value={itemsPerPage.toString()} onValueChange={(value: string) => {
                  const newItemsPerPage = parseInt(value);
                  if (onItemsPerPageChange) {
                    onItemsPerPageChange(newItemsPerPage);
                  }
                }}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          {displayTotalPages > 1 && (
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange && onPageChange(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange && onPageChange(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center space-x-1 mx-2">
                <span className="text-sm font-medium text-foreground">
                  Page {currentPage} of {displayTotalPages}
                </span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange && onPageChange(Math.min(currentPage + 1, displayTotalPages))}
                disabled={currentPage === displayTotalPages}
                className="h-8 w-8 p-0"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange && onPageChange(displayTotalPages)}
                disabled={currentPage === displayTotalPages}
                className="h-8 w-8 p-0"
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataTable;
